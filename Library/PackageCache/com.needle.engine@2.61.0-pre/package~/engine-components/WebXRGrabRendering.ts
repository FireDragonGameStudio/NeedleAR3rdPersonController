import { getWorldPosition, setWorldPosition, setWorldPositionXYZ } from "../engine/engine_three_utils";
import { Behaviour, GameObject } from "./Component";
import { AttachedObject, AttachedObjectEvents } from "./WebXRController";
import { Object3D, Vector3 } from "three";
import { PlayerColor } from "./PlayerColor";
import { Context } from "../engine/engine_setup";
import { IModel, SendQueue } from "../engine/engine_networking_types";

enum XRGrabEvent {
    StartOrUpdate = "xr-grab-visual-start-or-update",
    End = "xr-grab-visual-end",
}

export class XRGrabModel implements IModel {
    guid!: any;
    dontSave: boolean = true;

    userId : string | null | undefined;
    point: { x: number, y: number, z: number } = { x: 0, y: 0, z: 0 };
    source: { x: number, y: number, z: number } = { x: 0, y: 0, z: 0 };
    target: string | undefined;

    update(context : Context, point: Vector3, source: Vector3, target: string | undefined = undefined) {
        this.userId = context.connection.connectionId;
        this.point.x = point.x;
        this.point.y = point.y;
        this.point.z = point.z;
        this.source.x = source.x;
        this.source.y = source.y;
        this.source.z = source.z;
        this.target = target;
    }
}

// sends grab info to other users and creates rendering instances
export class XRGrabRendering extends Behaviour {
    prefab: Object3D | null = null;

    private _grabModels: Array<XRGrabModel> = [];
    private _grabModelsUpdateTime: Array<number> = [];
    private _addOrUpdateSub: Function | null = null;
    private _endSub: Function | null = null;
    private _freeSub: Function | null = null;
    private _instances: { [key: string]: {instance:Object3D, model:XRGrabModel} } = {};

    awake(): void {
        if(this.prefab) this.prefab.visible = false;
    }

    onEnable(): void {
        this._addOrUpdateSub = this.context.connection.beginListen(XRGrabEvent.StartOrUpdate, this.onRemoteGrabStartOrUpdate.bind(this));
        this._endSub = this.context.connection.beginListen(XRGrabEvent.End, this.onRemoteGrabEnd.bind(this));
        this._freeSub = AttachedObject.AddEventListener(AttachedObjectEvents.WillFree, this.onAttachedObjectFree.bind(this));
    }

    onDisable(): void {
        this.context.connection.stopListening(XRGrabEvent.StartOrUpdate, this._addOrUpdateSub);
        this.context.connection.stopListening(XRGrabEvent.End, this._endSub);
        AttachedObject.RemoveEventListener(AttachedObjectEvents.WillFree, this._freeSub);
    }

    addOrUpdateGrab(model: XRGrabModel) {
        this.context.connection.send(XRGrabEvent.StartOrUpdate, model, SendQueue.Queued);
    }

    endGrab(model: XRGrabModel) {
        this.context.connection.send(XRGrabEvent.End, model, SendQueue.Queued);
    }

    private onRemoteGrabStartOrUpdate(data: XRGrabModel) {
        if(!this.prefab) return;
        const inst = this._instances[data.guid];
        if(!inst)
        {
            const instance = GameObject.instantiate(this.prefab) as Object3D;
            instance.visible = true;
            this._instances[data.guid] = {instance, model:data};
            if(data.userId){
                const playerColor = GameObject.getComponentsInChildren(instance, PlayerColor);
                if(playerColor?.length > 0)
                {
                    for(const pl of playerColor){
                        pl.assignUserColor(data.userId)
                    }
                }
            }
            return;
        }
        inst.model = data;
    }

    private onRemoteGrabEnd(data: XRGrabModel) {
        if (!data) return;
        const id = data.guid;
        if(this._instances[id])
        {
            GameObject.destroy(this._instances[id].instance);
            delete this._instances[id];
        }
    }

    private onAttachedObjectFree(att: AttachedObject) {
        if (this._grabModels.length <= 0) return;
        const mod = this._grabModels[0];
        this.updateModel(mod, att);
        this.endGrab(mod);
    }

    onBeforeRender() {
        this.updateRendering();

        if (!this.prefab) return;
        this.prefab.visible = false;
        if (this.context.time.frameCount % 10 !== 0) return;
        for (let i = 0; i < AttachedObject.Current.length; i++) {
            const att = AttachedObject.Current[i];

            if (!att.controller || !att.selected) continue;

            if (this._grabModels.length <= i) {
                this._grabModels.push(new XRGrabModel());
                this._grabModelsUpdateTime.push(0);
            }
            this._grabModelsUpdateTime[i] = this.context.time.time;
            const model = this._grabModels[i];
            this.updateModel(model, att);
            this.addOrUpdateGrab(model);
        }
    }

    private updateModel(model: XRGrabModel, att: AttachedObject) {
        if (!att.controller || !att.selected) return;
        model.guid = att.grabUUID;
        const targetObject = att.selected["guid"];
        model.update(this.context, att.grabPoint, att.controller.worldPosition, targetObject);
    }

    private temp : Vector3 = new Vector3();
    private updateRendering() {
        const step = this.context.time.deltaTime / .5;
        for(const key in this._instances){
            const { instance, model } = this._instances[key];
            if(!instance || !model) continue;
            const { point } = model;
            const wp = getWorldPosition(instance);
            this.temp.set(point.x, point.y, point.z);
            wp.lerp(this.temp, step);
            setWorldPosition(instance, wp);
        }
    }
}