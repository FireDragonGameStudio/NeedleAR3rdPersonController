
import * as THREE from "three";
import { syncDestroy } from "../engine/engine_networking_instantiate";
import { BoxHelperComponent } from "./BoxHelperComponent";
import { Behaviour, GameObject } from "./Component";
import { UsageMarker } from "./Interactable";


export class DeleteBox extends BoxHelperComponent {}


export class Deletable extends Behaviour {

    private deleteBoxes: DeleteBox[] = [];

    awake() {
        this.deleteBoxes = GameObject.findObjectsOfType(DeleteBox, this.context);
    }

    update(): void {
        for (const box of this.deleteBoxes) {
            const obj = this.gameObject as unknown as THREE.Mesh;
            const res = box.isInBox(obj);
            // console.log(res);
            if (res === true) {
                const marker = GameObject.getComponentInParent(this.gameObject, UsageMarker);
                if (!marker) {
                    // console.log("DESTROY");
                    syncDestroy(this.gameObject, this.context.connection);
                }
            }
        }
    }
}