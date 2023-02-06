import { Behaviour } from "./Component";
import * as THREE from 'three'
import { AnimationAction, AnimationClip, Vector2 } from "three";
import { MixerEvent } from "./Animator";
import { serializable } from "../engine/engine_serialization_decorator";
import { InstancingUtil } from "../engine/engine_instancing";
import { Mathf } from "../engine/engine_math";
import { Vec2 } from "../engine/engine_types";
import { getParam } from "../engine/engine_utils";

const debug = getParam("debuganimation");

export declare class PlayOptions {
    fadeDuration?: number;
    loop?: boolean;
    exclusive?: boolean;
    startTime?: number;
    endTime?: number;
    clampWhenFinished?: boolean;
    minMaxSpeed?: Vec2;
    minMaxOffsetNormalized?: Vec2;
}

export class Animation extends Behaviour {

    @serializable()
    playAutomatically: boolean = true;
    @serializable()
    randomStartTime: boolean = true;

    minMaxSpeed?: Vec2;
    minMaxOffsetNormalized?: Vec2;

    @serializable()
    loop: boolean = true;

    @serializable()
    clampWhenFinished: boolean = false;

    private _tempAnimationClipBeforeGameObjectExisted: AnimationClip | null = null;
    get clip(): AnimationClip | null {
        return this.animations?.length ? this.animations[0] : null;
    }
    set clip(val: AnimationClip | null) {
        if (!this.__didAwake) {
            if (debug) console.log("Assign clip during serialization", val);
            this._tempAnimationClipBeforeGameObjectExisted = val;
            return;
        }
        if (!val) return;
        if (debug) console.log("Assign clip", val, Boolean(this.gameObject));
        if (!this.gameObject.animations) this.gameObject.animations = [];
        if (this.animations.includes(val)) return;
        if (this.animations.length > 0) {
            this.animations.splice(0, 0, val);
        }
        else
            this.animations.push(val);
    }

    @serializable(AnimationClip)
    set clips(animations: AnimationClip[]) {
        this.animations = animations;
    }

    set animations(animations: THREE.AnimationClip[]) {
        if (debug) console.log("assign animations", animations);
        this.gameObject.animations = animations;
    }

    get animations(): AnimationClip[] {
        return this.gameObject.animations;
    }
    /**
     * @deprecated Currently unsupported
     */
    get currentAction(): THREE.AnimationAction | null {
        return this._currentActions[0];
    }

    /**
     * @deprecated Currently unsupported
     */
    get currentActions(): THREE.AnimationAction[] {
        return this._currentActions;
    }

    private mixer: THREE.AnimationMixer | undefined = undefined;
    get actions(): Array<THREE.AnimationAction> {
        return this._actions;
    }
    set actions(val: Array<THREE.AnimationAction>) {
        this._actions = val;
    }
    private _actions: Array<THREE.AnimationAction> = [];

    // private _currentAction: THREE.AnimationAction | null = null;

    private _currentActions: THREE.AnimationAction[] = [];
    private _handles: AnimationHandle[] = [];

    awake() {
        if (debug) console.log(this);
        if (this._tempAnimationClipBeforeGameObjectExisted) {
            this.clip = this._tempAnimationClipBeforeGameObjectExisted;
            this._tempAnimationClipBeforeGameObjectExisted = null;
        }
        // console.log(...this.animations.map(m => m.name))
        if (this.playAutomatically)
            this.init();
    }

    onEnable(): void {
        if (this.playAutomatically && this.animations?.length > 0 && this.currentActions.length <= 0) {
            const index = Math.floor(Math.random() * this.actions.length);
            this.play(index);
        }
    }

    start() {
        if (this.randomStartTime && this.currentAction)
            this.currentAction.time = Math.random() * this.currentAction.getClip().duration;
    }

    update() {
        if (!this.mixer) return;
        this.mixer.update(this.context.time.deltaTime);
        for (const handle of this._handles) {
            handle._update();
        }
        if (this._handles?.length > 0)
            InstancingUtil.markDirty(this.gameObject);
    }

    getAction(name: string): THREE.AnimationAction | undefined | null {
        return this.actions?.find(a => a.getClip().name === name);
    }

    get isPlaying() {
        for (let i = 0; i < this._currentActions.length; i++) {
            if (this._currentActions[i].isRunning())
                return true;
        }
        return false;
    }

    play(clipOrNumber: AnimationClip | number | string | undefined, options?: PlayOptions): Promise<AnimationAction> | void {
        this.init();
        if (!this.mixer) return;
        if (clipOrNumber === undefined) clipOrNumber = 0;
        let clip: AnimationClip | undefined = clipOrNumber as AnimationClip;
        if (typeof clipOrNumber === 'number') {
            if (clipOrNumber >= this.animations.length) return;
            clip = this.animations[clipOrNumber];
        }
        else if (typeof clipOrNumber === "string") {
            clip = this.animations.find(a => a.name === clipOrNumber);
        }
        if (!clip) {
            console.error("Could not find clip", clipOrNumber)
            return;
        }
        if (!options) options = {};
        if (!options.minMaxOffsetNormalized) options.minMaxOffsetNormalized = this.minMaxOffsetNormalized;
        if (!options.minMaxSpeed) options.minMaxSpeed = this.minMaxSpeed;
        if (!options.loop) options.loop = this.loop;
        if (!options.clampWhenFinished) options.clampWhenFinished = this.clampWhenFinished;
        for (const act of this.actions) {
            if (act.getClip() === clip) {
                return this.internalOnPlay(act, options);
            }
        }
        const act = this.mixer.clipAction(clip);
        this.actions.push(act);
        return this.internalOnPlay(act, options);
    }

    internalOnPlay(action: AnimationAction, options?: PlayOptions): Promise<AnimationAction> {
        var prev = this.currentAction;
        if (prev === action && prev.isRunning() && prev.time < prev.getClip().duration) {
            const handle = this.tryFindHandle(action);
            if (handle) return handle.getPromise();
        }
        const stopOther = options?.exclusive ?? true;
        if (options?.fadeDuration) {
            if (stopOther)
                prev?.fadeOut(options.fadeDuration);
            action.fadeIn(options.fadeDuration);
        }
        else {
            if (stopOther)
                prev?.stop();
        }
        action.reset();
        action.enabled = true;
        action.time = 0;
        action.timeScale = 1;
        const clip = action.getClip();
        if (options?.minMaxOffsetNormalized) action.time = Mathf.lerp(options.minMaxOffsetNormalized.x, options.minMaxOffsetNormalized.y, Math.random()) * clip.duration;
        if (options?.minMaxSpeed) action.timeScale = Mathf.lerp(options.minMaxSpeed.x, options.minMaxSpeed.y, Math.random());
        if (options?.clampWhenFinished) action.clampWhenFinished = true;
        if (options?.startTime !== undefined) action.time = options.startTime;

        if (options?.loop !== undefined)
            action.loop = options.loop ? THREE.LoopRepeat : THREE.LoopOnce;
        else action.loop = THREE.LoopOnce;
        action.play();
        // console.log("PLAY", action.getClip().name, action)

        const handle = new AnimationHandle(action, this.mixer!, options, _ => {
            this._handles.splice(this._handles.indexOf(handle), 1);
            // console.log(this._handles);
        });
        this._handles.push(handle);
        return handle.getPromise();
    }

    private tryFindHandle(action: AnimationAction): AnimationHandle | undefined {
        for (const handle of this._handles) {
            if (handle.action === action)
                return handle;
        }
        return undefined;
    }


    private _didInit = false;
    init() {
        if (this._didInit) return;
        this._didInit = true;
        if (!this.gameObject) return;
        this.actions = [];
        this.mixer = new THREE.AnimationMixer(this.gameObject);
    }
}


class AnimationHandle {
    mixer: THREE.AnimationMixer;
    action: THREE.AnimationAction;
    promise: Promise<AnimationAction> | null = null;
    resolve: Function | null = null;
    reject: Function | null = null;

    private _options?: PlayOptions | undefined;
    private _resolveCallback: Function | null = null;
    private _rejectCallback: Function | null = null;
    private _loopCallback?: any;
    private _finishedCallback?: any;
    private _resolvedOrRejectedCallback?: (AnimationHandle) => void;

    constructor(action: THREE.AnimationAction, mixer: THREE.AnimationMixer, opts?: PlayOptions, cb?: (handle: AnimationHandle) => void) {
        this.action = action;
        this.mixer = mixer;
        this._resolvedOrRejectedCallback = cb;
        this._options = opts;
    }

    getPromise(): Promise<AnimationAction> {
        if (this.promise) return this.promise;

        this.promise = new Promise((res, rej) => {
            this._resolveCallback = res;
            this._rejectCallback = rej;
            this.resolve = this.onResolve.bind(this);
            this.reject = this.onReject.bind(this);
        });

        this._loopCallback = this.onLoop.bind(this);
        this._finishedCallback = this.onFinished.bind(this);
        this.mixer.addEventListener('loop', this._loopCallback);
        this.mixer.addEventListener('finished', this._finishedCallback);

        return this.promise;
    }

    _update() {

        if (!this._options) return;
        if (this._options.endTime !== undefined && this.action.time > this._options.endTime) {
            if (this._options.loop === true) {
                this.action.time = this._options.startTime ?? 0;
            }
            else {
                // this.action.stop();
                this.action.time = this._options.endTime;
                this.action.timeScale = 0;
                // if (!this._options.clampWhenFinished)
                //     this.action.stop();
                this.onResolve();
            }
        }
    }

    private onResolve() {
        this.dispose();
        this._resolvedOrRejectedCallback?.call(this, this);
        this._resolveCallback?.call(this, this.action);
    }

    private onReject(reason: any) {
        this.dispose();
        this._resolvedOrRejectedCallback?.call(this, this);
        this._rejectCallback?.call(this, reason);
    }

    private onLoop(_evt: MixerEvent) {
        // console.log("LOOP");
    }

    private onFinished(evt: MixerEvent) {
        if (evt.action === this.action) {
            // console.log("FINISHED", evt, this.action);
            this.onResolve();
        }
    }

    private dispose() {
        if (this._loopCallback)
            this.mixer.removeEventListener('loop', this._loopCallback);
        if (this._finishedCallback)
            this.mixer.removeEventListener('finished', this._finishedCallback);
        this._loopCallback = undefined;
        this._finishedCallback = undefined;
    }
}