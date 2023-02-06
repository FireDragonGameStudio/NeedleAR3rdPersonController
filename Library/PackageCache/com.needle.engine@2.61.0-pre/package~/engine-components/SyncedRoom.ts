import { Behaviour } from "./Component";
import * as utils from "../engine/engine_utils"
import { serializable } from "../engine/engine_serialization_decorator";

const viewParamName = "view";
const debug = utils.getParam("debugsyncedroom");

export class SyncedRoom extends Behaviour {

    @serializable()
    public roomName!: string;
    @serializable()
    public urlParameterName: string = "room";
    @serializable()
    public joinRandomRoom: boolean = true;
    @serializable()
    public requireRoomParameter: boolean = false;
    @serializable()
    public autoRejoin: boolean = true;

    private _roomPrefix?: string;

    public get RoomPrefix(): string | undefined {
        return this._roomPrefix;
    }

    awake() {
        if (debug) console.log("Room", this.roomName, this.urlParameterName, this.joinRandomRoom, this.requireRoomParameter, this.autoRejoin);
        if (this._roomPrefix === undefined) {
            this._roomPrefix = this.roomName;
            this.roomName = "";
        }
    }

    onEnable() {
        // if the url contains a view parameter override room and join in view mode
        const viewId = utils.getParam(viewParamName);
        if (viewId && typeof viewId === "string" && viewId.length > 0) {
            console.log("Join as viewer");
            this.context.connection.joinRoom(viewId, true);
            return;
        }
        this.tryJoinRoom();
    }

    onDisable(): void {
        if (this.roomName && this.roomName.length > 0)
            this.context.connection.leaveRoom(this.roomName);
    }

    tryJoinRoom(call: number = 0): boolean {
        if (call === undefined) call = 0;
        let hasRoomParameter = false;
        if (this.urlParameterName) {
            const val = utils.getParam(this.urlParameterName);
            if (val && typeof val === "string") {
                hasRoomParameter = true;
                const roomNameParam = utils.sanitizeString(val);
                this.roomName = roomNameParam;
            }
            else if (this.joinRandomRoom) {
                console.log("No room name found in url, generating random one");
                this.setRandomRoomUrlParameter();
                if (call < 1)
                    return this.tryJoinRoom(call + 1);
            }
        }
        else {
            if (this.joinRandomRoom && (this.roomName === null || this.roomName === undefined || this.roomName.length <= 0)) {
                console.log("generate room name");
                this.roomName = this.generateRoomName();
            }
        }

        if (this.requireRoomParameter && !hasRoomParameter) {
            if (debug)
                console.log("No required room parameter \"" + this.urlParameterName + "\" in url - will not connect to networking backend.");
            return false;
        }

        if (!this.roomName || this.roomName.length <= 0) {
            if (debug)
                console.error("Missing room name on \"" + this.name + "\". Make sure this is correctly configured in Unity", this.context.connection.isDebugEnabled ? this : "");
            return false;
        }

        if (!this.context.connection.isConnected) {
            this.context.connection.connect();
        }

        if (debug) console.log("Join " + this.roomName)

        if (this._roomPrefix)
            this.roomName = this._roomPrefix + this.roomName;

        this.context.connection.joinRoom(this.roomName);
        return true;
    }

    private _lastPingTime: number = 0;
    private _lastRoomTime: number = -1;

    update(): void {
        if (this.context.connection.isConnected) {
            if (this.context.time.time - this._lastPingTime > 3) {
                this._lastPingTime = this.context.time.time;
                // console.log("PING");
                this.context.connection.send("ping", { time: this.context.time.time });
            }

            if (this.context.connection.isInRoom) {
                this._lastRoomTime = this.context.time.time;
            }
        }

        if (this._lastRoomTime > 0 && this.context.time.time - this._lastRoomTime > .3) {
            this._lastRoomTime = -1;

            if (this.autoRejoin) {
                console.log("Disconnected from networking backend - attempt reconnecting now")
                this.tryJoinRoom();
            }
            else
                console.warn("You are not connected to a room anymore (possibly because the tab was inactive for too long and the server kicked you)");
        }
    }

    get currentRoomName(): string | null {
        const view = utils.getParam(viewParamName);
        if (view) return view as string;
        return utils.getParam(this.urlParameterName) as string;
    }

    setRandomRoomUrlParameter() {
        const params = utils.getUrlParams();
        const room = this.generateRoomName();
        // if we already have this parameter
        if (utils.getParam(this.urlParameterName)) {
            params.set(this.urlParameterName, room);
        }
        else
            params.append(this.urlParameterName, room);
        utils.setState(room, params);
    }

    generateRoomName(): string {
        const words = utils.makeIdFromRandomWords();
        const roomName = words + "_" + utils.randomNumber(100, 999);
        return roomName;
    }

    getViewOnlyUrl(): string | null {
        if (this.context.connection.isConnected && this.context.connection.currentRoomViewId) {
            const url = window.location.search;
            const urlParams = new URLSearchParams(url);
            if (urlParams.has(this.urlParameterName))
                urlParams.delete(this.urlParameterName);
            urlParams.set(viewParamName, this.context.connection.currentRoomViewId);
            return window.location.origin + window.location.pathname + "?" + urlParams.toString();
        }


        return null;
    }
}
