import { Behaviour, GameObject } from "./Component";
import { getParam } from "../engine/engine_utils";
import { serializable } from "../engine/engine_serialization_decorator";
import { RGBAColor } from "./js-extensions/RGBAColor";
import { XRSessionMode } from "../engine/engine_setup";
import { ICamera } from "../engine/engine_types"
import { showBalloonMessage } from "../engine/debug/debug";
import { getWorldPosition } from "../engine/engine_three_utils";
import { Gizmos } from "../engine/engine_gizmos";

import { EquirectangularReflectionMapping, OrthographicCamera, PerspectiveCamera, Ray, sRGBEncoding, Vector3 } from "three";
import { OrbitControls } from "./OrbitControls";

export enum ClearFlags {
    Skybox = 1,
    SolidColor = 2,
    Uninitialized = 4,
}

const debug = getParam("debugcam");
const debugscreenpointtoray = getParam("debugscreenpointtoray");

export class Camera extends Behaviour implements ICamera {

    get isCamera() {
        return true;
    }

    get aspect(): number {
        if (this._cam instanceof PerspectiveCamera) return this._cam.aspect;
        return (this.context.domWidth / this.context.domHeight);
    }

    get fieldOfView(): number | undefined {
        if (this._cam instanceof PerspectiveCamera) {
            return this._cam.fov;
        }
        return this._fov;
    }
    @serializable()
    set fieldOfView(val: number | undefined) {
        const changed = this._fov != val;
        this._fov = val;
        if (changed && this._cam) {
            if (this._cam instanceof PerspectiveCamera) {
                if (this._fov === undefined) {
                    console.error("Can not set undefined fov on PerspectiveCamera");
                    return;
                }
                this._cam.fov = this._fov;
                this._cam.updateProjectionMatrix();
            }
        }
    }

    get nearClipPlane(): number { return this._nearClipPlane; }
    @serializable()
    set nearClipPlane(val) {
        const changed = this._nearClipPlane != val;
        this._nearClipPlane = val;
        if (this._cam && changed) {
            this._cam.near = val;
            this._cam.updateProjectionMatrix();
        }
    }
    private _nearClipPlane: number = 0.1;

    get farClipPlane(): number { return this._farClipPlane; }
    @serializable()
    set farClipPlane(val) {
        const changed = this._farClipPlane != val;
        this._farClipPlane = val;
        if (this._cam && changed) {
            this._cam.far = val;
            this._cam.updateProjectionMatrix();
        }
    }
    private _farClipPlane: number = 1000;

    @serializable()
    public get clearFlags(): ClearFlags {
        return this._clearFlags;
    }
    public set clearFlags(val: ClearFlags) {
        if (val === this._clearFlags) return;
        this._clearFlags = val;
        this.applyClearFlagsIfIsActiveCamera();
    }
    @serializable()
    public orthographic: boolean = false;
    @serializable()
    public orthographicSize: number = 5;

    @serializable()
    public ARBackgroundAlpha: number = 0;

    @serializable()
    public set cullingMask(val: number) {
        this._cullingMask = val;
        if (this._cam) {
            this._cam.layers.mask = val;
        }
    }
    public get cullingMask(): number {
        if (this._cam) return this._cam.layers.mask;
        return this._cullingMask;
    }
    private _cullingMask: number = 0xffffffff;

    @serializable()
    public set backgroundBlurriness(val: number | undefined) {
        if (val === this._backgroundBlurriness) return;
        if (val === undefined)
            this._backgroundBlurriness = undefined;
        else
            this._backgroundBlurriness = Math.min(Math.max(val, 0), 1);
        this.applyClearFlagsIfIsActiveCamera();
    }
    public get backgroundBlurriness(): number | undefined {
        return this._backgroundBlurriness;
    }
    private _backgroundBlurriness?: number;

    @serializable()
    public set backgroundIntensity(val: number | undefined) {
        if (val === this._backgroundIntensity) return;
        if (val === undefined)
            this._backgroundIntensity = undefined;
        else
            this._backgroundIntensity = Math.min(Math.max(val, 0), 10);
        this.applyClearFlagsIfIsActiveCamera();
    }
    public get backgroundIntensity(): number | undefined {
        return this._backgroundIntensity;
    }
    private _backgroundIntensity?: number;

    @serializable(RGBAColor)
    public get backgroundColor(): RGBAColor | null {
        return this._backgroundColor ?? null;
    }
    public set backgroundColor(val: RGBAColor | null) {
        if (!val) return;
        if (!this._backgroundColor) {
            if (!val.clone) return;
            this._backgroundColor = val.clone();
        }
        else this._backgroundColor.copy(val);
        // set background color to solid if provided color doesnt have any alpha channel
        if (val.alpha === undefined) this._backgroundColor.alpha = 1;
        this.applyClearFlagsIfIsActiveCamera();
    }

    private _backgroundColor?: RGBAColor;
    private _fov?: number;
    private _cam: THREE.PerspectiveCamera | THREE.OrthographicCamera | null = null;
    private _clearFlags: ClearFlags = ClearFlags.SolidColor;
    private _skybox?: CameraSkybox;

    public get cam(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
        if (this.activeAndEnabled)
            this.buildCamera();
        return this._cam!;
    }

    private static _origin: THREE.Vector3 = new Vector3();
    private static _direction: THREE.Vector3 = new Vector3();
    public screenPointToRay(x: number, y: number, ray?: Ray): Ray {
        let cam = this.cam;
        const origin = Camera._origin;
        origin.set(x, y, -1);
        this.context.input.convertScreenspaceToRaycastSpace(origin);
        if (debugscreenpointtoray) console.log("screenPointToRay", x.toFixed(2), y.toFixed(2), "now:", origin.x.toFixed(2), origin.y.toFixed(2), "isInXR:" + this.context.isInXR);
        origin.z = -1;
        origin.unproject(cam);
        const dir = Camera._direction.set(origin.x, origin.y, origin.z);
        const camPosition = getWorldPosition(cam);
        dir.sub(camPosition);
        dir.normalize();
        if (ray) {
            ray.set(camPosition, dir);
            return ray;
        }
        else {
            return new Ray(camPosition.clone(), dir.clone());
        }
    }

    awake() {
        if (!this.sourceId) {
            console.warn("Camera has no source - the camera should be exported inside a gltf", this.name);
        }

        if (debugscreenpointtoray) {
            window.addEventListener("pointerdown", evt => {
                const px = evt.clientX;
                const py = evt.clientY;
                console.log("touch", px.toFixed(2), py.toFixed(2))
                const ray = this.screenPointToRay(px, py);
                const randomHex = "#" + Math.floor(Math.random() * 16777215).toString(16);
                Gizmos.DrawRay(ray.origin, ray.direction, randomHex, 10);
            });
        }
    }

    onEnable(): void {
        if (debug) console.log(this);
        this.buildCamera();
        if (this.tag == "MainCamera" || !this.context.mainCameraComponent) {
            this.context.setCurrentCamera(this);
            handleFreeCam(this);
        }
        this.applyClearFlagsIfIsActiveCamera();
    }

    onDisable() {
        this.context.removeCamera(this);
    }

    buildCamera() {
        if (this._cam) return;

        const cameraAlreadyCreated = this.gameObject["isCamera"];

        // TODO: when exporting from blender we already have a camera in the children
        let cam: THREE.PerspectiveCamera | THREE.OrthographicCamera | null = null;
        if (cameraAlreadyCreated) {
            cam = this.gameObject as any;
            cam?.layers.enableAll();
            if (cam instanceof PerspectiveCamera)
                this._fov = cam.fov;
        }
        else
            cam = this.gameObject.children[0] as THREE.PerspectiveCamera | THREE.OrthographicCamera | null;
        if (cam && cam.isCamera) {
            if (cam.type === "PerspectiveCamera") {
                if (this._fov)
                    cam.fov = this._fov;
                cam.near = this._nearClipPlane;
                cam.far = this._farClipPlane;
                cam.updateProjectionMatrix();
            }
        }
        else if (!this.orthographic) {
            cam = new PerspectiveCamera(this.fieldOfView, window.innerWidth / window.innerHeight, this._nearClipPlane, this._farClipPlane);
            if (this.fieldOfView)
                cam.fov = this.fieldOfView;
            this.gameObject.add(cam);
        }
        else {
            const factor = this.orthographicSize * 100;
            cam = new OrthographicCamera(window.innerWidth / -factor, window.innerWidth / factor, window.innerHeight / factor, window.innerHeight / -factor, this._nearClipPlane, this._farClipPlane);
            this.gameObject.add(cam);
        }
        this._cam = cam;

        this._cam.layers.mask = this._cullingMask;

        if (this.tag == "MainCamera") {
            this.context.setCurrentCamera(this);
        }
    }

    applyClearFlagsIfIsActiveCamera() {
        if (debug)
            showBalloonMessage("apply Camera clear flags");
        if (this._cam && this.context.mainCameraComponent === this) {
            switch (this._clearFlags) {
                case ClearFlags.Skybox:
                    if (this.environmentIsTransparent()) {
                        if (!this.ARBackgroundAlpha || this.ARBackgroundAlpha < 0.001) {
                            this.context.scene.background = null;
                            this.context.renderer.setClearColor(0x000000, 0);
                            return;
                        }
                    }
                    this.enableSkybox();

                    if (this._backgroundBlurriness !== undefined)
                        this.context.scene.backgroundBlurriness = this._backgroundBlurriness;
                    if (this._backgroundIntensity !== undefined)
                        //@ts-ignore
                        this.context.scene.backgroundIntensity = this._backgroundIntensity;

                    break;
                case ClearFlags.SolidColor:
                    if (this._backgroundColor) {
                        let alpha = this._backgroundColor.alpha;
                        // when in WebXR use ar background alpha override or set to 0
                        if (this.environmentIsTransparent()) {
                            alpha = this.ARBackgroundAlpha ?? 0;
                        }
                        this.context.scene.background = null;
                        this.context.renderer.setClearColor(this._backgroundColor, alpha);
                    }
                    break;
                case ClearFlags.Uninitialized:
                    this.context.scene.background = null
                    this.context.renderer.setClearColor(0x000000, 0);
                    break;
            }
        }
    }

    private environmentIsTransparent(): boolean {
        const session = this.context.renderer.xr?.getSession();
        if (!session) return false;
        const environmentBlendMode = session.environmentBlendMode;
        if (debug)
            showBalloonMessage("Environment blend mode: " + environmentBlendMode + " on " + navigator.userAgent);
        const transparent = environmentBlendMode === 'additive' || environmentBlendMode === 'alpha-blend';

        if (this.context.xrSessionMode === XRSessionMode.ImmersiveAR) {
            if (environmentBlendMode === "opaque") {
                // workaround for Quest 2 returning opaque when it should be alpha-blend
                // check user agent if this is the Quest browser and return true if so
                if (navigator.userAgent?.includes("OculusBrowser")) {
                    return true;
                }
                // Mozilla WebXR Viewer
                else if (navigator.userAgent?.includes("Mozilla") && navigator.userAgent?.includes("Mobile WebXRViewer/v2")) {
                    return true;
                }
            }
        }
        return transparent;
    }

    private enableSkybox() {
        if (!this._skybox)
            this._skybox = new CameraSkybox(this);
        this._skybox.enable();
    }
}


class CameraSkybox {

    private _camera: Camera;
    private _skybox?: THREE.Texture;

    get context() { return this._camera?.context; }

    constructor(camera: Camera) {
        this._camera = camera;
    }

    enable() {
        this._skybox = this.context.lightmaps.tryGetSkybox(this._camera.sourceId) as THREE.Texture;
        if (!this._skybox) {
            console.warn("Failed to load/find skybox texture", this);
        }
        else if (this.context.scene.background !== this._skybox) {
            if (debug)
                console.log("Set skybox", this._camera, this._skybox);
            this._skybox.encoding = sRGBEncoding;
            this._skybox.mapping = EquirectangularReflectionMapping;
            this.context.scene.background = this._skybox;
        }
    }
}


function handleFreeCam(cam: Camera) {
    const isFreecam = getParam("freecam");
    if (isFreecam) {
        if (cam.context.mainCameraComponent === cam) {
            GameObject.getOrAddComponent(cam.gameObject, OrbitControls);
        }

    }
}