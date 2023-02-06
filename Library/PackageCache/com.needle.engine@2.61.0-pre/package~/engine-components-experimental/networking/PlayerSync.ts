import { Behaviour, Component, GameObject } from "../../engine-components/Component";
import { AssetReference } from "../../engine/engine_addressables";
import { serializable } from "../../engine/engine_serialization_decorator";
import { syncField } from "../../engine/engine_networking_auto"
import { RoomEvents } from "../../engine/engine_networking";
import { Object3D } from "three";
import { syncDestroy } from "../../engine/engine_networking_instantiate";
import { Vector3 } from "three";



export class PlayerSync extends Behaviour {
    @serializable(AssetReference)
    asset?: AssetReference;

    private joinedRoomFunction?: Function;

    awake(): void {
        this.watchTabVisible();
        this.joinedRoomFunction = this.onUserJoined.bind(this);
    }

    onEnable(): void {
        this.context.connection.beginListen(RoomEvents.JoinedRoom, this.joinedRoomFunction!)
    }
    onDisable(): void {
        this.context.connection.stopListening(RoomEvents.JoinedRoom, this.joinedRoomFunction!)
    }

    private async onUserJoined(_model) {
        const instance = await this.asset?.instantiateSynced({parent:this.gameObject}, true);
        if (instance) {
            let pl = GameObject.getComponent(instance as Object3D, PlayerState);
            if (pl) {
                pl.owner = this.context.connection.connectionId!;
            }
        }

        // TODO: previously created instances are not re-created when re-joining room
        // const inRoom = this.context.connection.usersInRoom();
        // console.log(inRoom);
        // for (const user of inRoom) {
        //     if(user !== this.context.connection.connectionId) {
        //         console.log(this.context.connection.tryGetState(this.asset.uri))
        //     }
        // }
    }

    private watchTabVisible() {
        window.addEventListener("visibilitychange", _ => {
            if (document.visibilityState === "visible") {
                for (let i = PlayerState.all.length - 1; i >= 0; i--) {
                    const pl = PlayerState.all[i];
                    if (!pl.owner || !this.context.connection.userIsInRoom(pl.owner)) {
                        pl.doDestroy();
                    }
                }
            }
        });
    }
}


export class PlayerState extends Behaviour {

    private static _all: PlayerState[] = [];
    /** all instances for all players */
    static get all(): PlayerState[] {
        return PlayerState._all;
    };

    private static _local: PlayerState[] = [];
    /** all instances for the local player */
    static get local(): PlayerState[] {
        return PlayerState._local;
    }

    //** use to check if a component or gameobject is part of a instance owned by the local player */
    static isLocalPlayer(obj: THREE.Object3D | Component): boolean {
        if (obj instanceof Object3D) {
            return GameObject.getComponentInParent(obj, PlayerState)?.isLocalPlayer ?? false;
        }
        else if (obj instanceof Component) {
            return GameObject.getComponentInParent(obj.gameObject, PlayerState)?.isLocalPlayer ?? false;
        }
        return false;
    }

    @syncField()
    @serializable()
    owner?: string;

    get isLocalPlayer(): boolean {
        return this.owner === this.context.connection.connectionId;
    }

    awake(): void {
        if (this.isLocalPlayer) PlayerState.local.push(this);
        PlayerState.all.push(this);

        this.context.connection.beginListen(RoomEvents.UserLeftRoom, (model: { userId: string }) => {
            // console.log("USER LEFT", model.userId)
            if (model.userId === this.owner) {
                // console.log("LEFT", this.owner)
                this.doDestroy();
                return;
            }
        });
    }

    start() {
        if (!this.owner || !this.context.connection.userIsInRoom(this.owner)) {
            this.doDestroy();
            return;
        }
    }

    doDestroy() {
        syncDestroy(this.gameObject, this.context.connection);
    }

    onDestroy() {
        PlayerState.all.splice(PlayerState.all.indexOf(this), 1);

        if (this.isLocalPlayer) {
            const index = PlayerState._local.indexOf(this);
            if (index >= 0)
                PlayerState._local.splice(index, 1);
        }
    }
}