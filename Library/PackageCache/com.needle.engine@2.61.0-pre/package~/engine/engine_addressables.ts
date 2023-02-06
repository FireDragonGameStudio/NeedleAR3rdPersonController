import { getParam, getPath } from "../engine/engine_utils";
// import { loadSync, parseSync } from "./engine_scenetools";
import { SerializationContext, TypeSerializer } from "./engine_serialization_core";
import { Context } from "./engine_setup";
import { Group, Object3D, Scene } from "three";
import { processNewScripts } from "./engine_mainloop_utils";
import { registerPrefabProvider, syncInstantiate } from "./engine_networking_instantiate";
import { download, hash } from "./engine_web_api";
import { getLoader } from "./engine_gltf";
import { SourceIdentifier } from "./engine_types";
import { destroy, instantiate, InstantiateOptions, isDestroyed } from "./engine_gameobject";
import { IGameObject } from "./engine_types";

const debug = getParam("debugaddressables");

export class Addressables {

    private _context: Context;

    constructor(context: Context) {
        this._context = context;
        this._context.pre_update_callbacks.push(this.preUpdate.bind(this));
    }

    private preUpdate() {

    }

    private _assetReferences: { [key: string]: AssetReference } = {};

    findAssetReference(uri: string): AssetReference | null {
        return this._assetReferences[uri] || null;
    }

    registerAssetReference(ref: AssetReference): AssetReference {
        if (!ref.uri) return ref;
        if (!this._assetReferences[ref.uri]) {
            this._assetReferences[ref.uri] = ref;
        }
        else {

            console.warn("Asset reference already registered", ref);
        }
        return ref;
    }
}

export type ProgressCallback = (asset: AssetReference, prog: ProgressEvent) => void;

export class AssetReference {

    static getOrCreate(sourceId: SourceIdentifier, uri: string, context: Context): AssetReference {
        const fullPath = getPath(sourceId, uri);
        if (debug) console.log("GetOrCreate Addressable from", sourceId, uri, "FinalPath=", fullPath);
        const addressables = context.addressables;
        const existing = addressables.findAssetReference(fullPath);
        if (existing) return existing;
        const ref = new AssetReference(fullPath, context.hash);
        addressables.registerAssetReference(ref);
        return ref;
    }

    private static currentlyInstantiating: string[] = [];

    get asset(): any {
        return this._glbRoot ?? this._asset;
    }

    protected set asset(val: any) {
        this._asset = val;
    }

    private _loading?: PromiseLike<any>;

    get uri(): string {
        return this._uri;
    }

    get rawAsset(): any { return this._asset; }

    private _asset: any;
    private _glbRoot?: Object3D | null;
    private _uri: string;
    private _progressListeners: ProgressCallback[] = [];

    private _hash?: string;
    private _hashedUri: string;

    private _isLoadingRawBinary: boolean = false;
    private _rawBinary?: ArrayBuffer | null;

    constructor(uri: string, hash?: string) {
        this._uri = uri;
        this._hash = hash;
        if (uri.includes("?v="))
            this._hashedUri = uri;
        else
            this._hashedUri = hash ? uri + "?v=" + hash : uri;

        registerPrefabProvider(this._uri, this.onResolvePrefab.bind(this));
    }

    private async onResolvePrefab(uri: string): Promise<IGameObject | null> {
        if (uri === this.uri) {
            if (this.mustLoad) await this.loadAssetAsync();
            if (this.asset) {
                return this.asset;
            }
        }
        return null;
    }

    private get mustLoad() {
        return !this.asset || this.asset.__destroyed === true || isDestroyed(this.asset) === true;
    }

    isLoaded() { return this._rawBinary || this.asset !== undefined }

    unload() {
        if (this.asset) {
            if (debug) console.log("Unload", this.asset);
            // TODO: we need a way to remove objects from the context (including components) without actually "destroying" them
            if (this.asset.scene)
                destroy(this.asset.scene, true);
            else destroy(this.asset, true);
        }
        this.asset = null;
        this._rawBinary = undefined;
    }

    async preload(): Promise<ArrayBuffer | null> {
        if (!this.mustLoad) return null;
        if (this._isLoadingRawBinary) return null;
        if (this._rawBinary !== undefined) return this._rawBinary;
        this._isLoadingRawBinary = true;
        if (debug) console.log("Preload", this._hashedUri);
        const res = await download(this._hashedUri, p => {
            this.raiseProgressEvent(p);
        });
        this._rawBinary = res?.buffer ?? null;
        this._isLoadingRawBinary = false;
        return this._rawBinary;
    }

    async loadAssetAsync(prog?: ProgressCallback | null) {
        if (debug)
            console.log("loadAssetAsync", this.uri);
        if (!this.mustLoad) return this.asset;
        if (prog)
            this._progressListeners.push(prog);
        if (this._loading !== undefined) {
            // console.warn("Wait for other loading thiny");
            return this._loading;
        }
        const context = Context.Current;
        // TODO: technically we shouldnt call awake only when the object is added to a scene
        // addressables now allow loading things without adding them to a scene immediately
        // we should "address" (LUL) this
        // console.log("START LOADING");
        if (this._rawBinary) {
            this._loading = getLoader().parseSync(context, this._rawBinary, this.uri, null);
            this.raiseProgressEvent(new ProgressEvent("progress", { loaded: this._rawBinary.byteLength, total: this._rawBinary.byteLength }));
        }
        else {
            if (debug) console.log("Load async", this.uri);
            this._loading = getLoader().loadSync(context, this._hashedUri, null, true, prog => {
                this.raiseProgressEvent(prog);
            });
        }
        const res = await this._loading;
        // clear all progress listeners after download has finished
        this._progressListeners.length = 0;
        this._glbRoot = this.tryGetActualGameObjectRoot(res);
        this._loading = undefined;
        if (res) {
            // we need to handle the pre_setup callsbacks before instantiating
            // because that is where deserialization happens
            processNewScripts(context);

            if (res.scene !== undefined) {
                this.asset = res;
            }
            return this.asset;
        }
    }

    async instantiate(parent?: THREE.Object3D | InstantiateOptions) {
        return this.onInstantiate(parent, false);
    }

    async instantiateSynced(parent?: THREE.Object3D | InstantiateOptions, saveOnServer: boolean = true) {
        return this.onInstantiate(parent, true, saveOnServer);
    }

    beginListenDownload(evt: ProgressCallback) {
        if (this._progressListeners.indexOf(evt) < 0)
            this._progressListeners.push(evt);
    }

    endListenDownload(evt: ProgressCallback) {
        const index = this._progressListeners.indexOf(evt);
        if (index >= 0) {
            this._progressListeners.splice(index, 1);
        }
    }

    private raiseProgressEvent(prog: ProgressEvent) {
        for (const list of this._progressListeners) {
            list(this, prog);
        }
    }

    private async onInstantiate(parent?: THREE.Object3D | InstantiateOptions, networked: boolean = false, saveOnServer?: boolean) {
        const context = Context.Current;
        if (!parent) parent = context.scene;
        if (this.mustLoad) {
            await this.loadAssetAsync();
        }
        if (debug)
            console.log("Instantiate", this.uri, "parent:", parent);

        if (this.asset) {
            if (debug) console.log("Add to scene", this.asset);

            let options = parent instanceof InstantiateOptions ? parent : null;
            if (!options) {
                options = new InstantiateOptions();
            }

            if (typeof parent === "object") {
                if (parent instanceof Object3D) {
                    options.parent = parent;
                }
                else {
                    Object.assign(options, parent);
                }
            }

            if (AssetReference.currentlyInstantiating.indexOf(this.uri) >= 0) {
                console.error("Recursive instantiation of", this.uri);
                return null;
            }
            try {
                AssetReference.currentlyInstantiating.push(this.uri);
                if (networked) {
                    options.context = context;
                    const prefab = this.asset;
                    prefab.guid = this.uri;
                    const instance = syncInstantiate(prefab, options, undefined, saveOnServer);
                    if (instance) {
                        return instance;
                    }
                }
                else {
                    const instance = instantiate(this.asset, options);
                    if (instance) {
                        return instance;
                    }
                }
            }
            finally {
                context.post_render_callbacks.push(() => AssetReference.currentlyInstantiating.pop());
            }

        }
        else if (debug) console.warn("Failed to load asset", this.uri);
        return null;
    }

    /**
     * try to ignore the intermediate created object
     * because it causes trouble if we instantiate an assetreference per player
     * and call destroy on the player marker root
     * @returns the scene root object if the asset was a glb/gltf
     */
    private tryGetActualGameObjectRoot(asset: any): THREE.Object3D | null {
        if (asset && asset.scene) {
            // some exporters produce additional root objects
            const scene = asset.scene as Group;
            if (scene.isGroup && scene.children.length === 1 && scene.children[0].name + "glb" === scene.name) {
                const root = scene.children[0];
                return root;
            }
            // ok the scene is the scene, just use that then
            else
                return scene;
        }
        return null;
    }

}




class AddressableSerializer extends TypeSerializer {

    constructor() {
        super([AssetReference]);
    }

    onSerialize(data: any, _context: SerializationContext) {
        if (data && data.uri !== undefined && typeof data.uri === "string") {
            return data.uri;
        }
    }

    onDeserialize(data: any, context: SerializationContext) {
        if (typeof data === "string") {
            if (!context.context) {
                console.error("Missing context");
                return null;
            }
            if (!context.gltfId) {
                console.error("Missing spurce id");
                return null;
            }
            const ref = AssetReference.getOrCreate(context.gltfId, data, context.context);
            return ref;
        }
        return null;
    }

}
new AddressableSerializer();