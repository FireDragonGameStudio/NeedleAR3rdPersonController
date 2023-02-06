import { IExtensionReferenceResolver } from "./extension_resolver";
import { GLTFParser } from "three/examples/jsm/loaders/GLTFLoader";
import { debugExtension } from "../engine_default_parameters";
import { getParam } from "../engine_utils";

const debug = getParam("debugresolvedependencies");

declare type DependencyInfo = {
    prefix: string,
    dependencyName: string,
}

const rootExtensionPrefix = ["/extensions/", "extensions/"];
const defaultDependencies = [
    { prefix: "/nodes/", dependencyName: "node" },
    { prefix: "/meshes/", dependencyName: "mesh" },
    { prefix: "/materials/", dependencyName: "material" },
    { prefix: "/textures/", dependencyName: "texture" },
    { prefix: "/animations/", dependencyName: "animation" },

    // legacy support
    { prefix: "nodes/", dependencyName: "node" },
    { prefix: "meshes/", dependencyName: "mesh" },
    { prefix: "materials/", dependencyName: "material" },
    { prefix: "textures/", dependencyName: "texture" },
    { prefix: "animations/", dependencyName: "animation" },
]

export async function resolveReferences(parser: GLTFParser, obj) {
    if(debug) console.log(parser, obj);
    const arr: Promise<void>[] = [];
    internalResolve(defaultDependencies, parser, obj, arr);
    const res = await Promise.all(arr);
    if (typeof obj === "string" && res.length === 1) return res[0];
    return res;
}


function internalResolve(paths: DependencyInfo[], parser: GLTFParser, obj, promises: Promise<void>[]) {
    if (typeof obj === "object" && obj !== undefined && obj !== null) {
        for (const key of Object.keys(obj)) {
            const val = obj[key];
            // handle json pointer in string variable
            if (typeof val === "string") {
                const ext = resolveExtension(parser, val);
                if (ext !== null) {
                    if (typeof ext.then === "function")
                        promises.push(ext.then(res => obj[key] = res));
                    else obj[key] = ext;
                }
                else {
                    // e.g. prefix = "materials/";
                    for (const dep of paths) {
                        const index = tryGetIndex(dep.prefix, val);
                        if (index >= 0) {
                            // e.g. dependencyName = "material"
                            if (debug) console.log(dep, index, dep.dependencyName);
                            promises.push(parser?.getDependency(dep.dependencyName, index).then(res => {
                                obj[key] = res;
                                return res;
                            }));
                            break;
                        }
                    }
                }
            }
            // handle json pointers in arrays
            else if (Array.isArray(val)) {
                for (let i = 0; i < val.length; i++) {
                    const entry = val[i];
                    const ext = resolveExtension(parser, entry);
                    if (ext !== null) {
                        if (typeof ext.then === "function")
                            promises.push(ext.then(res => val[i] = res));
                        else val[i] = ext;
                        continue;
                    }
                    for (const dep of paths) {
                        const index = tryGetIndex(dep.prefix, entry);
                        if (index >= 0) {
                            if (debug) console.log(dep, index, dep.dependencyName);
                            promises.push(parser?.getDependency(dep.dependencyName, index).then(res => val[i] = res));
                            break;
                        }
                    }
                    // recurse
                    if (typeof entry === "object") {
                        internalResolve(paths, parser, entry, promises);
                    }
                }
            }
            // recurse
            else if (typeof val === "object") {
                internalResolve(paths, parser, val, promises);
            }
        }
    }
    else if (typeof obj === "string") {
        tryResolveDependency(paths, parser, obj, promises);
    }
}


function resolveExtension(parser: GLTFParser, str): Promise<void> | null {
    if (parser && parser.plugins && typeof str === "string") {
        for (const prefix of rootExtensionPrefix) {
            if (str.startsWith(prefix)) {
                let name = str.substring(prefix.length);
                const endIndex = name.indexOf("/");
                if (endIndex >= 0) name = name.substring(0, endIndex);
                const ext = parser.plugins[name] as IExtensionReferenceResolver;
                if (debugExtension)
                    console.log(name, ext);
                if (typeof ext?.resolve === "function") {
                    const path = str.substring(prefix.length + name.length + 1);
                    return ext.resolve(parser, path);
                }
                break;
            }
        }
    }
    return null;
}

function tryResolveDependency(paths: DependencyInfo[], parser: GLTFParser, str: string, promises: Promise<void>[]): boolean {
    for (const dep of paths) {
        const index = tryGetIndex(dep.prefix, str);
        if (index >= 0) {
            // e.g. dependencyName = "material"
            if (debug) console.log(dep, index, dep.dependencyName);
            promises.push(parser?.getDependency(dep.dependencyName, index).then(res => {
                return res;
            }));
            return true;
        }
    }
    return false;
}

function tryGetIndex(prefix: string, str: string): number {

    if (typeof str === "string" && str.startsWith(prefix)) {
        const part = str.substring(prefix.length);
        const index = Number.parseInt(part);
        if (index >= 0) {
            return index;
        }
    }
    return -1;
}