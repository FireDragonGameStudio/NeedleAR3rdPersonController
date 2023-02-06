import { Behaviour, GameObject } from "../../Component";
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import GLTFMeshGPUInstancingExtension from '../../../include/three/EXT_mesh_gpu_instancing_exporter.js';
import { Renderer } from "../../Renderer";
import { Object3D, Vector3 } from "three";
import { SerializationContext } from "../../../engine/engine_serialization_core";
import { NEEDLE_components } from "../../../engine/extensions/NEEDLE_components";
import { getWorldPosition } from "../../../engine/engine_three_utils";
import { BoxHelperComponent } from "../../BoxHelperComponent";
import { AnimationClip } from "three";


declare type ExportOptions = {
    binary: boolean,
    pivot?: THREE.Vector3
}

export const componentsArrayExportKey = "$___Export_Components";

// @generate-component
export class GltfExportBox extends BoxHelperComponent {
    sceneRoot?: THREE.Object3D;

    start() {
        this.startCoroutine(this.updateGltfBox());
    }

    *updateGltfBox() {
        while (true) {
            for (let i = 0; i < 10; i++) yield;

        }
    }
}

export class GltfExport extends Behaviour {
    binary: boolean = true;
    objects: Object3D[] = [];

    private exporter?: GLTFExporter;
    private ext?: NEEDLE_components;

    async exportNow(name: string) {
        console.log("DO EXPORT", this.objects);
        const opts = { binary: this.binary, pivot: GltfExport.calculateCenter(this.objects) };
        const res = await this.export(this.objects, opts);

        if (!this.binary) {
            if (!name.endsWith(".gltf"))
                name += ".gltf";
        }
        else if (!name.endsWith(".glb"))
            name += ".glb";
        if (this.binary)
            GltfExport.saveArrayBuffer(res, name);
        else
            GltfExport.saveJson(res, name);
    }

    async export(objectsToExport: Object3D[], opts?: ExportOptions): Promise<any> {

        if (objectsToExport === null || objectsToExport.length <= 0) {
            console.log("no objects set to export");
            return;
        }

        if (!this.exporter) {
            // Instantiate a exporter
            this.exporter = new GLTFExporter();
            //@ts-ignore
            this.exporter.register(writer => new GLTFMeshGPUInstancingExtension(writer));

            this.ext = new NEEDLE_components();
            //@ts-ignore
            this.ext.registerExport(this.exporter);
        }

        GltfExport.filterTopmostParent(objectsToExport);

        // TODO export only worldglb BUT exclude "World" child which contains all build tools
        // TODO add filtering / tags for what to export and what not

        // https://threejs.org/docs/#examples/en/exporters/GLTFExporter
        const options = {
            trs: false,
            onlyVisible: true,
            truncateDrawRange: false,
            binary: opts?.binary ?? true,
            maxTextureSize: Infinity, // To prevent NaN value,
            embedImages: true,
            includeCustomExtensions: true,
            animations: GltfExport.collectAnimations(objectsToExport),
        };

        // hide objects that we don't want to export

        const exportScene = new Object3D();
        // set the pivot position
        if (opts?.pivot) exportScene.position.sub(opts.pivot);
        // console.log(exportScene.position);

        // add objects for export
        console.log("EXPORT", objectsToExport);
        objectsToExport.forEach(obj => {
            if (obj) {
                // adding directly does not require us to change parents and mess with the hierarchy actually
                exportScene.children.push(obj);
                // TODO: we should probably be doing this before writing nodes?? apply world scale, position, rotation etc for export only
                obj.matrixAutoUpdate = false;
                obj.matrix.copy(obj.matrixWorld);
                // disable instancing
                GameObject.getComponentsInChildren(obj, Renderer).forEach(r => {
                    if (GameObject.isActiveInHierarchy(r.gameObject)) r.setInstancingEnabled(false)
                });
            }
        });

        const serializationContext = new SerializationContext(exportScene);
        this.ext!.context = serializationContext;

        return new Promise((resolve, reject) => {

            try {
                // Parse the input and generate the glTF output
                this.exporter?.parse(
                    exportScene,
                    // called when the gltf has been generated
                    res => {
                        cleanup();
                        resolve(res);
                    },
                    // called when there is an error in the generation
                    err => {
                        cleanup();
                        reject(err);
                    },
                    //@ts-ignore
                    options
                );
            }
            catch (err) {
                console.error(err);
                reject(err);
            }
            finally {
                console.log("FINALLY");
            }
        });

        function cleanup() {
            objectsToExport.forEach(obj => {
                if (!obj) return;
                obj.matrixAutoUpdate = true;
                GameObject.getComponentsInChildren(obj, Renderer).forEach(r => {
                    if (GameObject.isActiveInHierarchy(r.gameObject)) r.setInstancingEnabled(false)
                });
            });
        }
    };

    private static saveArrayBuffer(buffer, filename) {
        this.save(new Blob([buffer], { type: 'application/octet-stream' }), filename);
    }

    private static saveJson(json, filename) {
        this.save("data: text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(json)), filename);
    }

    private static save(blob, filename) {
        const link = document.createElement('a');
        link.style.display = 'none';
        document.body.appendChild(link); // Firefox workaround, see #6594
        if (typeof blob === "string")
            link.href = blob;
        else
            link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        link.remove();
        // console.log(link.href);
        // URL.revokeObjectURL( url ); breaks Firefox...
    }

    private static collectAnimations(objs: THREE.Object3D[], target?: Array<AnimationClip>): Array<AnimationClip> {
        target = target || [];
        for (const obj of objs) {
            if (!obj) continue;
            obj.traverseVisible(o => {
                if (o.animations && o.animations.length > 0)
                    target!.push(...o.animations);
            });
        }
        return target;
    }


    private static calculateCenter(objs: THREE.Object3D[], target?: Vector3): Vector3 {
        const center = target || new Vector3();
        center.set(0, 0, 0);
        objs.forEach(obj => {
            center.add(getWorldPosition(obj));
        });
        console.log(center);
        center.divideScalar(objs.length);
        // center.y -= 1;
        return center;
    }

    private static filterTopmostParent(objs: THREE.Object3D[]) {
        if (objs.length <= 0) return;
        for (let index = 0; index < objs.length; index++) {
            let obj = objs[index];
            if (!obj) {
                objs.splice(index, 1);
                index--;
                continue;
            }
            // loop hierarchy up and kick object if any of its parents is already in this list
            // because then this object will already be exported (and we dont want to export it)
            while (obj.parent) {
                if (objs.includes(obj.parent)) {
                    // console.log("FILTER", objs[index]);
                    objs.splice(index, 1);
                    index--;
                    break;
                }
                obj = obj.parent;
            }
        }
    }

}