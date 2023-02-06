import { Behaviour } from "./Component";
import * as THREE from 'three'
import { LoopOnce, AnimationActionLoopStyles, AnimationAction } from "three";
import { getParam, deepClone } from "../engine/engine_utils";
import { AnimatorControllerModel } from "../engine/extensions/NEEDLE_animator_controller_model";
import { AnimatorController } from "./AnimatorController";
import { serializable } from "../engine/engine_serialization_decorator";
import { Mathf } from "../engine/engine_math";

const debug = getParam("debuganimator");


export declare class MixerEvent {
    type: string;
    action: THREE.AnimationAction;
    loopDelta: number;
    target: THREE.AnimationMixer;
}

export declare class PlayOptions {
    loop?: boolean | AnimationActionLoopStyles;
    clampWhenFinished?: boolean;
}

export class Animator extends Behaviour {

    @serializable()
    applyRootMotion: boolean = false;
    @serializable()
    hasRootMotion: boolean = false;
    @serializable()
    keepAnimatorControllerStateOnDisable: boolean = false;

    // set from needle animator extension
    @serializable()
    set runtimeAnimatorController(val: AnimatorControllerModel | AnimatorController | undefined | null) {
        if (this._animatorController && this._animatorController.model === val) {
            return;
        }
        if (val) {
            if (!(val instanceof AnimatorController)) {
                if (debug) console.log("Assign animator controller", val, this);
                this._animatorController = new AnimatorController(val);
            }
            else this._animatorController = val;
        }
        else this._animatorController = null;
    }
    get runtimeAnimatorController(): AnimatorController | undefined | null {
        return this._animatorController;
    }

    Play(name: string | number, layer: number = -1, normalizedTime: number = Number.NEGATIVE_INFINITY, transitionDurationInSec: number = 0) {
        this.runtimeAnimatorController?.Play(name, layer, normalizedTime, transitionDurationInSec);
    }

    Reset() {
        this._animatorController?.Reset();
    }

    SetBool(name: string | number, value: boolean) {
        this.runtimeAnimatorController?.SetBool(name, value);
    }

    GetBool(name: string | number): boolean {
        return this.runtimeAnimatorController?.GetBool(name) ?? false;
    }

    SetFloat(name: string | number, val: number) {
        this.runtimeAnimatorController?.SetFloat(name, val);
    }

    GetFloat(name: string | number): number {
        return this.runtimeAnimatorController?.GetFloat(name) ?? -1;
    }

    SetInteger(name: string | number, val: number) {
        this.runtimeAnimatorController?.SetInteger(name, val);
    }

    GetInteger(name: string | number): number {
        return this.runtimeAnimatorController?.GetInteger(name) ?? -1;
    }

    SetTrigger(name: string | number) {
        this.runtimeAnimatorController?.SetTrigger(name);
    }

    ResetTrigger(name: string | number) {
        this.runtimeAnimatorController?.ResetTrigger(name);
    }

    IsInTransition(): boolean {
        return this.runtimeAnimatorController?.IsInTransition() ?? false;
    }


    SetSpeed(speed: number) {
        if (speed === this.speed) return;
        this.speed = speed;
        this._animatorController?.SetSpeed(speed);
    }

    set minMaxSpeed(minMax: { x: number, y: number }) {
        this.speed = Mathf.lerp(minMax.x, minMax.y, Math.random());
    }

    set minMaxOffsetNormalized(minMax: { x: number, y: number }) {
        this.normalizedStartOffset = Mathf.lerp(minMax.x, minMax.y, Math.random());
        if (this.runtimeAnimatorController) this.runtimeAnimatorController.normalizedStartOffset = this.normalizedStartOffset;
    }

    // set speed(val: number) {
    //     // console.trace(val);
    //     this.SetSpeed(val)
    // }

    private speed: number = 1;
    private normalizedStartOffset: number = 0;
    private _animatorController?: AnimatorController | null = null;

    awake() {
        if (debug)
            console.log("ANIMATOR", this.name, this);
        if (!this.gameObject) return;
        if (this.runtimeAnimatorController) {
            const clone = this.runtimeAnimatorController.clone();
            if (clone) {
                console.assert(this.runtimeAnimatorController !== clone);
                this.runtimeAnimatorController = clone;
                console.assert(this.runtimeAnimatorController === clone);
                this.runtimeAnimatorController.bind(this);
                this.runtimeAnimatorController.SetSpeed(this.speed);
                this.runtimeAnimatorController.normalizedStartOffset = this.normalizedStartOffset;
            }
            else console.warn("Could not clone animator controller", this.runtimeAnimatorController);
        }
    }

    onDisable() {
        if (!this.keepAnimatorControllerStateOnDisable)
            this._animatorController?.Reset();
    }

    onBeforeRender() {
        if (this._animatorController) {
            this._animatorController.update();
        }

    }
}