import { Behaviour, GameObject } from "./Component";
import * as THREE from "three";
import { AudioSource } from "./AudioSource";
import { Camera } from "./Camera";


export class AudioListener extends Behaviour {

    get listener(): THREE.AudioListener {
        if (this._listener == null)
            this._listener = new THREE.AudioListener();
        return this._listener;
    }

    private _listener: THREE.AudioListener | null = null;

    awake() {
        AudioSource.registerWaitForAllowAudio(() => {
            const listener = this.listener;
            if (listener == null) return;
            // if the listener is already parented to some object d0nt change it
            if (listener.parent) return;

            const cam = GameObject.getComponentInParent(this.gameObject, Camera);
            if (cam) {
                cam.cam.add(listener);
            }
            else
                this.gameObject.add(listener);
        });
    }
}