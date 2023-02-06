import "./engine_hot_reload"

import * as layers from "./js-extensions/Layers";
layers.patchLayers();

import * as engine_setup from "./engine_setup";
import * as engine_scenetools from "./engine_scenetools";
import "./tests/test_utils";
import { RGBAColor } from "../engine-components/js-extensions/RGBAColor";


const engine : any = {
    ...engine_setup,
    ...engine_scenetools,
    RGBAColor,
};

export { engine as engine }