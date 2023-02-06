import { Behaviour, GameObject } from "./Component";
import * as THREE from "three";
import { PositionalAudioHelper } from 'three/examples/jsm/helpers/PositionalAudioHelper.js';
import { AudioListener } from "./AudioListener";
import * as utils from "../engine/engine_utils";
import { serializable } from "../engine/engine_serialization_decorator";
import { Application, ApplicationEvents } from "../engine/engine_application";


const debug = utils.getParam("debugaudio");

export enum AudioRolloffMode {
    /// <summary>
    ///   <para>Use this mode when you want a real-world rolloff.</para>
    /// </summary>
    Logarithmic = 0,
    /// <summary>
    ///   <para>Use this mode when you want to lower the volume of your sound over the distance.</para>
    /// </summary>
    Linear = 1,
    /// <summary>
    ///   <para>Use this when you want to use a custom rolloff.</para>
    /// </summary>
    Custom = 2,
}


export class AudioSource extends Behaviour {

    private static _didCallBeginWaitForUserInteraction: boolean = false;
    public static get userInteractionRegistered(): boolean {

        if (!AudioSource._didCallBeginWaitForUserInteraction) {
            AudioSource._didCallBeginWaitForUserInteraction = true;
            AudioSource._beginWaitForUserInteraction();
        }
        return AudioSource._userInteractionRegistered;
    }

    private static callbacks: Function[] = [];
    public static registerWaitForAllowAudio(cb: Function) {
        if (cb !== null) {
            if (this._userInteractionRegistered) {
                cb();
                return;
            }
            if (this.callbacks.indexOf(cb) === -1)
                this.callbacks.push(cb);
            if (!AudioSource._didCallBeginWaitForUserInteraction) {
                AudioSource._didCallBeginWaitForUserInteraction = true;
                AudioSource._beginWaitForUserInteraction();
            }
        }
    }

    private static _userInteractionRegistered: boolean = false;
    private static _beginWaitForUserInteraction(cb: Function | null = null) {
        if (this._userInteractionRegistered) {
            if (cb) cb();
            return;
        }
        if (cb !== null)
            this.registerWaitForAllowAudio(cb);
        const callback = () => {
            if (fn == undefined) return;
            if (AudioSource._userInteractionRegistered) return;
            AudioSource._userInteractionRegistered = true;
            console.log("registered interaction, can play audio now");
            document.removeEventListener('pointerdown', fn);
            document.removeEventListener('click', fn);
            document.removeEventListener('dragstart', fn);
            document.removeEventListener('touchstart', fn);
            for (const cb of this.callbacks) {
                cb();
            }
            this.callbacks.length = 0;
        };
        let fn = callback.bind(this);
        document.addEventListener('pointerdown', fn);
        document.addEventListener('click', fn);
        document.addEventListener('dragstart', fn);
        document.addEventListener('touchstart', fn);
    }

    @serializable()
    clip: string = "";

    @serializable()
    playOnAwake: boolean = false;

    @serializable()
    get loop(): boolean {
        if (this.sound) this._loop = this.sound.getLoop();
        return this._loop;
    }
    set loop(val: boolean) {
        this._loop = val;
        if (this.sound) this.sound.setLoop(val);
    }
    @serializable()
    get spatialBlend(): number {
        return this._spatialBlend;
    }
    set spatialBlend(val: number) {
        if (val === this._spatialBlend) return;
        this._spatialBlend = val;
        this._needUpdateSpatialDistanceSettings = true;
    }
    @serializable()
    get minDistance(): number {
        return this._minDistance;
    }
    set minDistance(val: number) {
        if (this._minDistance === val) return;
        this._minDistance = val;
        this._needUpdateSpatialDistanceSettings = true;
    }
    @serializable()
    get maxDistance(): number {
        return this._maxDistance;
    }
    set maxDistance(val: number) {
        if (this._maxDistance === val) return;
        this._maxDistance = val;
        this._needUpdateSpatialDistanceSettings = true;
    }

    private _spatialBlend: number = 0;
    private _minDistance: number = 1;
    private _maxDistance: number = 100;

    @serializable()
    get volume(): number { return this._volume; }
    set volume(val: number) {
        this._volume = val;
        if (this.sound) {
            if (debug) console.log(this.name, "audio set volume", val);
            this.sound.setVolume(val);
        }
    }
    private _volume: number = 1;

    @serializable()
    rollOffMode: AudioRolloffMode = 0;


    private _loop: boolean = false;
    private sound: THREE.PositionalAudio | null = null;
    private helper: PositionalAudioHelper | null = null;
    private wasPlaying = false;
    private audioLoader: THREE.AudioLoader | null = null;
    private shouldPlay: boolean = false;
    // set this from audio context time, used to set clip offset when setting "time" property
    // there is maybe a better way to set a audio clip current time?!
    private _lastClipStartedLoading: string | null = null;

    public get Sound(): THREE.PositionalAudio | null {
        if (!this.sound && AudioSource._userInteractionRegistered) {
            const listener = GameObject.getComponent(this.context.mainCamera, AudioListener) ?? GameObject.findObjectOfType(AudioListener, this.context);
            if (listener?.listener) {
                this.sound = new THREE.PositionalAudio(listener.listener);
                this.gameObject.add(this.sound);
            }
        }
        return this.sound;
    }

    public get ShouldPlay(): boolean { return this.shouldPlay; }

    private _focusCallback?: any;

    awake() {
        this.audioLoader = new THREE.AudioLoader();
        if (this.playOnAwake) this.shouldPlay = true;

        window.addEventListener('visibilitychange', _evt => {
            switch (document.visibilityState) {
                case "hidden":
                    this.wasPlaying = this.isPlaying;
                    this.pause();
                    break;
                case "visible":
                    if (this.wasPlaying) this.play();
                    break;
            }
        });

        this._focusCallback = () => {
            if (this.enabled && this.playOnAwake && !this.isPlaying && AudioSource._userInteractionRegistered) {
                this.play();
            }
        };

        this.context.application.addEventListener(ApplicationEvents.Visible, this._focusCallback);
    }

    onDestroy() {
        this.context.application.removeEventListener(ApplicationEvents.Visible, this._focusCallback);
    }


    onEnable(): void {
        if (!AudioSource._userInteractionRegistered) {
            AudioSource._beginWaitForUserInteraction(() => {
                if (this.enabled && !this.destroyed && this.shouldPlay)
                    this.loadAndPlay(this.clip);
            });
        }
        else if (this.playOnAwake && this.context.application.isVisible) {
            this.play();
        }
    }

    onDisable() {
        this.stop();
    }

    private lerp = (x, y, a) => x * (1 - a) + y * a;

    private onLoaded(buffer) {
        if (debug) console.log("audio buffer loaded");
        AudioSource.registerWaitForAllowAudio(() => {
            if (debug)
                console.log("finished loading", buffer);

            const sound = this.Sound;
            if (!sound) {
                console.warn("Failed getting sound", this.name);
                return;
            }
            if (sound.isPlaying)
                sound.stop();

            sound.setBuffer(buffer);
            sound.loop = this._loop;
            sound.setVolume(this.volume);
            sound.autoplay = this.shouldPlay;
            // sound.setDistanceModel('linear');
            // sound.setRolloffFactor(1);
            this.applySpatialDistanceSettings();
            // sound.setDirectionalCone(180, 360, 0.1);
            if (sound.isPlaying)
                sound.stop();

            if (debug) console.log(this.name, this.shouldPlay, AudioSource.userInteractionRegistered, this);

            if (this.shouldPlay && AudioSource._userInteractionRegistered)
                this.play();
        });
    }

    private applySpatialDistanceSettings() {
        const sound = this.sound;
        if (!sound) return;
        this._needUpdateSpatialDistanceSettings = false;
        const dist = this.lerp(10 * this._maxDistance / Math.max(0.0001, this.spatialBlend), this._minDistance, this.spatialBlend);
        if (debug) console.log(this.name, this._minDistance, this._maxDistance, this.spatialBlend, "Ref distance=" + dist);
        sound.setRefDistance(dist);
        sound.setMaxDistance(Math.max(0.01, this._maxDistance));
        // https://developer.mozilla.org/en-US/docs/Web/API/PannerNode/distanceModel
        switch (this.rollOffMode) {
            case AudioRolloffMode.Logarithmic:
                sound.setDistanceModel('exponential');
                break;
            case AudioRolloffMode.Linear:
                sound.setDistanceModel('linear');
                break;
            case AudioRolloffMode.Custom:
                break;
        }

        if (this.spatialBlend > 0) {
            if (debug && !this.helper) {
                this.helper = new PositionalAudioHelper(sound, sound.getRefDistance());
                sound.add(this.helper);
            }
        }
        else if (this.helper && this.helper.parent) {
            this.helper.removeFromParent();
        }
    }

    private loadAndPlay(clip?: string) {
        if (clip)
            this.clip = clip;
        if (this.clip) {
            if (debug)
                console.log(this.clip);
            if (this.clip.endsWith(".mp3") || this.clip.endsWith(".wav")) {
                if (!this.audioLoader)
                    this.audioLoader = new THREE.AudioLoader();
                this.shouldPlay = true;
                if (this._lastClipStartedLoading === this.clip) {
                    if (debug) console.log("Is currently loading:", this._lastClipStartedLoading, this)
                    return;
                }
                this._lastClipStartedLoading = this.clip;
                if (debug)
                    console.log("load audio", this.clip);
                this.audioLoader.load(this.clip, this.onLoaded.bind(this), () => { }, console.error);
            }
        }
    }

    play(clip: string | undefined = undefined) {
        if (!this.audioLoader || !this.sound || (clip && clip !== this.clip)) {
            this.loadAndPlay(clip);
            return;
        }

        this.shouldPlay = true;
        this._hasEnded = false;
        if (debug)
            console.log("play", this.sound?.getVolume(), this.sound);
        if (this.sound && !this.sound.isPlaying) {
            this.sound.play();
        }
    }

    pause() {
        if (debug) console.log("Pause", this);
        this._hasEnded = true;
        this.shouldPlay = false;
        if (this.sound && this.sound.isPlaying && this.sound.source) {
            this._lastContextTime = this.sound?.context.currentTime;
            this.sound.pause();
        }
    }

    stop() {
        if (debug) console.log("Pause", this);
        this._hasEnded = true;
        this.shouldPlay = false;
        if (this.sound && this.sound.source) {
            this._lastContextTime = this.sound?.context.currentTime;
            if (debug)
                console.log(this._lastContextTime)
            this.sound.stop();
        }
    }

    private _lastContextTime: number = 0;

    get isPlaying(): boolean { return this.sound?.isPlaying ?? false; }
    set isPlaying(_: boolean) { }

    get time(): number { return this.sound?.source ? (this.sound.source?.context.currentTime - this._lastContextTime + this.sound.offset) : 0; }
    set time(val: number) {
        if (this.sound) {
            if (val === this.sound.offset) return;
            const wasPlaying = this.isPlaying;
            this.stop();
            this.sound.offset = val;
            if (wasPlaying)
                this.play();
        }
    }

    private _hasEnded: boolean = true;
    private _needUpdateSpatialDistanceSettings: boolean = false;

    update() {
        if (this.helper) {
            if (this.isPlaying)
                this.helper.update();
            this.helper.visible = this.isPlaying;
        }

        if (this._needUpdateSpatialDistanceSettings) {
            this.applySpatialDistanceSettings();
        }

        if (this.sound && !this.sound.isPlaying && this.shouldPlay && !this._hasEnded) {
            this._hasEnded = true;
            if (debug)
                console.log("Audio clip ended", this.clip);
            this.sound.dispatchEvent({ type: 'ended', target: this });
        }

        // this.gameObject.position.x = Math.sin(time.time) * 2;
        // this.gameObject.position.z = Math.cos(time.time * .5) * 2;
    }
}