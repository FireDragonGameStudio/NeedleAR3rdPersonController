// import { Canvas } from './Canvas';
import * as ThreeMeshUI from 'three-mesh-ui';
import { Behaviour, GameObject } from "../Component";
import { EventSystem } from "./EventSystem";
import { showGizmos } from '../../engine/engine_default_parameters';
import { AxesHelper, Object3D } from 'three';
import { IGraphic } from './Interfaces';
import { ShadowCastingMode } from '../Renderer';
export const includesDir = "./include";

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy


ThreeMeshUI.Block.prototype["interactable"] = {
    get() {
        return this.interactive;
    },
    set(value) {
        this.interactable = value;
    }
}

export const $shadowDomOwner = Symbol("shadowDomOwner");

export class BaseUIComponent extends Behaviour {

    isRoot() { return this.Root?.gameObject === this.gameObject; }

    markDirty() {
        EventSystem.markUIDirty(this.context);
    }

    shadowComponent: ThreeMeshUI.Block | null = null;

    private _controlsChildLayout = true;
    get controlsChildLayout(): boolean { return this._controlsChildLayout; }
    set controlsChildLayout(val: boolean) {
        this._controlsChildLayout = val;
        if (this.shadowComponent) {
            //@ts-ignore
            (this.shadowComponent as ThreeMeshUI.MeshUIComponent).autoLayout = val;
        }
    }

    private _root?: UIRootComponent | null = undefined;
    protected get Root(): UIRootComponent | null {
        if (this._root === undefined) {
            this._root = GameObject.getComponentInParent(this.gameObject, UIRootComponent);
        }
        return this._root;
    }

    // private _intermediate?: Object3D;
    protected _parentComponent?: BaseUIComponent | null = undefined;

    onEnable() {
        super.onEnable();
    }

    //@ts-ignore
    protected addShadowComponent(container: any, parent?: BaseUIComponent) {

        this.removeShadowComponent();

        // instead of inserting here, we attach to the matching shadow hierarchy starting with the Canvas component.
        const searchFrom = this.isRoot() ? this.gameObject : this.gameObject.parent;
        this._parentComponent = GameObject.getComponentInParent(searchFrom!, BaseUIComponent);
        if (!this._parentComponent) {
            console.warn(`Component \"${this.name}\" doesn't have a UI parent anywhere. Do you have an UI element outside a Canvas? UI components must be a child of a Canvas component`, this);
            return;
        }

        container.name = this.name + " (" + (this.constructor.name ?? "UI") + ")";
        container.autoLayout = this._parentComponent.controlsChildLayout;
        container[$shadowDomOwner] = this;

        // TODO: raycastTarget doesnt work anymore -> i think we need to set the gameObject layer and then check in the raycaster if the shadowComponentOwner is on the correct layer?!
        // const raycastTarget = (this as unknown as IGraphic).raycastTarget;
        // this.gameObject.layers.set(2)


        // TODO: only traverse our own hierarchy, we can stop if we find another owner
        container.traverse(c => {
            if (c[$shadowDomOwner] === undefined) {
                c[$shadowDomOwner] = this;
            }

            // // this makes text not render anymore when enabled again
            // if (raycastTarget === false) {
            //     c.layers.set(2);
            // }
        });

        let needsUpdate = false;

        if (this.Root?.gameObject === this.gameObject) {
            this.gameObject.add(container);
        }
        else {
            let targetShadowComponent = this._parentComponent.shadowComponent;
            if (targetShadowComponent) {
                // console.log("ADD", this.name, "to", this._parentComponent.name, targetShadowComponent);
                targetShadowComponent?.add(container);
                needsUpdate = true;
            }
        }
        this.shadowComponent = container;
        if (parent && parent.shadowComponent && this.shadowComponent) {
            parent.shadowComponent.add(this.shadowComponent);
        }
        // this.applyTransform();

        if (showGizmos) {
            container.add(new AxesHelper(.5));
        }

        this.onAfterAddedToScene();

        // make sure to update the layout when adding content
        // otherwise it will fail when object are enabled at runtime
        if (needsUpdate)
            ThreeMeshUI.update();
    }


    set(_state: object) {
        // if (!this.shadowComponent) return;
        // this.traverseOwnedShadowComponents(this.shadowComponent, this, o => {
        //     for (const ch of o.children) {
        //         console.log(this, ch);
        //         if (ch.isUI && typeof ch.set === "function") {
        //             // ch.set(state);
        //             // ch.update(true, true, true);
        //         }
        //     }
        // })
    }

    private traverseOwnedShadowComponents(current: Object3D, owner: any, callback: (obj: any) => void) {
        if (!current) return;
        if (current[$shadowDomOwner] === owner) {
            callback(current);
            for (const ch of current.children) {
                this.traverseOwnedShadowComponents(ch, owner, callback);
            }
        }
    }

    protected removeShadowComponent() {
        if (this.shadowComponent) {
            this.shadowComponent.removeFromParent();
        }
    }

    protected onAfterAddedToScene() {

    }

    setInteractable(value: boolean) {
        if (this.shadowComponent) {
            //@ts-ignore
            this.shadowComponent.interactable = value;
        }
    }
}

export class UIRootComponent extends BaseUIComponent {
    awake() {
        super.awake();
    }
}