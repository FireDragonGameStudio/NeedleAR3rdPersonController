import { Behaviour } from "./Component";
import { Color, Fog as Fog3 } from "three";
import { serializable } from "../engine/engine_serialization";


export enum FogMode {

    Linear = 1,
    Exponential = 2,
    ExponentialSquared = 3,
}

export class Fog extends Behaviour {

    get fog() {
        if (!this._fog) this._fog = new Fog3(0x000000, 0, 50);
        return this._fog;
    }

    get mode() {
        return FogMode.Linear;
    }

    @serializable()
    set near(value: number) {
        this.fog.near = value;
    }
    get near() {
        return this.fog.near;
    }

    @serializable()
    set far(value: number) {
        this.fog.far = value;
    }
    get far() {
        return this.fog.far;
    }

    @serializable(Color)
    set color(value: Color) {
        this.fog.color.copy(value);
    }
    get color() {
        return this.fog.color;
    }

    private _fog?: Fog3;

    onEnable() {
        this.scene.fog = this.fog;
    }

    onDisable() {
        if (this.scene.fog === this._fog)
            this.scene.fog = null;
    }


}