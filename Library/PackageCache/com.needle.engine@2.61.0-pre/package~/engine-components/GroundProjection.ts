import { Behaviour, GameObject } from "./Component";
import { GroundProjectedEnv as GroundProjection } from 'three/examples/jsm/objects/GroundProjectedEnv.js';
import { serializable } from "../engine/engine_serialization_decorator";
import { Watch as Watch } from "../engine/engine_utils";
import { Texture } from "three";


export class GroundProjectedEnv extends Behaviour {

    @serializable()
    applyOnAwake: boolean = false;

    @serializable()
    set scale(val: number) {
        this._scale = val;
        this.env?.scale.setScalar(val);
    }
    get scale(): number {
        return this._scale;
    }
    private _scale: number = 20;

    @serializable()
    set radius(val: number) {
        this._radius = val;
        if (this.env)
            this.env.height = val;
    }
    get radius(): number { return this._radius; }
    private _radius: number = 100;

    @serializable()
    set height(val: number) {
        this._height = val;
        if (this.env)
            this.env.height = val;
    }
    get height(): number { return this._height; }
    private _height: number = 100;

    private _lastEnvironment?: Texture;
    private env?: GroundProjection;
    private _watcher?: Watch;


    awake() {
        if (this.applyOnAwake)
            this.updateAndCreate();
    }

    onEnable() {
        // TODO: if we do this in the first frame we can not disable it again. Something buggy with the watch?!
        if (this.context.time.frameCount > 0) {
            if (this.applyOnAwake)
                this.updateAndCreate();
        }
        if (!this._watcher) {
            this._watcher = new Watch(this.context.scene, "environment");
            this._watcher.subscribeWrite(_ => {
                this.updateProjection();
            });
        }
    }

    onDisable() {
        this._watcher?.revoke();
        this.env?.removeFromParent();
    }

    private updateAndCreate() {
        this.updateProjection();
        this._watcher?.apply();
    }

    updateProjection() {
        if (!this.context.scene.environment) {
            this.env?.removeFromParent();
            return;
        }
        if (!this.env || this.context.scene.environment !== this._lastEnvironment) {
            console.log("Create/Update Ground Projection", this.context.scene.environment.name);
            this.env = new GroundProjection(this.context.scene.environment);
        }
        this._lastEnvironment = this.context.scene.environment;
        if (!this.env.parent)
            this.gameObject.add(this.env);
        this.env.scale.setScalar(this._scale);
        this.env.radius = this._radius;
        this.env.height = this._height;
        // dont make the ground projection raycastable by default
        if (this.env.isObject3D === true) {
            this.env.layers.set(2);
        }
    }

}