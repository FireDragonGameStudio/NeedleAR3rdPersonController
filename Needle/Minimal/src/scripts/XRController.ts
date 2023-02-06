import { WebXRController } from "@needle-tools/engine";
import { XRControllerValues } from "./XRControllerValues";

export class XRController {
    private handController: WebXRController | null = null;

    constructor(controller: WebXRController) {
        this.handController = controller;
        this.handController.showRaycastLine = false;
    }

    getThumbstickAxisX(): number {
        return this.getAxisNumber(XRControllerValues.XAxisThumbstick);
    }

    getThumbstickAxisY(): number {
        return this.getAxisNumber(XRControllerValues.YAxisThumbstick);
    }

    getButtonPressed(buttonIndex: number): boolean {
        const button = this.getButtonByIndex(buttonIndex);
        if (button) {
            return button.pressed && button.value == 1;
        }
        return false;
    }

    getButtonTouched(buttonIndex: number): boolean | undefined {
        const button = this.getButtonByIndex(buttonIndex);
        if (button) {
            return button.touched;
        }
        return false;
    }

    setRaycastVisibility(raycastVisible: boolean) {
        if (this.handController) this.handController.showRaycastLine = raycastVisible;
    }

    private getAxisNumber(axisNumber: number): number {
        const axisValue = this.handController?.input?.gamepad?.axes[axisNumber];
        return axisValue ? axisValue : 0;
    }

    private getButtonByIndex(buttonIndex: number): GamepadButton | undefined {
        return this.handController?.input?.gamepad?.buttons[buttonIndex];
    }
}
