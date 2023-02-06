import { Object3D, Scene } from "three";
import { Constructor, ConstructorConcrete, IComponent as Component, IComponent, IGameObject } from "./engine_types";
import { Context, registerComponent } from "./engine_setup";
import { getParam } from "./engine_utils";
import { removeScriptFromContext, updateActiveInHierarchyWithoutEventCall } from "./engine_mainloop_utils";
import { activeInHierarchyFieldName } from "./engine_constants";
import { apply } from "../engine-components/js-extensions/Object3D";

const debug = getParam("debuggetcomponent");


function tryGetObject(obj) {
    if (obj === null || obj === undefined) return obj;
    if (obj.isObject3D) return obj;
    // handle threejs intersection object
    if (obj.object && obj.object.isObject3D) return obj.object;
    return obj;
}


export function removeComponent(go: Object3D, componentInstance: IComponent) {
    if (!go) return;
    if (!go.userData.components) return;
    const index = go.userData.components.indexOf(componentInstance);
    if (index < 0) return;
    //@ts-ignore
    componentInstance.gameObject = null;
    go.userData.components.splice(index, 1);
}

export function getOrAddComponent<T extends IComponent>(go: Object3D, typeName: ConstructorConcrete<T>): T {
    const comp = getComponent(go, typeName);
    if (comp) return comp;
    const newInstance = new typeName();
    return addNewComponent(go, newInstance) as unknown as T;
}

export function addNewComponent<T extends IComponent>(obj: Object3D, componentInstance: T, callAwake = true): IComponent {
    if (!obj) {
        new Error("Can not add componet to null object");
    }
    if (!obj.userData) obj.userData = {};
    if (!obj.userData.components) obj.userData.components = [];
    obj.userData.components.push(componentInstance);
    componentInstance.gameObject = obj as IGameObject;
    apply(obj);
    // componentInstance.transform = obj;
    registerComponent(componentInstance);
    try {
        if (componentInstance.__internalAwake && callAwake) {
            updateActiveInHierarchyWithoutEventCall(obj);
            componentInstance.__internalAwake();
        }
    }
    catch (err) {
        console.error(err);
    }
    return componentInstance;
}

export function moveComponentInstance(obj: Object3D, componentInstance: IComponent) {
    if (componentInstance.gameObject === obj) return;
    // TODO: update raycast array
    if (componentInstance.gameObject && componentInstance.gameObject.userData.components) {
        const index = componentInstance.gameObject.userData.components.indexOf(componentInstance);
        componentInstance.gameObject.userData.components.splice(index, 1);
    }
    if (!obj.userData.components) obj.userData.components = [];
    else if (obj.userData.components.includes(componentInstance)) return;
    obj.userData.components.push(componentInstance);
    componentInstance.gameObject = obj as IGameObject;
    // componentInstance.transform = obj;
}


export function destroyComponentInstance(componentInstance: IComponent) {
    // console.log("destroy", componentInstance, componentInstance.onDestroy);
    // TODO: update raycast array
    if (componentInstance.gameObject && componentInstance.gameObject.userData.components) {
        const index = componentInstance.gameObject.userData.components.indexOf(componentInstance);
        componentInstance.gameObject.userData.components.splice(index, 1);
    }
    // should we call these methods frame delayed?
    if (componentInstance.__internalDisable) componentInstance.__internalDisable();
    if (componentInstance.onDestroy) componentInstance.onDestroy();
    removeScriptFromContext(componentInstance, componentInstance.context ?? Context.Current);
    componentInstance.__internalDestroy();
    //@ts-ignore
    componentInstance.gameObject = null;
    // console.log("destroyed", index, componentInstance);
}

let didWarnAboutComponentAccess: boolean = false;

function onGetComponent<T>(obj: Object3D | null | undefined, componentType: Constructor<T>, arr?: T[]) {
    if (obj === null || obj === undefined) return;
    if (!obj.isObject3D) {
        console.error("Object is not object3D");
        return;
    }
    if (!(obj?.userData?.components)) return null;
    if (typeof componentType === "string") {
        if (!didWarnAboutComponentAccess) {
            didWarnAboutComponentAccess = true;
            console.warn(`Accessing components by name is not supported.\nPlease use the component type instead. This may keep working in local development but it will fail when bundling your application.\n\nYou can import other modules your main module to get access to types\nor if you use npmdefs you can make types available globally using globalThis:\nhttps://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis`, componentType);
        }
    }
    if (debug)
        console.log("FIND", componentType);
    if (componentType === undefined || componentType === null) return;
    for (let i = 0; i < obj.userData.components.length; i++) {
        const component = obj.userData.components[i];
        if (componentType === null || component.constructor.name === componentType["name"] || component.constructor.name === componentType) {
            if (debug)
                console.log("MATCH BY NAME", component)
            if (arr) arr.push(component);
            else return component;
        }
    }
    // find in base classes
    for (let i = 0; i < obj.userData.components.length; i++) {
        const component = obj.userData.components[i];
        let parent = Object.getPrototypeOf(component.constructor);
        do {
            if (parent === componentType) {
                if (debug)
                    console.log("MATCH BY PROTOYPE", parent);
                if (arr) arr.push(component);
                else return component;
            }
            parent = Object.getPrototypeOf(parent);
        }
        while (parent);
    }
    return arr;
}

export function getComponent<T>(obj: Object3D, componentType: Constructor<T>) {
    return onGetComponent(obj, componentType);
}

export function getComponents<T>(obj: Object3D, componentType: Constructor<T>, arr?: T[] | null): T[] {
    if (!arr) arr = [];
    return onGetComponent(obj, componentType, arr);
}

export function getComponentInChildren<T>(obj: Object3D, componentType: Constructor<T>, includeInactive?: boolean) {
    const res = getComponent(obj, componentType);
    if (includeInactive === false && res?.enabled === false) return null;
    if (res) return res;
    for (let i = 0; i < obj?.children?.length; i++) {
        const res = getComponentInChildren(obj.children[i], componentType);
        if (res) return res;
    }
    return null;
}

export function getComponentsInChildren<T>(obj: Object3D, componentType: Constructor<T>, arr?: T[]) {
    if (!arr) arr = [];
    getComponents(obj, componentType, arr);
    for (let i = 0; i < obj?.children?.length; i++) {
        getComponentsInChildren(obj.children[i], componentType, arr);
    }
    return arr;
}

export function getComponentInParent<T>(obj: Object3D, componentType: Constructor<T>) {
    if (!obj) return null;
    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            const o = tryGetObject(obj[i]);
            const res = getComponentInParent(o, componentType);
            if (res) return res;
        }
        return null;
    }
    // console.log(obj);
    const res = getComponent(obj, componentType);
    if (res) return res;
    if (obj.parent)
        return getComponentInParent(obj.parent, componentType);
    return null;
}

export function getComponentsInParent<T>(obj: Object3D, componentType: Constructor<T>, arr?: T[] | null): T[] {
    if (!arr) arr = [];
    if (!obj) return arr;
    getComponents(obj, componentType, arr);
    if (obj.parent)
        return getComponentsInParent(obj.parent, componentType, arr);
    return arr;
}

export function findObjectOfType<T>(type: Constructor<T>, contextOrScene: Object3D | { scene: Scene }, includeInactive) {
    if (!type) return null;
    if (!contextOrScene) {
        contextOrScene = Context.Current;
        if (!contextOrScene) {
            console.error("Can not search object without any needle context or scene!!!");
            return null;
        }
    }

    let scene = contextOrScene as Scene;
    if (!scene.isScene) scene = (contextOrScene as { scene: Scene })?.scene;
    if (!scene) return null;

    // const scene = contextOrScene.isScene === true || contextOrScene.isObject3D === true ? contextOrScene : contextOrScene?.scene;
    for (const i in scene.children) {
        const child = scene.children[i];
        if (includeInactive === false && child[activeInHierarchyFieldName] === false) continue;
        if (child.constructor == type) return child;
        const res = getComponentInChildren(child, type);
        if (res) return res;
    }
    return null;
}

export function findObjectsOfType<T>(type: Constructor<T>, array: T[], contextOrScene): T[] {
    if (!type) return array;
    if (!contextOrScene) {
        contextOrScene = Context.Current;
        if (!contextOrScene) {
            console.error("Can not search object without any needle context or scene!!!");
            return array;
        }
    }
    const scene = contextOrScene.isScene === true || contextOrScene.isObject3D === true ? contextOrScene : contextOrScene?.scene;
    if (!scene) return array;
    for (const i in scene.children) {
        const child = scene.children[i];
        if (child.constructor == type) return child;
        getComponentsInChildren(child, type, array);
    }
    return array;
}