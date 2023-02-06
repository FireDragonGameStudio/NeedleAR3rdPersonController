// import geckos, { ClientChannel, Data } from '@geckos.io/client';

// const serverUrl = 'wss://tiny-server-1-r26roub2hq-ew.a.run.app/';
let serverUrl = 'wss://needle-tiny-starter.glitch.me/socket';

import { Websocket, WebsocketBuilder } from 'websocket-ts';
// import { Networking } from '../engine-components/Networking';
import { Context } from './engine_setup';
import * as utils from "./engine_utils";
import * as flatbuffers from 'flatbuffers';
import * as schemes from "../engine-schemes/schemes";
import { PeerNetworking } from './engine_networking_peer';
import { IModel, INetworkConnection, SendQueue } from './engine_networking_types';
import { isHostedOnGlitch } from './engine_networking_utils';

export const debugNet = utils.getParam("debugnet") ? true : false;
export const debugOwner = debugNet || utils.getParam("debugowner") ? true : false;

export interface INetworkingWebsocketUrlProvider {
    getWebsocketUrl(): string | null;
}

export declare interface IConnectionData {
    id: string;
}

declare type WebsocketMessage = {
    key: string,
    data: IModel | IConnectionData | undefined;
    room: string | undefined;
}

export enum ConnectionEvents {
    ConnectionInfo = "connection-start-info"
}

export enum RoomEvents {
    Join = "join-room",
    Leave = "leave-room",
    JoinedRoom = "joined-room",
    LeftRoom = "left-room",
    UserJoinedRoom = "user-joined-room",
    UserLeftRoom = "user-left-room",
}

export class JoinedRoomResponse {
    room!: string; // room name
    viewId!: string;
    allowEditing!: boolean;
    inRoom!: string[]; // connection ids
}

export class LeftRoomResponse {
    room!: string; // room name
}

export class UserJoinedOrLeftRoomModel {
    userId!: string;
}

export enum OwnershipEvent {
    RequestHasOwner = 'request-has-owner',
    ResponseHasOwner = "response-has-owner",
    RequestIsOwner = 'request-is-owner',
    ResponseIsOwner = "response-is-owner",
    RequestOwnership = "request-ownership",
    GainedOwnership = 'gained-ownership',
    RemoveOwnership = "remove-ownership",
    LostOwnership = 'lost-ownership',
    GainedOwnershipBroadcast = 'gained-ownership-broadcast',
    LostOwnershipBroadcast = 'lost-ownership-broadcast',
}

declare type GainedOwnershipBroadcastResponse = {
    guid: string;
    owner: string;
}
declare type LostOwnershipBroadcastResponse = {
    guid: string;
    owner: string;
}

declare type OwnershipResponse = {
    guid: string;
    value: boolean;
}

export class OwnershipModel {

    public guid: string;
    private connection: NetworkConnection;

    public get hasOwnership(): boolean {
        return this._hasOwnership;
    }

    // TODO: server should just send id to everyone

    // if anyone has ownership
    public get isOwned(): boolean | undefined {
        return this._isOwned;
    }

    public get isConnected(): boolean {
        return this.connection.isConnected;
    }

    private _hasOwnership: boolean = false;
    private _isOwned: boolean | undefined = undefined;
    private _gainSubscription: Function;
    private _lostSubscription: Function;
    private _hasOwnerResponse: Function;

    constructor(connection: NetworkConnection, guid: string) {
        this.connection = connection;
        this.guid = guid;
        this._gainSubscription = this.onGainedOwnership.bind(this);
        this._lostSubscription = this.onLostOwnership.bind(this);
        connection.beginListen(OwnershipEvent.LostOwnership, this._lostSubscription);
        connection.beginListen(OwnershipEvent.GainedOwnershipBroadcast, this._gainSubscription);

        this._hasOwnerResponse = this.onHasOwnerResponse.bind(this);
        connection.beginListen(OwnershipEvent.ResponseHasOwner, this._hasOwnerResponse);
    }

    private _isWaitingForOwnershipResponseCallback: Function | null = null;

    public updateIsOwned() {
        this.connection.send(OwnershipEvent.RequestHasOwner, { guid: this.guid });
    }

    private onHasOwnerResponse(res: OwnershipResponse) {
        if (res.guid === this.guid) {
            this._isOwned = res.value;
        }
    }

    public requestOwnershipIfNotOwned(): OwnershipModel {
        if (this._isWaitingForOwnershipResponseCallback !== null) return this;
        this._isWaitingForOwnershipResponseCallback = this.waitForHasOwnershipRequestResponse.bind(this);
        this.connection.beginListen(OwnershipEvent.ResponseHasOwner, this._isWaitingForOwnershipResponseCallback);
        this.connection.send(OwnershipEvent.RequestHasOwner, { guid: this.guid });
        return this;
    }

    private waitForHasOwnershipRequestResponse(res: OwnershipResponse) {
        // console.log(res);
        if (res.guid === this.guid) {
            if (this._isWaitingForOwnershipResponseCallback) {
                this.connection.stopListening(OwnershipEvent.ResponseHasOwner, this._isWaitingForOwnershipResponseCallback);
                this._isWaitingForOwnershipResponseCallback = null;
            }
            this._isOwned = res.value;
            if (!res.value) {
                if (debugOwner)
                    console.log("request ownership", this.guid)
                this.requestOwnership();
            }
        }
    }


    public requestOwnershipAsync(): Promise<OwnershipModel> {
        return new Promise((resolve, reject) => {
            this.requestOwnership();
            let updates = 0;
            const waitForOwnership = () => {
                if (updates++ > 10) return reject("Timeout");
                setTimeout(() => {
                    if (this.hasOwnership) resolve(this);
                    else waitForOwnership();
                }, 100);
            };
            waitForOwnership();
        });
    }

    public requestOwnership(): OwnershipModel {
        if (debugOwner) console.log("Request ownership", this.guid);
        this.connection.send(OwnershipEvent.RequestOwnership, { guid: this.guid });
        return this;
    }

    public freeOwnership(): OwnershipModel {
        // TODO: abort "requestOwnershipIfNotOwned"
        this.connection.send(OwnershipEvent.RemoveOwnership, { guid: this.guid });
        if (this._isWaitingForOwnershipResponseCallback) {
            this.connection.stopListening(OwnershipEvent.ResponseHasOwner, this._isWaitingForOwnershipResponseCallback);
            this._isWaitingForOwnershipResponseCallback = null;
        }
        return this;
    }

    public destroy() {
        this.connection.stopListening(OwnershipEvent.GainedOwnership, this._gainSubscription);
        this.connection.stopListening(OwnershipEvent.LostOwnership, this._lostSubscription);
        this.connection.stopListening(OwnershipEvent.ResponseHasOwner, this._hasOwnerResponse);
        if (this._isWaitingForOwnershipResponseCallback) {
            this.connection.stopListening(OwnershipEvent.ResponseHasOwner, this._isWaitingForOwnershipResponseCallback);
            this._isWaitingForOwnershipResponseCallback = null;
        }
    }

    private onGainedOwnership(res: GainedOwnershipBroadcastResponse) {
        if (res.guid === this.guid) {
            this._isOwned = true;
            // console.log(res.owner, connection.connectionId)
            if (this.connection.connectionId === res.owner) {
                if (debugOwner)
                    console.log("GAINED OWNERSHIP", this.guid)
                this._hasOwnership = true;
            }
            else this._hasOwnership = false;
        }
    }
    private onLostOwnership(guid: string) {
        if (guid === this.guid) {
            if (debugOwner)
                console.log("LOST OWNERSHIP", this.guid)
            this._hasOwnership = false;
            this._isOwned = false;
        }
    }
}


export declare type BinaryCallback = {
    (data: any | flatbuffers.ByteBuffer): void;
}

export class NetworkConnection implements INetworkConnection {

    private context: Context;
    private _peer: PeerNetworking | null = null;

    constructor(context: Context) {
        this.context = context;
    }

    public get peer(): PeerNetworking {
        if (!this._peer) {
            this._peer = new PeerNetworking();
        }
        return this._peer;
    }

    public tryGetState(guid: string): IModel | null {
        if (guid === "invalid") return null;
        return this._state[guid];
    }

    public get connectionId(): string | null {
        return this._connectionId;
    }

    public get isDebugEnabled(): boolean {
        return debugNet;
    }

    public get isConnected(): boolean {
        return this.connected;
    }

    public get currentRoomName(): string | null { return this._currentRoomName; }
    public get allowEditing(): boolean { return this._currentRoomAllowEditing; }
    // use this to join a room in view mode (see SyncedRoom)
    public get currentRoomViewId(): string | null { return this._currentRoomViewId; }

    public get isInRoom(): boolean {
        return this._isInRoom;
    }

    public get currentLatency(): number {
        return this._currentDelay;
    }

    public userIsInRoom(id: string): boolean {
        return this._currentInRoom.indexOf(id) !== -1;
    }

    private _usersInRoomCopy = [];
    public usersInRoom(target: string[] | null = null): string[] {
        if (!target) target = this._usersInRoomCopy;
        target.length = 0;
        for (const user of this._currentInRoom)
            target.push(user);
        return target;
    }

    public joinRoom(room: string, viewOnly: boolean = false) {
        this.connect();

        if (debugNet)
            console.log("join: " + room);
        this.send(RoomEvents.Join, { room: room, viewOnly: viewOnly }, SendQueue.OnConnection);
    }

    public leaveRoom(room: string | null = null) {
        if (!room) room = this.currentRoomName;
        if (!room) {
            console.error("Can not leave unknown room");
            return;
        }
        this.send(RoomEvents.Leave, { room: room });
    }

    public send(key: string | OwnershipEvent, data: IModel | object | boolean | null | string | number = null, queue: SendQueue = SendQueue.Queued) {

        if (data === null) data = {};

        if (queue === SendQueue.Queued) {
            this._defaultMessagesBuffer.push({ key: key, value: data });
            return;
        }

        // if (!this.connected) return;
        // if (this.channelId)
        //     data["__id"] = this.channelId;
        // else if (this.connectionId)
        //     data["__id"] = this.connectionId;
        // this.sendGeckosIo(key, data);
        return this.sendWithWebsocket(key, data, queue);
    }

    public sendDeleteRemoteState(guid: string) {
        this.send("delete-state", { guid: guid, dontSave: true });
        delete this._state[guid];
    }

    public sendDeleteRemoteStateAll(){
        this.send("delete-all-state");
        this._state = {};
    }

    public sendBinary(bin: Uint8Array) {
        if (debugNet) console.log("<< bin", bin.length);
        this._ws?.send(bin);
    }

    private _defaultMessagesBuffer: Array<{ key: string, value: any }> = [];
    private _defaultMessagesBufferArray: Array<{ key: string, data: any }> = [];
    public sendBufferedMessagesNow() {
        if (!this._ws) return;
        this._defaultMessagesBufferArray.length = 0;
        const count = Object.keys(this._defaultMessagesBuffer).length;
        for (const key in this._defaultMessagesBuffer) {
            const data = this._defaultMessagesBuffer[key];
            // if there is only one message to be sent we dont need to send an array
            if (count <= 1) {
                this.sendWithWebsocket(data.key, data.value, SendQueue.Immediate);
                break;
            }
            const msg = this.toMessage(data.key, data.value);
            this._defaultMessagesBufferArray.push(msg);
        }
        this._defaultMessagesBuffer.length = 0;
        if (this._defaultMessagesBufferArray.length > 0 && debugNet)
            console.log("SEND BUFFERED", this._defaultMessagesBufferArray.length);
        if (this._defaultMessagesBufferArray.length <= 0) return;
        const message = JSON.stringify(this._defaultMessagesBufferArray);
        this._ws?.send(message);
    }

    public beginListen(key: string | OwnershipEvent, callback: Function): Function {
        if (!this._listeners[key])
            this._listeners[key] = [];
        this._listeners[key].push(callback);
        return callback;
    }

    public stopListening(key: string | OwnershipEvent, callback: Function | null) {
        if (!callback) return;
        if (!this._listeners[key]) return;
        const index = this._listeners[key].indexOf(callback);
        if (index >= 0) {
            this._listeners[key].splice(index, 1);
        }
    }

    public beginListenBinrary(identifier: string, callback: BinaryCallback): BinaryCallback {
        if (!this._listenersBinary[identifier])
            this._listenersBinary[identifier] = [];
        this._listenersBinary[identifier].push(callback);
        return callback;
    }

    public stopListenBinary(identifier: string, callback: any) {
        if (!this._listenersBinary[identifier]) return;
        const index = this._listenersBinary[identifier].indexOf(callback);
        if (index >= 0) {
            this._listenersBinary[identifier].splice(index, 1);
        }
    }

    private netWebSocketUrlProvider?: INetworkingWebsocketUrlProvider;

    public registerProvider(prov: INetworkingWebsocketUrlProvider) {
        this.netWebSocketUrlProvider = prov;
    }

    public connect() {
        if (this.connected) return;
        if (debugNet)
            console.log("connecting");
        // this.channel = geckos({ port: 9208, url: 'http://127.0.0.1' });
        // this.channel.onConnect(this.onConnectGeckosIo.bind(this));
        // const networking = GameObject.findObjectOfType(Networking, this.context, false);
        const overrideUrl = this.netWebSocketUrlProvider?.getWebsocketUrl();
        if (overrideUrl) {
            serverUrl = overrideUrl;
        }
        else if(isHostedOnGlitch()) {
            serverUrl = "wss://" + window.location.host + "/socket";
        }
        this.connectWebsocket();
    };

    private _listeners: { [key: string]: Function[] } = {};
    private _listenersBinary: { [key: string]: BinaryCallback[] } = {};
    private connected: boolean = false;
    private channelId: string | undefined;
    private _connectionId: string | null = null;

    // Websocket ------------------------------------------------------------
    private _isConnectingToWebsocket: boolean = false;
    private _ws: Websocket | undefined;
    private _waitingForSocket: { [key: string]: Array<Function> } = {};
    private _isInRoom: boolean = false;
    private _currentRoomName: string | null = null;
    private _currentRoomViewId: string | null = null;
    private _currentRoomAllowEditing: boolean = true;
    private _currentInRoom: string[] = [];
    private _state: { [key: string]: any } = {};
    private _currentDelay: number = -1;

    private connectWebsocket() {
        if (this._isConnectingToWebsocket) return;
        this._isConnectingToWebsocket = true;
        console.log("Connecting to " + serverUrl)
        const ws = new WebsocketBuilder(serverUrl)
            .onOpen(() => {
                this._ws = ws;
                this._isConnectingToWebsocket = false;
                this.connected = true;
                console.log("Connected to websocket");
                this.onSendQueued(SendQueue.OnConnection);
            })
            .onClose((_evt) => {
                this.connected = false;
                this._isInRoom = false;
            })
            .onError((i, ev) => { console.error(i, ev) })
            .onMessage(this.onMessage.bind(this))
            .onRetry(() => { console.log("websocket connection retry") })
            .build();
    }

    private onMessage(_, ev) {
        const msg = ev.data;
        try {
            if (typeof msg !== "string") {
                if (msg.size) {
                    // is binary blob
                    this.handleIncomingBinaryMessage(msg);
                }
                return;
            }
            const message: WebsocketMessage | Array<WebsocketMessage> = JSON.parse(msg);
            if (Array.isArray(message)) {
                // console.log("Receive package of " + message.length + " messages")
                for (const msg of message) {
                    this.handleIncomingStringMessage(msg);
                }
            }
            else this.handleIncomingStringMessage(message);
            return;
        }
        catch {
            if (debugNet && msg === "pong") console.log("<<", msg);
        }
    }

    private async handleIncomingBinaryMessage(blob: Blob) {
        const buf = await blob.arrayBuffer();
        var data = new Uint8Array(buf);
        const bb = new flatbuffers.ByteBuffer(data);
        const id = bb.getBufferIdentifier();
        const callbacks = this._listenersBinary[id];
        // use registered cast methods to get the correct type from the flatbuffer
        const obj = schemes.tryCast(bb);
        const guid = schemes.tryGetGuid(obj);
        if (guid && typeof guid === "string") {
            this._state[guid] = obj;
        }
        if (!callbacks) return;
        const res = obj ?? bb; // fallback to bytebuffer if no cast method is registered
        // call all listeners subscribed to these events
        for (const cb of callbacks) {
            cb(res);
        }
    }

    private handleIncomingStringMessage(message: WebsocketMessage) {

        if (debugNet) console.log("<<", message.key ?? message);
        if (message.key) {
            switch (message.key) {
                case ConnectionEvents.ConnectionInfo:
                    if (message.data) {
                        const connection = message.data as IConnectionData;
                        if (connection) {
                            console.assert(connection.id !== undefined && connection.id !== null && connection.id.length > 0,
                                "server did not send connection id", connection.id);
                            // if (debugNet) 
                            console.log("Your id is: " + connection.id, this.context.alias ?? "");
                            this._connectionId = connection.id;
                        }
                    }
                    else console.warn("Expected connection id in " + message.key);
                    break;
                case RoomEvents.JoinedRoom:
                    if (debugNet)
                        console.log(message);
                    if (message) {
                        this._isInRoom = true;
                        const model = message as unknown as JoinedRoomResponse;
                        this._currentRoomName = model.room;
                        this._currentRoomViewId = model.viewId;
                        this._currentRoomAllowEditing = model.allowEditing ?? true;
                        console.log("Room view id", this._currentRoomViewId);
                        this._currentInRoom.length = 0;
                        this._currentInRoom.push(...model.inRoom);
                        if (debugNet)
                            console.log("joined room with", this._currentInRoom, this.context.alias ?? "");
                    }

                    this.onSendQueued(SendQueue.OnRoomJoin);
                    break;

                case RoomEvents.LeftRoom:
                    const model = message as unknown as LeftRoomResponse;
                    if (model.room === this.currentRoomName) {
                        this._isInRoom = false;
                        this._currentRoomName = null;
                        this._currentInRoom.length = 0;
                    }
                    break;
                case RoomEvents.UserJoinedRoom:
                    if (message.data) {
                        const model = message.data as unknown as UserJoinedOrLeftRoomModel;
                        this._currentInRoom.push(model.userId);
                        if (debugNet)
                            console.log(model.userId + " joined", "now in room:", this._currentInRoom);
                    }
                    break;
                case RoomEvents.UserLeftRoom:
                    if (message.data) {
                        const model = message.data as unknown as UserJoinedOrLeftRoomModel;
                        const index = this._currentInRoom.indexOf(model.userId);
                        if (index >= 0) {
                            console.log(model.userId + " left", this.context.alias ?? "");
                            this._currentInRoom.splice(index, 1);
                        }
                        if (model.userId === this.connectionId) {
                            // you left the room
                            console.log("you left the room");
                        }
                    }
                    break;

                case "all-room-state-deleted":
                    if(debugNet) console.log("RECEIVED all-room-state-deleted");
                    this._state = {};
                    break;

                case "ping":
                case "pong":
                    const time = (message as any).data?.time;
                    if (time) {
                        this._currentDelay = this.context.time.time - time;
                    }
                    if (debugNet)
                        console.log("Current latency: " + this._currentDelay.toFixed(1) + " sec", "Clients in room: " + this._currentInRoom?.length);
                    break;
            }
        }

        const listeners = this._listeners[message.key];
        if (listeners) {
            for (const listener of listeners) {
                listener(message.data);
            }
        }

        const model = message.data as IModel;
        if (model) {
            this._state[model.guid] = model;
        }
    }

    private toMessage(key: string, data: any) {
        return {
            key: key,
            data: data
        };
    }

    private sendWithWebsocket(key: string, data: IModel | object | boolean | string | number, queue: SendQueue = SendQueue.OnRoomJoin) {
        // console.log(key);
        if (!this._ws) {
            const arr = this._waitingForSocket[queue] || [];
            arr.push(() => this.sendWithWebsocket(key, data, queue));
            this._waitingForSocket[queue] = arr;
            // console.log(this._bufferedMessages)
            return;
        }
        const str = JSON.stringify(this.toMessage(key, data));
        if (debugNet) console.log(">>", key);
        this._ws.send(str);
    }

    private onSendQueued(queue: SendQueue) {
        const queued = this._waitingForSocket[queue];
        // console.log("send", queue, queued);
        if (queued) {
            for (const callback of queued) {
                callback();
            }
            queued.length = 0;
        }
    }


}