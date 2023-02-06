import { Behaviour, GameObject } from "./Component";
import { VideoPlayer } from "./VideoPlayer";
import Peer from "peerjs"
import { Context } from "../engine/engine_setup";
import { RoomEvents } from "../engine/engine_networking";
import { UserJoinedOrLeftRoomModel } from "../engine/engine_networking";
import { serializable } from "../engine/engine_serialization";
import { IPointerClickHandler } from "./ui/PointerEvents";
import { EventDispatcher } from "three";
import { AudioSource } from "./AudioSource";
import { getParam } from "../engine/engine_utils";
import { IModel } from "../engine/engine_networking_types";

const debug = getParam("debugscreenshare");

export enum ScreenCaptureDevice {
    Screen = 0,
    Camera = 1,
    Canvas = 2
}

export enum ScreenCaptureMode {
    Idle = 0,
    Sending = 1,
    Receiving = 2
}

function disposeStream(str: MediaStream | null | undefined) {
    if (!str) return;
    for (const cap of str.getTracks())
        cap.stop();
}

declare type ScreenCaptureOptions = {
    device?: ScreenCaptureDevice,
    deviceId?: string,
    constraints?: MediaTrackConstraints,
}

export class ScreenCapture extends Behaviour implements IPointerClickHandler {

    onPointerClick() {
        if(this.context.connection.isInRoom === false) return;
        if (this.isReceiving) {
            if (this.videoPlayer)
                this.videoPlayer.screenspace = !this.videoPlayer.screenspace;
            return;
        }
        if (this.isSending) {
            this.close();
            return;
        }
        this.share();
    }


    @serializable(VideoPlayer)
    videoPlayer?: VideoPlayer;

    @serializable()
    device: ScreenCaptureDevice = ScreenCaptureDevice.Screen;

    get currentScream(): MediaStream | null {
        return this._currentStream;
    }

    get currentMode(): ScreenCaptureMode {
        return this._currentMode;
    }

    get isSending() {
        return this._currentStream?.active && this._currentMode === ScreenCaptureMode.Sending;
    }
    get isReceiving() {
        if (this._currentMode === ScreenCaptureMode.Receiving) {
            if (!this._currentStream || this._currentStream.active === false) return false;
            // if any track is still live consider it active
            const tracks = this._currentStream.getTracks();
            for (const track of tracks) {
                if (track.readyState === "live") return true;
            }
        }
        return false;
    }

    private _net?: NetworkedVideo;
    private _requestOpen: boolean = false;
    private _currentStream: MediaStream | null = null;
    private _currentMode: ScreenCaptureMode = ScreenCaptureMode.Idle;

    awake() {
        if (debug)
            console.log(this);
        AudioSource.registerWaitForAllowAudio(() => {
            if (this.videoPlayer && this._currentStream && this._currentMode === ScreenCaptureMode.Receiving) {
                this.videoPlayer.setVideo(this._currentStream);
            }
        });
    }

    start() {
        if (!this.videoPlayer) {
            this.videoPlayer = GameObject.getComponent(this.gameObject, VideoPlayer) ?? undefined;
        }
        if (!this.videoPlayer) {
            console.error("Screencapture did not find a VideoPlayer component");
            return;
        }
        const handle = PeerHandle.getOrCreate(this.context, this.guid);
        this._net = new NetworkedVideo(this.context, handle);
        this._net.enable();
        //@ts-ignore
        this._net.addEventListener(PeerEvent.ReceiveVideo, this.onReceiveVideo.bind(this));
    }

    async share(opts?: ScreenCaptureOptions) {

        if (opts?.device)
            this.device = opts.device;

        this._requestOpen = true;
        try {
            if (this.videoPlayer) {

                const settings: MediaTrackConstraints = opts?.constraints ?? {
                    echoCancellation: true,
                    autoGainControl: false,
                };
                const displayMediaOptions: MediaStreamConstraints = {
                    video: settings,
                    audio: settings,
                };

                switch (this.device) {
                    // Capture a connected camera
                    case ScreenCaptureDevice.Camera:
                        this.tryShareUserCamera(displayMediaOptions, opts);
                        break;

                    // capture any screen, will show a popup
                    case ScreenCaptureDevice.Screen:
                        if (!navigator.mediaDevices.getDisplayMedia) {
                            console.error("No getDisplayMedia support");
                            return;
                        }
                        const myVideo = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
                        if (this._requestOpen) {
                            this.setVideo(myVideo, ScreenCaptureMode.Sending);
                        }
                        else disposeStream(myVideo);
                        break;

                    // capture the canvas meaning the threejs view
                    case ScreenCaptureDevice.Canvas:
                        // looks like this doesnt work reliably on chrome https://stackoverflow.com/a/66848674
                        // firefox updates fine
                        // https://bugs.chromium.org/p/chromium/issues/detail?id=1156408
                        const fps = 0;
                        const stream = this.context.renderer.domElement.captureStream(fps);
                        this.setVideo(stream, ScreenCaptureMode.Sending);
                        break;
                }
            }
        } catch (err: any) {
            if (err.name === "NotAllowedError") {
                // user cancelled stream selection
                console.log("Selection cancelled");
                this._requestOpen = false;
                return;
            }
            console.error("Error opening video", err);
        }
    }

    close() {
        this._requestOpen = false;
        if (this._currentStream) {
            console.warn("Close current stream / disposing resources");
            this._net?.stopSendingVideo(this._currentStream);
            disposeStream(this._currentStream);
            this._currentMode = ScreenCaptureMode.Idle;
            this._currentStream = null;
        }
    }

    private setVideo(stream: MediaStream, mode: ScreenCaptureMode) {
        if (stream === this._currentStream) return;
        this.close();
        if (!stream || !this.videoPlayer) return;
        this._currentStream = stream;
        this._requestOpen = true;
        this._currentMode = mode;
        this.videoPlayer.setVideo(stream);

        const isSending = mode === ScreenCaptureMode.Sending;
        if (isSending) {
            this._net?.startSendingVideo(stream);

        }

        stream.addEventListener("ended", () => {
            this.close();
        });
    }

    private onReceiveVideo(evt: ReceiveVideoEvent) {
        this.setVideo(evt.stream, ScreenCaptureMode.Receiving);
    }



    private async tryShareUserCamera(opts: MediaStreamConstraints, options?: ScreenCaptureOptions) {

        // let newWindow = open('', 'example', 'width=300,height=300');
        // if (window) {
        //     newWindow!.document.body.innerHTML = "Please allow access to your camera and microphone";
        // }

        // TODO: allow user to select device
        const devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "videoinput");
        console.log("Request camera", devices);
        for (const dev of devices) {
            try {
                if (!this._requestOpen) break;
                if (dev.kind !== "videoinput") continue;
                const id = dev.deviceId;
                if (options?.deviceId !== undefined) {
                    if (id !== options.deviceId)
                        continue;
                }
                if (opts.video !== false) {
                    if (typeof opts.video === "undefined" || typeof opts.video === "boolean") {
                        opts.video = {};
                    }
                    opts.video.deviceId = id;
                }
                const userMedia = await navigator.mediaDevices.getUserMedia(opts);
                if (this._requestOpen) {
                    this.setVideo(userMedia, ScreenCaptureMode.Sending);
                }
                else disposeStream(userMedia);
                console.log("Selected camera", dev);
                break;
            }
            catch (err) {
                console.warn(err);
            }
        }
    }
    // private _cameraSelectionWindow : Window | null = null;
    // private openWindowToSelectCamera(){

    // }
}


/////// PEER

enum PeerEvent {
    Connected = "peer-user-connected",
    ReceiveVideo = "receive-video",
    Disconnected = "peer-user-disconnected",
}

class ReceiveVideoEvent {
    readonly type = PeerEvent.ReceiveVideo;
    readonly stream: MediaStream;
    readonly target: CallHandle;
    constructor(stream: MediaStream, target: CallHandle) {
        this.stream = stream
        this.target = target;
    }
}

class PeerUserConnectedModel implements IModel {
    /** the peer handle id */
    readonly guid: string;
    readonly peerId: string;
    // internal so server doesnt save it to persistent storage
    readonly dontSave: boolean = true;
    constructor(handle: PeerHandle, peerId: string) {
        this.guid = handle.id;
        this.peerId = peerId;
    }
}

enum CallDirection {
    Incoming = "incoming",
    Outgoing = "outgoing",
}

class CallHandle extends EventDispatcher {
    readonly userId: string;
    readonly direction: CallDirection;
    readonly call: Peer.MediaConnection;
    get stream() { return this._stream; };

    private _stream: MediaStream | null = null;
    private _isDisposed: boolean = false;

    close() {
        if (this._isDisposed) return;
        this._isDisposed = true;
        this.call.close();
        disposeStream(this._stream);
    }

    get isOpen() {
        return this.call.peerConnection?.connectionState === "connected";// && this._stream?.active;
    }

    get isClosed() {
        return !this.isOpen;
    }

    constructor(userId: string, call: Peer.MediaConnection, direction: CallDirection) {
        super();
        this.userId = userId;
        this.call = call;
        this.direction = direction;
        this._stream = null;
        call.on("stream", stream => {
            console.log("Receive video", stream.getAudioTracks(), stream.getVideoTracks());
            this._stream = stream;
            if (direction === CallDirection.Incoming) {
                const args: ReceiveVideoEvent = new ReceiveVideoEvent(stream, this);
                this.dispatchEvent(args);
            }
        });
    }
}

class PeerHandle extends EventDispatcher {

    private static readonly instances: Map<string, PeerHandle> = new Map();

    static getOrCreate(context: Context, guid: string): PeerHandle {
        // if (id === undefined) {
        //     // randomId
        //     id = Math.random().toFixed(5);
        // }
        if (PeerHandle.instances.has(guid))
            return PeerHandle.instances.get(guid)!;
        const peer = new PeerHandle(context, guid);
        PeerHandle.instances.set(guid, peer);
        return peer;
    }

    getMyPeerId(): string | undefined {
        if (this.context.connection.connectionId)
            return this.getPeerIdFromUserId(this.context.connection.connectionId);
        return undefined;
    }

    getPeerIdFromUserId(userConnectionId: string): string {
        // we build the peer id ourselves so we dont need to wait for peer to report it
        return this.id + "-" + userConnectionId;
    }

    getUserIdFromPeerId(peerId: string): string {
        return peerId.substring(this.id.length + 1);
    }

    makeCall(peerId: string, stream: MediaStream): CallHandle | undefined {
        const opts = { metadata: { userId: this.context.connection.connectionId } };
        const call = this._peer?.call(peerId, stream, opts);
        if (call)
            return this.registerCall(call, CallDirection.Outgoing);
        return undefined;
    }

    get peer(): Peer | undefined { return this._peer; }

    readonly id: string;
    readonly context: Context;
    private _peer: Peer | undefined;
    private _incomingCalls: CallHandle[] = [];
    private _outgoingCalls: CallHandle[] = [];

    private constructor(context: Context, id: string) {
        super();
        this.context = context;
        this.id = id;
        this.setupPeer();
        navigator["getUserMedia"] = (
            navigator["getUserMedia"] || navigator["webkitGetUserMedia"] ||
            navigator["mozGetUserMedia"] || navigator["msGetUserMedia"]
        );
    }

    private _enabled: boolean = false;
    private _enabledPeer: boolean = false;
    private onConnectRoomFn: Function = this.onConnectRoom.bind(this);
    private onUserJoinedOrLeftRoomFn: Function = this.onUserJoinedOrLeftRoom.bind(this);
    private onPeerConnectFn: (id) => void = this.onPeerConnect.bind(this);
    private onPeerReceiveCallFn: (call) => void = this.onPeerReceivingCall.bind(this);
    // private _connectionPeerIdMap : Map<string, string> = new Map();

    enable() {
        if (this._enabled) return;
        this._enabled = true;
        this.context.connection.beginListen(RoomEvents.JoinedRoom, this.onConnectRoomFn);
        this.context.connection.beginListen(RoomEvents.UserJoinedRoom, this.onUserJoinedOrLeftRoomFn);
        this.context.connection.beginListen(RoomEvents.UserLeftRoom, this.onUserJoinedOrLeftRoomFn);
        this.subscribePeerEvents();
    }

    disable() {
        if (!this._enabled) return;
        this._enabled = false;
        this.context.connection.stopListening(RoomEvents.JoinedRoom, this.onConnectRoomFn);
        this.context.connection.stopListening(RoomEvents.UserJoinedRoom, this.onUserJoinedOrLeftRoomFn);
        this.context.connection.stopListening(RoomEvents.UserLeftRoom, this.onUserJoinedOrLeftRoomFn);
        this.unsubscribePeerEvents();
    }

    private onConnectRoom(): void {
        this.setupPeer();
    };

    private onUserJoinedOrLeftRoom(_: UserJoinedOrLeftRoomModel): void {
    };

    private setupPeer() {
        if (!this.context.connection.connectionId) return;
        if (this._enabledPeer) return;
        this._enabledPeer = true;
        if (!this._peer) {
            const peerId = this.getMyPeerId();
            this._peer = new Peer(peerId);
        }
        if (this._enabled)
            this.subscribePeerEvents();
    }

    private subscribePeerEvents() {
        if (!this._peer) return;
        this._peer.on("open", this.onPeerConnectFn);
        this._peer.on("call", this.onPeerReceiveCallFn);
        // this.context.connection.beginListen(PeerEvent.Connected, this.onRemotePeerConnect.bind(this));
    }

    private unsubscribePeerEvents() {
        // TODO: unsubscribe
    }

    private onPeerConnect(id): void {
        if (debug)
            console.log("Peer connected as", id);
        this.context.connection.send(PeerEvent.Connected, new PeerUserConnectedModel(this, id));
    }

    private onPeerReceivingCall(call: Peer.MediaConnection): void {
        call.answer();
        this.registerCall(call, CallDirection.Incoming);
    }

    private registerCall(call: Peer.MediaConnection, direction: CallDirection): CallHandle {

        const meta = call.metadata;
        if (!meta || !meta.userId) {
            console.error("Missing call metadata", call);
        }
        const userId = meta.userId;

        if (direction === CallDirection.Incoming) console.log("Receive call from", call.metadata);
        else console.log("Make call to", call.metadata);

        const arr = direction === CallDirection.Incoming ? this._incomingCalls : this._outgoingCalls;
        const handle = new CallHandle(userId, call, direction);
        arr.push(handle);
        call.on("error", err => {
            console.error("Call error", err);
        });
        call.on("close", () => {
            console.log("Call ended", call.metadata);
            call.close();
            const index = arr.indexOf(handle);
            if (index !== -1)
                arr.splice(index, 1);
        });

        if (direction === CallDirection.Incoming) {

            handle.addEventListener(PeerEvent.ReceiveVideo, e => {
                this.dispatchEvent(e);
            });

            call.on("stream", () => {
                // workaround for https://github.com/peers/peerjs/issues/636
                let closeInterval = setInterval(() => {
                    if (!handle.isOpen) {
                        clearInterval(closeInterval);
                        handle.close();
                    }
                }, 2000);
            });
        }
        return handle;
    }

    // private onRemotePeerConnect(user: PeerUserConnectedModel) {
    //     console.log("other user connected", user);
    // }
}


// type UserVideoCall = {
//     call: Peer.MediaConnection;
//     stream: MediaStream;
//     userId: string;
// }

// type IncomingStreamArgs = {
//     stream: MediaStream;
//     userId: string;
// }

class NetworkedVideo extends EventDispatcher {

    private readonly context: Context;
    private readonly peer: PeerHandle;

    // private _receiveVideoStreamListeners: Array<(info: IncomingStreamArgs) => void> = [];
    private _sendingVideoStreams: Map<MediaStream, CallHandle[]> = new Map();

    constructor(context: Context, peer: PeerHandle) {
        super();
        this.context = context;
        this.peer = peer;
    }

    startSendingVideo(stream: MediaStream) {
        if (!this._sendingVideoStreams.has(stream)) {
            this._sendingVideoStreams.set(stream, []);
            this.updateSendingCalls();
        };
    }

    stopSendingVideo(_steam: MediaStream | undefined | null) {
        if (_steam) {
            const calls = this._sendingVideoStreams.get(_steam);
            if (calls) {
                console.log("Closing calls", calls);
                for (const call of calls) {
                    call.close();
                }
            }
            this._sendingVideoStreams.delete(_steam);
            if (calls)
                console.log("Currently sending", this._sendingVideoStreams);
        }
    }

    private onConnectRoomFn: Function = this.onConnectRoom.bind(this);
    private onUserConnectedFn: Function = this.onUserConnected.bind(this);
    private onUserLeftFn: Function = this.onUserLeft.bind(this);

    enable() {
        this.peer.enable();
        this.context.connection.beginListen(PeerEvent.Connected, this.onUserConnectedFn);
        this.peer.addEventListener("receive-video", this.onReceiveVideo.bind(this));
    }

    disable() {
        this.peer.disable();
        // this.context.connection.stopListening(RoomEvents.UserJoinedRoom, this.onUserConnectedFn);
        // this.context.connection.stopListening(RoomEvents.UserLeftRoom, this.onUserLeftFn);
    }

    private onReceiveVideo(evt) {
        console.log("RECEIVE VIDEO", evt);
        this.dispatchEvent({ type: "receive-video", target: this, stream: evt.stream, userId: evt.userId });
    }

    private onConnectRoom() {

    }

    private onUserConnected(user: PeerUserConnectedModel) {
        // console.log(this.peer.id, user.guid)
        if (this.peer.id === user.guid) {
            console.log("USER CONNECTED", user);
            const stream = this._sendingVideoStreams.keys().next().value;
            this.peer.makeCall(user.peerId, stream);
        }
    }

    private onUserLeft(_: UserJoinedOrLeftRoomModel) {
        this.stopCallsToUsersThatAreNotInTheRoomAnymore();
    }

    private updateSendingCalls() {
        let startedNewCall = false;
        for (const stream of this._sendingVideoStreams.keys()) {
            const calls = this._sendingVideoStreams.get(stream) || [];
            for (const userId of this.context.connection.usersInRoom()) {
                if (userId === this.context.connection.connectionId) continue;
                const existing = calls.find(c => c.userId === userId);
                if (!existing) {
                    const handle = this.peer.makeCall(this.peer.getPeerIdFromUserId(userId), stream);
                    if (handle) {
                        startedNewCall = true;
                        calls.push(handle);
                    }
                }
            }

            this._sendingVideoStreams.set(stream, calls);
        }
        this.stopCallsToUsersThatAreNotInTheRoomAnymore();
        if (startedNewCall) {
            console.log("Currently sending", this._sendingVideoStreams);
        }
    }

    private stopCallsToUsersThatAreNotInTheRoomAnymore() {
        for (const stream of this._sendingVideoStreams.keys()) {
            const calls = this._sendingVideoStreams.get(stream);
            if (!calls) continue;
            for (let i = calls.length - 1; i >= 0; i--) {
                const call = calls[i];
                if (!this.context.connection.userIsInRoom(call.userId)) {
                    call.close();
                    calls.splice(i, 1);
                }
            }
        }
    }

    // const call = peer.call(peerId, stream);
}
