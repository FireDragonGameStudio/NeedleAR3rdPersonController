import { Behaviour, GameObject } from "./Component";
// import { DragControls as Control } from "../include/three/DragControls";
import { SyncedTransform } from "./SyncedTransform";
import * as THREE from "three";
import { IPointerClickHandler, IPointerDownHandler, IPointerEnterHandler, IPointerExitHandler, IPointerUpHandler, PointerEventData } from "./ui/PointerEvents";
import { Context } from "../engine/engine_setup";
import { Interactable, UsageMarker } from "./Interactable";
import { Rigidbody } from "./RigidBody";
import { WebXR } from "./WebXR";
import { Avatar_POI } from "./avatar/Avatar_Brain_LookAt";
import { RaycastOptions } from "../engine/engine_physics";
import { getWorldPosition, getWorldQuaternion, setWorldPosition } from "../engine/engine_three_utils";
import { KeyCode } from "../engine/engine_input";
import { nameofFactory } from "../engine/engine_utils";
import { InstancingUtil } from "../engine/engine_instancing";
import { OrbitControls } from "./OrbitControls";

const debug = false;

export enum DragEvents {
    SelectStart = "selectstart",
    SelectEnd = "selectend",
}

interface SelectArgs {
    selected: THREE.Object3D;
    attached: THREE.Object3D | GameObject | null;
}


export interface IDragEventListener {
    onDragStart?();
    onDragEnd?();
}

export class DragControls extends Interactable implements IPointerDownHandler, IPointerUpHandler, IPointerEnterHandler, IPointerExitHandler {

    private static _active: number = 0;
    public static get HasAnySelected(): boolean { return this._active > 0; }


    public transformSelf: boolean = true;
    // public transformGroup: boolean = true;
    // public targets: THREE.Object3D[] | null = null;

    // private controls: Control | null = null;
    private orbit: OrbitControls | null = null;

    private selectStartEventListener: ((controls: DragControls, args: SelectArgs) => void)[] = [];
    private selectEndEventListener: Array<Function> = [];

    constructor() {
        super();
        this.selectStartEventListener = [];
        this.selectEndEventListener = [];
        this._dragDelta = new THREE.Vector2();
    }

    addDragEventListener(type: DragEvents, cb: (ctrls: DragControls, args: SelectArgs) => void | Function) {
        switch (type) {
            case DragEvents.SelectStart:
                this.selectStartEventListener.push(cb);
                break;
            case DragEvents.SelectEnd:
                this.selectEndEventListener.push(cb);
                break;
        }
    }

    private _dragHelper: DragHelper | null = null;


    start() {
        this.orbit = GameObject.findObjectOfType(OrbitControls, this.context);
    }

    private static lastHovered: THREE.Object3D;
    private _draggingRigidbodies: Rigidbody[] = [];

    private allowEdit(_obj: THREE.Object3D | null = null) {
        return this.context.connection.allowEditing;
    }

    onPointerEnter(evt: PointerEventData) {
        if (!this.allowEdit(this.gameObject)) return;
        if (WebXR.IsInWebXR) return;
        // const interactable = GameObject.getComponentInParent(evt.object, Interactable);
        // if (!interactable) return;
        const dc = GameObject.getComponentInParent(evt.object, DragControls);
        if (!dc || dc !== this) return;
        DragControls.lastHovered = evt.object;
        this.context.domElement.style.cursor = 'pointer';
    }

    onPointerExit(evt: PointerEventData) {
        if (!this.allowEdit(this.gameObject)) return;
        if (WebXR.IsInWebXR) return;
        if (DragControls.lastHovered !== evt.object) return;
        // const interactable = GameObject.getComponentInParent(evt.object, Interactable);
        // if (!interactable) return;
        this.context.domElement.style.cursor = 'auto';
    }

    private _waitingForDragStart: PointerEventData | null = null;

    onPointerDown(args: PointerEventData) {
        if (!this.allowEdit(this.gameObject)) return;
        if (WebXR.IsInWebXR) return;
        DragControls._active += 1;
        this._dragDelta.set(0, 0);
        this._didDrag = false;
        this._waitingForDragStart = args;
        args.StopPropagation();
        // disabling pointer controls here already, otherwise we get a few frames of movement event in orbit controls and this will rotate the camera sligthly AFTER drag controls dragging ends.
        if (this.orbit) this.orbit.enabled = false;
    }

    onPointerUp(args: PointerEventData) {
        this._waitingForDragStart = null;
        if (!this.allowEdit(this.gameObject)) return;
        if(DragControls._active > 0)
            DragControls._active -= 1;
        if (WebXR.IsInWebXR) return;
        this.onDragEnd(args);
        args.StopPropagation();
        if (this.orbit) this.orbit.enabled = true;
    }


    update(): void {
        if (WebXR.IsInWebXR) return;

        // drag start only after having dragged for some pixels
        if (this._waitingForDragStart) {

            if (!this._didDrag) {
                // this is so we can e.g. process clicks without having a drag change the position
                // e.g. a click to rotate the object
                const delta = this.context.input.getPointerPositionDelta(0);
                if (delta)
                    this._dragDelta.add(delta);
                if (this._dragDelta.length() > 2)
                    this._didDrag = true;
                else return;
            }

            const args = this._waitingForDragStart;
            this._waitingForDragStart = null;
            this.onDragStart(args);
        }

        if (this._dragHelper && this._dragHelper.hasSelected) {
            this.onUpdateDrag();
        }


        if (this._isDragging) {
            if (this._dragHelper?.hasSelected === false) {
                this.onDragEnd(null);
            }
        }
    }

    private _isDragging: boolean = false;
    private _marker: UsageMarker | null = null;
    private _dragDelta!: THREE.Vector2;
    private _didDrag: boolean = false;

    private onDragStart(evt: PointerEventData) {
        if (!this._dragHelper) {
            if (this.context.mainCamera)
                this._dragHelper = new DragHelper(this.context.mainCamera);
            else
                return;
        }
        if (!evt || !evt.object) return;

        const dc = GameObject.getComponentInParent(evt.object, DragControls);
        if (!dc || dc !== this) return;


        let object: THREE.Object3D = evt.object;

        if (this.transformSelf) {
            object = this.gameObject;
        }

        // raise event
        const args: { selected: THREE.Object3D, attached: THREE.Object3D | null } = { selected: object, attached: object };
        for (const listener of this.selectStartEventListener) {
            listener(this, args);
        }

        if (!args.attached) return;
        if (args.attached !== object) {
            // if duplicatable changes the object being dragged
            // should it also change the active drag controls (e.g. if it has a own one)
            // const drag = GameObject.getComponentInParent(args.attached, DragControls);
            // if(drag !== this){
            //     console.log(args.attached, object);
            //     drag?.onDragStart(evt);
            //     return;
            // }
        }
        object = args.attached;
        this._isDragging = true;
        this._dragHelper.setSelected(object, this.context);
        if (this.orbit) this.orbit.enabled = false;

        const sync = GameObject.getComponentInChildren(object, SyncedTransform);
        if (debug)
            console.log("DRAG START", sync, object);
        if (sync) {
            sync.fastMode = true;
            sync?.requestOwnership();
        }

        this._marker = GameObject.addNewComponent(object, UsageMarker);

        // console.log(object, this._marker);

        this._draggingRigidbodies.length = 0;
        const rbs = GameObject.getComponentsInChildren(object, Rigidbody);
        if (rbs)
            this._draggingRigidbodies.push(...rbs);

        const l = nameofFactory<IDragEventListener>();
        GameObject.invokeOnChildren(this._dragHelper.selected, l("onDragStart"));
    }

    private onUpdateDrag() {
        if (!this._dragHelper) return;

        this._dragHelper.onUpdate(this.context);
        for (const rb of this._draggingRigidbodies) {
            rb.wakeUp();
            rb.resetVelocities();
        }
    }

    private onDragEnd(evt: PointerEventData | null) {
        if (!this || !this._isDragging) return;
        this._isDragging = false;
        if (!this._dragHelper) return;
        for(const rb of this._draggingRigidbodies){
            rb.setVelocity(rb.smoothedVelocity);
        }
        this._draggingRigidbodies.length = 0;
        const selected = this._dragHelper.selected;
        if (debug)
            console.log("DRAG END", selected, selected?.visible)
        this._dragHelper.setSelected(null, this.context);
        if (this.orbit) this.orbit.enabled = true;
        if (evt?.object) {
            const sync = GameObject.getComponentInChildren(evt.object, SyncedTransform);
            if (sync) {
                sync.fastMode = false;
                // sync?.requestOwnership();
            }
            if (this._marker) {
                this._marker.destroy();
            }
        }
        // raise event
        for (const listener of this.selectEndEventListener) {
            listener(this);
        }

        const l = nameofFactory<IDragEventListener>();
        GameObject.invokeOnChildren(selected, l("onDragEnd"));
    }
}



class DragHelper {

    public get hasSelected(): boolean {
        return this._selected !== null && this._selected !== undefined;
    }

    public get selected(): THREE.Object3D | null {
        return this._selected;
    }

    private _selected: THREE.Object3D | null = null;
    private _context: Context | null = null;
    private _camera: THREE.Camera;;
    private _cameraPlane: THREE.Plane = new THREE.Plane();

    private _hasGroundPlane: boolean = false;
    private _groundPlane: THREE.Plane = new THREE.Plane();
    private _groundOffset: THREE.Vector3 = new THREE.Vector3();
    private _groundOffsetFactor: number = 0;
    private _groundDistance: number = 0;
    private _groundPlanePoint: THREE.Vector3 = new THREE.Vector3();

    private _raycaster = new THREE.Raycaster();
    private _cameraPlaneOffset = new THREE.Vector3();
    private _intersection = new THREE.Vector3();
    private _worldPosition = new THREE.Vector3();
    private _inverseMatrix = new THREE.Matrix4();
    private _rbs: Rigidbody[] = [];

    private _groundLine: THREE.Line;
    private _groundMarker: THREE.Object3D;
    private static geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1, 0)]);

    constructor(camera: THREE.Camera) {
        this._camera = camera;

        const line = new THREE.Line(DragHelper.geometry);
        const mat = line.material as THREE.LineBasicMaterial;
        mat.color = new THREE.Color(.4, .4, .4);
        line.layers.set(2);
        line.name = 'line';
        line.scale.y = 1;
        // line.matrixAutoUpdate = false;
        this._groundLine = line;

        const geometry = new THREE.SphereGeometry(.5, 22, 22);
        const material = new THREE.MeshBasicMaterial({ color: mat.color });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.visible = false;
        sphere.layers.set(2);
        this._groundMarker = sphere;
    }

    setSelected(newSelected: THREE.Object3D | null, context: Context) {
        if (this._selected && context) {
            for (const rb of this._rbs) {
                rb.wakeUp();
                // if (!rb.smoothedVelocity) continue;
                rb.setVelocity(0,0,0);
            }
        }

        if (this._selected) {

            Avatar_POI.Remove(context, this._selected);
        }

        this._selected = newSelected;
        this._context = context;
        this._rbs.length = 0;

        if (newSelected) {
            context.scene.add(this._groundLine);
            context.scene.add(this._groundMarker);
        }
        else {
            this._groundLine.removeFromParent();
            this._groundMarker.removeFromParent();
        }

        if (this._selected) {
            if (!context) {
                console.error("DragHelper: no context");
                return;
            }
            Avatar_POI.Add(context, this._selected, null);

            this._groundOffsetFactor = 0;
            this._hasGroundPlane = true;
            this._groundOffset.set(0, 0, 0);
            this._requireUpdateGroundPlane = true;

            // this._rbs = GameObject.getComponentsInChildren(this._selected, Rigidbody);
            this.onUpdateScreenSpacePlane();
        }
    }

    private _groundOffsetVector = new THREE.Vector3(0, 1, 0);
    private _requireUpdateGroundPlane = true;
    private _didDragOnGroundPlaneLastFrame: boolean = false;

    onUpdate(_context: Context) {
        if (!this._context) return;


        const mainKey = KeyCode.SPACE;
        const secondaryKey = KeyCode.KEY_D;
        const scaleKey = KeyCode.KEY_S;

        const isRotateKeyPressed = this._context?.input.isKeyPressed(mainKey) || this._context?.input.isKeyPressed(secondaryKey);
        const isRotating = this._context.input.getTouchesPressedCount() >= 2 || isRotateKeyPressed;
        if (isRotating) {
            const dt = this._context.input.getPointerPositionDelta(0);
            if (dt) {
                this._groundOffsetVector.set(0, 1, 0);
                this._selected?.rotateOnWorldAxis(this._groundOffsetVector, dt.x * this._context.time.deltaTime);
            }
        }

        // todo: allow this once synced transform sends world scale
        // const isScaling = this._context?.input.isKeyPressed(scaleKey);
        // if(isScaling){
        //     const dt = this._context.input.getPointerPositionDelta(0);
        //     if(dt){
        //         this._selected?.scale.multiplyScalar(1 + (dt.x * this._context.time.deltaTime));
        //         return;
        //     }
        // }

        const rc = this._context.input.getPointerPositionRC(0);
        if (!rc) return;
        this._raycaster.setFromCamera(rc, this._camera);

        if (this._selected) {
            if (debug) console.log("UPDATE DRAG", this._selected);
            this._groundOffsetVector.set(0, 1, 0);
            const lookDirection = getWorldPosition(this._camera).clone().sub(getWorldPosition(this._selected)).normalize();
            const lookDot = Math.abs(lookDirection.dot(this._groundOffsetVector));

            const switchModeKeyPressed = this._context?.input.isKeyPressed(mainKey) || this._context?.input.isKeyPressed(secondaryKey);
            const dragOnGroundPlane = !isRotating && lookDot > .2 && !switchModeKeyPressed && this._context!.input.getPointerPressedCount() <= 1;
            const changed = this._didDragOnGroundPlaneLastFrame !== dragOnGroundPlane;
            this._didDragOnGroundPlaneLastFrame = dragOnGroundPlane;

            if (!this._hasGroundPlane) this._requireUpdateGroundPlane = true;
            if (this._requireUpdateGroundPlane || !dragOnGroundPlane || changed)
                this.onUpdateGroundPlane();

            this._requireUpdateGroundPlane = false;
            if (this._hasGroundPlane) {
                // const wp = getWorldPosition(this._selected);
                // const ray = new THREE.Ray(wp, new THREE.Vector3(0, -1, 0));

                if (this._raycaster.ray.intersectPlane(this._groundPlane, this._intersection)) {
                    const y = this._intersection.y;
                    this._groundPlanePoint.copy(this._intersection).sub(this._groundOffset);
                    this._groundPlanePoint.y = y;

                    if (dragOnGroundPlane) {
                        this._groundOffsetVector.set(0, 1, 0);
                        // console.log(this._groundOffset);
                        const wp = this._intersection.sub(this._groundOffset).add(this._groundOffsetVector.multiplyScalar(this._groundOffsetFactor));
                        this.onUpdateWorldPosition(wp, this._groundPlanePoint, false);
                        this.onDidUpdate();
                        return;
                    }
                }
                // TODO: fix this
                else this._groundPlanePoint.set(0, 99999, 0);
                // else  if (ray.intersectPlane(this._groundPlane, this._intersection)) {
                //     const y = this._intersection.y;
                //     this._groundPlanePoint.copy(this._intersection).sub(this._groundOffset);
                //     this._groundPlanePoint.y = y;
                // }
            }

            if (changed) {
                this.onUpdateScreenSpacePlane();
            }

            this._requireUpdateGroundPlane = true;
            if (this._raycaster.ray.intersectPlane(this._cameraPlane, this._intersection)) {
                this.onUpdateWorldPosition(this._intersection.sub(this._cameraPlaneOffset), this._groundPlanePoint, true);
                this.onDidUpdate();
            }
        }
    }

    private onUpdateWorldPosition(wp: THREE.Vector3, pointOnPlane: THREE.Vector3 | null, heightOnly: boolean) {
        if (!this._selected) return;
        if (heightOnly) {
            const cur = getWorldPosition(this._selected);
            cur.y = wp.y;
            wp = cur;
        }
        setWorldPosition(this._selected, wp);
        setWorldPosition(this._groundLine, wp);
        if (this._hasGroundPlane) {
            this._groundLine.scale.y = this._groundDistance;
        }
        else this._groundLine.scale.y = 1000;

        this._groundMarker.visible = pointOnPlane !== null;
        if (pointOnPlane) {
            const s = getWorldPosition(this._camera).distanceTo(pointOnPlane) * .01;
            this._groundMarker.scale.set(s, s, s);
            setWorldPosition(this._groundMarker, pointOnPlane);
        }
    }

    private onUpdateScreenSpacePlane() {
        if (!this._selected || !this._context) return;
        const rc = this._context.input.getPointerPositionRC(0);
        if (!rc) return;
        this._raycaster.setFromCamera(rc, this._camera);
        this._cameraPlane.setFromNormalAndCoplanarPoint(this._camera.getWorldDirection(this._cameraPlane.normal), this._worldPosition.setFromMatrixPosition(this._selected.matrixWorld));
        if (this._raycaster.ray.intersectPlane(this._cameraPlane, this._intersection) && this._selected.parent) {
            this._inverseMatrix.copy(this._selected.parent.matrixWorld).invert();
            this._cameraPlaneOffset.copy(this._intersection).sub(this._worldPosition.setFromMatrixPosition(this._selected.matrixWorld));
        }
    }

    private onUpdateGroundPlane() {
        if (!this._selected || !this._context) return;
        const wp = getWorldPosition(this._selected);
        const ray = new THREE.Ray(new THREE.Vector3(0, .1, 0).add(wp), new THREE.Vector3(0, -1, 0));
        const opts = new RaycastOptions();
        opts.ignore = [this._selected];
        const hits = this._context.physics.raycastFromRay(ray, opts);
        for (let i = 0; i < hits.length; i++) {
            const hit = hits[i];
            if (!hit.face || this.contains(this._selected, hit.object)) {
                continue;
            }
            const normal = new THREE.Vector3(0, 1, 0); // hit.face.normal
            this._groundPlane.setFromNormalAndCoplanarPoint(normal, hit.point);
            break;
        }

        this._hasGroundPlane = true;
        this._groundPlane.setFromNormalAndCoplanarPoint(ray.direction.multiplyScalar(-1), ray.origin);
        this._raycaster.ray.intersectPlane(this._groundPlane, this._intersection);
        this._groundDistance = this._intersection.distanceTo(wp);
        this._groundOffset.copy(this._intersection).sub(wp);
    }

    private onDidUpdate() {
        // todo: when using instancing we need to mark the matrix to update
        InstancingUtil.markDirty(this._selected);

        for (const rb of this._rbs) {
            rb.wakeUp();
            rb.resetForcesAndTorques();
            // rb.setBodyFromGameObject({ x: 0, y: 0, z: 0 });
            rb.setAngularVelocity(0, 0, 0);
        }
    }

    private contains(obj: THREE.Object3D, toSearch: THREE.Object3D): boolean {
        if (obj === toSearch) return true;
        if (obj.children) {
            for (const child of obj.children) {
                if (this.contains(child, toSearch)) return true;
            }
        }
        return false;
    }
}

