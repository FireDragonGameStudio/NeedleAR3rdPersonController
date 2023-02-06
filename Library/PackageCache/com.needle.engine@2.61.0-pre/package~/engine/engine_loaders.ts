
import { Context } from "./engine_setup"
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { getParam } from "./engine_utils";

const debug = getParam("debugdecoders");

const DEFAULT_DRACO_DECODER_LOCATION ='https://www.gstatic.com/draco/versioned/decoders/1.4.1/';
const DEFAULT_KTX2_TRANSCODER_LOCATION ='https://www.gstatic.com/basis-universal/versioned/2021-04-15-ba1c3e4/';

let dracoLoader: DRACOLoader;
let ktx2Loader: KTX2Loader;

export function setDracoDecoderPath(path: string | undefined) {
    if (path !== undefined && typeof path === "string") {
        if (!dracoLoader)
            dracoLoader = new DRACOLoader();
        if (debug) console.log("Setting draco decoder path to", path);
        dracoLoader.setDecoderPath(path);
    }
}

export function setDracoDecoderType(type: string | undefined) {
    if (type !== undefined && typeof type === "string") {
        if (!dracoLoader)
            dracoLoader = new DRACOLoader();
        if (debug) console.log("Setting draco decoder type to", type);
        dracoLoader.setDecoderConfig({ type: type });
    }
}

export function setKtx2TranscoderPath(path: string) {
    if (path !== undefined && typeof path === "string") {
        if (!ktx2Loader)
            ktx2Loader = new KTX2Loader();
        if (debug) console.log("Setting ktx2 transcoder path to", path);
        ktx2Loader.setTranscoderPath(path);
    }
}

export function addDracoAndKTX2Loaders(loader: GLTFLoader, context: Context) {
    if (!dracoLoader) {
        dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath(DEFAULT_DRACO_DECODER_LOCATION);
        dracoLoader.setDecoderConfig({ type: 'js' });
        if (debug) console.log("Setting draco decoder path to", DEFAULT_DRACO_DECODER_LOCATION);
    }
    if (!ktx2Loader) {
        ktx2Loader = new KTX2Loader();
        ktx2Loader.setTranscoderPath(DEFAULT_KTX2_TRANSCODER_LOCATION);
        if (debug) console.log("Setting ktx2 transcoder path to", DEFAULT_KTX2_TRANSCODER_LOCATION);
        if (context.renderer)
            ktx2Loader.detectSupport(context.renderer);
    }

    loader.setDRACOLoader(dracoLoader);
    loader.setKTX2Loader(ktx2Loader);
}
