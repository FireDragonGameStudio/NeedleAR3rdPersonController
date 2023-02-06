import { Behaviour } from "../Component";
import * as ThreeMeshUI from 'three-mesh-ui'
import { BaseUIComponent } from "./BaseUIComponent";
import { serializable } from "../../engine/engine_serialization_decorator";
import { Color, Matrix4, Object3D, Vector2, Vector3 } from "three";
import { EventSystem } from "./EventSystem";
import { getParam } from "../../engine/engine_utils";
import { onChange } from "./Utils";

const debug = getParam("debugui");

export class Size {
    width!: number;
    height!: number;
}

export class Rect {
    x!: number;
    y!: number;
    width!: number;
    height!: number;
}

export class RectTransform extends BaseUIComponent {

    offset: number = 0.01;

    // @serializable(Object3D)
    // root? : Object3D;

    get translation() { return this.gameObject.position; }
    get rotation() { return this.gameObject.quaternion; }
    get scale(): THREE.Vector3 { return this.gameObject.scale; }

    private _anchoredPosition!: Vector3;
    private get anchoredPosition() {
        if (!this._anchoredPosition) this._anchoredPosition = new Vector3();
        return this._anchoredPosition;
    }

    @serializable(Rect)
    rect?: Rect;
    @serializable(Vector2)
    sizeDelta!: THREE.Vector2;
    @serializable(Vector3)
    anchoredPosition3D?: THREE.Vector3;
    @serializable(Vector2)
    pivot?: THREE.Vector2;

    private lastMatrix!: Matrix4;
    private rectBlock!: Object3D;
    private _transformNeedsUpdate: boolean = false;

    awake() {
        super.awake();
        this.lastMatrix = new Matrix4();
        this.rectBlock = new Object3D();;
        this.rectBlock.position.z = .1;
        this.rectBlock.name = this.name;

        // this is required if an animator animated the transform anchoring
        if (!this._anchoredPosition) this._anchoredPosition = new Vector3();
        onChange(this, "_anchoredPosition", () => { this._transformNeedsUpdate = true; });
    }

    onEnable() {
        super.onEnable();
        this.addShadowComponent(this.rectBlock);
        this._transformNeedsUpdate = true;
    }

    onDisable() {
        super.onDisable();
        this.removeShadowComponent();
    }

    private applyTransform() {
        const uiobject = this.shadowComponent;
        if (!uiobject) return;
        this._transformNeedsUpdate = false;

        if (!this.isRoot()) {
            // this.gameObject transform has authority over three mesh ui shadow components
            // so we keep copy the transform to the threemesh ui components
            uiobject.position.copy(this.gameObject.position);
            uiobject.position.x *= -1;
            uiobject.position.z *= -1;
            // move slightly forward to avoid z fighting
            uiobject.position.z -= this.offset;

            uiobject.quaternion.copy(this.gameObject.quaternion);
            uiobject.rotation.x *= -1;
            // flip images
            uiobject.rotation.z *= -1;

            uiobject.scale.copy(this.gameObject.scale);
        }
        else {
            uiobject.rotation.y = Math.PI;
        }

        this.applyAnchoring(uiobject.position);
        this.lastMatrix.copy(this.gameObject.matrix);
    }

    markDirty() {
        this._transformNeedsUpdate = true;
    }

    onBeforeRender() {
        // only handle update here if this is not the canvas
        // the canvas component does inherit from this class but it only serves as a root
        // it does not emit any UI elements and therefor we dont want to change its transform
        // if (this._parentComponent) 
        // {
        const transformChanged = this._transformNeedsUpdate || this.lastMatrix.equals(this.gameObject.matrix) === false;
        if (transformChanged) {
            if (debug)
                console.log("updating", this.name);
            this.applyTransform();
        }
        // }
        EventSystem.ensureUpdateMeshUI(ThreeMeshUI, this.context);
    }

    private applyAnchoring(pos: THREE.Vector3) {
        if (this.pivot && this.sizeDelta) {
            let tx = (this.pivot.x * 2 - 1);
            let ty = (this.pivot.y * 2 - 1);
            // tx -= this.m_AnchoredPosition.x * .05;
            ty -= this.anchoredPosition.y * .05;
            const offx = this.sizeDelta.x * tx;
            const offy = this.sizeDelta.y * ty;
            // console.log(this.name, this.pivot, tx, ty, "offset", offx, offy);
            pos.x -= offx * .5;
            pos.y -= offy * .5;
        }
    }

    getBasicOptions(): ThreeMeshUI.BlockOptions {
        const opts = {
            width: this.rect!.width,
            height: this.rect!.height,// * this.context.mainCameraComponent!.aspect,
            offset: this.offset,
            backgroundOpacity: 0,
            borderWidth: 0, // if we dont specify width here a border will automatically propagated to child blocks
            borderRadius: 0,
            borderOpacity: 0,
            // justifyContent: 'center',
            // alignItems: 'center',
            // alignContent: 'center',
            // backgroundColor: new Color(1, 1, 1),
        };
        this.ensureValidSize(opts);
        return opts;
    }

    // e.g. when a transform has the size 0,0 we still want to render the text
    private ensureValidSize(opts: Size, fallbackWidth = 0.0001): Size {
        if (opts.width <= 0) {
            opts.width = fallbackWidth;
        }
        if (opts.height <= 0) opts.height = 0.0001;
        return opts;
    }

    private _createdBlocks : ThreeMeshUI.Block[] = [];

    createNewBlock(opts?: ThreeMeshUI.BlockOptions | object): ThreeMeshUI.Block {
        opts = {
            ...this.getBasicOptions(),
            ...opts
        };
        if (debug)
            console.log(this.name, opts);
        const block = new ThreeMeshUI.Block(opts as ThreeMeshUI.BlockOptions);
        this._createdBlocks.push(block);
        return block;
    }
}