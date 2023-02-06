import { Behaviour, GameObject } from "./Component";
import * as THREE from "three";
import { MainModule, EmissionModule, ShapeModule, ParticleSystemShapeType, MinMaxCurve, MinMaxGradient, ColorOverLifetimeModule, SizeOverLifetimeModule, NoiseModule, ParticleSystemSimulationSpace, ParticleBurst, IParticleSystem, ParticleSystemRenderMode, TrailModule, VelocityOverLifetimeModule, TextureSheetAnimationModule, RotationOverLifetimeModule, LimitVelocityOverLifetimeModule, RotationBySpeedModule, InheritVelocityModule, SizeBySpeedModule, ColorBySpeedModule } from "./ParticleSystemModules"
import { getParam } from "../engine/engine_utils";

// https://github.dev/creativelifeform/three-nebula
// import System, { Emitter, Position, Life, SpriteRenderer, Particle, Body, MeshRenderer, } from 'three-nebula';

import { serializable } from "../engine/engine_serialization";
import { RGBAColor } from "./js-extensions/RGBAColor";
import { AxesHelper, BufferGeometry, Color, Material, Matrix4, Mesh, MeshStandardMaterial, Object3D, OneMinusDstAlphaFactor, PlaneGeometry, Quaternion, Sprite, SpriteMaterial, Vector3, Vector4 } from "three";
import { getWorldPosition, getWorldQuaternion, getWorldScale } from "../engine/engine_three_utils";
import { assign } from "../engine/engine_serialization_core";
import { BatchedParticleRenderer, Behavior, BillBoardSettings, BurstParameters, ColorGenerator, ConstantColor, ConstantValue, EmissionState, EmitSubParticleSystem, EmitterShape, FunctionColorGenerator, FunctionJSON, FunctionValueGenerator, IntervalValue, MeshSettings, Particle, ParticleEmitter, ParticleSystem as _ParticleSystem, ParticleSystemParameters, PointEmitter, RecordState, RenderMode, RotationGenerator, SizeOverLife, TrailBatch, TrailParticle, TrailSettings, ValueGenerator } from "three.quarks";
import { createFlatTexture } from "../engine/engine_shaders";
import { Mathf } from "../engine/engine_math";
import { Context } from "../engine/engine_setup";
import { ParticleSubEmitter } from "./ParticleSystemSubEmitter";
import { NEEDLE_progressive } from "../engine/extensions/NEEDLE_progressive";

const debug = getParam("debugparticles");
const suppressProgressiveLoading = getParam("noprogressive");
const debugProgressiveLoading = getParam("debugprogressive");

export enum SubEmitterType {
    Birth = 0,
    Collision = 1,
    Death = 2,
    Trigger = 3,
    Manual = 4,
}

export class SubEmitterSystem {

    particleSystem?: ParticleSystem;

    emitProbability: number = 1;
    properties?: number;
    type?: SubEmitterType;

    _deserialize(context: Context) {
        const ps = this.particleSystem;
        if (ps && !(ps instanceof ParticleSystem) && typeof ps["guid"] === "string") {
            if (debug) console.log("DESERIALIZE SUBEMITTER", ps);
            this.particleSystem = undefined;
            this.particleSystem = GameObject.findByGuid(ps["guid"], context.scene) as ParticleSystem;
        }
    }
}

export class ParticleSystemRenderer extends Behaviour {

    @serializable()
    renderMode?: ParticleSystemRenderMode;

    @serializable(Material)
    particleMaterial?: SpriteMaterial;

    @serializable(Material)
    trailMaterial?: SpriteMaterial;

    // @serializable(Mesh)
    particleMesh?: Mesh | string;

    get transparent(): boolean {
        const res = this.particleMaterial?.transparent ?? false;
        // console.log(res, this.particleMaterial);
        return res;
    }

    getMaterial(trailEnabled: boolean = false) {
        const material = (trailEnabled === true && this.trailMaterial) ? this.trailMaterial : this.particleMaterial;
        
        // progressive load on start
        // TODO: figure out how to do this before particle system rendering so we only load textures for visible materials
        if (material && !suppressProgressiveLoading && material["_didRequestTextureLOD"] === undefined) {
            material["_didRequestTextureLOD"] = 0;
            if (debugProgressiveLoading) {
                console.log("Load material LOD", material.name);
            }
            NEEDLE_progressive.assignTextureLOD(this.context, this.sourceId, material);
        }

        return material;
    }

    getMesh(renderMode?: ParticleSystemRenderMode) {
        let geo: BufferGeometry | null = null;
        if (renderMode === ParticleSystemRenderMode.HorizontalBillboard) {
            geo = new THREE.BoxGeometry(1, 1, 0);
        }
        else if (renderMode === ParticleSystemRenderMode.VerticalBillboard) {
            geo = new THREE.BoxGeometry(1, 0, 1);
        }

        if (!geo) {
            if (this.particleMesh instanceof Mesh) {
                geo = this.particleMesh.geometry;
            }
            if (geo === null) {
                geo = new PlaneGeometry(1, 1);
                // Flip UVs horizontally
                const uv = geo.attributes.uv;
                for (let i = 0; i < uv.count; i++) {
                    uv.setX(i, 1 - uv.getX(i));
                }
            }
        }

        const res = new Mesh(geo, this.getMaterial());
        return res;
    }
}

class MinMaxCurveFunction implements FunctionValueGenerator {

    private _curve: MinMaxCurve;

    constructor(curve: MinMaxCurve) { this._curve = curve; }

    type: "function" = "function";

    genValue(t: number): number {
        return this._curve.evaluate(t, Math.random());
    }
    toJSON(): FunctionJSON {
        throw new Error("Method not implemented.");
    }
    clone(): FunctionValueGenerator {
        throw new Error("Method not implemented.");
    }
}

class MinMaxGradientFunction implements FunctionColorGenerator {

    private _curve: MinMaxGradient;

    constructor(curve: MinMaxGradient) { this._curve = curve; }

    type: "function" = "function";

    genColor(color: THREE.Vector4, t: number): THREE.Vector4 {
        const col = this._curve.evaluate(t, Math.random());
        // TODO: incoming color should probably be blended?
        color.set(col.r, col.g, col.b, col.alpha);
        return color;
    }
    toJSON(): FunctionJSON {
        throw new Error("Method not implemented.");
    }
    clone(): FunctionColorGenerator {
        throw new Error("Method not implemented.");
    }

}

abstract class BaseValueGenerator implements ValueGenerator {

    type: "value" = "value";
    toJSON(): FunctionJSON {
        throw new Error("Method not implemented.");
    }
    clone(): ValueGenerator {
        throw new Error("Method not implemented.");
    }

    abstract genValue(): number;

    readonly system: ParticleSystem;

    constructor(system: ParticleSystem) {
        this.system = system;
    }
}

class TextureSheetStartFrameGenerator extends BaseValueGenerator {
    genValue(): number {
        return this.system.textureSheetAnimation.getStartIndex();
    }

}

class ParticleSystemEmissionOverTime extends BaseValueGenerator {

    private _lastPosition: Vector3 = new Vector3();
    private _lastDistance: number = 0;

    update() {
        const currentPosition = getWorldPosition(this.system.gameObject);
        this._lastDistance = this._lastPosition.distanceTo(currentPosition)
        this._lastPosition.copy(currentPosition);
    }

    genValue(): number {
        if (!this.system.emission.enabled) return 0;
        if (this.system.currentParticles >= this.system.maxParticles) return 0;
        // emission over time
        let emission = this.system.emission.rateOverTime.evaluate(this.system.time / this.system.duration, Math.random());
        // if(this.system.currentParticles + emission > this.system.maxParticles) 
        //     emission = (this.system.maxParticles - this.system.currentParticles);
        // const res = Mathf.clamp(emission, 0, this.system.maxParticles - this.system.currentParticles);

        if (this.system.deltaTime > 0) {
            const distanceEmission = this.system.emission.rateOverDistance.evaluate(this.system.time / this.system.duration, Math.random());
            const meterPerSecond = this._lastDistance / this.system.deltaTime;
            let distanceEmissionValue = meterPerSecond * distanceEmission;
            if (!Number.isFinite(distanceEmissionValue)) distanceEmissionValue = 0;
            emission += distanceEmissionValue;
        }
        const burst = this.system.emission.getBurst();
        if (burst > 0)
            emission += burst / this.system.deltaTime;

        const maxEmission = (this.system.maxParticles - this.system.currentParticles);
        return Mathf.clamp(emission, 0, maxEmission / this.system.deltaTime);
    }
}

class ParticleSystemEmissionOverDistance extends BaseValueGenerator {

    genValue(): number {
        // this seems not be called yet
        return 0;
        // if (this.system.currentParticles >= this.system.maxParticles) return 0;
        // const emission = this.system.emission.rateOverDistance.evaluate(this.system.time / this.system.duration, Math.random());
        // return emission;
    }
}

abstract class ParticleSystemBaseBehaviour implements Behavior {
    readonly system: ParticleSystem;

    get scaleFactorDiff(): number {
        return this.system.worldScale.x - this.system.scale;
    }

    constructor(ps: ParticleSystem) {
        this.system = ps;
    }

    abstract type: string;

    initialize(_particle: Particle): void {
    }
    update(_particle: Particle, _delta: number): void {
    }
    frameUpdate(_delta: number): void {
    }
    toJSON() { throw new Error("Method not implemented."); }
    clone(): Behavior { throw new Error("Method not implemented."); }
}

class TextureSheetAnimationBehaviour extends ParticleSystemBaseBehaviour {
    type: string = "NeedleTextureSheet"

    update(particle: Particle, _delta: number) {
        const sheet = this.system.textureSheetAnimation;
        if (sheet.enabled) {
            const t01 = particle.age / particle.life;
            const index = sheet.evaluate(t01);;
            if (index !== undefined)
                particle.uvTile = index;
        }
    }

}

const $particleRotation = Symbol("particleRotation")

class RotationBehaviour extends ParticleSystemBaseBehaviour {
    type: string = "NeedleRotation"

    initialize(particle: Particle) {
        particle[$particleRotation] = Math.random();
    }

    update(particle: Particle, delta: number) {
        if (particle.rotation === undefined) return;

        const t = particle.age / particle.life;

        if (typeof particle.rotation === "number") {
            if (this.system.rotationOverLifetime.enabled) {
                particle.rotation += this.system.rotationOverLifetime.evaluate(t, particle[$particleRotation]) * delta;
            }
            else {
                if (this.system.renderer.renderMode === ParticleSystemRenderMode.Billboard)
                    particle.rotation = Math.PI;
            }

            if (this.system.rotationBySpeed.enabled) {
                const speed = particle.velocity.length();
                particle.rotation += this.system.rotationBySpeed.evaluate(t, speed) * delta;
            }
        }
        else {
            // const quat = particle.rotation as Quaternion;
            // TODO: implement rotation by speed for quaternions
        }
    }
}

const $sizeLerpFactor = Symbol("sizeLerpFactor");
class SizeBehaviour extends ParticleSystemBaseBehaviour {

    type: string = "NeedleSize";

    initialize(particle: Particle) {
        particle[$sizeLerpFactor] = Math.random();
    }

    update(particle: Particle, _delta: number): void {
        if (this.system.renderer.renderMode === ParticleSystemRenderMode.Mesh) {

        }
        else {
            const age01 = particle.age / particle.life;
            let size = 1;
            if (this.system.sizeOverLifetime.enabled)
                size *= this.system.sizeOverLifetime.evaluate(age01, undefined, particle[$sizeLerpFactor]).x;
            const scaleFactor = this.system.worldScale.x / this.system.cameraScale;
            particle.size = particle.startSize * size * scaleFactor;

        }
    }
}

const $particleLife = Symbol("particleLife");
const $trailLifetime = Symbol("trailLifetime");
const $trailStartLength = Symbol("trailStartLength");

class TrailBehaviour extends ParticleSystemBaseBehaviour {
    type: string = "NeedleTrail";

    initialize(particle: Particle) {
        if (particle instanceof TrailParticle) {
            particle[$particleLife] = particle.life;
            particle[$trailLifetime] = particle.life;
            if (this.system.trails.enabled && this.system.trails.dieWithParticles === false) {
                particle[$trailLifetime] = this.system.trails.lifetime.evaluate(Math.random(), Math.random());
                particle.life += particle[$trailLifetime];
            }
            particle[$trailStartLength] = particle.length;
        }

    }

    update(particle: Particle) {
        if (this.system.trails?.enabled && particle instanceof TrailParticle) {
            const trailParticle = particle as TrailParticle;
            const age01 = particle.age / particle[$particleLife];
            const iter = particle.previous.values();
            const length = particle.previous.length;
            // const maxAge = this.system.trails.lifetime.
            for (let i = 0; i < length; i++) {
                const cur = iter.next();
                const state = cur.value as RecordState;
                const pos01 = 1 - (i / (length - 1));
                state.size = this.system.trails.getWidth(particle.size, age01, pos01);
                state.color.copy(particle.color);
                this.system.trails.getColor(state.color, age01, pos01);
            }

            // particle.life = particle.age + .1;
            if (particle.age > particle[$particleLife]) {
                particle.velocity.set(0, 0, 0);
                const t = (particle.age - particle[$particleLife]) / particle[$trailLifetime];
                trailParticle.length = Mathf.lerp(particle[$trailStartLength], 0, t);
            }
        }
    }
}

const $startVelocity = Symbol("startVelocity");
const $gravityFactor = Symbol("gravityModifier");
const $velocityLerpFactor = Symbol("velocity lerp factor");
const temp3 = new Vector3();
const temp4 = new Quaternion();

class VelocityBehaviour extends ParticleSystemBaseBehaviour {
    type: string = "NeedleVelocity";

    private _gravityDirection = new Vector3();

    initialize(particle: Particle): void {
        const factor = 1 + this.scaleFactorDiff;
        particle.startSpeed = this.system.main.startSpeed.evaluate(Math.random(), Math.random()) * factor;
        particle.velocity.copy(this.system.shape.getDirection(particle.position)).multiplyScalar(particle.startSpeed);
        if (this.system.inheritVelocity?.enabled) {
            this.system.inheritVelocity.applyInitial(particle.velocity);
        }
        if (!particle[$startVelocity]) particle[$startVelocity] = particle.velocity.clone();
        else particle[$startVelocity].copy(particle.velocity);

        const gravityFactor = this.system.main.gravityModifier.evaluate(Math.random(), Math.random()) / (9.81 * 2);
        particle[$gravityFactor] = gravityFactor;

        particle[$velocityLerpFactor] = Math.random();

        this._gravityDirection.set(0, -1, 0);
        if (this.system.main.simulationSpace === ParticleSystemSimulationSpace.Local)
            this._gravityDirection.applyQuaternion(this.system.worldQuaternionInverted);
    }

    update(particle: Particle, delta: number): void {

        //////////////////////
        // calculate speed
        const baseVelocity = particle[$startVelocity];
        let gravityFactor = particle[$gravityFactor];
        if (gravityFactor !== 0) {
            // gravityFactor *= -1;
            temp3.copy(this._gravityDirection).multiplyScalar(gravityFactor);
            // Gizmos.DrawDirection(particle.position, temp3, 0xff0000, 0, false, 10);
            baseVelocity.add(temp3);
        }
        particle.velocity.copy(baseVelocity);

        const t01 = particle.age / particle.life;

        if (this.system.inheritVelocity?.enabled) {
            this.system.inheritVelocity.applyCurrent(particle.velocity, t01, particle[$velocityLerpFactor]);
        }


        const noise = this.system.noise;
        if (noise.enabled) {
            noise.apply(0, particle.position, particle.velocity, delta, particle.age, particle.life);
        }

        //////////////////////
        // evaluate by speed modules
        const sizeBySpeed = this.system.sizeBySpeed;
        if (sizeBySpeed?.enabled) {
            particle.size = sizeBySpeed.evaluate(particle.velocity, t01, particle[$velocityLerpFactor], particle.size);
        }

        const colorBySpeed = this.system.colorBySpeed;
        if (colorBySpeed?.enabled) {
            colorBySpeed.evaluate(particle.velocity, particle[$velocityLerpFactor], particle.color);
        }

        //////////////////////
        // limit or modify speed
        const velocity = this.system.velocityOverLifetime;
        if (velocity.enabled) {
            velocity.apply(0, particle.position, particle.velocity, delta, particle.age, particle.life);
        }

        const limitVelocityOverLifetime = this.system.limitVelocityOverLifetime;
        if (limitVelocityOverLifetime.enabled) {
            // const factor = this.system.worldScale.x;
            limitVelocityOverLifetime.apply(particle.position, baseVelocity, particle.velocity, particle.size, t01, delta, 1);
        }

        if (this.system.worldspace) {
            particle.velocity.multiply(this.system.worldScale);
        }
    }
}

const $colorLerpFactor = Symbol("colorLerpFactor");
class ColorBehaviour extends ParticleSystemBaseBehaviour {
    type: string = "NeedleColor";

    initialize(_particle: Particle): void {
    }

    private _init(particle: Particle) {
        const col = this.system.main.startColor.evaluate(Math.random());
        particle.startColor.set(col.r, col.g, col.b, col.alpha);
        particle.color.copy(particle.startColor);
        particle[$colorLerpFactor] = Math.random();
    }

    update(particle: Particle, _delta: number): void {
        if (particle.age === 0)
            this._init(particle);
        if (this.system.colorOverLifetime.enabled) {
            const t = particle.age / particle.life;
            const col = this.system.colorOverLifetime.color.evaluate(t, particle[$colorLerpFactor]);
            particle.color.set(col.r, col.g, col.b, col.alpha).multiply(particle.startColor);
        }
        else {
            particle.color.copy(particle.startColor);
        }
    }
}

class ParticleSystemInterface implements ParticleSystemParameters {

    private readonly system: ParticleSystem;
    private readonly emission: ParticleSystemEmissionOverTime;
    private get anim(): TextureSheetAnimationModule {
        return this.system.textureSheetAnimation;
    }

    constructor(system: ParticleSystem) {
        this.system = system;
        this.emission = new ParticleSystemEmissionOverTime(this.system);
    }

    update() {
        this.emission.update();
    }

    autoDestroy?: boolean | undefined;
    get looping() { return this.system.main.loop; }
    get duration() { return this.system.duration; }
    get shape(): EmitterShape { return this.system.shape; }
    get startLife() { return new MinMaxCurveFunction(this.system.main.startLifetime); }
    get startSpeed() { return new MinMaxCurveFunction(this.system.main.startSpeed); }
    get startRotation() { return new MinMaxCurveFunction(this.system.main.startRotation); }
    get startSize() { return new MinMaxCurveFunction(this.system.main.startSize); }
    startLength?: ValueGenerator | FunctionValueGenerator | undefined; /** start length is for trails */
    get startColor() { return new ConstantColor(new Vector4(1, 1, 1, 1)); }
    get emissionOverTime() { return this.emission; }
    /** this is not supported yet */
    get emissionOverDistance() { return new ParticleSystemEmissionOverDistance(this.system); }
    /** not used - burst is controled via emissionOverTime */
    emissionBursts?: BurstParameters[] | undefined;
    onlyUsedByOther?: boolean | undefined;
    readonly behaviors: Behavior[] = [];
    get instancingGeometry() {
        return this.system.renderer.getMesh(this.system.renderer.renderMode).geometry;
    }
    get renderMode() {
        if (this.system.trails["enabled"] === true) {
            return RenderMode.Trail;
        }
        switch (this.system.renderer.renderMode) {
            case ParticleSystemRenderMode.Billboard: return RenderMode.BillBoard;
            // case ParticleSystemRenderMode.Stretch: return RenderMode.Stretch;
            case ParticleSystemRenderMode.HorizontalBillboard: return RenderMode.LocalSpace;
            case ParticleSystemRenderMode.VerticalBillboard: return RenderMode.LocalSpace;
            case ParticleSystemRenderMode.Mesh: return RenderMode.LocalSpace;
        }
        return RenderMode.BillBoard;
    }
    rendererEmitterSettings: TrailSettings = {
        startLength: new ConstantValue(220),
        followLocalOrigin: false,
    };
    get speedFactor() { return this.system.main.simulationSpeed; }
    get texture(): THREE.Texture {
        const mat = this.system.renderer.getMaterial(this.system.trails.enabled);
        if (mat && mat["map"]) {
            const tex = mat["map"]!;
            tex.premultiplyAlpha = false;
            tex.encoding = THREE.LinearEncoding;
            return tex;
        }
        return createFlatTexture(new RGBAColor(1, 1, 1, 1), 1)
    }
    get startTileIndex() { return new TextureSheetStartFrameGenerator(this.system); }
    get uTileCount() { return this.anim.enabled ? this.anim?.numTilesX : undefined }
    get vTileCount() { return this.anim.enabled ? this.anim?.numTilesY : undefined }
    get renderOrder() { return 1; }
    get blending(): THREE.Blending { return this.system.renderer.particleMaterial?.blending ?? THREE.NormalBlending; }
    get transparent() { return this.system.renderer.transparent; }
    get worldSpace() { return this.system.main.simulationSpace === ParticleSystemSimulationSpace.World; }

}

class ParticlesEmissionState implements EmissionState {

    burstIndex: number = 0;
    burstWaveIndex: number = 0;
    time: number = 0;
    waitEmiting: number = 0;
}

export class ParticleSystem extends Behaviour implements IParticleSystem {

    play(includeChildren: boolean = false) {
        if (includeChildren) {
            GameObject.foreachComponent(this.gameObject, comp => {
                if (comp instanceof ParticleSystem && comp !== this) {
                    comp.play(false);
                }
            }, true)
        }
        this._isPlaying = true;
        this._time = 0;

        // https://github.com/Alchemist0823/three.quarks/pull/35
        if (this._particleSystem) {
            this._particleSystem["emissionState"].time = 0;
            this._particleSystem["emitEnded"] = false;
        }
        this.emission?.reset();
    }

    pause() {
        this._isPlaying = false;
    }
    stop() {
        this._isPlaying = false;
        this._time = 0;
    }

    private _state?: ParticlesEmissionState;
    emit(count: number) {
        if (this._particleSystem) {
            // we need to call update the matrices etc e.g. if we call emit from a physics callback
            this.onUpdate();
            count = Math.min(count, this.maxParticles - this.currentParticles);
            if (!this._state) this._state = new ParticlesEmissionState();
            this._state.waitEmiting = count;
            this._state.time = 0;
            const emitEndedState = this._particleSystem["emitEnded"];
            this._particleSystem["emitEnded"] = false;
            this._particleSystem.emit(this.deltaTime, this._state, this._particleSystem.emitter.matrixWorld);
            this._particleSystem["emitEnded"] = emitEndedState;
        }
    }

    @serializable(ColorOverLifetimeModule)
    readonly colorOverLifetime!: ColorOverLifetimeModule;

    @serializable(MainModule)
    readonly main!: MainModule;

    @serializable(EmissionModule)
    readonly emission!: EmissionModule;

    @serializable(SizeOverLifetimeModule)
    readonly sizeOverLifetime!: SizeOverLifetimeModule;

    @serializable(ShapeModule)
    readonly shape!: ShapeModule;

    @serializable(NoiseModule)
    readonly noise!: NoiseModule;

    @serializable(TrailModule)
    readonly trails!: TrailModule;

    @serializable(VelocityOverLifetimeModule)
    readonly velocityOverLifetime!: VelocityOverLifetimeModule;

    @serializable(LimitVelocityOverLifetimeModule)
    readonly limitVelocityOverLifetime!: LimitVelocityOverLifetimeModule;

    @serializable(InheritVelocityModule)
    readonly inheritVelocity!: InheritVelocityModule;

    @serializable(ColorBySpeedModule)
    readonly colorBySpeed!: ColorBySpeedModule;

    @serializable(TextureSheetAnimationModule)
    readonly textureSheetAnimation!: TextureSheetAnimationModule;

    @serializable(RotationOverLifetimeModule)
    readonly rotationOverLifetime!: RotationOverLifetimeModule;

    @serializable(RotationBySpeedModule)
    readonly rotationBySpeed!: RotationBySpeedModule;

    @serializable(SizeBySpeedModule)
    readonly sizeBySpeed!: SizeBySpeedModule;

    get renderer(): ParticleSystemRenderer {
        return this._renderer;
    }

    get isPlaying() { return this._isPlaying; }

    get currentParticles() {
        return this._particleSystem?.particleNum ?? 0;
    }
    get maxParticles() {
        return this.main.maxParticles;
    }
    get time() {
        return this._time;
    }
    get duration() {
        return this.main.duration;
    }
    get deltaTime() {
        return this.context.time.deltaTime * this.main.simulationSpeed;
    }
    get scale() {
        return this.gameObject.scale.x;
    }
    get cameraScale(): number {
        return this._cameraScale;
    }
    private _cameraScale: number = 1;

    get container(): Object3D {
        return this._container!;
    }

    get worldspace() {
        return this.main.simulationSpace === ParticleSystemSimulationSpace.World;
    }

    private __worldQuaternion = new Quaternion();
    get worldQuaternion(): Quaternion {
        return this.__worldQuaternion;
    }
    private _worldQuaternionInverted = new Quaternion();
    get worldQuaternionInverted(): Quaternion {
        return this._worldQuaternionInverted;
    }
    private _worldScale = new Vector3();
    get worldScale(): Vector3 {
        return this._worldScale;
    }

    private _worldPositionFrame: number = -1;
    private _worldPos: Vector3 = new Vector3();
    get worldPos(): Vector3 {
        if (this._worldPositionFrame !== this.context.time.frame) {
            this._worldPositionFrame = this.context.time.frame;
            getWorldPosition(this.gameObject, this._worldPos);
        }
        return this._worldPos;
    }

    get matrixWorld(): Matrix4 {
        return this._container.matrixWorld;
    }

    get isSubsystem() {
        return this._isUsedAsSubsystem;
    }

    private _renderer!: ParticleSystemRenderer;
    private _batchSystem?: BatchedParticleRenderer;
    private _particleSystem?: _ParticleSystem;
    private _interface!: ParticleSystemInterface;

    // private _system!: System;
    // private _emitter: Emitter;
    // private _size!: SizeBehaviour;
    private _container!: Object3D;
    private _time: number = 0;
    private _isPlaying: boolean = true;
    private _isUsedAsSubsystem: boolean = false;

    /** called from deserialization */
    private set bursts(arr: ParticleBurst[]) {
        for (let i = 0; i < arr.length; i++) {
            const burst = arr[i];
            if ((burst instanceof ParticleBurst) === false) {
                const instance = new ParticleBurst();
                assign(instance, burst);
                arr[i] = instance;
            }
        }
        this._bursts = arr;
    }
    private _bursts?: ParticleBurst[];

    /** called from deserialization */
    private set subEmitterSystems(arr: SubEmitterSystem[]) {
        for (let i = 0; i < arr.length; i++) {
            const sub = arr[i];
            if ((sub instanceof SubEmitterSystem) === false) {
                const instance = new SubEmitterSystem();
                assign(instance, sub);
                arr[i] = instance;
            }
        }
        if (debug && arr.length > 0) {
            console.log("SubEmitters: ", arr, this)
        }
        this._subEmitterSystems = arr;
    }
    private _subEmitterSystems?: SubEmitterSystem[];

    awake(): void {

        if (this._subEmitterSystems && Array.isArray(this._subEmitterSystems)) {
            for (const sub of this._subEmitterSystems) {
                sub._deserialize(this.context);
            }
        }

        this._renderer = this.gameObject.getComponent(ParticleSystemRenderer) as ParticleSystemRenderer;

        this._container = new Object3D();
        this._container.matrixAutoUpdate = false;
        if (this.main.simulationSpace == ParticleSystemSimulationSpace.Local) {
            this.gameObject.add(this._container);
        }
        else {
            this.context.scene.add(this._container);
        }
        // else this._container = this.context.scene;

        this._batchSystem = new BatchedParticleRenderer();
        this._batchSystem.name = this.gameObject.name;
        this._container.add(this._batchSystem);
        this._interface = new ParticleSystemInterface(this);
        this._particleSystem = new _ParticleSystem(this._batchSystem, this._interface);
        this._particleSystem.addBehavior(new SizeBehaviour(this));
        this._particleSystem.addBehavior(new ColorBehaviour(this));
        this._particleSystem.addBehavior(new TextureSheetAnimationBehaviour(this));
        this._particleSystem.addBehavior(new RotationBehaviour(this));
        this._particleSystem.addBehavior(new VelocityBehaviour(this));
        this._particleSystem.addBehavior(new TrailBehaviour(this));

        const emitter = this._particleSystem.emitter;
        this.context.scene.add(emitter);

        if (debug) {
            console.log(this);
            this.gameObject.add(new AxesHelper(1))
        }
    }

    start() {
        this.addSubParticleSystems();
    }

    onDestroy(): void {
        this._container?.removeFromParent();
        this._batchSystem?.removeFromParent();
        this._particleSystem?.emitter.removeFromParent();
        this._particleSystem?.dispose();
    }

    onEnable() {
        if (this.inheritVelocity)
            this.inheritVelocity.system = this;
        this.play();
    }

    onDisable() {
    }

    onBeforeRender() {
        this.onUpdate();
        const dt = this.deltaTime;
        this._batchSystem?.update(dt);
        this._time += dt;
        if (this._time > this.duration) this._time = 0;
    }

    private lastMaterialVersion: number = -1;
    private onUpdate() {
        const mat = this.renderer.getMaterial(this.trails.enabled);
        if (mat && mat.version != this.lastMaterialVersion && this._particleSystem) {
            this.lastMaterialVersion = mat.version;
            this._particleSystem.texture = this._interface.texture;
        }

        if (this._bursts) {
            this.emission.bursts = this._bursts;
            delete this._bursts;
        }
        if (!this._isPlaying) return;

        // sprite materials must be scaled in AR
        const cam = this.context.mainCamera;
        if (cam) {
            const scale = getWorldScale(cam);
            this._cameraScale = scale.x;
        }

        let source = this._container;
        if (this.worldspace)
            source = this.gameObject;
        getWorldQuaternion(source, this.__worldQuaternion)
        this._worldQuaternionInverted.copy(this.__worldQuaternion).invert();
        getWorldScale(this.gameObject, this._worldScale);

        if (!this.worldspace && this._container && this.gameObject?.parent) {
            const scale = getWorldScale(this.gameObject.parent);
            scale.x = 1 / scale.x;
            scale.y = 1 / scale.y;
            scale.z = 1 / scale.z;
            this._container.matrix.identity();
            this._container.matrix.scale(scale);
        }
        this.emission.system = this;
        this._interface.update();
        this.shape.update(this, this.context, this.main.simulationSpace, this.gameObject);
        this.noise.update(this.context);
        this.inheritVelocity?.update(this.context);
        this.velocityOverLifetime.update(this);
    }

    private addSubParticleSystems() {
        if (this._subEmitterSystems && this._particleSystem) {
            for (const sys of this._subEmitterSystems) {
                // Make sure the particle system is created
                if (sys.particleSystem) sys.particleSystem.__internalAwake();
                const system = sys.particleSystem?._particleSystem;
                if (system) {
                    sys.particleSystem!._isUsedAsSubsystem = true;
                    // sys.particleSystem!.main.simulationSpace = ParticleSystemSimulationSpace.World;
                    const sub = new ParticleSubEmitter(this, this._particleSystem, sys.particleSystem!, system);
                    sub.emitterType = sys.type;
                    sub.emitterProbability = sys.emitProbability;
                    this._particleSystem.addBehavior(sub);
                }
            }
        }
    }
}


