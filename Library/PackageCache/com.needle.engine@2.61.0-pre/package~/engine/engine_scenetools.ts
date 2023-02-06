import { Context } from "./engine_setup"
import { Animator } from '../engine-components/Animator';
import { Animation } from '../engine-components/Animation';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
// import * as object from "./engine_gltf_builtin_components";
import * as loaders from "./engine_loaders"
import * as utils from "./engine_utils";
import { registerComponentExtension, registerExtensions } from "./extensions/extensions";
import { getLoader, INeedleGltfLoader, registerLoader } from "./engine_gltf";
import { SourceIdentifier, UIDProvider } from "./engine_types";
import { createBuiltinComponents, writeBuiltinComponentData } from "./engine_gltf_builtin_components";
import { SerializationContext } from "./engine_serialization_core";
import { NEEDLE_components } from "./extensions/NEEDLE_components";
import { addNewComponent, getComponentInChildren } from "./engine_components";
import { registerPrewarmObject } from "./engine_mainloop_utils";


export class NeedleGltfLoader implements INeedleGltfLoader {
    createBuiltinComponents(context: Context, gltfId: string, gltf: any, seed: number | UIDProvider | null, extension?: NEEDLE_components | undefined) {
        return createBuiltinComponents(context, gltfId, gltf, seed, extension);
    }

    writeBuiltinComponentData(comp: any, context: SerializationContext) {
        return writeBuiltinComponentData(comp, context);
    }

    parseSync(context: Context, data, path: string, seed: number | UIDProvider | null): Promise<GLTF | undefined> {
        return parseSync(context, data, path, seed);
    }
    loadSync(context: Context, url: string, seed: number | UIDProvider | null, _allowAddingAnimator: boolean, prog?: ((ProgressEvent: any) => void) | undefined): Promise<GLTF | undefined> {
        return loadSync(context, url, seed, _allowAddingAnimator, prog);
    }
}

registerLoader(NeedleGltfLoader);


const printGltf = utils.getParam("printGltf");

// const loader = new GLTFLoader();
// registerExtensions(loader);

export enum GltfLoadEventType {
    BeforeLoad = 0,
    AfterLoaded = 1,
    FinishedSetup = 10,
}

export class GltfLoadEvent {
    context: Context
    loader: GLTFLoader;
    path: string;
    gltf?: GLTF;

    constructor(context: Context, path: string, loader: GLTFLoader, gltf?: GLTF) {
        this.context = context;
        this.path = path;
        this.loader = loader;
        this.gltf = gltf;
    }
}

export type GltfLoadEventCallback = (event: GltfLoadEvent) => void;

const eventListeners: { [key: string]: GltfLoadEventCallback[] } = {};

export function addGltfLoadEventListener(type: GltfLoadEventType, listener: GltfLoadEventCallback) {
    eventListeners[type] = eventListeners[type] || [];
    eventListeners[type].push(listener);
}
export function removeGltfLoadEventListener(type: GltfLoadEventType, listener: GltfLoadEventCallback) {
    if (eventListeners[type]) {
        const index = eventListeners[type].indexOf(listener);
        if (index >= 0) {
            eventListeners[type].splice(index, 1);
        }
    }
}

function invokeEvents(type: GltfLoadEventType, event: GltfLoadEvent) {
    if (eventListeners[type]) {
        for (const listener of eventListeners[type]) {
            listener(event);
        }
    }
}

async function handleLoadedGltf(context: Context, gltfId: string, gltf, seed: number | null | UIDProvider, componentsExtension) {
    if (printGltf)
        console.log(gltf);
    await context.assets.registerGltf(gltf);
    await getLoader().createBuiltinComponents(context, gltfId, gltf, seed, componentsExtension);

    // load and assign animation
    // we still need this for Animation component
    // findAnimationsLate(context, gltf, context.new_scripts_pre_setup_callbacks, false);
}

export function createGLTFLoader(url: string, context: Context) {
    const loader = new GLTFLoader();
    const sourceId: SourceIdentifier = url;
    registerExtensions(loader, context, sourceId);
    return loader;
}

export function parseSync(context: Context, data, path: string, seed: number | UIDProvider | null): Promise<GLTF | undefined> {
    if (typeof path !== "string") {
        console.warn("Parse gltf binary without path, this might lead to errors in resolving extensions. Please provide the source path of the gltf/glb file", path, typeof path);
    }
    const loader = createGLTFLoader(path, context);
    const componentsExtension = registerComponentExtension(loader);
    return new Promise((resolve, reject) => {
        try {
            loaders.addDracoAndKTX2Loaders(loader, context);
            invokeEvents(GltfLoadEventType.BeforeLoad, new GltfLoadEvent(context, path, loader));
            loader.parse(data, path, async data => {
                invokeEvents(GltfLoadEventType.AfterLoaded, new GltfLoadEvent(context, path, loader, data));
                await handleLoadedGltf(context, path, data, seed, componentsExtension);
                invokeEvents(GltfLoadEventType.FinishedSetup, new GltfLoadEvent(context, path, loader, data));
                registerPrewarmObject(data.scene, context);
                resolve(data);

            }, err => {
                console.error("failed loading " + path, err);
                resolve(undefined);
            });
        }
        catch (err) {
            console.error(err);
            reject(err);
        }
    });
}

export function loadSync(context: Context, url: string, seed: number | UIDProvider | null, _allowAddingAnimator: boolean = false, prog?: (ProgressEvent) => void): Promise<GLTF | undefined> {
    // better to create new loaders every time
    // (maybe we can cache them...)
    // but due to the async nature and potentially triggering multiple loads at the same time
    // we need to make sure the extensions dont override each other
    // creating new loaders should not be expensive as well
    const loader = createGLTFLoader(url, context);
    const componentsExtension = registerComponentExtension(loader);
    return new Promise((resolve, reject) => {
        try {
            loaders.addDracoAndKTX2Loaders(loader, context);
            invokeEvents(GltfLoadEventType.BeforeLoad, new GltfLoadEvent(context, url, loader));
            loader.load(url, async data => {
                invokeEvents(GltfLoadEventType.AfterLoaded, new GltfLoadEvent(context, url, loader, data));
                await handleLoadedGltf(context, url, data, seed, componentsExtension);
                invokeEvents(GltfLoadEventType.FinishedSetup, new GltfLoadEvent(context, url, loader, data));
                registerPrewarmObject(data.scene, context);
                resolve(data);

            }, evt => {
                prog?.call(loader, evt);
            }, err => {
                console.error("failed loading " + url, err);
                resolve(undefined);
            });
        }
        catch (err) {
            console.error(err);
            reject(err);
        }
    });
}

export function findAnimationsLate(_context: Context, gltf, callbackarray, allowAddingAnimator: boolean = false) {
    if (gltf && gltf.animations && gltf.animations.length > 0) {
        callbackarray.push(() => {
            // console.trace("callback", gltf);
            findAnimations(gltf, allowAddingAnimator);
        });
    }
}

export function findAnimations(gltf: GLTF, allowAddingAnimator: boolean = false) {
    // console.log(gltf);
    if (!gltf || !gltf.animations || !gltf.scene) return;

    if (!allowAddingAnimator) {
        // we only need to search if any animation component is in the scene
        // otherwise if we dont add anything there is no reason to search and log anything
        if (!getComponentInChildren(gltf.scene, Animation)) return;
    }

    for (let i = 0; i < gltf.animations.length; i++) {
        const animation = gltf.animations[i];
        if (!animation.tracks || animation.tracks.length <= 0) continue;
        for (const t in animation.tracks) {
            const track = animation.tracks[t];
            const objectName = track["__objectName"] ?? track.name.substring(0, track.name.indexOf("."));
            const obj = gltf.scene.getObjectByName(objectName);
            if (!obj) {
                // console.warn("could not find " + objectName, animation, gltf.scene);
                continue;
            }
            let animationComponent = findAnimationGameObjectInParent(obj);
            if (!animationComponent) {
                if (allowAddingAnimator)
                    animationComponent = addNewComponent(gltf.scene, new Animation());
                else {
                    console.warn("Failed finding animator for", track.name, objectName);
                    continue;
                }
            }
            const animations = animationComponent.animations = animationComponent.animations || [];
            animation["name_animator"] = animationComponent.name;
            // console.log(objectName, obj, animator.name, animations.length);
            if (animations.indexOf(animation) < 0) {
                animations.push(animation);
            }
        }
    }
    function findAnimationGameObjectInParent(obj) {
        if (!obj) return;
        const components = obj.userData?.components;
        if (components && components.length > 0) {
            for (let i = 0; i < components.length; i++) {
                const component = components[i];
                // console.log(component);
                if (component instanceof Animator || component instanceof Animation) {
                    return obj;;
                }
            }
        }
        return findAnimationGameObjectInParent(obj.parent);
    }
}


// TODO: save references in guid map
// const guidMap = {};


export function tryFindObjectByName(name, obj, recursive = true) {
    if (obj.userData && obj.userData.name === name) return obj;
    if (obj.children && obj.children.length > 0) {
        for (let i = 0; i < obj.children.length; i++) {
            const child = obj.children[i];
            const found = tryFindObjectByName(name, child, recursive);
            if (found) return found;
        }
    }
}

// obj can be a three.object or a gltf root
export function tryFindObject(globalObjectIdentifier, obj, recursive = true) {
    return utils.tryFindObject(globalObjectIdentifier, obj, recursive);
}


export function tryFindScript(globalObjectIdentifier, list = null) {
    const arr = list ?? Context.Current.scripts;
    for (const i in arr) {
        const script = arr[i];
        if (script && script.guid === globalObjectIdentifier)
            return script;
    }
    return null;
}
