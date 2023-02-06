import { BasicDepthPacking, Box3, BufferAttribute, BufferGeometry, Camera, Intersection, Layers, LineBasicMaterial, LineSegments, Matrix4, Mesh, NormalAnimationBlendMode, NumberKeyframeTrack, Object3D, Quaternion, Ray, Raycaster, Sphere, Vector2, Vector3 } from 'three'
import { Context } from './engine_setup';
import { CircularBuffer, getParam } from "./engine_utils"
import { getWorldPosition, getWorldQuaternion, getWorldScale, setWorldPositionXYZ, setWorldQuaternion, setWorldQuaternionXYZW } from "./engine_three_utils"
import {
    IComponent,
    ICollider,
    IRigidbody,
    Collision,
    ContactPoint,
    Vec3,
    IGameObject,
    Vec2,
} from './engine_types';
import { InstancingUtil } from './engine_instancing';
import { foreachComponent } from './engine_gameobject';

import RAPIER, { ActiveEvents, CoefficientCombineRule, Collider, ColliderDesc, EventQueue, JointData, RigidBody, RigidBodyType, World } from '@dimforge/rapier3d-compat';
import { CollisionDetectionMode, PhysicsMaterialCombine } from '../engine/engine_physics.types';
import { Gizmos } from './engine_gizmos';
import { Mathf } from './engine_math';
export type Rapier = typeof RAPIER;


const debugPhysics = getParam("debugphysics");
const debugColliderPlacement = getParam("debugphysicscolliders");
const debugCollisions = getParam("debugcollisions");
const showColliders = getParam("showcolliders");


declare type PhysicsBody = {
    translation(): { x: number, y: number, z: number }
    rotation(): { x: number, y: number, z: number, w: number }
}

/** on physics body and references the needle component */
const $componentKey = Symbol("needle component");
/** on needle component and references physics body */
const $bodyKey = Symbol("physics body");
const $colliderRigidbody = Symbol("rigidbody");
// const $removed = Symbol("removed");

export class RaycastOptions {
    ray: Ray | undefined = undefined;
    cam: Camera | undefined | null = undefined;
    screenPoint: Vector2 | undefined = undefined;
    raycaster: Raycaster | undefined = undefined;
    results: Array<Intersection> | undefined = undefined;
    targets: Array<Object3D> | undefined = undefined;
    recursive: boolean | undefined = true;
    minDistance: number | undefined = undefined;
    maxDistance: number | undefined = undefined;
    lineThreshold: number | undefined = undefined;
    layerMask: Layers | number | undefined = undefined;
    ignore: Object3D[] | undefined = undefined;

    screenPointFromOffset(ox: number, oy: number) {
        if (this.screenPoint === undefined) this.screenPoint = new Vector2();
        this.screenPoint.x = ox / window.innerWidth * 2 - 1;
        this.screenPoint.y = -(oy / window.innerHeight) * 2 + 1;
    }

    setMask(mask: number) {
        if (!this.layerMask) this.layerMask = new Layers();
        const lm = this.layerMask as Layers;
        if (lm)
            lm.mask = mask;
        else this.layerMask = mask;
    }

    public static AllLayers = 0xFFFFFFFF;
}

export class SphereIntersection implements Intersection {
    distance: number;
    point: Vector3;
    object: Object3D;
    constructor(object: Object3D, distance: number, point: Vector3) {
        this.object = object;
        this.distance = distance;
        this.point = point;
    }
}

declare type PhysicsRaycastResult = {
    point: Vector3,
    normal?: Vector3,
    collider?: ICollider
}

export class Physics {

    // raycasting

    private readonly raycaster: Raycaster = new Raycaster();
    private readonly defaultRaycastOptions: RaycastOptions = new RaycastOptions();
    private readonly targetBuffer: Array<Object3D> = new Array<Object3D>(1);
    private readonly defaultThresholds = {
        Mesh: {},
        Line: { threshold: 0 },
        LOD: {},
        Points: { threshold: 0 },
        Sprite: {}
    }


    private sphereResults: Array<Intersection> = new Array<Intersection>();
    private sphereMask: Layers = new Layers();
    public sphereOverlap(spherePos: Vector3, radius: number, traverseChildsAfterHit: boolean = true): Array<Intersection> {
        this.sphereResults.length = 0;
        if (!this.context.scene) return this.sphereResults;
        const sphere = new Sphere(spherePos, radius);
        const mask = this.sphereMask;
        mask.enableAll();
        mask.disable(2);
        for (const ch of this.context.scene.children) {
            this.onSphereOverlap(ch, sphere, mask, this.sphereResults, traverseChildsAfterHit);
        }
        return this.sphereResults.sort((a, b) => a.distance - b.distance);
    }
    private tempBoundingBox: Box3 = new Box3();
    private onSphereOverlap(obj: Object3D, sp: Sphere, mask: Layers, results: Array<Intersection>, traverseChildsAfterHit: boolean): void {
        if (obj.type === "Mesh" && obj.layers.test(mask)) {
            const mesh = obj as Mesh;
            const geo = mesh.geometry;
            if (!geo.boundingBox)
                geo.computeBoundingBox();
            if (geo.boundingBox) {
                if (mesh.matrixWorldNeedsUpdate) mesh.updateMatrixWorld();
                const test = this.tempBoundingBox.copy(geo.boundingBox).applyMatrix4(mesh.matrixWorld);
                if (sp.intersectsBox(test)) {
                    // console.log(obj, obj.layers.test(mask), obj.layers.mask, mask.mask);
                    const wp = getWorldPosition(obj);
                    const dist = wp.distanceTo(sp.center);
                    const int = new SphereIntersection(obj, dist, sp.center.clone());
                    results.push(int);
                    if (!traverseChildsAfterHit) return;
                }
            }
        }
        if (obj.children) {
            for (const ch of obj.children) {
                const len = results.length;
                this.onSphereOverlap(ch, sp, mask, results, traverseChildsAfterHit);
                if (len != results.length && !traverseChildsAfterHit) return;
            }
        }
    }

    public raycastFromRay(ray: Ray, options: RaycastOptions | null = null): Array<Intersection> {
        const opts = options ?? this.defaultRaycastOptions;
        opts.ray = ray;
        return this.raycast(opts);
    }

    /** raycast against rendered three objects. This might be very slow depending on your scene complexity.
     * We recommend setting objects to IgnoreRaycast layer (2) when you don't need them to be raycasted.
     * Raycasting SkinnedMeshes is specially expensive.
     */
    public raycast(options: RaycastOptions | null = null): Array<Intersection> {
        if (!options) options = this.defaultRaycastOptions;
        const mp = options.screenPoint ?? this.context.input.mousePositionRC;
        const rc = options.raycaster ?? this.raycaster;
        rc.near = options.minDistance ?? 0;
        rc.far = options.maxDistance ?? Infinity;
        rc.params = this.defaultThresholds;
        if (options.lineThreshold)
            rc.params.Line = { threshold: options.lineThreshold };
        else rc.params.Line = { threshold: 0 };
        if (options.ray) {
            rc.ray.copy(options.ray);
        }
        else {
            const cam = options.cam ?? this.context.mainCamera;
            if (!cam) {
                console.error("Can not perform raycast - no main camera found");
                if (this.defaultRaycastOptions.results) this.defaultRaycastOptions.results.length = 0;
                return this.defaultRaycastOptions.results ?? [];
            }
            rc.setFromCamera(mp, cam);
        }
        let targets = options.targets;
        if (!targets) {
            targets = this.targetBuffer;
            targets[0] = this.context.scene;
        }
        let results = options.results;
        if (!results) {
            if (!this.defaultRaycastOptions.results)
                this.defaultRaycastOptions.results = new Array<Intersection>();
            results = this.defaultRaycastOptions.results;
        }

        // layermask
        // https://github.com/mrdoob/js/blob/master/src/core/Layers.js
        if (options.layerMask !== undefined) {
            if (options.layerMask instanceof Layers)
                rc.layers.mask = options.layerMask.mask;
            else
                rc.layers.mask = options.layerMask;
        }
        else {
            rc.layers.enableAll();
            rc.layers.disable(2);
        }

        // console.log(rc)
        // console.log(targets);

        // shoot
        results.length = 0;
        rc.intersectObjects(targets, options.recursive, results);

        // TODO: instead of doing this we should temporerly set these objects to layer 2 during raycasting
        const ignorelist = options.ignore;
        if (ignorelist !== undefined && ignorelist.length > 0) {
            results = results.filter(r => !ignorelist.includes(r.object));
        }
        return results;
    }

    private rapierRay = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    private raycastVectorsBuffer = new CircularBuffer(() => new Vector3(), 10);

    /** raycast against colliders */
    public raycastPhysicsFast(origin: Vec2 | Vec3, direction: Vec3 | undefined = undefined, maxDistance: number = Infinity, solid: boolean = true)
        : null | { point: Vector3, collider: ICollider } {

        const ray = this.getPhysicsRay(this.rapierRay, origin, direction);
        if (!ray) return null;

        const hit = this.world?.castRay(ray, maxDistance, solid);
        if (hit) {
            const point = ray.pointAt(hit.toi);
            const vec = this.raycastVectorsBuffer.get();
            vec.set(point.x, point.y, point.z);
            return { point: vec, collider: hit.collider[$componentKey] };
        }

        return null;
    }

    private getPhysicsRay(ray: RAPIER.Ray, origin: Vec2 | Vec3, direction: Vec3 | undefined = undefined): RAPIER.Ray | null {
        const cam = this.context.mainCamera;
        // if we get origin in 2d space we need to project it to 3d space
        if (origin["z"] === undefined) {
            if (!cam) {
                console.error("Can not perform raycast from 2d point - no main camera found");
                return null;
            }
            const vec3 = this.raycastVectorsBuffer.get();
            // if the origin is in screen space we need to convert it to raycaster space
            if (origin.x > 1 || origin.y > 1 || origin.y < -1 || origin.x < -1) {
                this.context.input.convertScreenspaceToRaycastSpace(origin);
            }
            vec3.set(origin.x, origin.y, -1);
            vec3.unproject(cam);
            origin = vec3;
        }

        const o = origin as Vec3;

        ray.origin.x = o.x;
        ray.origin.y = o.y;
        ray.origin.z = o.z;
        const vec = this.raycastVectorsBuffer.get();
        if (direction)
            vec.set(direction.x, direction.y, direction.z);
        else {
            if (!cam) {
                console.error("Can not perform raycast - no camera found");
                return null;
            }
            vec.set(ray.origin.x, ray.origin.y, ray.origin.z);
            const camPosition = getWorldPosition(cam);
            vec.sub(camPosition);
        }
        // we need to normalize the ray because our input is a max travel length and the direction may be not normalized
        vec.normalize();
        ray.dir.x = vec.x;
        ray.dir.y = vec.y;
        ray.dir.z = vec.z;
        // Gizmos.DrawRay(ray.origin, ray.dir, 0xff0000, Infinity);
        return ray;
    }

    // physics simulation

    private _tempPosition: Vector3 = new Vector3();
    private _tempQuaternion: Quaternion = new Quaternion();
    private _tempScale: Vector3 = new Vector3();
    private _tempMatrix: Matrix4 = new Matrix4();

    private static _didLoadPhysicsEngine: boolean = false;

    private _isUpdatingPhysicsWorld: boolean = false;
    get isUpdating(): boolean { return this._isUpdatingPhysicsWorld; }


    private context: Context;
    private world?: World;
    private _hasCreatedWorld: boolean = false;
    private eventQueue?: EventQueue;
    private collisionHandler?: PhysicsCollisionHandler;


    private objects: IComponent[] = [];
    private bodies: PhysicsBody[] = [];

    private _meshCache: Map<string, Float32Array> = new Map<string, Float32Array>();


    constructor(context: Context) {
        this.context = context;
    }

    async createWorld() {
        if (this._hasCreatedWorld) {
            console.error("Invalid call to create physics world: world is already created");
            return;
        }
        this._hasCreatedWorld = true;
        if (!Physics._didLoadPhysicsEngine) {
            await RAPIER.init().then(() => RAPIER)
            Physics._didLoadPhysicsEngine = true;
        }
        const gravity = { x: 0.0, y: -9.81, z: 0.0 };
        this.world = new World(gravity);
    }

    clearCaches() {
        this._meshCache.clear();
    }

    addBoxCollider(collider: ICollider, center: Vector3, size: Vector3) {
        const obj = collider.gameObject;
        const scale = getWorldScale(obj, this._tempPosition).multiply(size);
        scale.multiplyScalar(0.5);
        const desc = ColliderDesc.cuboid(scale.x, scale.y, scale.z);
        this.createCollider(collider, desc, center);
    }

    addSphereCollider(collider: ICollider, center: Vector3, radius: number) {
        const obj = collider.gameObject;
        const scale = getWorldScale(obj, this._tempPosition).multiplyScalar(radius);
        const desc = ColliderDesc.ball(scale.x);
        this.createCollider(collider, desc, center);
    }

    addCapsuleCollider(collider: ICollider, center: Vector3, height: number, radius: number) {
        const obj = collider.gameObject;
        const scale = getWorldScale(obj, this._tempPosition);
        if (debugPhysics) console.log("capsule scale", scale, height, radius);
        const desc = ColliderDesc.capsule(height * .5 * scale.y - radius, radius * scale.x);
        this.createCollider(collider, desc, center);
    }

    addMeshCollider(collider: ICollider, mesh: Mesh, convex: boolean, scale: Vector3) {
        const geo = mesh.geometry;
        if (!geo) {
            if (debugPhysics) console.warn("Missing mesh geometry", mesh.name);
            return;
        }

        let positions = geo.getAttribute("position").array as Float32Array;
        const indices = geo.index?.array as Uint32Array;

        // console.log(geo.center())

        // scaling seems not supported yet https://github.com/dimforge/rapier/issues/243
        if (Math.abs(scale.x - 1) > 0.0001 || Math.abs(scale.y - 1) > 0.0001 || Math.abs(scale.z - 1) > 0.0001) {
            const key = geo.uuid + "_" + scale.x + "_" + scale.y + "_" + scale.z + "_" + convex;
            if (this._meshCache.has(key)) {
                positions = this._meshCache.get(key)!;
            }
            else {
                console.warn("Your model is using scaled mesh colliders which is not optimal for performance", mesh.name, Object.assign({}, scale), mesh);
                // showBalloonWarning("Your model is using scaled mesh colliders which is not optimal for performance: " + mesh.name + ", consider using unscaled objects");
                const scaledPositions = new Float32Array(positions.length);
                for (let i = 0; i < positions.length; i += 3) {
                    scaledPositions[i] = positions[i] * scale.x;
                    scaledPositions[i + 1] = positions[i + 1] * scale.y;
                    scaledPositions[i + 2] = positions[i + 2] * scale.z;
                }
                positions = scaledPositions;
                this._meshCache.set(key, scaledPositions);
            }
        }
        const desc = convex ? ColliderDesc.convexMesh(positions) : ColliderDesc.trimesh(positions, indices);
        if (desc) {
            const col = this.createCollider(collider, desc);
            col.setMassProperties(1, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 });
            // rb?.setTranslation({ x: 0, y: 2, z: 0 });
            // col.setTranslationWrtParent(new Vector3(0,2,0));

        }
    }

    private createCollider(collider: ICollider, desc: ColliderDesc, center?: Vector3) {
        if (!this.world) throw new Error("Physics world not initialized");
        const matrix = this._tempMatrix;
        const {
            rigidBody,
            useExplicitMassProperties
        } = this.getRigidbody(collider, this._tempMatrix);

        matrix.decompose(this._tempPosition, this._tempQuaternion, this._tempScale);
        getWorldScale(collider.gameObject, this._tempScale);
        if (center) {
            center.multiply(this._tempScale);
            this._tempPosition.x -= center.x;
            this._tempPosition.y += center.y;
            this._tempPosition.z += center.z;
        }
        desc.setTranslation(this._tempPosition.x, this._tempPosition.y, this._tempPosition.z);
        desc.setRotation(this._tempQuaternion);
        desc.setSensor(collider.isTrigger);

        // TODO: we might want to update this if the material changes
        const physicsMaterial = collider.sharedMaterial;
        if (physicsMaterial) {
            CoefficientCombineRule
            desc.setRestitution(physicsMaterial.bounciness);
            switch (physicsMaterial.bounceCombine) {
                case PhysicsMaterialCombine.Average:
                    desc.setRestitutionCombineRule(CoefficientCombineRule.Average);
                    break;
                case PhysicsMaterialCombine.Maximum:
                    desc.setRestitutionCombineRule(CoefficientCombineRule.Max);
                    break;
                case PhysicsMaterialCombine.Minimum:
                    desc.setRestitutionCombineRule(CoefficientCombineRule.Min);
                    break;
                case PhysicsMaterialCombine.Multiply:
                    desc.setRestitutionCombineRule(CoefficientCombineRule.Multiply);
                    break;
            }
            desc.setFriction(physicsMaterial.dynamicFriction);
            switch (physicsMaterial.frictionCombine) {
                case PhysicsMaterialCombine.Average:
                    desc.setFrictionCombineRule(CoefficientCombineRule.Average);
                    break;
                case PhysicsMaterialCombine.Maximum:
                    desc.setFrictionCombineRule(CoefficientCombineRule.Max);
                    break;
                case PhysicsMaterialCombine.Minimum:
                    desc.setFrictionCombineRule(CoefficientCombineRule.Min);
                    break;
                case PhysicsMaterialCombine.Multiply:
                    desc.setFrictionCombineRule(CoefficientCombineRule.Multiply);
                    break;
            }
        }

        // if we want to use explicit mass properties, we need to set the collider density to 0
        // otherwise rapier will compute the mass properties based on the collider shape and density
        // https://rapier.rs/docs/user_guides/javascript/rigid_bodies#mass-properties
        if (useExplicitMassProperties) {
            // desc.setDensity(0);
        }

        const col = this.world.createCollider(desc, rigidBody);
        col[$componentKey] = collider;
        collider[$bodyKey] = col;
        col.setActiveEvents(ActiveEvents.COLLISION_EVENTS);
        this.objects.push(collider);
        this.bodies.push(col);
        return col;
    }

    private getRigidbody(collider: ICollider, _matrix: Matrix4): { rigidBody: RigidBody, useExplicitMassProperties: boolean } {

        if (!this.world) throw new Error("Physics world not initialized");
        let rigidBody: RigidBody | null = null;
        let useExplicitMassProperties = false;

        if (collider.attachedRigidbody) {

            const rb = collider.attachedRigidbody;
            rigidBody = rb[$bodyKey];
            useExplicitMassProperties = true;
            if (!rigidBody) {
                const kinematic = rb.isKinematic && !debugColliderPlacement;
                if (debugPhysics)
                    console.log("Create rigidbody", kinematic);
                const rigidBodyDesc = kinematic ? RAPIER.RigidBodyDesc.kinematicPositionBased() : RAPIER.RigidBodyDesc.dynamic();
                const pos = getWorldPosition(collider.attachedRigidbody.gameObject);
                rigidBodyDesc.setTranslation(pos.x, pos.y, pos.z);
                rigidBodyDesc.setRotation(getWorldQuaternion(collider.attachedRigidbody.gameObject));
                rigidBody = this.world.createRigidBody(rigidBodyDesc);
                this.bodies.push(rigidBody);
                this.objects.push(rb);
            }
            rigidBody[$componentKey] = rb;
            rb[$bodyKey] = rigidBody;
            this.internalUpdateProperties(rb, rigidBody);
            this.getRigidbodyRelativeMatrix(collider.gameObject, rb.gameObject, _matrix);

        }
        else {

            const rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased();
            const pos = getWorldPosition(collider.gameObject);
            rigidBodyDesc.setTranslation(pos.x, pos.y, pos.z);
            rigidBodyDesc.setRotation(getWorldQuaternion(collider.gameObject));
            rigidBody = this.world.createRigidBody(rigidBodyDesc);
            _matrix.identity();
            rigidBody[$componentKey] = null;

        }

        collider[$colliderRigidbody] = rigidBody;

        return { rigidBody: rigidBody, useExplicitMassProperties: useExplicitMassProperties };
    }

    removeBody(obj: IComponent) {
        const body = obj[$bodyKey];
        obj[$bodyKey] = null;
        if (body && this.world) {
            const index = this.objects.findIndex(o => o === obj);
            if (index >= 0) {
                const body = this.bodies[index];
                this.bodies.splice(index, 1);
                this.objects.splice(index, 1);

                if (body instanceof Collider) {
                    const collider = body as Collider;
                    this.world?.removeCollider(collider, true);

                    // remove the rigidbody if it doesnt have colliders anymore
                    const rb = collider.parent();
                    if (rb && rb.numColliders() <= 0) {
                        this.world?.removeRigidBody(rb);
                    }
                }
                else if (body instanceof RigidBody) {
                    // TODO: running this code below causes a crash in rapier
                    // const rb = body as RigidBody;
                    // console.log("colliders", rb.numColliders())
                    // for (let i = 0; i < rb.numColliders(); i++) {
                    //     const col = rb.collider(i);
                    //     this.world?.removeCollider(col, true);
                    // }
                    // console.log("colliders", rb.numColliders(), rb)
                    // console.log(rb.handle, rb.userData);
                    // if (rb.userData === undefined)
                    //     this.world?.removeRigidBody(rb);
                }

                // check if we need to remove the rigidbody too
                // const col = obj as ICollider;
                // if (col.isCollider && col.attachedRigidbody) {
                //     const rb = col.attachedRigidbody[$bodyKey] as RigidBody;
                //     if (rb && rb.numColliders() <= 0) {
                //         // this.world?.removeRigidBody(rb);
                //     }
                // }
            }
        }
    }

    updateBody(comp: ICollider | IRigidbody, translation: boolean, rotation: boolean) {
        if (comp.destroyed || !comp.gameObject) return;
        if (!translation && !rotation) return;

        if ((comp as ICollider).isCollider === true) {
            // const collider = comp as ICollider;
            console.warn("TODO: implement updating collider position");
        }
        else {
            const rigidbody = comp as IRigidbody;
            const body = rigidbody[$bodyKey];
            if (body) {
                this.syncPhysicsBody(rigidbody.gameObject, body, translation, rotation);
            }
        }
    }

    updateProperties(rigidbody: IRigidbody) {
        const physicsBody = rigidbody[$bodyKey]
        if (physicsBody) {
            this.internalUpdateProperties(rigidbody, physicsBody);
        }
    }

    internal_getRigidbody(rb: IRigidbody): RigidBody | null {
        return rb[$bodyKey] as RigidBody;
    }

    private internalUpdateProperties(rb: IRigidbody, rigidbody: RigidBody) {
        // continuous collision detection 
        // https://rapier.rs/docs/user_guides/javascript/rigid_bodies#continuous-collision-detection
        rigidbody.enableCcd(rb.collisionDetectionMode !== CollisionDetectionMode.Discrete);
        rigidbody.setLinearDamping(rb.drag);
        rigidbody.setAngularDamping(rb.angularDrag);
        rigidbody.setGravityScale(rb.useGravity ? rb.gravityScale : 0, true);

        // https://rapier.rs/docs/user_guides/javascript/rigid_bodies#mass-properties
        // rigidbody.setAdditionalMass(rb.mass, true);
        // for (let i = 0; i < rigidbody.numColliders(); i++) {
        //     const collider = rigidbody.collider(i);
        //     if (collider) {
        //         collider.setMass(rb.mass);
        //         // const density = rb.mass / collider.shape.computeMassProperties().mass;
        //     }
        // }

        // lock rotations
        rigidbody.setEnabledRotations(!rb.lockRotationX, !rb.lockRotationY, !rb.lockRotationZ, true);
        rigidbody.setEnabledTranslations(!rb.lockPositionX, !rb.lockPositionY, !rb.lockPositionZ, true);

        if (rb.isKinematic) {
            rigidbody.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased);
        }
        else {
            rigidbody.setBodyType(RAPIER.RigidBodyType.Dynamic);
        }
    }

    // private _lastStepTime: number | undefined = 0;
    private lines?: LineSegments;

    public step(dt?: number) {
        if (!this.world) return;
        this._isUpdatingPhysicsWorld = true;
        if (!this.eventQueue) {
            this.eventQueue = new EventQueue(false);
        }
        if (dt) {
            // if we make to sudden changes to the timestep the physics can get unstable
            // https://rapier.rs/docs/user_guides/javascript/integration_parameters/#dt
            this.world.timestep = Mathf.lerp(this.world.timestep, dt, 0.8);
        }
        this.world.step(this.eventQueue);
        this._isUpdatingPhysicsWorld = false;
        this.updateDebugRendering(this.world);
    }

    private updateDebugRendering(world: World) {
        if (debugPhysics || debugColliderPlacement || showColliders) {
            if (!this.lines) {
                const material = new LineBasicMaterial({
                    color: 0x227700,
                    // vertexColors: THREE.VertexColors
                });
                const geometry = new BufferGeometry();
                this.lines = new LineSegments(geometry, material);
                this.context.scene.add(this.lines);
            }
            const buffers = world.debugRender();
            this.lines.geometry.setAttribute('position', new BufferAttribute(buffers.vertices, 3));
            this.lines.geometry.setAttribute('color', new BufferAttribute(buffers.colors, 4));
        }
    }

    public postStep() {
        if (!this.world) return;
        this._isUpdatingPhysicsWorld = true;
        this.syncObjects();
        this._isUpdatingPhysicsWorld = false;

        if (this.eventQueue && !this.collisionHandler) {
            this.collisionHandler = new PhysicsCollisionHandler(this.world, this.eventQueue);
        }
        if (this.collisionHandler) {
            this.collisionHandler.handleCollisionEvents();
            this.collisionHandler.update();
        }
    }

    /** sync rendered objects with physics world (except for colliders without rigidbody) */
    private syncObjects() {
        if (debugColliderPlacement) return;
        for (let i = 0; i < this.bodies.length; i++) {
            const obj = this.objects[i];
            const body = this.bodies[i] as Collider;

            // if the collider is not attached to a rigidbody
            // it means that its kinematic so we need to update its position
            const col = (obj as ICollider);
            if (col?.isCollider === true && !col.attachedRigidbody) {
                const rigidbody = body.parent();
                if (rigidbody)
                    this.syncPhysicsBody(obj.gameObject, rigidbody, true, true);
                continue;
            }


            // sync
            const pos = body.translation();
            const rot = body.rotation();
            // make sure to keep the collider offset
            const center = obj["center"] as Vector3;
            if (center && center.isVector3) {
                this._tempQuaternion.set(rot.x, rot.y, rot.z, rot.w);
                const offset = this._tempPosition.copy(center).applyQuaternion(this._tempQuaternion);
                const scale = getWorldScale(obj.gameObject);
                offset.multiply(scale);
                pos.x -= offset.x;
                pos.y -= offset.y;
                pos.z -= offset.z;
            }
            setWorldPositionXYZ(obj.gameObject, pos.x, pos.y, pos.z);
            setWorldQuaternionXYZW(obj.gameObject, rot.x, rot.y, rot.z, rot.w);
        }
    }

    private syncPhysicsBody(obj: Object3D, body: RigidBody, translation: boolean, rotation: boolean) {

        // const bodyType = body.bodyType();
        // const previous = physicsBody.translation();
        // const vel = physicsBody.linvel();

        const worldPosition = getWorldPosition(obj, this._tempPosition);
        const worldQuaternion = getWorldQuaternion(obj, this._tempQuaternion);
        const type = body.bodyType();
        switch (type) {
            case RigidBodyType.Fixed:
            case RigidBodyType.KinematicPositionBased:
            case RigidBodyType.KinematicVelocityBased:
                if (translation)
                    body.setNextKinematicTranslation(worldPosition);
                if (rotation)
                    body.setNextKinematicRotation(worldQuaternion);
                break;
            default:
                if (translation)
                    body.setTranslation(worldPosition, false);
                if (rotation)
                    body.setRotation(worldQuaternion, false);
                break;

        }
        body.wakeUp();
        // physicsBody.setBodyType(RAPIER.RigidBodyType.Fixed);
        // physicsBody.setLinvel(vel, false);

        // update velocity
        // const pos = physicsBody.translation();
        // pos.x -= previous.x;
        // pos.y -= previous.y;
        // pos.z -= previous.z;
        // // threhold
        // const t = 1;
        // const canUpdateVelocity = Math.abs(pos.x) < t && Math.abs(pos.y) < t && Math.abs(pos.z) < t;
        // if (canUpdateVelocity) {
        //     const damping = 1 + this.context.time.deltaTime;
        //     vel.x *= damping;
        //     vel.y *= damping;
        //     vel.z *= damping;
        //     vel.x += pos.x;
        //     vel.y += pos.y;
        //     vel.z += pos.z;
        //     console.log(vel);
        //     physicsBody.setLinvel(vel, true);
        // }
        // else if(debugPhysics) console.warn("Movement exceeded threshold, not updating velocity", pos);

        // body.setBodyType(bodyType);
    }

    private static _matricesBuffer: Matrix4[] = [];
    private getRigidbodyRelativeMatrix(comp: Object3D, rigidbody: Object3D, mat: Matrix4, matrices?: Matrix4[]): Matrix4 {
        // collect all matrices to the rigidbody and then build the rigidbody relative matrix
        if (matrices === undefined) {
            matrices = Physics._matricesBuffer;
            matrices.length = 0;
        }
        if (comp === rigidbody) {
            const scale = getWorldScale(comp, this._tempPosition);
            mat.makeScale(scale.x, scale.y, scale.z);
            for (let i = matrices.length - 1; i >= 0; i--) {
                mat.multiply(matrices[i]);
            }
            return mat;
        }
        matrices.push(comp.matrix);
        if (comp.parent) {
            this.getRigidbodyRelativeMatrix(comp.parent, rigidbody, mat, matrices);
        }
        return mat;
    }

    private static centerConnectionPos = { x: 0, y: 0, z: 0 };
    private static centerConnectionRot = { x: 0, y: 0, z: 0, w: 1 };



    addFixedJoint(body1: IRigidbody, body2: IRigidbody) {
        if (!this.world) {
            console.error("Physics world not initialized");
            return;
        }
        const b1 = body1[$bodyKey] as RigidBody;
        const b2 = body2[$bodyKey] as RigidBody;

        this.calculateJointRelativeMatrices(body1.gameObject, body2.gameObject, this._tempMatrix);
        this._tempMatrix.decompose(this._tempPosition, this._tempQuaternion, this._tempScale);

        const params = JointData.fixed(
            Physics.centerConnectionPos, Physics.centerConnectionRot,
            this._tempPosition, this._tempQuaternion,
        );
        const joint = this.world.createImpulseJoint(params, b1, b2, true);
        if (debugPhysics)
            console.log("ADD FIXED JOINT", joint)
    }


    /** The joint prevents any relative movement between two rigid-bodies, except for relative rotations along one axis. This is typically used to simulate wheels, fans, etc. They are characterized by one local anchor as well as one local axis on each rigid-body. */
    addHingeJoint(body1: IRigidbody, body2: IRigidbody, anchor: { x: number, y: number, z: number }, axis: { x: number, y: number, z: number }) {
        if (!this.world) {
            console.error("Physics world not initialized");
            return;
        }
        const b1 = body1[$bodyKey] as RigidBody;
        const b2 = body2[$bodyKey] as RigidBody;

        this.calculateJointRelativeMatrices(body1.gameObject, body2.gameObject, this._tempMatrix);
        this._tempMatrix.decompose(this._tempPosition, this._tempQuaternion, this._tempScale);

        let params = RAPIER.JointData.revolute(anchor, this._tempPosition, axis);
        let joint = this.world.createImpulseJoint(params, b1, b2, true);
        if (debugPhysics)
            console.log("ADD HINGE JOINT", joint)
    }


    private calculateJointRelativeMatrices(body1: IGameObject, body2: IGameObject, mat: Matrix4) {
        body1.updateWorldMatrix(true, false);
        body2.updateWorldMatrix(true, false);
        const world1 = body1.matrixWorld;
        const world2 = body2.matrixWorld;
        // set scale to 1
        world1.elements[0] = 1;
        world1.elements[5] = 1;
        world1.elements[10] = 1;
        world2.elements[0] = 1;
        world2.elements[5] = 1;
        world2.elements[10] = 1;
        mat.copy(world2).premultiply(world1.invert()).invert();
    }
}



/** responsible of processing collision events for the component system */
class PhysicsCollisionHandler {

    readonly world: World;
    readonly eventQueue: EventQueue;

    constructor(world: World, eventQueue: EventQueue) {
        this.world = world;
        this.eventQueue = eventQueue;
    }

    private activeCollisions: Array<{ collider: ICollider, component: IComponent, collision: Collision }> = [];
    private activeCollisionsStay: Array<{ collider: ICollider, component: IComponent, collision: Collision }> = [];
    private activeTriggers: Array<{ collider: ICollider, component: IComponent, otherCollider: ICollider }> = [];

    handleCollisionEvents() {
        if (!this.eventQueue) return;
        if (!this.world) return;
        this.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
            const col1 = this.world!.getCollider(handle1);
            const col2 = this.world!.getCollider(handle2);
            const colliderComponent1 = col1[$componentKey];
            const colliderComponent2 = col2[$componentKey];
            if (debugCollisions)
                console.log("EVT", colliderComponent1.name, colliderComponent2.name, started, col1, col2);
            if (colliderComponent1 && colliderComponent2) {
                if (started) {
                    this.onCollisionStarted(colliderComponent1, col1, colliderComponent2, col2);
                    this.onCollisionStarted(colliderComponent2, col2, colliderComponent1, col1);
                }
                else {
                    this.onCollisionEnded(colliderComponent1, colliderComponent2);
                    this.onCollisionEnded(colliderComponent2, colliderComponent1);
                }
            }
        });
    }

    update() {
        this.onHandleCollisionStay();
    }

    private onCollisionStarted(self: ICollider, selfBody: Collider, other: ICollider, otherBody: Collider) {
        let collision: Collision | null = null;

        // if one is a trigger we dont get collisions but want to raise the trigger events
        if (self.isTrigger || other.isTrigger) {
            foreachComponent(self.gameObject, (c: IComponent) => {
                if (c.onTriggerEnter) {
                    c.onTriggerEnter(other);
                }
                this.activeTriggers.push({ collider: self, component: c, otherCollider: other });
            });
        }
        else {
            const object = self.gameObject;
            // TODO: we dont respect the flip value here!
            this.world.contactPair(selfBody, otherBody, (manifold, _flipped) => {
                foreachComponent(object, (c: IComponent) => {
                    const hasDeclaredEventMethod = c.onCollisionEnter || c.onCollisionStay || c.onCollisionExit;
                    if (hasDeclaredEventMethod || debugCollisions) {
                        if (!collision) {
                            const contacts: Array<ContactPoint> = [];
                            const normal = manifold.normal();
                            for (let i = 0; i < manifold.numSolverContacts(); i++) {
                                // solver points are in world space
                                // https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection_js#the-contact-graph
                                const pt = manifold.solverContactPoint(i);
                                const impulse = manifold.contactImpulse(i);
                                if (pt) {
                                    const dist = manifold.contactDist(i);
                                    const friction = manifold.solverContactFriction(i);
                                    const contact = new ContactPoint(pt, dist, normal, impulse, friction);
                                    contacts.push(contact);
                                    if (debugCollisions) {
                                        Gizmos.DrawDirection(pt, normal, 0xff0000, 3, true);
                                    }
                                }
                            }
                            collision = new Collision(object, other, contacts);
                        }

                        // we only need to keep track if any event exists
                        if (hasDeclaredEventMethod) {
                            const info = { collider: self, component: c, collision };

                            this.activeCollisions.push(info);
                            if (c.onCollisionStay) {
                                this.activeCollisionsStay.push(info);
                            }

                            c.onCollisionEnter?.call(c, collision);
                        }

                    }
                });
            });
        }
    }

    private onHandleCollisionStay() {
        for (const active of this.activeCollisionsStay) {
            const c = active.component;
            if (c.activeAndEnabled && c.onCollisionStay) {
                const arg = active.collision;
                c.onCollisionStay(arg);
            }
        }
        for (const active of this.activeTriggers) {
            const c = active.component;
            if (c.activeAndEnabled && c.onTriggerStay) {
                const arg = active.otherCollider;
                c.onTriggerStay(arg);
            }
        }
    }

    private onCollisionEnded(self: ICollider, other: ICollider) {
        for (let i = 0; i < this.activeCollisions.length; i++) {
            const active = this.activeCollisions[i];
            const collider = active.collider;
            if (collider === self && active.collision.collider === other) {
                const c = active.component;
                this.activeCollisions.splice(i, 1);
                i--;
                if (c.activeAndEnabled && c.onCollisionExit) {
                    const collision = active.collision;
                    c.onCollisionExit(collision);
                }
            }
        }
        for (let i = 0; i < this.activeCollisionsStay.length; i++) {
            const active = this.activeCollisionsStay[i];
            const collider = active.collider;
            if (collider === self && active.collision.collider === other) {
                const c = active.component;
                this.activeCollisionsStay.splice(i, 1);
                i--;
                if (c.activeAndEnabled && c.onCollisionExit) {
                    const collision = active.collision;
                    c.onCollisionExit(collision);
                }
            }
        }
        for (let i = 0; i < this.activeTriggers.length; i++) {
            const active = this.activeTriggers[i];
            const collider = active.collider;
            if (collider === self && active.otherCollider === other) {
                const c = active.component;
                this.activeTriggers.splice(i, 1);
                i--;
                if (c.activeAndEnabled && c.onTriggerExit) {
                    const collision = active.otherCollider;
                    c.onTriggerExit(collision);
                }
            }
        }
    }
}
