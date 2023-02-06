import * as THREE from "three";
import { RGBAColor } from "../engine-components/js-extensions/RGBAColor";
import { SerializationContext, TypeSerializer } from "./engine_serialization_core";
import { Behaviour, Component, GameObject } from "../engine-components/Component";
import { debugExtension } from "./engine_default_parameters";
import { CallInfo, EventList } from "../engine-components/EventList";
import { Color, Object3D, Texture, WebGLRenderTarget } from "three";
import { RenderTexture } from "./engine_texture";
import { isDevEnvironment } from "../engine/debug/debug";

// export class SourcePath {
//     src?:string
// };

// class SourcePathSerializer extends TypeSerializer{
//     constructor(){
//         super(SourcePath);
//     }
//     onDeserialize(data: any, _context: SerializationContext) {
//         if(data.src && typeof data.src === "string"){
//             return data.src;
//         }
//     }
//     onSerialize(_data: any, _context: SerializationContext) {

//     }
// }
// new SourcePathSerializer();

class ColorSerializer extends TypeSerializer {
    constructor() {
        super([Color, RGBAColor])
    }
    onDeserialize(data: any): THREE.Color | RGBAColor | void {
        if (data === undefined || data === null) return;
        if (data.a !== undefined) {
            return new RGBAColor(data.r, data.g, data.b, data.a);
        }
        else if (data.alpha !== undefined) {
            return new RGBAColor(data.r, data.g, data.b, data.alpha);
        }
        return new THREE.Color(data.r, data.g, data.b);
    }
    onSerialize(data: any): any | void {
        if (data === undefined || data === null) return;
        if (data.a !== undefined)
            return { r: data.r, g: data.g, b: data.b, a: data.a }
        else
            return { r: data.r, g: data.g, b: data.b }
    }
}
export const colorSerializer = new ColorSerializer();

declare type ObjectData = {
    node?: number;
    guid?: string;
}
class ObjectSerializer extends TypeSerializer {
    constructor() {
        super(Object3D);
    }

    onSerialize(data: any, context: SerializationContext) {
        if (context.objectToNode !== undefined && data.uuid) {
            const node = context.objectToNode[data.uuid];
            if (debugExtension)
                console.log(node, data.name, data.uuid);
            return { node: node }
        }
        return undefined;
    }

    onDeserialize(data: ObjectData | string | null, context: SerializationContext) {

        if (typeof data === "string") {
            // ACTUALLY: this is already handled by the extension_utils where we resolve json pointers recursively
            // if(data.startsWith("/nodes/")){
            //     const node = parseInt(data.substring("/nodes/".length));
            //     if (context.nodeToObject) {
            //         const res = context.nodeToObject[node];
            //         if (debugExtension)
            //             console.log("Deserialized object reference?", data, res, context?.nodeToObject);
            //         if (!res) console.warn("Did not find node: " + data, context.nodeToObject, context.object);
            //         return res;
            //     }
            // }
            return undefined;
        }

        if (data) {
            if (data.node !== undefined && context.nodeToObject) {
                const res = context.nodeToObject[data.node];
                if (debugExtension)
                    console.log("Deserialized object reference?", data, res, context?.nodeToObject);
                if (!res) console.warn("Did not find node: " + data.node, context.nodeToObject, context.object);
                return res;
            }
            else if (data.guid) {
                if (!context.context) {
                    console.error("Missing context");
                    return undefined;
                }
                // it is possible that the object is not yet loaded 
                // e.g. if we have a scene with multiple gltf files and the first gltf references something in the second gltf
                // we need a way to wait for all components to be created before we can resolve those references
                // independent of order of loading
                let res: GameObject | Behaviour | undefined | null = undefined;
                // first try to search in the current gltf scene (if any)
                let gltfScene = context.gltf?.scene;
                if (gltfScene) {
                    res = GameObject.findByGuid(data.guid, gltfScene);
                }
                // if not found, search in the whole scene
                if (!res) {
                    res = GameObject.findByGuid(data.guid, context.context.scene);
                }
                if (!res) {
                    if (isDevEnvironment() || debugExtension)
                        console.warn("Could not resolve object reference", context.path, data, context.target, context.context.scene);
                    data["could_not_resolve"] = true;
                }
                else if (debugExtension)
                    console.log("Deserialized object reference?", data, res, context?.nodeToObject);
                return res;
            }
        }
        return undefined;
    }
}
export const objectSerializer = new ObjectSerializer();


class ComponentSerializer extends TypeSerializer {
    constructor() {
        super([Component, Behaviour]);
    }

    onSerialize(data: any, _context: SerializationContext) {
        if (data?.guid) {
            return { guid: data.guid }
        }
        return undefined;
    }

    onDeserialize(data: any, context: SerializationContext) {
        if (data?.guid) {
            // TODO: need to serialize some identifier for referenced components as well, maybe just guid?
            // because here the components are created but dont have their former guid assigned
            // and will later in the stack just get a newly generated guid
            if (debugExtension)
                console.log(data.guid, context.root, context.object, context.target);
            // first search within the gltf (e.g. necessary when using AssetReference and loading a gltf without adding it to the scene)
            // if we would search JUST the scene those references would NEVER be resolved
            let res = this.findObjectForGuid(data.guid, context.root);
            if (res) {
                return res;
            }
            if (context.context) {
                // if not found within the gltf use the provided context scene
                // to find references outside
                res = this.findObjectForGuid(data.guid, context.context?.scene);
                if (res) return res;
            }
            if (isDevEnvironment() || debugExtension)
                console.warn("Could not resolve component reference", context.path, data, context.target);
            data["could_not_resolve"] = true;
            return undefined;
        }
        // if (data?.node !== undefined && context.nodeToObject) {
        //     return context.nodeToObject[data.node];
        // }
        return undefined;
    }

    findObjectForGuid(guid: string, root: THREE.Object3D): any {
        // recursively search root
        // need to check the root object too
        if (root["guid"] === guid) return root;

        const res = GameObject.foreachComponent(root, (c) => {
            if (c.guid === guid) return c;
            return undefined;
        }, false);
        if (res !== undefined)
            return res;

        // if not found, search in children
        for (let i = 0; i < root.children.length; i++) {
            const child = root.children[i];
            const res = this.findObjectForGuid(guid, child);
            if (res) return res;
        }
    }
}
export const componentSerializer = new ComponentSerializer();


declare class EventListData {
    type: string;
    calls: Array<EventListCall>;
}
declare type EventListCall = {
    method: string,
    target: string,
    argument?: any,
    enabled?: boolean,
}

class EventListSerializer extends TypeSerializer {
    constructor() {
        super([EventList]);
    }

    onSerialize(_data: EventList, _context: SerializationContext): EventListData | undefined {
        console.log("TODO: SERIALIZE EVENT");
        return undefined;
    }

    onDeserialize(data: EventListData, context: SerializationContext): EventList | undefined | null {
        // TODO: check that we dont accidentally deserialize methods to EventList objects. This is here to make is easy for react-three-fiber to just add props as { () => { } } 
        if (typeof data === "function") {
            const evtList = new EventList([new CallInfo(data, true)]);
            return evtList;
        }
        else if (data && data.type === "EventList") {
            if (debugExtension)
                console.log("DESERIALIZE EVENT", data);
            const fns = new Array<CallInfo>();
            if (data.calls && Array.isArray(data.calls)) {
                for (const call of data.calls) {
                    if (debugExtension)
                        console.log(call);
                    let target = componentSerializer.findObjectForGuid(call.target, context.root);
                    // if the object is not found in the current glb try find it in the whole scene
                    if (!target && context.context?.scene) {
                        target = componentSerializer.findObjectForGuid(call.target, context.context?.scene);
                    }
                    const hasMethod = call.method?.length > 0;
                    if (target && hasMethod) {
                        const printWarningMethodNotFound = () => console.warn(`Could not find method ${call.method} on object ${target.name}`, target, typeof target[call.method]);
                        if (typeof target[call.method] !== "function") {
                            let foundMethod = false;
                            // test if the target method is actually a property setter
                            // in which case we want to remove the leading set prefix and see if the method or property exists
                            if (call.method.startsWith("set_") && call.method.length > 4) {
                                call.method = call.method.substring(4);
                                if (target[call.method] !== undefined) foundMethod = true;
                            }
                            if (!foundMethod && (isDevEnvironment() || debugExtension))
                                printWarningMethodNotFound();
                        }
                    }
                    let fn: CallInfo | undefined;
                    let args = call.argument;
                    if (call.argument !== undefined) {
                        if (typeof args === "object") {
                            args = objectSerializer.onDeserialize(call.argument, context);
                            if (!args) args = componentSerializer.onDeserialize(call.argument, context);
                        }
                        fn = new CallInfo(hasMethod ? (...args) => invokeFunction(...args) : undefined, call.enabled);
                    }
                    else
                        fn = new CallInfo(hasMethod ? (...args) => invokeFunction(...args) : undefined, call.enabled);


                    // TODO: move this into the event list directly 
                    // this scope should not stay in the serializer.
                    // the event list should be able to modify the args that were set in unity if necessary
                    // and pass them on to the component
                    const invokeFunction = (...forwardedArgs) => {
                        const method = target[call.method];

                        if (typeof method === "function") {
                            if (args !== undefined)
                                method?.call(target, args);
                            else // support invoking EventList with any number of arguments (if none were declared in unity)
                                method?.call(target, ...forwardedArgs);
                        }
                        else // the target "method" can be a property too
                        {
                            target[call.method] = args;
                        }
                    };

                    if (!fn.method)
                        fn["__debuginfo"] = context.object?.name;
                    if (!target || !fn.method) {
                        const debugInfo = context.object ? "Current object: " + context.object.name + ", " + context.object["guid"] : null;
                        if (!target)
                            console.warn("EventList is missing target - will be ignored", call.target, debugInfo, data);
                        else console.warn("EventList method not found: \"" + call.method + "\" on", target);
                    }
                    else
                        fns.push(fn);
                }
            }
            const evt: EventList = new EventList(fns);
            if (debugExtension)
                console.log(evt);

            const eventListOwner = context.target;
            if (eventListOwner !== undefined && context.path !== undefined) {
                evt.setEventTarget(context.path, eventListOwner);
            }

            return evt;
        }
        return undefined;
    }
}
export const eventListSerializer = new EventListSerializer();



export class RenderTextureSerializer extends TypeSerializer {
    constructor() {
        super([RenderTexture, WebGLRenderTarget]);
    }

    onSerialize(_data: any, _context: SerializationContext) {
    }

    onDeserialize(data: any, context: SerializationContext) {
        if (data instanceof Texture && context.type === RenderTexture) {
            const tex = data as Texture;
            const rt = new RenderTexture(tex.image.width, tex.image.height);
            rt.texture = tex;
            return rt;
        }
        return undefined;
    }
}
new RenderTextureSerializer();