import { Color, Matrix4, Object3D, PointLightShadow, Quaternion, Vector3, Vector2, Euler, Vector4, DirectionalLightHelper } from "three";
import { Mathf } from "../engine/engine_math";
import { serializable } from "../engine/engine_serialization";
import { RGBAColor } from "./js-extensions/RGBAColor";
import { AnimationCurve } from "./AnimationCurve";
import { Vec2, Vec3 } from "../engine/engine_types";
import { Context } from "../engine/engine_setup";
import { EmitterShape, FrameOverLife, Particle, ShapeJSON } from "three.quarks";
import { createNoise4D, NoiseFunction4D } from 'simplex-noise';
import { Gizmos } from "../engine/engine_gizmos";
import { getParam } from "../engine/engine_utils";

const debug = getParam("debugparticles");

declare type Color4 = { r: number, g: number, b: number, a: number };
declare type ColorKey = { time: number, color: Color4 };
declare type AlphaKey = { time: number, alpha: number };

export interface IParticleSystem {
    get currentParticles(): number;
    get maxParticles(): number;
    get time(): number;
    get deltaTime(): number;
    get duration(): number;
    readonly main: MainModule;
    get container(): Object3D;
    get worldspace(): boolean;
    get worldPos(): Vector3;
    get worldQuaternion(): Quaternion;
    get worldQuaternionInverted(): Quaternion;
    get worldScale(): Vector3;
    get matrixWorld(): Matrix4;
}


export enum ParticleSystemRenderMode {
    Billboard = 0,
    //   Stretch = 1,
    HorizontalBillboard = 2,
    VerticalBillboard = 3,
    Mesh = 4,
    //   None = 5,
}


export class Gradient {
    @serializable()
    alphaKeys!: Array<AlphaKey>;
    @serializable()
    colorKeys!: Array<ColorKey>;

    get duration(): number {
        return 1;
    }

    evaluate(time: number, target: RGBAColor) {

        // target.r = this.colorKeys[0].color.r;
        // target.g = this.colorKeys[0].color.g;
        // target.b = this.colorKeys[0].color.b;
        // target.alpha = this.alphaKeys[0].alpha;
        // return;

        let closestAlpha: AlphaKey | undefined = undefined;
        let closestAlphaIndex = 0;
        let closestColor: ColorKey | null = null;
        let closestColorIndex = 0;
        for (let i = 0; i < this.alphaKeys.length; i++) {
            const key = this.alphaKeys[i];
            if (key.time < time || !closestAlpha) {
                closestAlpha = key;
                closestAlphaIndex = i;
            }
        }
        for (let i = 0; i < this.colorKeys.length; i++) {
            const key = this.colorKeys[i];
            if (key.time < time || !closestColor) {
                closestColor = key;
                closestColorIndex = i;
            }
        }
        if (closestColor) {
            const hasNextColor = closestColorIndex + 1 < this.colorKeys.length;
            if (hasNextColor) {
                const nextColor = this.colorKeys[closestColorIndex + 1];
                const t = Mathf.remap(time, closestColor.time, nextColor.time, 0, 1);
                target.r = Mathf.lerp(closestColor.color.r, nextColor.color.r, t);
                target.g = Mathf.lerp(closestColor.color.g, nextColor.color.g, t);
                target.b = Mathf.lerp(closestColor.color.b, nextColor.color.b, t);
            }
            else {
                target.r = closestColor.color.r;
                target.g = closestColor.color.g;
                target.b = closestColor.color.b;
            }
        }
        if (closestAlpha) {
            const hasNextAlpha = closestAlphaIndex + 1 < this.alphaKeys.length;
            if (hasNextAlpha) {
                const nextAlpha = this.alphaKeys[closestAlphaIndex + 1];
                const t = Mathf.remap(time, closestAlpha.time, nextAlpha.time, 0, 1);
                target.alpha = Mathf.lerp(closestAlpha.alpha, nextAlpha.alpha, t);
            }
            else {
                target.alpha = closestAlpha.alpha;
            }
        }
        return target;
    }
}

export enum ParticleSystemCurveMode {
    Constant = 0,
    Curve = 1,
    TwoCurves = 2,
    TwoConstants = 3
}

export enum ParticleSystemGradientMode {
    Color = 0,
    Gradient = 1,
    TwoColors = 2,
    TwoGradients = 3,
    RandomColor = 4,
}

export enum ParticleSystemSimulationSpace {
    Local = 0,
    World = 1,
    Custom = 2
}

export enum ParticleSystemShapeType {
    Sphere = 0,
    SphereShell = 1,
    Hemisphere = 2,
    HemisphereShell = 3,
    Cone = 4,
    Box = 5,
    Mesh = 6,
    ConeShell = 7,
    ConeVolume = 8,
    ConeVolumeShell = 9,
    Circle = 10,
    CircleEdge = 11,
    SingleSidedEdge = 12,
    MeshRenderer = 13,
    SkinnedMeshRenderer = 14,
    BoxShell = 15,
    BoxEdge = 16,
    Donut = 17,
    Rectangle = 18,
    Sprite = 19,
    SpriteRenderer = 20
}

export enum ParticleSystemShapeMultiModeValue {
    Random = 0,
    Loop = 1,
    PingPong = 2,
    BurstSpread = 3,
}

export class MinMaxCurve {
    @serializable()
    mode!: ParticleSystemCurveMode;
    @serializable()
    constant!: number;
    @serializable()
    constantMin!: number;
    @serializable()
    constantMax!: number;
    @serializable(AnimationCurve)
    curve?: AnimationCurve;
    @serializable(AnimationCurve)
    curveMin?: AnimationCurve;
    @serializable(AnimationCurve)
    curveMax?: AnimationCurve;
    @serializable()
    curveMultiplier?: number;

    evaluate(t01: number, lerpFactor?: number): number {
        const t = lerpFactor === undefined ? Math.random() : lerpFactor;
        switch (this.mode) {
            case ParticleSystemCurveMode.Constant:
                return this.constant;
            case ParticleSystemCurveMode.Curve:
                t01 = Mathf.clamp01(t01);
                return this.curve!.evaluate(t01) * this.curveMultiplier!;
            case ParticleSystemCurveMode.TwoCurves:
                const t1 = t01 * this.curveMin!.duration;
                const t2 = t01 * this.curveMax!.duration;
                return Mathf.lerp(this.curveMin!.evaluate(t1), this.curveMax!.evaluate(t2), t % 1) * this.curveMultiplier!;
            case ParticleSystemCurveMode.TwoConstants:
                return Mathf.lerp(this.constantMin, this.constantMax, t % 1)
            default:
                this.curveMax!.evaluate(t01) * this.curveMultiplier!;
                break;
        }
        return 0;
    }
}

export class MinMaxGradient {
    mode!: ParticleSystemGradientMode;
    @serializable(RGBAColor)
    color!: RGBAColor;
    @serializable(RGBAColor)
    colorMin!: RGBAColor;
    @serializable(RGBAColor)
    colorMax!: RGBAColor;
    @serializable(Gradient)
    gradient!: Gradient;
    @serializable(Gradient)
    gradientMin!: Gradient;
    @serializable(Gradient)
    gradientMax!: Gradient;

    private static _temp: RGBAColor = new RGBAColor(0, 0, 0, 1);
    private static _temp2: RGBAColor = new RGBAColor(0, 0, 0, 1);

    evaluate(t01: number, lerpFactor?: number): RGBAColor {
        const t = lerpFactor === undefined ? Math.random() : lerpFactor;
        switch (this.mode) {
            case ParticleSystemGradientMode.Color:
                return this.color;
            case ParticleSystemGradientMode.Gradient:
                this.gradient.evaluate(t01, MinMaxGradient._temp);
                return MinMaxGradient._temp
            case ParticleSystemGradientMode.TwoColors:
                const col1 = MinMaxGradient._temp.lerpColors(this.colorMin, this.colorMax, t);
                return col1;
            case ParticleSystemGradientMode.TwoGradients:
                this.gradientMin.evaluate(t01, MinMaxGradient._temp);
                this.gradientMax.evaluate(t01, MinMaxGradient._temp2);
                return MinMaxGradient._temp.lerp(MinMaxGradient._temp2, t);

        }
        // console.warn("Not implemented", ParticleSystemGradientMode[this.mode]);
        MinMaxGradient._temp.set(0xff00ff)
        MinMaxGradient._temp.alpha = 1;
        return MinMaxGradient._temp;
    }
}

declare type ParticleSystemScalingMode = {
    Hierarchy: number;
    Local: number;
    Shape: number;
}

export class MainModule {
    cullingMode!: number;
    duration!: number;
    emitterVelocityMode!: number;
    flipRotation!: number;
    @serializable(MinMaxCurve)
    gravityModifier!: MinMaxCurve;
    gravityModifierMultiplier!: number;
    loop!: boolean;
    maxParticles!: number;
    playOnAwake!: boolean;
    prewarm!: boolean;
    ringBufferLoopRange!: { x: number, y: number };
    ringBufferMode!: boolean;
    scalingMode!: ParticleSystemScalingMode;
    simulationSpace!: ParticleSystemSimulationSpace;
    simulationSpeed!: number;
    @serializable(MinMaxGradient)
    startColor!: MinMaxGradient;
    @serializable(MinMaxCurve)
    startDelay!: MinMaxCurve;
    startDelayMultiplier!: number;
    @serializable(MinMaxCurve)
    startLifetime!: MinMaxCurve;
    startLifetimeMultiplier!: number;
    @serializable(MinMaxCurve)
    startRotation!: MinMaxCurve;
    startRotationMultiplier!: number;
    startRotation3D!: boolean;
    @serializable(MinMaxCurve)
    startRotationX!: MinMaxCurve;
    startRotationXMultiplier!: number;
    @serializable(MinMaxCurve)
    startRotationY!: MinMaxCurve;
    startRotationYMultiplier!: number;
    @serializable(MinMaxCurve)
    startRotationZ!: MinMaxCurve;
    startRotationZMultiplier!: number;
    @serializable(MinMaxCurve)
    startSize!: MinMaxCurve;
    startSize3D!: boolean;
    startSizeMultiplier!: number;
    @serializable(MinMaxCurve)
    startSizeX!: MinMaxCurve;
    startSizeXMultiplier!: number;
    @serializable(MinMaxCurve)
    startSizeY!: MinMaxCurve;
    startSizeYMultiplier!: number;
    @serializable(MinMaxCurve)
    startSizeZ!: MinMaxCurve;
    startSizeZMultiplier!: number;
    @serializable(MinMaxCurve)
    startSpeed!: MinMaxCurve;
    startSpeedMultiplier!: number;
    stopAction!: number;
    useUnscaledTime!: boolean;
}


export class ParticleBurst {
    cycleCount!: number;
    maxCount!: number;
    minCount!: number;
    probability!: number;
    repeatInterval!: number;
    time!: number;
    count!: {
        constant: number;
        constantMax: number;
        constantMin: number;
        curve?: AnimationCurve;
        curveMax?: AnimationCurve;
        curveMin?: AnimationCurve;
        curveMultiplier?: number;
        mode: ParticleSystemCurveMode;
    }


    private _performed: number = 0;


    reset() {
        this._performed = 0;
    }
    run(time: number): number {
        if (time <= this.time) {
            this.reset();
            return 0;
        }
        let amount = 0;
        if (this.cycleCount === 0 || this._performed < this.cycleCount) {
            const nextTime = this.time + this.repeatInterval * this._performed;
            if (time >= nextTime) {
                this._performed += 1;
                if (Math.random() < this.probability) {
                    switch (this.count.mode) {
                        case ParticleSystemCurveMode.Constant:
                            amount = this.count.constant;
                            break;
                        case ParticleSystemCurveMode.TwoConstants:
                            amount = Mathf.lerp(this.count.constantMin, this.count.constantMax, Math.random());
                            break;
                        case ParticleSystemCurveMode.Curve:
                            amount = this.count.curve!.evaluate(Math.random());
                            break;
                        case ParticleSystemCurveMode.TwoCurves:
                            const t = Math.random();
                            amount = Mathf.lerp(this.count.curveMin!.evaluate(t), this.count.curveMax!.evaluate(t), Math.random());
                            break;
                    }
                }
            }
        }
        return amount;
    }
}

export class EmissionModule {

    @serializable()
    enabled!: boolean;


    get burstCount() {
        return this.bursts?.length ?? 0;
    }

    @serializable()
    bursts!: ParticleBurst[];

    @serializable(MinMaxCurve)
    rateOverTime!: MinMaxCurve;
    @serializable()
    rateOverTimeMultiplier!: number;

    @serializable(MinMaxCurve)
    rateOverDistance!: MinMaxCurve;
    @serializable()
    rateOverDistanceMultiplier!: number;


    /** set from system */
    system!: IParticleSystem;

    reset() {
        this.bursts?.forEach(b => b.reset());
    }

    getBurst() {
        let amount = 0;
        if (this.burstCount > 0) {
            for (let i = 0; i < this.burstCount; i++) {
                const burst = this.bursts[i];
                if (burst.time >= this.system.time) {
                    burst.reset();
                }
                amount += Math.round(burst.run(this.system.time));
            }
        }
        return amount;
    }
}

export class ColorOverLifetimeModule {
    enabled!: boolean;
    @serializable(MinMaxGradient)
    color!: MinMaxGradient;
}

export class SizeOverLifetimeModule {
    enabled!: boolean;
    separateAxes!: boolean;
    @serializable(MinMaxCurve)
    size!: MinMaxCurve;
    sizeMultiplier!: number;
    @serializable(MinMaxCurve)
    x!: MinMaxCurve;
    xMultiplier!: number;
    @serializable(MinMaxCurve)
    y!: MinMaxCurve;
    yMultiplier!: number;
    @serializable(MinMaxCurve)
    z!: MinMaxCurve;
    zMultiplier!: number;

    private _time: number = 0;
    private _temp = new Vector3();

    evaluate(t01: number, target?: Vec3, lerpFactor?: number) {
        if (!target) target = this._temp;

        if (!this.enabled) {
            target.x = target.y = target.z = 1;
            return target;
        }

        if (!this.separateAxes) {
            const scale = this.size.evaluate(t01, lerpFactor) * this.sizeMultiplier;
            target.x = scale;
            // target.y = scale;
            // target.z = scale;
        }
        else {
            target.x = this.x.evaluate(t01, lerpFactor) * this.xMultiplier;
            target.y = this.y.evaluate(t01, lerpFactor) * this.yMultiplier;
            target.z = this.z.evaluate(t01, lerpFactor) * this.zMultiplier;
        }
        return target;
    }
}

export class ShapeModule implements EmitterShape {

    // Emittershape start
    get type(): string {
        return ParticleSystemShapeType[this.shapeType];
    }
    initialize(particle: Particle): void {
        this.getPosition();
        particle.position.copy(this._vector);
    }
    toJSON(): ShapeJSON {
        return this;
    }
    clone(): EmitterShape {
        return new ShapeModule();
    }
    // EmitterShape end

    @serializable()
    shapeType: ParticleSystemShapeType = ParticleSystemShapeType.Box;
    @serializable()
    enabled: boolean = true;
    @serializable()
    alignToDirection: boolean = false;
    @serializable()
    angle: number = 0;
    @serializable()
    arc: number = 360;
    @serializable()
    arcSpread!: number;
    @serializable()
    arcSpeedMultiplier!: number;
    @serializable()
    arcMode!: ParticleSystemShapeMultiModeValue;


    @serializable(Vector3)
    boxThickness!: Vector3;
    @serializable(Vector3)
    position!: Vector3;
    @serializable(Vector3)
    rotation!: Vector3;
    private _rotation: Euler = new Euler();
    @serializable(Vector3)
    scale!: Vector3;

    @serializable()
    radius!: number;
    @serializable()
    radiusThickness!: number;
    @serializable()
    sphericalDirectionAmount!: number;
    @serializable()
    randomDirectionAmount!: number;
    @serializable()
    randomPositionAmount!: number;

    private system!: IParticleSystem;
    private _space?: ParticleSystemSimulationSpace;
    private readonly _worldSpaceMatrix: Matrix4 = new Matrix4();
    private readonly _worldSpaceMatrixInverse: Matrix4 = new Matrix4();


    // constructor() {
    //     console.log(this);
    // }

    update(system: IParticleSystem, _context: Context, simulationSpace: ParticleSystemSimulationSpace, obj: Object3D) {
        this.system = system;
        this._space = simulationSpace;
        if (simulationSpace === ParticleSystemSimulationSpace.World) {
            this._worldSpaceMatrix.copy(obj.matrixWorld);
            // set scale to 1
            this._worldSpaceMatrix.elements[0] = 1;
            this._worldSpaceMatrix.elements[5] = 1;
            this._worldSpaceMatrix.elements[10] = 1;
            this._worldSpaceMatrixInverse.copy(this._worldSpaceMatrix).invert();
        }
    }

    private updateRotation() {
        const isRotated = this.rotation.x !== 0 || this.rotation.y !== 0 || this.rotation.z !== 0;
        if (isRotated) {
            this._rotation.x = Mathf.toRadians(this.rotation.x);
            this._rotation.y = -Mathf.toRadians(this.rotation.y);
            this._rotation.z = -Mathf.toRadians(this.rotation.z);
        }
        return isRotated;
    }

    /** nebula implementations: */

    /** initializer implementation */
    private _vector: Vector3 = new Vector3(0, 0, 0);
    private _temp: Vector3 = new Vector3(0, 0, 0);
    /** called by nebula on initialize */
    get vector() {
        return this._vector;
    }
    getPosition(): void {
        this._vector.set(0, 0, 0);
        const pos = this._temp.copy(this.position);
        const isWorldSpace = this._space === ParticleSystemSimulationSpace.World;
        if (isWorldSpace) {
            pos.applyQuaternion(this.system.worldQuaternion);
        }
        let radius = this.radius;
        if (isWorldSpace) radius *= this.system.worldScale.x;
        if (this.enabled) {
            switch (this.shapeType) {
                case ParticleSystemShapeType.Box:
                    this._vector.x = Math.random() * this.scale.x - this.scale.x / 2;
                    this._vector.y = Math.random() * this.scale.y - this.scale.y / 2;
                    this._vector.z = Math.random() * this.scale.z - this.scale.z / 2;
                    this._vector.add(pos);
                    break;
                case ParticleSystemShapeType.Cone:
                    this.randomConePoint(this.position, this.angle, radius, this.radiusThickness, this.arc, this.arcMode, this._vector);
                    break;
                case ParticleSystemShapeType.Sphere:
                    this.randomSpherePoint(this.position, radius, this.radiusThickness, this.arc, this._vector, this.scale);
                    break;
                case ParticleSystemShapeType.Circle:
                    this._temp.copy(this.scale);
                    this._temp.z = 0;
                    this.randomSpherePoint(this.position, radius, this.radiusThickness, this.arc, this._vector, this._temp);
                    break;
                default:
                    this._vector.set(0, 0, 0);
                    break;
                // case ParticleSystemShapeType.Hemisphere:
                //     randomSpherePoint(this.position.x, this.position.y, this.position.z, this.radius, this.radiusThickness, 180, this._vector);
                //     break;
            }

            this.randomizePosition(this._vector, this.randomPositionAmount);
        }

        if (this.updateRotation())
            this._vector.applyEuler(this._rotation);

        if (isWorldSpace) {
            this._vector.applyQuaternion(this.system.worldQuaternion);
            this._vector.add(this.system.worldPos);
        }
    }



    private _dir: Vector3 = new Vector3();

    getDirection(pos: Vec3): Vector3 {
        if (!this.enabled) {
            this._dir.set(0, 0, 1);
            return this._dir;
        }
        switch (this.shapeType) {
            case ParticleSystemShapeType.Box:
                this._dir.set(0, 0, 1);
                break;
            case ParticleSystemShapeType.Cone:
                this._dir.set(0, 0, 1);
                // apply cone angle
                // this._dir.applyAxisAngle(new Vector3(0, 1, 0), Mathf.toRadians(this.angle));
                break;
            case ParticleSystemShapeType.Circle:
            case ParticleSystemShapeType.Sphere:
                const rx = pos.x;
                const ry = pos.y;
                const rz = pos.z;
                this._dir.set(rx, ry, rz)
                this._dir.sub(this.position)
                break;
            default:
                this._dir.set(0, 0, 1);
                break;
        }
        if (this._space === ParticleSystemSimulationSpace.World) {
            this._dir.applyMatrix4(this._worldSpaceMatrixInverse);
        }
        if (this.updateRotation())
            this._dir.applyEuler(this._rotation);
        this._dir.normalize();
        this.spherizeDirection(this._dir, this.sphericalDirectionAmount);
        this.randomizeDirection(this._dir, this.randomDirectionAmount);
        if (debug) {
            Gizmos.DrawSphere(pos, .01, 0x883300, .5, true);
            Gizmos.DrawDirection(pos, this._dir, 0x883300, .5, true);
        }
        return this._dir;
    }

    private static _randomQuat = new Quaternion();
    private static _tempVec = new Vector3();

    private randomizePosition(pos: Vector3, amount: number) {
        if (amount <= 0) return;
        const rp = ShapeModule._tempVec;
        rp.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
        rp.x *= amount * this.scale.x;
        rp.y *= amount * this.scale.y;
        rp.z *= amount * this.scale.z;
        pos.add(rp);
    }

    private randomizeDirection(direction: Vector3, amount: number) {
        if (amount === 0) return;
        const randomQuat = ShapeModule._randomQuat;
        const tempVec = ShapeModule._tempVec;
        tempVec.set(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize();
        randomQuat.setFromAxisAngle(tempVec, amount * Math.random() * Math.PI);
        direction.applyQuaternion(randomQuat);
    }

    private spherizeDirection(dir: Vector3, amount: number) {
        if (amount === 0) return;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(1 - Math.random() * 2);
        const x = Math.sin(phi) * Math.cos(theta);
        const y = Math.sin(phi) * Math.sin(theta);
        const z = Math.cos(phi);
        const v = new Vector3(x, y, z);
        dir.lerp(v, amount);
    }

    private randomSpherePoint(pos: Vec3, radius: number, thickness: number, arc: number, vec: Vec3, scale: Vec3) {
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u * (arc / 360);
        const phi = Math.acos(2 * v - 1);
        const r = Mathf.lerp(1, 1 - (Math.pow(1 - Math.random(), Math.PI)), thickness) * (radius);
        const x = pos.x + scale.x * (-r * Math.sin(phi) * Math.cos(theta));
        const y = pos.y + scale.y * (r * Math.sin(phi) * Math.sin(theta));
        const z = pos.z + scale.z * (r * Math.cos(phi));
        vec.x = x;
        vec.y = y;
        vec.z = z;
    }

    private _loopTime: number = 0;
    private _loopDirection: number = 1;

    private randomConePoint(pos: Vec3, _angle: number, radius: number, thickness: number, arc: number, arcMode: ParticleSystemShapeMultiModeValue, vec: Vec3) {
        let u = 0;
        let v = 0;
        switch (arcMode) {
            case ParticleSystemShapeMultiModeValue.Random:
                u = Math.random();
                v = Math.random();
                break;
            case ParticleSystemShapeMultiModeValue.PingPong:
                if (this._loopTime > 1) this._loopDirection = -1;
                if (this._loopTime < 0) this._loopDirection = 1;
            // continue with loop 

            case ParticleSystemShapeMultiModeValue.Loop:
                u = .5;
                v = Math.random()
                this._loopTime += this.system.deltaTime * this._loopDirection;
                break;
        }

        let theta = 2 * Math.PI * u * (arc / 360);
        switch (arcMode) {
            case ParticleSystemShapeMultiModeValue.PingPong:
            case ParticleSystemShapeMultiModeValue.Loop:
                theta += Math.PI + .5;
                theta += this._loopTime * Math.PI * 2;
                theta %= Mathf.toRadians(arc);
                break;
        }

        const phi = Math.acos(2 * v - 1);
        const r = Mathf.lerp(1, 1 - (Math.pow(1 - Math.random(), Math.PI)), thickness) * radius;
        const x = pos.x + (-r * Math.sin(phi) * Math.cos(theta));
        const y = pos.y + (r * Math.sin(phi) * Math.sin(theta));
        const z = pos.z;
        vec.x = x * this.scale.x;
        vec.y = y * this.scale.y;
        vec.z = z * this.scale.z;
    }
}





export class NoiseModule {
    @serializable()
    damping!: boolean;
    @serializable()
    enabled!: boolean;
    @serializable()
    frequency!: number;
    @serializable()
    octaveCount!: number;
    @serializable()
    octaveMultiplier!: number;
    @serializable()
    octaveScale!: number;
    @serializable(MinMaxCurve)
    positionAmount!: MinMaxCurve;
    @serializable()
    quality!: number;

    @serializable(MinMaxCurve)
    remap!: MinMaxCurve;
    @serializable()
    remapEnabled!: boolean;
    @serializable()
    remapMultiplier!: number;
    @serializable(MinMaxCurve)
    remapX!: MinMaxCurve;
    @serializable()
    remapXMultiplier!: number;
    @serializable(MinMaxCurve)
    remapY!: MinMaxCurve;
    @serializable()
    remapYMultiplier!: number;
    @serializable(MinMaxCurve)
    remapZ!: MinMaxCurve;
    @serializable()
    remapZMultiplier!: number;

    @serializable()
    scrollSpeedMultiplier!: number;
    @serializable()
    separateAxes!: boolean;
    @serializable()
    strengthMultiplier!: number;
    @serializable(MinMaxCurve)
    strengthX!: MinMaxCurve;
    @serializable()
    strengthXMultiplier!: number;
    @serializable(MinMaxCurve)
    strengthY!: MinMaxCurve;
    @serializable()
    strengthYMultiplier!: number;
    @serializable(MinMaxCurve)
    strengthZ!: MinMaxCurve;
    @serializable()
    strengthZMultiplier!: number;


    private _noise?: NoiseFunction4D;
    private _time: number = 0;

    update(context: Context) {
        this._time += context.time.deltaTime * this.scrollSpeedMultiplier;
    }

    /** nebula implementations: */
    private _temp: Vector3 = new Vector3();
    apply(_index: number, pos: Vec3, vel: Vec3, _deltaTime: number, age: number, life: number) {
        if (!this.enabled) return;
        if (!this._noise) {
            this._noise = createNoise4D(() => 0);
        }
        const temp = this._temp.set(pos.x, pos.y, pos.z).multiplyScalar(this.frequency);
        const nx = this._noise(temp.x, temp.y, temp.z, this._time);
        const ny = this._noise(temp.x, temp.y, temp.z, this._time + 1000 * this.frequency);
        const nz = this._noise(temp.x, temp.y, temp.z, this._time + 2000 * this.frequency);
        this._temp.set(nx, ny, nz).normalize()

        const t = age / life;
        let strengthFactor = this.positionAmount.evaluate(t);
        if (!this.separateAxes) {
            if (this.strengthX) {
                strengthFactor *= this.strengthX.evaluate(t) * 1.5;
            }
            // strengthFactor *= this.strengthMultiplier;
            // strengthFactor *= deltaTime;
            this._temp.multiplyScalar(strengthFactor);
        }
        else {
            this._temp.x *= strengthFactor * this.strengthXMultiplier
            this._temp.y *= strengthFactor * this.strengthYMultiplier;
            this._temp.z *= strengthFactor * this.strengthZMultiplier;
        }
        // this._temp.setLength(strengthFactor * deltaTime);
        vel.x += this._temp.x;
        vel.y += this._temp.y;
        vel.z += this._temp.z;
    }
}

export enum ParticleSystemTrailMode {
    PerParticle,
    Ribbon,
}

export enum ParticleSystemTrailTextureMode {
    Stretch = 0,
    Tile = 1,
    DistributePerSegment = 2,
    RepeatPerSegment = 3,
}

export class TrailModule {

    @serializable()
    enabled!: boolean;

    @serializable()
    attachRibbonToTransform = false;

    @serializable(MinMaxGradient)
    colorOverLifetime!: MinMaxGradient;

    @serializable(MinMaxGradient)
    colorOverTrail!: MinMaxGradient;

    @serializable()
    dieWithParticles: boolean = true;

    @serializable()
    inheritParticleColor: boolean = true;

    @serializable(MinMaxCurve)
    lifetime!: MinMaxCurve;
    @serializable()
    lifetimeMultiplier!: number;

    @serializable()
    minVertexDistance: number = .2;

    @serializable()
    mode: ParticleSystemTrailMode = ParticleSystemTrailMode.PerParticle;

    @serializable()
    ratio: number = 1;

    @serializable()
    ribbonCount: number = 1;

    @serializable()
    shadowBias: number = 0;

    @serializable()
    sizeAffectsLifetime: boolean = false;

    @serializable()
    sizeAffectsWidth: boolean = false;

    @serializable()
    splitSubEmitterRibbons: boolean = false;

    @serializable()
    textureMode: ParticleSystemTrailTextureMode = ParticleSystemTrailTextureMode.Stretch;

    @serializable(MinMaxCurve)
    widthOverTrail!: MinMaxCurve;
    @serializable()
    widthOverTrailMultiplier!: number;

    @serializable()
    worldSpace: boolean = false;

    getWidth(size: number, _life01: number, pos01: number) {
        let res = this.widthOverTrail.evaluate(pos01);
        if (pos01 === 0) res = size;
        size *= res;
        return size;
    }

    getColor(color: Vector4, life01: number, pos01: number) {
        const overTrail = this.colorOverTrail.evaluate(pos01);
        const overLife = this.colorOverLifetime.evaluate(life01);
        color.x *= overTrail.r * overLife.r;
        color.y *= overTrail.g * overLife.g;
        color.z *= overTrail.b * overLife.b;
        color.w *= overTrail.alpha * overLife.alpha;
    }
}

export class VelocityOverLifetimeModule {
    @serializable()
    enabled!: boolean;

    /* orbital settings */


    @serializable()
    space: ParticleSystemSimulationSpace = ParticleSystemSimulationSpace.Local;

    @serializable(MinMaxCurve)
    speedModifier!: MinMaxCurve;
    @serializable()
    speedModifierMultiplier!: number;
    @serializable(MinMaxCurve)
    x!: MinMaxCurve;
    @serializable()
    xMultiplier!: number;
    @serializable(MinMaxCurve)
    y!: MinMaxCurve;
    @serializable()
    yMultiplier!: number;
    @serializable(MinMaxCurve)
    z!: MinMaxCurve;
    @serializable()
    zMultiplier!: number;

    private _system?: IParticleSystem;
    // private _worldRotation: Quaternion = new Quaternion();

    update(system: IParticleSystem) {
        this._system = system;
    }

    private _temp: Vector3 = new Vector3();

    apply(_index: number, _pos: Vec3, vel: Vec3, _dt: number, age: number, life: number) {
        if (!this.enabled) return;
        const t = age / life;

        const speed = this.speedModifier.evaluate(t) * this.speedModifierMultiplier;
        const x = this.x.evaluate(t);
        const y = this.y.evaluate(t);
        const z = this.z.evaluate(t);
        this._temp.set(-x, y, z);
        if (this._system) {
            if (this.space === ParticleSystemSimulationSpace.World) {
                this._temp.applyQuaternion(this._system.worldQuaternionInverted);
            }
            if (this._system.main.simulationSpace === ParticleSystemSimulationSpace.World) {
                this._temp.applyQuaternion(this._system.worldQuaternion);
            }
        }
        vel.x += this._temp.x;
        vel.y += this._temp.y;
        vel.z += this._temp.z;
        vel.x *= speed;
        vel.y *= speed;
        vel.z *= speed;
    }
}



enum ParticleSystemAnimationTimeMode {
    Lifetime,
    Speed,
    FPS,
}

enum ParticleSystemAnimationMode {
    Grid,
    Sprites,
}

enum ParticleSystemAnimationRowMode {
    Custom,
    Random,
    MeshIndex,
}

enum ParticleSystemAnimationType {
    WholeSheet,
    SingleRow,
}

export class TextureSheetAnimationModule {

    @serializable()
    animation!: ParticleSystemAnimationType;

    @serializable()
    enabled!: boolean;

    @serializable()
    cycleCount!: number;

    @serializable(MinMaxCurve)
    frameOverTime!: MinMaxCurve;
    @serializable()
    frameOverTimeMultiplier!: number;

    @serializable()
    numTilesX!: number;
    @serializable()
    numTilesY!: number;

    @serializable(MinMaxCurve)
    startFrame!: MinMaxCurve;
    @serializable()
    startFrameMultiplier!: number;

    @serializable()
    rowMode!: ParticleSystemAnimationRowMode;
    @serializable()
    rowIndex!: number;

    @serializable()
    spriteCount!: number;

    @serializable()
    timeMode!: ParticleSystemAnimationTimeMode;

    private sampleOnceAtStart(): boolean {
        if (this.timeMode === ParticleSystemAnimationTimeMode.Lifetime) {
            switch (this.frameOverTime.mode) {
                case ParticleSystemCurveMode.Constant:
                case ParticleSystemCurveMode.TwoConstants:
                    return true;
            }
        }
        return false;
    }

    getStartIndex(): number {
        if (this.sampleOnceAtStart()) {
            return this.frameOverTime.evaluate(Math.random())
        }
        return 0;
    }

    evaluate(t01: number): number | undefined {
        if (this.sampleOnceAtStart()) {
            return undefined;
        }
        return this.getIndex(t01);
    }

    private getIndex(t01: number): number {
        const tiles = this.numTilesX * this.numTilesY;
        // let pos = t01 * this.cycleCount;
        let index = this.frameOverTime.evaluate(t01 % 1);
        index *= this.frameOverTimeMultiplier;
        index *= tiles;
        index = index % tiles;
        index = Math.floor(index);
        // console.log(index);
        return index;
    }
}


export class RotationOverLifetimeModule {
    @serializable()
    enabled!: boolean;

    @serializable()
    separateAxes!: boolean;

    @serializable(MinMaxCurve)
    x!: MinMaxCurve;
    @serializable()
    xMultiplier!: number;
    @serializable(MinMaxCurve)
    y!: MinMaxCurve;
    @serializable()
    yMultiplier!: number;
    @serializable(MinMaxCurve)
    z!: MinMaxCurve;
    @serializable()
    zMultiplier!: number;

    evaluate(t01: number, t: number): number {
        if (!this.enabled) return 0;
        if (!this.separateAxes) {
            const rot = this.z.evaluate(t01, t) * -1;
            return rot;
        }
        return 0;
    }
}

export class RotationBySpeedModule {
    @serializable()
    enabled!: boolean;

    @serializable()
    range!: Vec2;

    @serializable()
    separateAxes!: boolean;

    @serializable(MinMaxCurve)
    x!: MinMaxCurve;
    @serializable()
    xMultiplier!: number;
    @serializable(MinMaxCurve)
    y!: MinMaxCurve;
    @serializable()
    yMultiplier!: number;
    @serializable(MinMaxCurve)
    z!: MinMaxCurve;
    @serializable()
    zMultiplier!: number;

    evaluate(_t01: number, speed: number): number {
        if (!this.enabled) return 0;
        if (!this.separateAxes) {
            const t = Mathf.lerp(this.range.x, this.range.y, speed);
            const rot = this.z.evaluate(t) * -1;
            return rot;
        }
        return 0;
    }
}


export class LimitVelocityOverLifetimeModule {
    @serializable()
    enabled!: boolean;

    @serializable()
    dampen!: number;

    @serializable(MinMaxCurve)
    drag!: MinMaxCurve;
    @serializable()
    dragMultiplier!: number;

    @serializable(MinMaxCurve)
    limit!: MinMaxCurve;
    @serializable()
    limitMultiplier!: number;

    @serializable()
    separateAxes!: boolean;

    @serializable(MinMaxCurve)
    limitX!: MinMaxCurve;
    @serializable()
    limitXMultiplier!: number;
    @serializable(MinMaxCurve)
    limitY!: MinMaxCurve;
    @serializable()
    limitYMultiplier!: number;
    @serializable(MinMaxCurve)
    limitZ!: MinMaxCurve;
    @serializable()
    limitZMultiplier!: number;

    @serializable()
    multiplyDragByParticleSize: boolean = false;
    @serializable()
    multiplyDragByParticleVelocity: boolean = false;

    @serializable()
    space!: ParticleSystemSimulationSpace;

    private _temp: Vector3 = new Vector3();
    private _temp2: Vector3 = new Vector3();

    apply(_position: Vec3, baseVelocity: Vector3, currentVelocity: Vector3, _size: number, t01: number, _dt: number, _scale: number) {
        if (!this.enabled) return;
        // if (this.separateAxes) {
        //     // const maxX = this.limitX.evaluate(t01) * this.limitXMultiplier;
        //     // const maxY = this.limitY.evaluate(t01) * this.limitYMultiplier;
        //     // const maxZ = this.limitZ.evaluate(t01) * this.limitZMultiplier;

        // }
        // else 
        {
            const max = this.limit.evaluate(t01) * this.limitMultiplier;
            const speed = baseVelocity.length();
            if (speed > max) {
                this._temp.copy(baseVelocity).normalize().multiplyScalar(max);
                let t = this.dampen * .5;
                // t *= scale;
                baseVelocity.x = Mathf.lerp(baseVelocity.x, this._temp.x, t);
                baseVelocity.y = Mathf.lerp(baseVelocity.y, this._temp.y, t);
                baseVelocity.z = Mathf.lerp(baseVelocity.z, this._temp.z, t);

                // this._temp2.set(0, 0, 0);
                currentVelocity.x = Mathf.lerp(currentVelocity.x, this._temp.x, t);
                currentVelocity.y = Mathf.lerp(currentVelocity.y, this._temp.y, t);
                currentVelocity.z = Mathf.lerp(currentVelocity.z, this._temp.z, t);
            }
            // vel.multiplyScalar(dragFactor);
        }
        // vel.x *= 0.3;
        // vel.y *= 0.3;
        // vel.z *= 0.3;
    }
}


export enum ParticleSystemInheritVelocityMode {
    Initial,
    Current,
}

export class InheritVelocityModule {

    @serializable()
    enabled!: boolean;

    @serializable(MinMaxCurve)
    curve!: MinMaxCurve;
    @serializable()
    curveMultiplier!: number;

    @serializable()
    mode!: ParticleSystemInheritVelocityMode;

    system!: IParticleSystem;
    private _lastWorldPosition!: Vector3;
    private _velocity: Vector3 = new Vector3();
    private _temp: Vector3 = new Vector3();

    update(_context: Context) {
        if (!this.enabled) return;
        if (this.system.worldspace === false) return;
        if (this._lastWorldPosition) {
            this._velocity.copy(this.system.worldPos).sub(this._lastWorldPosition).multiplyScalar(1 / this.system.deltaTime);
            this._lastWorldPosition.copy(this.system.worldPos);
        }
        else {
            this._velocity.set(0, 0, 0);
            this._lastWorldPosition = this.system.worldPos.clone();
        }
    }

    // TODO: make work for subsystems
    applyInitial(vel: Vector3) {
        if (!this.enabled) return;
        if (this.system.worldspace === false) return;
        if (this.mode === ParticleSystemInheritVelocityMode.Initial) {
            const factor = this.curve.evaluate(Math.random(), Math.random());
            this._temp.copy(this._velocity).multiplyScalar(factor);
            vel.add(this._temp);
        }
    }

    applyCurrent(vel: Vector3, t01: number, lerpFactor: number) {
        if (!this.enabled) return;
        if (this.system.worldspace === false) return;
        if (this.mode === ParticleSystemInheritVelocityMode.Current) {
            const factor = this.curve.evaluate(t01, lerpFactor);
            this._temp.copy(this._velocity).multiplyScalar(factor);
            vel.add(this._temp);
        }
    }
}


export class SizeBySpeedModule {
    @serializable()
    enabled!: boolean;

    @serializable(Vector2)
    range!: Vector2;
    @serializable()
    separateAxes!: boolean;

    @serializable(MinMaxCurve)
    size!: MinMaxCurve;
    @serializable()
    sizeMultiplier!: number;

    @serializable(MinMaxCurve)
    x!: MinMaxCurve;
    @serializable()
    xMultiplier!: number;
    @serializable(MinMaxCurve)
    y!: MinMaxCurve;
    @serializable()
    yMultiplier!: number;
    @serializable(MinMaxCurve)
    z!: MinMaxCurve;
    @serializable()
    zMultiplier!: number;

    evaluate(vel: Vector3, _t01: number, lerpFactor: number, size: number): number {

        const speed = vel.length();
        const x = Mathf.remap(speed, this.range.x, this.range.y, 0, 1);
        const factor = this.size.evaluate(x, lerpFactor);
        // return size;
        return size * factor;
    }
}

export class ColorBySpeedModule {
    @serializable()
    enabled!: boolean;
    @serializable(Vector2)
    range!: Vector2;
    @serializable(MinMaxGradient)
    color!: MinMaxGradient;

    evaluate(vel: Vector3, lerpFactor: number, color: Vector4) {
        const speed = vel.length();
        const x = Mathf.remap(speed, this.range.x, this.range.y, 0, 1);
        const res = this.color.evaluate(x, lerpFactor);
        color.x *= res.r;
        color.y *= res.g;
        color.z *= res.b;
        color.w *= res.alpha;
    }
}