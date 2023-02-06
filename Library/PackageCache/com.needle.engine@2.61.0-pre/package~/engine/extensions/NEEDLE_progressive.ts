import { Material, Texture, TextureLoader } from "three";
import { GLTF, GLTFLoader, GLTFLoaderPlugin, GLTFParser } from "three/examples/jsm/loaders/GLTFLoader";
import { SourceIdentifier } from "../engine_types";
import { Context } from "../engine_setup";
import { addDracoAndKTX2Loaders } from "../engine_loaders";
import { delay, getParam, getPath } from "../engine_utils";

export const EXTENSION_NAME = "NEEDLE_progressive";

const debug = getParam("debugprogressive");

declare type ProgressiveTextureSchema = {
    uri: string;
    guid: string;
}


const debug_toggle_maps: Map<Material, { [key: string]: { original: Texture, lod0: Texture } }> = new Map();
let show_lod0 = false;
if (debug) {
    window.addEventListener("keyup", evt => {
        if (evt.key === "p") {
            debug_toggle_maps.forEach((map, material) => {
                Object.entries(map).forEach(([key, value]) => {
                    if (show_lod0) {
                        material[key] = value.lod0;
                    } else {
                        material[key] = value.original;
                    }
                    material.needsUpdate = true;
                });
            });
            show_lod0 = !show_lod0;
        }
    });
}

export class NEEDLE_progressive implements GLTFLoaderPlugin {

    static assignTextureLOD(context: Context, source: SourceIdentifier | undefined, material: Material, level: number = 0) {
        if (!material) return;
        for (let slot of Object.keys(material)) {
            const val = material[slot];
            if (val?.isTexture === true) {

                if (debug) console.log("-----------\n", "FIND", material.name, slot, val?.name, val?.userData, val, material);

                NEEDLE_progressive.getOrLoadTexture(context, source, material, slot, val, level).then(t => {
                    if (t?.isTexture === true) {

                        if (debug) console.log("Assign LOD", material.name, slot, t.name, t["guid"], material, "Prev:", val, "Now:", t, "\n--------------");

                        material[slot] = t;
                        t.needsUpdate = true;
                        material.needsUpdate = true;

                        if (debug) {
                            let debug_map = debug_toggle_maps.get(material);
                            if (!debug_map) {
                                debug_map = {};
                                debug_toggle_maps.set(material, debug_map);
                            }
                            let entry = debug_map[slot];
                            if (!entry) {
                                entry = debug_map[slot] = { original: val, lod0: t };
                            }
                            entry.lod0 = t;
                        }
                    }
                });
            }
        }
    }

    get name(): string {
        return EXTENSION_NAME;
    }

    private parser: GLTFParser;
    private sourceId: SourceIdentifier;
    private context: Context;

    constructor(parser: GLTFParser, sourceId: SourceIdentifier, context: Context) {
        this.parser = parser;
        this.sourceId = sourceId;
        this.context = context;
    }

    private _loading: number[] = [];

    // beforeRoot(): null {
    //     console.log("BEFORE ROOT", this.parser);
    //     return null;
    // }

    // loadTexture(index: number): Promise<Texture> | null {
    //     console.log(index, this._loading);
    //     if (this._loading.includes(index)) return null;
    //     const textureInfo = this.parser.json.textures[index];
    //     if (debug)
    //         console.log(index, textureInfo);
    //     return null;
    // }

    afterRoot(gltf: GLTF): null {
        if (debug)
            console.log("AFTER", this.sourceId, gltf);
        this.parser.json.textures?.forEach((textureInfo, index) => {
            if (textureInfo?.extensions) {
                const ext: ProgressiveTextureSchema = textureInfo?.extensions[EXTENSION_NAME];
                if (ext) {
                    const prom = this.parser.getDependency("texture", index);
                    this._loading.splice(this._loading.indexOf(index), 1);
                    prom.then(t => {
                        if (debug) console.log("register texture", t.name, t.uuid, ext);
                        t.userData.deferred = ext;
                        NEEDLE_progressive.cache.set(t.uuid, ext);
                    });
                }
            }
        });

        return null;
    }

    private static cache = new Map<string, ProgressiveTextureSchema>();
    private static resolved: { [key: string]: Texture } = {};
    private static currentlyLoading: { [key: string]: Promise<Texture | null> } = {};

    private static async getOrLoadTexture(context: Context, source: SourceIdentifier | undefined, material: Material, slot: string, current: Texture, _level: number): Promise<Texture | null> {

        const key = current.uuid;
        const ext: ProgressiveTextureSchema | undefined = NEEDLE_progressive.cache.get(key);// || current.userData.deferred;
        if (ext) {
            if (debug)
                console.log(key, ext.uri, ext.guid);
            const uri = getPath(source, ext.uri);
            if (uri.endsWith(".glb") || uri.endsWith(".gltf")) {
                if (!ext.guid) {
                    console.warn("missing pointer for glb/gltf texture", ext);
                    return null;
                }
                const resolveKey = uri + "_" + ext.guid;
                if (this.resolved[resolveKey]) {
                    if (debug) console.log("Texture has already been loaded: " + resolveKey, material.name, slot, current.name);
                    return this.resolved[resolveKey];
                }

                const info = this.onProgressiveLoadStart(context, source, uri, material, slot);
                try {
                    if(this.currentlyLoading[resolveKey] !== undefined) {
                        if(debug)
                            console.log("Already loading:", material.name + "." + slot, resolveKey);
                        const tex = await this.currentlyLoading[resolveKey];
                        return tex;
                    }
                    const request = new Promise<Texture | null>(async (resolve, _) => {
                        const loader = new GLTFLoader();
                        addDracoAndKTX2Loaders(loader, context);

                        if (debug) console.log("Load " + uri, material.name, slot, ext.guid);
                        if (debug) {
                            await delay(Math.random() * 1000);
                        }

                        const gltf = await loader.loadAsync(uri);
                        const parser = gltf.parser;
                        if (debug) console.log("Loading finished " + uri, material.name, slot, ext.guid);
                        let index = -1;
                        let found = false;
                        for (const tex of gltf.parser.json.textures) {
                            index++;
                            if (tex?.extensions) {
                                const other: ProgressiveTextureSchema = tex?.extensions[EXTENSION_NAME];
                                if (other?.guid) {
                                    if (other.guid === ext.guid) {
                                        found = true;
                                        break;
                                    }
                                }
                            }
                        }
                        if (!found)
                            return resolve(null);

                        const tex = await parser.getDependency("texture", index);
                        tex.encoding = current.encoding;
                        if (tex) {
                            tex.guid = ext.guid;
                        }
                        this.resolved[resolveKey] = tex as Texture;
                        if (debug)
                            console.log(material.name, slot, "change \"" + current.name + "\" → \"" + tex.name + "\"", uri, index, tex, material, resolveKey);
                        resolve(tex);
                    });
                    this.currentlyLoading[resolveKey] = request;
                    const tex = await request;
                    return tex;
                }
                finally {
                    delete this.currentlyLoading[resolveKey];
                    this.onProgressiveLoadEnd(info);
                }
            }
            else {
                const info = this.onProgressiveLoadStart(context, source, uri, material, slot);
                try {
                    if (debug) console.log("Load texture from uri: " + uri);
                    const loader = new TextureLoader();
                    const tex = await loader.loadAsync(uri);
                    if (tex) {
                        (tex as any).guid = ext.guid;
                        tex.flipY = false;
                        tex.needsUpdate = true;
                        tex.encoding = current.encoding;
                        if (debug)
                            console.log(ext, tex);
                    }
                    else if (debug) console.warn("failed loading", uri);
                    return tex;
                }
                finally {
                    this.onProgressiveLoadEnd(info);
                }
            }
            // loader.then((h: Texture) => {
            //     // console.log(t, h);
            //     // t.image = h.image;
            //     // // this.context.renderer.copyTextureToTexture(new Vector2(0, 0), h, t);
            //     // // console.log(h);

            //     // // t.source = h.source;
            //     // // t.version++;
            //     // t.width = h.width;
            //     // t.height = h.height;
            //     // t.needsUpdate = true;
            // });
        }
        else {
            if (debug)
                console.warn("unknown uuid", current.name, current.uuid, current);
        }
        return null;
    }


    /** subscribe to events whenever a loading event starts, invoked for every single loading process that starts */
    static beginListenStart(context: Context, evt: ProgressiveLoadingEvent) {
        if (!this._progressiveEventListeners.has(context)) {
            this._progressiveEventListeners.set(context, new ProgressiveLoadingEventHandler());
        }
        this._progressiveEventListeners.get(context)!.start.push(evt);
    }
    static stopListenStart(context: Context, evt: ProgressiveLoadingEvent) {
        if (!this._progressiveEventListeners.has(context)) {
            return;
        }
        const listeners = this._progressiveEventListeners.get(context)!.start;
        const index = listeners.indexOf(evt);
        if (index >= 0) {
            listeners.splice(index, 1);
        }
    }

    /** subscribe to loading event ended event */
    static beginListenEnd(context: Context, evt: ProgressiveLoadingEvent) {
        if (!this._progressiveEventListeners.has(context)) {
            this._progressiveEventListeners.set(context, new ProgressiveLoadingEventHandler());
        }
        this._progressiveEventListeners.get(context)!.end.push(evt);
    }
    static stopListenEnd(context: Context, evt: ProgressiveLoadingEvent) {
        if (!this._progressiveEventListeners.has(context)) {
            return;
        }
        const listeners = this._progressiveEventListeners.get(context)!.end;
        const index = listeners.indexOf(evt);
        if (index >= 0) {
            listeners.splice(index, 1);
        }
    }

    /** event listeners per context */
    private static _progressiveEventListeners: Map<Context, ProgressiveLoadingEventHandler> = new Map();
    //** loading info per context, contains an array of urls that are currently being loaded */
    private static _currentProgressiveLoadingInfo: Map<Context, ProgressiveLoadingInfo[]> = new Map();

    // called whenever a progressive loading event starts
    private static onProgressiveLoadStart(context: Context, source: SourceIdentifier | undefined, uri: string, material: Material, slot: string): ProgressiveLoadingInfo {
        if (!this._currentProgressiveLoadingInfo.has(context)) {
            this._currentProgressiveLoadingInfo.set(context, []);
        }
        const info = new ProgressiveLoadingInfo(context, source, uri, material, slot);
        const current = this._currentProgressiveLoadingInfo.get(context)!;
        const listener = this._progressiveEventListeners.get(context);
        if (listener) listener.onStart(info);

        current.push(info);
        return info;
    }

    private static onProgressiveLoadEnd(info: ProgressiveLoadingInfo) {
        if (!info) return;
        const context = info.context;
        if (!this._currentProgressiveLoadingInfo.has(context)) {
            return;
        }
        const current = this._currentProgressiveLoadingInfo.get(context)!;
        const index = current.indexOf(info);
        if (index < 0) {
            return;
        }
        current.splice(index, 1);
        const listener = this._progressiveEventListeners.get(context);
        if (listener) listener.onEnd(info);
    }
}


/** info object that holds information about a file that is currently being loaded */
export class ProgressiveLoadingInfo {
    readonly context: Context;
    readonly source: SourceIdentifier | undefined;
    readonly uri: string;
    readonly material?: Material;
    readonly slot?: string;
    // TODO: can contain information if the event is a background process / preloading or if the object is currently visible

    constructor(context: Context, source: SourceIdentifier | undefined, uri: string, material?: Material, slot?: string) {
        this.context = context;
        this.source = source;
        this.uri = uri;
        this.material = material;
        this.slot = slot;
    }
};


export declare type ProgressiveLoadingEvent = (info: ProgressiveLoadingInfo) => void;

/** progressive loading event handler implementation */
class ProgressiveLoadingEventHandler {
    start: ProgressiveLoadingEvent[] = [];
    end: ProgressiveLoadingEvent[] = [];

    onStart(listener: ProgressiveLoadingInfo) {
        for (const l of this.start) {
            l(listener);
        }
    }

    onEnd(listener: ProgressiveLoadingInfo) {
        for (const l of this.end) {
            l(listener);
        }
    }
}
