import { Behavior, Particle, EmissionState, ParticleSystem, ParticleEmitter } from "three.quarks";
import { Vector3, Quaternion, Matrix4 } from "three";
import { IParticleSystem } from "./ParticleSystemModules";
import { CircularBuffer } from "../engine/engine_utils";
import { SubEmitterType } from "./ParticleSystem";

const VECTOR_ONE = new Vector3(1, 1, 1);
const VECTOR_Z = new Vector3(0, 0, 1);
const $emitterMatrix = Symbol("emitterMatrix");

export class ParticleSubEmitter implements Behavior {

    type = "NeedleParticleSubEmitter";

    emitterType?: SubEmitterType;
    emitterProbability?: number;

    //private matrix_ = new Matrix4();
    private q_ = new Quaternion();
    private v_ = new Vector3();
    private v2_ = new Vector3();


    private _emitterMatrix: Matrix4 = new Matrix4();
    private _circularBuffer: CircularBuffer<Matrix4>;

    constructor(
        private system: IParticleSystem,
        private particleSystem: ParticleSystem,
        private subSystem: IParticleSystem,
        public subParticleSystem?: ParticleSystem
    ) {
        if (this.subParticleSystem && this.subParticleSystem) {
            this.subParticleSystem.onlyUsedByOther = true;
        }
        const maxMatrices = 1000;
        this._circularBuffer = new CircularBuffer(() => new Matrix4(), maxMatrices)
    }

    clone(): Behavior {
        throw new Error("Method not implemented.");
    }

    initialize(particle: Particle): void {
        particle.emissionState = {
            burstIndex: 0,
            burstWaveIndex: 0,
            time: 0,
            waitEmiting: 0,
            // matrix: new Matrix4(),
        } as EmissionState;
        // particle[$emitterMatrix] = new Matrix4();
        this._emitterMatrix.copy(this.subSystem.matrixWorld).invert().premultiply(this.system.matrixWorld)

        if (this.emitterType === SubEmitterType.Birth) {
            this.run(particle);
        }
    }

    update(particle: Particle, _delta: number): void {
        this.run(particle);
    }

    frameUpdate(_delta: number): void {
    }

    toJSON(): any {
    }

    private run(particle: Particle) {
        if (this.subSystem.currentParticles >= this.subSystem.main.maxParticles)
            return;
        if (!this.subParticleSystem || !particle.emissionState)
            return;

        if(this.emitterProbability && Math.random() > this.emitterProbability)
            return;

        const delta = this.system.deltaTime;

        if (this.emitterType === SubEmitterType.Death) {
            const willDie = particle.age + delta * 1.2 >= particle.life;
            if (!willDie) return;
            // Just emit all for now, we should probably add a way to get the amount from the subsystem emission module
            const maxAmount = this.subSystem.main.maxParticles - this.subSystem.currentParticles;
            particle.emissionState.waitEmiting = maxAmount;
        }

        // TODO: figure out how to re-use matrices
        const m = new Matrix4();// this._circularBuffer.get();// new Matrix4();// particle[$emitterMatrix];

        m.set(
            1, 0, 0, particle.position.x,
            0, 1, 0, particle.position.y,
            0, 0, 1, particle.position.z,
            0, 0, 0, 1
        );

        if (!this.particleSystem.worldSpace) {
            m.multiplyMatrices(this._emitterMatrix, m)
        }

        this.subParticleSystem!.emit(delta, particle.emissionState!, m);
    }
}