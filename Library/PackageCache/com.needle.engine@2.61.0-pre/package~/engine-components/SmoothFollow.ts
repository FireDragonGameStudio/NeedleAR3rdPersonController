import { Camera } from "./Camera";
import { Behaviour, GameObject } from "./Component";
import * as THREE from "three";
import { Mathf } from "../engine/engine_math";
import { serializable } from "../engine/engine_serialization_decorator";
import { Object3D } from "three";
import { getWorldPosition, getWorldQuaternion } from "../engine/engine_three_utils";
import { Axes } from "../engine/engine_physics.types";

export class SmoothFollow extends Behaviour {

    @serializable(Object3D)
    target: THREE.Object3D | null = null;

    @serializable()
    followFactor = .1;
    @serializable()
    rotateFactor = .1;

    @serializable()
    positionAxes : Axes = Axes.All;

    // @serializable()
    // rotationAxes : Axes = Axes.All;

    flipForward: boolean = false;

    private static _invertForward: THREE.Quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    private _firstUpdate = true;


    onBeforeRender(): void {
        this.updateNow(false);
    }

    updateNow(hard: boolean) {
        if (!this.target || this.target === this.gameObject) return;
        if (this.followFactor > 0) {
            const wp = getWorldPosition(this.target);
            const fpos = this._firstUpdate || hard ? 1 : Mathf.clamp01(this.context.time.deltaTime * this.followFactor);
            const currentPosition = this.worldPosition;
            if(this.positionAxes & Axes.X) currentPosition.x = Mathf.lerp(currentPosition.x, wp.x, fpos);
            if(this.positionAxes & Axes.Y) currentPosition.y = Mathf.lerp(currentPosition.y, wp.y, fpos);
            if(this.positionAxes & Axes.Z) currentPosition.z = Mathf.lerp(currentPosition.z, wp.z, fpos);
            this.worldPosition = currentPosition;
        }
        if (this.rotateFactor > 0) {
            const wr = getWorldQuaternion(this.target);
            if (this.flipForward) {
                wr.premultiply(SmoothFollow._invertForward);
            }
            const frot = this._firstUpdate || hard ? 1 : Mathf.clamp01(this.context.time.deltaTime * this.rotateFactor);

            this.worldQuaternion = this.worldQuaternion.slerp(wr, frot);
        }
        this._firstUpdate = false;
    }
}