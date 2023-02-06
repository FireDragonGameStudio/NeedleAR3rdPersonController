import { Constructor, ConstructorConcrete, SourceIdentifier, UIDProvider } from "./engine_types";
import { Context } from "./engine_setup";
import { NEEDLE_components } from "./extensions/NEEDLE_components";
import { SerializationContext } from "./engine_serialization_core";
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'


export interface INeedleGltfLoader {
    createBuiltinComponents(context: Context, gltfId: SourceIdentifier, gltf, seed: number | null | UIDProvider, extension?: NEEDLE_components): Promise<void>
    writeBuiltinComponentData(comp: object, context: SerializationContext);
    parseSync(context: Context, data, path: string, seed: number | UIDProvider | null): Promise<GLTF | undefined>;
    loadSync(context: Context, url: string, seed: number | UIDProvider | null, _allowAddingAnimator: boolean, prog?: (ProgressEvent) => void): Promise<GLTF | undefined>
}

let gltfLoader: INeedleGltfLoader;
let gltfLoaderType: ConstructorConcrete<INeedleGltfLoader> | null = null;

export function getLoader(): INeedleGltfLoader {
    return gltfLoader;
}

export function registerLoader<T extends INeedleGltfLoader>(loader: ConstructorConcrete<T>) {
    if (gltfLoaderType !== loader) {
        gltfLoaderType = loader;
        gltfLoader = new loader();
    }
}