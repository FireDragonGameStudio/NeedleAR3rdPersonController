import Peer, { DataConnection } from "peerjs";

enum MessageType {
    ConnectionList = "connection-list"
}

declare class InternalPeerMessages {
    type: MessageType
}

export class PeerNetworking {
    get isHost(): boolean {
        return this._host !== undefined;
    }

    private _host?: PeerHost;

    private _client!: Peer;
    private _clientData?: DataConnection;

    constructor() {
        this.onEnable();
    }

    onEnable() {
        const hostId = "HOST-5980e65c-8438-453e-8b35-f13c736dcd81";
        this.trySetupHost(hostId);
    }

    private trySetupHost(id: string) {
        let host = new Peer(id);
        host.on("error", err => {
            console.error(err);
            this._host = undefined;
            this.trySetupClient(id);
        });
        host.on("open", _id => {
            this._host = new PeerHost(host);
        });
    }

    private trySetupClient(hostId: string) {

        this._client = new Peer();
        this._client.on("error", err => {
            console.error("Client error", err);
        });
        this._client.on("open", id => {
            console.log("client connected", id);
            this._clientData = this._client.connect(hostId, { metadata: { id: id } });
            this._clientData.on("open", () => {
                console.log("Connected to host");
            })
            this._clientData.on("data", data => {
                console.log("<<", data);
            });
        });
    }
}

abstract class AbstractPeerHandler {
    protected _peer: Peer;

    constructor(peer: Peer) {
        this._peer = peer;
    }

    abstract get isHost(): boolean;
    protected abstract onConnection(con: DataConnection);
}

//@ts-ignore
class PeerClient extends AbstractPeerHandler {
    get isHost() { return false; }

    protected onConnection(_con: DataConnection) {
    }
}

class PeerHost extends AbstractPeerHandler {

    get isHost() { return true; }

    private _connections: DataConnection[] = [];

    constructor(peer: Peer) {
        super(peer);
        console.log("I AM THE HOST");
        this._peer?.on("connection", this.onConnection.bind(this));
        this._peer.on("close", () => {
            this.broadcast("BYE");
        });
        setInterval(()=>{
            this.broadcast("HELLO");
        }, 2000);
    }

    protected onConnection(con: DataConnection) {
        console.log("host connection", con);
        con.on("open", () => {
            this._connections.push(con);
            this.broadcastConnection(con);
        });
    }

    private broadcastConnection(_con: DataConnection) {
        const connectionIds: string[] = this._connections.map(c => c.metadata?.id).filter(id => id !== undefined);
        this.broadcast({ "type": MessageType.ConnectionList, "connections": connectionIds });
    }

    private broadcast(msg: any) {
        if (msg === undefined || msg === null) return;
        console.log(">>", msg);
        for (const cur in this._peer.connections) {
            const curCon = this._peer.connections[cur];
            if (!curCon) continue;
            if (Array.isArray(curCon)) {
                for (const entry of curCon) {
                    if (!entry) continue;
                    entry.send(msg);
                }
            }
            else {
                console.warn(curCon);
            }
        }
    }
}