import { Mathf } from "../engine/engine_math";
import { serializable } from "../engine/engine_serialization_decorator";

class Keyframe {
    @serializable()
    time!: number;
    @serializable()
    value!: number;
    @serializable()
    inTangent!: number;
    @serializable()
    inWeight!: number;
    @serializable()
    outTangent!: number;
    @serializable()
    outWeight!: number;
    @serializable()
    weightedMode!: number;
}

export class AnimationCurve {

    @serializable(Keyframe)
    keys!: Array<Keyframe>;

    get duration(): number {
        if (!this.keys || this.keys.length == 0) return 0;
        return this.keys[this.keys.length - 1].time;
    }

    evaluate(time: number): number {
        if (!this.keys || this.keys.length == 0) return 0;
        // if the first keyframe time is already greater than the time we want to evaluate
        // then we dont need to iterate
        if (this.keys[0].time >= time) {
            return this.keys[0].value;
        }
        for (let i = 0; i < this.keys.length; i++) {
            const kf = this.keys[i];
            if (kf.time <= time) {
                const hasNextKeyframe = i+1 < this.keys.length;
                if (hasNextKeyframe) {
                    const nextKf = this.keys[i+1];
                    // if the next
                    if(nextKf.time < time) continue;
                    const t = Mathf.remap(time, kf.time, nextKf.time, 0, 1);
                    return Mathf.lerp(kf.value, nextKf.value, t);
                }
                else {
                    return kf.value;
                }
            }
        }
        return this.keys[this.keys.length - 1].value;
    }
}