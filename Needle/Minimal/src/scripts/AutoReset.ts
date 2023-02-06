import { Behaviour, Collider, GameObject, Rigidbody, serializeable } from "@needle-tools/engine";
import { Vector3 } from "three";

export class AutoReset extends Behaviour {
    @serializeable(Collider)
    worldCollider?: Collider;
    @serializeable(Vector3)
    startPosition?: Vector3;

    start() {
        if (!this.worldCollider) console.warn("Missing collider to reset", this);
        console.log("start position", this.startPosition);
    }

    onTriggerExit(col) {
        if (col === this.worldCollider) {
            console.log("reached world collider");
            this.resetToStart();
        }
    }

    resetToStart() {
        if (!this.startPosition) return;
        const rb = GameObject.getComponent(this.gameObject, Rigidbody);
        rb?.teleport(this.startPosition);
    }
}
