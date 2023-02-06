
import { Behaviour } from "./Component";
import * as THREE from "three";
import { RoomEvents } from "../engine/engine_networking"
import Peer, { MediaConnection } from "peerjs"
import { AudioSource } from "./AudioSource";
import * as utils from "../engine/engine_utils"
import { AudioAnalyser } from "three";
import { SendQueue } from "../engine/engine_networking_types";

export const noVoip = "noVoip";
const debug = utils.getParam("debugvoip");
const allowVoip = utils.getParam("voip");

enum PeerMessage {
    Update_ID = "peer-update-id",
}

class PeerModel {
    id: string;

    constructor(id: string) {
        this.id = id;
    }
}

interface IPeerUpdateResponse {
    id: string; // user id 
    peerId: string; // peer id
}

enum PeerDebugOptions {
    None = 0,
    Errors = 1,
    ErrorsAndWarnings = 2,
    All = 3
}

class PeerConnection {
    private readonly peer: Peer;
    private voip: Voip;
    private userId: string;
    private peerId: string;
    private call: MediaConnection | null = null;
    private callErrorListener: ((error: Error) => void) | null = null;
    private stream: MediaStream | null = null;

    constructor(voip: Voip, peer: Peer, userId: string, peerId: string) {
        this.voip = voip;
        this.peer = peer;
        this.userId = userId;
        this.peerId = peerId;
    }

    public close() {
        if (debug)
            console.log("close voip call");
        if (this.callErrorListener)
            this.peer.off("error", this.callErrorListener);
        if (this.call && this.call.open)
            this.call.close();
        this.stream?.getTracks().forEach(function (track) {
            track.stop();
        });
    }

    public updateMute(mute: boolean) {
        if (!this.stream) return;
        const tracks = this.stream?.getAudioTracks();
        for (const track of tracks) {
            track.enabled = !mute;
        }
    }

    public async startVoipCall() {

        const res = await Voip.HasMicrophonePermissions();
        if (!res) {
            console.warn("no permission to use microphone, can not start call");
            return;
        }

        if (debug)
            console.log("start voip call");
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        this.updateMute(this.voip.muteOutput);
        if (debug)
            console.log(this.stream)
        this.call = this.peer.call(this.peerId, this.stream, { metadata: { userId: this.userId } });
        this.call.on("error", err => {
            console.error(err);
        });
        this.call.on("stream", remoteStream => {
            if (debug)
                console.log("received stream from remote again", remoteStream);
            // const ic = new AudioConnection(this.voip.gameObject, this.call).openAudioStream(remoteStream);
        });
        //@ts-ignore - ignore overload error
        this.peer.on("close", this.onCallClose.bind(this));

        this.callErrorListener = err => {
            if (err.message.includes(this.peerId)) {
                console.log("Could not connect to " + this.peerId);
                if (this.callErrorListener)
                    this.peer.off("error", this.callErrorListener);
                if (this.call)
                    this.call.close();
                this.stream?.getTracks().forEach(function (track) {
                    track.stop();
                });
                this.stream = null;
            }
            else
                console.error(err)
        }
        //@ts-ignore - ignore overload error
        this.peer.on("error", this.callErrorListener);
    }

    private onCallClose(evt) {
        if (debug)
            console.log("call closed", evt);
    }
}

class AudioConnection {
    public get currentStream(): MediaStream | null {
        return this.stream;
    }

    public get currentAudio(): THREE.Audio | null {
        return this.audio;
    }

    public get currentAnalyzer(): THREE.AudioAnalyser | null { return this.analyzer; }

    private voip: Voip;
    private call: MediaConnection;
    private audio: THREE.Audio | null = null;
    private stream: MediaStream | null = null;
    private obj: THREE.Object3D;
    private analyzer: THREE.AudioAnalyser | null = null;

    private waitingForStart: boolean = false;
    private closed: boolean = false;
    private audioElement: HTMLAudioElement | null = null;

    public constructor(voip: Voip, obj: THREE.Object3D, call: MediaConnection) {
        this.voip = voip;
        this.obj = obj;
        this.call = call;
    }


    public openAudioStream(stream: MediaStream) {
        const tracks = stream.getAudioTracks();
        for (const track of tracks) {
            if (track.kind === "audio" && track.readyState === "live") {
                this.open(track);
                return;
            }
        }
        console.warn("failed finding valid audio stream to begin call");
    }

    public open(track: MediaStreamTrack) {
        console.assert(track.kind === "audio", "invalid track kind, expected audio but received " + track.kind);
        if (this.waitingForStart) return;
        this.waitingForStart = true;
        // console.trace();
        if (!AudioSource.userInteractionRegistered) {
            if (debug)
                console.log("Incoming call, waiting for user interaction before opening audio");
        }
        AudioSource.registerWaitForAllowAudio(async () => {
            if (this.call.open && !this.closed) {
                if (debug)
                    console.log("Setup audio and begin listening");

                // console.log(track);
                this.stream = new MediaStream([track as MediaStreamTrack]);


                // three does not work?
                const listener = new THREE.AudioListener();
                this.audio = new THREE.Audio(listener);
                this.audio.setVolume(this.voip.muteInput ? 0 : 1);

                // this.stream = track as MediaStream;
                // if (!this.stream)
                this.audio.setMediaStreamSource(this.stream);
                // this.obj.add(listener);
                // this.obj.add(this.audio);

                // stream only plays if we create this audio element too
                const audio: HTMLAudioElement = document.createElement('audio');
                this.audioElement = audio;
                audio.style.display = "none";
                document.body.appendChild(audio);
                audio.srcObject = this.stream;
                if (audio["sinkId"] !== undefined) {
                    // select speaker output for mobile devices
                    navigator.mediaDevices.enumerateDevices().then(devices => {
                        if (!audio) return;
                        console.log(devices);
                        for (const dev of devices) {
                            if (dev.label === "Speakerphone") {
                                audio["sinkId"] = dev.deviceId;
                                break;
                            }
                        }
                    });
                }
                // audio.play();

                // this.audio.setMediaElementSource(audio);
                if (debug)
                    console.log("call is setup, you should hear something now");

                this.analyzer = new AudioAnalyser(this.audio, 32);

                // const context = this.audio.context;
                // context.audioWorklet.addModule('./include/Voip_Volume.js').then(() => {
                //     const samplingNode = new AudioWorkletNode(context, "white-noise-processor");
                //     samplingNode.connect(context.destination);
                // }).catch(err => {
                //     console.error(err);
                // });
            }
        });
    }

    public close() {
        this.closed = true;
        if (this.call?.open)
            this.call.close();
        this.audio?.disconnect();
        this.stream?.getTracks().forEach(track => { track.stop(); });
        this.stream = null;
        if (this.audioElement)
            this.audioElement.remove();
    }
}


export class Voip extends Behaviour {

    requireParam: boolean = false;

    set muteInput(value: boolean) {
        if (value === this._inputMuted) return;
        this._inputMuted = value;
        if (!this.currentIncomingCalls) return;
        const vol = this._inputMuted ? 0 : 1;
        for (const cur in this.currentIncomingCalls) {
            const call = this.currentIncomingCalls[cur];
            call?.currentAudio?.setVolume(vol);
        }
    }
    get muteInput(): boolean {
        return this._inputMuted;
    }

    set muteOutput(value: boolean) {
        if (value === this._outputMuted) return;
        this._outputMuted = value;
        if (!this.connections) return;
        for (const cur in this.connections) {
            const call = this.connections[cur];
            call?.updateMute(value);
        }
    }
    get muteOutput(): boolean {
        return this._outputMuted;
    }

    public getFrequency(userId: string | null): number | null {
        // null is get the first with some data
        if (userId === null) {
            for (const c in this.currentIncomingCalls) {
                const call = this.currentIncomingCalls[c];
                if (call && call.currentAnalyzer) return call.currentAnalyzer.getAverageFrequency();
            }
            return null;
        }
        const call = this.currentIncomingCalls[userId];
        if (call && call.currentAnalyzer) return call.currentAnalyzer.getAverageFrequency();
        return null;
    }

    private peer: Peer | null = null;
    private model: PeerModel | null = null;
    private connections: { [key: string]: PeerConnection | null } = {};
    private currentIncomingCalls: { [key: string]: AudioConnection | null } = {};

    private _inputMuted: boolean = false;
    private _outputMuted: boolean = false;

    awake() {
        if (utils.getParam(noVoip)) {
            console.log("VOIP is disabled by url parameter: " + noVoip);
            return;
        }

        if (this.requireParam && !allowVoip) {
            console.debug("VOIP must be enabled explicitly by url parameter");
            return;
        }

        if (utils.isiOS() && utils.isSafari()) {
            console.log("VOIP is currently not supported on Safari iOS")
            return;
        }

        this.peer = new Peer();
        navigator["getUserMedia"] = (navigator["getUserMedia"] || navigator["webkitGetUserMedia"] || navigator["mozGetUserMedia"] || navigator["msGetUserMedia"]);


        // navigator.mediaDevices.enumerateDevices().then(console.log);

        this.context.connection.beginListen(RoomEvents.JoinedRoom, _evt => {
            // request mic once
            navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        });

        this.context.connection.beginListen(PeerMessage.Update_ID, (cb: IPeerUpdateResponse) => {
            if (cb.id !== this.context.connection.connectionId) {
                const prevConnection = this.connections[cb.id];
                if (prevConnection) {
                    prevConnection.close();
                }
                if (this.peer && this.context.connection.connectionId) {
                    const newConnection = new PeerConnection(this, this.peer, this.context.connection.connectionId, cb.peerId);
                    this.connections[cb.id] = newConnection;
                    newConnection.startVoipCall();
                }
            }
        });
        this.context.connection.beginListen(RoomEvents.UserLeftRoom, evt => {
            const { userId: id } = evt;
            const activeConnection = this.connections[id];
            this.connections[id] = null;
            if (activeConnection) {
                activeConnection.close();
            }
            const incoming = this.currentIncomingCalls[id];
            if (debug)
                console.log("UserLeftRoom", evt, id, incoming);
            if (incoming) {
                incoming.close();
                this.currentIncomingCalls[id] = null;
            }
        });

        this.peer.on('open', this.onOpenPeerConnection.bind(this));
    }

    onEnable(): void {
        // for(const key in this.connections){
        //     const con = this.connections[key];
        //     con?.startVoipCall();
        // }
    }

    onDisable(): void {
        console.log("TODO: close all");
        for (const key in this.currentIncomingCalls) {
            try {
                const call = this.currentIncomingCalls[key];
                call?.close();
                const con = this.connections[key];
                con?.close();
            }
            catch (err) {
                console.error(err);
            }
        }
    }

    // update() {
    //     if (this.context.time.frameCount % 20 !== 0) return;
    //     for (const c in this.currentIncomingCalls) {
    //         const call = this.currentIncomingCalls[c];
    //         if (!call || !call.currentAnalyzer) continue;
    //         const vol = call.currentAnalyzer.getAverageFrequency();
    //         if (vol !== 0) {

    //             const t = 100 / vol;
    //             call.currentAudio?.setVolume(t);
    //         }
    //     }
    // }

    private async onOpenPeerConnection(id: string) {
        if (debug)
            console.log("Peer connection established and received id");

        this.model = new PeerModel(id);
        this.context.connection.send(PeerMessage.Update_ID, this.model, SendQueue.OnRoomJoin);

        if (this.peer) {
            this.peer.on('call', this.onReceiveCall.bind(this));

            this.peer.on('connection', function (conn) {
                if (debug)
                    console.log("CONNECTION", conn);
                conn.on('data', function (data) {
                    if (debug)
                        console.log('Received', data);
                });
            });
        }
    }

    private async onReceiveCall(call) {

        const { metadata } = call;
        console.assert(metadata.userId);
        const { userId } = metadata;
        const { peer: peerId } = call;
        const currentCall = this.currentIncomingCalls[userId];
        if (currentCall) {
            currentCall.close();
        }
        if (debug)
            console.log("received call");

        // if we have mic permissions we can answer with our own mic
        if (await Voip.HasMicrophonePermissions()) {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            call.answer(stream);
        }
        // otherwise take the call but dont send any audio ourselves
        else call.answer(null);

        this.currentIncomingCalls[userId] = new AudioConnection(this, this.gameObject, call);

        // let done = false;
        call.on('stream', remoteStream => {
            if (debug)
                console.log("receive caller stream, will setup audio now");
            this.currentIncomingCalls[userId]?.openAudioStream(remoteStream);
        });
        call.on("error", console.error);
    };

    // update(): void {
    //     for (const k in this.currentIncomingCalls) {
    //         const currentCall = this.currentIncomingCalls[k];
    //         if (currentCall && currentCall.currentAnalyzer) {
    //             console.log(currentCall.currentAnalyzer.getAverageFrequency());
    //             //     // const c = currentCall.currentAudio.getOutput();
    //             //     console.log(c, c.gain.value);
    //         }
    //     }
    // }

    public static async HasMicrophonePermissions(): Promise<boolean> {
        //@ts-ignore
        const res = await navigator.permissions.query({ name: 'microphone' });
        if (res.state === "denied") {
            return false;
        }
        return true;
    }
}
