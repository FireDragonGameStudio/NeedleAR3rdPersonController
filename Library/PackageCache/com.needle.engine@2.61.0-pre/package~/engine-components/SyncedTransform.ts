import * as THREE from 'three'
import { OwnershipModel, RoomEvents } from "../engine/engine_networking"
import { Behaviour, GameObject } from "./Component";
import { Rigidbody } from "./RigidBody";
import * as utils from "../engine/engine_utils"
import { sendDestroyed } from '../engine/engine_networking_instantiate';
import { InstancingUtil } from "../engine/engine_instancing";
import { SyncedTransformModel } from '../engine-schemes/synced-transform-model';
import * as flatbuffers from "flatbuffers";
import { Transform } from '../engine-schemes/transform';
import { registerType } from '../engine-schemes/schemes';
import { setWorldEuler } from '../engine/engine_three_utils';

const debug = utils.getParam("debugsync");
export const SyncedTransformIdentifier = "STRS";
registerType(SyncedTransformIdentifier, SyncedTransformModel.getRootAsSyncedTransformModel);

const builder = new flatbuffers.Builder();

export function createTransformModel(guid: string, b: Behaviour, fast: boolean = true): Uint8Array {
    builder.clear();
    const guidObj = builder.createString(guid);
    SyncedTransformModel.startSyncedTransformModel(builder);
    SyncedTransformModel.addGuid(builder, guidObj);
    SyncedTransformModel.addFast(builder, fast);
    const p = b.worldPosition;
    const r = b.worldEuler;
    const s = b.gameObject.scale; // todo: world scale
    // console.log(p, r, s);
    SyncedTransformModel.addTransform(builder, Transform.createTransform(builder, p.x, p.y, p.z, r.x, r.y, r.z, s.x, s.y, s.z));
    const res = SyncedTransformModel.endSyncedTransformModel(builder);
    // SyncedTransformModel.finishSyncedTransformModelBuffer(builder, res);
    builder.finish(res, SyncedTransformIdentifier);
    return builder.asUint8Array();
}


export class SyncedTransform extends Behaviour {

    // public autoOwnership: boolean = true;
    public overridePhysics: boolean = true
    public interpolatePosition: boolean = true;
    public interpolateRotation: boolean = true;
    public fastMode: boolean = false;
    public syncDestroy: boolean = false;

    // private _state!: SyncedTransformModel;
    private _model: OwnershipModel | null = null;
    private _needsUpdate: boolean = true;
    private rb: Rigidbody | null = null;
    private _wasKinematic: boolean | undefined = false;
    private _receivedDataBefore: boolean = false;

    private _targetPosition!: THREE.Vector3;
    private _targetRotation!: THREE.Quaternion;

    private _receivedFastUpdate: boolean = false;
    private _shouldRequestOwnership: boolean = false;

    public requestOwnership() {
        if (debug)
            console.log("Request ownership");
        if (!this._model) {
            this._shouldRequestOwnership = true;
            this._needsUpdate = true;
        }
        else
            this._model.requestOwnership();
    }

    public hasOwnership(): boolean | undefined {
        return this._model?.hasOwnership ?? undefined;
    }

    public isOwned(): boolean | undefined {
        return this._model?.isOwned;
    }

    private joinedRoomCallback: any = null;
    private receivedDataCallback: any = null;

    awake() {
        if (debug)
            console.log("new instance", this.guid, this);
        this._receivedDataBefore = false;
        this._targetPosition = new THREE.Vector3();
        this._targetRotation = new THREE.Quaternion();

        // sync instantiate issue was because they shared the same last pos vector!
        this.lastWorldPos = new THREE.Vector3();
        this.lastWorldRotation = new THREE.Quaternion();

        this.rb = GameObject.getComponentInChildren(this.gameObject, Rigidbody);
        if (this.rb) {
            this._wasKinematic = this.rb.isKinematic;
        }

        this.receivedUpdate = true;
        // this._state = new TransformModel(this.guid, this);
        this._model = new OwnershipModel(this.context.connection, this.guid);
        if (this.context.connection.isConnected) {
            this.tryGetLastState();
        }

        this.joinedRoomCallback = this.tryGetLastState.bind(this);
        this.context.connection.beginListen(RoomEvents.JoinedRoom, this.joinedRoomCallback);
        this.receivedDataCallback = this.onReceivedData.bind(this);
        this.context.connection.beginListenBinrary(SyncedTransformIdentifier, this.receivedDataCallback);
    }

    onDestroy(): void {
        // TODO: can we add a new component for this?! do we really need this?!
        if (this.syncDestroy)
            sendDestroyed(this.guid, this.context.connection);
        this._model = null;
        this.context.connection.stopListening(RoomEvents.JoinedRoom, this.joinedRoomCallback);
        this.context.connection.stopListenBinary(SyncedTransformIdentifier, this.receivedDataCallback);
    }

    private tryGetLastState() {
        const model = this.context.connection.tryGetState(this.guid) as unknown as SyncedTransformModel;
        if (model) this.onReceivedData(model);
    }

    private tempEuler: THREE.Euler = new THREE.Euler();

    private onReceivedData(data: SyncedTransformModel) {
        if (this.destroyed) return;
        if (typeof data.guid === "function" && data.guid() === this.guid) {
            if (debug)
                console.log("new data", this.context.connection.connectionId, this.context.time.frameCount, this.guid, data);
            this.receivedUpdate = true;
            this._receivedFastUpdate = data.fast();
            const transform = data.transform();
            if (transform) {
                InstancingUtil.markDirty(this.gameObject, true);
                const position = transform.position();
                if (position) {
                    if (this.interpolatePosition)
                        this._targetPosition?.set(position.x(), position.y(), position.z());
                    if (!this.interpolatePosition || !this._receivedDataBefore)
                        this.setWorldPosition(position.x(), position.y(), position.z());
                }

                const rotation = transform.rotation();
                if (rotation) {
                    this.tempEuler.set(rotation.x(), rotation.y(), rotation.z());
                    if (this.interpolateRotation) {
                        this._targetRotation.setFromEuler(this.tempEuler);
                    }
                    if (!this.interpolateRotation || !this._receivedDataBefore)
                        setWorldEuler(this.gameObject, this.tempEuler);
                }
            }
            this._receivedDataBefore = true;

            // if (this.rb && !this._model?.hasOwnership) {
            //     this.rb.setBodyFromGameObject(data.velocity)
            // }
        }
    }

    onEnable(): void {
        this.lastWorldPos.copy(this.worldPosition);
        this.lastWorldRotation.copy(this.worldQuaternion);
        this._needsUpdate = true;
        // console.log("ENABLE", this.guid, this.gameObject.guid, this.lastWorldPos);
        if (this._model) {
            this._model.updateIsOwned();
        }
    }

    onDisable(): void {
        if (this._model)
            this._model.freeOwnership();
    }


    private receivedUpdate = false;
    private lastWorldPos!: THREE.Vector3;
    private lastWorldRotation!: THREE.Quaternion;

    onBeforeRender() {
        if (!this.activeAndEnabled || !this.context.connection.isConnected) return;
        // console.log("BEFORE RENDER", this.destroyed, this.guid, this._model?.isOwned, this.name, this.gameObject);

        if (!this.context.connection.isInRoom || !this._model) {
            if (debug)
                console.log("no model or room", this.name, this.guid, this.context.connection.isInRoom);
            return;
        }

        if (this._shouldRequestOwnership) {
            this._shouldRequestOwnership = false;
            this._model.requestOwnership();
        }

        let wp = this.worldPosition;
        let wr = this.worldQuaternion;
        if (this._model.isOwned && !this.receivedUpdate) {
            const worlddiff = wp.distanceTo(this.lastWorldPos);
            const worldRot = wr.angleTo(this.lastWorldRotation);
            const threshold = this._model.hasOwnership || this.fastMode ? .0001 : .001;
            if (worlddiff > threshold || worldRot > threshold) {
                // console.log(worlddiff, worldRot);
                if (!this._model.hasOwnership) {

                    if (debug)
                        console.log(this.guid, "reset because not owned but", this.gameObject.name, this.lastWorldPos);

                    this.worldPosition = this.lastWorldPos;
                    wp.copy(this.lastWorldPos);

                    this.worldQuaternion = this.lastWorldRotation;
                    wr.copy(this.lastWorldRotation);

                    InstancingUtil.markDirty(this.gameObject, true);
                    this._needsUpdate = false;
                }
                else {
                    this._needsUpdate = true;
                }
            }
        }
        // else if (this._model.isOwned === false) {
        //     if (!this._didRequestOwnershipOnce && this.autoOwnership) {
        //         this._didRequestOwnershipOnce = true;
        //         this._model.requestOwnershipIfNotOwned();
        //     }
        // }


        if (this._model && !this._model.hasOwnership && this._model.isOwned) {
            if (this._receivedDataBefore) {
                const factor = this._receivedFastUpdate || this.fastMode ? .5 : .3;
                const t = factor;//Mathf.clamp01(this.context.time.deltaTime * factor);
                let requireMarkDirty = false;
                if (this.interpolatePosition && this._targetPosition) {
                    const pos = this.worldPosition;
                    pos.lerp(this._targetPosition, t);
                    this.worldPosition = pos;
                    requireMarkDirty = true;
                }
                if (this.interpolateRotation && this._targetRotation) {
                    const rot = this.worldQuaternion;
                    rot.slerp(this._targetRotation, t);
                    this.worldQuaternion = rot;
                    requireMarkDirty = true;
                }
                if (requireMarkDirty)
                    InstancingUtil.markDirty(this.gameObject, true);
            }
        }


        this.receivedUpdate = false;
        this.lastWorldPos.copy(wp);
        this.lastWorldRotation.copy(wr);


        // if (this._model.isOwned === false && this.autoOwnership) {
        //     this.requestOwnership();
        // }

        if (!this._model) return;
        // only run if we are the owner
        if (!this._model || this._model.hasOwnership === undefined || !this._model.hasOwnership) {
            if (this.rb) {
                this.rb.isKinematic = this._model.isOwned ?? false;
                this.rb.setVelocity(0, 0, 0);
            }
            return;
        }

        // local user is owner:

        if (this.rb) {
            if (this._wasKinematic !== undefined) {
                if (debug)
                    console.log("reset kinematic", this.rb.name, this._wasKinematic);
                this.rb.isKinematic = this._wasKinematic;
            }

            // hacky reset if too far off
            if (this.gameObject.position.distanceTo(new THREE.Vector3(0, 0, 0)) > 1000) {
                if (debug)
                    console.log("RESET", this.name)
                this.gameObject.position.set(0, 1, 0);
                this.rb.setVelocity(0, 0, 0);
            }
        }

        const updateInterval = 10;
        const fastUpdate = this.rb || this.fastMode;
        if (this._needsUpdate && (updateInterval <= 0 || updateInterval > 0 && this.context.time.frameCount % updateInterval === 0 || fastUpdate)) {

            if (debug)
                console.log("send update", this.context.connection.connectionId, this.guid, this.gameObject.name, this.gameObject.guid);

            if (this.overridePhysics && this.rb) {
                // this.rb.setBodyFromGameObject();
            }

            this._needsUpdate = false;
            const st = createTransformModel(this.guid, this, fastUpdate ? true : false);
            // this._state.update(this, this.rb);
            // this._state.fast = fastUpdate ? true : false;
            this.context.connection.sendBinary(st);
        }
    }


    // private lastPosition: THREE.Vector3 = new THREE.Vector3();

    // private async setPosition(pt: THREE.Vector3) {

    //     if (this._model.isConnected && !this._model?.hasOwnership) {
    //         await this._model?.requestOwnershipAsync();
    //     }

    //     if (pt.distanceTo(this.lastPosition) < .001) {
    //         return;
    //     }
    //     this.lastPosition.copy(pt);

    //     if(this.gameObject.parent) this.gameObject.parent.worldToLocal(pt);
    //     // this.gameObject.position.copy(pt);
    //     this.gameObject.position.set(pt.x, pt.y, pt.z);
    //     this._target.set(pt.x, pt.y, pt.z);
    //     this._needsUpdate = true;
    //     if (this.rb) {
    //         this.gameObject.position.set(pt.x, pt.y + .5, pt.z);
    //         this.rb.setVelocity(0, 0, 0);
    //         this.rb.setBodyFromGameObject();
    //     }
    // }
}