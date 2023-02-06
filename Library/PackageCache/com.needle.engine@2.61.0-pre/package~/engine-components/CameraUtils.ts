import { OrbitControls } from "./OrbitControls";
import { Camera } from "./Camera";
import { addNewComponent } from "../engine/engine_components";
import { Color, Object3D, Scene, Vector3 } from "three";
import { ICamera, SourceIdentifier } from "../engine/engine_types";
import { lookAtInverse } from "../engine/engine_three_utils";
import { RGBAColor } from "./js-extensions/RGBAColor";
import { ContextEvent, ContextRegistry } from "../engine/engine_context_registry";


ContextRegistry.registerCallback(ContextEvent.MissingCamera, (evt) => {
    createCameraWithOrbitControl(evt.context.scene, "unknown");
});


export function createCameraWithOrbitControl(scene: Scene, source: SourceIdentifier): ICamera {
    const srcId = source;
    const go = new Object3D();
    scene.add(go);
    const camInstance = new Camera();
    const cam = addNewComponent(go, camInstance, true) as ICamera
    cam.sourceId = srcId;
    cam.clearFlags = 2;
    cam.backgroundColor = new RGBAColor(0.5, 0.5, 0.5, 1);
    const orbit = addNewComponent(go, new OrbitControls(), false) as OrbitControls;
    orbit.sourceId = srcId;
    go.position.x = -2;
    go.position.y = 2;
    go.position.z = 2;
    lookAtInverse(go, new Vector3(0, 0, 0));
    return cam as Camera;
}
