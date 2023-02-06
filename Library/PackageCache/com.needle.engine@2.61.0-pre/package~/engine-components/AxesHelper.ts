import { Behaviour } from "./Component";
import * as params from "../engine/engine_default_parameters";
import { serializable } from "../engine/engine_serialization_decorator";
import { AxesHelper as _AxesHelper } from "three";

export class AxesHelper extends Behaviour {
    @serializable()
    public length: number = 1;
    @serializable()
    public depthTest: boolean = true;
    @serializable()
    public isGizmo:boolean = true;

    private _axes: THREE.AxesHelper | null = null;

    onEnable(): void {
        if (this.isGizmo && !params.showGizmos) return;
        if (!this._axes)
            this._axes = new _AxesHelper(this.length);
        this.gameObject.add(this._axes);
        const mat: any = this._axes.material;
        if (mat) {
            if (mat.depthTest !== undefined)
                mat.depthTest = this.depthTest;
        }
    }

    onDisable(): void {
        if (!this._axes) return;
        this.gameObject.remove(this._axes);
    }
}