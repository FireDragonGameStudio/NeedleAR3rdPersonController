import * as THREE from "three";
import { Mathf } from "../engine/engine_math";
import * as threeutils from "../engine/engine_three_utils";
import { activeInHierarchyFieldName } from "../engine/engine_constants";
import { Context, FrameEvent } from "../engine/engine_setup";
import * as main from "../engine/engine_mainloop_utils";
import { Object3D } from "three";
import { syncDestroy, syncInstantiate } from "../engine/engine_networking_instantiate";
import { ConstructorConcrete, SourceIdentifier, IComponent, IGameObject, Constructor, GuidsMap, UIDProvider, Collision, ICollider } from "../engine/engine_types";
import { addNewComponent, destroyComponentInstance, findObjectOfType, findObjectsOfType, getComponent, getComponentInChildren, getComponentInParent, getComponents, getComponentsInChildren, getComponentsInParent, getOrAddComponent, moveComponentInstance, removeComponent } from "../engine/engine_components";
import { findByGuid, destroy, InstantiateOptions, instantiate, HideFlags, foreachComponent, markAsInstancedRendered, isActiveInHierarchy, isActiveSelf, isUsingInstancing, setActive, isDestroyed } from "../engine/engine_gameobject";


// export interface ISerializationCallbackReceiver {
//     onBeforeSerialize?(): object | void;
//     onAfterSerialize?();
//     onBeforeDeserialize?(data?: any);
//     onAfterDeserialize?();
//     onDeserialize?(key: string, value: any): any | void;
// }

abstract class GameObject extends THREE.Object3D implements THREE.Object3D, IGameObject {

    guid: string | undefined;

    public static isDestroyed(go: THREE.Object3D): boolean {
        return isDestroyed(go);
    }

    public static setActive(go: THREE.Object3D, active: boolean, processStart: boolean = true, setVisible: boolean = true) {
        if (!go) return;
        setActive(go, active, setVisible);
        main.updateIsActive(go);
        if (active && processStart)
            main.processStart(Context.Current, go);
    }

    public static isActiveSelf(go: THREE.Object3D): boolean {
        return isActiveSelf(go);
    }

    public static isActiveInHierarchy(go: THREE.Object3D): boolean {
        return isActiveInHierarchy(go);
    }

    public static markAsInstancedRendered(go: THREE.Object3D, instanced: boolean) {
        markAsInstancedRendered(go, instanced);
    }

    public static isUsingInstancing(instance: THREE.Object3D): boolean { return isUsingInstancing(instance); }

    public static foreachComponent(instance: THREE.Object3D, cb: (comp: Component) => any, recursive: boolean = true): any {
        return foreachComponent(instance, cb as (comp: IComponent) => any, recursive);
    }

    public static instantiateSynced(instance: GameObject | Object3D | null, opts: InstantiateOptions): GameObject | null {
        if (!instance) return null;
        return syncInstantiate(instance as any, opts) as GameObject | null;
    }

    public static instantiate(instance: GameObject | Object3D | null, opts: InstantiateOptions | null = null): GameObject | null {
        return instantiate(instance, opts) as GameObject | null;
    }

    public static destroySynced(instance: THREE.Object3D | Component, context?: Context, recursive: boolean = true) {
        if (!instance) return;
        const go = instance as GameObject;
        context = context ?? Context.Current;
        syncDestroy(go as any, context.connection, recursive);
    }

    public static destroy(instance: THREE.Object3D | Component, recursive: boolean = true, isRoot: boolean = true) {
        return destroy(instance, recursive, isRoot);
    }

    /**
     * Add an object to parent and also ensure all components are being registered
     */
    public static add(instance: THREE.Object3D | null | undefined, parent: THREE.Object3D, context?: Context) {
        if (!instance || !parent) return;
        if (instance === parent) {
            console.warn("Can not add object to self", instance);
            return;
        }
        if (!context) {
            context = Context.Current;
        }
        parent.add(instance);
        setActive(instance, true);
        main.updateIsActive(instance);
        if (context) {
            GameObject.foreachComponent(instance, (comp: Component) => {
                main.addScriptToArrays(comp, context!);
                if(comp.__internalDidAwakeAndStart) return;
                if (context!.new_script_start.includes(comp) === false) {
                    context!.new_script_start.push(comp as Behaviour);
                }
            }, true);
        }
        else {
            console.warn("Missing context");
        }
    }

    /**
     * Removes the object from its parent and deactivates all of its components
     */
    public static remove(instance: THREE.Object3D | null | undefined) {
        if (!instance) return;
        instance.parent?.remove(instance);
        setActive(instance, false);
        main.updateIsActive(instance);
        GameObject.foreachComponent(instance, (comp) => {
            main.processRemoveFromScene(comp);
        }, true);
    }

    public static invokeOnChildren(go: THREE.Object3D | null | undefined, functionName: string, ...args: any) {
        this.invoke(go, functionName, true, args);
    }

    public static invoke(go: THREE.Object3D | null | undefined, functionName: string, children: boolean = false, ...args: any) {
        if (!go) return;

        // console.log(go);
        this.foreachComponent(go, c => {
            const fn = c[functionName];
            if (fn && typeof fn === "function") {
                const bound = fn.bind(c);
                // console.log(c, bound)
                bound(...args)
            }
        }, children);
    }

    public static addNewComponent<T>(go: GameObject | THREE.Object3D, type: ConstructorConcrete<T>, callAwake: boolean = true): T {
        const instance = new type();
        //@ts-ignore
        addNewComponent(go, instance, callAwake);
        return instance
    }

    public static addComponent(go: GameObject, instance: Component): void {
        if (instance.gameObject == null) {
            throw new Error("Did you mean to create a new component? Use addNewComponent");
        }
        moveComponentInstance(go, instance as any);
    }

    public static removeComponent(instance: Component): Component {
        removeComponent(instance.gameObject, instance as any);
        return instance;
    }

    public static getOrAddComponent<T>(go: GameObject | THREE.Object3D, typeName: ConstructorConcrete<T>): T {
        return getOrAddComponent<any>(go, typeName);
    }

    public static getComponent<T>(go: GameObject | THREE.Object3D | null, typeName: Constructor<T> | null): T | null {
        if (go === null) return null;
        // if names are minified we could also use the type store and work with strings everywhere
        // not ideal, but I dont know a good/sane way to do this otherwise
        // const res = TypeStore.get(typeName);
        // if(res) typeName = res;
        return getComponent(go, typeName as any);
    }

    public static getComponents<T>(go: GameObject | THREE.Object3D | null, typeName: Constructor<T>, arr: T[] | null = null): T[] {
        if (go === null) return arr ?? [];
        return getComponents(go, typeName, arr);
    }

    public static findByGuid(guid: string, hierarchy: THREE.Object3D): GameObject | Component | null | undefined {
        const res = findByGuid(guid, hierarchy);
        return res as GameObject | Component | null | undefined;
    }

    public static findObjectOfType<T>(typeName: Constructor<T>, context?: Context | THREE.Object3D, includeInactive: boolean = true): T | null {
        return findObjectOfType(typeName, context ?? Context.Current, includeInactive);
    }

    public static findObjectsOfType<T>(typeName: Constructor<T>, context?: Context | THREE.Object3D): Array<T> {
        const arr = [];
        findObjectsOfType(typeName, arr, context);
        return arr;
    }

    public static getComponentInChildren<T>(go: GameObject | THREE.Object3D, typeName: Constructor<T>): T | null {
        return getComponentInChildren(go, typeName);
    }

    public static getComponentsInChildren<T>(go: GameObject | THREE.Object3D, typeName: Constructor<T>, arr: T[] | null = null): Array<T> {
        return getComponentsInChildren<T>(go, typeName, arr ?? undefined) as T[]
    }

    public static getComponentInParent<T>(go: GameObject | THREE.Object3D, typeName: Constructor<T>): T | null {
        return getComponentInParent(go, typeName);
    }

    public static getComponentsInParent<T>(go: GameObject | THREE.Object3D, typeName: Constructor<T>, arr: Array<T> | null = null): Array<T> {
        return getComponentsInParent(go, typeName, arr);
    }

    public static getAllComponents(go: GameObject | THREE.Object3D): Behaviour[] {
        const componentsList = go.userData?.components;
        const newList = [...componentsList];
        return newList;
    }

    public static *iterateComponents(go: GameObject | THREE.Object3D) {
        const list = go?.userData?.components;
        if (list && Array.isArray(list)) {
            for (let i = 0; i < list.length; i++) {
                yield list[i];
            }
        }
    }

    // these are implemented via threejs object extensions
    abstract activeSelf: boolean;
    abstract addNewComponent<T>(type: Constructor<T>): T | null;
    abstract removeComponent(comp: Component): Component;
    abstract getOrAddComponent<T>(typeName: Constructor<T> | null): T;
    abstract getComponent<T>(type: Constructor<T>): T | null;
    abstract getComponents<T>(type: Constructor<T>, arr?: T[]): Array<T>;
    abstract getComponentInChildren<T>(type: Constructor<T>): T | null;
    abstract getComponentsInChildren<T>(type: Constructor<T>, arr?: T[]): Array<T>;
    abstract getComponentInParent<T>(type: Constructor<T>): T | null;
    abstract getComponentsInParent<T>(type: Constructor<T>, arr?: T[]): Array<T>;
}



class Component implements IComponent, EventTarget {

    get isComponent(): boolean { return true; }

    private __context: Context | undefined;
    get context(): Context {
        return this.__context ?? Context.Current;
    }
    set context(context: Context) {
        this.__context = context;
    }
    get scene(): THREE.Scene { return this.context.scene; }

    get layer(): number {
        return this.gameObject?.userData?.layer;
    }

    get name(): string {
        return this.gameObject?.userData.name;
    }
    private __name?: string;
    set name(str: string) {
        if (this.gameObject) {
            if (!this.gameObject.userData) this.gameObject.userData = {}
            this.gameObject.userData.name = str;
            this.__name = str;
        }
        else {
            this.__name = str;
        }
    }
    get tag(): string {
        return this.gameObject?.userData.tag;
    }
    set tag(str: string) {
        if (this.gameObject)
            this.gameObject.userData.tag = str;
    }
    get static() {
        return this.gameObject?.userData.static;
    }
    get hideFlags(): HideFlags {
        return this.gameObject?.userData.hideFlags;
    }


    get activeAndEnabled(): boolean {
        if (this.destroyed) return false;
        if (this.__isEnabled === false) return false;
        if (!this.__isActiveInHierarchy) return false;
        // let go = this.gameObject;
        // do {
        //     // console.log(go.name, go.visible)
        //     if (!go.visible) return false;
        //     go = go.parent as GameObject;
        // }
        // while (go);
        return true;
    }

    private get __isActive(): boolean {
        return this.gameObject.visible;
    }
    private get __isActiveInHierarchy(): boolean {
        if (!this.gameObject) return false;
        const res = this.gameObject[activeInHierarchyFieldName];
        if (res === undefined) return true;
        return res;
    }

    private set __isActiveInHierarchy(val: boolean) {
        if (!this.gameObject) return;
        this.gameObject[activeInHierarchyFieldName] = val;
    }

    gameObject!: GameObject;
    guid: string = "invalid";
    sourceId?: SourceIdentifier;
    // transform: THREE.Object3D = nullObject;

    /** called on a component with a map of old to new guids (e.g. when instantiate generated new guids and e.g. timeline track bindings needs to remape them) */
    resolveGuids?(guidsMap: GuidsMap): void;

    /** called once when the component becomes active for the first time */
    awake() { }
    /** called every time when the component gets enabled (this is invoked after awake and before start) */
    onEnable() { }
    onDisable() { }
    onDestroy() {
        this.__destroyed = true;
    }
    /** called when you decorate fields with the @validate() decorator
     * @param field the name of the field that was changed
     */
    onValidate?(prop?: string): void;
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

    startCoroutine(routine: Generator, evt: FrameEvent = FrameEvent.Update): Generator {
        return this.context.registerCoroutineUpdate(this, routine, evt);
    }

    stopCoroutine(routine: Generator, evt: FrameEvent = FrameEvent.Update): void {
        this.context.unregisterCoroutineUpdate(routine, evt);
    }

    public get destroyed(): boolean {
        return this.__destroyed;
    }

    public destroy() {
        if (this.__destroyed) return;
        this.__internalDestroy();
    }

    
    
    /** @internal */
    protected __didAwake: boolean = false;
    
    /** @internal */
    private __didStart: boolean = false;
    
    /** @internal */
    protected __didEnable: boolean = false;
    
    /** @internal */
    protected __isEnabled: boolean | undefined = undefined;
    
    /** @internal */
    private __destroyed: boolean = false;
    
    /** @internal */
    get __internalDidAwakeAndStart() { return this.__didAwake && this.__didStart; }

    
    /** @internal */
    constructor() {
        // super();
        this.__internalNewInstanceCreated();
    }

    
    /** @internal */
    __internalNewInstanceCreated() {
        this.__didAwake = false;
        this.__didStart = false;
        this.__didEnable = false;
        this.__isEnabled = undefined;
        this.__destroyed = false;
        // this.__internalResetsCachedPhysicsData();
    }

    
    /** @internal */
    __internalAwake() {
        if (this.__didAwake) return;
        // console.log("__internalAwake");
        this.__didAwake = true;
        // this.gameObject.test();

        this.awake();
    }

    
    /** @internal */
    __internalStart() {
        if (this.__didStart) return;
        this.__didStart = true;
        if (this.start) this.start();
    }

    
    /** @internal */
    __internalEnable(): boolean {
        if (this.__didEnable) return false;
        // console.trace("INTERNAL ENABLE");
        this.__didEnable = true;
        this.onEnable();
        // if we do this after processing the callback
        this.__isEnabled = true;
        return true;
    }

    /** @internal */
    __internalDisable() {
        if (!this.__didEnable) return;
        this.__didEnable = false;
        // this._collisionExitRoutine = undefined;
        this.onDisable();
        // this._collisions?.clear();
        // if we do this after processing the callback
        this.__isEnabled = false;
    }

    /** @internal */
    __internalDestroy() {
        if (this.__destroyed) return;
        this.__destroyed = true;
        this.destroy?.call(this);
        // console.log("destroy", this);
        destroyComponentInstance(this as any);
    }

    // isActiveAndEnabled: boolean = false;

    get enabled(): boolean {
        return this.__isEnabled ?? true; // if it has no enabled field it is always enabled
    }
    set enabled(val: boolean) {
        // when called from animationclip we receive numbers
        // due to interpolation they can be anything between 0 and 1
        if (typeof val === "number") {
            if (val >= 0.5) val = true;
            else val = false;
        }

        // need to check here because codegen is calling this before everything is setup
        if (!this.__didAwake) {
            this.__isEnabled = val;
            return;
        }
        if (val) {
            this.__internalEnable();
        } else {
            this.__internalDisable();
        }
    }

    // TODO move this to threeutils
    // we need a copy for modifying the values to local space
    private static _worldPositionBuffer: THREE.Vector3 = new THREE.Vector3();
    private static _worldQuaternionBuffer: THREE.Quaternion = new THREE.Quaternion();
    private static _worldEulerBuffer: THREE.Euler = new THREE.Euler();

    private _worldPosition: THREE.Vector3 | undefined = undefined;
    private _worldQuaternion: THREE.Quaternion | undefined = undefined;
    private static _tempQuaternionBuffer2: THREE.Quaternion = new THREE.Quaternion();
    private _worldEuler: THREE.Euler | undefined = undefined;
    private _worldRotation: THREE.Vector3 | undefined = undefined;

    get worldPosition(): THREE.Vector3 {
        if (!this._worldPosition) this._worldPosition = new THREE.Vector3();
        threeutils.getWorldPosition(this.gameObject, this._worldPosition);
        // this.gameObject.getWorldPosition(this._worldPosition);
        return this._worldPosition;
    }

    set worldPosition(val: THREE.Vector3) {
        threeutils.setWorldPosition(this.gameObject, val);
    }

    setWorldPosition(x: number, y: number, z: number) {
        Component._worldPositionBuffer.set(x, y, z);
        this.worldPosition = Component._worldPositionBuffer;
    }


    get worldQuaternion(): THREE.Quaternion {
        if (!this._worldQuaternion) this._worldQuaternion = new THREE.Quaternion();
        return threeutils.getWorldQuaternion(this.gameObject, this._worldQuaternion);
    }
    set worldQuaternion(val: THREE.Quaternion) {
        threeutils.setWorldQuaternion(this.gameObject, val);
    }
    setWorldQuaternion(x: number, y: number, z: number, w: number) {
        Component._worldQuaternionBuffer.set(x, y, z, w);
        this.worldQuaternion = Component._worldQuaternionBuffer;
    }


    // world euler (in radians)
    get worldEuler(): THREE.Euler {
        if (!this._worldEuler) this._worldEuler = new THREE.Euler();
        this._worldEuler.setFromQuaternion(this.worldQuaternion);
        return this._worldEuler;
    }

    // world euler (in radians)
    set worldEuler(val: THREE.Euler) {
        if (!this._worldQuaternion) this._worldQuaternion = new THREE.Quaternion();
        this._worldQuaternion?.setFromEuler(val);
        this.worldQuaternion = this._worldQuaternion;
    }

    // returns rotation in degrees
    get worldRotation(): THREE.Vector3 {
        const rot = this.worldEuler;
        if (!this._worldRotation) this._worldRotation = new THREE.Vector3();
        const wr = this._worldRotation;
        wr.set(rot.x, rot.y, rot.z);
        wr.x = Mathf.toDegrees(wr.x);
        wr.y = Mathf.toDegrees(wr.y);
        wr.z = Mathf.toDegrees(wr.z);
        return wr;
    }

    set worldRotation(val: THREE.Vector3) {
        this.setWorldRotation(val.x, val.y, val.z, true);
    }

    setWorldRotation(x: number, y: number, z: number, degrees: boolean = true) {
        if (degrees) {
            x = Mathf.toRadians(x);
            y = Mathf.toRadians(y);
            z = Mathf.toRadians(z);
        }
        Component._worldEulerBuffer.set(x, y, z);
        Component._worldQuaternionBuffer.setFromEuler(Component._worldEulerBuffer);
        this.worldQuaternion = Component._worldQuaternionBuffer;
    }

    private static _forward: THREE.Vector3 = new THREE.Vector3();
    public get forward(): THREE.Vector3 {
        return Component._forward.set(0, 0, -1).applyQuaternion(this.worldQuaternion);
    }



    // EventTarget implementation:

    private _eventListeners = new Map<string, EventListener[]>();

    addEventListener<T extends Event>(type: string, listener: (evt: T) => any) {
        this._eventListeners[type] = this._eventListeners[type] || [];
        this._eventListeners[type].push(listener);
    }

    removeEventListener<T extends Event>(type: string, listener: (arg: T) => any) {
        if (!this._eventListeners[type]) return;
        const index = this._eventListeners[type].indexOf(listener);
        if (index >= 0) this._eventListeners[type].splice(index, 1);
    }

    dispatchEvent(evt: Event): boolean {
        if (!this._eventListeners[evt.type]) return false;
        const listeners = this._eventListeners[evt.type];
        for (let i = 0; i < listeners.length; i++) {
            listeners[i](evt);
        }

        return false;
    }

}

class Behaviour extends Component {
}

export { Behaviour, Component, GameObject };