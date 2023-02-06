import { Behaviour, GameObject } from "./Component";
import { FlyControls as ThreeFlyControls } from "three/examples/jsm/controls/FlyControls";
import { Camera } from "./Camera";

export class FlyControls extends Behaviour {
    private _controls: ThreeFlyControls | null = null;

    onEnable(): void {
        const cam = GameObject.getComponent(this.gameObject, Camera)?.cam;
        this._controls = new ThreeFlyControls(cam!, this.context.renderer.domElement);
        this._controls.rollSpeed = .5;
        this._controls.movementSpeed = 3;
        this._controls.dragToLook = true;
        
    }

    onDisable(): void {
        this._controls?.dispose();
        this._controls = null;
    }

    update(): void {
        if (this._controls)
            this._controls.update(this.context.time.deltaTime);
    }

}