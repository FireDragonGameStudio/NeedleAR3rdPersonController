import { BoxHelper, BufferGeometry, Color, Euler, Group, Intersection, Layers, Line, LineBasicMaterial, Material, Mesh, MeshBasicMaterial, Object3D, PerspectiveCamera, Quaternion, Ray, SphereGeometry, Vector2, Vector3 } from "three";
import { OculusHandModel } from 'three/examples/jsm/webxr/OculusHandModel.js';
import { OculusHandPointerModel } from 'three/examples/jsm/webxr/OculusHandPointerModel.js';
import { XRControllerModel, XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import { InstancingUtil } from "../engine/engine_instancing";
import { Mathf } from "../engine/engine_math";
import { RaycastOptions } from "../engine/engine_physics";
import { getWorldPosition, getWorldQuaternion, setWorldPosition, setWorldQuaternion } from "../engine/engine_three_utils";
import { getParam, getPath } from "../engine/engine_utils";
import { addDracoAndKTX2Loaders } from "../engine/engine_loaders";

import { Avatar_POI } from "./avatar/Avatar_Brain_LookAt";
import { Behaviour, GameObject } from "./Component";
import { Interactable, UsageMarker } from "./Interactable";
import { Rigidbody } from "./RigidBody";
import { SyncedTransform } from "./SyncedTransform";
import { UIRaycastUtils } from "./ui/RaycastUtils";
import { WebXR } from "./WebXR";

const debug = getParam("debugwebxrcontroller");

export enum ControllerType {
    PhysicalDevice = 0,
    Touch = 1,
}

export enum ControllerEvents {
    SelectStart = "select-start",
    SelectEnd = "select-end",
    Update = "update",
}

export class TeleportTarget extends Behaviour {

}

export class WebXRController extends Behaviour {

    public static Factory: XRControllerModelFactory = new XRControllerModelFactory();

    private static raycastColor: Color = new Color(.9, .3, .3);
    private static raycastNoHitColor: Color = new Color(.6, .6, .6);
    private static geometry = new BufferGeometry().setFromPoints([new Vector3(0, 0, 0), new Vector3(0, 0, -1)]);
    private static handModels: { [index: number]: OculusHandPointerModel } = {};

    private static CreateRaycastLine(): Line {
        const line = new Line(this.geometry);
        const mat = line.material as LineBasicMaterial;
        mat.color = this.raycastColor;
        // mat.linewidth = 10;
        line.layers.set(2);
        line.name = 'line';
        line.scale.z = 1;
        return line;
    }

    private static CreateRaycastHitPoint(): Mesh {
        const geometry = new SphereGeometry(.5, 22, 22);
        const material = new MeshBasicMaterial({ color: this.raycastColor });
        const sphere = new Mesh(geometry, material);
        sphere.visible = false;
        sphere.layers.set(2);
        return sphere;
    }

    public static Create(owner: WebXR, index: number, addTo: GameObject, type: ControllerType): WebXRController {
        const ctrl = addTo ? GameObject.addNewComponent(addTo, WebXRController, false) : new WebXRController();

        ctrl.webXR = owner;
        ctrl.index = index;
        ctrl.type = type;

        const context = owner.context;
        // from https://github.com/mrdoob/js/blob/master/examples/webxr_vr_dragging.html
        // controllers
        ctrl.controller = context.renderer.xr.getController(index);
        ctrl.controllerGrip = context.renderer.xr.getControllerGrip(index);
        ctrl.controllerModel = this.Factory.createControllerModel(ctrl.controller);
        ctrl.controllerGrip.add(ctrl.controllerModel);

        ctrl.hand = context.renderer.xr.getHand(index);

        const loader = new GLTFLoader();
        addDracoAndKTX2Loaders(loader, context);
        if (ctrl.webXR.handModelPath && ctrl.webXR.handModelPath !== "")
            loader.setPath(getPath(owner.sourceId, ctrl.webXR.handModelPath));
        else
            // from XRHandMeshModel.js
            loader.setPath('https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles/generic-hand/');
        //@ts-ignore
        const hand = new OculusHandModel(ctrl.hand, loader);

        ctrl.hand.add(hand);
        ctrl.hand.traverse(x => x.layers.set(2));

        ctrl.handPointerModel = new OculusHandPointerModel(ctrl.hand, ctrl.controller);


        // TODO remove all these once https://github.com/mrdoob/js/pull/23279 lands
        ctrl.controller.addEventListener('connected', (_) => {
            ctrl.setControllerLayers(ctrl.controllerModel, 2);
            ctrl.setControllerLayers(ctrl.controllerGrip, 2);
            ctrl.setControllerLayers(ctrl.hand, 2);
            setTimeout(() => {
                ctrl.setControllerLayers(ctrl.controllerModel, 2);
                ctrl.setControllerLayers(ctrl.controllerGrip, 2);
                ctrl.setControllerLayers(ctrl.hand, 2);
            }, 1000);
        });

        // TODO: unsubscribe! this should be moved into onenable and ondisable!
        // TODO remove all these once https://github.com/mrdoob/js/pull/23279 lands
        ctrl.hand.addEventListener('connected', (event) => {
            const xrInputSource = event.data;
            if (xrInputSource.hand) {
                if (owner.Rig) owner.Rig.add(ctrl.hand);
                ctrl.type = ControllerType.PhysicalDevice;
                ctrl.handPointerModel.traverse(x => x.layers.set(2)); // ignore raycast
                ctrl.handPointerModel.pointerObject?.traverse(x => x.layers.set(2));

                // when exiting and re-entering xr the joints are not parented to the hand anymore
                // this is a workaround to fix that temporarely
                // see https://github.com/needle-tools/needle-tiny-playground/issues/123
                const jnts = ctrl.hand["joints"];
                if (jnts) {
                    for (const key of Object.keys(jnts)) {
                        const joint = jnts[key];
                        if (joint.parent) continue;
                        ctrl.hand.add(joint);
                    }
                }
            }
        });

        return ctrl;
    }

    // TODO: replace with component events
    public static addEventListener(evt: ControllerEvents, callback: (controller: WebXRController, args: any) => void) {
        const list = this.eventSubs[evt] ?? [];
        list.push(callback);
        this.eventSubs[evt] = list;
    }

    // TODO: replace with component events
    public static removeEventListener(evt: ControllerEvents, callback: (controller: WebXRController, args: any) => void) {
        if (!callback) return;
        const list = this.eventSubs[evt] ?? [];
        const idx = list.indexOf(callback);
        if (idx >= 0) list.splice(idx, 1);
        this.eventSubs[evt] = list;
    }

    private static eventSubs: { [key: string]: Function[] } = {};

    public webXR!: WebXR;
    public index: number = -1;
    public controllerModel!: XRControllerModel;
    public controller!: Group;
    public controllerGrip!: Group;
    public hand!: Group;
    public handPointerModel!: OculusHandPointerModel;
    public grabbed: AttachedObject | null = null;
    public input: XRInputSource | null = null;
    public type: ControllerType = ControllerType.PhysicalDevice;
    public showRaycastLine : boolean = true;

    get isUsingHands(): boolean {
        const r = this.input?.hand;
        return r !== null && r !== undefined;
    }

    get wrist(): Object3D | null {
        if (!this.hand) return null;
        const jnts = this.hand["joints"];
        if (!jnts) return null;
        return jnts["wrist"];
    }

    private _wristQuaternion: Quaternion | null = null;
    getWristQuaternion(): Quaternion | null {
        const wrist = this.wrist;
        if (!wrist) return null;
        if (!this._wristQuaternion) this._wristQuaternion = new Quaternion();
        const wr = getWorldQuaternion(wrist).multiply(this._wristQuaternion.setFromEuler(new Euler(-Math.PI / 4, 0, 0)));
        return wr;
    }

    private movementVector: Vector3 = new Vector3();
    private worldRot: Quaternion = new Quaternion();
    private joystick: Vector2 = new Vector2();
    private didRotate: boolean = false;
    private didTeleport: boolean = false;
    private didChangeScale: boolean = false;
    private static PreviousCameraFarDistance: number | undefined = undefined;
    private static MovementSpeedFactor: number = 1;

    private lastHit: Intersection | null = null;

    private raycastLine: Line | null = null;
    private _raycastHitPoint: Object3D | null = null;
    private _connnectedCallback: any | null = null;
    private _disconnectedCallback: any | null = null;
    private _selectStartEvt: any | null = null;
    private _selectEndEvt: any | null = null;

    public get selectionDown(): boolean { return this._selectionPressed && !this._selectionPressedLastFrame; }
    public get selectionUp(): boolean { return !this._selectionPressed && this._selectionPressedLastFrame; }
    public get selectionPressed(): boolean { return this._selectionPressed; }
    public get selectionClick(): boolean { return this._selectionEndTime - this._selectionStartTime < 0.3; }
    public get raycastHitPoint(): Object3D | null { return this._raycastHitPoint; }

    private _selectionPressed: boolean = false;
    private _selectionPressedLastFrame: boolean = false;
    private _selectionStartTime: number = 0;
    private _selectionEndTime: number = 0;

    public get useSmoothing(): boolean { return this._useSmoothing };
    private _useSmoothing: boolean = true;

    awake(): void {
        if (!this.controller) {
            console.warn("Missing Controller!!!", this);
            return;
        }
        this._connnectedCallback = this.onSourceConnected.bind(this);
        this._disconnectedCallback = this.onSourceDisconnected.bind(this);
        this._selectStartEvt = this.onSelectStart.bind(this);
        this._selectEndEvt = this.onSelectEnd.bind(this);
        if (this.type === ControllerType.Touch) {
            this.controllerGrip.addEventListener("connected", this._connnectedCallback);
            this.controllerGrip.addEventListener("disconnected", this._disconnectedCallback);
            this.controller.addEventListener('selectstart', this._selectStartEvt);
            this.controller.addEventListener('selectend', this._selectEndEvt);
        }
        if (this.type === ControllerType.PhysicalDevice) {
            this.controller.addEventListener('selectstart', this._selectStartEvt);
            this.controller.addEventListener('selectend', this._selectEndEvt);
        }
    }

    onDestroy(): void {
        if (this.type === ControllerType.Touch) {
            this.controllerGrip.removeEventListener("connected", this._connnectedCallback);
            this.controllerGrip.removeEventListener("disconnected", this._disconnectedCallback);
            this.controller.removeEventListener('selectstart', this._selectStartEvt);
            this.controller.removeEventListener('selectend', this._selectEndEvt);
        }
        if (this.type === ControllerType.PhysicalDevice) {
            this.controller.removeEventListener('selectstart', this._selectStartEvt);
            this.controller.removeEventListener('selectend', this._selectEndEvt);
        }

        this.hand?.clear();
        this.controllerGrip?.clear();
        this.controller?.clear();
    }

    public onEnable(): void {
        if (this.hand)
            this.hand.name = "Hand";
        if (this.controllerGrip)
            this.controllerGrip.name = "ControllerGrip";
        if (this.controller)
            this.controller.name = "Controller";
        if (this.raycastLine)
            this.raycastLine.name = "RaycastLine;"

        if (this.webXR.Controllers.indexOf(this) < 0)
            this.webXR.Controllers.push(this);

        if (!this.raycastLine)
            this.raycastLine = WebXRController.CreateRaycastLine();
        if (!this._raycastHitPoint)
            this._raycastHitPoint = WebXRController.CreateRaycastHitPoint();

        this.webXR.Rig?.add(this.hand);
        this.webXR.Rig?.add(this.controllerGrip);
        this.webXR.Rig?.add(this.controller);
        this.webXR.Rig?.add(this.raycastLine);
        this.raycastLine?.add(this._raycastHitPoint);
        this._raycastHitPoint.visible = false;
        this.hand.add(this.handPointerModel);
        if (debug)
            console.log("ADDED TO RIG", this.webXR.Rig);

        // // console.log("enable", this.index, this.controllerGrip.uuid)
    }

    onDisable(): void {
        // console.log("XR controller disabled", this);
        this.hand?.removeFromParent();
        this.controllerGrip?.removeFromParent();
        this.controller?.removeFromParent();
        this.raycastLine?.removeFromParent();
        this._raycastHitPoint?.removeFromParent();
        // console.log("Disable", this._connnectedCallback, this._disconnectedCallback);
        // this.controllerGrip.removeEventListener("connected", this._connnectedCallback);
        // this.controllerGrip.removeEventListener("disconnected", this._disconnectedCallback);

        const i = this.webXR.Controllers.indexOf(this);
        if (i >= 0)
            this.webXR.Controllers.splice(i, 1);
    }

    // onDestroy(): void {
    //     console.log("destroyed", this.index);
    // }

    private _isConnected: boolean = false;

    private onSourceConnected(e: { data: XRInputSource, target: any }) {
        if (this._isConnected) {
            console.warn("Received connected event for controller that is already connected", this.index, e);
            return;
        }
        this._isConnected = true;
        this.input = e.data;

        if (this.type === ControllerType.Touch) {
            this.onSelectStart();
            this.createPointerEvent("down");
        }
    }

    private onSourceDisconnected(_e: any) {
        if (!this._isConnected) {
            console.warn("Received discnnected event for controller that is not connected", _e);
            return;
        }
        this._isConnected = false;
        if (this.type === ControllerType.Touch) {
            this.onSelectEnd();
            this.createPointerEvent("up");
        }
        this.input = null;
    }

    private createPointerEvent(type: string) {
        switch (type) {
            case "down":
                this.context.input.createPointerDown({ clientX: 0, clientY: 0, button: this.index, pointerType: "touch" });
                break;
            case "move":
                break;
            case "up":
                this.context.input.createPointerUp({ clientX: 0, clientY: 0, button: this.index, pointerType: "touch" });
                break;
        }
    }

    rayRotation: Quaternion = new Quaternion();

    update(): void {

        // TODO: we should wait until we actually have models, this is just a workaround
        if (this.context.time.frameCount % 60 === 0) {
            this.setControllerLayers(this.controller, 2);
            this.setControllerLayers(this.controllerGrip, 2);
            this.setControllerLayers(this.hand, 2);
        }

        const subs = WebXRController.eventSubs[ControllerEvents.Update];
        if (subs && subs.length > 0) {
            for (const sub of subs) {
                sub(this);
            }
        }

        let t = 1;
        if (this.type === ControllerType.PhysicalDevice) t = this.context.time.deltaTime / .1;
        else if (this.isUsingHands && this.handPointerModel.pinched) t = this.context.time.deltaTime / .3;
        this.rayRotation.slerp(getWorldQuaternion(this.controller), this.useSmoothing ? t : 1.0);
        const wp = getWorldPosition(this.controller);

        // hide hand pointer model, it's giant and doesn't really help
        if (this.isUsingHands && this.handPointerModel.cursorObject) {
            this.handPointerModel.cursorObject.visible = false;
        }

        if (this.raycastLine) {
            const allowRaycastLineVisible = this.showRaycastLine && this.type !== ControllerType.Touch;
            if (this.type === ControllerType.Touch) {
                this.raycastLine.visible = false;
            }
            else if (this.isUsingHands) {
                this.raycastLine.visible = !this.grabbed && allowRaycastLineVisible;
                setWorldPosition(this.raycastLine, wp);
                const jnts = this.hand!['joints'];
                if (jnts) {
                    const wrist = jnts['wrist'];
                    if (wrist && this.grabbed && this.grabbed.isCloseGrab) {
                        const wr = this.getWristQuaternion();
                        if (wr)
                            this.rayRotation.copy(wr);
                        // this.rayRotation.slerp(wr, this.useSmoothing ? t * 2 : 1);
                    }
                }
                setWorldQuaternion(this.raycastLine, this.rayRotation);
            }
            else {
                this.raycastLine.visible = allowRaycastLineVisible;
                setWorldQuaternion(this.raycastLine, this.rayRotation);
                setWorldPosition(this.raycastLine, wp);
            }
        }

        this.lastHit = this.updateLastHit();

        if (this.grabbed) {
            this.grabbed.update();
        }

        this._selectionPressedLastFrame = this._selectionPressed;

        if (this.selectStartCallback) {
            this.selectStartCallback();
        }
    }

    private _pinchStartTime: number | undefined = undefined;

    onUpdate(session: XRSession) {
        this.lastHit = null;

        if (!session || session.inputSources.length <= this.index) {
            this.input = null;
            return;
        }
        if (this.type === ControllerType.PhysicalDevice)
            this.input = session.inputSources[this.index];
        if (!this.input) return;
        const rig = this.webXR.Rig;
        if (!rig) return;

        if (this._didNotEndSelection && !this.handPointerModel.pinched) {
            this._didNotEndSelection = false;
            this.onSelectEnd();
        }

        this.updateStick(this.input);

        const buttons = this.input?.gamepad?.buttons;

        switch (this.input.handedness) {
            case "left":
                const speedFactor = 3 * WebXRController.MovementSpeedFactor;
                const powFactor = 2;
                const speed = Mathf.clamp01(this.joystick.length() * 2);

                const sideDir = this.joystick.x > 0 ? 1 : -1;
                let side = Math.pow(this.joystick.x, powFactor);
                side *= sideDir;
                side *= speed;


                const forwardDir = this.joystick.y > 0 ? 1 : -1;
                let forward = Math.pow(this.joystick.y, powFactor);
                forward *= forwardDir;
                side *= speed;

                rig.getWorldQuaternion(this.worldRot);
                this.movementVector.set(side, 0, forward);
                this.movementVector.applyQuaternion(this.webXR.TransformOrientation);
                this.movementVector.y = 0;
                this.movementVector.applyQuaternion(this.worldRot);
                this.movementVector.multiplyScalar(speedFactor * this.context.time.deltaTime);
                rig.position.add(this.movementVector);

                if (this.isUsingHands)
                    this.runTeleport(rig, buttons);
                break;

            case "right":
                const rotate = this.joystick.x;
                const rotAbs = Math.abs(rotate);
                if (rotAbs < 0.4) {
                    this.didRotate = false;
                }
                else if (rotAbs > .5 && !this.didRotate) {
                    const dir = rotate > 0 ? -1 : 1;
                    rig.rotateY(Mathf.toRadians(30 * dir));
                    this.didRotate = true;
                }

                this.runTeleport(rig, buttons);

                break;
        }
    }

    private runTeleport(rig, buttons) {
        let teleport = -this.joystick.y;
        if (this.hand?.visible && !this.grabbed) {
            const pinched = this.handPointerModel.isPinched();
            if (pinched && this._pinchStartTime === undefined) {
                this._pinchStartTime = this.context.time.time;
            }
            if (pinched && this._pinchStartTime && this.context.time.time - this._pinchStartTime > .8) {
                // hacky approach for basic hand teleportation - 
                // we teleport if we pinch and the back of the hand points down (open hand gesture)
                // const v1 = new Vector3();
                // const worldQuaternion = new Quaternion();
                // this.controller.getWorldQuaternion(worldQuaternion);
                // v1.copy(this.controller.up).applyQuaternion(worldQuaternion);
                // const dotPr = -v1.dot(this.controller.up);
                teleport = this.handPointerModel.isPinched() ? 1 : 0;
            }
            if (!pinched) this._pinchStartTime = undefined;
        }
        else this._pinchStartTime = undefined;

        let doTeleport = teleport > .5 && this.webXR.IsInVR;
        let isInMiniatureMode = this.webXR.Rig ? this.webXR.Rig?.scale?.x < .999 : false;
        let newRigScale: number | null = null;

        if (buttons && this.input && !this.input.hand) {
            for (let i = 0; i < buttons.length; i++) {
                const btn = buttons[i];
                // button[4] seems to be the A button if it exists. On hololens it's randomly pressed though for hands
                // see https://www.w3.org/TR/webxr-gamepads-module-1/#xr-standard-gamepad-mapping
                if (i === 4) {
                    if (btn.pressed && !this.didChangeScale && this.webXR.IsInVR) {
                        this.didChangeScale = true;
                        const rig = this.webXR.Rig;
                        if (rig) {
                            if (!isInMiniatureMode) {
                                isInMiniatureMode = true;
                                doTeleport = true;
                                newRigScale = .1;
                                WebXRController.MovementSpeedFactor = newRigScale * 2;
                                const cam = this.context.mainCamera as PerspectiveCamera;
                                WebXRController.PreviousCameraFarDistance = cam.far;
                                cam.far /= newRigScale;
                            }
                            else {
                                isInMiniatureMode = false;
                                rig.scale.set(1, 1, 1);
                                newRigScale = 1;
                                WebXRController.MovementSpeedFactor = 1;
                                const cam = this.context.mainCamera as PerspectiveCamera;
                                if (WebXRController.PreviousCameraFarDistance)
                                    cam.far = WebXRController.PreviousCameraFarDistance;
                            }
                        }
                    }
                    else if (!btn.pressed)
                        this.didChangeScale = false;
                }
            }
        }

        if (doTeleport) {
            if (!this.didTeleport) {
                const rc = this.raycast();
                this.didTeleport = true;
                if (rc && rc.length > 0) {
                    const hit = rc[0];
                    if (isInMiniatureMode || this.isValidTeleportTarget(hit.object)) {
                        const point = hit.point;
                        setWorldPosition(rig, point);
                    }
                }
            }
        }
        else if (teleport < .1) {
            this.didTeleport = false;
        }

        if (newRigScale !== null) {
            rig.scale.set(newRigScale, newRigScale, newRigScale);
            rig.updateMatrixWorld();
        }
    }

    private isValidTeleportTarget(obj: Object3D): boolean {
        return GameObject.getComponentInParent(obj, TeleportTarget) != null;
    }

    private updateStick(inputSource: XRInputSource) {
        if (!inputSource || !inputSource.gamepad || inputSource.gamepad.axes?.length < 4) return;
        this.joystick.x = inputSource.gamepad.axes[2];
        this.joystick.y = inputSource.gamepad.axes[3];
    }

    private updateLastHit(): Intersection | null {
        const rc = this.raycast();
        const hit = rc ? rc[0] : null;
        this.lastHit = hit;
        let factor = 1;
        if (this.webXR.Rig) {
            factor /= this.webXR.Rig.scale.x;
        }
        // if (!hit) factor = 0;

        if (this.raycastLine) {
            this.raycastLine.scale.z = factor * (this.lastHit?.distance ?? 9999);
            const mat = this.raycastLine.material as LineBasicMaterial;
            if (hit != null) mat.color = WebXRController.raycastColor;
            else mat.color = WebXRController.raycastNoHitColor;
        }
        if (this._raycastHitPoint) {
            if (this.lastHit != null) {
                this._raycastHitPoint.position.z = -1;// -this.lastHit.distance;
                const scale = Mathf.clamp(this.lastHit.distance * .01 * factor, .015, .1);
                this._raycastHitPoint.scale.set(scale, scale, scale);
            }
            this._raycastHitPoint.visible = this.lastHit !== null && this.lastHit !== undefined;
        }
        return hit;
    }

    private onSelectStart() {
        if (!this.context.connection.allowEditing) return;
        // console.log("SELECT START", _event);
        // if we process the event immediately the controller 
        // world positions are not yet correctly updated and we have info from the last frame
        // so we delay the event processing one frame
        // only necessary for AR - ideally we can get it to work right here
        // but should be fine as a workaround for now
        this.selectStartCallback = () => this.onHandleSelectStart();
    }

    private selectStartCallback: Function | null = null;
    private lastSelectStartObject: Object3D | null = null;;

    private onHandleSelectStart() {
        this.selectStartCallback = null;
        this._selectionPressed = true;
        this._selectionStartTime = this.context.time.time;
        this._selectionEndTime = 1000;
        // console.log("DOWN", this.index, WebXRController.eventSubs);

        // let maxDistance = this.isUsingHands ? .1 : undefined;
        let intersections: Intersection[] | null = null;
        let closeGrab: boolean = false;
        if (this.isUsingHands) {
            intersections = this.overlap();
            if (intersections.length <= 0) {
                intersections = this.raycast();
                closeGrab = false;
            }
            else {
                closeGrab = true;
            }
        }
        else intersections = this.raycast();

        if (debug)
            console.log("onHandleSelectStart", "close grab? " + closeGrab, "intersections", intersections);

        if (intersections && intersections.length > 0) {
            for (const intersection of intersections) {
                const object = intersection.object;
                this.lastSelectStartObject = object;
                const args = { selected: object, grab: object };
                const subs = WebXRController.eventSubs[ControllerEvents.SelectStart];
                if (subs && subs.length > 0) {
                    for (const sub of subs) {
                        sub(this, args);
                    }
                }
                if (args.grab !== object && debug)
                    console.log("Grabbed object changed", "original", object, "new", args.grab);
                if (args.grab) {
                    this.grabbed = AttachedObject.TryTake(this, args.grab, intersection, closeGrab);
                }
                break;
            }
        }
        else {
            const subs = WebXRController.eventSubs[ControllerEvents.SelectStart];
            const args = { selected: null, grab: null };
            if (subs && subs.length > 0) {
                for (const sub of subs) {
                    sub(this, args);
                }
            }
        }
    }

    private _didNotEndSelection: boolean = false;

    private onSelectEnd() {
        if (this.isUsingHands) {
            if (this.handPointerModel.pinched) {
                this._didNotEndSelection = true;
                return;
            }
        }

        if (!this._selectionPressed) return;
        this.selectStartCallback = null;
        this._selectionPressed = false;
        this._selectionEndTime = this.context.time.time;

        const args = { grab: this.grabbed?.selected ?? this.lastSelectStartObject };
        const subs = WebXRController.eventSubs[ControllerEvents.SelectEnd];
        if (subs && subs.length > 0) {
            for (const sub of subs) {
                sub(this, args);
            }
        }

        if (this.grabbed) {
            this.grabbed.free();
            this.grabbed = null;
        }
    }

    private testIsVisible(obj: Object3D | null): boolean {
        if (!obj) return false;
        if (GameObject.isActiveInHierarchy(obj) === false) return false;
        if (UIRaycastUtils.isInteractable(obj) === false) {
            return false;
        }
        return true;
        // if (!obj.visible) return false;
        // return this.testIsVisible(obj.parent);
    }

    private setControllerLayers(obj: Object3D, layer: number) {
        if (!obj) return;
        obj.layers.set(layer);
        if (obj.children) {
            for (const ch of obj.children) {
                if (this.grabbed?.selected === ch || this.grabbed?.selectedMesh === ch) {
                    continue;
                }
                this.setControllerLayers(ch, layer);
            }
        }
    }

    public getRay(): Ray {
        const ray = new Ray();
        // this.tempMatrix.identity().extractRotation(this.controller.matrixWorld);
        // ray.origin.setFromMatrixPosition(this.controller.matrixWorld);
        ray.origin.copy(getWorldPosition(this.controller));
        ray.direction.set(0, 0, -1).applyQuaternion(this.rayRotation);
        return ray;
    }

    private closeGrabBoundingBoxHelper?: BoxHelper;

    public overlap(): Intersection[] {
        const overlapCenter = (this.isUsingHands && this.handPointerModel) ? this.handPointerModel.pointerObject : this.controllerGrip;

        if (debug) {
            if (!this.closeGrabBoundingBoxHelper && overlapCenter) {
                this.closeGrabBoundingBoxHelper = new BoxHelper(overlapCenter, 0xffff00);
                this.scene.add(this.closeGrabBoundingBoxHelper);
            }

            if (this.closeGrabBoundingBoxHelper && overlapCenter) {
                this.closeGrabBoundingBoxHelper.setFromObject(overlapCenter);
            }
        }

        if (!overlapCenter)
            return new Array<Intersection>();

        const wp = getWorldPosition(overlapCenter).clone();
        return this.context.physics.sphereOverlap(wp, .02);
    }

    public raycast(): Intersection[] {
        const opts = new RaycastOptions();
        opts.layerMask = new Layers();
        opts.layerMask.set(0);
        opts.layerMask.disable(2);
        opts.ray = this.getRay();
        const hits = this.context.physics.raycast(opts);
        for (let i = 0; i < hits.length; i++) {
            const hit = hits[i];
            const obj = hit.object;
            if (!this.testIsVisible(obj)) {
                hits.splice(i, 1);
                i--;
                continue;
            }
            hit.object = UIRaycastUtils.getObject(obj);
            break;
        }
        // console.log(...hits);
        return hits;
    }
}


export enum AttachedObjectEvents {
    WillTake = "WillTake",
    DidTake = "DidTake",
    WillFree = "WillFree",
    DidFree = "DidFree",
}

export class AttachedObject {

    public static Events: { [key: string]: Function[] } = {};
    public static AddEventListener(event: AttachedObjectEvents, callback: Function): Function {
        if (!AttachedObject.Events[event]) AttachedObject.Events[event] = [];
        AttachedObject.Events[event].push(callback);
        return callback;
    }
    public static RemoveEventListener(event: AttachedObjectEvents, callback: Function | null) {
        if (!callback) return;
        if (!AttachedObject.Events[event]) return;
        const idx = AttachedObject.Events[event].indexOf(callback);
        if (idx >= 0) AttachedObject.Events[event].splice(idx, 1);
    }


    public static Current: AttachedObject[] = [];

    private static Register(obj: AttachedObject) {

        if (!this.Current.find(x => x === obj)) {
            this.Current.push(obj);
        }
    }

    private static Remove(obj: AttachedObject) {
        const i = this.Current.indexOf(obj);
        if (i >= 0) {
            this.Current.splice(i, 1);
        }
    }

    public static TryTake(controller: WebXRController, candidate: Object3D, intersection: Intersection, closeGrab: boolean): AttachedObject | null {
        const interactable = GameObject.getComponentInParent(candidate, Interactable);
        if (!interactable) {
            if (debug)
                console.warn("Prevented taking object that is not interactable", candidate);
            return null;
        }
        else candidate = interactable.gameObject;


        let objectToAttach = candidate;
        const sync = GameObject.getComponentInParent(candidate, SyncedTransform);
        if (sync) {
            sync.requestOwnership();
            objectToAttach = sync.gameObject;
        }

        for (const o of this.Current) {
            if (o.selected === objectToAttach) {
                if (o.controller === controller) return o;
                o.free();
                o.Take(controller, objectToAttach, candidate, sync, interactable, intersection, closeGrab);
                return o;
            }
        }

        const att = new AttachedObject();
        att.Take(controller, objectToAttach, candidate, sync, interactable, intersection, closeGrab);
        return att;
    }


    public sync: SyncedTransform | null = null;
    public selected: Object3D | null = null;
    public selectedParent: Object3D | null = null;
    public selectedMesh: Mesh | null = null;
    public controller: WebXRController | null = null;
    public grabTime: number = 0;
    public grabUUID: string = "";
    public isCloseGrab: boolean = false; // when taken via sphere cast with hands

    private originalMaterial: Material | Material[] | null = null;
    private usageMarker: UsageMarker | null = null;
    private rigidbodies: Rigidbody[] | null = null;
    private didReparent: boolean = false;
    private grabDistance: number = 0;
    private interactable: Interactable | null = null;
    private positionSource: Object3D | null = null;

    private Take(controller: WebXRController, take: Object3D, hit: Object3D, sync: SyncedTransform | null, _interactable: Interactable,
        intersection: Intersection, closeGrab: boolean)
        : AttachedObject {
        console.assert(take !== null, "Expected object to be taken but was", take);

        if (controller.isUsingHands) {
            this.positionSource = closeGrab ? controller.wrist : controller.controller;
        }
        else {
            this.positionSource = controller.controller;
        }
        if (!this.positionSource) {
            console.warn("No position source");
            return this;
        }

        const args = { controller, take, hit, sync, interactable: _interactable };
        AttachedObject.Events.WillTake?.forEach(x => x(this, args));


        const mesh = hit as Mesh;
        if (mesh?.material) {
            this.originalMaterial = mesh.material;
            if (!Array.isArray(mesh.material)) {
                mesh.material = (mesh.material as Material).clone();
                if (mesh.material && mesh.material["emissive"])
                    mesh.material["emissive"].b = .2;
            }
        }

        this.selected = take;
        if (!this.selectedParent) {
            this.selectedParent = take.parent;
        }
        this.selectedMesh = mesh;
        this.controller = controller;
        this.interactable = _interactable;
        this.isCloseGrab = closeGrab;
        // if (interactable.canGrab) {
        //     this.didReparent = true;
        //     this.device.controller.attach(take);
        // }
        // else 
        this.didReparent = false;


        this.sync = sync;
        this.grabTime = controller.context.time.time;
        this.grabUUID = Date.now().toString();
        this.usageMarker = GameObject.addNewComponent(this.selected, UsageMarker);
        this.rigidbodies = GameObject.getComponentsInChildren(this.selected, Rigidbody);
        getWorldPosition(this.positionSource, this.lastControllerWorldPos);
        const getGrabPoint = () => closeGrab ? this.lastControllerWorldPos.clone() : intersection.point.clone();
        this.grabDistance = getGrabPoint().distanceTo(this.lastControllerWorldPos);
        this.totalChangeAlongDirection = 0.0;

        // we're storing position relative to the grab point
        // we're storing rotation relative to the ray
        this.localPositionOffsetToGrab = this.selected.worldToLocal(getGrabPoint());
        const rot = controller.isUsingHands && closeGrab ? this.controller.getWristQuaternion()!.clone() : controller.rayRotation.clone();
        getWorldQuaternion(this.selected, this.localQuaternionToGrab).premultiply(rot.invert());

        const rig = this.controller.webXR.Rig;
        if (rig)
            this.rigPositionLastFrame.copy(getWorldPosition(rig))

        Avatar_POI.Add(controller.context, this.selected);
        AttachedObject.Register(this);

        if (this.sync) {
            this.sync.fastMode = true;
        }

        AttachedObject.Events.DidTake?.forEach(x => x(this, args));

        return this;
    }

    public free(): void {
        if (!this.selected) return;

        const args = { controller: this.controller, take: this.selected, hit: this.selected, sync: this.sync, interactable: null };
        AttachedObject.Events.WillFree?.forEach(x => x(this, args));

        Avatar_POI.Remove(this.controller!.context, this.selected);
        AttachedObject.Remove(this);

        if (this.sync) {
            this.sync.fastMode = false;
        }

        const mesh = this.selectedMesh;
        if (mesh && this.originalMaterial && mesh.material) {
            mesh.material = this.originalMaterial;
        }

        const object = this.selected;
        // only attach the object back if it has a parent
        // no parent means it was destroyed while holding it!
        if (this.didReparent && object.parent) {
            const prevParent = this.selectedParent;
            if (prevParent) prevParent.attach(object);
            else this.controller?.context.scene.attach(object);
        }

        this.usageMarker?.destroy();

        if (this.controller)
            this.controller.grabbed = null;
        this.selected = null;
        this.selectedParent = null;
        this.selectedMesh = null;
        this.sync = null;


        // TODO: make throwing work again
        if (this.rigidbodies) {
            for (const rb of this.rigidbodies) {
                rb.wakeUp();
                rb.setVelocity(rb.smoothedVelocity);
            }
        }
        this.rigidbodies = null;

        this.localPositionOffsetToGrab = null;
        this.quaternionLerp = null;

        AttachedObject.Events.DidFree?.forEach(x => x(this, args));
    }

    public grabPoint: Vector3 = new Vector3();

    private localPositionOffsetToGrab: Vector3 | null = null;
    private localPositionOffsetToGrab_worldSpace: Vector3 = new Vector3();
    private localQuaternionToGrab: Quaternion = new Quaternion(0, 0, 0, 1);
    private targetDir: Vector3 | null = null;
    private quaternionLerp: Quaternion | null = null;

    private controllerDir = new Vector3();
    private controllerWorldPos = new Vector3();
    private lastControllerWorldPos = new Vector3();
    private controllerPosDelta = new Vector3();
    private totalChangeAlongDirection = 0.0;
    private rigPositionLastFrame = new Vector3();

    private controllerMovementSinceLastFrame() {
        if (!this.positionSource || !this.controller) return 0.0;

        // controller direction
        this.controllerDir.set(0, 0, -1);
        this.controllerDir.applyQuaternion(this.controller.rayRotation);

        // controller delta
        getWorldPosition(this.positionSource, this.controllerWorldPos);
        this.controllerPosDelta.copy(this.controllerWorldPos);
        this.controllerPosDelta.sub(this.lastControllerWorldPos);
        this.lastControllerWorldPos.copy(this.controllerWorldPos);
        const rig = this.controller.webXR.Rig;
        if (rig) {
            const rigPos = getWorldPosition(rig);
            const rigDelta = this.rigPositionLastFrame.sub(rigPos);
            this.controllerPosDelta.add(rigDelta);
            this.rigPositionLastFrame.copy(rigPos);
        }

        // calculate delta along direction
        const changeAlongControllerDirection = this.controllerDir.dot(this.controllerPosDelta);

        return changeAlongControllerDirection;
    }

    public update() {
        if (this.rigidbodies)
            for (const rb of this.rigidbodies)
                rb.resetVelocities();
        // TODO: add/use sync lost ownership event
        if (this.sync && this.controller && this.controller.context.connection.isInRoom) {
            const td = this.controller.context.time.time - this.grabTime;
            // if (time.frameCount % 60 === 0) {
            //     console.log("ownership?", this.selected.name, this.sync.hasOwnership(), td)
            // }
            if (td > 3) {
                // if (time.frameCount % 60 === 0) {
                //     console.log(this.sync.hasOwnership())
                // }
                if (this.sync.hasOwnership() === false) {
                    console.log("no ownership, will leave", this.sync.guid);
                    this.free();
                }
            }
        }
        if (this.interactable && !this.interactable.canGrab) return;

        if (!this.didReparent && this.selected && this.controller) {

            const rigScale = this.controller.webXR.Rig?.scale.x ?? 1.0;

            this.totalChangeAlongDirection += this.controllerMovementSinceLastFrame();
            // console.log(this.totalChangeAlongDirection);

            // alert("yo: " + this.controller.webXR.Rig?.scale.x); // this is 0.1 on Hololens
            let currentDist = 1.0;
            if (this.controller.type === ControllerType.PhysicalDevice) // only for controllers and not on touch (AR touches are controllers)
            {
                currentDist = Math.max(0.0, 1 + this.totalChangeAlongDirection * 2.0 / rigScale);
                currentDist = currentDist * currentDist * currentDist;
            }
            if (this.grabDistance / rigScale < 0.8) currentDist = 1.0; // don't accelerate if this is a close grab, want full control

            if (!this.targetDir) {
                this.targetDir = new Vector3();
            }
            this.targetDir.set(0, 0, -this.grabDistance * currentDist);
            const target = this.targetDir.applyQuaternion(this.controller.rayRotation).add(this.controllerWorldPos);

            // apply rotation
            const targetQuat = this.controller.rayRotation.clone().multiplyQuaternions(this.controller.rayRotation, this.localQuaternionToGrab);
            if (!this.quaternionLerp) {
                this.quaternionLerp = targetQuat.clone();
            }
            this.quaternionLerp.slerp(targetQuat, this.controller.useSmoothing ? this.controller.context.time.deltaTime / .03 : 1.0);
            setWorldQuaternion(this.selected, this.quaternionLerp);
            this.selected.updateWorldMatrix(false, false); // necessary so that rotation is correct for the following position update

            // apply position
            this.grabPoint.copy(target);
            // apply local grab offset
            if (this.localPositionOffsetToGrab) {
                this.localPositionOffsetToGrab_worldSpace.copy(this.localPositionOffsetToGrab);
                this.selected.localToWorld(this.localPositionOffsetToGrab_worldSpace).sub(getWorldPosition(this.selected));
                target.sub(this.localPositionOffsetToGrab_worldSpace);
            }
            setWorldPosition(this.selected, target);
        }


        if (this.rigidbodies != null) {
            for (const rb of this.rigidbodies) {
                rb.wakeUp();
            }
        }

        InstancingUtil.markDirty(this.selected, true);
    }
}
