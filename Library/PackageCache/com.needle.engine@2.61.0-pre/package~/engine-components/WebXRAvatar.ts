import { Behaviour, GameObject } from "./Component";
import { WebXR } from "./WebXR";
import { Quaternion, Vector3 } from "three";
import { AvatarLoader } from "./AvatarLoader";
import { XRFlag, XRStateFlag } from "./XRFlag";
import { Avatar_POI } from "./avatar/Avatar_Brain_LookAt";
import { Context } from "../engine/engine_setup";
import { AssetReference } from "../engine/engine_addressables";
import { Object3D } from "three";
import { VRUserState } from "./WebXRSync";
import { getParam } from "../engine/engine_utils";
import { serializable } from "../engine/engine_serialization_decorator";
import { ViewDevice } from "../engine/engine_playerview";
import { InstancingUtil } from "../engine/engine_instancing";

export const debug = getParam("debugavatar");

export type AvatarMarkerEventArgs = {
    avatarMarker: AvatarMarker;
    gameObject: Object3D;
}

export class AvatarMarker extends Behaviour {

    public static getAvatar(index: number): AvatarMarker | null {
        if (index >= 0 && index < AvatarMarker.instances.length)
            return AvatarMarker.instances[index];
        return null;
    }

    public static instances: AvatarMarker[] = [];

    public static onAvatarMarkerCreated(cb: (args: AvatarMarkerEventArgs) => void): Function {
        AvatarMarker._onNewAvatarMarkerAdded.push(cb);
        return cb;
    }

    public static onAvatarMarkerDestroyed(cb: (args: AvatarMarkerEventArgs) => void): Function {
        AvatarMarker._onAvatarMarkerDestroyed.push(cb);
        return cb;
    }

    private static _onNewAvatarMarkerAdded: Array<(args: AvatarMarkerEventArgs) => void> = [];
    private static _onAvatarMarkerDestroyed: Array<(args: AvatarMarkerEventArgs) => void> = [];


    public connectionId!: string;
    public avatar?: WebXRAvatar | Object3D;

    awake() {
        AvatarMarker.instances.push(this);
        if (debug)
            console.log(this);

        for (const cb of AvatarMarker._onNewAvatarMarkerAdded)
            cb({ avatarMarker: this, gameObject: this.gameObject });
    }

    onDestroy() {
        AvatarMarker.instances.splice(AvatarMarker.instances.indexOf(this), 1);

        for (const cb of AvatarMarker._onAvatarMarkerDestroyed)
            cb({ avatarMarker: this, gameObject: this.gameObject });
    }

    isLocalAvatar() {
        return this.connectionId === this.context.connection.connectionId;
    }

    setVisible(visible: boolean) {
        if (this.avatar) {
            if ("setVisible" in this.avatar)
                this.avatar.setVisible(visible);
            else {
                GameObject.setActive(this.avatar, visible);
            }
        }
    }
}


export class WebXRAvatar {
    private static loader: AvatarLoader = new AvatarLoader();

    private _isVisible: boolean = true;
    setVisible(visible: boolean) {
        this._isVisible = visible;
        this.updateVisibility();
    }

    get isWebXRAvatar() { return true; }

    // TODO: set layers on all avatars 
    /** the user id */
    public guid: string;

    private root: Object3D | null = null;
    public head: Object3D | null = null;
    public handLeft: Object3D | null = null;
    public handRight: Object3D | null = null;
    public lastUpdate: number = -1;
    public isLocalAvatar: boolean = false;
    public flags: XRFlag[] | null = null;
    private headScale: Vector3 = new Vector3(1, 1, 1);
    private handLeftScale: Vector3 = new Vector3(1, 1, 1);
    private handRightScale: Vector3 = new Vector3(1, 1, 1);

    private readonly webxr: WebXR;

    private lastAvatarId: string | null = null;
    private hasAvatarOverride: boolean = false;


    private context: Context;
    private avatarMarker: AvatarMarker | null = null;

    constructor(context: Context, guid: string, webXR: WebXR) {
        this.context = context;
        this.guid = guid;
        this.webxr = webXR;
        this.setupCustomAvatar(this.webxr.defaultAvatar as AssetReference);
    }

    public updateFlags() {
        if (!this.flags)
            return;
        let mask = this.isLocalAvatar ? XRStateFlag.FirstPerson : XRStateFlag.ThirdPerson;
        if (this.context.isInVR)
            mask |= XRStateFlag.VR;
        else if (this.context.isInAR)
            mask |= XRStateFlag.AR;
        else
            mask |= XRStateFlag.Browser;
        for (const f of this.flags) {
            f.gameObject.visible = true;
            f.UpdateVisible(mask);
        }
    }

    public async setAvatarOverride(avatarId: string | null): Promise<boolean | null> {
        this.hasAvatarOverride = avatarId !== null;
        if (this.hasAvatarOverride && this.lastAvatarId !== avatarId) {
            this.lastAvatarId = avatarId;
            if (avatarId != null && avatarId.length > 0)
                return await this.setupCustomAvatar(avatarId);
        }
        return null;
    }

    private _headTarget: Object3D = new Object3D();
    private _handLeftTarget: Object3D = new Object3D();
    private _handRightTarget: Object3D = new Object3D();
    private _canInterpolate: boolean = false;

    private static invertRotation: Quaternion = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI);

    public tryUpdate(state: VRUserState, _timeDiff: number) {
        if (state.guid === this.guid) {

            if (this.lastAvatarId !== state.avatarId && state.avatarId && state.avatarId.length > 0) {
                this.lastAvatarId = state.avatarId;
                this.setupCustomAvatar(state.avatarId);
            }

            this.lastUpdate = state.time;
            if (this.head) {

                const device = this.webxr.IsInAR ? ViewDevice.Handheld : ViewDevice.Headset;
                let viewObj = this.head;
                // if (this.isLocalAvatar) {
                //     if (this.context.mainCamera && this.context.isInXR) {
                //         viewObj = this.context.renderer.xr.getCamera(this.context.mainCamera);
                //     }
                // }
                this.context.players.setPlayerView(state.guid, viewObj, device);

                InstancingUtil.markDirty(this.head);

                this._canInterpolate = true;
                const ht = this.isLocalAvatar ? this.head : this._headTarget;
                ht.position.set(state.position.x, state.position.y, state.position.z);
                // not sure how position in local space can be correct but rotation is wrong / offset when parent rotates
                ht.quaternion.set(state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.w);
                ht.scale.set(state.scale, state.scale, state.scale);
                ht.scale.multiply(this.headScale);

                if (this.handLeft) {
                    const ht = this.isLocalAvatar ? this.handLeft : this._handLeftTarget;
                    ht.position.set(state.posLeftHand.x, state.posLeftHand.y, state.posLeftHand.z);
                    ht.quaternion.set(state.rotLeftHand["_x"], state.rotLeftHand["_y"], state.rotLeftHand["_z"], state.rotLeftHand["_w"]);
                    ht.quaternion.multiply(WebXRAvatar.invertRotation);
                    ht.scale.set(state.scale, state.scale, state.scale);
                    ht.scale.multiply(this.handLeftScale);
                    InstancingUtil.markDirty(this.handLeft);
                }

                if (this.handRight) {
                    const ht = this.isLocalAvatar ? this.handRight : this._handRightTarget;
                    ht.position.set(state.posRightHand.x, state.posRightHand.y, state.posRightHand.z);
                    ht.quaternion.set(state.rotRightHand["_x"], state.rotRightHand["_y"], state.rotRightHand["_z"], state.rotRightHand["_w"]);
                    ht.quaternion.multiply(WebXRAvatar.invertRotation);
                    ht.scale.set(state.scale, state.scale, state.scale);
                    ht.scale.multiply(this.handRightScale);
                    InstancingUtil.markDirty(this.handRight);
                }
            }
        }
    }

    public update() {
        if (this.isLocalAvatar)
            return;
        if (!this._canInterpolate)
            return;
        const t = this.context.time.deltaTime / .1;
        if (this.head) {
            this.head.position.lerp(this._headTarget.position, t);
            this.head.quaternion.slerp(this._headTarget.quaternion, t);
            this.head.scale.lerp(this._headTarget.scale, t);
        }
        if (this.handLeft && this._handLeftTarget) {
            this.handLeft.position.lerp(this._handLeftTarget.position, t);
            this.handLeft.quaternion.slerp(this._handLeftTarget.quaternion, t);
            this.handLeft.scale.lerp(this._handLeftTarget.scale, t);
        }
        if (this.handRight && this._handRightTarget) {
            this.handRight.position.lerp(this._handRightTarget.position, t);
            this.handRight.quaternion.slerp(this._handRightTarget.quaternion, t);
            this.handRight.scale.lerp(this._handRightTarget.scale, t);
        }
    }

    public destroy() {
        if (debug)
            console.log("Destroy avatar", this.guid);
        this.root?.removeFromParent();
        this.avatarMarker?.destroy();
        this.lastAvatarId = null;

        if (this.head) {
            Avatar_POI.Remove(this.context, this.head);
        }
        // this.head?.removeFromParent();
        // this.handLeft?.removeFromParent();
        // this.handRight?.removeFromParent();
    }

    private updateVisibility() {
        const root = this.root;
        if (root) {
            GameObject.setActive(root, this._isVisible);
        }
    }

    private async setupCustomAvatar(avatarId: string | Object3D | AssetReference): Promise<boolean> {
        if (debug)
            console.log("LOAD", avatarId, this);

        if (!avatarId || (typeof avatarId === "string" && avatarId.length <= 0))
            return false;

        if (this.head) {
            Avatar_POI.Remove(this.context, this.head);
        }

        const reference = avatarId as AssetReference;
        if (reference?.loadAssetAsync !== undefined) {
            await reference.loadAssetAsync();
            const prefab = reference.asset as Object3D;
            GameObject.setActive(prefab, false);
            avatarId = GameObject.instantiate(prefab as Object3D) as Object3D;
            GameObject.setActive(avatarId, true);
            // console.log("Avatar", avatarId);
        }
        if (debug)
            console.log(avatarId);

        const model = await WebXRAvatar.loader.getOrCreateNewAvatarInstance(this.context, avatarId as (Object3D | string));
        if (debug)
            console.log(model, model?.isValid, this.lastAvatarId, avatarId);
        // if (this.lastAvatarId !== avatarId) {
        //     // avatar id changed in the meantime
        //     return true;
        // }
        if (model?.isValid) {
            this.root = model.root;

            this.root.position.set(0, 0, 0);
            this.root.quaternion.set(0, 0, 0, 1);
            this.root.scale.set(1, 1, 1); // should we allow a scaled avatar root?!

            this.avatarMarker = GameObject.addNewComponent(this.root as GameObject, AvatarMarker) as AvatarMarker;
            this.avatarMarker.connectionId = this.guid;
            this.avatarMarker.avatar = this;

            if (this.head && this.head !== model.head)
                this.head?.removeFromParent();
            this.head = model.head;
            this.headScale.copy(this.head.scale);

            if (this.head && !this.isLocalAvatar) {
                Avatar_POI.Add(this.context, this.head, this.avatarMarker);
            }

            if (model.leftHand)
                this.handLeft?.removeFromParent();
            this.handLeft = model.leftHand ?? this.handLeft;
            if (this.handLeft)
                this.handLeftScale.copy(this.handLeft.scale);
            else
                this.handLeftScale.set(1, 1, 1);

            if (model.rigthHand)
                this.handRight?.removeFromParent();
            this.handRight = model.rigthHand ?? this.handRight;
            if (this.handRight)
                this.handRightScale.copy(this.handRight.scale);
            else
                this.handRightScale.set(1, 1, 1);


            this.context.scene.add(this.root);
            // scene.add(this.handLeft);
            // scene.add(this.handRight);
            // this.mouthShapes = null;
            // this.needSearchEyes = true;
            if (this.flags == null)
                this.flags = [];
            this.flags.length = 0;
            this.flags.push(...GameObject.getComponentsInChildren(this.root as GameObject, XRFlag));
            // if no flags are found add at least a head flag to hide head in first person VR
            if (this.flags.length <= 0) {
                if (this.head) {
                    const flag = GameObject.addNewComponent(this.head, XRFlag) as XRFlag;
                    flag.visibleIn = XRStateFlag.ThirdPerson | XRStateFlag.VR;
                    this.flags.push(flag);
                    if (debug)
                        console.log("Added flag to head: " + flag.visibleIn, this.head.name);
                }
            }

            if (debug)
                console.log("[Avatar], is Local? ", this.isLocalAvatar, this.root);
            this.updateFlags();

            this.updateVisibility();

            return true;
        }
        else {
            if (debug)
                console.warn("build avatar failed");
            return false;
        }
    }
}
