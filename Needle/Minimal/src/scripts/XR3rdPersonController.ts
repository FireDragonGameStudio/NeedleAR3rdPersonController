import { Behaviour, CharacterController, Mathf, serializable, WebXR } from "@needle-tools/engine";
import { RaycastOptions } from "@needle-tools/engine/engine/engine_physics";
import { getWorldPosition } from "@needle-tools/engine/engine/engine_three_utils";
import { Quaternion, Ray, Vector3 } from "three";
import { XRController } from "./XRController";
import { XRControllerValues } from "./XRControllerValues";

export class XR3rdPersonController extends Behaviour {
    @serializable(CharacterController)
    characterController?: CharacterController;

    @serializable(WebXR)
    webXR?: WebXR;

    @serializable()
    movementSpeed: number = 2;

    @serializable()
    rotationSpeed: number = 2;

    @serializable()
    lookForward: boolean = true;

    private _leftController?: XRController;
    private _rightController?: XRController;

    private _currentSpeed: Vector3 = new Vector3(0, 0, 0);
    private _currentAngularSpeed: Vector3 = new Vector3(0, 0, 0);
    private _raycastOptions = new RaycastOptions();

    private _temp: Vector3 = new Vector3(0, 0, 0);
    private _currentRotation!: Quaternion;

    awake() {
        this._currentRotation = new Quaternion();
    }

    update() {
        if (this.webXR && this.webXR.LeftController && this.webXR.RightController) {
            if (!this._leftController || !this._rightController) {
                this._leftController = new XRController(this.webXR.LeftController);
                this._rightController = new XRController(this.webXR.RightController);
            }

            const forward = this.context.input.isKeyPressed("w") || this._leftController.getThumbstickAxisY() < 0;
            const backward = this.context.input.isKeyPressed("s") || this._leftController.getThumbstickAxisY() > 0;
            const rotateLeft = this.context.input.isKeyPressed("a") || this._rightController.getThumbstickAxisX() < 0;
            const rotateRight = this.context.input.isKeyPressed("d") || this._rightController.getThumbstickAxisX() > 0;

            const step = forward ? 1 : 0 + backward ? -1 : 0;
            this._currentSpeed.z += step * this.movementSpeed * this.context.time.deltaTime;

            this._temp.copy(this._currentSpeed);
            this._temp.applyQuaternion(this.gameObject.quaternion);
            if (this.characterController) this.characterController.move(this._temp);
            else this.gameObject.position.add(this._temp);

            const rotation = rotateLeft ? 1 : 0 + rotateRight ? -1 : 0;
            this._currentAngularSpeed.y += Mathf.toRadians(rotation * this.rotationSpeed) * this.context.time.deltaTime;
            if (this.lookForward && Math.abs(this._currentAngularSpeed.y) < 0.01) {
                const forwardVector = this.context.mainCameraComponent!.forward;
                forwardVector.y = 0;
                forwardVector.normalize();
                this._currentRotation.setFromUnitVectors(new Vector3(0, 0, 1), forwardVector);
                this.gameObject.quaternion.slerp(this._currentRotation, this.context.time.deltaTime * 10);
            }
            this.gameObject.rotateY(this._currentAngularSpeed.y);

            this._currentSpeed.multiplyScalar(1 - this.context.time.deltaTime * 10);
            this._currentAngularSpeed.y *= 1 - this.context.time.deltaTime * 10;

            if (this.characterController) {
                // TODO: should probably raycast to the ground or check if we're still in the jump animation
                const verticalSpeed = this.characterController?.rigidbody.getVelocity().y;
                if (verticalSpeed < -1) {
                    if (!this._raycastOptions.ray) this._raycastOptions.ray = new Ray();
                    this._raycastOptions.ray.origin.copy(getWorldPosition(this.gameObject));
                    this._raycastOptions.ray.direction.set(0, -1, 0);
                    const currentLayer = this.layer;
                    this.gameObject.layers.disableAll();
                    this.gameObject.layers.set(2);
                    const hits = this.context.physics.raycast(this._raycastOptions);
                    this.gameObject.layers.set(currentLayer);
                }
            }
        }
    }

    public getButtonAPressed(): boolean {
        if ((this._leftController && this._leftController.getButtonPressed(XRControllerValues.ButtonAX)) || (this._rightController && this._rightController.getButtonPressed(XRControllerValues.ButtonAX))) {
            return true;
        }
        return false;
    }
}
