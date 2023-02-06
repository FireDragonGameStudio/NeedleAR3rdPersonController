import { inverseLerp } from "three/src/math/MathUtils";



class MathHelper {

    random(): number {
        return Math.random();
    }

    clamp(value: number, min: number, max: number) {

        if (value < min) {
            return min;
        }
        else if (value > max) {
            return max;
        }

        return value;
    }

    clamp01(value: number) {
        return this.clamp(value, 0, 1);
    }

    lerp(value1: number, value2: number, t: number) {
        t = t < 0 ? 0 : t;
        t = t > 1 ? 1 : t;
        return value1 + (value2 - value1) * t;
    }

    inverseLerp(value1: number, value2: number, t: number) {
        return (t - value1) / (value2 - value1);
    }

    remap(value: number, min1: number, max1: number, min2: number, max2: number) {
        return min2 + (max2 - min2) * (value - min1) / (max1 - min1);
    }

    moveTowards(value1: number, value2: number, amount: number) {
        value1 += amount;
        if (amount < 0 && value1 < value2) value1 = value2;
        else if (amount > 0 && value1 > value2) value1 = value2;
        return value1;
    }

    toDegrees(radians: number) {
        return radians * 180 / Math.PI;
    }

    toRadians(degrees: number) {
        return degrees * Math.PI / 180;
    }

    gammaToLinear(gamma: number) {
        return Math.pow(gamma, 2.2);
    }

    linearToGamma(linear: number) {
        return Math.pow(linear, 1 / 2.2);
    }
    
};

const Mathf = new MathHelper();

export { Mathf };