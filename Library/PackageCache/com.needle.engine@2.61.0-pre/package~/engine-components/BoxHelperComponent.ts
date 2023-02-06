import { Behaviour } from "./Component";
import * as THREE from "three";
import { getParam } from "../engine/engine_utils";
import { CreateWireCube, Gizmos } from "../engine/engine_gizmos";
import { getWorldPosition, getWorldScale } from "../engine/engine_three_utils";

const gizmos = getParam("gizmos");
const debug = getParam("debugboxhelper");

export class BoxHelperComponent extends Behaviour {

    private box: THREE.Box3 | null = null;
    private static testBox: THREE.Box3 = new THREE.Box3();
    private _lastMatrixUpdateFrame: number = -1;
    private static _position: THREE.Vector3 = new THREE.Vector3();
    private static _size: THREE.Vector3 = new THREE.Vector3(.01, .01, .01);

    public isInBox(obj: THREE.Object3D, scaleFactor?: number): boolean | undefined {
        if (!obj) return undefined;

        // if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
        // if (!obj.geometry.boundingBox) return undefined;

        if (!this.box) {
            this.box = new THREE.Box3();
        }


        if (obj.type === "Mesh") {
            BoxHelperComponent.testBox.setFromObject(obj);
        }
        else if (obj.type === "Group") {
            BoxHelperComponent.testBox.makeEmpty();
            if (obj.children.length > 0) {
                for (let i = 0; i < obj.children.length; i++) {
                    const ch = obj.children[i];
                    if (ch.type === "Mesh") {
                        BoxHelperComponent.testBox.expandByObject(obj);
                    }
                }
            }
        }
        else {
            const wp = getWorldPosition(obj, BoxHelperComponent._position);
            const size = getWorldScale(obj, BoxHelperComponent._size);
            if (scaleFactor !== undefined) size.multiplyScalar(scaleFactor);
            BoxHelperComponent.testBox.setFromCenterAndSize(wp, size);
        }

        this.updateBox();
        const intersects = this.box?.intersectsBox(BoxHelperComponent.testBox);
        if (intersects) {
            if (debug)
                Gizmos.DrawBox3(BoxHelperComponent.testBox, 0xff0000, 5);
        }
        return intersects;
    }

    public intersects(box: THREE.Box3): boolean {
        if (!box) return false;
        return this.updateBox(false).intersectsBox(box);
    }

    public updateBox(force: boolean = false): THREE.Box3 {
        if (!this.box) {
            this.box = new THREE.Box3();
        }
        if (force || this.context.time.frameCount != this._lastMatrixUpdateFrame) {
            const firstUpdate = this._lastMatrixUpdateFrame < 0;
            this._lastMatrixUpdateFrame = this.context.time.frameCount;
            const updateParents: boolean = firstUpdate; // updating parents seems to cause falsely calculated positions sometimes?
            const wp = getWorldPosition(this.gameObject, BoxHelperComponent._position, updateParents);
            const size = getWorldScale(this.gameObject, BoxHelperComponent._size);
            this.box.setFromCenterAndSize(wp, size);
        }
        return this.box;
    }


    private _helper: THREE.LineSegments | null = null;
    private _color: THREE.Color | null = null;

    awake(): void {
        this._helper = null;
        this._color = null;
        this.box = null;
    }

    public showHelper(col: THREE.ColorRepresentation | null = null, force: boolean = false) {
        if (!gizmos && !force) return;
        if (this._helper) {
            if (col)
                this._color?.set(col);
            this.gameObject.add(this._helper);
            return;
        }
        this._helper = CreateWireCube(col);
        this.gameObject.add(this._helper);
    }

}