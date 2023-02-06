import "./codegen/register_types";
import { TypeStore } from "./engine_typestore";
import * as THREE from "three";
import { Component, GameObject } from "../engine-components/Component";
import { InstantiateIdProvider } from "./engine_networking_instantiate"
import { Context } from "./engine_setup";
import { deserializeObject, serializeObject } from "./engine_serialization";
import { assign, ImplementationInformation, ISerializable, SerializationContext } from "./engine_serialization_core";
import { NEEDLE_components } from "./extensions/NEEDLE_components";
import { debugExtension } from "./engine_default_parameters";
import { builtinComponentKeyName } from "./engine_constants";
import { GuidsMap, SourceIdentifier } from "./engine_types";
import { UIDProvider } from "./engine_types";
import { addNewComponent } from "./engine_components";
import { getParam } from "./engine_utils";
import { LogType, showBalloonMessage } from "./debug/debug";
import { isLocalNetwork } from "./engine_networking_utils";


const debug = debugExtension;
const debugTypeStore = getParam("debugtypestore");
if (debugTypeStore) console.log(TypeStore);

export function writeBuiltinComponentData(comp: Component, context: SerializationContext): object | null {

    // const fn = (comp as unknown as ISerializable)?.onBeforeSerialize;
    // if (fn) {
    //     const res = fn?.call(comp);
    //     if (res !== undefined) {
    //         res["name"] = comp.constructor.name;
    //         return res;
    //     }
    // }
    const serializable = comp as unknown as ISerializable;
    const data = serializeObject(serializable, context);
    // console.log(data);
    if (data !== undefined) return data;
    return null;
}

const typeImplementationInformation = new ImplementationInformation();

export async function createBuiltinComponents(context: Context, gltfId: SourceIdentifier, gltf, seed: number | null | UIDProvider = null, extension?: NEEDLE_components) {
    if (!gltf) return;
    const lateResolve: Array<(gltf: THREE.Object3D) => {}> = [];

    let idProvider: UIDProvider | null = seed as UIDProvider;
    if (typeof idProvider === "number") {
        idProvider = new InstantiateIdProvider(seed as number);
    }

    const serializationContext = new SerializationContext(gltf.scene);
    serializationContext.gltfId = gltfId;
    serializationContext.context = context;
    serializationContext.gltf = gltf;
    serializationContext.nodeToObject = extension?.nodeToObjectMap;
    serializationContext.implementationInformation = typeImplementationInformation;

    const deserialize: DeserializeData[] = [];

    if (gltf.scenes) {
        for (const scene of gltf.scenes) {
            await onCreateBuiltinComponents(serializationContext, scene, deserialize, lateResolve);
        }
    }
    if (gltf.children) {
        for (const ch of gltf.children) {
            await onCreateBuiltinComponents(serializationContext, ch, deserialize, lateResolve);
        }
    }


    context.new_scripts_pre_setup_callbacks.push(() => {

        for (const des of deserialize) {
            handleDeserialization(des, serializationContext);
        }

        // when dropping the same file multiple times we need to generate new guids
        // e.g. SyncTransform sends its own guid to the server to know about ownership
        // so it requires a unique guid for a new instance
        // doing it here at the end of resolving of references should ensure that
        // and this should run before awake and onenable of newly created components
        if (idProvider) {
            // TODO: should we do this after setup callbacks now?
            const guidsMap: GuidsMap = {};
            recursiveCreateGuids(gltf, idProvider, guidsMap);
            for (const scene of gltf.scenes)
                recursiveCreateGuids(scene, idProvider, guidsMap);
        }
    });

    // tools.findAnimationsLate(context, gltf, context.new_scripts_pre_setup_callbacks);

    // console.log("finished creating builtin components", gltf.scene?.name, gltf);
}

function recursiveCreateGuids(obj: GameObject, idProvider: UIDProvider | null, guidsMap: GuidsMap) {
    if (idProvider === null) return;
    if (!obj) return;
    const prev = obj.guid;
    obj.guid = idProvider.generateUUID();
    if (prev && prev !== "invalid")
        guidsMap[prev] = obj.guid;
    // console.log(obj);
    if (obj && obj.userData && obj.userData.components) {
        for (const comp of obj.userData.components) {
            if (comp === null) continue;
            const prev = comp.guid;
            comp.guid = idProvider.generateUUID();
            if (prev && prev !== "invalid")
                guidsMap[prev] = comp.guid;
            if (comp.resolveGuids)
                comp.resolveGuids(guidsMap);
        }

    }
    if (obj.children) {
        for (const child of obj.children) {
            recursiveCreateGuids(child as GameObject, idProvider, guidsMap);
        }
    }
}

declare interface IGltfbuiltinComponent {
    name: string;
}

declare interface IGltfBuiltinComponentData {
    [builtinComponentKeyName]: IGltfbuiltinComponent[];
}

declare class DeserializeData {
    instance: any;
    compData: IGltfbuiltinComponent;
    obj: THREE.Object3D;
}

declare type LateResolveCallback = (gltf: THREE.Object3D) => void;

const unknownComponentsBuffer: Array<string> = [];

async function onCreateBuiltinComponents(context: SerializationContext, obj: THREE.Object3D,
    deserialize: DeserializeData[], lateResolve: LateResolveCallback[]) {
    if (!obj) return;

    // iterate injected data
    const data = obj.userData as IGltfBuiltinComponentData;
    if (data) {
        const components = data.builtin_components;
        if (components && components.length > 0) {
            // console.log(obj);
            for (const compData of components) {
                try {
                    if (compData === null) continue;
                    const type = TypeStore.get(compData.name);
                    // console.log(compData, compData.name, type, TypeStore);
                    if (type !== undefined && type !== null) {
                        const instance: Component = new type() as Component;
                        instance.sourceId = context.gltfId;

                        // assign basic fields
                        assign(instance, compData, context.implementationInformation);
                        // Object.assign(instance, compData);
                        // dont call awake here because some references might not be resolved yet and components that access those fields in awake will throw
                        // for example Duplicatable reference to object might still be { node: id }
                        const callAwake = false;
                        addNewComponent(obj, instance, callAwake);
                        deserialize.push({ instance, compData, obj });
                    }
                    else {
                        if (debug)
                            console.debug("unknown component: " + compData.name);
                        if (!unknownComponentsBuffer.includes(compData.name))
                            unknownComponentsBuffer.push(compData.name);
                    }
                }
                catch (err: any) {
                    console.error(compData.name + " - " + err.message, err);
                }
            }
            // console.debug("finished adding gltf builtin components", obj);
        }
        if (unknownComponentsBuffer.length > 0) {
            const unknown = unknownComponentsBuffer.join(", ");
            console.warn("unknown components: " + unknown);
            unknownComponentsBuffer.length = 0;
            if (isLocalNetwork())
                showBalloonMessage(`<strong>Unknown components in scene</strong>:\n\n${unknown}\n\nThis could mean you forgot to add a npmdef to your ExportInfo\n<a href="https://engine.needle.tools/docs/project_structure.html#creating-and-installing-a-npmdef" target="_blank">documentation</a>`, LogType.Warn);
        }
    }

    if (obj.children) {
        for (const ch of obj.children) {
            await onCreateBuiltinComponents(context, ch, deserialize, lateResolve);
        }
    }
}

function handleDeserialization(data: DeserializeData, context: SerializationContext) {
    const { instance, compData, obj } = data;
    context.object = obj;
    context.target = instance;

    // const beforeFn = (instance as ISerializationCallbackReceiver)?.onBeforeDeserialize;
    // console.log(beforeFn, instance);
    // if (beforeFn) beforeFn.call(instance, data.compData);

    let deserialized: boolean = true;
    // console.log(instance, compData);
    // TODO: first build components and then deserialize data?
    // currently a component referencing another component can not find it if the referenced component hasnt been added
    // we should split this up in two steps then.
    deserialized = deserializeObject(instance, compData, context) === true;

    // if (!deserialized) {
    //     // now loop through data again and search for special reference types
    //     for (const key in compData) {
    //         const entry = compData[key];
    //         if (!entry) {
    //             instance[key] = null;
    //             continue;
    //         }

    //         const fn = (instance as ISerializationCallbackReceiver)?.onDeserialize;
    //         if (fn) {
    //             const res = fn.call(instance, key, entry);
    //             if (res !== undefined) {
    //                 instance[key] = res;
    //                 continue;
    //             }
    //         }

    //         // if (!resolve(instance, key, entry, lateResolve)) {
    //         // }
    //     }
    // }

    // console.log(instance);
    // const afterFn = (instance as ISerializationCallbackReceiver)?.onAfterDeserialize;
    // if (afterFn) afterFn.call(instance);
    if (debug)
        console.debug("add " + compData.name, compData, instance);
}

// // TODO: THIS should be legacy once we update unity builtin component exports
// function resolve(instance, key: string, entry, lateResolve: LateResolveCallback[]): boolean {

//     switch (entry["$type"]) {
//         default:
//             const type = entry["$type"];
//             if (type !== undefined) {
//                 const res = tryResolveType(type, entry);
//                 if (res !== undefined)
//                     instance[key] = res;
//                 return res !== undefined;
//             }
//             break;
//         // the thing is a reference
//         case "reference":
//             // we expect some identifier entry to use for finding the reference
//             const guid = entry["guid"];
//             lateResolve.push(async (gltf) => {
//                 instance[key] = findInGltf(guid, gltf);
//             });
//             return true;
//     }

//     if (Array.isArray(entry)) {
//         // the thing is an array
//         const targetArray = instance[key];
//         for (const index in entry) {
//             const val = entry[index];
//             if (val === null) {
//                 targetArray[index] = null;
//                 continue;
//             }
//             switch (val["$type"]) {
//                 default:
//                     const type = val["$type"];
//                     if (type !== undefined) {
//                         const res = tryResolveType(type, entry);
//                         if (res !== undefined) targetArray[index] = res;
//                     }
//                     break;
//                 case "reference":
//                     // this entry is a reference
//                     const guid = val["guid"];
//                     lateResolve.push(async (gltf) => {
//                         targetArray[index] = findInGltf(guid, gltf);
//                     });
//                     break;
//             }
//         }
//         return true;
//     }
//     return false;
// }

// function findInGltf(guid: string, gltf) {
//     let res = tools.tryFindScript(guid);
//     if (!res) res = tools.tryFindObject(guid, gltf, true);
//     return res;
// }

// function tryResolveType(type, entry): any | undefined {
//     switch (type) {
//         case "Vector2":
//             return new THREE.Vector2(entry.x, entry.y);
//         case "Vector3":
//             return new THREE.Vector3(entry.x, entry.y, entry.z);
//         case "Vector4":
//             return new THREE.Vector4(entry.x, entry.y, entry.z, entry.w);
//         case "Quaternion":
//             return new THREE.Quaternion(entry.x, entry.y, entry.z, entry.w);
//     }
//     return undefined;
// }