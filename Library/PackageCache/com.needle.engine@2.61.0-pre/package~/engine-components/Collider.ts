import { Behaviour } from "./Component";
import { Rigidbody } from "./RigidBody";
import { serializable } from "../engine/engine_serialization_decorator";
import { Event, Mesh, Object3D, Vector3 } from "three"
// import { IColliderProvider, registerColliderProvider } from "../engine/engine_physics";
import { ICollider } from "../engine/engine_types";
import { getWorldScale } from "../engine/engine_three_utils";
import { PhysicsMaterial } from "../engine/engine_physics.types";


export class Collider extends Behaviour implements ICollider {

    get isCollider(): any {
        return true;
    }

    @serializable(Rigidbody)
    attachedRigidbody: Rigidbody | null = null;
    @serializable()
    isTrigger: boolean = false;

    @serializable()
    sharedMaterial?: PhysicsMaterial;

    awake() {
        super.awake();
        if (!this.attachedRigidbody)
            this.attachedRigidbody = this.gameObject.getComponentInParent(Rigidbody);
    }

    start() {
        if (!this.attachedRigidbody)
            this.attachedRigidbody = this.gameObject.getComponentInParent(Rigidbody);
    }

    onEnable() {
        // a rigidbody is not assigned if we export an asset
        if (!this.attachedRigidbody)
            this.attachedRigidbody = this.gameObject.getComponentInParent(Rigidbody);
    }

    onDisable() {
        this.context.physics.removeBody(this);
    }

}


export class SphereCollider extends Collider {

    @serializable()
    radius: number = .5;
    @serializable(Vector3)
    center: Vector3 = new Vector3(0, 0, 0);

    onEnable() {
        super.onEnable();
        this.context.physics.addSphereCollider(this, this.center, this.radius);
    }
}

export class BoxCollider extends Collider {

    @serializable(Vector3)
    size: Vector3 = new Vector3(1, 1, 1);
    @serializable(Vector3)
    center: Vector3 = new Vector3(0, 0, 0);

    onEnable() {
        super.onEnable();
        this.context.physics.addBoxCollider(this, this.center, this.size);
    }
}


export class MeshCollider extends Collider {


    sharedMesh?: Mesh;
    @serializable()
    convex: boolean = false;

    onEnable() {
        super.onEnable();
        if (!this.sharedMesh?.isMesh) {
            // HACK using the renderer mesh
            if (this.gameObject instanceof Mesh) {
                this.sharedMesh = this.gameObject;
            }
        }
        if (this.sharedMesh?.isMesh)
            this.context.physics.addMeshCollider(this, this.sharedMesh, this.convex, getWorldScale(this.gameObject));
    }
}


export class CapsuleCollider extends Collider {
    @serializable(Vector3)
    center: Vector3 = new Vector3(0, 0, 0);

    @serializable()
    radius: number = .5;
    @serializable()
    height: number = 2;

    onEnable() {
        super.onEnable();
        this.context.physics.addCapsuleCollider(this, this.center, this.height, this.radius);
    }

}