import { ILightDataRegistry } from "../engine_lightdata";
import { FloatType, HalfFloatType, LinearEncoding, sRGBEncoding, Texture } from "three";
import { GLTF, GLTFLoaderPlugin, GLTFParser } from "three/examples/jsm/loaders/GLTFLoader";
import { SourceIdentifier } from "../engine_types";
import { resolveReferences } from "./extension_utils";
import { getParam } from "../engine_utils";

// the lightmap extension is aimed to also export export skyboxes and custom reflection maps
// should we rename it?
// should we split it into multiple extensions?

export const EXTENSION_NAME = "NEEDLE_lightmaps";
const debug = getParam("debuglightmapsextension");

export enum LightmapType {
    Lightmap = 0,
    Skybox = 1,
    Reflection = 2,
}

declare type LightmapExtension = {
    textures: Array<LightmapInfo>;
}

declare type LightmapInfo = {
    type: LightmapType,
    pointer?: string,
    index?: number;
}

export class NEEDLE_lightmaps implements GLTFLoaderPlugin {

    get name(): string {
        return EXTENSION_NAME;
    }

    private parser: GLTFParser;
    private registry: ILightDataRegistry;
    private source: SourceIdentifier;

    constructor(parser: GLTFParser, reg: ILightDataRegistry, source: SourceIdentifier) {
        this.parser = parser;
        this.registry = reg;
        this.source = source;
    }

    afterRoot(_result: GLTF): Promise<void> | null {

        const extensions = this.parser.json.extensions;
        if (extensions) {
            const ext: LightmapExtension = extensions[EXTENSION_NAME];
            if (ext) {
                const arr = ext.textures;
                if (!arr?.length) {
                    return null;
                }
                if (debug)
                    console.log(ext);

                return new Promise(async (res, _rej) => {
                    const dependencies: Array<Promise<any>> = [];
                    for (const entry of arr) {
                        if (entry.pointer) {
                            const res = resolveReferences(this.parser, entry.pointer).then(res => {
                                const tex: Texture = res as unknown as Texture;
                                if (tex?.isTexture) {
                                    if (!this.registry)
                                        console.log(LightmapType[entry.type], entry.pointer, tex);
                                    else {
                                        // TODO this is most likely wrong for floating point textures
                                        if (entry.type !== LightmapType.Lightmap)
                                            tex.encoding = sRGBEncoding;
                                        else 
                                            tex.encoding = LinearEncoding;

                                            
                                        // Dont flip skybox textures anymore - previously we exported them flipped when baking in Unity but now we allow to pass through export without re-baking exisitng skybox textures if they use default values. So we expect textures to be NOT flipped anymore
                                        // if (entry.type === LightmapType.Skybox) {
                                        //     if (tex.type == FloatType || tex.type == HalfFloatType)
                                        //         tex.flipY = true;
                                        // }

                                        this.registry.registerTexture(this.source, entry.type, tex, entry.index);
                                    }
                                }
                            });
                            dependencies.push(res);
                        }
                    }
                    await Promise.all(dependencies);
                    res();
                });
            }
        }
        return null;
    }

}