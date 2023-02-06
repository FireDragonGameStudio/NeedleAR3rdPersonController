import { RoomEvents } from "../engine/engine_networking";
import { Behaviour, GameObject } from "./Component";
import * as THREE from "three";
import { AvatarMarker } from "./WebXRAvatar";
import { WaitForSeconds } from "../engine/engine_coroutine";


export class PlayerColor extends Behaviour {

    awake(): void {
        // console.log("AWAKE", this.name);
        this.context.connection.beginListen(RoomEvents.JoinedRoom, this.tryAssignColor.bind(this));
    }

    private _didAssignPlayerColor: boolean = false;

    onEnable(): void {
        // console.log("ENABLE", this.name);
        if (!this._didAssignPlayerColor)
            this.startCoroutine(this.waitForConnection());
    }

    private *waitForConnection() {
        while (!this.destroyed && this.enabled) {
            yield WaitForSeconds(.2);
            if (this.tryAssignColor()) break;
        }
        // console.log("STOP WAITING", this.name, this.destroyed);
    }

    private tryAssignColor(): boolean {
        const marker = GameObject.getComponentInParent(this.gameObject, AvatarMarker);
        if (marker && marker.connectionId) {
            this._didAssignPlayerColor = true;
            this.assignUserColor(marker.connectionId);
            return true;
        }
        return false;
    }

    assignUserColor(id: string) {

        // console.log(this.name, id, this);

        const hash = PlayerColor.hashCode(id);
        const color = PlayerColor.colorFromHashCode(hash);
        if (this.gameObject.type === "Mesh") {
            const mesh: THREE.Mesh = this.gameObject as any;
            this.assignColor(color, id, mesh);
        }
        else if (this.gameObject.children) {
            for (const ch of this.gameObject.children) {
                const obj = ch as any;
                if (obj.material && obj.material.color) {
                    this.assignColor(color, id, obj);
                }
            }
        }
    }

    private assignColor(col: THREE.Color, id: string, mesh: THREE.Mesh) {
        let mat = mesh.material as THREE.Material;
        if (!mat) return;
        if (mat["_playerMaterial"] !== id) {
            // console.log("ORIG", mat);
            mat = mat.clone();
            mat["_playerMaterial"] = id;
            mesh.material = mat;
            // console.log("CLONE", mat);
        }
        // else console.log("DONT CLONE", mat);
        mat["color"] = col;
    }

    public static hashCode(str: string) {
        var hash = 0, i, chr;
        if (str.length === 0) return hash;
        for (i = 0; i < str.length; i++) {
            chr = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    };

    public static colorFromHashCode(hash: number) {
        const r = (hash & 0xFF0000) >> 16;
        const g = (hash & 0x00FF00) >> 8;
        const b = hash & 0x0000FF;
        return new THREE.Color(r / 255, g / 255, b / 255);
    }
}

