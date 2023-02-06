import { Quaternion, Ray, Vector3 } from "three";
import { Mathf } from "../engine/engine_math";
import { serializable } from "../engine/engine_serialization";
import { Collision } from "../engine/engine_types";
import { CapsuleCollider } from "./Collider";
import { Behaviour, GameObject } from "./Component";
import { Rigidbody } from "./RigidBody";
import { Animator } from "./Animator"
import { RaycastOptions } from "../engine/engine_physics";
import { getWorldPosition } from "../engine/engine_three_utils";

export class CharacterController extends Behaviour {

    @serializable(Vector3)
    center: Vector3 = new Vector3(0, 0, 0);
    @serializable()
    radius: number = .5;
    @serializable()
    height: number = 2;

    private _rigidbody: Rigidbody | null = null;
    get rigidbody(): Rigidbody {
        if (this._rigidbody) return this._rigidbody;
        this._rigidbody = this.gameObject.getComponent(Rigidbody);
        if (!this._rigidbody)
            this._rigidbody = this.gameObject.addNewComponent(Rigidbody) as Rigidbody;
        return this.rigidbody;
    }

    onEnable() {
        let rb = this.rigidbody;
        let collider = this.gameObject.getComponent(CapsuleCollider);
        if (!collider)
            collider = this.gameObject.addNewComponent(CapsuleCollider) as CapsuleCollider;
        // rb.isKinematic = true;
        collider.center.copy(this.center);
        collider.radius = this.radius;
        collider.height = this.height;
        this.gameObject.rotation.x = 0;
        this.gameObject.rotation.z = 0;
        rb.lockRotationX = true;
        rb.lockRotationY = true;
        rb.lockRotationZ = true;

        // TODO: this doesnt work yet
        // setInterval(()=>{
        //     this.rigidbody.isKinematic = !this.rigidbody.isKinematic;
        //     console.log(this.rigidbody.isKinematic);
        // }, 1000)
    }

    move(vec: Vector3) {
        this.gameObject.position.add(vec);
    }

    private _activeGroundCollisions: Set<Collision> = new Set();

    onCollisionEnter(col: Collision) {
        for (const contact of col.contacts) {
            // console.log(contact.normal);
            if (contact.normal.y > .1) {
                this._activeGroundCollisions.add(col);
                break;
            }
        }
    }

    onCollisionExit(col: Collision) {
        this._activeGroundCollisions.delete(col);
    }

    get isGrounded(): boolean { return this._activeGroundCollisions.size > 0; }
}

export class CharacterControllerInput extends Behaviour {

    @serializable(CharacterController)
    controller?: CharacterController;

    @serializable()
    movementSpeed: number = 2;

    @serializable()
    rotationSpeed: number = 2;

    @serializable()
    jumpForce: number = 1;

    @serializable(Animator)
    animator?: Animator;

    lookForward: boolean = true;

    private _currentSpeed: Vector3 = new Vector3(0, 0, 0);
    private _currentAngularSpeed: Vector3 = new Vector3(0, 0, 0);

    private _temp: Vector3 = new Vector3(0, 0, 0);
    private _jumpCount: number = 0;
    private _currentRotation!: Quaternion;

    awake(){
        this._currentRotation = new Quaternion();
    }

    update() {

        if (this.controller?.isGrounded) {
            this._jumpCount = 0;
            this.animator?.SetBool("doubleJump", false);
        }

        const forward = this.context.input.isKeyPressed("w");
        const backward = this.context.input.isKeyPressed("s");
        const rotateLeft = this.context.input.isKeyPressed("a");
        const rotateRight = this.context.input.isKeyPressed("d");
        const jump = this.context.input.isKeyDown(" ");
        // if (jumpDown) this._jumpDownTime = this.context.time.time;
        // const jumpUp = this.context.input.isKeyUp(" ");

        const step = forward ? 1 : 0 + backward ? -1 : 0;
        this._currentSpeed.z += step * this.movementSpeed * this.context.time.deltaTime;

        // if (!this.controller || this.controller.isGrounded)
        this.animator?.SetBool("running", step != 0);
        this.animator?.SetBool("jumping", this.controller?.isGrounded === true && jump);

        this._temp.copy(this._currentSpeed);
        this._temp.applyQuaternion(this.gameObject.quaternion);
        if (this.controller) this.controller.move(this._temp);
        else this.gameObject.position.add(this._temp);

        const rotation = rotateLeft ? 1 : 0 + rotateRight ? -1 : 0;
        this._currentAngularSpeed.y += Mathf.toRadians(rotation * this.rotationSpeed) * this.context.time.deltaTime;
        if (this.lookForward && Math.abs(this._currentAngularSpeed.y) < .01) {
            const forwardVector = this.context.mainCameraComponent!.forward;
            forwardVector.y = 0;
            forwardVector.normalize();
            this._currentRotation.setFromUnitVectors(new Vector3(0, 0, 1), forwardVector);
            this.gameObject.quaternion.slerp(this._currentRotation, this.context.time.deltaTime * 10);
        }
        this.gameObject.rotateY(this._currentAngularSpeed.y);


        this._currentSpeed.multiplyScalar(1 - this.context.time.deltaTime * 10);
        this._currentAngularSpeed.y *= 1 - this.context.time.deltaTime * 10;

        if (this.controller && jump && this.jumpForce > 0) {
            let canJump = this.controller?.isGrounded;
            if (!this.controller?.isGrounded && this._jumpCount === 1) {
                canJump = true;
                this.animator?.SetBool("doubleJump", true);
            }

            if (canJump) {
                this._jumpCount += 1;
                // TODO: factor in mass
                const rb = this.controller.rigidbody;
                // const fullJumpHoldLength = .1;
                const factor = this._jumpCount === 2 ? 2 : 1;// Mathf.clamp((this.context.time.time - this._jumpDownTime), 0, fullJumpHoldLength) / fullJumpHoldLength;
                rb.applyImpulse(new Vector3(0, 1, 0).multiplyScalar(this.jumpForce * factor));
            }
        }

        if (this.controller) {
            // TODO: should probably raycast to the ground or check if we're still in the jump animation
            const verticalSpeed = this.controller?.rigidbody.getVelocity().y;
            if (verticalSpeed < -1) {
                if (!this._raycastOptions.ray) this._raycastOptions.ray = new Ray();
                this._raycastOptions.ray.origin.copy(getWorldPosition(this.gameObject));
                this._raycastOptions.ray.direction.set(0, -1, 0);
                const currentLayer = this.layer;
                this.gameObject.layers.disableAll();
                this.gameObject.layers.set(2);
                const hits = this.context.physics.raycast(this._raycastOptions);
                this.gameObject.layers.set(currentLayer);
                if ((hits.length && hits[0].distance > 2 || verticalSpeed < -10)) {
                    this.animator?.SetBool("falling", true);
                }
            }
            else this.animator?.SetBool("falling", false);
        }
    }

    private _raycastOptions = new RaycastOptions();
}