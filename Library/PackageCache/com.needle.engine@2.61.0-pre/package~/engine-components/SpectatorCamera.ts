import { Behaviour, Component, GameObject } from "./Component";
import { Camera } from "./Camera";
import * as THREE from "three";
import { OrbitControls } from "./OrbitControls";
import { WebXR, WebXREvent } from "./WebXR";
import { AvatarMarker } from "./WebXRAvatar";
import { XRStateFlag } from "./XRFlag";
import { SmoothFollow } from "./SmoothFollow";
import { Object3D } from "three";
import { InputEvents, KeyCode } from "../engine/engine_input";
import { Context } from "../engine/engine_setup";
import { getParam } from "../engine/engine_utils";
import { PlayerView, ViewDevice } from "../engine/engine_playerview";
import { RaycastOptions } from "../engine/engine_physics";
import { RoomEvents } from "../engine/engine_networking";
import { ICamera } from "../engine/engine_types";
import { IModel } from "../engine/engine_networking_types";
import { serializable } from "../engine/engine_serialization";


export enum SpectatorMode {
    FirstPerson = 0,
    ThirdPerson = 1,
}

const debug = getParam("debugspectator");

export class SpectatorCamera extends Behaviour {

    cam: Camera | null = null;

    /** when enabled pressing F will send a request to all connected users to follow me, ESC to stop */
    @serializable()
    useKeys: boolean = true;

    private _mode: SpectatorMode = SpectatorMode.FirstPerson;

    get mode() { return this._mode; }
    set mode(val: SpectatorMode) {
        this._mode = val;
    }

    /** if this user is currently spectating someone else */
    get isSpectating(): boolean {
        return this._handler?.currentTarget !== undefined;
    }

    isSpectatingUser(userId: string): boolean {
        return this.target?.userId === userId;
    }

    isFollowedBy(userId: string): boolean {
        return this.followers?.includes(userId);
    }

    /** list of other users that are following me */
    get followers(): string[] {
        return this._networking.followers;
    }

    stopSpectating() {
        if (this.context.isInXR) {
            this.followSelf();
            return;
        }
        this.target = undefined;
    }

    private get localId() : string {
        return this.context.connection.connectionId ?? "local";
    }

    /** player view to follow */
    set target(target: PlayerView | undefined) {
        if (this._handler) {

            // if (this.target?.userId) {
            //     const isFollowedByThisUser = this.followers.includes(this.target.userId);
            //     if (isFollowedByThisUser) {
            //         console.warn("Can not follow follower");
            //         target = undefined;
            //     }
            // }

            const prev = this._handler.currentTarget?.userId;
            const self = this.context.players.getPlayerView(this.localId);

            // if user is in XR and sets target to self disable it
            if (target === undefined || (this.context.isInXR === false && self?.currentObject === target.currentObject)) {
                if (this._handler.currentTarget !== undefined) {
                    this._handler.disable();
                    GameObject.setActive(this.gameObject, false);
                    if (this.orbit) this.orbit.enabled = true;
                    this._networking.onSpectatedObjectChanged(target, prev);
                }
            }
            else if (this._handler.currentTarget !== target) {
                this._handler.set(target);
                GameObject.setActive(this.gameObject, true);
                if (this.orbit) this.orbit.enabled = false;
                this._networking.onSpectatedObjectChanged(target, prev);
            }
        }
    }

    get target(): PlayerView | undefined {
        return this._handler?.currentTarget;
    }

    requestAllFollowMe() {
        this._networking.onRequestFollowMe();
    }

    private get isSpectatingSelf() {
        return this.isSpectating && this.target?.currentObject === this.context.players.getPlayerView(this.localId)?.currentObject;
    }

    // private currentViewport : THREE.Vector4 = new THREE.Vector4();
    // private currentScissor : THREE.Vector4 = new THREE.Vector4();
    // private currentScissorTest : boolean = false;

    private orbit: OrbitControls | null = null;
    private _handler?: ISpectatorHandler;
    private eventSub_WebXRRequestStartEvent: Function | null = null;
    private eventSub_WebXRStartEvent: Function | null = null;
    private eventSub_WebXREndEvent: Function | null = null;
    private _debug?: SpectatorSelectionController;
    private _networking!: SpectatorCamNetworking;

    awake(): void {

        this._debug = new SpectatorSelectionController(this.context, this);
        this._networking = new SpectatorCamNetworking(this.context, this);
        this._networking.awake();

        GameObject.setActive(this.gameObject, false);

        this.cam = GameObject.getComponent(this.gameObject, Camera);
        if (!this.cam) {
            console.error("Spectator camera needs camera component", this);
            return;
        }


        if (!this._handler && this.cam)
            this._handler = new SpectatorHandler(this.context, this.cam, this);


        this.eventSub_WebXRRequestStartEvent = this.onXRSessionRequestStart.bind(this);
        this.eventSub_WebXRStartEvent = this.onXRSessionStart.bind(this);
        this.eventSub_WebXREndEvent = this.onXRSessionEnded.bind(this);

        WebXR.addEventListener(WebXREvent.RequestVRSession, this.eventSub_WebXRRequestStartEvent);
        WebXR.addEventListener(WebXREvent.XRStarted, this.eventSub_WebXRStartEvent);
        WebXR.addEventListener(WebXREvent.XRStopped, this.eventSub_WebXREndEvent);

        this.orbit = GameObject.getComponent(this.context.mainCamera, OrbitControls);
    }

    onDestroy(): void {
        this.stopSpectating();
        WebXR.removeEventListener(WebXREvent.RequestVRSession, this.eventSub_WebXRStartEvent);
        WebXR.removeEventListener(WebXREvent.XRStarted, this.eventSub_WebXRStartEvent);
        WebXR.removeEventListener(WebXREvent.XRStopped, this.eventSub_WebXREndEvent);
        this._handler?.destroy();
        this._networking.destroy();
    }

    private isSupportedPlatform() {
        const ua = window.navigator.userAgent;
        const standalone = /Windows|MacOS/.test(ua);
        const isHololens = /Windows NT/.test(ua) && /Edg/.test(ua) && !/Win64/.test(ua);
        return standalone && !isHololens;
    }

    private onXRSessionRequestStart(_evt) {
        if (!this.isSupportedPlatform()) return;
        GameObject.setActive(this.gameObject, true);
    }


    private onXRSessionStart(_evt) {
        if (!this.isSupportedPlatform()) return;
        if (debug) console.log(this.context.mainCamera);
        if (this.context.mainCamera) {
            this.followSelf();
        }
    }

    private onXRSessionEnded(_evt) {
        this.context.removeCamera(this.cam as ICamera);
        GameObject.setActive(this.gameObject, false);
        if (this.orbit) this.orbit.enabled = true;
        this._handler?.set(undefined);
        this._handler?.disable();
        if (this.isSpectatingSelf)
            this.stopSpectating();
    }


    private followSelf() {
        this.target = this.context.players.getPlayerView(this.context.connection.connectionId);
        if (!this.target) {
            this.context.players.setPlayerView(this.localId, this.context.mainCamera, ViewDevice.Headset);
            this.target = this.context.players.getPlayerView(this.localId);
        }
        if (debug) console.log("Follow self", this.target);
    }

    // TODO: only show Spectator cam for DesktopVR;
    // don't show for AR, don't show on Quest
    // TODO: properly align cameras on enter/exit VR, seems currently spectator cam breaks alignment
    onAfterRender(): void {
        if (!this.cam) return;

        const renderer = this.context.renderer;
        const xrWasEnabled = renderer.xr.enabled;

        if (!renderer.xr.isPresenting && !this._handler?.currentTarget) return;

        this._handler?.update(this._mode);

        // remember XR render target so we can restore later
        const previousRenderTarget = renderer.getRenderTarget();
        let oldFramebuffer: WebGLFramebuffer | null = null;

        // seems that in some cases, renderer.getRenderTarget returns null
        // even when we're rendering to a headset.
        if (!previousRenderTarget) {
            if (!renderer.state.bindFramebuffer || !renderer.state.bindXRFramebuffer)
                return;

            oldFramebuffer = renderer["_framebuffer"];
            renderer.state.bindXRFramebuffer(null);
        }

        this.setAvatarFlagsBeforeRender();

        const mainCam = this.context.mainCameraComponent;

        // these should not be needed if we don't override viewport/scissor
        // renderer.getViewport(this.currentViewport);
        // renderer.getScissor(this.currentScissor);
        // this.currentScissorTest = renderer.getScissorTest();
        // for scissor rendering (e.g. just a part of the screen / viewport, multiplayer split view)
        // let left = 0;
        // let bottom = 100;
        // let width = 300;
        // let height = 300;
        // renderer.setViewport(left, bottom, width, height);
        // renderer.setScissor(left, bottom, width, height);
        // renderer.setScissorTest(true);
        if (mainCam) {
            const backgroundColor = mainCam.backgroundColor;
            if (backgroundColor)
                renderer.setClearColor(backgroundColor, backgroundColor.alpha);
            this.cam.backgroundColor = backgroundColor;
            this.cam.clearFlags = mainCam.clearFlags;
            this.cam.nearClipPlane = mainCam.nearClipPlane;
            this.cam.farClipPlane = mainCam.farClipPlane;
        }
        else
            renderer.setClearColor(new THREE.Color(1, 1, 1));
        renderer.setRenderTarget(null); // null: direct to Canvas
        renderer.xr.enabled = false;
        const cam = this.cam?.cam;
        this.context.updateAspect(cam as THREE.PerspectiveCamera);
        const wasPresenting = renderer.xr.isPresenting;
        renderer.xr.isPresenting = false;
        renderer.setSize(this.context.domWidth, this.context.domHeight);
        renderer.render(this.context.scene, cam);
        renderer.xr.isPresenting = wasPresenting;

        // restore previous settings so we can continue to render XR
        renderer.xr.enabled = xrWasEnabled;
        //renderer.setViewport(this.currentViewport);
        //renderer.setScissor(this.currentScissor);
        //renderer.setScissorTest(this.currentScissorTest);

        if (previousRenderTarget)
            renderer.setRenderTarget(previousRenderTarget);
        else
            renderer.state.bindXRFramebuffer(oldFramebuffer);

        this.resetAvatarFlags();
    }

    private setAvatarFlagsBeforeRender() {
        const isFirstPersonMode = this._mode === SpectatorMode.FirstPerson;

        for (const av of AvatarMarker.instances) {
            if (av.avatar && "isLocalAvatar" in av.avatar) {
                let mask = XRStateFlag.All;
                if (this.isSpectatingSelf)
                    mask = isFirstPersonMode && av.avatar.isLocalAvatar ? XRStateFlag.FirstPerson : XRStateFlag.ThirdPerson;
                const flags = av.avatar.flags;
                if (!flags) continue;
                for (const flag of flags) {
                    flag.UpdateVisible(mask);
                }
            }
        }
    }

    private resetAvatarFlags() {
        for (const av of AvatarMarker.instances) {
            if (av.avatar && "flags" in av.avatar) {
                const flags = av.avatar.flags;
                if (!flags) continue;
                for (const flag of flags) {
                    if (av.avatar?.isLocalAvatar) {
                        flag.UpdateVisible(XRStateFlag.FirstPerson);
                    }
                    else {
                        flag.UpdateVisible(XRStateFlag.ThirdPerson);
                    }
                }
            }
        }
    }
}

interface ISpectatorHandler {
    context: Context;
    get currentTarget(): PlayerView | undefined;
    set(target?: PlayerView): void;
    update(mode: SpectatorMode);
    disable();
    destroy();
}

class SpectatorHandler implements ISpectatorHandler {

    readonly context: Context;
    readonly cam: Camera;
    readonly spectator: SpectatorCamera;

    private follow?: SmoothFollow;
    private target?: THREE.Object3D;
    private view?: PlayerView;
    private currentObject: Object3D | undefined;

    get currentTarget(): PlayerView | undefined {
        return this.view;
    }

    constructor(context: Context, cam: Camera, spectator: SpectatorCamera) {
        this.context = context;
        this.cam = cam;
        this.spectator = spectator;
    }

    set(view?: PlayerView): void {
        const followObject = view?.currentObject;
        if (!followObject) {
            this.spectator.stopSpectating();
            return;
        }
        if (followObject === this.currentObject) return;
        this.currentObject = followObject;
        this.view = view;
        if (!this.follow)
            this.follow = GameObject.addNewComponent(this.cam.gameObject, SmoothFollow);
        if (!this.target)
            this.target = new THREE.Object3D();
        followObject.add(this.target);

        this.follow.enabled = true;
        this.follow.target = this.target;
        // this.context.setCurrentCamera(this.cam);
        if (debug) console.log("FOLLOW", followObject);
        if (!this.context.isInXR) {
            this.context.setCurrentCamera(this.cam as ICamera);
        }
        else this.context.removeCamera(this.cam as ICamera);
    }

    disable() {
        if (debug) console.log("STOP FOLLOW", this.currentObject);
        this.view = undefined;
        this.currentObject = undefined;
        this.context.removeCamera(this.cam as ICamera);
        if (this.follow)
            this.follow.enabled = false;
    }

    destroy() {
        this.target?.removeFromParent();
        if (this.follow)
            GameObject.destroy(this.follow);
    }

    update(mode: SpectatorMode) {
        if (this.currentTarget?.isConnected === false || this.currentTarget?.removed === true) {
            if (debug) console.log("Target disconnected or timeout", this.currentTarget);
            this.spectator.stopSpectating();
            return;
        }
        if (this.currentTarget && this.currentTarget?.currentObject !== this.currentObject) {
            if (debug) console.log("Target changed", this.currentObject, "to", this.currentTarget.currentObject);
            this.set(this.currentTarget);
        }
        const perspectiveCamera = this.context.mainCamera as THREE.PerspectiveCamera;
        if (perspectiveCamera) {
            if (this.cam.cam.near !== perspectiveCamera.near || this.cam.cam.far !== perspectiveCamera.far) {
                this.cam.cam.near = perspectiveCamera.near;
                this.cam.cam.far = perspectiveCamera.far;
                this.cam.cam.updateProjectionMatrix();
            }
        }

        const target = this.follow?.target;
        if (!target || !this.follow) return;
        switch (mode) {
            case SpectatorMode.FirstPerson:
                if (this.view?.viewDevice !== ViewDevice.Browser) {
                    // soft follow for AR and VR
                    this.follow.followFactor = 5;
                    this.follow.rotateFactor = 5;
                }
                else {
                    // snappy follow for desktop
                    this.follow.followFactor = 50;
                    this.follow.rotateFactor = 50;
                }
                target.position.set(0, 0, 0);
                break;
            case SpectatorMode.ThirdPerson:
                this.follow.followFactor = 3;
                this.follow.rotateFactor = 2;
                target.position.set(0, .5, 1.5);
                break;
        }
        this.follow.flipForward = false;
        // console.log(this.view);
        if (this.view?.viewDevice !== ViewDevice.Browser)
            target.quaternion.copy(_inverseYQuat);
        else target.quaternion.identity();
    }


}

const _inverseYQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);


class SpectatorSelectionController {

    private readonly context: Context;
    private readonly spectator: SpectatorCamera;

    constructor(context: Context, spectator: SpectatorCamera) {
        this.context = context;
        this.spectator = spectator;
        console.log("Click other avatars or cameras to follow them. Press ESC to exit spectator mode.");
        this.context.domElement.addEventListener("keydown", (evt) => {
            if(!this.spectator.useKeys) return;
            const key = evt.key;
            if (key === "Escape") {
                this.spectator.stopSpectating();
            }
        });
        let downTime: number = 0;
        this.context.input.addEventListener(InputEvents.PointerDown, _ => {
            downTime = this.context.time.time;
        });
        this.context.input.addEventListener(InputEvents.PointerUp, _ => {
            const dt = this.context.time.time - downTime;
            if (dt > 1) {
                this.spectator.stopSpectating();
            }
            else if (this.context.input.getPointerClicked(0) && dt < .3)
                this.trySelectObject();
        });
    }

    private trySelectObject() {
        const opts = new RaycastOptions();
        opts.setMask(0xffffff);
        // opts.cam = this.spectator.cam?.cam;
        const hits = this.context.physics.raycast(opts);
        if (debug) console.log(...hits);
        if (hits?.length) {
            for (const hit of hits) {
                if (hit.distance < .2) continue;
                const obj = hit.object;
                const avatar = GameObject.getComponentInParent(obj, AvatarMarker);
                const id = avatar?.connectionId;
                if (id) {
                    const view = this.context.players.getPlayerView(id);
                    this.spectator.target = view;
                    if (debug) console.log("spectate", id, avatar);
                    break;
                }
            }
        }
    }
}





class SpectatorFollowerChangedEventModel implements IModel {
    /** the user that is following */
    guid: string;
    readonly dontSave: boolean = true;

    /** the user being followed */
    targetUserId: string | undefined;
    stoppedFollowing: boolean;

    constructor(connectionId: string, userId: string | undefined, stoppedFollowing: boolean) {
        this.guid = connectionId;
        this.targetUserId = userId;
        this.stoppedFollowing = stoppedFollowing;
    }
}

class SpectatorFollowEventModel implements IModel {
    guid: string;
    userId: string | undefined;

    constructor(comp: Component, userId: string | undefined) {
        this.guid = comp.guid;
        this.userId = userId;
    }
}

class SpectatorCamNetworking {

    readonly followers: string[] = [];


    private readonly context: Context;
    private readonly spectator: SpectatorCamera;
    private _followerEventMethod: Function;
    private _requestFollowMethod: Function;
    private _joinedRoomMethod: Function;

    constructor(context: Context, spectator: SpectatorCamera) {
        this.context = context;
        this.spectator = spectator;
        this._followerEventMethod = this.onFollowerEvent.bind(this);
        this._requestFollowMethod = this.onRequestFollowEvent.bind(this);
        this._joinedRoomMethod = this.onUserJoinedRoom.bind(this);
    }

    awake() {
        this.context.connection.beginListen("spectator-follower-changed", this._followerEventMethod);
        this.context.connection.beginListen("spectator-request-follow", this._requestFollowMethod);
        this.context.connection.beginListen(RoomEvents.JoinedRoom, this._joinedRoomMethod);
        this.context.domElement.addEventListener("keydown", evt => {
            if(!this.spectator.useKeys) return;
            if (evt.key === "f") {
                this.onRequestFollowMe();
            }
            else if (evt.key === "Escape") {
                this.onRequestFollowMe(true);
            }
        });
    }

    destroy() {
        this.context.connection.stopListening("spectator-follower-changed", this._followerEventMethod);
        this.context.connection.stopListening("spectator-request-follow", this._requestFollowMethod);
        this.context.connection.stopListening(RoomEvents.JoinedRoom, this._joinedRoomMethod);
    }

    onSpectatedObjectChanged(target: PlayerView | undefined, _prevId?: string) {
        if (debug)
            console.log(this.context.connection.connectionId, "onSpectatedObjectChanged", target, _prevId);
        if (this.context.connection.connectionId) {
            const stopped = target?.userId === undefined;
            const userId = stopped ? _prevId : target?.userId;
            const evt = new SpectatorFollowerChangedEventModel(this.context.connection.connectionId, userId, stopped);
            this.context.connection.send("spectator-follower-changed", evt)
        }
    }

    onRequestFollowMe(stop: boolean = false) {
        if (debug)
            console.log("Request follow", this.context.connection.connectionId);
        if (this.context.connection.connectionId) {
            this.spectator.stopSpectating();
            const id = stop ? undefined : this.context.connection.connectionId;
            const model = new SpectatorFollowEventModel(this.spectator, id);
            this.context.connection.send("spectator-request-follow", model);
        }
    }

    private onUserJoinedRoom() {
        if (getParam("followme")) {
            this.onRequestFollowMe();
        }
    }

    private onFollowerEvent(evt: SpectatorFollowerChangedEventModel) {
        const userBeingFollowed = evt.targetUserId;
        const userThatIsFollowing = evt.guid;

        if (debug)
            console.log(evt);

        if (userBeingFollowed === this.context.connection.connectionId) {
            if (evt.stoppedFollowing) {
                const index = this.followers.indexOf(userThatIsFollowing);
                if (index !== -1) {
                    this.followers.splice(index, 1);
                    this.removeDisconnectedFollowers();
                    console.log(userThatIsFollowing, "unfollows you", this.followers.length);
                }
            }
            else {
                if (!this.followers.includes(userThatIsFollowing)) {
                    this.followers.push(userThatIsFollowing);
                    this.removeDisconnectedFollowers();
                    console.log(userThatIsFollowing, "follows you", this.followers.length);
                }
            }
        }
    }

    private removeDisconnectedFollowers() {
        for (let i = this.followers.length - 1; i >= 0; i--) {
            const id = this.followers[i];
            if (this.context.connection.userIsInRoom(id) === false) {
                this.followers.splice(i, 1);
            }
        }
    }

    private _lastRequestFollowUser: SpectatorFollowEventModel | undefined;

    private onRequestFollowEvent(evt: SpectatorFollowEventModel) {
        this._lastRequestFollowUser = evt;

        if (evt.userId === this.context.connection.connectionId) {
            this.spectator.stopSpectating();
        }
        else if (evt.userId === undefined) {
            // this will currently also stop spectating if the user is not following you
            this.spectator.stopSpectating();
        }
        else {
            const view = this.context.players.getPlayerView(evt.userId);
            if (view) {
                this.spectator.target = view;
            }
            else {
                if (debug)
                    console.warn("Could not find view", evt.userId);
                this.enforceFollow();
                return false;
            }
        }
        return true;
    }

    private _enforceFollowInterval: any;
    private enforceFollow() {
        if (this._enforceFollowInterval) return;
        this._enforceFollowInterval = setInterval(() => {
            if (this._lastRequestFollowUser === undefined || this._lastRequestFollowUser.userId && this.spectator.isFollowedBy(this._lastRequestFollowUser.userId)) {
                clearInterval(this._enforceFollowInterval);
                this._enforceFollowInterval = undefined;
            }
            else {
                if (debug)
                    console.log("REQUEST FOLLOW AGAIN", this._lastRequestFollowUser.userId);
                this.onRequestFollowEvent(this._lastRequestFollowUser);
            }

        }, 1000);
    }
}