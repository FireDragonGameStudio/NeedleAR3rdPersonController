import { Object3D } from "three";
import { processNewScripts } from "./engine_mainloop_utils";
import { InstantiateIdProvider } from "./engine_networking_instantiate";
import { Context, registerComponent } from "./engine_setup";
import { logHierarchy, setWorldPosition, setWorldQuaternion } from "./engine_three_utils";
import { GuidsMap, IComponent as Component, IComponent, IGameObject as GameObject, UIDProvider } from "./engine_types";
import { getParam, tryFindObject } from "./engine_utils";
import { apply } from "../engine-components/js-extensions/Object3D";
import { InstancingUtil } from "./engine_instancing";
import { activeInHierarchyFieldName } from "./engine_constants";
import { assign } from "./engine_serialization_core";

const debug = getParam("debuggetcomponent");


export enum HideFlags {
    None = 0,
    HideInHierarchy = 1,
    HideInInspector = 2,
    DontSaveInEditor = 4,
    NotEditable = 8,
    DontSaveInBuild = 16, // 0x00000010
    DontUnloadUnusedAsset = 32, // 0x00000020
    DontSave = DontUnloadUnusedAsset | DontSaveInBuild | DontSaveInEditor, // 0x00000034
    HideAndDontSave = DontSave | NotEditable | HideInHierarchy, // 0x0000003D
}


export class InstantiateOptions {
    idProvider?: UIDProvider | undefined;

    //** parent guid */
    parent?: string | undefined | Object3D;
    /** for duplicatable parenting */
    keepWorldPosition?: boolean
    position?: THREE.Vector3 | undefined;
    rotation?: THREE.Quaternion | undefined;
    scale?: THREE.Vector3 | undefined;

    visible?: boolean | undefined;

    context?: Context | undefined;
}


// export function setActive(go: Object3D, active: boolean, processStart: boolean = true) {
//     if (!go) return;
//     go.visible = active;
//     main.updateActiveInHierarchyWithoutEventCall(go);
//     if (active && processStart)
//         main.processStart(Context.Current, go);
// }


const $isActive = Symbol("isActive");
export function isActiveSelf(go: Object3D): boolean {
    const visible = go.visible || isUsingInstancing(go);
    if (go[$isActive] === undefined) {
        // initialize object to active so if someone's object start invisible and is set to visible = true
        // it should activate the components
        go[$isActive] = true;
    }
    return go[$isActive] && visible;
}

export function setActive(go: Object3D, active: boolean | number, setVisible = true): boolean {
    if (typeof active === "number") active = active > .5;
    go[$isActive] = active;
    if (setVisible) go.visible = active;
    return go[$isActive];
}

export function isActiveInHierarchy(go: Object3D): boolean {
    return go[activeInHierarchyFieldName] || isUsingInstancing(go);
}

export function markAsInstancedRendered(go: THREE.Object3D, instanced: boolean) {
    go["__isUsingInstancing"] = instanced;
}

export function isUsingInstancing(instance: THREE.Object3D): boolean { return InstancingUtil.isUsingInstancing(instance); }


export function findByGuid(guid: string, hierarchy: THREE.Object3D): GameObject | IComponent | null | undefined {
    return tryFindObject(guid, hierarchy, true, true);
}


const $isDestroyed = Symbol("isDestroyed");
export function isDestroyed(go: Object3D): boolean {
    return go[$isDestroyed];
}
export function setDestroyed(go: Object3D, value: boolean) {
    go[$isDestroyed] = value;
}

export function destroy(instance: Object3D | Component, recursive: boolean = true, dispose: boolean = false) {
    internalDestroy(instance, recursive, dispose, true);
}

function internalDestroy(instance: Object3D | Component, recursive: boolean = true, dispose: boolean = false, isRoot: boolean = true) {
    const comp = instance as Component;
    if (comp.isComponent) {
        comp.__internalDisable();
        comp.__internalDestroy();
        return;
    }


    const obj = instance as GameObject;
    if (dispose) disposeObject(obj);
    setDestroyed(obj, true);


    if (debug) console.log(obj);

    if (recursive && obj.children) {
        for (const ch of obj.children) {
            internalDestroy(ch, recursive, false, false);
        }
    }

    const components = obj.userData.components;
    if (components) {
        let lastLength = components.length;
        for (let i = 0; i < components.length; i++) {
            const comp: Component = components[i];
            comp.__internalDisable();
            comp.__internalDestroy();
            // if (comp.destroy) {
            //     if (debug) console.log("destroying", comp);
            //     comp.destroy();
            // }
            // components will  be removed from componentlist in destroy
            if (components.length < lastLength) {
                lastLength = components.length;
                i--;
            }
        }
    }
    if (isRoot)
        obj.removeFromParent();
}

function disposeObject(obj: Object3D) {
    if (!obj) return;
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
        mesh.geometry.dispose();
    }
    if (mesh.material) {
        if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => m.dispose());
        } else {
            mesh.material.dispose();
        }
    }
}

export function foreachComponent(instance: THREE.Object3D, cb: (comp: Component) => any, recursive: boolean = true): any {
    if (!instance) return;
    if (!instance.isObject3D) {
        new Error("Expected Object3D but got " + instance);
    }
    if (instance.userData?.components) {
        for (let i = 0; i < instance.userData.components.length; i++) {
            const comp = instance.userData.components[i];
            if (comp?.isComponent === true) {
                const res = cb(comp);
                if (res !== undefined) return res;
            }
        }
    }

    if (recursive && instance.children) {
        for (let i = 0; i < instance.children.length; i++) {
            const child = instance.children[i];
            if (!child) continue;
            const res = foreachComponent(child, cb, recursive);
            if (res !== undefined) return res;
        }
    }
}


declare class NewGameObjectReferenceInfo {
    original: THREE.Object3D;
    clone: THREE.Object3D;
}

export function instantiate(instance: GameObject | Object3D | null, opts: InstantiateOptions | null = null): GameObject | null {
    if (instance === null) return null;

    let options: InstantiateOptions | null = null;
    if (opts !== null) {
        // if x is defined assume this is a vec3 - this is just to not break everything at once and stay a little bit backwards compatible
        if (opts["x"] !== undefined) {
            options = new InstantiateOptions();
            options.position = opts as unknown as THREE.Vector3;
        }
        else {
            // if (opts instanceof InstantiateOptions)
            options = opts as InstantiateOptions;
            // else {
            //     options = new InstantiateOptions();
            //     Object.assign(options, opts);
            // }
        }
    }

    let context = Context.Current;
    if (options?.context) context = options.context;
    if (debug && context.alias)
        console.log("context", context.alias);

    // we need to create the id provider before calling internal instantiate because cloned gameobjects also create new guids
    if (options && !options.idProvider) {
        options.idProvider = new InstantiateIdProvider(Date.now());
    }

    const components: Array<Component> = [];
    const goMapping: { [key: string]: NewGameObjectReferenceInfo } = {}; // used to resolve references on components to components on other gameobjects to their new counterpart
    const skinnedMeshes: { [key: string]: NewGameObjectReferenceInfo } = {};
    const clone = internalInstantiate(context, instance, options, components, goMapping, skinnedMeshes);

    if (clone) {
        resolveReferences(goMapping);
        resolveAndBindSkinnedMeshBones(skinnedMeshes, goMapping);
    }

    if (debug) {
        logHierarchy(instance, true);
        logHierarchy(clone, true);
    }

    const guidsMap: GuidsMap = {};
    for (const i in components) {
        const copy = components[i];
        const oldGuid = copy.guid;
        if (options && options.idProvider) {
            copy.guid = options.idProvider.generateUUID();
            guidsMap[oldGuid] = copy.guid;
            if (debug)
                console.log(copy.name, copy.guid)
        }
        registerComponent(copy, context);
        if (copy.__internalNewInstanceCreated)
            copy.__internalNewInstanceCreated();
    }
    for (const i in components) {
        const copy = components[i];
        if (copy.resolveGuids)
            copy.resolveGuids(guidsMap);
        if (copy.enabled === false) continue;
        else copy.enabled = true;
    }

    processNewScripts(context);

    return clone as GameObject;
}


function internalInstantiate(
    context: Context, instance: GameObject | THREE.Object3D, opts: InstantiateOptions | null,
    componentsList: Array<Component>,
    newGameObjectsMap: { [key: string]: NewGameObjectReferenceInfo },
    skinnedMeshesMap: { [key: string]: NewGameObjectReferenceInfo }
)
    : GameObject | THREE.Object3D | null {
    if (!instance) return null;
    // prepare, remove things that dont work out of the box
    // e.g. user data we want to manually clone
    // also children throw errors (e.g. recursive toJson with nested meshes)
    const userData = instance.userData;
    instance.userData = {};
    const children = instance.children;
    instance.children = [];
    let clone: THREE.Object3D | GameObject;
    clone = instance.clone(false);
    apply(clone);
    instance.userData = userData;
    instance.children = children;

    // make reference from old id to new object
    newGameObjectsMap[instance.uuid] = { original: instance, clone: clone };

    if (instance.type === "SkinnedMesh") {
        skinnedMeshesMap[instance.uuid] = { original: instance, clone: clone };
    }

    // DO NOT EVER RENAME BECAUSE IT BREAKS / MIGHT BREAK ANIMATIONS
    // clone.name += " (Clone)";

    if (opts?.visible !== undefined)
        clone.visible = opts.visible;

    if (opts?.idProvider) {
        clone.uuid = opts.idProvider.generateUUID();
        const cloneGo: GameObject = clone as GameObject;
        if (cloneGo) cloneGo.guid = clone.uuid;
    }

    if (instance.animations && instance.animations.length > 0) {
        clone.animations = [...instance.animations];
    }

    const parent = instance.parent;
    if (parent) {
        parent.add(clone);
    }

    // apply transform
    if (opts?.position) {
        setWorldPosition(clone, opts.position);
    }
    else clone.position.copy(instance.position);
    if (opts?.rotation) {
        setWorldQuaternion(clone, opts.rotation);
        // clone.quaternion.copy(opts.rotation);
    }
    else clone.quaternion.copy(instance.quaternion);
    if (opts?.scale) {
        // TODO: make set world scale work
        clone.scale.copy(opts.scale);
    }
    else clone.scale.copy(instance.scale);

    if (opts?.parent && opts.parent !== "scene") {
        let requestedParent: Object3D | null = null;
        if (typeof opts.parent === "string") {
            requestedParent = tryFindObject(opts.parent, context.scene, true);
        }
        else {
            requestedParent = opts.parent;
        }
        if (requestedParent) {
            const func = opts.keepWorldPosition === true ? requestedParent.attach : requestedParent.add;
            if (!func) console.error("Invalid parent object", requestedParent, "received when instantiating:", instance);
            else func.call(requestedParent, clone);
        }
        else console.warn("could not find parent:", opts.parent);
    }

    for (const [key, value] of Object.entries(instance.userData)) {
        if (key === "components") continue;
        clone.userData[key] = value;
    }

    if (instance.userData?.components) {
        const components = instance.userData.components;
        const newComponents: Component[] = [];
        clone.userData.components = newComponents;
        for (let i = 0; i < components.length; i++) {
            const comp = components[i];
            const copy = Object.create(comp);
            assign(copy, comp);
            newComponents.push(copy);
            copy.gameObject = clone;
            // copy.transform = clone;
            componentsList.push(copy);
        }
    }

    // children should just clone the original transform
    if (opts) {
        opts.position = undefined;
        opts.rotation = undefined;
        opts.scale = undefined;
        opts.parent = undefined;
    }

    for (const ch in instance.children) {
        const child = instance.children[ch];
        const newChild = internalInstantiate(context, child as GameObject, opts, componentsList, newGameObjectsMap, skinnedMeshesMap);
        if (newChild)
            clone.add(newChild);
    }

    return clone;

}

function resolveAndBindSkinnedMeshBones(
    skinnedMeshes: { [key: string]: NewGameObjectReferenceInfo },
    newObjectsMap: { [key: string]: NewGameObjectReferenceInfo }
) {
    for (const key in skinnedMeshes) {
        const val = skinnedMeshes[key];
        const original = val.original as THREE.SkinnedMesh;
        const originalSkeleton = original.skeleton;
        const clone = val.clone as THREE.SkinnedMesh;
        // clone.updateWorldMatrix(true, true);
        if (!originalSkeleton) {
            console.warn("Skinned mesh has no skeleton?", val);
            continue;
        }
        const originalBones = originalSkeleton.bones;
        const clonedSkeleton = clone.skeleton.clone();

        clone.skeleton = clonedSkeleton;
        clone.bindMatrix.clone().copy(original.bindMatrix);
        // console.log(clone.bindMatrix)
        clone.bindMatrixInverse.copy(original.bindMatrixInverse);
        // clone.bindMatrix.multiplyScalar(.025);
        // console.assert(originalSkeleton.uuid !== clonedSkeleton.uuid);
        // console.assert(originalBones.length === clonedSkeleton.bones.length);
        const bones: Array<THREE.Bone> = [];
        clonedSkeleton.bones = bones;
        for (let i = 0; i < originalBones.length; i++) {
            const bone = originalBones[i];
            const newBoneInfo = newObjectsMap[bone.uuid];
            const clonedBone = newBoneInfo.clone as THREE.Bone;
            // console.log("NEW BONE: ", clonedBone, "BEFORE", newBoneInfo.original);
            bones.push(clonedBone);
        }
        // clone.skeleton = new THREE.Skeleton(bones);
        // clone.skeleton.update();
        // clone.pose();
        // clone.scale.set(1,1,1);
        // clone.position.y += .1;
        // console.log("ORIG", original, "CLONE", clone);
    }
    for (const key in skinnedMeshes) {
        const clone = skinnedMeshes[key].clone as THREE.SkinnedMesh;
        clone.skeleton.update();
        // clone.skeleton.calculateInverses();
        clone.bind(clone.skeleton, clone.bindMatrix);
        clone.updateMatrixWorld(true);
        // clone.pose();
    }
}

// private static bindNewSkinnedMeshBones(source, clone) {
//     const sourceLookup = new Map();
//     const cloneLookup = new Map();
//     // const clone = source.clone(false);

//     function parallelTraverse(a, b, callback) {
//         callback(a, b);
//         for (let i = 0; i < a.children.length; i++) {
//             parallelTraverse(a.children[i], b.children[i], callback);
//         }
//     }
//     parallelTraverse(source, clone, function (sourceNode, clonedNode) {
//         sourceLookup.set(clonedNode, sourceNode);
//         cloneLookup.set(sourceNode, clonedNode);
//     });

//     clone.traverse(function (node) {
//         if (!node.isSkinnedMesh) return;
//         const clonedMesh = node;
//         const sourceMesh = sourceLookup.get(node);
//         const sourceBones = sourceMesh.skeleton.bones;

//         clonedMesh.skeleton = sourceMesh.skeleton.clone();
//         clonedMesh.bindMatrix.copy(sourceMesh.bindMatrix);

//         clonedMesh.skeleton.bones = sourceBones.map(function (bone) {
//             return cloneLookup.get(bone);
//         });
//         clonedMesh.bind(clonedMesh.skeleton, clonedMesh.bindMatrix);
//     });
//     return clone;

// }

function resolveReferences(newObjectsMap: { [key: string]: NewGameObjectReferenceInfo }) {
    // for every object that is newly created we want to update references to their newly created counterparts
    // e.g. a collider instance referencing a rigidbody instance should be updated so that 
    // the cloned collider does not reference the cloned rigidbody (instead of the original rigidbody)
    for (const key in newObjectsMap) {
        const val = newObjectsMap[key];
        const clone = val.clone;
        // resolve references
        if (clone.userData?.components) {
            for (let i = 0; i < clone.userData.components.length; i++) {
                const copy = clone.userData.components[i];
                // find referenced within a cloned gameobject
                const entries = Object.entries(copy);
                // console.log(copy, entries);
                for (const [key, value] of entries) {
                    if (Array.isArray(value)) {
                        const clonedArray: Array<any> = [];
                        copy[key] = clonedArray;
                        // console.log(copy, key, value, copy[key]);
                        for (let i = 0; i < value.length; i++) {
                            const entry = value[i];
                            // push value types into new array
                            if (typeof entry !== "object") {
                                clonedArray.push(entry);
                                continue;
                            }
                            const res: any = postProcessNewInstance(copy, key, entry, newObjectsMap);
                            if (res !== undefined)
                                clonedArray.push(res);
                            else clonedArray.push(entry);
                        }
                        // console.log(copy[key])
                    }
                    else if (typeof value === "object") {
                        const res = postProcessNewInstance(copy, key, value as IComponent | Object3D, newObjectsMap);
                        if (res !== undefined) {
                            copy[key] = res;
                        }
                    }
                }
            }
        }
    }

}

function postProcessNewInstance(copy: THREE.Object3D, key: string, value: IComponent | Object3D | any, newObjectsMap: { [key: string]: NewGameObjectReferenceInfo }) {
    if (value === null || value === undefined) return;
    if ((value as IComponent).isComponent === true) {
        const originalGameObjectReference = value["gameObject"];
        // console.log(key, value, originalGameObjectReference);
        if (originalGameObjectReference) {
            const id = originalGameObjectReference.uuid;
            const newGameObject = newObjectsMap[id]?.clone;
            if (!newGameObject) {
                // reference has not changed!
                if (debug)
                    console.log("reference did not change", key, copy, value);
                return;
            }
            const index = originalGameObjectReference.userData.components.indexOf(value);
            if (index >= 0) {
                if (debug)
                    console.log(key, id);
                const found = newGameObject.userData.components[index];
                return found;
            }
            else {
                console.warn("could not find component", key, value);
            }
        }
    } else if ((value as Object3D).isObject3D === true) {
        // console.log(value);
        if (key === "gameObject") return;
        const originalGameObjectReference = value as Object3D;
        if (originalGameObjectReference) {
            const id = originalGameObjectReference.uuid;
            const newGameObject = newObjectsMap[id]?.clone;
            if (newGameObject) {
                if (debug)
                    console.log(key, "old", value, "new", newGameObject);
                return newGameObject;
            }
        }
    }
    else {
        // create new instances for some types that we know should usually not be shared and can safely be cloned
        if (value.isVector4 || value.isVector3 || value.isVector2 || value.isQuaternion || value.isEuler) {
            return value.clone();
        }
    }
}