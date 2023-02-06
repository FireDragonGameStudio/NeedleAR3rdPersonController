import { makeErrorsVisibleForDevelopment } from "./engine/debug/debug_overlay";
makeErrorsVisibleForDevelopment();

import "./engine/engine_element";
import "./engine/engine_setup";
// import "./engine/engine_mainloop";
// import "./engine-components/DomOverlay";


export { GameObject, Behaviour } from "./engine-components/Component";
export { serializable, serializeable } from "./engine/engine_serialization_decorator";
export { Collision } from "./engine/engine_types";
export * from "./engine/api";
export * from "./engine-components/codegen/components";
export * from "./engine-components/js-extensions/Object3D";


// make accessible for external javascript
import { Context } from "./engine/engine_setup";
const Needle = { Context: Context };
globalThis["Needle"] = Needle;
function registerGlobal(obj: object) {
    for (const key in obj) {
        Needle[key] = obj[key];
    }
}
import * as Component from "./engine-components/Component";
registerGlobal(Component);

import * as Components from "./engine-components/codegen/components";
registerGlobal(Components);

import { GameObject } from "./engine-components/Component";
for (const method of Object.getOwnPropertyNames(GameObject)) {
    switch (method) {
        case "prototype":
        case "constructor":
        case "length":
        case "name":
            continue;
        default:
            Needle[method] = GameObject[method];
            break;
    }
}

// make three accessible
import * as THREE from "three";
if(!globalThis["THREE"]) {
    globalThis["THREE"] = THREE;
}
else console.warn("Threejs is already imported");
