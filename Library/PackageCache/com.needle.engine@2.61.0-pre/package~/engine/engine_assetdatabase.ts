import * as THREE from 'three';
import { Scene } from 'three';
// import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as utils from "./engine_utils";

const debug = utils.getParam("debugassets");

class TextureInfo {
    name!: string;
    sampler!: number;
    source!: number;
    extras: { guid: string } | undefined;
}

class ImageInfo {
    bufferView!: number;
    mimeType: string | undefined;
    extras: { guid: string } | undefined;
}

class GltfJson {
    textures!: TextureInfo[];
    bufferViews!: Array<{ buffer: number, byteOffset: number, byteLength: number }>;
}

declare class GltfParser {
    cache: any;
    json: GltfJson;
    associations: Map<any, any>;
    textureLoader: THREE.TextureLoader;
    loadTexture: Function;
}

declare class Gltf {
    parser: GltfParser;
    scene: Scene;
}

/** @deprecated */
export class AssetDatabase {

    constructor() {
        window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
            if (event.defaultPrevented) return;
            const pathArray = event?.reason?.path;
            if (pathArray) {
                const source = pathArray[0];
                if (source && source.tagName === "IMG") {
                    console.warn("Could not load image:\n" + source.src);
                    event.preventDefault();
                }
            }
        });
    }

    private texturesLoader: THREE.TextureLoader = new THREE.TextureLoader();
    private textures: { [key: string]: THREE.Texture | PromiseLike<THREE.Texture> } = {};
    private texturesLoading: { [key: string]: THREE.Texture | PromiseLike<THREE.Texture> } = {};

    /** @deprecated */
    public async loadTexture(url: string): Promise<THREE.Texture | null> {
        if (this.textures[url]) {
            return this.textures[url];
        }
        if (this.texturesLoading[url]) {
            return await this.texturesLoading[url];
        }
        const loading = this.texturesLoader.loadAsync(url);
        this.texturesLoading[url] = loading;
        const res = await loading;
        delete this.texturesLoading[url];
        this.textures[url] = res;
        return res;
    }

    /** @deprecated */
    public getTexture(guid: string): THREE.Texture | null {
        return this._textures.get(guid) || null;
    }

    /** @deprecated */
    public findTexture(name: string): THREE.Texture | null {
        for (const texture of this._textures.values()) {
            if (texture.name === name) {
                return texture;
            }
        }
        return null;
    }

    /** @deprecated */
    public findMesh(name: string): THREE.Mesh | null {
        for (const mesh of this._meshes.values()) {
            if (mesh.name === name)
                return mesh;
        }
        return null;
    }

    /** @deprecated */
    public findMaterial(name:string) : THREE.Material | null {
        for (const material of this._materials.values()) {
            if (material.name === name)
                return material;
        }
        return null;
    }

    /** @deprecated */
    public async registerGltf(_gltf: Gltf) {
        // if (debug)
        //     console.log("register gltf", gltf.scene.name, gltf);
        // const parser = gltf.parser;
        // const json = parser.json;
        // const textures = json.textures;
        // const associations = parser.associations;
        // const alreadyLoaded = new Set<string>();
        // associations.forEach((value, key) => {
        //     // when minified instanceOf doesnt work but the texture type is 1009
        //     if (key instanceof THREE.Texture || key.type === 1009) {
        //         const index = value.textures;
        //         const textureInfo = textures[index];
        //         // TODO: a lot of information is gone when compressing with ktx2
        //         // this.registerTexture(parser, index, textureInfo, key, alreadyLoaded);
        //     }
        //     else if (key instanceof THREE.Mesh || key.type == "Mesh") {
        //         this.registerAsset(key);

        //         // saving materials,
        //         // FIXME: this is unlike the other things by name here as a hack for forma, it should probably saved by name and by guid just like anything else here
        //         if(key.material){
        //             this._materials.set(key.material.name, key.material);
        //         }
        //     }
        // });

        // // for (const ti in textures) {
        // //     const textureInfo = textures[ti];
        // //     await this.registerTexture(parser, ti, textureInfo, null, alreadyLoaded);
        // // }

        // if (debug)
        //     console.log(this);
    }

    /** @deprecated */
    public registerAsset(_asset: any) {
        // if (debug) console.log("register asset", asset);
        // console.assert(asset, "Asset is null or undefined");
        // const guid: string = asset.userData?.guid;
        // if (guid === null || guid === undefined || guid.length === 0) {
        //     // asset has no guid, this can happen e.g. when using multi material meshes
        //     // should we ask the parent for the guid if it's a group? 
        //     // we need a more stable way to preserve ids anyways
        //     return;
        // }
        // if (asset instanceof THREE.Texture || asset.type === 1009) {
        //     if (this._textures.has(guid) && this._textures.get(guid) !== asset) {
        //         if (debug)
        //             console.warn("found duplicate texture " + guid, asset);
        //         return;
        //     }
        //     if (debug)
        //         console.log("register texture", guid, asset);
        //     // should we check if an asset has been registered already? 
        //     // should not matter as long as we only export guid from unity?
        //     this._textures.set(guid, asset);
        // }
        // else if (asset instanceof THREE.Mesh || asset.type == "Mesh") {
        //     this._meshes.set(guid, asset);
        // }
    }


    private _materials: Map<string, THREE.Material> = new Map<string, THREE.Material>();
    private _meshes: Map<string, THREE.Mesh> = new Map();
    // private async registerMesh(parser: GltfParser, mesh : THREE.Mesh){        
    //     const guid = mesh?.userData?.guid;
    // }


    private _textures: Map<string, THREE.Texture> = new Map();

    // private async registerTexture(parser: GltfParser, index: number | string, textureInfo: TextureInfo, texture: THREE.Texture | null, alreadyLoaded: Set<string>) {

    //     // const guid = textureInfo?.extras?.guid || texture?.userData?.guid;
    //     // if (!guid) {
    //     //     if (debug) console.warn("missing guid", texture, textureInfo)
    //     //     return;
    //     // }
    //     // console.assert(guid !== null && guid !== undefined && guid.length > 0, "Texture has no guid in userData", texture);
    //     // if (guid) {
    //     //     if (alreadyLoaded.has(guid)) {
    //     //         // console.warn("texture already loaded", textureInfo.name, guid);
    //     //         return;
    //     //     }
    //     //     alreadyLoaded.add(guid);
    //     // }

    //     // if (!texture) {
    //     //     texture = await parser.loadTexture(index);
    //     //     if (!texture) {
    //     //         if (debug)
    //     //             console.warn("failed to load texture", guid);
    //     //         return;
    //     //     }
    //     // }

    //     // if (textureInfo.extras) {
    //     //     texture.userData = { ...texture.userData, ...textureInfo.extras };
    //     // }
    //     // this.registerAsset(texture);
    // }

}