import { Graphic } from "./Graphic";
import { FrameEvent } from "../../engine/engine_setup";
import { Behaviour, GameObject } from "../Component";
import { ICanvasGroup } from "./Interfaces";
import { serializable } from "../../engine/engine_serialization_decorator";


export class CanvasGroup extends Behaviour implements ICanvasGroup {
    @serializable()
    get alpha(): number {
        return this._alpha;
    }
    set alpha(val: number) {
        if (val === this._alpha) return;
        this._alpha = val;
        this.markDirty();
    }

    get isCanvasGroup() { return true; }

    private _alpha: number = 1;

    @serializable()
    interactable: boolean = true;
    @serializable()
    blocksRaycasts: boolean = true;


    private _isDirty: boolean = false;
    private markDirty() {
        if (this._isDirty) return;
        this._isDirty = true;
        this.startCoroutine(this.applyChangesDelayed(), FrameEvent.OnBeforeRender);
    }

    private *applyChangesDelayed() {
        this._isDirty = false;
        this.applyChangesNow();
    }

    private _buffer : Graphic[] = [];
    private applyChangesNow() {
        for (const ch of GameObject.getComponentsInChildren(this.gameObject, Graphic, this._buffer)) {
            const col = ch.color;
            col.alpha = this._alpha;
            ch.color = col;
        }
    }
}