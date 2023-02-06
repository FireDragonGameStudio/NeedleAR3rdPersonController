import { Behaviour } from "./Component";
import * as THREE from 'three'
import { getWorldPosition } from "../engine/engine_three_utils";
import { serializable } from "../engine/engine_serialization_decorator";
import { Watch } from "../engine/engine_utils";
import { Matrix4, Object3D, Vector3 } from "three";
import { IRigidbody } from "../engine/engine_types";
import { CollisionDetectionMode, RigidbodyConstraints } from "../engine/engine_physics.types";
import { validate } from "../engine/engine_util_decorator";
import { Context, FrameEvent } from "../engine/engine_setup";

class TransformWatch {

    get isDirty(): boolean {
        return this.positionChanged || this.rotationChanged;
    }
    positionChanged: boolean = false;
    rotationChanged: boolean = false;

    position?: { x?: number, y?: number, z?: number };
    quaternion?: { _x?: number, _y?: number, _z?: number, _w?: number };

    private _positionKeys: string[] = ["x", "y", "z"];
    private _quaternionKeys: string[] = ["_x", "_y", "_z", "_w"];

    reset(clearPreviousValues: boolean = false) {
        this.positionChanged = false;
        this.rotationChanged = false;
        this.mute = false;

        if (clearPreviousValues) {
            if (this.position)
                for (const key of this._positionKeys)
                    delete this.position[key];
            if (this.quaternion)
                for (const key of this._quaternionKeys)
                    delete this.quaternion[key];
        }
    }

    syncValues() {
        for (const key of this._positionKeys) {
            this.position![key] = this.obj.position[key];
        }
        for (const key of this._quaternionKeys) {
            this.quaternion![key] = this.obj.quaternion[key];
        }
    }

    mute: boolean = false;

    applyValues() {
        // only apply the values that actually changed
        // since we want to still control all the other values via physics 
        if (this.positionChanged && this.position) {
            for (const key of this._positionKeys) {
                const val = this.position[key];
                if (val !== undefined)
                    this.obj.position[key] = val;
            }
        }
        if (this.rotationChanged) {
            if (this.quaternion) {
                for (const key of this._quaternionKeys) {
                    const val = this.quaternion[key];
                    if (val !== undefined)
                        this.obj.quaternion[key] = val;
                }
            }
        }
    }

    readonly context: Context;
    readonly obj: Object3D;
    private _positionWatch?: Watch;
    private _rotationWatch?: Watch;

    constructor(obj: Object3D, context: Context) {
        this.context = context;
        this.obj = obj;
    }

    start(position: boolean, rotation: boolean) {
        this.reset();
        if (position) {
            if (!this._positionWatch)
                this._positionWatch = new Watch(this.obj.position, ["x", "y", "z"]);
            this._positionWatch.apply();
            this.position = {};
            // this.position = this.obj.position.clone();
            this._positionWatch.subscribeWrite((val, prop) => {
                if (this.context.physics.isUpdating || this.mute) return;
                const prev = this.position![prop];
                if (Math.abs(prev - val) < .00001) return;
                this.position![prop] = val;
                this.positionChanged = true;
            })
        }
        if (rotation) {
            if (!this._rotationWatch)
                this._rotationWatch = new Watch(this.obj.quaternion, ["_x", "_y", "_z", "_w"]);
            this._rotationWatch.apply();
            this.quaternion = {};
            // this.quaternion = this.obj.quaternion.clone();
            this._rotationWatch.subscribeWrite((val, prop) => {
                if (this.context.physics.isUpdating || this.mute) return;
                const prev = this.quaternion![prop];
                if (Math.abs(prev - val) < .00001) return;
                this.quaternion![prop] = val;
                this.rotationChanged = true;
            })
        }

        // detect changes in the parent matrix
        const original = this.obj.matrixWorld.multiplyMatrices.bind(this.obj.matrixWorld);
        const lastParentMatrix = new Matrix4();
        this.obj.matrixWorld["multiplyMatrices"] = (parent: Matrix4, matrix: Matrix4) => {
            if (!lastParentMatrix.equals(parent)) {
                this.positionChanged = true;
                this.rotationChanged = true;
                lastParentMatrix.copy(parent);
            }
            return original(parent, matrix);;
        }
    }

    stop() {
        this._positionWatch?.revoke();
        this._rotationWatch?.revoke();
    }
}


export class Rigidbody extends Behaviour implements IRigidbody {

    @validate()
    @serializable()
    mass: number = 1;

    @validate()
    @serializable()
    useGravity: boolean = true;

    @validate()
    @serializable()
    constraints: RigidbodyConstraints = RigidbodyConstraints.None;

    @validate()
    @serializable()
    isKinematic: boolean = false;

    @validate()
    @serializable()
    drag: number = 0;

    @validate()
    @serializable()
    angularDrag: number = 1;

    @validate()
    @serializable()
    detectCollisions: boolean = true;

    @validate()
    @serializable()
    sleepThreshold: number = 0.01;

    @validate()
    @serializable()
    collisionDetectionMode: CollisionDetectionMode = CollisionDetectionMode.Discrete;

    get lockPositionX() {
        return (this.constraints & RigidbodyConstraints.FreezePositionX) !== 0;
    }
    get lockPositionY() {
        return (this.constraints & RigidbodyConstraints.FreezePositionY) !== 0;
    }
    get lockPositionZ() {
        return (this.constraints & RigidbodyConstraints.FreezePositionZ) !== 0;
    }
    get lockRotationX() {
        return (this.constraints & RigidbodyConstraints.FreezeRotationX) !== 0;
    }
    get lockRotationY() {
        return (this.constraints & RigidbodyConstraints.FreezeRotationY) !== 0;
    }
    get lockRotationZ() {
        return (this.constraints & RigidbodyConstraints.FreezeRotationZ) !== 0;
    }

    set lockPositionX(v: boolean) {
        if (v) this.constraints |= RigidbodyConstraints.FreezePositionX;
        else this.constraints &= ~RigidbodyConstraints.FreezePositionX;
    }
    set lockPositionY(v: boolean) {
        if (v) this.constraints |= RigidbodyConstraints.FreezePositionY;
        else this.constraints &= ~RigidbodyConstraints.FreezePositionY;
    }
    set lockPositionZ(v: boolean) {
        if (v) this.constraints |= RigidbodyConstraints.FreezePositionZ;
        else this.constraints &= ~RigidbodyConstraints.FreezePositionZ;
    }
    set lockRotationX(v: boolean) {
        if (v) this.constraints |= RigidbodyConstraints.FreezeRotationX;
        else this.constraints &= ~RigidbodyConstraints.FreezeRotationX;
    }
    set lockRotationY(v: boolean) {
        if (v) this.constraints |= RigidbodyConstraints.FreezeRotationY;
        else this.constraints &= ~RigidbodyConstraints.FreezeRotationY;
    }
    set lockRotationZ(v: boolean) {
        if (v) this.constraints |= RigidbodyConstraints.FreezeRotationZ;
        else this.constraints &= ~RigidbodyConstraints.FreezeRotationZ;
    }

    set gravityScale(val: number) {
        this._gravityScale = val;
    }
    get gravityScale() {
        return this._gravityScale;
    }
    private _gravityScale: number = 1;

    private static tempPosition: THREE.Vector3 = new THREE.Vector3();
    private _propertiesChanged: boolean = false;
    private _currentVelocity: THREE.Vector3 = new THREE.Vector3();
    private _smoothedVelocity: THREE.Vector3 = new THREE.Vector3();
    private _smoothedVelocityGetter: THREE.Vector3 = new THREE.Vector3();
    private _lastPosition: THREE.Vector3 = new THREE.Vector3();

    private _watch?: TransformWatch;

    awake() {
        this._watch = undefined;
        this._propertiesChanged = false;
    }

    onEnable() {
        if (!this._watch) {
            this._watch = new TransformWatch(this.gameObject, this.context);
        }
        this._watch.start(true, true);
        this.startCoroutine(this.beforePhysics(), FrameEvent.LateUpdate);
    }

    onDisable() {
        this._watch?.stop();
        this.context.physics.removeBody(this);
    }

    onDestroy(): void {
        this.context.physics.removeBody(this);
    }

    onValidate() {
        this._propertiesChanged = true;
    }

    // need to do this right before updating physics to prevent rendered object glitching through physical bodies
    *beforePhysics() {
        while (true) {
            if (this._propertiesChanged) {
                this._propertiesChanged = false;
                this.context.physics.updateProperties(this);
            }
            if (this._watch?.isDirty) {
                this._watch.mute = true;
                this._watch.applyValues();
                this.context.physics.updateBody(this, this._watch.positionChanged, this._watch.rotationChanged);
                this._watch.reset();
            }
            else this._watch?.syncValues();
            this.captureVelocity();
            yield;
        }
    }

    private get body() {
        return this.context.physics.internal_getRigidbody(this);
    }

    public teleport(pt: { x: number, y: number, z: number }, localspace: boolean = true) {
        this._watch?.reset(true);
        if (localspace) this.gameObject.position.set(pt.x, pt.y, pt.z);
        else this.setWorldPosition(pt.x, pt.y, pt.z);
        this.resetForcesAndTorques();
        this.resetVelocities();
    }

    public resetForces() {
        this.body?.resetForces(true);
    }

    public resetTorques() {
        this.body?.resetTorques(true);
    }

    public resetVelocities() {
        this.setVelocity(0, 0, 0);
        this.setAngularVelocity(0, 0, 0);
    }

    public resetForcesAndTorques() {
        this.resetForces();
        this.resetTorques();
    }

    public wakeUp() {
        this.body?.wakeUp();
    }

    public applyForce(vec: Vector3, _rel?: THREE.Vector3) {
        this.body?.addForce(vec, true);
    }

    public applyImpulse(vec: Vector3) {
        this.body?.applyImpulse(vec, true);
    }

    public setForce(x: number, y: number, z: number) {
        this.body?.resetForces(true);
        this.body?.addForce({ x, y, z }, true);
    }

    public getVelocity(): Vector3 {
        const vel = this.body?.linvel();
        if (!vel) return this._currentVelocity.set(0, 0, 0);
        this._currentVelocity.x = vel.x;
        this._currentVelocity.y = vel.y;
        this._currentVelocity.z = vel.z;
        return this._currentVelocity;
    }

    public setVelocity(x: number | Vector3, y?: number, z?: number) {
        if (x instanceof Vector3) {
            const vec = x;
            this.body?.setLinvel(vec, true);
            return;
        }
        if (y === undefined || z === undefined) return;
        this.body?.setLinvel({ x: x, y: y, z: z }, true);
    }

    public setAngularVelocity(x: number | Vector3, y?: number, z?: number) {
        if (x instanceof Vector3) {
            const vec = x;
            this.body?.setAngvel(vec, true);
            return;
        }
        if (y === undefined || z === undefined) return;
        this.body?.setAngvel({ x: x, y: y, z: z }, true);
    }

    public getAngularVelocity(): Vector3 {
        const vel = this.body?.angvel();
        if (!vel) return this._currentVelocity.set(0, 0, 0);
        this._currentVelocity.x = vel.x;
        this._currentVelocity.y = vel.y;
        this._currentVelocity.z = vel.z;
        return this._currentVelocity;
    }

    public setTorque(x: number | Vector3, y: number, z: number) {
        this.setAngularVelocity(x, y, z);
    }

    public get smoothedVelocity(): Vector3 {
        this._smoothedVelocityGetter.copy(this._smoothedVelocity);
        return this._smoothedVelocityGetter.multiplyScalar(1 / this.context.time.deltaTime);
    }

    // public get smoothedVelocity() { return this._smoothedVelocity; }



    /**d
     * @deprecated not used anymore
     */
    public setBodyFromGameObject(_velocity: THREE.Vector3 | null | { x: number, y: number, z: number } = null) { }



    private captureVelocity() {
        if (this.body) {
            const wp = getWorldPosition(this.gameObject);
            Rigidbody.tempPosition.copy(wp);
            const vel = wp.sub(this._lastPosition);
            this._lastPosition.copy(Rigidbody.tempPosition);
            this._smoothedVelocity.lerp(vel, this.context.time.deltaTime / .1);
            // this._smoothedVelocity.set(0, 1 / this.context.time.deltaTime, 0);
        }
    }
}