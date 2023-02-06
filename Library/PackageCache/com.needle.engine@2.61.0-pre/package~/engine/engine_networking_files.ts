import { Context } from "../engine/engine_setup";
// import { loadSync, parseSync } from "../engine/engine_scenetools";
import * as THREE from "three";
import * as web from "../engine/engine_web_api";
import { NetworkConnection } from "../engine/engine_networking";
import { generateSeed, InstantiateIdProvider } from "../engine/engine_networking_instantiate";
import * as def from "./engine_networking_files_default_components"
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { getLoader } from "../engine/engine_gltf";
import { IModel } from "./engine_networking_types";
import { IGameObject } from "./engine_types";
import { findByGuid } from "./engine_gameobject";
import { ContextEvent, ContextRegistry } from "./engine_context_registry";

export enum File_Event {
    File_Spawned = "file-spawned",
}

export class FileSpawnModel implements IModel {
    guid: string;
    file_name: string;
    file_hash: string;
    file_size: number;
    position: THREE.Vector3 | null;
    seed: number;
    sender: string;
    serverUrl: string;
    parentGuid?: string;

    boundsSize?: THREE.Vector3;

    constructor(connectionId: string, seed: number, guid: string, name: string, hash: string, size: number, position: THREE.Vector3 | null, serverUrl: string) {
        this.seed = seed;
        this.guid = guid;
        this.file_name = name;
        this.file_hash = hash;
        this.file_size = size;
        this.position = position;
        this.sender = connectionId;
        this.serverUrl = serverUrl;
    }
}


export async function addFile(file: File, context: Context, backendUrl?: string): Promise<GLTF | null> {

    const name = file.name;
    if (name.endsWith(".gltf") || name.endsWith(".glb")) {
        return new Promise((resolve, _reject) => {
            const reader = new FileReader()
            reader.readAsDataURL(file);
            reader.onloadend = async (_ev: ProgressEvent<FileReader>) => {
                const content = reader.result as string;
                // first load it locally
                const seed = generateSeed();
                const prov = new InstantiateIdProvider(seed);
                const gltf: GLTF = await getLoader().loadSync(context, content, prov, true) as GLTF;
                if (gltf && gltf.scene) {
                    const obj = gltf.scene as unknown as IGameObject;
                    // if we dont have a guid yet (because components guids are actually created in a callback a bit later)
                    // we just use the same seed and generate a guid for the root only
                    // this should be the exact same guid the instantiate call will produce
                    if (!obj.guid) {
                        const prov = new InstantiateIdProvider(seed);
                        obj.guid = prov.generateUUID();
                    }
                    if (backendUrl)
                        handleUpload(context.connection, file, seed, obj, backendUrl);
                    def.onDynamicObjectAdded(obj, prov, gltf);
                    resolve(gltf);
                }
            };
        });
    }
    else {
        console.warn("Unsupported file type: " + name);
        console.log(file);
    }

    return null;
}

export async function addFileFromUrl(url: URL, context: Context): Promise<GLTF | null> {

    return new Promise(async (resolve, _reject) => {
        const seed = generateSeed();
        const prov = new InstantiateIdProvider(seed);
        const gltf: GLTF = await getLoader().loadSync(context, url.toString(), prov, true) as GLTF;
        if (gltf && gltf.scene) {
            const obj = gltf.scene as unknown as IGameObject;
            // handleUpload(context.connection, file, seed, obj); // TODO needs to upload the URL only and store that
            def.onDynamicObjectAdded(obj, prov, gltf);
            resolve(gltf);
        }
        else {
            console.warn("Unsupported file type: " + url.toString());
        }
    });
}


ContextRegistry.registerCallback(ContextEvent.ContextCreated, evt => {
    beginListenFileSpawn(evt.context as Context);
})


export function beginListenFileSpawn(context: Context) {
    context.connection.beginListen(File_Event.File_Spawned, async (evt: FileSpawnModel) => {
        if (evt.sender !== context.connection.connectionId) {
            console.log("received file event", evt);
            addPreview(evt, context);
            let bin: ArrayBuffer | null = null;
            try {
                bin = await web.download_file(evt.file_name, evt.file_hash, evt.file_size, evt.serverUrl);
            }
            finally {
                removePreview(evt, context);
            }
            if (bin) {
                const prov = new InstantiateIdProvider(evt.seed);
                const gltf = await getLoader().parseSync(context, bin, null!, prov);
                if (gltf && gltf.scene) {
                    const obj = gltf.scene;
                    def.onDynamicObjectAdded(obj, prov, gltf);
                    // if we process new scripts immediately references that rely on guids are not properly resolved
                    // for example duplicatable "object" reference will not be found anymore because guid has changed
                    // processNewScripts(context);

                    // add object to proper parent
                    if (evt.parentGuid) {
                        const parent = findByGuid(evt.parentGuid, context.scene) as THREE.Object3D;
                        if ("add" in parent) parent.add(obj);
                    }
                    if (!obj.parent)
                        context.scene.add(obj);

                    if (evt.position !== null) {
                        obj.position.copy(evt.position);
                    }
                }
            }
            else console.error("download didnt return file");
        }
    });
}



async function handleUpload(connection: NetworkConnection, file: File, seed: number, obj: IGameObject, backendUrl: string) {
    if (!connection.connectionId) {
        console.error("Can not upload file - no connection id");
        return;
    }
    if (!obj.guid) {
        console.error("Can not upload file - no guid", obj, obj.guid);
        return;
    }
    // then try uploading it
    const upload_result = await web.upload_file(file, backendUrl);
    if (!upload_result) {
        return;
    }
    if (!upload_result.filename) {
        console.error("Can not send upload event - no filename", file.name);
        return;
    }
    if (!upload_result.hash) {
        console.error("Can not send upload event - no hash", file.name);
        return;
    }
    const model = new FileSpawnModel(connection.connectionId, seed,
        obj.guid, upload_result.filename,
        upload_result.hash,
        file.size,
        obj.position,
        upload_result.url ?? backendUrl,
    );
    if (obj.parent)
        model.parentGuid = obj.parent["guid"];
    connection.send(File_Event.File_Spawned, model);
}


const previews: { [key: string]: THREE.Object3D } = {};

function addPreview(evt: FileSpawnModel, context: Context) {
    const sphere = new THREE.BoxGeometry();
    const object = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
    const box = new THREE.BoxHelper(object, 0x555555);
    previews[evt.guid] = box;
    context.scene.add(box);
    if (evt.parentGuid) {
        const parent = findByGuid(evt.parentGuid, context.scene) as THREE.Object3D;
        if (parent)
            parent.add(box);
    }
    if (evt.position)
        box.position.copy(evt.position);
}

function removePreview(evt: FileSpawnModel, _context: Context) {
    const guid = evt.guid;
    const existing = previews[guid];
    if (existing) {
        delete previews[guid];
        existing.removeFromParent();
    }
}