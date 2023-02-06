import { onChange, updateRenderSettings as updateRenderSettingsRecursive } from "./Utils";
import { serializable } from "../../engine/engine_serialization_decorator";
import { FrameEvent } from "../../engine/engine_setup";
import { BaseUIComponent, UIRootComponent } from "./BaseUIComponent";
import { Mathf } from "../../engine/engine_math";
import * as THREE from "three";
import { getComponentsInChildren } from "../../engine/engine_components";
import { IComponent } from "../../engine/engine_types";
import { GameObject } from "../Component";
import { showBalloonMessage, showBalloonWarning } from "../../engine/debug";

export enum RenderMode {
    ScreenSpaceOverlay = 0,
    ScreenSpaceCamera = 1,
    WorldSpace = 2,
}

export class Canvas extends UIRootComponent {

    @serializable()
    set renderOnTop(val: boolean) {
        if (val === this._renderOnTop) {
            return;
        }
        this._renderOnTop = val;
        this.onRenderSettingsChanged();
    }
    get renderOnTop() { return this._renderOnTop; }
    private _renderOnTop: boolean = false;

    @serializable()
    set depthWrite(val: boolean) {
        if (this._depthWrite === val) return;
        this._depthWrite = val;
        this.onRenderSettingsChanged();
    }
    get depthWrite() { return this._depthWrite; }
    private _depthWrite: boolean = false;

    @serializable()
    set doubleSided(val: boolean) {
        if (this._doubleSided === val) return;
        this._doubleSided = val;
        this.onRenderSettingsChanged();
    }
    get doubleSided() { return this._doubleSided; }
    private _doubleSided: boolean = true;

    @serializable()
    set castShadows(val: boolean) {
        if (this._castShadows === val) return;
        this._castShadows = val;
        this.onRenderSettingsChanged();
    }
    get castShadows() { return this._castShadows; }
    private _castShadows: boolean = true;

    @serializable()
    set receiveShadows(val: boolean) {
        if (this._receiveShadows === val) return;
        this._receiveShadows = val;
        this.onRenderSettingsChanged();
    }
    get receiveShadows() { return this._receiveShadows; }
    private _receiveShadows: boolean = true;


    @serializable()
    get renderMode(): RenderMode {
        return this._renderMode;
    }
    set renderMode(val: RenderMode) {
        if (this._renderMode === val) return;
        this._renderMode = val;
        this.onRenderSettingsChanged();
    }
    private _renderMode: RenderMode = -1;

    private _rootCanvas!: Canvas;

    @serializable(Canvas)
    set rootCanvas(val: Canvas) {
        if (this._rootCanvas instanceof Canvas) return;
        this._rootCanvas = val;
    }

    get rootCanvas(): Canvas {
        return this._rootCanvas;
    }

    private _scaleFactor: number = 1;
    @serializable()
    get scaleFactor(): number {
        return this._scaleFactor;
    }
    private set scaleFactor(val: number) {
        this._scaleFactor = val;
    }

    awake() {
        this.shadowComponent = this.gameObject;
        super.awake();
    }

    onEnable() {
        super.onEnable();
        this._updateRenderSettingsRoutine = undefined;
        this.onRenderSettingsChanged();
    }

    private previousAspect: number = -1;

    onBeforeRender() {
        if (this.isScreenSpace && this.context.mainCameraComponent && this.context.mainCameraComponent.aspect !== this.previousAspect) {
            this.previousAspect = this.context.mainCameraComponent.aspect;
            this.updateRenderMode();
        }
    }

    applyRenderSettings(){
        this.onRenderSettingsChanged();
    }

    private _updateRenderSettingsRoutine?: Generator;
    private onRenderSettingsChanged() {
        if (this._updateRenderSettingsRoutine) return;
        this._updateRenderSettingsRoutine = this.startCoroutine(this._updateRenderSettingsDelayed(), FrameEvent.OnBeforeRender);
    }

    private *_updateRenderSettingsDelayed() {
        yield;
        this._updateRenderSettingsRoutine = undefined;
        if (this.shadowComponent) {
            this.updateRenderMode();
            // this.onWillUpdateRenderSettings();
            updateRenderSettingsRecursive(this.shadowComponent, this);
            for (const ch of GameObject.getComponentsInChildren(this.gameObject, BaseUIComponent)) {
                updateRenderSettingsRecursive(ch.shadowComponent!, this);
            }
        }
    }

    private _activeRenderMode: RenderMode = -1;

    private get isScreenSpace(): boolean {
        return this._activeRenderMode === RenderMode.ScreenSpaceCamera || this._activeRenderMode === RenderMode.ScreenSpaceOverlay;
    }

    private updateRenderMode() {
        if (this.renderMode === this._activeRenderMode) return;
        switch (this.renderMode) {
            case RenderMode.ScreenSpaceOverlay:
            case RenderMode.ScreenSpaceCamera:
                showBalloonWarning("Screenspace Canvas is not supported yet. Please use worldspace");
                const camera = this.context.mainCameraComponent;
                if (!camera) return;
                const canvas = this.gameObject;
                const camObj = camera.gameObject;
                camObj?.add(canvas);
                const pos = camera.farClipPlane;
                canvas.position.x = 0;
                canvas.position.y = 0;
                canvas.position.z = -pos;

                // console.log(this.shadowComponent)

                if (camera.fieldOfView) {
                    const w = Math.tan(Mathf.toRadians(camera.fieldOfView) * pos) * (camera.aspect * 1.333333);
                    const h = w * (this.context.domHeight / this.context.domWidth);
                    canvas.scale.x = -w;
                    canvas.scale.y = h;

                }
                // const rects = this.gameObject.getComponentsInChildren(BaseUIComponent);
                // for (const rect of rects) {
                //     rect.set({ width: this.context.domWidth * .5, height: 100 })
                // }

                break;
            case RenderMode.WorldSpace:

                break;
        }
    }
}