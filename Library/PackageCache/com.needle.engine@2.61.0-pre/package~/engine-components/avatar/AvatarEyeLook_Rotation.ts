import { Behaviour, GameObject } from "../Component";
import * as utils from "../../engine/engine_three_utils"
import * as THREE from "three";
import { Avatar_Brain_LookAt } from "./Avatar_Brain_LookAt";
import { serializable } from "../../engine/engine_serialization_decorator";
import { Object3D } from "three";

export class AvatarEyeLook_Rotation extends Behaviour {

    @serializable(Object3D)
    public head: GameObject | null = null;
    @serializable(Object3D)
    public eyes: GameObject[] | null = null;
    @serializable(Object3D)
    public target: THREE.Object3D | null = null;

    private brain: Avatar_Brain_LookAt | null = null;

    awake(): void {
        // console.log(this);
        if (!this.brain) {
            this.brain = GameObject.getComponentInParent(this.gameObject, Avatar_Brain_LookAt);
        }
        if (!this.brain) {
            console.log("No look at brain found, adding it now")
            this.brain = GameObject.addNewComponent(this.gameObject, Avatar_Brain_LookAt);
        }
        if (this.brain && this.target) {
            this.brain.controlledTarget = this.target;
        }
        // console.log(this);
        // if(this.head){
        //     this.head.add(new THREE.AxesHelper(1));
        // }
    }


    private vec: THREE.Vector3 = new THREE.Vector3();
    private static forward: THREE.Vector3 = new THREE.Vector3(0, 0, 1);
    private currentTargetPoint: THREE.Vector3 = new THREE.Vector3();

    update(): void {
        // if(!this.activeAndEnabled) return;
        const target = this.target;
        // console.log(target);
        if (target && this.head) {
            const eyes = this.eyes;
            if (eyes) {
                const worldTarget = utils.getWorldPosition(target);
                this.currentTargetPoint.lerp(worldTarget, this.context.time.deltaTime / .1);

                const headPosition = utils.getWorldPosition(this.head);
                const direction = this.vec.copy(this.currentTargetPoint).sub(headPosition).normalize();
                if (direction.length() < .1) return;
                const forward = AvatarEyeLook_Rotation.forward;
                forward.set(0, 0, 1);
                forward.applyQuaternion(utils.getWorldQuaternion(this.head));
                const dot = forward.dot(direction);
                if (dot > .45) {
                    // console.log(dot);
                    for (let i = 0; i < eyes.length; i++) {
                        const eye = eyes[i];
                        eye.lookAt(this.currentTargetPoint);
                    }
                }
            }
        }
    }
}