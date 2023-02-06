import { Animator } from '../Animator';
import { Behaviour, GameObject } from '../Component';
import * as THREE from 'three';
import { AudioListener } from '../AudioListener';
import { AudioSource } from '../AudioSource';
import { SignalReceiver } from './SignalAsset';
import * as Models from "./TimelineModels";
import * as Tracks from "./TimelineTracks";
import { deepClone, getParam } from '../../engine/engine_utils';
import { GuidsMap } from '../../engine/engine_types';
import { Object3D } from 'three';

const debug = getParam("debugtimeline");

/// <summary>
///   <para>Wrap mode for Playables.</para>
/// </summary>
export enum DirectorWrapMode {
    /// <summary>
    ///   <para>Hold the last frame when the playable time reaches it's duration.</para>
    /// </summary>
    Hold = 0,
    /// <summary>
    ///   <para>Loop back to zero time and continue playing.</para>
    /// </summary>
    Loop = 1,
    /// <summary>
    ///   <para>Do not keep playing when the time reaches the duration.</para>
    /// </summary>
    None = 2,
}

/// <summary>
/// How the clip handles time outside its start and end range.
/// </summary>
export enum ClipExtrapolation {
    /// <summary>
    /// No extrapolation is applied.
    /// </summary>
    None = 0,
    /// <summary>
    /// Hold the time at the end value of the clip.
    /// </summary>
    Hold = 1,
    /// <summary>
    /// Repeat time values outside the start/end range.
    /// </summary>
    Loop = 2,
    /// <summary>
    /// Repeat time values outside the start/end range, reversing direction at each loop
    /// </summary>
    PingPong = 3,
    /// <summary>
    /// Time values are passed in without modification, extending beyond the clips range
    /// </summary>
    Continue = 4
};

export type CreateTrackFunction = (director: PlayableDirector, track: Models.TrackModel) => Tracks.TrackHandler | undefined | null;

export class PlayableDirector extends Behaviour {

    private static createTrackFunctions: { [key: string]: CreateTrackFunction } = {};
    static registerCreateTrack(type: string, fn: CreateTrackFunction) {
        this.createTrackFunctions[type] = fn;
    }

    playableAsset?: Models.TimelineAssetModel;
    playOnAwake?: boolean;
    extrapolationMode: DirectorWrapMode = DirectorWrapMode.Loop;

    get isPlaying(): boolean { return this._isPlaying; }
    get isPaused(): boolean { return this._isPaused; }
    get time(): number { return this._time; }
    set time(value: number) { this._time = value; }
    get duration(): number { return this._duration; }
    set duration(value: number) { this._duration = value; }
    get weight(): number { return this._weight; };
    set weight(value: number) { this._weight = value; }

    private _visibilityChangeEvt?: any;
    private _clonedPlayableAsset: boolean = false;

    awake(): void {
        if (debug)
            console.log(this, this.playableAsset?.tracks);

        this.rebuildGraph();

        if (!this.isValid()) console.warn("PlayableDirector is not valid", this.playableAsset, this.playableAsset?.tracks, Array.isArray(this.playableAsset?.tracks), this);
    }

    onEnable() {
        for (const track of this._audioTracks) {
            track.onEnable?.();
        }
        for (const track of this._customTracks) {
            track.onEnable?.();
        }
        if (this.playOnAwake) {
            this.play();
        }

        if (!this._visibilityChangeEvt) this._visibilityChangeEvt = () => {
            switch (document.visibilityState) {
                case "hidden":
                    this.setAudioTracksAllowPlaying(false);
                    break;
                case "visible":
                    this.setAudioTracksAllowPlaying(true);
                    break;
            }
        }
        window.addEventListener('visibilitychange', this._visibilityChangeEvt);
    }

    onDisable(): void {
        this.stop();
        for (const track of this._audioTracks) {
            track.onDisable?.();
        }
        for (const track of this._customTracks) {
            track.onDisable?.();
        }
        if (this._visibilityChangeEvt)
            window.removeEventListener('visibilitychange', this._visibilityChangeEvt);
    }

    onDestroy(): void {
        for (const tracks of this._allTracks) {
            for (const track of tracks)
                track.onDestroy?.();
        }
    }

    rebuildGraph() {
        if (!this.isValid()) return;
        this.resolveBindings();
        this.updateTimelineDuration();
        this.setupAndCreateTrackHandlers();
    }

    play() {
        if (!this.isValid()) return;
        this._isPaused = false;
        if (this._isPlaying) return;
        this._isPlaying = true;
        this._internalUpdateRoutine = this.startCoroutine(this.internalUpdate());
    }

    pause() {
        this._isPaused = true;
    }

    stop() {
        for(const track of this._audioTracks) track.stop();
        if (this._isPlaying) {
            this._time = 0;
            this._isPlaying = false;
            this._isPaused = false;
            this.evaluate();
        }
        this._isPlaying = false;
        this._isPaused = false;
        if (this._internalUpdateRoutine)
            this.stopCoroutine(this._internalUpdateRoutine);
        this._internalUpdateRoutine = null;
    }

    evaluate() {
        if (!this.isValid()) return;
        let t = this._time;
        switch (this.extrapolationMode) {
            case DirectorWrapMode.Hold:
                t = Math.min(t, this._duration);
                break;
            case DirectorWrapMode.Loop:
                t %= this._duration;
                break;
            case DirectorWrapMode.None:
                if (t > this._duration) {
                    this.stop();
                    return;
                }
                break;
        }
        this.internalEvaluate(t);
    }

    isValid() {
        return this.playableAsset && this.playableAsset.tracks && Array.isArray(this.playableAsset.tracks);
    }

    *forEachTrack() {
        for (const tracks of this._allTracks) {
            for (const track of tracks)
                yield track;
        }
    }

    get audioTracks() : Tracks.AudioTrackHandler[] {
        return this._audioTracks;
    }

    private _guidsMap?: GuidsMap;
    resolveGuids(map: GuidsMap) {
        this._guidsMap = map;
    }

    // INTERNALS

    private _isPlaying: boolean = false;
    private _internalUpdateRoutine: any;
    private _isPaused: boolean = false;
    private _time: number = 0;
    private _duration: number = 0;
    private _weight: number = 1;
    private _animationTracks: Array<Tracks.AnimationTrackHandler> = [];
    private _audioTracks: Array<Tracks.AudioTrackHandler> = [];
    private _signalTracks: Array<Tracks.SignalTrackHandler> = [];
    private _controlTracks: Array<Tracks.ControlTrackHandler> = [];
    private _customTracks: Array<Tracks.TrackHandler> = [];

    private _allTracks: Array<Array<Tracks.TrackHandler>> = [
        this._animationTracks,
        this._audioTracks,
        this._signalTracks,
        this._controlTracks,
        this._customTracks
    ];

    private *internalUpdate() {
        while (this._isPlaying && this.activeAndEnabled) {
            if (!this._isPaused && this._isPlaying) {
                this._time += this.context.time.deltaTime;
                this.evaluate();
            }
            // for (let i = 0; i < 5; i++)
            yield;
        }
    }

    private internalEvaluate(time: number) {
        for (const track of this.playableAsset!.tracks) {
            if (track.muted) continue;
            switch (track.type) {
                case Models.TrackType.Activation:
                    for (let i = 0; i < track.outputs.length; i++) {
                        const binding = track.outputs[i];
                        if (typeof binding === "object") {
                            let isActive: boolean = false;
                            for (const clip of track.clips) {
                                if (clip.start <= time && time <= clip.end) {
                                    isActive = true;
                                }
                            }
                            const obj = binding as THREE.Object3D;
                            if (obj.visible !== undefined)
                                obj.visible = isActive;
                        }
                    }
                    break;

            }
        }

        for (const handler of this._animationTracks) {
            handler.evaluate(time);
        }
        for (const handler of this._audioTracks) {
            handler.evaluate(time);
        }
        for (const sig of this._signalTracks) {
            sig.evaluate(time);
        }
        for (const ctrl of this._controlTracks) {
            ctrl.evaluate(time);
        }
        for (const cust of this._customTracks) {
            cust.evaluate(time);
        }

    }

    private resolveBindings() {
        if (!this._clonedPlayableAsset) {
            this._clonedPlayableAsset = true;
            this.playableAsset = deepClone(this.playableAsset);
        }

        if (!this.playableAsset || !this.playableAsset.tracks) return;


        // if the director has a parent we assume it is part of the current scene
        // if not (e.g. when loaded via adressable but not yet added to any scene)
        // we can only resolve objects that are children
        const root = this.findRoot(this.gameObject);

        for (const track of this.playableAsset.tracks) {
            for (let i = track.outputs.length - 1; i >= 0; i--) {
                let binding = track.outputs[i];
                if (typeof binding === "string") {
                    if (this._guidsMap && this._guidsMap[binding])
                        binding = this._guidsMap[binding];
                    const obj = GameObject.findByGuid(binding, root);
                    if (obj === null || typeof obj !== "object") {
                        // if the binding is missing remove it to avoid unnecessary loops
                        track.outputs.splice(i, 1);
                        console.warn("Failed to resolve binding", binding, track.name, track.type);
                    }
                    else {
                        if (debug)
                            console.log("Resolved binding", binding, "to", obj);
                        track.outputs[i] = obj;
                        if(obj instanceof Animator) {
                            // TODO: should disable? animator but this is not the animator that is currently on the object? needs investigation
                            // console.log("DISABLE ANIMATOR", obj, obj.name, binding, this._guidsMap);
                            // obj.enabled = false;
                        }
                    }
                }
                else if (binding === null) {
                    track.outputs.splice(i, 1);
                    if (PlayableDirector.createTrackFunctions[track.type]) {
                        // if a custom track doesnt have a binding its ok
                        continue;
                    }
                    // if the binding is missing remove it to avoid unnecessary loops
                    if (track.type !== Models.TrackType.Audio && track.type !== Models.TrackType.Control && track.type !== Models.TrackType.Marker)
                        console.warn("Missing binding", binding, track.name, track.type, this.name, this.playableAsset.name);
                }
            }
        }
    }

    private findRoot(current: THREE.Object3D): THREE.Object3D {
        if (current.parent)
            return this.findRoot(current.parent);
        return current;
    }

    private updateTimelineDuration() {
        this._duration = 0;
        if (!this.playableAsset || !this.playableAsset.tracks) return;
        for (const track of this.playableAsset.tracks) {
            if (track.muted === true) continue;
            for (const clip of track.clips) {
                if (clip.end > this._duration) this._duration = clip.end;
            }
        }
        // console.log("timeline duration", this._duration);
    }

    private setupAndCreateTrackHandlers() {
        this._animationTracks.length = 0;
        this._audioTracks.length = 0;
        this._signalTracks.length = 0;

        if (!this.playableAsset) return;
        const audioTracks: Array<Models.TrackModel> = [];
        for (const track of this.playableAsset!.tracks) {
            const type = track.type;
            const registered = PlayableDirector.createTrackFunctions[type];
            if (registered !== null && registered !== undefined) {
                const res = registered(this, track) as Tracks.TrackHandler;
                if (typeof res.evaluate === "function") {
                    res.director = this;
                    res.track = track;
                    this._customTracks.push(res);
                    continue;
                }
            }
            // only handle animation tracks
            if (track.type === Models.TrackType.Animation) {
                if (track.clips.length <= 0) {
                    if(debug) console.warn("Animation track has no clips", track);
                    continue;
                }
                // loop outputs / bindings, they should contain animator references
                for (let i = track.outputs.length - 1; i >= 0; i--) {
                    let binding = track.outputs[i] as Animator;
                    if(binding instanceof Object3D){
                        const anim = GameObject.getOrAddComponent(binding, Animator);
                        if(anim) binding = anim;
                    }
                    if (typeof binding.enabled === "boolean") binding.enabled = false;
                    const animationClips = binding?.gameObject?.animations;
                    if (animationClips) {
                        const handler = new Tracks.AnimationTrackHandler();
                        handler.trackOffset = track.trackOffset;
                        handler.director = this;
                        handler.track = track;
                        for (let i = 0; i < track.clips.length; i++) {
                            const clipModel = track.clips[i];
                            const animModel = clipModel.asset as Models.AnimationClipModel;
                            if (!animModel) {
                                console.error("MISSING anim model?", "clip#" + i, clipModel, track, this.playableAsset, this.name);
                                continue;
                            }
                            // console.log(clipModel, track);
                            const targetObjectId = animModel.clip;
                            let clip: any = targetObjectId;
                            if (typeof clip === "string" || typeof clip === "number") {
                                clip = animationClips.find(c => c.name === targetObjectId);
                            }
                            if (!clip) {
                                console.warn("Could not find animationClip for model", clipModel, track.name, this.name, this.playableAsset?.name);
                                continue;
                            }
                            if (!handler.mixer)
                                handler.mixer = new THREE.AnimationMixer(binding.gameObject);
                            handler.clips.push(clip);
                            // uncache because we want to create a new action
                            // this is needed because if a clip is used multiple times in a track (or even multiple tracks)
                            // we want to avoid setting weights on the same instance for clips/objects that are not active
                            handler.mixer.uncacheAction(clip);
                            handler.createHooks(clipModel.asset as Models.AnimationClipModel, clip);
                            const clipAction = handler.mixer.clipAction(clip); // new THREE.AnimationAction(handler.mixer, clip, null, null);
                            handler.actions.push(clipAction);
                            handler.models.push(clipModel);
                        }
                        this._animationTracks.push(handler);
                    }
                }
            }
            else if (track.type === Models.TrackType.Audio) {
                if (track.clips.length <= 0) continue;
                audioTracks.push(track);
            }
            else if (track.type === Models.TrackType.Marker) {
                const signalHandler: Tracks.SignalTrackHandler = new Tracks.SignalTrackHandler();
                signalHandler.director = this;
                signalHandler.track = track;
                for (const marker of track.markers) {
                    switch (marker.type) {
                        case Models.MarkerType.Signal:
                            signalHandler.models.push(marker as Models.SignalMarkerModel);
                            signalHandler.didTrigger.push(false);
                            break;
                    }
                }
                if (signalHandler !== null && signalHandler.models.length > 0) {
                    const rec = GameObject.getComponent(this.gameObject, SignalReceiver);
                    if (rec) {
                        signalHandler.receivers.push(rec);
                        this._signalTracks.push(signalHandler);
                    }
                }
            }
            else if (track.type === Models.TrackType.Signal) {
                const handler = new Tracks.SignalTrackHandler();
                handler.director = this;
                handler.track = track;
                for (const marker of track.markers) {
                    handler.models.push(marker as Models.SignalMarkerModel);
                    handler.didTrigger.push(false);
                }
                for (const bound of track.outputs) {
                    handler.receivers.push(bound as SignalReceiver);
                }
                this._signalTracks.push(handler);
            }
            else if (track.type === Models.TrackType.Control) {
                const handler = new Tracks.ControlTrackHandler();
                handler.director = this;
                handler.track = track;
                for (const clip of track.clips) {
                    handler.models.push(clip);
                }
                handler.resolveSourceObjects(this.context);
                this._controlTracks.push(handler);
            }
        }

        AudioSource.registerWaitForAllowAudio(() => {
            const listener = GameObject.findObjectOfType(AudioListener, this.context) as AudioListener;
            if (!listener) return;
            for (const track of audioTracks) {
                const audio = new Tracks.AudioTrackHandler();
                audio.director = this;
                audio.track = track;
                audio.listener = listener.listener;
                for (let i = 0; i < track.clips.length; i++) {
                    const clipModel = track.clips[i];
                    audio.addModel(clipModel);
                }
                this._audioTracks.push(audio);
            }
        });
    }

    private setAudioTracksAllowPlaying(allow: boolean) {
        for (const track of this._audioTracks) {
            track.onAllowAudioChanged(allow);
        }
    }

}
