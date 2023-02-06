import { RaycastOptions } from "../../engine/engine_physics";
import { Behaviour, Component, GameObject } from "../Component";
import { WebXR } from "../WebXR";
import { ControllerEvents, WebXRController } from "../WebXRController";
import * as ThreeMeshUI from 'three-mesh-ui'
import { Context } from "../../engine/engine_setup";
import { OrbitControls } from "../OrbitControls";
import { IPointerEventHandler, PointerEventData } from "./PointerEvents";
import { Raycaster } from "./Raycaster";
import { InputEvents, KeyCode } from "../../engine/engine_input";
import { Object3D } from "three";
import { ICanvasGroup, IGraphic } from "./Interfaces";
import { getParam } from "../../engine/engine_utils";
import { UIRaycastUtils } from "./RaycastUtils";
import { $shadowDomOwner } from "./BaseUIComponent";

const debug = getParam("debugeventsystem");

export enum EventSystemEvents {
    BeforeHandleInput = "BeforeHandleInput",
    AfterHandleInput = "AfterHandleInput",
}

export class EventSystem extends Behaviour {


    private static _eventSystemMap = new Map<Context, EventSystem[]>();

    static didSearchEventSystem: boolean = false;
    static createIfNoneExists(context: Context) {
        if (!this.didSearchEventSystem) {
            this.didSearchEventSystem = true;
            if (EventSystem.systems.length <= 0) {
                EventSystem.systems.push(...GameObject.findObjectsOfType(EventSystem, context));
            }
        }
        for (const sys of EventSystem.systems) {
            if (sys.context === context) return; // exists
        }
        const go = new Object3D();
        GameObject.addNewComponent(go, EventSystem);
        context.scene.add(go);
    }

    static get systems(): EventSystem[] {
        const context = Context.Current;
        if (!this._eventSystemMap.has(context)) {
            this._eventSystemMap.set(context, []);
        }
        return this._eventSystemMap.get(context)!;
    }

    static get(ctx: Context): EventSystem | null {
        const systems = this._eventSystemMap.get(ctx);
        if (systems && systems.length > 0) return systems[0];
        return null;
    }

    static get instance(): EventSystem | null {
        return this.systems[0];
    }

    //@ts-ignore
    static ensureUpdateMeshUI(instance, context: Context) {
        MeshUIHelper.update(instance, context);
    }
    static markUIDirty(_context: Context) {
        MeshUIHelper.markDirty();
    }

    // private orbitControl: OrbitControls | null = null;
    // private orbitControlWasEnabled: boolean = false;
    private raycaster: Raycaster[] = [];

    constructor() {
        super();
        EventSystem.systems.push(this);
    }

    get hasActiveUI() { return this.currentActiveMeshUIComponents.length > 0; }
    get isHoveringObjects() { return this.objectsHoveredThisFrame.length > 0; }

    onDestroy(): void {
        EventSystem.systems.splice(EventSystem.systems.indexOf(this), 1);
    }

    start() {
        // const res = GameObject.findObjectsOfType(Raycaster, this.context);
        // if (res)
        //     this.raycaster = [...res];
    }

    register(rc: Raycaster) {
        if (rc && this.raycaster && !this.raycaster.includes(rc))
            this.raycaster?.push(rc);
    }
    unregister(rc: Raycaster) {
        const i = this.raycaster?.indexOf(rc);
        if (i !== undefined && i !== -1) {
            this.raycaster?.splice(i, 1);
        }
    }

    private _selectStartFn?: any;
    private _selectEndFn?: any;
    private _selectUpdateFn?: any;
    private _handleEventFn?: any;

    onEnable(): void {

        const grabbed: Map<any, Object3D | null> = new Map();
        this._selectStartFn ??= (ctrl, args: { grab: THREE.Object3D | null }) => {
            if (!args.grab) return;
            MeshUIHelper.resetLastSelected();
            const opts = new PointerEventData();
            opts.inputSource = ctrl;
            opts.isDown = ctrl.selectionDown;
            opts.isUp = ctrl.selectionUp;
            opts.isPressed = ctrl.selectionPressed;
            opts.isClicked = false;
            grabbed.set(ctrl, args.grab);
            if (args.grab && !this.handleEvents(args.grab, opts)) {
                args.grab = null;
            };
        }
        this._selectEndFn ??= (ctrl, args: { grab: THREE.Object3D }) => {
            if (!args.grab) return;
            const opts = new PointerEventData();
            opts.inputSource = ctrl;
            opts.isDown = ctrl.selectionDown;
            opts.isUp = ctrl.selectionUp;
            opts.isPressed = ctrl.selectionPressed;
            opts.isClicked = ctrl.selectionClick;
            this.handleEvents(args.grab, opts);

            const prevGrabbed = grabbed.get(ctrl);
            grabbed.set(ctrl, null);
            if (prevGrabbed) {
                for (let i = 0; i < this.raisedPointerDownEvents.length; i++) {
                    const comp = this.raisedPointerDownEvents[i];
                    const obj = this.raisedPointerDownObjects[i];
                    if (obj === prevGrabbed && comp) {
                        comp.onPointerUp?.call(comp, opts);
                        this.raisedPointerDownEvents.splice(i, 1);
                        this.raisedPointerDownObjects.splice(i, 1);
                        i--;
                    }
                }
            }
        };

        const controllerRcOpts = new RaycastOptions();
        this._selectUpdateFn ??= (_ctrl: WebXRController) => {
            controllerRcOpts.ray = _ctrl.getRay();
            const rc = this.performRaycast(controllerRcOpts);
            if (!rc) return;
            const opts = new PointerEventData();
            opts.inputSource = _ctrl;
            this.handleIntersections(rc, opts);
        };

        WebXRController.addEventListener(ControllerEvents.SelectStart, this._selectStartFn);
        WebXRController.addEventListener(ControllerEvents.SelectEnd, this._selectEndFn);
        WebXRController.addEventListener(ControllerEvents.Update, this._selectUpdateFn);

        // TODO: unregister
        this._handleEventFn ??= this.onHandleEvents.bind(this);
        this.context.pre_update_callbacks.push(this._handleEventFn);
        // If we subscribe to those events here we get duplicate event handling for e.g. button clicks
        // I think this was done as a workaround for the InputField where we needed to handle the event within the browser event method
        // without it (via pre_update callbacks) we handle the events outside of the browser loop delayed which doesnt work for some cases
        // this.context.input.addEventListener(InputEvents.PointerDown, this._handleEventFn);
        // this.context.input.addEventListener(InputEvents.PointerUp, this._handleEventFn);
        // this.context.input.addEventListener(InputEvents.PointerMove, this._handleEventFn);
    }

    onDisable(): void {
        WebXRController.removeEventListener(ControllerEvents.SelectStart, this._selectStartFn);
        WebXRController.removeEventListener(ControllerEvents.SelectEnd, this._selectEndFn);
        WebXRController.removeEventListener(ControllerEvents.Update, this._selectUpdateFn);

        this.context.pre_update_callbacks.splice(this.context.pre_update_callbacks.indexOf(this._handleEventFn), 1);
        // this.context.input.removeEventListener(InputEvents.PointerDown, this._handleEventFn);
        // this.context.input.removeEventListener(InputEvents.PointerUp, this._handleEventFn);
        // this.context.input.removeEventListener(InputEvents.PointerMove, this._handleEventFn);
    }


    // doesnt work in dist
    // onBeforeRender() {
    //     MeshUIHelper.update(this.context);
    // }

    private lastPointerEvent: PointerEventData | null = null;
    private objectsHoveredThisFrame: THREE.Object3D[] = [];
    private objectsHoveredLastFrame: THREE.Object3D[] = [];

    // todo: these should be listed by input source (e.g. per controller, mouse, touch)
    private raisedPointerDownEvents: IPointerEventHandler[] = []; // << keep in sync
    private raisedPointerDownObjects: THREE.Object3D[] = []; // < keep in sync

    private _didMove: boolean = false;


    onHandleEvents() {
        this.objectsHoveredThisFrame.length = 0;
        this.resetMeshUIStates();

        if (WebXR.IsInWebXR) return;
        // console.log(this.context.input.isKeyPressed(KeyCode.ALT));
        if (this.context.input.isKeyPressed(KeyCode.ALT)) {
            // console.log("alt pressed");
            return;
        }
        if (!this._didMove) {
            const pos = this.context.input.getPointerPositionRC(0);
            if (pos && pos.x === 0 && pos.y === 0) return;
            this._didMove = true;
        }

        let pointerId = 0;
        for (const i of this.context.input.foreachPointerId()) {
            const isDown = this.context.input.getPointerDown(i);
            const isUp = this.context.input.getPointerUp(i);
            if (isDown || isUp) {
                pointerId = i;
                break;
            }
        }

        const ptr = this.context.input.getPointerEvent(pointerId);
        // console.log(ptr);
        const args: PointerEventData = new PointerEventData(ptr);
        args.inputSource = this.context.input;
        args.pointerId = pointerId;
        args.isClicked = this.context.input.getPointerClicked(pointerId)
        args.isDown = this.context.input.getPointerDown(pointerId);
        args.isUp = this.context.input.getPointerUp(pointerId);
        args.isPressed = this.context.input.getPointerPressed(pointerId);
        if (debug && args.isClicked) console.log("CLICK", pointerId);

        const hits = this.performRaycast(null);
        if (!hits) return;
        this.lastPointerEvent = args;

        const evt = {
            sender: this,
            args: args,
            hasActiveUI: this.currentActiveMeshUIComponents.length > 0,
        }
        this.dispatchEvent(new CustomEvent(EventSystemEvents.BeforeHandleInput, { detail: evt }))
        this.handleIntersections(hits, args);
        this.dispatchEvent(new CustomEvent(EventSystemEvents.AfterHandleInput, { detail: evt }))
    }

    private _tempComponentsArray: Behaviour[] = [];
    onBeforeRender() {

        if (this.lastPointerEvent)
            this.lastPointerEvent.used = false;
        else return;

        if (this.lastPointerEvent.isUp) {
            for (const obj of this.raisedPointerDownEvents) {
                if (obj.onPointerUp) {
                    obj.onPointerUp(this.lastPointerEvent);
                }
            }
            this.raisedPointerDownEvents.length = 0;
            this.raisedPointerDownObjects.length = 0;
        }

        for (const obj of this.objectsHoveredLastFrame) {
            // if the object is not hovered anymore we want to call the exit events
            if (this.objectsHoveredThisFrame.indexOf(obj) < 0) {
                // console.log("LAST", ...this.objectsHoveredLastFrame);
                // console.log("THIS", ...this.objectsHoveredThisFrame);
                this._tempComponentsArray.length = 0;
                const behaviours = GameObject.getComponentsInParent(obj, Behaviour, this._tempComponentsArray);
                this.lastPointerEvent.object = obj;
                for (let i = 0; i < behaviours.length; i++) {
                    const beh = behaviours[i];
                    if (!beh.gameObject || beh.destroyed) continue;
                    const inst: any = beh;
                    if (inst.onPointerExit) {
                        inst.onPointerExit(this.lastPointerEvent);
                    }
                }
            }
        }
        // swap arrays
        const arr = this.objectsHoveredLastFrame;
        this.objectsHoveredLastFrame = this.objectsHoveredThisFrame;
        this.objectsHoveredThisFrame = arr;
    }

    private _sortedHits: THREE.Intersection[] = [];

    private performRaycast(opts: RaycastOptions | null): THREE.Intersection[] | null {
        if (!this.raycaster) return null;
        this._sortedHits.length = 0;
        for (const rc of this.raycaster) {
            if (!rc.activeAndEnabled) continue;
            const res = rc.performRaycast(opts);
            if (res && res.length > 0)
                this._sortedHits.push(...res);
        }
        this._sortedHits.sort((a, b) => {
            return a.distance - b.distance;
        });
        return this._sortedHits;
    }

    private handleIntersections(hits: THREE.Intersection[], args: PointerEventData): boolean {
        if (!hits || hits.length <= 0) return false;
        // if (pressed)
        //     console.log(this.context.alias, ...hits);
        hits = this.sortCandidates(hits);
        for (const hit of hits) {
            const { object } = hit;
            if (this.handleEvents(object, args)) {
                return true;
            }
        }
        return false;
    }

    private _sortingBuffer: THREE.Intersection[] = [];
    private _noDepthTestingResults: THREE.Intersection[] = [];

    private sortCandidates(hits: THREE.Intersection[]): THREE.Intersection[] {
        // iterate over all hits and filter for nodepth objects and normal hit objects
        // the no-depth objects will be handled first starting from the closest
        // assuming the hits array is sorted by distance (closest > furthest)
        this._sortingBuffer.length = 0;
        this._noDepthTestingResults.length = 0;
        for (let i = 0; i < hits.length; i++) {
            const hit = hits[i];
            const object = hit.object as THREE.Mesh;
            if (object.material) {
                if (object.material["depthTest"] === false) {
                    this._noDepthTestingResults.push(hit);
                    continue;
                }
            }
            this._sortingBuffer.push(hit);
        }
        for (const obj of this._sortingBuffer) {
            this._noDepthTestingResults.push(obj);
        }
        return this._noDepthTestingResults;
    }

    private handleEventsArray: Array<Behaviour> = [];
    private out: { canvasGroup?: ICanvasGroup } = {};

    private handleEvents(object: THREE.Object3D, args: PointerEventData): boolean {

        if (!this.testIsVisible(object)) {
            if (args.isClicked && debug)
                console.log("not allowed", object);
            return false;
        }

        const originalObject = object;
        args.object = object;
        this.lastPointerEvent = args;

        const parent = object.parent as any;
        let isShadow = false;
        const clicked = args.isClicked ?? false;

        let canvasGroup: ICanvasGroup | null = null;

        // handle potential shadow dom built from three mesh ui
        if (parent && parent.isUI) {
            const pressedOrClicked = (args.isPressed || args.isClicked) ?? false;
            if (parent[$shadowDomOwner]) {
                const actualGo = parent[$shadowDomOwner].gameObject;
                if (actualGo) {
                    const res = UIRaycastUtils.isInteractable(actualGo, this.out);
                    // console.log(actualGo, res);
                    if (!res) return this.out.canvasGroup?.interactable ?? false;
                    canvasGroup = this.out.canvasGroup ?? null;

                    const handled = this.handleMeshUIIntersection(object, pressedOrClicked);
                    if (!clicked && handled) {
                        // return true;
                    }
                    object = actualGo;
                    isShadow = true;
                }
            }

            if (!isShadow) {
                const obj = this.handleMeshUiObjectWithoutShadowDom(parent, pressedOrClicked);
                if (obj) return true;
            }
        }

        // if (clicked)
        //     console.log(this.context.time.frame, object);
        this.objectsHoveredThisFrame.push(object);

        if (canvasGroup === null || canvasGroup.interactable) {
            const isHovered = this.objectsHoveredLastFrame.indexOf(object) >= 0;
            this.handleEventsArray.length = 0;
            const behaviours = GameObject.getComponentsInParent(object, Behaviour, this.handleEventsArray);
            // console.log(behaviours);
            for (let i = 0; i < behaviours.length; i++) {
                if (args.used) return true;
                if (behaviours[i].destroyed) continue;
                const comp = behaviours[i] as any;

                if (comp.interactable === false) continue;

                if (comp.onPointerEnter) {
                    if (!isHovered) {
                        comp.onPointerEnter(args);
                    }
                }

                if (args.isDown) {
                    if (comp.onPointerDown && !this.raisedPointerDownEvents.includes(comp)) {
                        comp.onPointerDown(args);
                        // need to save this to also send pointer up event
                        this.raisedPointerDownEvents.push(comp);
                        this.raisedPointerDownObjects.push(originalObject);
                    }
                }

                if (args.isUp) {
                    if (comp.onPointerUp) {
                        comp.onPointerUp(args);
                    }
                }

                if (args.isClicked) {
                    if (comp.onPointerClick) {
                        comp.onPointerClick(args);
                    }
                }
            }
        }

        return true;
    }

    private handleMeshUiObjectWithoutShadowDom(obj: any, pressed: boolean) {
        if (!obj || !obj.isUI) return true;
        const hit = this.handleMeshUIIntersection(obj, pressed);

        return hit;
    }

    private currentActiveMeshUIComponents: ThreeMeshUI.Block[] = [];

    private handleMeshUIIntersection(meshUiObject: THREE.Object3D, pressed: boolean): boolean {
        const res = MeshUIHelper.updateState(meshUiObject, pressed);
        if (res) {
            this.currentActiveMeshUIComponents.push(res);
        }
        return res !== null;
    }

    private resetMeshUIStates() {

        if (this.context.input.getPointerPressedCount() > 0) {
            MeshUIHelper.resetLastSelected();
        }

        if (!this.currentActiveMeshUIComponents || this.currentActiveMeshUIComponents.length <= 0) return;
        for (let i = 0; i < this.currentActiveMeshUIComponents.length; i++) {
            const comp = this.currentActiveMeshUIComponents[i];
            MeshUIHelper.resetState(comp);
        }
        this.currentActiveMeshUIComponents.length = 0;
    }

    private testIsVisible(obj: THREE.Object3D | null): boolean {
        if (!obj) return true;
        if (!GameObject.isActiveSelf(obj)) return false;
        return this.testIsVisible(obj.parent);
    }
}


class MeshUIHelper {

    private static lastSelected: THREE.Object3D | null = null;
    private static lastUpdateFrame: { context: Context, frame: number }[] = [];
    private static needsUpdate: boolean = false;

    static markDirty() {
        this.needsUpdate = true;
    }

    static update(threeMeshUI: any, context: Context) {
        for (const lu of this.lastUpdateFrame) {
            if (lu.context === context) {
                if (context.time.frameCount === lu.frame) return;
                lu.frame = context.time.frameCount;
                if (this.needsUpdate || context.time.frameCount < 30) {
                    this.needsUpdate = false;
                    threeMeshUI.update();
                }
                return;
            }
        }
        this.lastUpdateFrame = [{ context, frame: context.time.frameCount }];
        threeMeshUI.update();
    }

    static updateState(intersect: THREE.Object3D, selectState: boolean): ThreeMeshUI.Block | null {
        let foundBlock: ThreeMeshUI.Block | null = null;

        if (intersect) {
            foundBlock = this.findBlockInParent(intersect);
            // console.log(intersect, "-- found block:", foundBlock)
            if (foundBlock && foundBlock !== this.lastSelected) {
                const interactable = foundBlock["interactable"];
                if (interactable === false) return null;
                if (selectState) {
                    this.lastSelected = foundBlock;
                    //@ts-ignore
                    if (foundBlock.states["pressed"])
                        //@ts-ignore
                        foundBlock.setState("pressed");

                } else {
                    //@ts-ignore
                    if (foundBlock.states["hovered"])
                        //@ts-ignore
                        foundBlock.setState("hovered");
                };
                this.needsUpdate = true;
            }
        }

        // Update non-targeted buttons state
        // MeshUIBaseComponent.objectsWithState.forEach((obj) => {
        //     if ((!intersect || obj !== foundBlock) && obj.isUI) {
        //         obj.setState('idle');
        //     };
        // });

        return foundBlock;
    }

    static resetLastSelected() {
        const last = this.lastSelected;
        if (!last) return;
        this.lastSelected = null;
        this.resetState(last);
    }

    static resetState(obj: any) {
        if (!obj) return;
        const interactable = obj["interactable"];
        if (interactable === false) {
            if (obj.states["disabled"])
                obj.setState("disabled");
        }
        else if (obj === this.lastSelected && obj.states["selected"]) {
            obj.setState("selected");
        }
        else obj.setState('normal');
        this.needsUpdate = true;
    }

    static findBlockInParent(elem: any): ThreeMeshUI.Block | null {
        if (!elem) return null;
        if (elem.isBlock) {
            if (Object.keys(elem.states).length > 0)
                return elem;
        }
        return this.findBlockInParent(elem.parent);
    }
}