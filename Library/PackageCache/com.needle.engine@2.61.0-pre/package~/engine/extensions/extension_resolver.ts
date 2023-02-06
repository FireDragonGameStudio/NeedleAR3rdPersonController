import { GLTFParser } from "three/examples/jsm/loaders/GLTFLoader";

export interface IExtensionReferenceResolver {
    resolve(parser: GLTFParser, path: string): Promise<void> | null
}