import { PlayableDirector } from "./PlayableDirector";
import * as Models from "./TimelineModels";
import * as THREE from 'three';
import { GameObject } from "../Component";
import { Context } from "../../engine/engine_setup";
import { SignalReceiver } from "./SignalAsset";
import { AnimationClip, Quaternion, Vector3 } from "three";
import { getParam, getPath } from "../../engine/engine_utils";

const debug = getParam("debugtimeline");

export abstract class TrackHandler {
    director!: PlayableDirector;
    track!: Models.TrackModel;

    get muted(): boolean { return this.track.muted; }
    set muted(val: boolean) {
        if (val !== this.track.muted) {
            this.track.muted = val;
            this.onMuteChanged?.call(this);
        }
    }

    *forEachClip(backwards: boolean = false): IterableIterator<Models.ClipModel> {
        if (!this.track?.clips) return;
        if (backwards) {
            for (let i = this.track.clips.length - 1; i >= 0; i--) {
                yield this.track.clips[i];
            }
        }
        else {
            for (const clip of this.track.clips) {
                yield clip;
            }
        }
    }

    onEnable?();
    onDisable?();
    onDestroy?();
    abstract evaluate(time: number);
    onMuteChanged?();

    getClipTime(time: number, model: Models.ClipModel) {
        return model.clipIn + (time - model.start) * model.timeScale;
    }

    getClipTimeNormalized(time: number, model: Models.ClipModel) {
        return (time - model.start) / model.duration;
    }

    evaluateWeight(time: number, index: number, models: Array<Models.ClipModel>, isActive: boolean = true) {
        if (index < 0 || index >= models.length) return 0;
        const model = models[index];
        if (isActive || time >= model.start && time <= model.end) {
            let weight = 1;
            let isBlendingWithNext = false;

            // this blending with next clips is already baked into easeIn/easeOut
            // if (allowBlendWithNext && index + 1 < models.length) {
            //     const next = models[index + 1];
            //     const nextWeight = (time - next.start) / (model.end - next.start);
            //     isBlendingWithNext = nextWeight > 0;
            //     weight = 1 - nextWeight;
            // }

            if (model.easeInDuration > 0) {
                const easeIn = Math.min((time - model.start) / model.easeInDuration, 1);
                weight *= easeIn;
            }
            if (model.easeOutDuration > 0 && !isBlendingWithNext) {
                const easeOut = Math.min((model.end - time) / model.easeOutDuration, 1);
                weight *= easeOut;
            }
            return weight;
        }
        return 0;
    }
}


class AnimationClipOffsetData {
    clip: AnimationClip;
    rootPositionOffset?: THREE.Vector3;
    rootQuaternionOffset?: THREE.Quaternion;
    get hasOffsets(): boolean { return this.rootPositionOffset !== undefined || this.rootQuaternionOffset !== undefined; }

    // not necessary
    rootStartPosition?: THREE.Vector3;
    rootEndPosition?: THREE.Vector3;
    rootStartQuaternion?: THREE.Quaternion;
    rootEndQuaternion?: THREE.Quaternion;

    constructor(action: THREE.AnimationAction) {
        const clip = action.getClip();
        this.clip = clip;
        const root = action.getRoot();
        const rootPositionTrackName = root.name + ".position";
        const rootRotationTrackName = root.name + ".quaternion";
        if (debug)
            console.log(clip.name, clip.tracks, rootPositionTrackName);
        for (const track of clip.tracks) {
            if (track.times.length <= 0) continue;
            if (track.name.endsWith(rootPositionTrackName)) {
                this.rootStartPosition = new THREE.Vector3().fromArray(track.values, 0);
                this.rootEndPosition = new THREE.Vector3().fromArray(track.values, track.values.length - 3);
                this.rootPositionOffset = this.rootEndPosition.clone().sub(this.rootStartPosition);
                if (debug)
                    console.log(this.rootPositionOffset);
                // this.rootPositionOffset.set(0, 0, 0);
            }
            else if (track.name.endsWith(rootRotationTrackName)) {
                this.rootStartQuaternion = new THREE.Quaternion().fromArray(track.values, 0);
                this.rootEndQuaternion = new THREE.Quaternion().fromArray(track.values, track.values.length - 4);
                this.rootQuaternionOffset = this.rootEndQuaternion.clone().multiply(this.rootStartQuaternion);

                if (debug) {
                    const euler = new THREE.Euler().setFromQuaternion(this.rootQuaternionOffset);
                    console.log("ROT", euler);
                }
            }
        }
    }
}

// TODO: add support for clip clamp modes (loop, pingpong, clamp)
export class AnimationTrackHandler extends TrackHandler {
    models: Array<Models.ClipModel> = [];
    trackOffset?: Models.TrackOffset;

    target?: THREE.Object3D;
    mixer?: THREE.AnimationMixer;
    clips: Array<THREE.AnimationClip> = [];
    actions: Array<THREE.AnimationAction> = [];

    /** holds data/info about clips differences */
    private _actionOffsets: Array<AnimationClipOffsetData> = [];
    private _didBind: boolean = false;

    createHooks(clipModel: Models.AnimationClipModel, clip) {
        if (clip.tracks?.length <= 0) {
            console.warn("No tracks in AnimationClip", clip);
            return;
        }
        // we only want to hook into the binding of the root object
        // TODO: test with a clip with multiple roots
        const parts = clip.tracks[0].name.split(".");
        const rootName = parts[parts.length - 2];
        const positionTrackName = rootName + ".position";
        const rotationTrackName = rootName + ".quaternion";
        let foundPositionTrack: boolean = false;
        let foundRotationTrack: boolean = false;
        for (const t of clip.tracks) {
            if (t.name.endsWith(positionTrackName)) {
                foundPositionTrack = true;
                this.createPositionInterpolant(clip, clipModel, t);
            }
            else if (t.name.endsWith(rotationTrackName)) {
                foundRotationTrack = true;
                this.createRotationInterpolant(clip, clipModel, t);
            }
        }


        // ensure we always have a position and rotation track so we can apply offsets in interpolator
        // TODO: this currently assumes that there is only one root always that has offsets so it only does create the interpolator for the first track which might be incorrect. In general it would probably be better if we would not create additional tracks but apply the offsets for these objects elsewhere!?

        if (!foundPositionTrack || !foundRotationTrack) {
            const root = this.mixer?.getRoot() as THREE.Object3D;
            const track = clip.tracks[0];
            const indexOfProperty = track.name.lastIndexOf(".");
            const baseName = track.name.substring(0, indexOfProperty);
            const objName = baseName.substring(baseName.lastIndexOf(".") + 1);
            const targetObj = root.getObjectByName(objName);
            if (targetObj) {
                if (!foundPositionTrack) {
                    const trackName = baseName + ".position";
                    if (debug) console.warn("Create position track", objName, targetObj);
                    // apply initial local position so it doesnt get flipped or otherwise changed
                    const pos = targetObj.position;
                    const track = new THREE.VectorKeyframeTrack(trackName, [0, clip.duration], [pos.x, pos.y, pos.z, pos.x, pos.y, pos.z]);
                    clip.tracks.push(track);
                    this.createPositionInterpolant(clip, clipModel, track);
                }
                else if (!foundRotationTrack) {
                    const trackName = clip.tracks[0].name.substring(0, indexOfProperty) + ".quaternion";
                    if (debug) console.warn("Create quaternion track", objName, targetObj);
                    const rot = targetObj.quaternion;
                    const track = new THREE.QuaternionKeyframeTrack(trackName, [0, clip.duration], [rot.x, rot.y, rot.z, rot.w, rot.x, rot.y, rot.z, rot.w]);
                    clip.tracks.push(track);
                    this.createRotationInterpolant(clip, clipModel, track);
                }
            }
        }
    }

    bind() {
        if (this._didBind) return;
        this._didBind = true;
        if (debug) console.log(this.models);

        // the object being animated
        if (this.mixer) this.target = this.mixer.getRoot() as THREE.Object3D;
        else console.warn("No mixer was assigned to animation track")

        for (const action of this.actions) {
            const off = new AnimationClipOffsetData(action);
            this._actionOffsets.push(off);
        }

        // Clip Offsets
        for (const model of this.models) {
            const clipData = model.asset as Models.AnimationClipModel;
            const pos = clipData.position as any;
            const rot = clipData.rotation as any;
            if (pos && pos.x !== undefined) {
                if (!pos.isVector3) {
                    clipData.position = new Vector3(pos.x, pos.y, pos.z);
                }
                if (!rot.isQuaternion) {
                    clipData.rotation = new Quaternion(rot.x, rot.y, rot.z, rot.w);
                }
            }

        }

        this.ensureTrackOffsets();
    }

    private ensureTrackOffsets() {
        if (this.trackOffset) {
            const pos = this.trackOffset.position as any;
            if (pos) {
                if (!pos.isVector3) {
                    this.trackOffset.position = new THREE.Vector3(pos.x, pos.y, pos.z);
                }
            }
            const rot = this.trackOffset.rotation as any;
            if (rot) {
                if (!rot.isQuaternion) {
                    this.trackOffset.rotation = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
                }
            }
        }
    }

    private _useclipOffsets: boolean = true;

    private _totalOffsetPosition: THREE.Vector3 = new THREE.Vector3();
    private _totalOffsetRotation: THREE.Quaternion = new THREE.Quaternion();
    private _totalOffsetPosition2: THREE.Vector3 = new THREE.Vector3();
    private _totalOffsetRotation2: THREE.Quaternion = new THREE.Quaternion();
    private _summedPos = new THREE.Vector3();
    private _tempPos = new THREE.Vector3();
    private _summedRot = new THREE.Quaternion();
    private _tempRot = new THREE.Quaternion();
    private _clipRotQuat = new THREE.Quaternion();

    evaluate(time: number) {
        if (this.track.muted) return;
        if (!this.mixer) return;
        this.bind();

        this._totalOffsetPosition.set(0, 0, 0);
        this._totalOffsetRotation.set(0, 0, 0, 1);
        this._totalOffsetPosition2.set(0, 0, 0);
        this._totalOffsetRotation2.set(0, 0, 0, 1);
        let activeClips = 0;
        let blend: number = 0;
        let didPostExtrapolate = false;
        for (let i = 0; i < this.clips.length; i++) {
            const model = this.models[i];
            const action = this.actions[i];
            const clipModel = model.asset as Models.AnimationClipModel;
            action.weight = 0;
            const isInTimeRange = time >= model.start && time <= model.end;
            const postExtrapolation: Models.ClipExtrapolation = model.postExtrapolationMode;
            let isActive = isInTimeRange;
            if (!isActive && !didPostExtrapolate && model.end < time && model.postExtrapolationMode !== Models.ClipExtrapolation.None) {
                const nextClip = i < this.clips.length - 1 ? this.models[i + 1] : null;
                // use post extrapolate if its the last clip of the next clip has not yet started
                if (!nextClip || nextClip.start > time) {
                    isActive = true;
                    didPostExtrapolate = true;
                }
            }
            if (isActive) {
                // const clip = this.clips[i];
                let weight = 1;
                weight *= this.evaluateWeight(time, i, this.models, isActive);
                // TODO: handle clipIn again
                let t = this.getClipTime(time, model);
                let loops = 0;
                const duration = clipModel.duration;

                if (isInTimeRange) {
                    if (clipModel.loop) {
                        // const t0 = t - .001;
                        loops += Math.floor(t / (duration + .000001));
                        while (t > duration) {
                            t -= duration;
                        }
                    }
                }
                else if (!isInTimeRange) {
                    switch (postExtrapolation) {
                        case Models.ClipExtrapolation.Loop:
                            t %= duration;
                            break;
                        case Models.ClipExtrapolation.PingPong:
                            const loops = Math.floor(t / duration);
                            const invert = loops % 2 !== 0;
                            t %= duration;
                            if (invert) t = duration - t;
                            break;
                    }
                }

                if(model.reversed === true) action.time = action.getClip().duration - t;
                else action.time = t;
                
                action.timeScale = 0;
                const effectiveWeight = weight * this.director.weight;
                action.weight = effectiveWeight;
                action.clampWhenFinished = true;
                if (!action.isRunning())
                    action.play();

                if (this._useclipOffsets) {
                    const totalPosition = activeClips == 0 ? this._totalOffsetPosition : this._totalOffsetPosition2;
                    const totalRotation = activeClips == 0 ? this._totalOffsetRotation : this._totalOffsetRotation2;
                    if (activeClips < 1) blend = 1 - weight;
                    activeClips += 1;

                    const summedPos = this._summedPos.set(0, 0, 0);
                    const tempPos = this._tempPos.set(0, 0, 0);
                    const summedRot = this._summedRot.identity();
                    const tempRot = this._tempRot.identity();

                    const clipOffsetRot = clipModel.rotation as Quaternion;
                    if (clipOffsetRot) {
                        this._clipRotQuat.identity();
                        this._clipRotQuat.slerp(clipOffsetRot, weight);
                    }

                    const offsets = this._actionOffsets[i];
                    if (offsets.hasOffsets) {
                        for (let i = 0; i < loops; i++) {
                            if (offsets.rootPositionOffset)
                                tempPos.copy(offsets.rootPositionOffset);
                            else tempPos.set(0, 0, 0);

                            tempPos.applyQuaternion(summedRot);
                            if (this._clipRotQuat)
                                tempPos.applyQuaternion(this._clipRotQuat);

                            if (offsets.rootQuaternionOffset) {
                                // console.log(new THREE.Euler().setFromQuaternion(offsets.rootQuaternionOffset).y.toFixed(2));
                                tempRot.copy(offsets.rootQuaternionOffset);
                                summedRot.multiply(tempRot);
                            }
                            summedPos.add(tempPos);
                        }
                    }

                    if (this._clipRotQuat)
                        totalRotation.multiply(this._clipRotQuat);
                    totalRotation.multiply(summedRot);

                    if (clipModel.position)
                        summedPos.add(clipModel.position as THREE.Vector3);
                    totalPosition.add(summedPos);
                }

            }
        }
        if (this._useclipOffsets) {
            this._totalOffsetPosition.lerp(this._totalOffsetPosition2, blend);
            this._totalOffsetRotation.slerp(this._totalOffsetRotation2, blend);
        }


        this.mixer.update(time);
    }

    private createRotationInterpolant(_clip: AnimationClip, _clipModel: Models.AnimationClipModel, track: any) {
        const createInterpolantOriginal = track.createInterpolant.bind(track);
        const quat: THREE.Quaternion = new THREE.Quaternion();
        this.ensureTrackOffsets();
        const trackOffsetRot: THREE.Quaternion | null = this.trackOffset?.rotation as Quaternion;
        track.createInterpolant = () => {
            const createdInterpolant: any = createInterpolantOriginal();
            const interpolate = createdInterpolant.evaluate.bind(createdInterpolant);
            // console.log(interpolate);
            createdInterpolant.evaluate = (time) => {
                const res = interpolate(time);
                quat.set(res[0], res[1], res[2], res[3]);
                quat.premultiply(this._totalOffsetRotation);
                // console.log(new THREE.Euler().setFromQuaternion(quat).y.toFixed(2));
                if (trackOffsetRot) quat.premultiply(trackOffsetRot);
                res[0] = quat.x;
                res[1] = quat.y;
                res[2] = quat.z;
                res[3] = quat.w;

                return res;
            };
            return createdInterpolant;
        }
    }

    private createPositionInterpolant(clip: AnimationClip, clipModel: Models.AnimationClipModel, track: any) {
        const createInterpolantOriginal = track.createInterpolant.bind(track);
        const currentPosition: THREE.Vector3 = new THREE.Vector3();
        this.ensureTrackOffsets();
        const trackOffsetRot: THREE.Quaternion | null = this.trackOffset?.rotation as Quaternion;
        const trackOffsetPos: THREE.Vector3 | null = this.trackOffset?.position as Vector3;
        let startOffset: Vector3 | null | undefined = undefined;
        track.createInterpolant = () => {
            const createdInterpolant: any = createInterpolantOriginal();
            const evaluate = createdInterpolant.evaluate.bind(createdInterpolant);
            createdInterpolant.evaluate = (time) => {
                const res = evaluate(time);
                currentPosition.set(res[0], res[1], res[2]);
                if (clipModel.removeStartOffset) {
                    if (startOffset === undefined) {
                        startOffset = null;
                        startOffset = this._actionOffsets.find(a => a.clip === clip)?.rootStartPosition?.clone();
                    }
                    else if (startOffset?.isVector3) {
                        currentPosition.sub(startOffset);
                    }
                }
                currentPosition.applyQuaternion(this._totalOffsetRotation);
                currentPosition.add(this._totalOffsetPosition);
                // apply track offset
                if (trackOffsetRot) currentPosition.applyQuaternion(trackOffsetRot);
                if (trackOffsetPos) {
                    // flipped unity X
                    currentPosition.x -= trackOffsetPos.x;
                    currentPosition.y += trackOffsetPos.y;
                    currentPosition.z += trackOffsetPos.z;
                }
                res[0] = currentPosition.x;
                res[1] = currentPosition.y;
                res[2] = currentPosition.z;
                return res;
            };
            return createdInterpolant;
        }
    }

}

const muteAudioTracks = getParam("mutetimeline");

export class AudioTrackHandler extends TrackHandler {
    models: Array<Models.ClipModel> = [];

    listener!: THREE.AudioListener;
    audio: Array<THREE.Audio> = [];
    audioContextTimeOffset: Array<number> = [];
    lastTime: number = 0;

    private getAudioFilePath(path: string) {
        // TODO: this should be the timeline asset location probably which MIGHT be different
        const glbLocation = this.director.sourceId;
        return getPath(glbLocation, path);
    }

    onAllowAudioChanged(allow: boolean) {
        for (let i = 0; i < this.models.length; i++) {
            const model = this.models[i];
            const audio = this.audio[i];
            audio.setVolume(allow ? model.asset.volume : 0);
        }
    }

    addModel(model: Models.ClipModel) {
        const path = this.getAudioFilePath(model.asset.clip);
        const audio = new THREE.Audio(this.listener);
        audio.setVolume(model.asset.volume);
        const loader = new THREE.AudioLoader();
        if (debug)
            console.log(path, this.director.sourceId);
        loader.load(path, (buffer) => {
            audio.setBuffer(buffer);
            audio.loop = model.asset.loop;
            this.audio.push(audio);
            this.models.push(model);
        });
    }

    onDisable() {
        for (const audio of this.audio) {
            if (audio.isPlaying)
                audio.stop();
        }
    }

    onMuteChanged() {
        if (this.muted) {
            for (let i = 0; i < this.audio.length; i++) {
                const audio = this.audio[i];
                if (audio?.isPlaying)
                    audio.stop();
            }
        }
    }

    stop() {
        for (let i = 0; i < this.audio.length; i++) {
            const audio = this.audio[i];
            if (audio?.isPlaying)
                audio.stop();
        }
    }
    evaluate(time: number) {
        if (muteAudioTracks) return;
        if (this.track.muted) return;
        for (let i = 0; i < this.models.length; i++) {
            const model = this.models[i];
            const audio = this.audio[i];
            if (time >= model.start && time <= model.end) {
                if (this.director.isPlaying == false) {
                    if (audio.isPlaying)
                        audio.stop();
                    if (this.lastTime === time) continue;
                }
                else if (!audio.isPlaying) {
                    audio.offset = model.clipIn + (time - model.start) * model.timeScale;
                    audio.play();
                }
                else {
                    const targetOffset = model.clipIn + (time - model.start) * model.timeScale;
                    // seems it's non-trivial to get the right time from audio sources;
                    // https://github.com/mrdoob/three.js/blob/master/src/audio/Audio.js#L170
                    const currentTime = audio.context.currentTime - audio["_startedAt"] + audio.offset;
                    const diff = Math.abs(targetOffset - currentTime);

                    if (diff > 0.3) {
                        audio.offset = targetOffset;
                        audio.stop();
                        audio.play();
                    }
                }
                let vol = model.asset.volume;
                if (model.easeInDuration > 0) {
                    const easeIn = Math.min((time - model.start) / model.easeInDuration, 1);
                    vol *= easeIn;
                }
                if (model.easeOutDuration > 0) {
                    const easeOut = Math.min((model.end - time) / model.easeOutDuration, 1);
                    vol *= easeOut;
                }
                audio.setVolume(vol * this.director.weight);
            }
            else {
                if (audio.isPlaying)
                    audio.stop();
            }
        }
        this.lastTime = time;
    }
}

export class SignalTrackHandler extends TrackHandler {
    models: Models.SignalMarkerModel[] = [];
    didTrigger: boolean[] = [];
    receivers: Array<SignalReceiver | null> = [];

    evaluate(time: number) {
        if (this.receivers.length <= 0) return;
        if (this.track.muted) return;
        for (let i = 0; i < this.models.length; i++) {
            const model = this.models[i];
            const wasTriggered = this.didTrigger[i];
            const td = model.time - time;
            let isActive = model.retroActive ? td < 0 : (td < 0 && Math.abs(td) < .1);
            if (isActive) {
                if (!wasTriggered) {
                    this.didTrigger[i] = true;
                    for (const rec of this.receivers) {
                        if (!rec) continue;
                        rec.invoke(model.asset);
                    }
                    // console.log("TRIGGER " + model.asset);
                    // TimelineSignals.invoke(model.asset);
                }
            }
            else {
                if (!model.emitOnce)
                    this.didTrigger[i] = false;
            }
        }
    }
}


export class ControlTrackHandler extends TrackHandler {
    models: Array<Models.ClipModel> = [];
    timelines: Array<PlayableDirector | null> = [];

    private static resolved: { [key: string]: THREE.Object3D } = {};

    resolveSourceObjects(context: Context) {
        for (let i = this.models.length - 1; i >= 0; i--) {
            const model = this.models[i];
            const asset = model.asset as Models.ControlClipModel;
            if (typeof asset.sourceObject === "string") {
                const key = asset.sourceObject;
                if (ControlTrackHandler.resolved[key]) {
                    asset.sourceObject = ControlTrackHandler.resolved[key];
                }
                else {
                    asset.sourceObject = GameObject.findByGuid(key, context.scene) as THREE.Object3D
                    ControlTrackHandler.resolved[key] = asset.sourceObject;
                }
            }
            if (!asset.sourceObject) {
                this.models.splice(i, 1);
                continue;
            }
            else {
                const timeline = GameObject.getComponent(asset.sourceObject, PlayableDirector)!;
                // always add it to keep size of timelines and models in sync (index of model is index of timeline)
                this.timelines.push(timeline);
                if (timeline) {
                    if (asset.updateDirector) {
                        timeline.playOnAwake = false;
                    }
                }
            }
        }
    }

    private _previousActiveModel: Models.ClipModel | null = null;

    evaluate(time: number) {
        this._previousActiveModel = null;
        for (let i = 0; i < this.models.length; i++) {
            const model = this.models[i];
            const asset = model.asset as Models.ControlClipModel;

            if (time >= model.start && time <= model.end) {
                this._previousActiveModel = model;
                const clipTime = this.getClipTime(time, model);

                if (asset.controlActivation) {
                    const obj = asset.sourceObject as THREE.Object3D;
                    obj.visible = true;
                }

                if (asset.updateDirector) {
                    const timeline = this.timelines[i];
                    if (timeline) {
                        if (timeline.isPlaying) {
                            timeline.pause();
                        }
                        timeline.time = clipTime;
                        timeline.evaluate();
                    }
                }
                // control tracks can not overlap/blend
                // break;
            }
            else {
                const previousActiveAsset = this._previousActiveModel?.asset as Models.ControlClipModel;
                if (asset.controlActivation) {
                    const obj = asset.sourceObject as THREE.Object3D;
                    if (previousActiveAsset?.sourceObject !== obj)
                        obj.visible = false;
                }
            }
        }
    }
}