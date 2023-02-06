import { Behaviour, GameObject } from "./Component";
import { Matrix4, Object3D } from "three";
import { WebAR, WebXR } from "./WebXR";
import { InstancingUtil } from "../engine/engine_instancing";
import { serializable } from "../engine/engine_serialization_decorator";

// https://github.com/takahirox/takahirox.github.io/blob/master/js.mmdeditor/examples/js/controls/DeviceOrientationControls.js

export class WebARSessionRoot extends Behaviour {

    webAR: WebAR | null = null;

    get rig(): Object3D | undefined {
        return this.webAR?.webxr.Rig;
    }

    @serializable()
    invertForward: boolean = false;

    @serializable()
    get arScale(): number {
        return this._arScale;
    }
    set arScale(val: number) {
        if (val === this._arScale) return;
        this._arScale = val;
        this.setScale(val);
    }

    private readonly _initalMatrix = new Matrix4();
    private readonly _selectStartFn = this.onSelectStart.bind(this);
    private readonly _selectEndFn = this.onSelectEnd.bind(this);

    start() {
        const xr = GameObject.findObjectOfType(WebXR);
        if (xr) {
            xr.Rig.updateMatrix();
            this._initalMatrix.copy(xr.Rig.matrix);
        }
    }

    private _arScale: number = 5;
    private _rig: Object3D | null = null;
    private _startPose: Matrix4 | null = null;
    private _placementPose: Matrix4 | null = null;
    private _isTouching: boolean = false;
    private _rigStartPose: Matrix4 | undefined | null = null;

    onBegin(session: XRSession) {
        this._placementPose = null;
        this.gameObject.visible = false;
        this.gameObject.matrixAutoUpdate = false;
        this._startPose = this.gameObject.matrix.clone();
        this._rigStartPose = this.rig?.matrix.clone();
        session.addEventListener('selectstart', this._selectStartFn);
        session.addEventListener('selectend', this._selectEndFn);
        // setTimeout(() => this.gameObject.visible = false, 1000); // TODO test on phone AR and Hololens if this was still needed

        // console.log(this.rig?.position, this.rig?.quaternion, this.rig?.scale);
        this.gameObject.visible = false;

        if (this.rig) {
            // reset rig to initial pose, this is helping the mix of immersive AR and immersive VR that we now have on quest
            // where the rig can be moved and scaled by the user in VR mode and we use the rig position when entering
            // immersive Ar right now to place the user/offset the session
            this.rig.matrixAutoUpdate = true;
            this._initalMatrix.decompose(this.rig.position, this.rig.quaternion, this.rig.scale);
        }
    }

    onUpdate(rig: Object3D | null, _session: XRSession, pose: XRPose | null | undefined): boolean {

        if (pose && !this._placementPose) {
            if (this._isTouching) {
                if (this.webAR) this.webAR.setReticleActive(false);
                this.placeAt(rig, new Matrix4().fromArray(pose.transform.matrix).invert());
                return true;
            }
        }
        return false;

        // if (this._placementPose) {
        //     this.gameObject.matrixAutoUpdate = false;
        //     const matrix = pose?.transform.matrix;
        //     if (matrix) {
        //         this.gameObject.matrix.fromArray(matrix);
        //     }
        //     this.gameObject.visible = true;
        // }
    }

    placeAt(rig: Object3D | null, mat: Matrix4) {
        if (!this._placementPose) this._placementPose = new Matrix4();
        this._placementPose.copy(mat);
        // apply session root offset
        const invertedSessionRoot = this.gameObject.matrixWorld.clone().invert();
        this._placementPose.premultiply(invertedSessionRoot);
        if (rig) {

            if (this.invertForward) {
                const rot = new Matrix4().makeRotationY(Math.PI);
                this._placementPose.premultiply(rot);
            }
            this._rig = rig;

            this.setScale(this.arScale);
        }
        else this._rig = null;
        // this.gameObject.matrix.copy(this._placementPose);
        // if (rig) {
        //     this.gameObject.matrix.premultiply(rig.matrixWorld)
        // }
        this.gameObject.visible = true;
    }

    onEnd(rig: Object3D | null, _session: XRSession) {
        this._placementPose = null;
        this.gameObject.visible = false;
        this.gameObject.matrixAutoUpdate = false;
        if (this._startPose) {
            this.gameObject.matrix.copy(this._startPose);
        }
        if (rig) {
            rig.matrixAutoUpdate = true;
            if (this._rigStartPose) {
                this._rigStartPose.decompose(rig.position, rig.quaternion, rig.scale);
                // console.log(rig.position, rig.quaternion, rig.scale);
            }
        }
        InstancingUtil.markDirty(this.gameObject, true);
        // HACK to fix physics being not in correct place after exiting AR
        setTimeout(() => {
            this.gameObject.matrixAutoUpdate = true;
            this.gameObject.visible = true;
        }, 100);
    }


    private onSelectStart() {
        this._isTouching = true;
    }

    private onSelectEnd() {
        this._isTouching = false;
    }

    private setScale(scale) {
        const rig = this._rig;
        if (!rig || !this._placementPose) {
            return;
        }
        // Capture the rig position before the first time we move it during a session
        if (!this._rigStartPose) {
            this._rigStartPose = rig.matrix.clone();
        }
        // we apply the transform to the rig because we want to move the user's position for easy networking
        rig.matrixAutoUpdate = false;
        rig.matrix.multiplyMatrices(new Matrix4().makeScale(scale, scale, scale), this._placementPose);
        rig.matrix.decompose(rig.position, rig.quaternion, rig.scale);
        rig.updateMatrixWorld();
        console.log("Place", rig.position);
    }
}