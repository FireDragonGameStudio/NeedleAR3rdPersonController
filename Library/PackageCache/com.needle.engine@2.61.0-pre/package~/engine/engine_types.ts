import { Camera, Color, Material, Object3D, Vector3, Quaternion, Ray, Scene, Renderer, WebGLRenderer } from "three";
import { RGBAColor } from "../engine-components/js-extensions/RGBAColor";
import { CollisionDetectionMode, PhysicsMaterial, RigidbodyConstraints } from "./engine_physics.types";
import { CircularBuffer } from "./engine_utils";

/** used to find data registered via gltf files e.g. find lightmaps for a Renderer component that were shipped inside a gltf */
export declare type SourceIdentifier = string;

// TODO: figure out what is best here!
// https://stackoverflow.com/a/67229348
// https://stackoverflow.com/questions/36886082/abstract-constructor-type-in-typescript
// type Constructor<T> = Function & { prototype: T } // << this includes abstract constructor types
export type Constructor<T> = abstract new (...args: any[]) => T; // abstract to support @serializable and also getComponent with abstract types
export type ConstructorConcrete<T> = new (...args: any[]) => T;
export type GuidsMap = { [key: string]: string };

export interface UIDProvider {
    seed: number;
    generateUUID(): string;
}


export declare type CoroutineData = {
	comp: IComponent,
	main: Generator,
	chained?: Array<Generator>
}


export interface IContext {
    alias?: string | null;

    scene : Scene;
    renderer : WebGLRenderer;
    mainCamera : Camera | null;
    domElement : HTMLElement;

    scripts: IComponent[];
	scripts_pausedChanged: IComponent[];
	// scripts with update event
	scripts_earlyUpdate: IComponent[];
	scripts_update: IComponent[];
	scripts_lateUpdate: IComponent[];
	scripts_onBeforeRender: IComponent[];
	scripts_onAfterRender: IComponent[];
	scripts_WithCorroutines: IComponent[];
	coroutines: { [FrameEvent: number]: Array<CoroutineData> };
    
	post_setup_callbacks: Function[];
	pre_update_callbacks: Function[];
	pre_render_callbacks: Function[];
	post_render_callbacks: Function[];

	new_scripts: IComponent[];
	new_script_start: IComponent[];
	new_scripts_pre_setup_callbacks: Function[];
	new_scripts_post_setup_callbacks: Function[];

    stopAllCoroutinesFrom(script: IComponent);
}


export declare interface INeedleEngineComponent extends HTMLElement {
    getAROverlayContainer(): HTMLElement;
    onEnterAR(session: XRSession, overlayContainer: HTMLElement);
    onExitAR(session: XRSession);
}

export declare interface IGameObject extends Object3D {
    guid: string | undefined;

    activeSelf: boolean;
    addNewComponent<T>(type: Constructor<T>): T | null;
    removeComponent(comp: IComponent): IComponent;
    getOrAddComponent<T>(typeName: Constructor<T> | null): T;
    getComponent<T>(type: Constructor<T>): T | null;
    getComponents<T>(type: Constructor<T>, arr?: T[]): Array<T>;
    getComponentInChildren<T>(type: Constructor<T>): T | null;
    getComponentsInChildren<T>(type: Constructor<T>, arr?: T[]): Array<T>;
    getComponentInParent<T>(type: Constructor<T>): T | null;
    getComponentsInParent<T>(type: Constructor<T>, arr?: T[]): Array<T>;
}

export interface IComponent {
    get isComponent(): boolean;


    gameObject: IGameObject;
    guid: string;
    enabled: boolean;
    sourceId?: SourceIdentifier;

    get name(): string;
    get layer(): number;
    get destroyed(): boolean;
    get tag(): string;

    context: any;

    get activeAndEnabled(): boolean;

    __internalNewInstanceCreated();
    __internalAwake();
    __internalStart();
    __internalEnable();
    __internalDisable();
    __internalDestroy();
    resolveGuids?(guidsMap: GuidsMap): void;

    /** experimental, called when the script is registered for the first time, this is called even if the component is not enabled. */
    registering?();
    awake();
    onEnable();
    onDisable();
    onDestroy();
    destroy();

    /** called for properties decorated with the @validate decorator */
    onValidate?(property?: string);
    /** called when this.context.isPaused changes or when rendering loop changes due to changing DOM element visibility
     * e.g. when the DOM element becomes hidden or out ot view
     */
    onPausedChanged?(isPaused: boolean, wasPaused: boolean);

    start?(): void;
    earlyUpdate?(): void;
    update?(): void;
    lateUpdate?(): void;
    onBeforeRender?(frame: XRFrame | null): void;
    onAfterRender?(): void;

    onCollisionEnter?(col: Collision);
    onCollisionExit?(col: Collision);
    onCollisionStay?(col: Collision);

    onTriggerEnter?(col: ICollider);
    onTriggerStay?(col: ICollider);
    onTriggerExit?(col: ICollider);

    get forward(): Vector3;
    get worldPosition(): Vector3;
    get worldQuaternion(): Quaternion;
}


export declare interface ICamera extends IComponent {
    get isCamera(): boolean;
    applyClearFlagsIfIsActiveCamera(): unknown;
    buildCamera();
    get cam(): Camera;
    nearClipPlane: number;
    farClipPlane: number;
    backgroundColor: RGBAColor | null;
    backgroundBlurriness: number | undefined;
    clearFlags: number;
    aspect: number;
    fieldOfView?: number;
    screenPointToRay(x: number, y: number, ray?: Ray): Ray;
}

export declare interface ILight extends IComponent {
    intensity: number;
    color: Color;
}

export declare interface ISharedMaterials {
    [num: number]: Material;
    get length(): number;
}

export declare interface IRenderer extends IComponent {
    sharedMaterial: Material;
    get sharedMaterials(): ISharedMaterials;
}

// export declare interface IPhysicsComponent extends IComponent {
//     get type() : string;
// }

export declare interface ICollider extends IComponent {
    get isCollider();
    attachedRigidbody: IRigidbody | null;
    isTrigger: boolean;
    sharedMaterial?: PhysicsMaterial;
}

export declare interface IRigidbody extends IComponent {
    constraints: RigidbodyConstraints;
    isKinematic: boolean;
    mass: number;
    drag: number;
    angularDrag: number;
    useGravity: boolean;
    gravityScale: number;
    collisionDetectionMode: CollisionDetectionMode;

    lockPositionX: boolean;
    lockPositionY: boolean;
    lockPositionZ: boolean;
    lockRotationX: boolean;
    lockRotationY: boolean;
    lockRotationZ: boolean;
}


export const $physicsKey = Symbol("object");


export declare type ICollisionContext = {
    getCollider(obj: Object3D): ICollider;
}


export type Vec2 = {
    x: number,
    y: number
}

export type Vec3 = {
    x: number,
    y: number,
    z: number,
}

export type Vec4 = {
    x: number,
    y: number,
    z: number,
    w: number,
}

const contactsVectorBuffer = new CircularBuffer(() => new Vector3(), 20);

export class ContactPoint {

    private readonly _point: Vec3;
    private readonly _normal: Vec3;

    readonly distance: number;
    readonly impulse: number;
    readonly friction: number;

    /** worldspace point */
    get point() {
        const target = contactsVectorBuffer.get();
        return target.set(this._point.x, this._point.y, this._point.z);
    }

    /** worldspace normal */
    get normal() {
        const target = contactsVectorBuffer.get();
        return target.set(this._normal.x, this._normal.y, this._normal.z);
    }

    constructor(point: Vec3, dist: number, normal: Vec3, impulse: number, friction: number) {
        this._point = point;
        this.distance = dist;
        this._normal = normal;
        this.impulse = impulse;
        this.friction = friction;
    }
}

/// all info in here must be readonly because the object is only created once per started collision
export class Collision {
    readonly contacts: ContactPoint[];

    constructor(obj: Object3D, otherCollider: ICollider, contacts: ContactPoint[]) {
        this.me = obj;
        this._collider = otherCollider;
        this._gameObject = otherCollider.gameObject;
        this.contacts = contacts;
    }

    readonly me: Object3D;
    private _collider: ICollider;

    /** the collider the collision happened with */
    get collider(): ICollider {
        return this._collider;
    }

    /** the object the collision happened with */
    private _gameObject: Object3D;
    get gameObject(): Object3D {
        return this._gameObject;
    }

    /** the rigidbody we hit, null if none attached */
    get rigidBody(): IRigidbody | null {
        return this.collider?.attachedRigidbody;
    }



    // private _normal?: Vector3;
    // get normal(): Vector3 {
    //     if (!this._normal) {
    //         const vec = this.collision.contact.ni;
    //         this._normal = new Vector3(vec.x, vec.y, vec.z);
    //     }
    //     return this._normal;
    // }


    // private _point?: Vector3;
    // get point(): Vector3 {
    //     if (!this._point) {
    //         const c = this.collision.contact;
    //         const point = c.bi.position.clone().vadd(c.ri);
    //         this._point = new Vector3(point.x, point.y, point.z);
    //     }
    //     return this._point;
    // }
}