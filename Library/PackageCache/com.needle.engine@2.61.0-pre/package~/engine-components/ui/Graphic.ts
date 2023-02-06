import { IGraphic } from './Interfaces';
import * as ThreeMeshUI from 'three-mesh-ui'
import { RGBAColor } from "../js-extensions/RGBAColor"
import { BaseUIComponent } from "./BaseUIComponent";
import { serializable } from '../../engine/engine_serialization_decorator';
import { Color, LinearEncoding, sRGBEncoding, Texture } from 'three';
import { RectTransform } from './RectTransform';
import { onChange, scheduleAction } from "./Utils"
import { GameObject } from '../Component';


export class Graphic extends BaseUIComponent implements IGraphic {

    get isGraphic() { return true; }

    @serializable(RGBAColor)
    get color(): RGBAColor {
        if (!this._color) this._color = new RGBAColor(1, 1, 1, 1);
        return this._color;
    }
    set color(col: RGBAColor) {
        const changed = !this._color || this._color.r !== col.r || this._color.g !== col.g || this._color.b !== col.b || this._color.alpha !== col.alpha;
        if (!changed) return;
        if (!this._color) {
            this._color = new RGBAColor(1, 1, 1, 1);
        }
        this._color.copy(col);
    }
    protected onColorChanged() {
        const newcolor = this.color;
        this.setOptions({ backgroundColor: newcolor, backgroundOpacity: newcolor.alpha, borderOpacity: newcolor.alpha });
    }

    // used via animations
    private get m_Color() {
        return this._color;
    }

    @serializable()
    raycastTarget: boolean = true;

    protected uiObject: ThreeMeshUI.Block | null = null;
    private _color: RGBAColor = null!;


    private _rect: RectTransform | null = null;
    protected get rectTransform(): RectTransform {
        if (!this._rect) {
            this._rect = GameObject.getComponent(this.gameObject, RectTransform);
        }
        return this._rect!;
    }

    setState(state: string) {
        this.makePanel();
        if (this.uiObject) {
            //@ts-ignore
            this.uiObject.setState(state);
        }
    }

    setupState(state: object) {
        this.makePanel();
        if (this.uiObject) {
            //@ts-ignore
            this.uiObject.setupState(state);
        }
    }

    setOptions(opts: object) {
        this.makePanel();
        if (this.uiObject) {
            //@ts-ignore
            this.uiObject.set(opts);
            if (opts["backgroundColor"] !== undefined || opts["backgroundOpacity"] !== undefined)
                this.uiObject["updateBackgroundMaterial"]?.call(this.uiObject);
        }
    }

    awake() {
        super.awake();
        this.makePanel();

        // when _color is written to
        onChange(this, "_color", () => scheduleAction(this, this.onColorChanged));
    }

    onEnable(): void {
        super.onEnable();
        if (this.uiObject) {
            this.rectTransform.shadowComponent?.add(this.uiObject);
            this.addShadowComponent(this.uiObject, this.rectTransform);
        }

    }

    onDisable(): void {
        super.onDisable();
        if (this.uiObject)
            this.removeShadowComponent();
    }

    private _currentlyCreatingPanel: boolean = false;
    protected makePanel() {
        if (this.uiObject) return;
        if (this._currentlyCreatingPanel) return;
        this._currentlyCreatingPanel = true;

        const opts = {
            backgroundColor: this.color,
            backgroundOpacity: this.color.alpha,
            offset: 1, // without a tiny offset we get z fighting
        };
        this.onBeforeCreate(opts);
        this.onCreate(opts);
        this.controlsChildLayout = false;
        this._currentlyCreatingPanel = false;
        this.onAfterCreated();
    }

    protected onBeforeCreate(_opts: any) { }

    protected onCreate(opts: any) {
        this.uiObject = this.rectTransform.createNewBlock(opts);
        this.uiObject.name = this.name;
    }
    protected onAfterCreated() { }

    /** used internally to ensure textures assigned to UI use linear encoding */
    static textureCache: Map<Texture, Texture> = new Map();

    protected async setTexture(tex: Texture | null | undefined) {
        if (!tex) return;
        this.setOptions({ backgroundOpacity: 0 });
        if (tex) {
            // workaround for https://github.com/needle-tools/needle-engine-support/issues/109
            if(tex.encoding === sRGBEncoding) {
                if(Graphic.textureCache.has(tex)) {
                    tex = Graphic.textureCache.get(tex)!;
                } else {
                    const clone = tex.clone();
                    clone.encoding = LinearEncoding;
                    Graphic.textureCache.set(tex, clone);
                    tex = clone;
                }
            }
            this.setOptions({ backgroundTexture: tex, borderRadius: 0, backgroundOpacity: this.color.alpha, backgroundSize: "stretch" });
        }
    }

    protected onAfterAddedToScene(): void {
        super.onAfterAddedToScene();
        if (this.shadowComponent) {
            //@ts-ignore
            this.shadowComponent.offset = this.shadowComponent.position.z;

            // console.log(this.shadowComponent);
            // setTimeout(()=>{
            //     this.shadowComponent?.traverse(c => {
            //         console.log(c);
            //         if(c.material) c.material.depthTest = false;
            //     });
            // },1000);
        }
    }
}

export class MaskableGraphic extends Graphic {

    private _flippedObject = false;

    protected onAfterCreated() {
        // flip image
        if (this.uiObject && !this._flippedObject) {
            this._flippedObject = true;
            this.uiObject.scale.y *= -1;
        }
    }
}