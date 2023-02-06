import { Behaviour } from "./Component";
import { serializable } from "../engine/engine_serialization_decorator";
import * as params from "../engine/engine_default_parameters";
import { Color, GridHelper as _GridHelper } from "three";

export class GridHelper extends Behaviour {

    @serializable()
    public isGizmo:boolean = false;
    @serializable(Color)
    private color0!: THREE.Color;
    @serializable(Color)
    private color1!: THREE.Color;

    private gridHelper!: THREE.GridHelper | null;
    private size!: number;
    private divisions!: number;
    private offset!: number;

    onEnable() {
        if (this.isGizmo && !params.showGizmos) return;

        const size = this.size;
        const divisions = this.divisions;
        if (!this.gridHelper) {
            this.gridHelper = new _GridHelper(size, divisions, this.color0 ?? new Color(.4, .4, .4), this.color1 ?? new Color(.6,.6,.6));
            if (this.offset !== undefined)
                this.gridHelper.position.y += this.offset;
            this.gameObject.add(this.gridHelper);
        }
    }
}
