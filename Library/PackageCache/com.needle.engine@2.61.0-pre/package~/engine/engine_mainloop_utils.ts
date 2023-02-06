import * as utils from "./engine_generic_utils";
import * as constants from "./engine_constants";
import { getParam } from './engine_utils';
import { CubeCamera, Object3D, WebGLCubeRenderTarget } from 'three';
import { IComponent, IContext } from './engine_types';
import { isActiveSelf } from './engine_gameobject';
import { ContextRegistry } from "./engine_context_registry";

const debug = getParam("debugnewscripts");

// if some other script adds new scripts in onEnable or awake 
// the original array should be cleared before processing it
// so we use this copy buffer
const new_scripts_buffer: any[] = [];

export function processNewScripts(context: IContext) {
    if (context.new_scripts.length <= 0) return;
    if (debug)
        console.log("Register new components", context.new_scripts.length, context.alias ? ("element: " + context.alias) : "");

    // if(new_scripts_post_setup_callbacks.length > 0) console.log(new_scripts_post_setup_callbacks);
    if (context.new_scripts_pre_setup_callbacks.length > 0) {
        for (const cb of context.new_scripts_pre_setup_callbacks) {
            if (!cb) continue;
            cb();
        }
        context.new_scripts_pre_setup_callbacks.length = 0;
    }

    // TODO: update all the code from above to use this logic
    // basically code gen should add the scripts to new scripts
    // and this code below should go into some util method
    new_scripts_buffer.length = 0;
    if (context.new_scripts.length > 0) {
        new_scripts_buffer.push(...context.new_scripts);
    }
    context.new_scripts.length = 0;

    // Check valid scripts and add all valid to the scripts array
    for (let i = 0; i < new_scripts_buffer.length; i++) {
        try {
            const script: IComponent = new_scripts_buffer[i];
            if (script.destroyed) continue;
            if (!script.gameObject) {
                console.error("MISSING GAMEOBJECT - will ignore", script);
                new_scripts_buffer.splice(i, 1);
                i--;
                continue;
            }
            script.context = context;
            updateActiveInHierarchyWithoutEventCall(script.gameObject);
            addScriptToArrays(script, context);
        }
        catch (err) {
            console.error(err);
            removeScriptFromContext(new_scripts_buffer[i], context);
            new_scripts_buffer.splice(i, 1);
            i--;
        }
    }

    // Awake
    for (let i = 0; i < new_scripts_buffer.length; i++) {
        try {
            const script: IComponent = new_scripts_buffer[i];
            if (script.destroyed) {
                removeScriptFromContext(new_scripts_buffer[i], context);
                new_scripts_buffer.splice(i, 1);
                i--; continue;
            }
            if (script.registering) {
                try {
                    script.registering();
                }
                catch (err) { console.error(err); }
            }
            // console.log(script, script.gameObject)
            // TODO: we should not call awake on components with inactive gameobjects
            if (script.__internalAwake !== undefined) {
                if (!script.gameObject) {
                    console.error("MISSING GAMEOBJECT", script, script.gameObject);
                }
                updateActiveInHierarchyWithoutEventCall(script.gameObject);
                if (script.activeAndEnabled)
                    utils.safeInvoke(script.__internalAwake.bind(script));

                // registerPrewarmObject(script.gameObject, context);
            }
        }
        catch (err) {
            console.error(err);
            removeScriptFromContext(new_scripts_buffer[i], context);
            new_scripts_buffer.splice(i, 1);
            i--;
        }
    }

    // OnEnable
    for (let i = 0; i < new_scripts_buffer.length; i++) {
        try {
            const script: IComponent = new_scripts_buffer[i];
            if (script.destroyed) continue;
            // console.log(script, script.enabled, script.activeAndEnabled);
            if (script.enabled === false) continue;
            updateActiveInHierarchyWithoutEventCall(script.gameObject);
            if (script.activeAndEnabled === false) continue;
            if (script.__internalEnable !== undefined) {
                script.enabled = true;
                utils.safeInvoke(script.__internalEnable.bind(script));
            }
        }
        catch (err) {
            console.error(err);
            removeScriptFromContext(new_scripts_buffer[i], context);
            new_scripts_buffer.splice(i, 1);
            i--;
        }
    }

    // Enqueue Start
    for (let i = 0; i < new_scripts_buffer.length; i++) {
        try {
            const script = new_scripts_buffer[i];
            if (script.destroyed) continue;
            if (!script.gameObject) continue;
            context.new_script_start.push(script);
        }
        catch (err) {
            console.error(err);
            removeScriptFromContext(new_scripts_buffer[i], context);
            new_scripts_buffer.splice(i, 1);
            i--;
        }
    }

    // for (const script of new_scripts_buffer) {
    //     if (script.destroyed) continue;
    //     context.scripts.push(script);
    // }
    new_scripts_buffer.length = 0;

    // if(new_scripts_post_setup_callbacks.length > 0) console.log(new_scripts_post_setup_callbacks);
    for (const cb of context.new_scripts_post_setup_callbacks) {
        if (cb)
            cb();
    }
    context.new_scripts_post_setup_callbacks.length = 0;
}

export function processRemoveFromScene(script: IComponent) {
    if (!script) return;
    script.__internalDisable();
    removeScriptFromContext(script, script.context);
}

export function processStart(context: IContext, object?: Object3D) {
    // Call start on scripts
    for (let i = 0; i < context.new_script_start.length; i++) {
        try {
            const script = context.new_script_start[i];
            if (object !== undefined && script.gameObject !== object) continue;
            if (script.destroyed) continue;
            if (script.activeAndEnabled === false) {
                continue;
            }
            // keep them in queue until script has started
            // call awake if the script was inactive before
            utils.safeInvoke(script.__internalAwake.bind(script));
            utils.safeInvoke(script.__internalEnable.bind(script));
            // now call start
            utils.safeInvoke(script.__internalStart.bind(script));
            context.new_script_start.splice(i, 1);
            i--;
        }
        catch (err) {
            console.error(err);
            removeScriptFromContext(context.new_script_start[i], context);
            context.new_script_start.splice(i, 1);
            i--;
        }
    }
}


export function addScriptToArrays(script: any, context: IContext) {
    // TODO: not sure if this is ideal - maybe we should add a map if we have many scripts?
    const index = context.scripts.indexOf(script);
    if (index !== -1) return;
    context.scripts.push(script);
    if (script.earlyUpdate) context.scripts_earlyUpdate.push(script);
    if (script.update) context.scripts_update.push(script);
    if (script.lateUpdate) context.scripts_lateUpdate.push(script);
    if (script.onBeforeRender) context.scripts_onBeforeRender.push(script);
    if (script.onAfterRender) context.scripts_onAfterRender.push(script);
    if (script.onPausedChanged) context.scripts_pausedChanged.push(script);
}


export function removeScriptFromContext(script: any, context: IContext) {
    removeFromArray(script, context.new_scripts);
    removeFromArray(script, context.new_script_start);
    removeFromArray(script, context.scripts);
    removeFromArray(script, context.scripts_earlyUpdate);
    removeFromArray(script, context.scripts_update);
    removeFromArray(script, context.scripts_lateUpdate);
    removeFromArray(script, context.scripts_onBeforeRender);
    removeFromArray(script, context.scripts_onAfterRender);
    removeFromArray(script, context.scripts_pausedChanged);
    context.stopAllCoroutinesFrom(script);
}

function removeFromArray(script: any, array: any[]) {
    const index = array.indexOf(script);
    if (index >= 0) array.splice(index, 1);
}

const previousActiveMap: { [key: string]: boolean } = {};
const previousActiveInHierarchyMap: { [key: string]: boolean } = {};

export function updateIsActive(obj?: Object3D) {
    if (!obj) obj = ContextRegistry.Current.scene;
    if (!obj) {
        console.trace("Invalid call - no current context.");
        return;
    }
    updateIsActiveInHierarchyRecursiveRuntime(obj, isActiveSelf(obj), true);
}

// const $wasSetVisibleBefore = Symbol("wasSetVisibleBefore");

function updateIsActiveInHierarchyRecursiveRuntime(go: THREE.Object3D, activeInHierarchy: boolean, allowEventCall: boolean) {
    let activeStateChanged: boolean = false;

    const active = isActiveSelf(go);

    // this is a test if we dont control active state from visibility and set
    // active to true by default (even if the object is invisible) in engine_gameobjects:isActiveSelf
    // then we need to check if the object is set to visible for the first time
    // const visible = go.visible;
    // if (!active && visible) {
    //     if (!go[$wasSetVisibleBefore]) {
    //         go[$wasSetVisibleBefore] = true;
    //         setActive(go, true);
    //     }
    // }

    // if (activeInHierarchy) {
    //     const prevActive = previousActiveMap[go.uuid];
    //     if (prevActive !== undefined) {
    //         if (prevActive !== active) {
    //             activeStateChanged = true;
    //             if (allowEventCall) {
    //                 perComponent(go, comp => {
    //                     if (active) {
    //                         utils.safeInvoke(comp.__internalAwake.bind(comp));
    //                         comp.onEnable();
    //                     }
    //                     else comp.onDisable();
    //                 });
    //             }
    //         }
    //     }
    // }
    previousActiveMap[go.uuid] = active;


    if (activeInHierarchy) activeInHierarchy = isActiveSelf(go);
    go[constants.activeInHierarchyFieldName] = activeInHierarchy;

    // only raise events here if we didnt call enable etc already
    if (!activeStateChanged) {
        const prevActiveInHierarchy = previousActiveInHierarchyMap[go.uuid];
        if (prevActiveInHierarchy !== undefined) {
            if (prevActiveInHierarchy !== activeInHierarchy) {
                // console.log("CHANGE", go.name, activeInHierarchy);
                if (allowEventCall) {
                    perComponent(go, comp => {
                        if (activeInHierarchy) {
                            utils.safeInvoke(comp.__internalAwake.bind(comp));
                            comp.enabled = true;
                            // comp.onEnable();
                        }
                        else comp.enabled = false;
                    });
                }
            }
        }
    }
    previousActiveInHierarchyMap[go.uuid] = activeInHierarchy;

    if (go.children) {
        for (const ch of go.children) {
            updateIsActiveInHierarchyRecursiveRuntime(ch, activeInHierarchy, allowEventCall);
        }
    }
}

export function updateActiveInHierarchyWithoutEventCall(go: THREE.Object3D) {
    let activeInHierarchy = true;
    let current: THREE.Object3D | null = go;
    let foundScene: boolean = false;
    while (current) {
        if (!current) break;
        if (current.type === "Scene") foundScene = true;
        if (!isActiveSelf(current)) {
            activeInHierarchy = false;
            break;
        }
        current = current.parent;
    }
    if (!go) {
        console.error("GO is null");
        return;
    }
    previousActiveInHierarchyMap[go.uuid] = activeInHierarchy;
    go[constants.activeInHierarchyFieldName] = activeInHierarchy && foundScene;
}

function perComponent(go: THREE.Object3D, evt: (comp: IComponent) => void) {
    if (go.userData?.components) {
        for (const comp of go.userData.components) {
            evt(comp);
        }
    }
}


const prewarmList: Map<IContext, Object3D[]> = new Map();
const $prewarmedFlag = Symbol("prewarmFlag");
const $waitingForPrewarm = Symbol("waitingForPrewarm");
const debugPrewarm = getParam("debugprewarm");

export function registerPrewarmObject(obj: Object3D, context: IContext) {
    if (!obj) return;
    // allow objects to be marked as prewarmed in which case we dont need to register them again
    if (obj[$prewarmedFlag] === true) return;
    if (obj[$waitingForPrewarm] === true) return;
    if (!prewarmList.has(context)) {
        prewarmList.set(context, []);
    }
    obj[$waitingForPrewarm] = true;
    const list = prewarmList.get(context);
    list!.push(obj);
    if(debugPrewarm) console.debug("register prewarm", obj.name);
}

let prewarmTarget: WebGLCubeRenderTarget | null = null;
let prewarmCamera: CubeCamera | null = null;

// called by the engine to remove scroll or animation hiccup when objects are rendered/compiled for the first time
export function runPrewarm(context: IContext) {
    if (!context) return;
    const list = prewarmList.get(context);
    if (!list?.length) return;

    const cam = context.mainCamera;
    if (cam) {
        if(debugPrewarm) console.log("prewarm", list.length, "objects", [...list]);
        const renderer = context.renderer;
        const scene = context.scene;
        renderer.compile(scene, cam!)
        prewarmTarget ??= new WebGLCubeRenderTarget(64)
        prewarmCamera ??= new CubeCamera(0.001, 9999999, prewarmTarget);
        prewarmCamera.update(renderer, scene);
        for (const obj of list) {
            obj[$prewarmedFlag] = true;
            obj[$waitingForPrewarm] = false;            
        }
        list.length = 0;
        if(debugPrewarm) console.log("prewarm done");
    }
}

export function clearPrewarmList(context: IContext) {
    const list = prewarmList.get(context);
    if (list) {
        for (const obj of list) {
            obj[$waitingForPrewarm] = false;
        }
        list.length = 0;
    }
    prewarmList.delete(context);
}