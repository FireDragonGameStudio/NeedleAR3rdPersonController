import { Behaviour, GameObject } from "./Component";
import { WebXRController, ControllerEvents } from "./WebXRController";
import { DragControls, DragEvents } from "./DragControls";
import { Interactable } from "./Interactable";
import { Animation } from "./Animation";
import { Vector3, Quaternion, Object3D } from "three";
import { serializable } from "../engine/engine_serialization_decorator";
import { InstantiateOptions } from "../engine/engine_gameobject";

export class Duplicatable extends Interactable {

    @serializable(Object3D)
    parent: GameObject | null = null;
    @serializable(Object3D)
    object: GameObject | null = null;

    // limit max object spawn count per interval
    @serializable()
    limitCount = 10;
    @serializable()
    limitInterval = 60;

    private _currentCount = 0;
    private _startPosition: THREE.Vector3 | null = null;
    private _startQuaternion: THREE.Quaternion | null = null;

    awake(): void {
        // TODO: add support to not having to assign a object to clone
        // if(!this.object){
        //     const opts = new InstantiateOptions();
        //     opts.parent = this.gameObject;
        //     opts.idProvider = InstantiateIdProvider.createFromString(this.guid);
        //     const clone = GameObject.instantiate(this.gameObject, opts);
        //     const duplicatable = 
        //     this.object = clone;
        // }
        // console.log(this, this.object);
        if (this.object) {
            if (this.object as any === this.gameObject) {
                console.error("Can not duplicate self");
                return;
            }
            this.object.visible = false;

            // when this is in a moveable parent in multiuser scenario somehow the object position gets an offset and might stay that way
            // this is just a workaround to set the object position before duplicating
            this._startPosition = this.object.position?.clone() ?? new Vector3(0, 0, 0);
            this._startQuaternion = this.object.quaternion?.clone() ?? new Quaternion(0, 0, 0, 1);
        }

        const drag = GameObject.getComponentInParent(this.gameObject, DragControls);
        if (drag) {
            drag.addDragEventListener(DragEvents.SelectStart, (_ctrls, args) => {
                if (this._currentCount >= this.limitCount) {
                    args.attached = null;
                    return;
                }
                const res = this.handleDuplication(args.selected);
                if (res) {
                    console.assert(res !== args.selected, "Duplicated object is original");
                    args.attached = res;
                }
            });
        }
        else console.warn("Could no find drag controls in parent", this.name);

        WebXRController.addEventListener(ControllerEvents.SelectStart, (_controller: WebXRController, args: { selected: THREE.Object3D, grab: THREE.Object3D | GameObject | null }) => {
            if (this._currentCount >= this.limitCount) {
                args.grab = null;
                return;
            }
            const res = this.handleDuplication(args.selected);
            if (res) args.grab = res;
        });

        this.cloneLimitIntervalFn();
    }

    private cloneLimitIntervalFn() {
        if (this.destroyed) return;
        if (this._currentCount > 0) {
            this._currentCount -= 1;
        }
        setTimeout(() => {
            this.cloneLimitIntervalFn();
        }, (this.limitInterval / this.limitCount) * 1000);
    }

    private handleDuplication(selected: THREE.Object3D): THREE.Object3D | null {
        if (this._currentCount >= this.limitCount) return null;
        if (!this.object) return null;
        if (selected === this.gameObject || this.handleMultiObject(selected)) {

            if (this.object as any === this.gameObject) return null;
            this.object.visible = true;

            if (this._startPosition)
                this.object.position.copy(this._startPosition);
            if (this._startQuaternion)
                this.object.quaternion.copy(this._startQuaternion);

            const opts = new InstantiateOptions();
            if (!this.parent) this.parent = this.gameObject.parent as GameObject;
            if (this.parent) {
                opts.parent = this.parent.guid ?? this.parent.userData?.guid;
                opts.keepWorldPosition = true;
            }
            opts.position = this.worldPosition;
            opts.rotation = this.worldQuaternion;
            opts.context = this.context;
            this._currentCount += 1;

            const newInstance = GameObject.instantiateSynced(this.object as GameObject, opts) as GameObject;
            console.assert(newInstance !== this.object, "Duplicated object is original");
            this.object.visible = false;

            // see if this fixes object being offset when duplicated and dragged - it looks like three clone has shared position/quaternion objects?
            if (this._startPosition)
                this.object.position.clone().copy(this._startPosition);
            if (this._startQuaternion)
                this.object.quaternion.clone().copy(this._startQuaternion);

            return newInstance;
        }
        return null;
    }

    private handleMultiObject(selected: THREE.Object3D): boolean {
        const shouldSearchInChildren = this.gameObject.type === "Group" || this.gameObject.type === "Object3D";
        if (!shouldSearchInChildren) return false;
        return this.isInChildren(this.gameObject, selected);
    }

    private isInChildren(current: THREE.Object3D, search: THREE.Object3D): boolean {
        if (!current) return false;
        if (current === search) return true;
        if (current.children) {
            for (let child of current.children) {
                if (this.isInChildren(child, search)) {
                    return true;
                }
            }
        }
        return false;
    }

}