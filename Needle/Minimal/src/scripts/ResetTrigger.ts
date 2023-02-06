import { Behaviour, GameObject, Rigidbody, serializable } from "@needle-tools/engine";
import { ICollider } from "@needle-tools/engine/engine/engine_types";
import { Euler, Object3D, Vector3 } from "three";
import { XR3rdPersonController } from "./XR3rdPersonController";

export class ResetTrigger extends Behaviour {
    @serializable(Object3D)
    objectToToggle?: Object3D;

    @serializable(Object3D)
    objectsToReset: Object3D[] | null = null;

    private isResetActive: boolean = false;
    private xr3rdPersonController?: XR3rdPersonController | null;
    private positionBackup: Vector3[] = [];
    private rotationBackup: Euler[] = [];

    onTriggerEnter(col: ICollider) {
        if (this.objectToToggle) {
            GameObject.setActive(this.objectToToggle, true);
            this.isResetActive = true;
            this.xr3rdPersonController = col.gameObject.getComponent(XR3rdPersonController);
        }
    }
    onTriggerStay(_col: ICollider) {
        // console.log("Trigger Stay");
    }
    onTriggerExit(_col: ICollider) {
        if (this.objectToToggle) {
            GameObject.setActive(this.objectToToggle, false);
            this.isResetActive = false;
        }
    }

    start(): void {
        if (this.objectToToggle) {
            GameObject.setActive(this.objectToToggle, false);
        }
        if (this.objectsToReset) {
            this.objectsToReset.forEach((element) => {
                const tempVec: Vector3 = new Vector3();
                tempVec.copy(element.position);
                this.positionBackup.push(tempVec);

                const tempEuler = new Euler();
                tempEuler.copy(element.rotation);
                this.rotationBackup.push(tempEuler);
            });
        }
        this.isResetActive = false;
    }

    update(): void {
        if (this.isResetActive && this.xr3rdPersonController && this.xr3rdPersonController.getButtonAPressed()) {
            if (this.objectsToReset) {
                for (let index = 0; index < this.objectsToReset.length; index++) {
                    const rb = GameObject.getComponent(this.objectsToReset[index], Rigidbody);
                    rb?.teleport(this.positionBackup[index]);
                    rb?.setWorldRotation(this.rotationBackup[index].x, this.rotationBackup[index].y, this.rotationBackup[index].z);
                    rb?.resetForcesAndTorques();
                }
            }
        }
    }
}
