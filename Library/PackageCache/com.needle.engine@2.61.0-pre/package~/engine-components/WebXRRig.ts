import { Object3D } from "three";
import { IGameObject } from "../engine/engine_types";
import { getParam } from "../engine/engine_utils";
import { Behaviour, GameObject } from "./Component";
import { BoxGizmo } from "./Gizmos";

const debug = getParam("debugrig");

export class XRRig extends Behaviour {
    awake(): void {
        // const helper = new AxesHelper(.1);
        // this.gameObject.add(helper);
        if (debug) {
            const gizmoObj = new Object3D() as IGameObject;
            gizmoObj.position.y += .5;
            this.gameObject.add(gizmoObj);
            const gizmo = gizmoObj.addNewComponent(BoxGizmo);
            if (gizmo)
                gizmo.isGizmo = false;
        }
    }
}