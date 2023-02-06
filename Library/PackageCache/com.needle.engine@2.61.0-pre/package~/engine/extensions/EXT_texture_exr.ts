import { getParam } from "../engine_utils";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader";
import { Texture } from "three";
import { GLTFLoaderPlugin, GLTFParser } from "three/examples/jsm/loaders/GLTFLoader";


const debug = getParam("debugexr");

export class EXT_texture_exr implements GLTFLoaderPlugin {

	private parser: GLTFParser;
	private name: string;

	constructor(parser: GLTFParser) {

		this.parser = parser;
		this.name = "EXT_texture_exr";
		if (debug) console.log(parser);

	}

	loadTexture(textureIndex): Promise<Texture> | null {

		const name = this.name;
		const parser = this.parser;
		const json = parser.json;

		const textureDef = json.textures[textureIndex];

		if (debug) console.log("EXT_texture_exr.loadTexture", textureIndex, textureDef);

		if (!textureDef.extensions || !textureDef.extensions[name]) {

			return null;

		}

		const extension = textureDef.extensions[name];

		// TODO should the loader be cached here?
		const loader = new EXRLoader(parser.options.manager);

		if (debug) console.log("EXT_texture_exr.loadTexture", extension, loader);

		const promise = parser.loadTextureImage(textureIndex, extension.source, loader) as Promise<Texture>;
		return promise;
	}
}
window.addEventListener('unhandledrejection', (_event: PromiseRejectionEvent) => {
});
