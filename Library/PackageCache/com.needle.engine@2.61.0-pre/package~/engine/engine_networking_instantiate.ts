// import { IModel, NetworkConnection } from "./engine_networking"
import * as THREE from "three";
import { Context } from "./engine_setup"
import * as utils from "./engine_utils"
import { INetworkConnection } from "./engine_networking_types";
import { IGameObject as GameObject, IComponent as Component } from "./engine_types"

// https://github.com/uuidjs/uuid
// v5 takes string and namespace
import { v5, v1 } from 'uuid';
import { UIDProvider } from "./engine_types";
import { IModel } from "./engine_networking_types";
import { SendQueue } from "./engine_networking_types";
import { destroy, findByGuid, instantiate } from "./engine_gameobject";
import { Object3D } from "three";
import { InstantiateOptions } from "./engine_gameobject";
import { ContextEvent, ContextRegistry } from "../engine/engine_context_registry";



ContextRegistry.registerCallback(ContextEvent.ContextCreated, evt => {
    const context = evt.context as Context;
    beginListenInstantiate(context);
    beginListenDestroy(context);
});



const debug = utils.getParam("debugcomponents");


const ID_NAMESPACE = 'eff8ba80-635d-11ec-90d6-0242ac120003';

export class InstantiateIdProvider implements UIDProvider {

    get seed() {
        return this._seed;
    }

    set seed(val: number) {
        this._seed = val;
    }

    private _originalSeed: number;
    private _seed: number;

    constructor(seed: string | number) {
        if (typeof seed === "string") {
            seed = InstantiateIdProvider.hash(seed);
        }
        this._originalSeed = seed;
        this._seed = seed;
    }

    reset() {
        this._seed = this._originalSeed;
    }

    generateUUID(str?: string) {
        if (typeof str === "string") {
            return v5(str, ID_NAMESPACE);
        }
        const s = this._seed;
        this._seed -= 1;
        // console.log(s);
        return v5(s.toString(), ID_NAMESPACE);
    }

    initialize(strOrNumber: string | number) {
        if (typeof strOrNumber === "string") {
            this._seed = InstantiateIdProvider.hash(strOrNumber);
        }
        else {
            this._seed = strOrNumber;
        }
    }

    static createFromString(str: string) {
        return new InstantiateIdProvider(this.hash(str));
    }

    private static hash(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return hash;
    }
}

export enum InstantiateEvent {
    NewInstanceCreated = "new-instance-created",
    InstanceDestroyed = "instance-destroyed",
}


class DestroyInstanceModel implements IModel {
    guid: string;
    constructor(guid: string) {
        this.guid = guid;
    }
}

export interface IBeforeNetworkedDestroy {
    onBeforeNetworkedDestroy(networkIds: string[]): void;
}

export function syncDestroy(obj: GameObject | Component, con: INetworkConnection, recursive: boolean = true) {
    if (!obj) return;
    const go = obj as GameObject;
    destroy(obj, recursive);

    if (!con) {
        console.warn("Can not send destroy: No networking connection provided", obj.guid);
        return;
    }

    if (!con.isConnected) {
        console.warn("Can not send destroy: not connected", obj.guid);
        return;
    }

    let guid: string | undefined | null = obj.guid;
    if (!guid && go.uuid) {
        guid = go.uuid;
    }
    if (!guid) {
        console.warn("Can not send destroy: failed to find guid", obj);
        return;
    }

    const model = new DestroyInstanceModel(guid);
    con.send(InstantiateEvent.InstanceDestroyed, model, SendQueue.Queued);
}

export function sendDestroyed(guid: string, con: INetworkConnection) {
    const model = new DestroyInstanceModel(guid);
    con.send(InstantiateEvent.InstanceDestroyed, model, SendQueue.Queued);
}

export function beginListenDestroy(context: Context) {
    context.connection.beginListen(InstantiateEvent.InstanceDestroyed, (data: DestroyInstanceModel) => {
        if (debug)
            console.log("[Remote] Destroyed", context.scene, data);
        // TODO: create global lookup table for guids
        const obj = findByGuid(data.guid, context.scene);
        if (obj) destroy(obj);
    });
}


// when a file is instantiated via some server (e.g. via file drop) we also want to send the info where the file can be downloaded
// doing it this route will ensure we have 
export class HostData {
    filename: string;
    hash: string;
    size: number;

    constructor(filename: string, hash: string, size: number) {
        this.filename = filename;
        this.hash = hash;
        this.size = size;
    }
}

class NewInstanceModel implements IModel {
    guid: string;
    originalGuid: string;
    seed: number | undefined;
    visible: boolean | undefined;
    hostData: HostData | undefined;
    dontSave?: boolean | undefined;

    parent: string | undefined;
    position: { x: number, y: number, z: number } | undefined;
    rotation: { x: number, y: number, z: number, w: number } | undefined;
    scale: { x: number, y: number, z: number } | undefined;

    constructor(originalGuid: string, newGuid: string) {
        this.originalGuid = originalGuid;
        this.guid = newGuid;
    }
}

export function syncInstantiate(object: GameObject | Object3D, opts: InstantiateOptions, hostData?: HostData, save?: boolean): GameObject | null {

    const obj: GameObject = object as GameObject;

    if (!obj.guid) {
        console.warn("Can not instantiate: No guid", obj);
        return null;
    }

    if (!opts.context) opts.context = Context.Current;

    if (!opts.context) {
        console.error("Missing network instantiate options / reference to network connection in sync instantiate");
        return null;
    }

    const originalOpts = opts ? { ...opts } : null;
    const { instance, seed } = instantiateSeeded(obj, opts);
    if (instance) {
        const go = instance as GameObject;
        // if (go.guid) {
        //     const listener = GameObject.addNewComponent(go, DestroyListener);
        //     listener.target = go;
        // }
        if (go.guid) {
            if (debug)
                console.log("[Local] new instance", "gameobject:", instance?.guid);
            const model = new NewInstanceModel(obj.guid, go.guid);
            model.seed = seed;
            if (originalOpts) {
                if (originalOpts.position)
                    model.position = { x: originalOpts.position.x, y: originalOpts.position.y, z: originalOpts.position.z };
                if (originalOpts.rotation)
                    model.rotation = { x: originalOpts.rotation.x, y: originalOpts.rotation.y, z: originalOpts.rotation.z, w: originalOpts.rotation.w };
                if (originalOpts.scale)
                    model.scale = { x: originalOpts.scale.x, y: originalOpts.scale.y, z: originalOpts.scale.z };
            }
            if (!model.position)
                model.position = { x: go.position.x, y: go.position.y, z: go.position.z };
            if (!model.rotation)
                model.rotation = { x: go.quaternion.x, y: go.quaternion.y, z: go.quaternion.z, w: go.quaternion.w };
            if (!model.scale)
                model.scale = { x: go.scale.x, y: go.scale.y, z: go.scale.z };

            model.visible = obj.visible;
            if (originalOpts?.parent) {
                if (typeof originalOpts.parent === "string")
                    model.parent = originalOpts.parent;
                else model.parent = originalOpts.parent["guid"];
            }
            // console.log(model.parent);
            model.hostData = hostData;
            if (save === false) model.dontSave = true;
            opts?.context?.connection.send(InstantiateEvent.NewInstanceCreated, model);
        }
        else console.warn("Missing guid, can not send new instance event", go);
    }
    return instance;
}

export function generateSeed(): number {
    return Math.random() * 9_999_999;// Number.MAX_VALUE;;
}

export function beginListenInstantiate(context: Context) {
    context.connection.beginListen(InstantiateEvent.NewInstanceCreated, async (model: NewInstanceModel) => {
        const obj: GameObject | null = await tryResolvePrefab(model.originalGuid, context.scene) as GameObject;
        if (!obj) {
            console.warn("could not find object that was instantiated: " + model.guid);
            return;
        }
        // console.log(model);
        const options = new InstantiateOptions();
        if (model.position)
            options.position = new THREE.Vector3(model.position.x, model.position.y, model.position.z);
        if (model.rotation)
            options.rotation = new THREE.Quaternion(model.rotation.x, model.rotation.y, model.rotation.z, model.rotation.w);
        if (model.scale)
            options.scale = new THREE.Vector3(model.scale.x, model.scale.y, model.scale.z);
        options.parent = model.parent;
        if (model.seed)
            options.idProvider = new InstantiateIdProvider(model.seed);
        options.visible = model.visible;
        options.context = context;
        if (debug && context.alias)
            console.log("[Remote] instantiate in: " + context.alias);
        const inst = instantiate(obj as GameObject, options);

        if (inst) {
            if (model.parent === "scene")
                context.scene.add(inst);
            // console.log(inst, model.parent === "scene");
            // if (inst.guid) {
            //     const listener = GameObject.addNewComponent(inst, DestroyListener);
            //     listener.target = inst;
            // }
            if (debug)
                console.log("[Remote] new instance", "gameobject:", inst?.guid, obj);
        }
    });

}

function instantiateSeeded(obj: GameObject, opts: InstantiateOptions | null): { instance: GameObject | null, seed: number } {
    const seed = generateSeed();
    const options = opts ?? new InstantiateOptions();
    options.idProvider = new InstantiateIdProvider(seed);
    const instance = instantiate(obj, options);
    return { seed: seed, instance: instance };
}

export declare type PrefabProviderCallback = (guid: string) => Promise<GameObject | null>;

const registeredPrefabProviders: { [key: string]: PrefabProviderCallback } = {};

//** e.g. provide a function that can return a instantiated object when instantiation event is received */
export function registerPrefabProvider(key: string, fn: PrefabProviderCallback) {
    registeredPrefabProviders[key] = fn;
}

async function tryResolvePrefab(guid: string, obj: THREE.Object3D): Promise<THREE.Object3D | null> {
    const prov = registeredPrefabProviders[guid];
    if (prov !== null && prov !== undefined) {
        const res = await prov(guid);
        if (res) return res;
    }
    return tryFindObjectByGuid(guid, obj) as THREE.Object3D;
}

function tryFindObjectByGuid(guid: string, obj: THREE.Object3D): THREE.Object3D | null {
    if (obj === null) return null;
    if (!guid) return null;
    if (obj["guid"] === guid) {
        return obj;
    }

    if (obj.children) {
        for (const ch of obj.children) {
            const found = tryFindObjectByGuid(guid, ch);
            if (found) {
                return found;
            }
        }
    }

    return null;
}


// class DestroyListener extends Behaviour {

//     target: GameObject | Component | null = null;

//     private destroyCallback: any;

//     awake(): void {
//         if (!this.target) {
//             console.log("Missing target to watch", this);
//             return;
//         }
//         this.destroyCallback = this.onObjectDestroyed.bind(this);
//         this.context.connection.beginListen(InstantiateEvent.InstanceDestroyed, this.destroyCallback);
//     }

//     onDestroy(): void {
//         this.context.connection.stopListening(InstantiateEvent.InstanceDestroyed, this.destroyCallback);
//         if (this.target && this.target.guid && this.gameObject.guid === this.target.guid) {
//             sendDestroyed(this.target.guid, this.context.connection);
//         }
//     }

//     private onObjectDestroyed(evt: DestroyInstanceModel) {
//         if (evt.guid === this.target?.guid) {
//             if (debug)
//                 console.log("RECEIVED destroyed event", evt.guid);
//             GameObject.destroy(this.target);
//         }
//     }
// }