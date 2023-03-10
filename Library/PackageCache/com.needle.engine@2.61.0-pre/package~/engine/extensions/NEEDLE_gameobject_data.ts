import { Object3D } from "three";
import { GLTF, GLTFLoaderPlugin, GLTFParser } from "three/examples/jsm/loaders/GLTFLoader";

export const EXTENSION_NAME = "NEEDLE_gameobject_data";

declare type GameObjectData = {
    layers: number,
    visible: boolean,
    tag: string,
    hideFlags: number,
    static: boolean,
    activeSelf: boolean,
    guid: string
}

export class NEEDLE_gameobject_data implements GLTFLoaderPlugin {

    get name(): string {
        return EXTENSION_NAME;
    }

    private parser: GLTFParser;

    constructor(parser: GLTFParser) {
        this.parser = parser;
    }

    // private _lastIndex: number = -1;
    // createNodeAttachment(index): null {
    //     if (index === this._lastIndex) return null;
    //     this._lastIndex = index;
    //     const node = this.parser.json.nodes[index];
    //     if (node && node.extensions) {
    //         const ext = node.extensions[EXTENSION_NAME];
    //         if (ext)
    //             this.findAndApplyExtensionData(index, ext);
    //     }
    //     return null;
    // }

    // private lastIndex: number = -1;
    afterRoot(_result: GLTF): Promise<void> | null {
        // console.log("AFTER ROOT", _result);
        const promises: Promise<void>[] = [];
        for (let index = 0; index < this.parser.json.nodes.length; index++) {
            const node = this.parser.json.nodes[index];
            if (node && node.extensions) {
                const ext = node.extensions[EXTENSION_NAME];
                if (ext) {
                    const p = this.findAndApplyExtensionData(index, ext);
                    promises.push(p);
                }
            }
        }
        return Promise.all(promises).then(() => { });
    }

    private async findAndApplyExtensionData(nodeId: number, ext: GameObjectData) {
        const obj = await this.parser.getDependency("node", nodeId);
        if (obj) {
            this.applyExtensionData(obj, ext);
        }
    }


    private applyExtensionData(node: Object3D, ext: GameObjectData) {
        if (ext.layers === undefined) ext.layers = 0;
        node.userData.layer = ext.layers;
        node.layers.disableAll();
        node.layers.set(ext.layers);

        node.userData.tag = ext.tag ?? "none";

        node.userData.hideFlags = ext.hideFlags ?? 0;

        node.userData.static = ext.static ?? false;

        node.visible = ext.activeSelf ?? true;
        
        node["guid"] = ext.guid;
        // console.log(node.name, ext.activeSelf, node);
    }
}