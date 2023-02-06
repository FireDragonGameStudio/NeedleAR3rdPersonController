import { Behaviour, GameObject } from "./Component";
import { RoomEvents, OwnershipModel, NetworkConnection } from "../engine/engine_networking";
import { WebXR, WebXREvent } from "./WebXR";
import { Group, Quaternion, Vector3, Vector4, WebXRManager } from "three";
import { getParam } from "../engine/engine_utils";
import { Voip } from "./Voip";
import { Builder, Long } from "flatbuffers";
import { VrUserStateBuffer } from "../engine-schemes/vr-user-state-buffer";
import { Vec3 } from "../engine-schemes/vec3";
import { registerType } from "../engine-schemes/schemes";
import { Vec4 } from "../engine-schemes/vec4";
import { WebXRAvatar } from "./WebXRAvatar";

// for debug GUI
// import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";
// import { HTMLMesh } from 'three/examples/jsm/interactive/HTMLMesh.js';
// import { InteractiveGroup } from 'three/examples/jsm/interactive/InteractiveGroup.js';
// import { renderer, sceneData } from "../engine/engine_setup";

const debugLogs = getParam("debugxr");
const debugAvatar = getParam("debugavatar");
// const debugAvatarVoip = getParam("debugavatarvoip");

enum WebXRSyncEvent {
    WebXR_UserJoined = "webxr-user-joined",
    WebXR_UserLeft = "webxr-user-left",
    VRSessionStart = "vr-session-started",
    VRSessionEnd = "vr-session-ended",
    VRSessionUpdate = "vr-session-update",
}

enum XRMode {
    VR = "vr",
    AR = "ar",
}

const VRUserStateBufferIdentifier = "VRUS";
registerType(VRUserStateBufferIdentifier, VrUserStateBuffer.getRootAsVrUserStateBuffer);

function getTimeStampNow() {
    return new Date().getTime(); // avoid sending millis in flatbuffer
}

function flatbuffers_long_from_number(num: number): Long {
    let low = num & 0xffffffff
    let high = (num / Math.pow(2, 32)) & 0xfffff
    return Long.create(low, high);
}

export class VRUserState {
    public guid: string;
    public time!: number;
    public avatarId!: string;
    public position: Vector3 = new Vector3();
    public rotation: Vector4 = new Vector4();
    public scale: number = 1;

    public posLeftHand = new Vector3();
    public posRightHand = new Vector3();

    public rotLeftHand = new Quaternion();
    public rotRightHand = new Quaternion();

    public constructor(guid: string) {
        this.guid = guid;
    }

    private static invertRotation: Quaternion = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI);

    public update(rig: Group, pos: DOMPointReadOnly, rot: DOMPointReadOnly, webXR: WebXR, avatarId: string) {
        this.time = getTimeStampNow();
        this.avatarId = avatarId;
        this.position.set(pos.x, pos.y, pos.z);
        if (rig)
            this.position.applyMatrix4(rig.matrixWorld);

        let q0 = VRUserState.quat0;
        const q1 = VRUserState.quat1;
        q0.set(rot.x, rot.y, rot.z, rot.w);
        q0 = q0.multiplyQuaternions(q0, VRUserState.invertRotation);

        if (rig) {
            rig.getWorldQuaternion(q1);
            q0.multiplyQuaternions(q1, q0);
        }

        this.rotation.set(q0.x, q0.y, q0.z, q0.w);
        this.scale = rig.scale.x;

        // for controllers, it seems we need grip pose
        const ctrl0 = webXR.LeftController?.controllerGrip;
        if (ctrl0) {
            ctrl0.getWorldPosition(this.posLeftHand);
            ctrl0.getWorldQuaternion(this.rotLeftHand);
        }
        const ctrl1 = webXR.RightController?.controllerGrip;
        if (ctrl1) {
            ctrl1.getWorldPosition(this.posRightHand);
            ctrl1.getWorldQuaternion(this.rotRightHand);
        }

        // if this is a hand, we need to get the root bone of that / use that for position/rotation
        if (webXR.LeftController?.hand?.visible) {
            const wrist = webXR.LeftController.wrist;
            if (wrist) {
                wrist.getWorldPosition(this.posLeftHand);
                wrist.getWorldQuaternion(this.rotLeftHand);
            }
        }

        if (webXR.RightController?.hand?.visible) {
            const wrist = webXR.RightController.wrist;
            if (wrist) {
                wrist.getWorldPosition(this.posRightHand);
                wrist.getWorldQuaternion(this.rotRightHand);
            }
        }
    }

    private static quat0: Quaternion = new Quaternion();
    private static quat1: Quaternion = new Quaternion();

    public sendAsBuffer(builder: Builder, net: NetworkConnection) {
        builder.clear();
        const guid = builder.createString(this.guid);
        const id = builder.createString(this.avatarId);
        VrUserStateBuffer.startVrUserStateBuffer(builder);
        VrUserStateBuffer.addGuid(builder, guid);
        VrUserStateBuffer.addTime(builder, flatbuffers_long_from_number(this.time));
        VrUserStateBuffer.addAvatarId(builder, id);
        VrUserStateBuffer.addPosition(builder, Vec3.createVec3(builder, this.position.x, this.position.y, this.position.z));
        VrUserStateBuffer.addRotation(builder, Vec4.createVec4(builder, this.rotation.x, this.rotation.y, this.rotation.z, this.rotation.w));
        VrUserStateBuffer.addScale(builder, this.scale);
        VrUserStateBuffer.addPosLeftHand(builder, Vec3.createVec3(builder, this.posLeftHand.x, this.posLeftHand.y, this.posLeftHand.z));
        VrUserStateBuffer.addPosRightHand(builder, Vec3.createVec3(builder, this.posRightHand.x, this.posRightHand.y, this.posRightHand.z));
        VrUserStateBuffer.addRotLeftHand(builder, Vec4.createVec4(builder, this.rotLeftHand.x, this.rotLeftHand.y, this.rotLeftHand.z, this.rotLeftHand.w));
        VrUserStateBuffer.addRotRightHand(builder, Vec4.createVec4(builder, this.rotRightHand.x, this.rotRightHand.y, this.rotRightHand.z, this.rotRightHand.w));
        const res = VrUserStateBuffer.endVrUserStateBuffer(builder);
        builder.finish(res, VRUserStateBufferIdentifier);
        const arr = builder.asUint8Array();
        net.sendBinary(arr);
    }

    public setFromBuffer(guid: string, state: VrUserStateBuffer) {
        if (!guid) return;
        this.guid = guid;
        this.time = state.time().toFloat64();
        const id = state.avatarId();
        if (id)
            this.avatarId = id;
        const pos = state.position();
        if (pos)
            this.position.set(pos.x(), pos.y(), pos.z());
        // TODO: maybe just send one float more instead of converting back and forth
        const rot = state.rotation();
        if (rot)
            this.rotation.set(rot.x(), rot.y(), rot.z(), rot.w());
        const posLeftHand = state.posLeftHand();
        if (posLeftHand)
            this.posLeftHand.set(posLeftHand.x(), posLeftHand.y(), posLeftHand.z());
        const posRightHand = state.posRightHand();
        if (posRightHand)
            this.posRightHand.set(posRightHand.x(), posRightHand.y(), posRightHand.z());
        const rotLeftHand = state.rotLeftHand();
        if (rotLeftHand)
            this.rotLeftHand.set(rotLeftHand.x(), rotLeftHand.y(), rotLeftHand.z(), rotLeftHand.w());
        const rotRightHand = state.rotRightHand();
        if (rotRightHand)
            this.rotRightHand.set(rotRightHand.x(), rotRightHand.y(), rotRightHand.z(), rotRightHand.w());
        this.scale = state.scale();
    }
}

export class WebXRSync extends Behaviour {

    webXR: WebXR | null = null;

    // private allowCustomAvatars: boolean | null = true;

    private debugAvatarUser: WebXRAvatar | null = null;
    private voip: Voip | null = null;

    async awake() {

        if(!this.webXR) this.webXR = GameObject.getComponent(this.gameObject, WebXR);
        if(!this.webXR) this.webXR = GameObject.findObjectOfType(WebXR, this.context);

        if(!this.webXR) 
        {
            console.log("Missing webxr component");
            this.webXR = GameObject.findObjectOfType(WebXR, this.context);
            if(!this.webXR) {
                console.error("Could not find webxr component");
                return;
            }
        }

        if (!this.voip) this.voip = GameObject.findObjectOfType(Voip, this.context);

        if (debugAvatar) {
            const debugGuid = "debug-avatar-" + debugAvatar;
            const newUser = new WebXRAvatar(this.context, debugGuid, this.webXR);
            // newUser.isLocalAvatar = true;
            this.debugAvatarUser = newUser;
            if (typeof debugAvatar === "string" && debugAvatar.length > 0) {
                if (await newUser.setAvatarOverride(debugAvatar)) {
                    const debugState = new VRUserState(debugGuid);
                    debugState.position.y += 1;
                    const off = .5;
                    debugState.posLeftHand.y += off;
                    debugState.posLeftHand.x += off;
                    debugState.posRightHand.y += off;
                    debugState.posRightHand.x -= off;
                    newUser.tryUpdate(debugState, 0);
                }
                else {
                    newUser.destroy();
                }
            }
        }
    }

    onEnable() {
        // const debugUser = new WebXRAvatar(this.context, "sorry-no-guid", this.webXR!);

        if (!this.webXR) {
            this.webXR = GameObject.getComponent(this.gameObject, WebXR);
            if (!this.webXR) {
                console.warn("Missing webxr component on " + this.gameObject.name);
                return;
            }
        }

        this.eventSub_WebXRStartEvent = this.onXRSessionStart.bind(this);
        WebXR.addEventListener(WebXREvent.XRStarted, this.eventSub_WebXRStartEvent);
        this.eventSub_WebXRUpdateEvent = this.onXRSessionUpdate.bind(this);
        WebXR.addEventListener(WebXREvent.XRUpdate, this.eventSub_WebXRUpdateEvent);
        this.eventSub_WebXREndEvent = this.onXRSessionEnded.bind(this);
        WebXR.addEventListener(WebXREvent.XRStopped, this.eventSub_WebXREndEvent);

        this.eventSub_ConnectionEvent = this.onConnected.bind(this);
        this.context.connection.beginListen(RoomEvents.JoinedRoom, this.eventSub_ConnectionEvent);
        this.context.connection.beginListen(WebXRSyncEvent.WebXR_UserJoined, _evt => {
            console.log("webxr user joined evt");
        });
        this.context.connection.beginListen(WebXRSyncEvent.WebXR_UserLeft, evt => {
            const hasId = evt.id !== null && evt.id !== undefined;
            if (!hasId) return;
            console.log("webxr user left evt");
            if (hasId) {
                const avatar = this.avatars[evt.id];
                avatar?.destroy();
                this.avatars[evt.id] = undefined;
            }
        });
        this.context.connection.beginListenBinrary(VRUserStateBufferIdentifier, (state: VrUserStateBuffer) => {
            // console.log("BUFFER", state);
            const guid = state.guid();
            if (!guid) return;
            const time = state.time().toFloat64();
            const temp = this.tempState;
            temp.setFromBuffer(guid, state);
            // console.log(temp);
            const user = this.onTryGetAvatar(guid, time);
            user?.tryUpdate(temp, time);
        });
        this.context.connection.beginListen(WebXRSyncEvent.VRSessionUpdate, (state: VRUserState) => {
            const guid = state.guid;
            const time = state.time;
            const user = this.onTryGetAvatar(guid, time);
            user?.tryUpdate(state, time);
        });
    }

    private tempState: VRUserState = new VRUserState("");

    private onTryGetAvatar(guid: string, time: number) {
        if (guid === this.context.connection.connectionId) return null; // ignore self in case we receive that also!
        const timeDiff = new Date().getTime() - time;
        if (timeDiff > 5000) {
            if (debugLogs)
                console.log("old data", timeDiff, guid)
            return null;
        }
        let user = this.avatars[guid];
        if (user === undefined) {
            try {
                console.log("create new avatar");
                const newUser = new WebXRAvatar(this.context, guid, this.webXR!);
                user = newUser;
                this.avatars[guid] = newUser;
            } catch (err) {
                this.avatars[guid] = null;
                console.error(err);
            }
        }
        return user;
    }

    onDisable() {
        if (this.eventSub_ConnectionEvent)
            this.context.connection.stopListening(RoomEvents.JoinedRoom, this.eventSub_ConnectionEvent);
        WebXR.removeEventListener(WebXREvent.XRStarted, this.eventSub_WebXRStartEvent);
        WebXR.removeEventListener(WebXREvent.XRUpdate, this.eventSub_WebXRUpdateEvent);
        WebXR.removeEventListener(WebXREvent.XRStopped, this.eventSub_WebXREndEvent);
    }

    update(): void {

        const now = getTimeStampNow();

        if (this.debugAvatarUser) {
            this.debugAvatarUser.lastUpdate = now;
        }

        this.detectPotentiallyDisconnectedAvatarsAndRemove();

        for (const key in this.avatars) {
            const avatar = this.avatars[key];
            if (!avatar) continue;
            avatar.update();
        }
    }


    private _removeAvatarsList: string[] = [];
    private detectPotentiallyDisconnectedAvatarsAndRemove() {
        const utcnow = getTimeStampNow();
        for (const key in this.avatars) {
            const avatar = this.avatars[key];
            if (!avatar) {
                this._removeAvatarsList.push(key);
                continue;
            }
            if (utcnow - avatar.lastUpdate > 10_000) {
                console.log("avatar timed out (didnt receive any updates in  a while) - destroying it now");
                avatar.destroy();
                this.avatars[key] = undefined;
            }
        }
        for (const rem of this._removeAvatarsList) {
            delete this.avatars[rem];
        }
        this._removeAvatarsList.length = 0;
    }

    private buildLocalAvatar() {
        if (this.localAvatar) return;
        const connectionId = this.context.connection?.connectionId ?? this.k_LocalAvatarNoNetworkingGuid;
        this.localAvatar = new WebXRAvatar(this.context, connectionId, this.webXR!);
        this.localAvatar.isLocalAvatar = true;
        this.localAvatar.setAvatarOverride(this.getAvatarId());
        this.avatars[this.localAvatar.guid] = this.localAvatar;
    }


    private eventSub_ConnectionEvent: Function | null = null;
    private eventSub_WebXRStartEvent: Function | null = null;
    private eventSub_WebXREndEvent: Function | null = null;
    private eventSub_WebXRUpdateEvent: Function | null = null;
    private avatars: { [key: string]: WebXRAvatar | undefined | null } = {}
    private localAvatar: WebXRAvatar | null = null;
    private k_LocalAvatarNoNetworkingGuid = "local";

    private onConnected() {
        // this event gets fired when we have joined a room and are ready to update
        if (debugLogs)
            console.log("Hey you are connected as " + this.context.connection.connectionId);

        if (this.localAvatar?.guid === this.k_LocalAvatarNoNetworkingGuid) {
            if (this.localAvatar) {
                this.localAvatar?.destroy();
                this.avatars[this.localAvatar.guid] = undefined;
            }
            this.localAvatar = null;
            this.xrState = null;
            this.ownership?.freeOwnership();
            this.ownership = null;
        }
    }

    private onXRSessionStart(_evt: { session: XRSession }) {
        console.log("XR session started");
        this.context.connection.send(WebXRSyncEvent.WebXR_UserJoined, { id: this.context.connection.connectionId, mode: XRMode.VR });

        if (this.localAvatar) {
            this.localAvatar?.destroy();
            this.avatars[this.localAvatar.guid] = undefined;
            this.localAvatar = null;
        }
        this.xrState = null;
        this.ownership?.freeOwnership();
        this.ownership = null;

        if (this.avatars) {
            for (const key in this.avatars) {
                this.avatars[key]?.updateFlags();
            }
        }
    }

    private onXRSessionEnded(_evt: { session: XRSession }) {
        console.log("XR session ended");
        this.context.connection.send(WebXRSyncEvent.WebXR_UserLeft, { id: this.context.connection.connectionId, mode: XRMode.VR });
        if(this.localAvatar){
            this.localAvatar?.destroy();
            this.avatars[this.localAvatar.guid] = undefined;
            this.localAvatar = null;
        }
    }

    private ownership: OwnershipModel | null = null;
    private xrState: VRUserState | null = null;
    private builder: Builder = new Builder(1024);

    private onXRSessionUpdate(evt: { rig: Group, frame: XRFrame, xr: WebXRManager, input: XRInputSource[] }) {

        this.xrState ??= new VRUserState(this.context.connection.connectionId ?? this.k_LocalAvatarNoNetworkingGuid);
        this.ownership ??= new OwnershipModel(this.context.connection, this.context.connection.connectionId ?? this.k_LocalAvatarNoNetworkingGuid);
        this.ownership.guid = this.context.connection.connectionId ?? this.k_LocalAvatarNoNetworkingGuid;
        this.buildLocalAvatar();


        const { frame, xr, rig } = evt;
        const pose = frame.getViewerPose(xr.getReferenceSpace()!);
        if (!pose) return; // e.g. if user is not wearing headset
        const transform: XRRigidTransform = pose?.transform;
        const pos = transform.position;
        const rot = transform.orientation;
        this.xrState.update(rig, pos, rot, this.webXR!, this.getAvatarId());

        if (this.localAvatar) {
            if (this.context.connection.connectionId) {
                this.localAvatar.guid = this.context.connection.connectionId;
            }
            this.localAvatar.tryUpdate(this.xrState, 0);
        }

        if (this.ownership && !this.ownership.hasOwnership && this.context.connection.isConnected) {
            if (this.context.time.frameCount % 120 === 0)
                this.ownership.requestOwnership();
            if (!this.ownership.hasOwnership) {
                // console.log("NO OWNERSHIP", this.ownership.guid);
                return;
            }
        }

        if (!this.context.connection.isConnected || !this.context.connection.connectionId) {
            return;
        }

        this.xrState.sendAsBuffer(this.builder, this.context.connection);

        // this.context.connection.send(WebXRSyncEvent.VRSessionUpdate, this.xrState);

    }

    private getAvatarId() {
        const urlAvatar = getParam("avatar") as string;
        const avatarId = urlAvatar ?? null;
        return avatarId;
    }
}
