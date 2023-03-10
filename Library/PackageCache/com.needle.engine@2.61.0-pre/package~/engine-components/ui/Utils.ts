
import { FrontSide, DoubleSide, BackSide, TetrahedronGeometry } from "three"
import { FrameEvent } from "../../engine/engine_setup";
import { Behaviour } from "../Component";
import { $shadowDomOwner, BaseUIComponent } from "./BaseUIComponent";

export function tryGetUIComponent(obj: THREE.Object3D): BaseUIComponent | null {
    const owner = obj[$shadowDomOwner];
    if (owner) {
        return owner;
    }
    if(obj.parent) {
        return tryGetUIComponent(obj.parent);
    }
    return null;
}

export function isUIObject(obj: THREE.Object3D) {
    return obj["isUI"] === true || typeof obj[$shadowDomOwner] === "object";
}

export type RenderSettings = {
    renderOnTop?: boolean;
    doubleSided?: boolean;
    depthWrite?: boolean;
    castShadows?: boolean;
    receiveShadows?: boolean;
}

export function updateRenderSettings(shadowComponent: THREE.Object3D, settings: RenderSettings) {
    if (!shadowComponent) return;
    // const owner = shadowComponent[$shadowDomOwner];
    // if (!owner)
    //     console.log(shadowComponent)
    const mat = shadowComponent["material"];
    if (mat?.isMaterial === true) {
        // console.log(shadowComponent, shadowComponent.name);
        // console.log(mat, component.renderOnTop, component.doubleSided, component.depthWrite);
        mat.depthTest = !settings.renderOnTop ?? true;
        mat.side = (settings.doubleSided ?? true) ? DoubleSide : FrontSide;
        mat.depthWrite = settings.depthWrite ?? false;
        mat.shadowSide = settings.doubleSided ? DoubleSide : FrontSide;
        shadowComponent.castShadow = settings.castShadows ? settings.castShadows : false;
        shadowComponent.receiveShadow = settings.receiveShadows ? settings.receiveShadows : false;
    }
    for (const ch of shadowComponent.children) {
        updateRenderSettings(ch, settings);
    }
}

export declare type RevocableProxy = {
    proxy: any;
    revoke: () => void;
}

// TODO: change to use utils Watch since a revocable proxy makes a object completely useless once it is revoked
/** internal method to proxy a field to detect changes */
/**@deprecated use watcher instead */
export function onChange<T extends object>(caller: T, field: string, callback: (newValue: any, oldValue: any) => void): RevocableProxy {

    if (caller[field] === undefined) {
        console.warn("Field", field, "is undefined on", caller);
    }
    // create proxy that notifies on value change
    const res = Proxy.revocable(caller[field], {
        // get(target, prop, receiver) {
        //     return Reflect.get(target, prop, receiver);
        // },
        set(target, prop, value, receiver) {
            const currentValue = target[prop];
            const res = Reflect.set(target, prop, value, receiver);
            callback(value, currentValue);
            return res;
        }
    });
    // setup revokeable
    const revoke = res.revoke;
    const original = caller[field];
    res.revoke = () => {
        caller[field] = original;
        revoke();
    };
    caller[field] = res.proxy;
    return res;
}


declare type ScheduleCache = { [key: number]: { [key: string]: Generator | null } };
const $scheduledActionKey = Symbol("Scheduled action");

// use to schedule a callback at a specific moment in the frame
/** internal method to schedule a function at a specific moment in the update loop */
export function scheduleAction(caller: Behaviour, action: Function, timing: FrameEvent = FrameEvent.OnBeforeRender) {
    let cache: ScheduleCache = caller[$scheduledActionKey];
    if (!cache) cache = caller[$scheduledActionKey] = {};

    const key = action.name;
    if (!cache[timing]) cache[timing] = {};
    const actions = cache[timing];
    const existing = actions[key];
    if (existing) return;
    function* gen() {
        // yield;
        action?.call(caller);
        actions[key] = null;
    }
    const coroutine = caller.startCoroutine(gen(), timing);
    actions[key] = coroutine;
}