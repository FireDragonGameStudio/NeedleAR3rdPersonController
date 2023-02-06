import { Group, Object3D } from "three";
import { RootState, } from "@react-three/fiber";
import { Behaviour, Camera, GameObject, TypeStore } from "@needle-tools/engine";
import { Context, ContextArgs } from "@needle-tools/engine/engine/engine_setup";
import { ConstructorConcrete, IComponent } from "@needle-tools/engine/engine/engine_types";
import { debug } from "./constants";
import { InstantiateIdProvider } from "@needle-tools/engine/engine/engine_networking_instantiate";
import { getName } from "./utils";
import { assign, deserializeObject, ISerializable, SerializationContext } from "@needle-tools/engine/engine/engine_serialization_core";

let context: Context | null = null;
const $mockObject = Symbol("Needle react mock");
const $attachedComponents = Symbol("Needle react attached components");

declare type Props = { [key: string]: any };

const idProvider = new InstantiateIdProvider(0)

export class ComponentContext {
    group: Group;
    components: IComponent[];
    dispose: Function | null;

    constructor(group: Group, components: IComponent[], dispose: Function | null) {
        this.group = group;
        this.components = components;
        this.dispose = dispose;
    }

}


export function unpack<T>(props: Props, group: Group, rootState: RootState, types: ConstructorConcrete<T>[]) {
    if (!group) {
        if (debug) console.log("NO GROUP");
        return;
    }
    if (group[$attachedComponents] === true) {
        return;
    }
    ensureContext(rootState);
    const name = debug ? getName(types) : "";
    if (debug) console.log("ATTACH", name);
    if (props.guid) {
        idProvider.initialize(props.guid);
    }
    // mark the group as mock
    group[$mockObject] = true;
    group[$attachedComponents] = true;
    const parent = group.parent;
    if (parent) {
        const components: IComponent[] = [];
        addComponents(group, types, components, props);
        let dispose: Function | null = null;
        if (components.length > 0) {
            const d = group.dispose;
            dispose = () => {
                group[$attachedComponents] = false;
                if (components.length <= 0) return;
                if (debug) console.log("CLEANUP", name, components);
                for (const comp of components) comp.destroy();
                components.length = 0;
                d?.call(group);
            }
            group.dispose = dispose;
        }
        const context = new ComponentContext(group, components, dispose);
        return;
    }
    else {
        console.warn("NeedleComponent: parent is null");
    }
    return;
}

function ensureContext(rootState: RootState) {
    if (!Context.Current) {
        const args = new ContextArgs(rootState.gl.domElement);
        args.renderer = rootState.gl;
        context = new Context(args);
        context.isManagedExternally = true;
        context.onCreate();
        context.scene = rootState.scene;
        Context.Current = context;
        const cam = GameObject.addNewComponent(rootState.camera, Camera, false);
        cam.sourceId = "react-three-fiber";
        context.setCurrentCamera(cam);
    }
}

function addComponents<T>(group: Group, types: ConstructorConcrete<T>[], components: IComponent[], props: Props, level: number = 0) {
    // const prev: Object3D[] = [];
    // const components: IComponent[] = [];
    const hasChildren = group.children.length;
    if (hasChildren) {
        for (let i = group.children.length - 1; i >= 0; i--) {
            const ch = group.children[i];
            if (ch[$mockObject]) {
                addComponents(ch, types, components, props, level + 1);
                continue;
            }
            internalAddComponents(group, ch);
        }
    }
    else {
        // if we dont have any children we want to attach the components to the parent
        addComponentToNextParent(group);
        /*
        // for example:
        <TorusKnot>
            <DragControls>
        </TorusKnot>
        */
    }

    function addComponentToNextParent(ch: Object3D) {
        if (ch.parent) {
            if (ch.parent[$mockObject] === true) {
                addComponentToNextParent(ch.parent);
            }
            else {
                internalAddComponents(group, ch.parent);
            }
        }
    }

    function internalAddComponents(mock: Group, obj: Object3D) {
        // initialize the guid provider for networking
        // not sure if this is always correct tho
        if (!obj.guid) {
            if (obj.userData?.guid) {
                idProvider.initialize(obj.userData.guid);
            }
            else if (obj.name) {
                idProvider.initialize(obj.name);
            }
            obj.guid = idProvider.generateUUID();
        }
        idProvider.initialize(obj.guid);
        // obj.guid = idProvider.generateUUID(); 
        for (const type of types) {
            const isComponent = type.prototype instanceof Behaviour;
            if (isComponent && !TypeStore.get(type)) {
                TypeStore.add(type.name, type);
            }
            const guid = idProvider.generateUUID();

            if (debug) {
                const existing = GameObject.getComponent(obj, type) as IComponent;
                if (existing?.guid === guid) {
                    console.warn("GUID ALREADY EXISTS", type.name, guid, mock.name);
                }
            }

            const instance = GameObject.addNewComponent(obj, type, false) as IComponent
            instance.guid = guid;
            if (props) {
                assign(instance, props);
                tryResolveSerializationData(instance, props);
            }
            // if(debug) console.log("Add component", type.name, instance.guid, instance);
            if (instance) components.push(instance);
        }
    }
}

function tryResolveSerializationData(componentInstance: IComponent, props: Props) {
    const ser = componentInstance as ISerializable;
    if (ser && ser.$serializedTypes) {

        deserializeObject(ser, props, new SerializationContext(componentInstance.gameObject));

        for (const prop in props) {
            const info = ser.$serializedTypes[prop];
            const val = props[prop];
            if (info) {
                if (info === Object3D || info === GameObject) {
                    const scene = Context.Current.scene;
                    const obj = scene.getObjectByProperty("name", val);
                    if(obj){
                        componentInstance[prop] = obj;
                    }
                }
            }
        }
    }
}
