import { Behaviour, GameObject } from "./Component";
import { RaycastOptions } from "../engine/engine_physics";
import * as files from "../engine/engine_networking_files";
import { serializable } from "../engine/engine_serialization_decorator";
import { Networking } from "../engine-components/Networking";
import { GLTF } from "three/examples/jsm/loaders/GLTFLoader";

// web.download_file("487f7b22f68312d2c1bbc93b1aea445b.glb", "487f7b22f68312d2c1bbc93b1aea445b", 28152).then(async res => {
//     console.log(res);
//     const gltf = await parseSync(res);
//     scene.add(gltf.scene);
//     console.log("GLTF", gltf);
// });

export enum DropListenerEvents {
    ObjectAdded = "object-added",
    FileDropped = "file-dropped",
}

export class DropListener extends Behaviour {

    @serializable()
    filesBackendUrl?: string;

    @serializable()
    localhost?:string;
    
    private _dragOver!: (evt: DragEvent) => void;
    private _drop!: (evt: DragEvent) => void;

    onEnable(): void {
        this.filesBackendUrl = this.filesBackendUrl ? Networking.GetUrl(this.filesBackendUrl, this.localhost) : undefined;

        this._dragOver = this.onDrag.bind(this);
        this._drop = this.onDrop.bind(this);
        this.context.domElement.addEventListener("dragover", this._dragOver);
        this.context.domElement.addEventListener("drop", this._drop);
    }

    onDisable(): void {
        this.context.domElement.removeEventListener("dragover", this._dragOver);
        this.context.domElement.removeEventListener("drop", this._drop);
    }

    private onDrag(evt: DragEvent) {
        // necessary to get drop event
        evt.preventDefault();
    }

    async addFiles(fileList: Array<File>) {
        for (const file of fileList) {
            if (!file) continue;
            console.log("Register file " + file.name + " to", this.filesBackendUrl, file);
            const res = await files.addFile(file, this.context, this.filesBackendUrl);
            this.dispatchEvent(new CustomEvent(DropListenerEvents.FileDropped, { detail: file }));
            if (res)
                this.addObject(undefined, res);
        }
    }

    private async onDrop(evt: DragEvent) {
        console.log(evt);
        if (!evt.dataTransfer) return;
        evt.preventDefault();
        const items = evt.dataTransfer.items;
        if (!items) return;

        for (const ite in items) {
            const it = items[ite];
            if (it.kind === "file") {
                const file = it.getAsFile();
                if (!file) continue;
                console.log("Register file " + file.name + " to", this.filesBackendUrl, file);
                const res = await files.addFile(file, this.context, this.filesBackendUrl);
                this.dispatchEvent(new CustomEvent(DropListenerEvents.FileDropped, { detail: file }));
                if (res)
                    this.addObject(evt, res);
            }
            else if (it.kind === "string" && it.type == "text/plain") {
                it.getAsString(async str => {
                    console.log("dropped url", str);
                    try {
                        const url = new URL(str);
                        if (!url) return;
                        const res = await files.addFileFromUrl(url, this.context);
                        if (res)
                            this.addObject(evt, res);
                    }
                    catch (_) {
                        console.log("dropped string is not a valid URL!", str);
                    }
                });
            }
        }
    }

    private async addObject(evt: DragEvent | undefined, gltf: GLTF) {
        console.log("Dropped", gltf);
        
        const obj = gltf.scene;
        if (evt !== undefined) {
            const opts = new RaycastOptions();
            opts.setMask(0xffffff);
            opts.screenPointFromOffset(evt.offsetX, evt.offsetY);
            const rc = this.context.physics.raycast(opts);
            if (rc && rc.length > 0) {
                for (const hit of rc) {
                    obj.position.copy(hit.point);
                    break;
                }
            }
        }
        this.gameObject.add(obj);
        this.dispatchEvent(new CustomEvent(DropListenerEvents.ObjectAdded, { detail: gltf }));
    }
}