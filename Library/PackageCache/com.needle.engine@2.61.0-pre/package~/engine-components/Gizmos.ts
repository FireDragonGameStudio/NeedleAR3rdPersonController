import { Behaviour } from "./Component";
import * as THREE from "three";
import * as Gizmos from "../engine/engine_gizmos";
import * as params from "../engine/engine_default_parameters";
import { FrameEvent } from "../engine/engine_setup";
import { BoxHelper, Color } from "three";
import { serializable } from "../engine/engine_serialization_decorator";


export class BoxGizmo extends Behaviour {
    @serializable()
    objectBounds: boolean = false;
    @serializable(Color)
    color?: THREE.Color;
    @serializable()
    isGizmo : boolean = true;

    private _gizmoObject: THREE.Object3D | null | BoxHelper = null;
    private _boxHelper: BoxHelper | null = null;

    onEnable(): void {
        if (this.isGizmo && !params.showGizmos) return;
        if (!this._gizmoObject) {
            if (this.objectBounds && this.gameObject["isMesh"] === true) {
                this._gizmoObject = new THREE.BoxHelper(this.gameObject, this.color ?? 0xffff00);
            }
            else {
                this.objectBounds = false;
                this._gizmoObject = Gizmos.CreateWireCube(this.color ?? 0xffff00);
            }
        }
        if (this.objectBounds) {
            this.scene.add(this._gizmoObject);
            this._boxHelper = this._gizmoObject as BoxHelper;
            this.startCoroutine(this.syncObjectBounds(), FrameEvent.OnBeforeRender);
        }
        else
            this.gameObject.add(this._gizmoObject);
    }

    onDisable(): void {
        if (this._gizmoObject) {
            this.gameObject.remove(this._gizmoObject);
        }
    }

    private *syncObjectBounds() {
        while (this._boxHelper) {
            this._boxHelper?.update();
            yield;
        }
    }
}