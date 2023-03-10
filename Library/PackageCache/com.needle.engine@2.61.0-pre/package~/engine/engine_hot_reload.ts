import { IComponent } from "./engine_types";
import { TypeStore } from "./engine_typestore";
import { addScriptToArrays, removeScriptFromContext } from "./engine_mainloop_utils"
import { showBalloonWarning } from "./debug/debug";
import { getParam } from "./engine_utils";
import { addLog, LogType } from "./debug/debug_overlay";

const debug = getParam("debughotreload");

declare type BeforeUpdateArgs = {
    type: string,
    updates: Array<{ path: string, timestamp: number, acceptedPath: string, explicitImportRequired: boolean, type: string }>,
}

//@ts-ignore
if (import.meta.hot) {
    //@ts-ignore
    import.meta.hot.on('vite:beforeUpdate', (cb: BeforeUpdateArgs) => {
        if (debug) console.log(cb);
        for (const update of cb.updates) {
            console.log("[Needle Engine] Hot reloading " + update.path);
        }
    });
}


let isApplyingChanges = false;

const instances: Map<string, object[]> = new Map();

/** true during hot reload, can be used to modify behaviour in onEnable and onDisable */
export function isHotReloading() {
    return isApplyingChanges;
}

export function register(instance: object) {
    if (isApplyingChanges) return;
    const type = instance.constructor;
    const name = type.name;
    if (!instances.has(name)) {
        instances.set(name, [instance]);
    }
    else {
        instances.get(name)?.push(instance);
    }
}

export function unregister(instance: object) {
    if (isApplyingChanges) return;
    const type = instance.constructor;
    const name = type.name;
    const instancesOfType = instances.get(name);
    if (!instancesOfType) return;
    const idx = instancesOfType.indexOf(instance);
    if (idx === -1) return;
    instancesOfType.splice(idx, 1);
}


let didRegisterUnhandledExceptionListener = false;
function reloadPageOnHotReloadError() {
    if (debug) return;
    if (didRegisterUnhandledExceptionListener) return;
    didRegisterUnhandledExceptionListener = true;

    const error = console.error;
    console.error = (...args: any[]) => {
        if (args.length) {
            const arg: string = args[0];
            // When making changes in e.g. the engine package and then making changes in project scripts again that import the engine package: hot reload fails and reports redefinitions of types, we just reload the page in those cases for now
            // editing a script in one package seems to work for now so it should be good enough for a start
            if (typeof arg === "string" && arg.includes("[hmr] Failed to reload ")) {
                console.log("[Needle Engine] Hot reloading failed")
                window.location.reload();
                return;
            }

        }
        error.apply(console, args);
    };
}


export function applyChanges(newModule): boolean {

    if (debug)
        console.log("Hot Reload - apply changes");

    reloadPageOnHotReloadError();

    // console.dir(newModule);

    for (const key of Object.keys(newModule)) {
        try {
            isApplyingChanges = true;

            const typeToUpdate = TypeStore.get(key);
            if (!typeToUpdate) {
                continue;
            }
            const newType = newModule[key];
            const instancesOfType = instances.get(newType.name);

            let hotReloadMessage = "[Needle Engine] Updating type: " + key;
            let typesCount = instancesOfType?.length ?? -1;
            if (typesCount > 0) hotReloadMessage += " x" + typesCount;
            else hotReloadMessage += " - no instances";
            console.log(hotReloadMessage);

            // Update prototype (methods and properties)
            const previousMethods = Object.getOwnPropertyNames(typeToUpdate.prototype);
            const methodsAndProperties = Object.getOwnPropertyDescriptors(newType.prototype);
            for (const typeKey in methodsAndProperties) {
                const desc = methodsAndProperties[typeKey];
                if (!desc.writable) continue;
                typeToUpdate.prototype[typeKey] = newModule[key].prototype[typeKey];
            }
            // Remove methods that are no longer present
            for (const typeKey of previousMethods) {
                if (!methodsAndProperties[typeKey]) {
                    delete typeToUpdate.prototype[typeKey];
                }
            }

            // Update fields (we only add new fields if they are undefined)
            // we create a instance to get access to the fields
            if (instancesOfType) {
                const newTypeInstance = new newType();
                const keys = Object.getOwnPropertyDescriptors(newTypeInstance);
                for (const inst of instancesOfType) {
                    const componentInstance = inst as unknown as IComponent;
                    const isComponent = componentInstance.isComponent === true;
                    const active = isComponent ? componentInstance.activeAndEnabled : true;
                    const context = isComponent ? componentInstance.context : undefined;
                    try {
                        if (isComponent) {
                            removeScriptFromContext(componentInstance, context);
                        }
                        if (isComponent && active) {
                            componentInstance.enabled = false;
                        }

                        if (inst["onBeforeHotReloadFields"]) {
                            const res = inst["onBeforeHotReloadFields"]();
                            if (res === false) continue;
                        }
                        for (const key in keys) {
                            const desc = keys[key];
                            if (!desc.writable) continue;
                            if (inst[key] === undefined) {
                                inst[key] = newTypeInstance[key];
                            }
                            // if its a function but not on the prototype
                            // then its a bound method that needs to be rebound
                            else if (typeof inst[key] === "function" && !inst[key].prototype) {
                                const boundMethod = inst[key];
                                // try to get the target method name
                                const targetMethodName = boundMethod.name;
                                const prefix = "bound "; // < magic prefix
                                if (targetMethodName === prefix) continue;
                                const name = boundMethod.name.substring(prefix.length);
                                // if the target method name still exists on the new prototype
                                // we want to rebind it and assign it to the field
                                // Beware that this will not work if the method is added to some event listener etc
                                const newTarget = newType.prototype[name];
                                if (newTarget)
                                    inst[key] = newTarget.bind(inst);
                            }
                        }
                        if (inst["onAfterHotReloadFields"]) inst["onAfterHotReloadFields"]();
                    }
                    finally {
                        if (isComponent) {
                            addScriptToArrays(componentInstance, context);
                        }
                        if (isComponent && active) {
                            componentInstance.enabled = true;
                        }
                    }
                }
            }
        }
        catch (err) {
            if (debug) console.error(err);
            // we only want to invalidate changes if we debug hot reload
            else return false;
        }
        finally {
            isApplyingChanges = false;
            addLog(LogType.Log, "Script changes applied (HMR)")
        }
    }

    return true;
}


