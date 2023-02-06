import { Behaviour, GameObject } from "./Component";
import { Camera } from "./Camera";
import { LookAtConstraint } from "./LookAtConstraint";
import { getWorldPosition, slerp } from "../engine/engine_three_utils";
import { RaycastOptions } from "../engine/engine_physics";
import { serializable } from "../engine/engine_serialization_decorator";
import { getParam, isMobileDevice } from "../engine/engine_utils";

import { Box3, Object3D, PerspectiveCamera, Vector2, Vector3 } from "three";
import { OrbitControls as ThreeOrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { EventSystem, EventSystemEvents } from "./ui/EventSystem";
import { transformWithEsbuild } from "vite";

const freeCam = getParam("freecam");

const disabledKeys = { LEFT: "", UP: "", RIGHT: "", BOTTOM: "" };
let defaultKeys: any = undefined;

export class OrbitControls extends Behaviour {
    public get controls() {
        return this._controls;
    }

    public get controllerObject(): Object3D | null {
        return this._cameraObject;
    }

    public onStartInteraction(func: Function) {
        this.controls?.addEventListener("start", func as any);
    }

    autoRotate: boolean = false;
    autoRotateSpeed: number = 1.0;
    enableKeys: boolean = true;
    enableDamping: boolean = true;
    dampingFactor: number = 0.1;
    enableZoom: boolean = true;
    minZoom: number = 0;
    maxZoom: number = Infinity;
    enablePan: boolean = true;
    @serializable(LookAtConstraint)
    lookAtConstraint: LookAtConstraint | null = null;
    lookAtConstraint01: number = 1;
    middleClickToFocus: boolean = true;
    doubleClickToFocus: boolean = true;

    // remove once slerp works correctly
    useSlerp: boolean = true;

    debugLog: boolean = false;
    targetLerpSpeed = 5;

    private _lookTargetPosition!: Vector3;
    private _controls: ThreeOrbitControls | null = null;
    private _cameraObject: Object3D | null = null;

    private _lerpToTargetPosition: boolean = false;
    private _lerpCameraToTarget: boolean = false;
    private _cameraTargetPosition: Vector3 | null = null;

    private _inputs: number = 0;
    private _enableTime: number = 0; // use to disable double click when double clicking on UI
    private _startedListeningToKeyEvents: boolean = false;

    private _eventSystem?: EventSystem;
    private _afterHandleInputFn?: any;

    targetElement: HTMLElement | null = null;

    awake(): void {
        this._lookTargetPosition = new Vector3();
        this._startedListeningToKeyEvents = false;
    }

    start() {
        if (this._controls) {
            const camGo = GameObject.getComponent(this.gameObject, Camera);
            if (camGo && !this.setFromTargetPosition()) {
                if (this.debugLog)
                    console.log("NO TARGET");
                const forward = new Vector3(0, 0, -1).applyMatrix4(camGo.cam.matrixWorld);
                this.setTarget(forward, true);
            }
        }
        this.startCoroutine(this.startRaycastDelayed());

        this._eventSystem = EventSystem.get(this.context) ?? undefined;
        if (this._eventSystem) {
            this._afterHandleInputFn = this.afterHandleInput.bind(this);
            this._eventSystem.addEventListener(EventSystemEvents.AfterHandleInput, this._afterHandleInputFn!);
        }
    }

    onDestroy() {
        this._controls?.dispose();
        this._eventSystem?.removeEventListener(EventSystemEvents.AfterHandleInput, this._afterHandleInputFn!);
    }

    onEnable() {
        this._enableTime = this.context.time.time;
        const camGo = GameObject.getComponent(this.gameObject, Camera);
        const cam = camGo?.cam;
        if (!this._controls) {
            console.assert(cam !== null && cam !== undefined, "Missing camera", this);
            if (cam)
                this._cameraObject = cam;
            // Using the parent if possible to make it possible to disable input on the canvas
            // for having HTML content behind it and still receive input
            const element = this.targetElement ?? this.context.domElement;
            this._controls = new ThreeOrbitControls(cam!, element);
            if (defaultKeys === undefined) defaultKeys = { ...this._controls.keys };
        }

        if (this._controls) {
            if (freeCam) {
                this.enablePan = true;
                this.enableZoom = true;
                this.middleClickToFocus = true;
                if (isMobileDevice()) this.doubleClickToFocus = true;
            }

            this._controls.enableDamping = this.enableDamping;
            this._controls.keys = this.enableKeys ? defaultKeys : disabledKeys;
            this._controls.autoRotate = this.autoRotate;
            this._controls.autoRotateSpeed = this.autoRotateSpeed;
            this._controls.enableZoom = this.enableZoom;
            if (cam?.type === "PerspectiveCamera") {
                if (freeCam) {
                    // dont set limits
                }
                else {
                    this._controls.minDistance = this.minZoom;
                    this._controls.maxDistance = this.maxZoom;
                }
            }
            else {
                if (freeCam) {
                    // dont set limits
                }
                else {
                    this._controls.minZoom = this.minZoom;
                    this._controls.maxZoom = this.maxZoom;
                }
            }
            this._controls.dampingFactor = this.dampingFactor;
            this._controls.enablePan = this.enablePan;
            if (!this._startedListeningToKeyEvents) {
                this._startedListeningToKeyEvents = true;
                this._controls.listenToKeyEvents(window.document.body);
            }
        }

    }

    onDisable() {
        if (this._controls) {
            this._controls.enabled = false;
            this._controls.autoRotate = false;
            // this._controls.reset();
        }
    }

    private _shouldDisable : boolean = false;
    private afterHandleInput() {
        if (this._controls && this._eventSystem) {
            this._shouldDisable = this._eventSystem.hasActiveUI;
        }
    }

    // we need to wait one frame (when starting the scene for the very first time)
    private * startRaycastDelayed() {
        yield;
        if (!this.setFromTargetPosition()) {
            const opts = new RaycastOptions();
            // center of the screen:
            opts.screenPoint = new Vector2(0, 0);
            opts.lineThreshold = 0.1;
            const hits = this.context.physics.raycast(opts);
            if (hits.length > 0) {
                this.setTarget(hits[0].point, true);
            }
        }
    }

    onBeforeRender() {
        if (!this._controls) return;

        if (this.context.input.getPointerDown(0) || this.context.input.getPointerDown(1) || this.context.input.getPointerDown(2)) {
            this._inputs += 1;
        }
        if (this._inputs > 0) {
            this.autoRotate = false;
            this._controls.autoRotate = false;
            this._lerpCameraToTarget = false;
            this._lerpToTargetPosition = false;
        }
        this._inputs = 0;

        // if (this.context.input.getPointerLongPress(0) && this.context.time.frameCount % 20 === 0) console.log("LP", this.context.alias);

        let focusAtPointer = (this.middleClickToFocus && this.context.input.getPointerClicked(1));
        focusAtPointer ||= (this.doubleClickToFocus && this.context.input.getPointerDoubleClicked(0) && this.context.time.time - this._enableTime > .3);
        if (focusAtPointer) {
            this.setTargetFromRaycast();
        }
        else if (this.context.input.getPointerDown(0) || this.context.input.mouseWheelChanged) {
            this._lerpToTargetPosition = false;
            this._lerpCameraToTarget = false;
        }

        if (this._lerpToTargetPosition || this._lerpCameraToTarget) {
            const step = this.context.time.deltaTime * this.targetLerpSpeed;

            // confusing naming ahead:
            // _targetObject: the target where the camera moves to
            // targetPosition: the target where the look target moves to

            // lerp the camera
            if (this._lerpCameraToTarget && this._cameraTargetPosition && this._cameraObject) {
                // setWorldPosition(this._cameraObject, this._cameraTargetPosition);
                if (this.useSlerp) {
                    const position = this._cameraObject?.position;
                    slerp(position, this._cameraTargetPosition, step);
                }
                else {
                    this._cameraObject?.position.lerp(this._cameraTargetPosition, step);
                }
                if (this._cameraObject.position.distanceTo(this._cameraTargetPosition) < .0001) {
                    this._lerpCameraToTarget = false;
                }
            }

            // lerp the look target
            if (this._lerpToTargetPosition) {

                this.lerpTarget(this._lookTargetPosition, step);
                if (this._lookTargetPosition.distanceTo(this._controls.target) < .00001) {
                    this._lerpToTargetPosition = false;
                }
            }
        }

        if (!freeCam && this.lookAtConstraint?.locked) this.setFromTargetPosition(0, this.lookAtConstraint01);


        if (this._controls && !this.context.isInXR) {
            if (this.debugLog)
                this._controls.domElement = this.context.renderer.domElement;
            this._controls.enabled = !this._shouldDisable;
            this._controls.update();
        }
    }

    public setCameraTarget(position?: Vector3 | null, immediate: boolean = false) {
        if (!position) this._lerpCameraToTarget = false;
        else {
            this._lerpCameraToTarget = true;
            this._cameraTargetPosition = position.clone();
            if (immediate && this._cameraTargetPosition) {
                this.controllerObject?.position.copy(this._cameraTargetPosition);
            }
        }
    }

    public setFromTargetPosition(index: number = 0, t: number = 1): boolean {
        if (!this._controls) return false;
        const sources = this.lookAtConstraint?.sources;
        if (sources && sources.length > 0) {
            const target = sources[index];
            if (target) {
                target.getWorldPosition(this._lookTargetPosition);
                this.lerpTarget(this._lookTargetPosition, t);
                return true;
            }
        }
        return false;
    }

    public setTarget(position: Vector3 | null = null, immediate: boolean = false) {
        if (!this._controls) return;
        if (position !== null) this._lookTargetPosition.copy(position);
        if (immediate)
            this._controls.target.copy(this._lookTargetPosition);
        else this._lerpToTargetPosition = true;
    }

    public lerpTarget(position: Vector3, delta: number) {
        if (!this._controls) return;
        this._controls.target.lerp(position, delta);
    }

    public distanceToTarget(position: Vector3): number {
        if (!this._controls) return -1;
        return this._controls.target.distanceTo(position);
    }

    private setTargetFromRaycast() {
        if (!this.controls) return;
        const rc = this.context.physics.raycast();
        for (const hit of rc) {
            if (hit.distance > 0 && GameObject.isActiveInHierarchy(hit.object)) {
                // if (hit.object && hit.object.parent) {
                //     const par: any = hit.object.parent;
                //     if (par.isUI) continue;
                // }
                // console.log("Set target", this.targetPosition, hit.object.name, hit.object);
                this._lookTargetPosition.copy(hit.point);
                this._lerpToTargetPosition = true;
                this._cameraTargetPosition = null;
                if (this.context.mainCamera) {
                    this._lerpCameraToTarget = true;
                    const pos = getWorldPosition(this.context.mainCamera);
                    this._cameraTargetPosition = pos.clone().sub(this.controls.target).add(this._lookTargetPosition);
                    this._cameraObject?.parent?.worldToLocal(this._cameraTargetPosition);
                }
                break;
            }
        }
    }

    // Adapted from https://discourse.threejs.org/t/camera-zoom-to-fit-object/936/24
    // Slower but better implementation that takes bones and exact vertex positions into account: https://github.com/google/model-viewer/blob/04e900c5027de8c5306fe1fe9627707f42811b05/packages/model-viewer/src/three-components/ModelScene.ts#L321
    fitCameraToObjects(objects: Array<Object3D>, fitOffset: number = 1.5) {
        const camera = this._cameraObject as PerspectiveCamera;
        const controls = this._controls as ThreeOrbitControls | null;

        if (!camera || !controls) return;

        const size = new Vector3();
        const center = new Vector3();
        const box = new Box3();

        box.makeEmpty();
        for (const object of objects)
            box.expandByObject(object);

        box.getSize(size);
        box.getCenter(center);

        const maxSize = Math.max(size.x, size.y, size.z);
        const fitHeightDistance = maxSize / (2 * Math.atan(Math.PI * camera.fov / 360));
        const fitWidthDistance = fitHeightDistance / camera.aspect;
        const distance = fitOffset * Math.max(fitHeightDistance, fitWidthDistance);

        const direction = controls.target.clone()
            .sub(camera.position)
            .normalize()
            .multiplyScalar(distance);

        controls.maxDistance = distance * 10;
        controls.minDistance = distance * 0.01;
        controls.target.copy(center);

        camera.near = distance / 100;
        camera.far = distance * 100;
        camera.updateProjectionMatrix();

        camera.position.copy(controls.target).sub(direction);

        controls.update();
    }

    // private onPositionDrag(){

    // }
}
