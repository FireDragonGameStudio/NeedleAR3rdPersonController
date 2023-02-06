import { RaycastOptions } from "../../engine/engine_physics";
import { Behaviour, Component } from "../Component";
import { EventSystem } from "./EventSystem";


export class Raycaster extends Behaviour {
    awake(): void {
        EventSystem.createIfNoneExists(this.context);
    }

    onEnable(): void {
        EventSystem.get(this.context)?.register(this);
    }

    onDisable(): void {
        EventSystem.get(this.context)?.unregister(this);
    }

    performRaycast(_opts: RaycastOptions | null = null): THREE.Intersection[] | null {
        return null;
    }
}


export class ObjectRaycaster extends Raycaster {
    private targets: THREE.Object3D[] | null = null;
    private raycastHits: THREE.Intersection[] = [];

    start(): void {
        this.targets = [this.gameObject];
    }

    performRaycast(opts: RaycastOptions | null = null): THREE.Intersection[] | null {
        if (!this.targets) return null;
        opts ??= new RaycastOptions();
        opts.targets = this.targets;
        opts.results = this.raycastHits;
        const hits = this.context.physics.raycast(opts);
        // console.log(this.context.alias, hits);
        return hits;
    }
}

export class GraphicRaycaster extends ObjectRaycaster {
    // eventCamera: Camera | null = null;
    // ignoreReversedGraphics: boolean = false;
    // rootRaycaster: GraphicRaycaster | null = null;
}


