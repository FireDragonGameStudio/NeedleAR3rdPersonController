import { ArrayCamera, Color, Euler, EventDispatcher, Group, Matrix4, Mesh, MeshBasicMaterial, Object3D, Quaternion, RingGeometry, Texture, Vector3 } from 'three';
import { ARButton } from '../include/three/ARButton.js';
import { VRButton } from '../include/three/VRButton.js';

import { AssetReference } from "../engine/engine_addressables";
import { serializable } from "../engine/engine_serialization_decorator";
import { XRSessionMode } from "../engine/engine_setup";
import { getWorldPosition, getWorldQuaternion, setWorldPosition, setWorldQuaternion } from "../engine/engine_three_utils";
import { INeedleEngineComponent } from "../engine/engine_types";
import { getParam, isMozillaXR, setOrAddParamsToUrl } from "../engine/engine_utils";

import { Behaviour, GameObject } from "./Component";
import { noVoip } from "./Voip";
import { WebARSessionRoot } from "./WebARSessionRoot";
import { ControllerType, WebXRController } from "./WebXRController";
import { XRRig } from "./WebXRRig";
import { WebXRSync } from "./WebXRSync";
import { XRFlag, XRState, XRStateFlag } from "./XRFlag";
import { showBalloonWarning } from '../engine/debug';


export async function detectARSupport() {
    if(isMozillaXR()) return true;
    if ("xr" in navigator) {
        //@ts-ignore
        return (await navigator["xr"].isSessionSupported('immersive-ar')) === true;
    }
    return false;
}
export async function detectVRSupport() {
    if ("xr" in navigator) {
        //@ts-ignore
        return (await navigator["xr"].isSessionSupported('immersive-vr')) === true;
    }
    return false;
}

let arSupported = false;
let vrSupported = false;
detectARSupport().then(res => arSupported = res);
detectVRSupport().then(res => vrSupported = res);

// import TeleportVR from "teleportvr";

export enum WebXREvent {
    XRStarted = "xrStarted",
    XRStopped = "xrStopped",
    XRUpdate = "xrUpdate",
    RequestVRSession = "requestVRSession",
}

export declare type CreateButtonOptions = {
    registerClick: boolean
};

export class WebXR extends Behaviour {

    @serializable()
    enableVR = true;
    @serializable()
    enableAR = true;

    @serializable(AssetReference)
    defaultAvatar?: AssetReference;
    @serializable()
    handModelPath: string = "";

    @serializable()
    createVRButton: boolean = true;
    @serializable()
    createARButton: boolean = true;

    private static _isInXr: boolean = false;
    private static events: EventDispatcher = new EventDispatcher();

    public static get IsInWebXR(): boolean { return this._isInXr; }
    public static get XRSupported(): boolean { return 'xr' in navigator && (arSupported || vrSupported); }
    public static get IsARSupported(): boolean { return arSupported; }
    public static get IsVRSupported(): boolean { return vrSupported; }

    public static addEventListener(type: string, listener: any): any {
        this.events.addEventListener(type, listener);
        return listener;
    }
    public static removeEventListener(type: string, listener: any): any {
        this.events.removeEventListener(type, listener);
        return listener;
    }

    public static createVRButton(webXR: WebXR, opts?: CreateButtonOptions): HTMLButtonElement | HTMLAnchorElement {
        if (!WebXR.XRSupported) {
            console.warn("WebXR is not supported on this device");
        }
        else
            webXR.__internalAwake();
        const vrButton = VRButton.createButton(webXR.context.renderer);
        vrButton.classList.add('webxr-ar-button');
        vrButton.classList.add('webxr-button');
        this.resetButtonStyles(vrButton);
        // if (this.enableAR) vrButton.style.marginLeft = "60px";
        if (opts?.registerClick ?? true)
            vrButton.addEventListener('click', webXR.onClickedVRButton.bind(webXR));
        return vrButton;
    }

    public static createARButton(webXR: WebXR, opts?: CreateButtonOptions): HTMLButtonElement | HTMLAnchorElement {
        webXR.__internalAwake();
        const domOverlayRoot = webXR.webAR?.getAROverlayContainer();
        const features: any = {};
        if (domOverlayRoot) {
            features.domOverlay = { root: domOverlayRoot };
            features.optionalFeatures = ['hit-test', 'dom-overlay'];
        }
        else {
            console.warn("No dom overlay root found, HTML overlays on top of screen-based AR will not work.");
        }
        features.optionalFeatures.push('plane-detection');
        // features.optionalFeatures.push('light-estimation');
        features.optionalFeatures.push('anchors');

        const arButton = ARButton.createButton(webXR.context.renderer, features);
        arButton.classList.add('webxr-ar-button');
        arButton.classList.add('webxr-button');
        WebXR.resetButtonStyles(arButton);
        if (opts?.registerClick ?? true)
            arButton.addEventListener('click', webXR.onClickedARButton.bind(webXR));
        return arButton;
    }

    public static resetButtonStyles(button) {
        if (!button) return;
        button.style.position = "";
        button.style.bottom = "";
        button.style.left = "";
    }

    public endSession() {
        const session = this.context.renderer.xr.getSession();
        if (session) session.end();
    }

    public get Rig(): Object3D {
        if (!this.rig) this.ensureRig();
        return this.rig;
    }


    private controllers: WebXRController[] = [];
    public get Controllers(): WebXRController[] {
        return this.controllers;
    }

    public get LeftController(): WebXRController | null {
        if (this.controllers.length > 0 && this.controllers[0].input?.handedness === "left") return this.controllers[0];
        if (this.controllers.length > 1 && this.controllers[1].input?.handedness === "left") return this.controllers[1];
        return null;
    }

    public get RightController(): WebXRController | null {
        if (this.controllers.length > 0 && this.controllers[0].input?.handedness === "right") return this.controllers[0];
        if (this.controllers.length > 1 && this.controllers[1].input?.handedness === "right") return this.controllers[1];
        return null;
    }

    public get ARButton(): HTMLButtonElement | undefined {
        return this._arButton;
    }

    public get VRButton(): HTMLButtonElement | undefined {
        return this._vrButton;
    }

    public get IsInVR() { return this._isInVR; }
    public get IsInAR() { return this._isInAR; }

    private rig!: Object3D;
    private isInit: boolean = false;

    private _requestedAR: boolean = false;
    private _requestedVR: boolean = false;
    private _isInAR: boolean = false;
    private _isInVR: boolean = false;

    private _arButton?: HTMLButtonElement;
    private _vrButton?: HTMLButtonElement;

    private webAR: WebAR | null = null;

    awake(): void {
        // as the webxr component is most of the times currently loaded as part of the scene 
        // and not part of the glTF directly and thus does not go through the whole serialization process currently
        // we need to to manuall make sure it is of the correct type here
        if (this.defaultAvatar) {
            if (typeof (this.defaultAvatar) === "string") {
                this.defaultAvatar = AssetReference.getOrCreate(this.sourceId ?? "/", this.defaultAvatar, this.context);
            }
        }
        if (!GameObject.findObjectOfType(WebXRSync, this.context)) {
            const sync = GameObject.addNewComponent(this.gameObject, WebXRSync, false) as WebXRSync;
            sync.webXR = this;
        }
        this.webAR = new WebAR(this);
    }

    start() {
        if (location.protocol == 'http:' && location.host.indexOf('localhost') < 0) {
            showBalloonWarning("WebXR only works on https");
            console.warn("WebXR only works on https. https://engine.needle.tools/docs/xr.html");
        }
    }

    onEnable() {
        if (this.isInit) return;
        if (!this.enableAR && !this.enableVR) return;
        this.isInit = true;

        this.context.renderer.xr.enabled = true;

        // general WebXR support?
        const browserSupportsXR = WebXR.XRSupported;


        // TODO: move the whole buttons positioning out of here and make it configureable from css
        // better set proper classes so user code can react to it instead 
        // of this hardcoded stuff
        let arButton, vrButton;
        const buttonsContainer = document.createElement('div');
        buttonsContainer.classList.add("webxr-buttons");
        this.context.domElement.append(buttonsContainer);

        // AR support
        if (this.enableAR && this.createARButton && arSupported) {
            arButton = WebXR.createARButton(this);
            this._arButton = arButton;
            buttonsContainer.appendChild(arButton);
        }

        // VR support
        if (this.createVRButton && this.enableVR && vrSupported) {
            vrButton = WebXR.createVRButton(this);
            this._vrButton = vrButton;
            buttonsContainer.appendChild(vrButton);
        }
        
        setTimeout(() => {
            WebXR.resetButtonStyles(vrButton);
            WebXR.resetButtonStyles(arButton);
        }, 1000);
    }

    private _transformOrientation: Quaternion = new Quaternion();
    public get TransformOrientation(): Quaternion { return this._transformOrientation; }

    private _currentHeadPose: XRViewerPose | null = null;
    public get HeadPose(): XRViewerPose | null { return this._currentHeadPose; }

    onBeforeRender(frame) {
        if (!frame) return;
        // TODO: figure out why screen is black if we enable the code written here
        // const referenceSpace = renderer.xr.getReferenceSpace();
        const session = this.context.renderer.xr.getSession();
        

        if (session) {
            const pose = frame.getViewerPose(this.context.renderer.xr.getReferenceSpace());
            if(!pose) return;
            this._currentHeadPose = pose;
            const transform: XRRigidTransform = pose?.transform;
            if (transform) {
                this._transformOrientation.set(transform.orientation.x, transform.orientation.y, transform.orientation.z, transform.orientation.w);
            }

            if (WebXR._isInXr === false && session) {
                this.onEnterXR(session, frame);
            }

            for (const ctrl of this.controllers) {
                ctrl.onUpdate(session);
            }

            if (this._isInAR) {
                this.webAR?.onUpdate(session, frame);
            }
        }

        WebXR.events.dispatchEvent({ type: WebXREvent.XRUpdate, frame: frame, xr: this.context.renderer.xr, rig: this.rig });
    }

    private onClickedARButton() {
        if (!this._isInAR) {
            this._requestedAR = true;
            this._requestedVR = false;

            // if we do this on enter xr the state has already been changed in AR mode
            // so we need to to this before session has started
            this.captureStateBeforeXR();
        }
    }

    private onClickedVRButton() {
        if (!this._isInVR) {

            // happens e.g. when headset is off and xr session never actually started
            if (this._requestedVR) {
                this.onExitXR(null);
                return;
            }

            this._requestedAR = false;
            this._requestedVR = true;
            this.captureStateBeforeXR();

            // build controllers before session begins - this seems to fix issue with controller models not appearing/not getting connection event
            this.ensureRig();
            for (let i = 0; i < 2; i++) {
                WebXRController.Create(this, i, this.gameObject as GameObject, ControllerType.PhysicalDevice);
            }

            WebXR.events.dispatchEvent({ type: WebXREvent.RequestVRSession });
        }
    }

    private captureStateBeforeXR() {
        if (this.context.mainCamera) {
            this._originalCameraPosition.copy(getWorldPosition(this.context.mainCamera));
            this._originalCameraRotation.copy(getWorldQuaternion(this.context.mainCamera));
            this._originalCameraParent = this.context.mainCamera.parent;
        }
        if(this.Rig){
            this._originalXRRigParent = this.Rig.parent;
            this._originalXRRigPosition.copy(this.Rig.position);
            this._originalXRRigRotation.copy(this.Rig.quaternion);
        }
    }

    private ensureRig() {
        if (!this.rig) {
            // currently just used for pose
            const xrRig = GameObject.findObjectOfType(XRRig, this.context);
            if (xrRig) {
                // make it match unity forward
                this.rig = xrRig.gameObject;
                // this.rig.rotateY(Math.PI);
                // this.rig.position.copy(existing.worldPosition);
                // this.rig.quaternion.premultiply(existing.worldQuaternion);
            }
            else {
                this.rig = new Group();
                this.rig.rotateY(Math.PI);
                this.rig.name = "XRRig";
                this.context.scene.add(this.rig);
            }
        }
    }


    private _originalCameraParent: Object3D | null = null;
    private _originalCameraPosition: Vector3 = new Vector3();
    private _originalCameraRotation: Quaternion = new Quaternion();

    private _originalXRRigParent: Object3D | null = null;
    private _originalXRRigPosition: Vector3 = new Vector3();
    private _originalXRRigRotation: Quaternion = new Quaternion();

    private onEnterXR(session: XRSession, frame: XRFrame) {
        console.log("[XR] session begin", session);
        WebXR._isInXr = true;

        this.ensureRig();

        const space = this.context.renderer.xr.getReferenceSpace();
        if (space && this.rig) {
            const pose = frame.getViewerPose(space);
            const rot = pose?.transform.orientation;
            if (rot) {
                const quat = new Quaternion(rot.x, rot.y, rot.z, rot.w);
                const eu = new Euler().setFromQuaternion(quat);
                this.rig.rotateY(eu.y);
                // this.rig.quaternion.multiply(quat);
            }
        }

        // when we set unity layers objects will only be rendered on one eye
        // we set layers to sync raycasting and have a similar behaviour to unity
        const xr = this.context.renderer.xr;
        if (this.context.mainCamera) {
            //@ts-ignore
            const cam = xr.getCamera(this.context.mainCamera) as ArrayCamera;
            for (const c of cam.cameras) {
                c.layers.enableAll();
            }

            this.rig.add(this.context.mainCamera);
            if (this._requestedAR) {
                this.context.scene.add(this.rig);
            }
        }

        const flag = this._requestedAR ? XRStateFlag.AR : XRStateFlag.VR;

        XRState.Global.Set(flag);

        switch (flag) {
            case XRStateFlag.AR:
                this.context.xrSessionMode = XRSessionMode.ImmersiveAR;
                this._isInAR = true;
                this.webAR?.onBegin(session);
                break;
            case XRStateFlag.VR:
                this.context.xrSessionMode = XRSessionMode.ImmersiveVR;
                this._isInVR = true;
                this.onEnterVR(session);
                break;
        }

        session.addEventListener('end', () => {
            console.log("[XR] session end");
            WebXR._isInXr = false;
            this.onExitXR(session);
        });

        this.onEnterXR_HandleMirrorWindow(session);

        WebXR.events.dispatchEvent({ type: WebXREvent.XRStarted, session: session });
    }

    private onExitXR(session: XRSession | null) {

        const wasInAR = this._isInAR;

        if (this._isInAR && session) {
            this.webAR?.onEnd(session);
        }

        this._isInAR = false;
        this._isInVR = false;
        this._requestedAR = false;
        this._requestedVR = false;
        this.context.xrSessionMode = undefined;

        if (this.xrMirrorWindow) {
            this.xrMirrorWindow.close();
            this.xrMirrorWindow = null;
        }

        this.destroyControllers();

        if (this.context.mainCamera) {
            this._originalCameraParent?.add(this.context.mainCamera);
            setWorldPosition(this.context.mainCamera, this._originalCameraPosition);
            setWorldQuaternion(this.context.mainCamera, this._originalCameraRotation);
            this.context.mainCamera.scale.set(1, 1, 1);
        }

        if(wasInAR){
            this._originalXRRigParent?.add(this.rig);
            this.rig.position.copy(this._originalXRRigPosition);
            this.rig.quaternion.copy(this._originalXRRigRotation);
        }

        XRState.Global.Set(XRStateFlag.Browser | XRStateFlag.ThirdPerson);
        WebXR.events.dispatchEvent({ type: WebXREvent.XRStopped, session: session });
    }

    private onEnterVR(_session: XRSession) {
    }

    private destroyControllers() {
        for (let i = this.controllers.length - 1; i >= 0; i -= 1) {
            this.controllers[i]?.destroy();
        }
        this.controllers.length = 0;
    }

    private xrMirrorWindow: Window | null = null;

    private onEnterXR_HandleMirrorWindow(session: XRSession) {
        if (!getParam("mirror")) return;
        setTimeout(() => {
            if (!WebXR.IsInWebXR) return;
            const url = new URL(window.location.href);
            setOrAddParamsToUrl(url.searchParams, noVoip, 1);
            setOrAddParamsToUrl(url.searchParams, "isMirror", 1);
            const str = url.toString();
            this.xrMirrorWindow = window.open(str, "webxr sync", "popup=yes");
            if (this.xrMirrorWindow) {
                this.xrMirrorWindow.onload = () => {
                    if (this.xrMirrorWindow)
                        this.xrMirrorWindow.onbeforeunload = () => {
                            if (WebXR.IsInWebXR)
                                session.end();
                        };
                }
            }
        }, 1000);
    }
}


// not sure if this should be a behaviour. 
// for now we dont really need it to go through the usual update loop
export class WebAR {

    get webxr(): WebXR { return this._webxr; }

    private _webxr: WebXR;

    private reticle: Object3D | null = null;
    private reticleParent: Object3D | null = null;
    private hitTestSource: XRHitTestSource | null = null;
    private reticleActive: boolean = true;

    // scene.background before entering AR
    private previousBackground: Color | null | Texture = null;
    private previousEnvironment: Texture | null = null;

    private sessionRoot: WebARSessionRoot | null = null;
    private _previousParent: Object3D | null = null;
    // we need this in case the session root is on the same object as the webxr component
    // so if we disable the session root we attach the webxr component to this temporary object
    // to still receive updates
    private static tempWebXRObject: Object3D;

    private get context() { return this.webxr.context; }

    constructor(webxr: WebXR) {
        this._webxr = webxr;
    }

    private arDomOverlay: HTMLElement | null = null;
    private arOverlayElement: INeedleEngineComponent | HTMLElement | null = null;
    private noHitTestAvailable: boolean = false;
    private didPlaceARSessionRoot: boolean = false;

    getAROverlayContainer(): HTMLElement | null {
        this.arDomOverlay = this.webxr.context.domElement as HTMLElement;
        // for react cases we dont have an Engine Element
        const element: any = this.arDomOverlay;
        if (element.getAROverlayContainer)
            this.arOverlayElement = element.getAROverlayContainer();
        else this.arOverlayElement = this.arDomOverlay;
        return this.arOverlayElement;
    }

    setReticleActive(active: boolean) {
        this.reticleActive = active;
    }

    async onBegin(session: XRSession) {
        const context = this.webxr.context;
        this.reticleActive = true;
        this.didPlaceARSessionRoot = false;
        this.getAROverlayContainer();

        const deviceType = navigator.userAgent?.includes("OculusBrowser") ? ControllerType.PhysicalDevice : ControllerType.Touch;
        const controllerCount = deviceType === ControllerType.Touch ? 4 : 2;
        for (let i = 0; i < controllerCount; i++) {
            WebXRController.Create(this.webxr, i, this.webxr.gameObject as GameObject, deviceType)
        }

        if (!this.sessionRoot || this.sessionRoot.destroyed || !this.sessionRoot.activeAndEnabled)
            this.sessionRoot = GameObject.findObjectOfType(WebARSessionRoot, context);

        this.previousBackground = context.scene.background;
        this.previousEnvironment = context.scene.environment;
        context.scene.background = null;

        session.requestReferenceSpace('viewer').then((referenceSpace) => {
            session.requestHitTestSource?.call(session, { space: referenceSpace })?.then((source) => {
                this.hitTestSource = source;
            }).catch((err) => {
                this.noHitTestAvailable = true;
                console.warn("WebXR: Hit test not supported", err);
            });
        });

        if (!this.reticle && this.sessionRoot) {
            this.reticle = new Mesh(
                new RingGeometry(0.07, 0.09, 32).rotateX(- Math.PI / 2),
                new MeshBasicMaterial()
            );
            this.reticle.name = "AR Placement reticle";
            this.reticle.matrixAutoUpdate = false;
            this.reticle.visible = false;

            // create AR reticle parent to allow WebXRSessionRoot to be translated, rotated or scaled
            this.reticleParent = new Object3D();
            this.reticleParent.name = "AR Reticle Parent";
            this.reticleParent.matrixAutoUpdate = false;
            this.reticleParent.add(this.reticle);
            // this.reticleParent.matrix.copy(this.sessionRoot.gameObject.matrixWorld);

            if (this.webxr.scene) {
                this.context.scene.add(this.reticleParent);
                // this.context.scene.add(this.reticle);
                this.context.scene.visible = true;
            }
            else console.warn("Could not found WebXR Rig");
        }

        this._previousParent = this.webxr.gameObject;
        if (!WebAR.tempWebXRObject) WebAR.tempWebXRObject = new Object3D();
        this.context.scene.add(WebAR.tempWebXRObject);
        GameObject.addComponent(WebAR.tempWebXRObject as GameObject, this.webxr);

        if (this.sessionRoot) {
            this.sessionRoot.webAR = this;
            this.sessionRoot?.onBegin(session);
        }
        else console.warn("No WebARSessionRoot found in scene")

        const eng = this.context.domElement as INeedleEngineComponent;
        eng?.onEnterAR?.call(eng, session, this.arOverlayElement!);

        this.context.mainCameraComponent?.applyClearFlagsIfIsActiveCamera();
    }

    onEnd(session: XRSession) {
        if (this._previousParent) {
            GameObject.addComponent(this._previousParent as GameObject, this.webxr);
            this._previousParent = null;
        }
        this.hitTestSource = null;
        const context = this.webxr.context;
        context.scene.background = this.previousBackground;
        context.scene.environment = this.previousEnvironment;
        if (this.sessionRoot) {
            this.sessionRoot.onEnd(this.webxr.Rig, session);
        }

        const el = this.context.domElement as INeedleEngineComponent;
        el.onExitAR?.call(el, session);

        this.context.mainCameraComponent?.applyClearFlagsIfIsActiveCamera();
    }

    onUpdate(session: XRSession, frame: XRFrame) {

        if (this.noHitTestAvailable === true) {
            if (this.reticle)
                this.reticle.visible = false;
            if (!this.didPlaceARSessionRoot) {
                this.didPlaceARSessionRoot = true;
                const rig = this.webxr.Rig;
                const placementMatrix = arPlacementWithoutHitTestMatrix.clone();
                // if (rig) {
                //     const positionFromRig = new Vector3(0, 0, 0).add(rig.position).divideScalar(this.sessionRoot?.arScale ?? 1);
                //     placementMatrix.multiply(new Matrix4().makeTranslation(positionFromRig.x, positionFromRig.y, positionFromRig.z));
                //     // placementMatrix.setPosition(positionFromRig);
                // }
                this.sessionRoot?.placeAt(rig, placementMatrix);
            }
            return;
        }

        if (!this.hitTestSource) return;
        const hitTestResults = frame.getHitTestResults(this.hitTestSource);
        if (hitTestResults.length) {
            const hit = hitTestResults[0];
            const referenceSpace = this.webxr.context.renderer.xr.getReferenceSpace();
            if (referenceSpace) {
                const pose = hit.getPose(referenceSpace);

                if (this.sessionRoot) {
                    const didPlace = this.sessionRoot.onUpdate(this.webxr.Rig, session, pose);
                    this.didPlaceARSessionRoot = didPlace;
                }

                if (this.reticle) {
                    this.reticle.visible = this.reticleActive;
                    if (this.reticleActive) {
                        if (pose) {
                            const matrix = pose.transform.matrix;
                            this.reticle.matrix.fromArray(matrix);
                            if (this.webxr.Rig)
                                this.reticle.matrix.premultiply(this.webxr.Rig.matrix);
                        }
                    }
                }
            }

        } else {
            this.sessionRoot?.onUpdate(this.webxr.Rig, session, null);
            if (this.reticle)
                this.reticle.visible = false;
        }
    }
}

const arPlacementWithoutHitTestMatrix = new Matrix4().identity().makeTranslation(0, 0, 0);