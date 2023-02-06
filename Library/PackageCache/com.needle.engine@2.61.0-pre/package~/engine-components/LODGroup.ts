import { Behaviour, GameObject } from "./Component";
import * as THREE from "three";
import { Renderer } from "./Renderer";
import { getParam } from "../engine/engine_utils";
import { serializable } from "../engine/engine_serialization_decorator";
import { Vector3 } from "three";

const debug = getParam("debugLODs");
const noLods = getParam("noLODs");

enum LODFadeMode {
    None = 0,
    CrossFade = 1,
    SpeedTree = 2,
}

export class LODModel {
    @serializable()
    screenRelativeTransitionHeight!: number;
    @serializable()
    distance!: number;
    @serializable()
    renderers!: string[];
}

class LOD {
    model: LODModel;
    renderers: Renderer[];

    constructor(group: LODGroup, model: LODModel) {
        this.model = model;
        this.renderers = [];
        for (const guid of model.renderers) {
            const rend = this.findRenderer(guid, group.gameObject as GameObject);// GameObject.findByGuid(guid, group.gameObject) as Renderer;
            if (rend && rend.gameObject) {
                this.renderers.push(rend);
            }
            else if(debug){
                console.warn("Renderer not found: " + guid, group.gameObject);
            }
        }
    }

    findRenderer(guid: string, go : GameObject) : Renderer | null {
        const res = GameObject.foreachComponent(go, comp => {
            if(comp.guid === guid) return comp;
            // explanation: https://github.com/needle-tools/needle-tiny-playground/issues/218#issuecomment-1150234346
            const prototypeGuid = Object.getPrototypeOf(comp)?.guid;
            if(prototypeGuid === guid) return comp;
            return null;
        });
        if(res) return res;
        for(const ch of go.children){
            const rend = this.findRenderer(guid, ch as GameObject);
            if(rend) return rend;
        }
        return null;
    }
}

declare class LODSetting {
    lod: THREE.LOD;
    levelIndex: number;
    distance: number;
}

export class LODGroup extends Behaviour {

    fadeMode: LODFadeMode = LODFadeMode.None;
    @serializable(Vector3)
    localReferencePoint: THREE.Vector3 | undefined = undefined;
    lodCount: number = 0;
    size: number = 0;
    animateCrossFading: boolean = false;

    @serializable(LODModel)
    lodModels?: LODModel[];

    private _lods: LOD[] = [];
    private _settings: LODSetting[] = [];

    // https://threejs.org/docs/#api/en/objects/LOD
    private _lodsHandler?: Array<THREE.LOD>;

    start(): void {
        if (noLods) return;
        if (this._lodsHandler) return;
        if (!this.gameObject) return;
        if (debug)
            console.log(this);

        if (this.lodModels && Array.isArray(this.lodModels)) {
            let maxDistance = 0;
            let renderers: Renderer[] = [];
            for (const model of this.lodModels) {
                maxDistance = Math.max(model.distance, maxDistance);
                const lod = new LOD(this, model);
                this._lods.push(lod);
                for (const rend of lod.renderers) {
                    if (!renderers.includes(rend))
                        renderers.push(rend);
                }
            }
            this._lodsHandler = new Array<THREE.LOD>();
            for (let i = 0; i < renderers.length; i++) {
                const handler = new THREE.LOD();
                this._lodsHandler.push(handler);
                this.gameObject.add(handler);
            }
            const empty = new THREE.Object3D();
            empty.name = "Cull " + this.name;
            if (debug)
                console.log(renderers);
            for (let i = 0; i < renderers.length; i++) {
                const rend = renderers[i];
                const handler = this._lodsHandler[i];
                const obj = rend.gameObject;
                let maxDistance = 0;
                let lodDistanceDiff = 0;
                if (debug)
                    console.log(i, obj.name);
                for (const lod of this._lods) {

                    // get object to be lodded, it can be empty
                    let object: THREE.Object3D | null = null;
                    if (lod.renderers.includes(rend)) object = obj;
                    else {
                        object = empty;
                    }
                    if (debug)
                        console.log("add", lod.model.distance, object.name);

                    const dist = lod.model.distance;
                    lodDistanceDiff = dist - maxDistance;
                    maxDistance = Math.max(dist, maxDistance);
                    if (object.type === "Group") {
                        console.warn("LODGroup: Group is not supported as LOD object", obj.name, object);
                        continue;
                    }
                    this.onAddLodLevel(handler, object, dist);
                }
                const cullDistance = maxDistance + lodDistanceDiff;
                if (debug) {
                    console.log("cull", cullDistance);
                }
                this.onAddLodLevel(handler, empty, cullDistance);
            }
        }
    }

    update() {
        if (!this.gameObject) return;
        if (!this._lodsHandler) return;
        const cam = this.context.mainCamera;
        if (!cam) return;

        for (const h of this._lodsHandler) {
            h.update(cam);
        }
    }

    private onAddLodLevel(lod: THREE.LOD, obj: THREE.Object3D, dist: number) {
        if(obj === this.gameObject) {
            console.warn("LODGroup component must be on parent object and not mesh directly at the moment", obj.name, obj)
            return;
        }
        lod.addLevel(obj, dist * this._distanceFactor);
        const setting = { lod: lod, levelIndex: lod.levels.length - 1, distance: dist };
        this._settings.push(setting)
    }

    private _distanceFactor = 1;

    distanceFactor(factor: number) {
        if (factor === this._distanceFactor) return;
        this._distanceFactor = factor;
        for (const setting of this._settings) {
            const level = setting.lod.levels[setting.levelIndex];
            level.distance = setting.distance * factor;
        }
    }
}