import { Mathf } from "../../engine/engine_math";
import { Color } from "three";

export class RGBAColor extends Color {
    alpha: number = 1;

    get isRGBAColor() { return true; }

    set a(val: number) { this.alpha = val; }
    get a() { return this.alpha; }

    constructor(r: number, g: number, b: number, a: number) {
        super(r, g, b);
        this.alpha = a;
    }

    clone(): this {
        const cloned = super.clone();
        cloned.alpha = this.alpha;
        return cloned;
    }

    copy(col : RGBAColor | Color){
        super.copy(col);
        if("alpha" in col && typeof col.alpha === "number") {
            this.alpha = col.alpha;
        }
        else if(typeof col["a"] === "number") this.alpha = col["a"];
        return this;
    }

    lerp(color: Color, alpha: number): this {
        const rgba = color as RGBAColor;
        if(rgba.alpha) this.alpha = Mathf.lerp(this.alpha, rgba.alpha, alpha);
        return super.lerp(color, alpha);
    }

    lerpColors(color1: Color, color2: Color, alpha: number): this {
        const rgba1 = color1 as RGBAColor;
        const rgba2 = color2 as RGBAColor;
        if(rgba1.alpha && rgba2.alpha) this.alpha = Mathf.lerp(rgba1.alpha, rgba2.alpha, alpha);
        return super.lerpColors(color1, color2, alpha);
    }

    multiply(color: Color): this {
        const rgba = color as RGBAColor;
        if(rgba.alpha) this.alpha = this.alpha * rgba.alpha;
        return super.multiply(color);
    }

    fromArray(array: number[], offset: number = 0): this {
        this.alpha = array[offset + 3];
        return super.fromArray(array, offset);
    }
}