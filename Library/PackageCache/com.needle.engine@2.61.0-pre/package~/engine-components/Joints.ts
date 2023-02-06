import { Vector3 } from "three";
import { serializable } from "../engine/engine_serialization";
import { Behaviour } from "./Component";
import { Rigidbody } from "./RigidBody";

export abstract class Joint extends Behaviour {
    @serializable(Rigidbody)
    connectedBody?: Rigidbody;

    get rigidBody(): Rigidbody | null {
        return this._rigidBody;
    }
    private _rigidBody: Rigidbody | null = null;


    onEnable() {
        if (!this._rigidBody) this._rigidBody = this.gameObject.getComponent(Rigidbody);
        if (this.rigidBody && this.connectedBody)
            this.startCoroutine(this.create());
    }

    private *create() {
        yield;
        if (this.rigidBody && this.connectedBody) {
            this.createJoint(this.rigidBody, this.connectedBody)
        }
    }

    protected abstract createJoint(self: Rigidbody, other: Rigidbody);
}

export class FixedJoint extends Joint {

    protected createJoint(self: Rigidbody, other: Rigidbody) {
        this.context.physics.addFixedJoint(self, other);
    }
}

export class HingeJoint extends Joint {

    @serializable(Vector3)
    anchor?: Vector3;

    @serializable(Vector3)
    axis?: Vector3;

    protected createJoint(self: Rigidbody, other: Rigidbody) {
        if (this.axis && this.anchor)
            this.context.physics.addHingeJoint(self, other, this.anchor, this.axis);
    }

}