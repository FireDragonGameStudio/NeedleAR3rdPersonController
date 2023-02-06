import { Behaviour, GameObject } from "../Component";
import { EventList } from "../EventList";
import { IPointerClickHandler, IPointerEnterHandler, IPointerEventHandler, IPointerExitHandler, PointerEventData } from "./PointerEvents";
import { Image } from "./Image";
import { RGBAColor } from "../js-extensions/RGBAColor";
import { serializable } from "../../engine/engine_serialization_decorator";
import { Animator } from "../Animator";
import { getParam } from "../../engine/engine_utils";

const debug = getParam("debugbutton");

/// <summary>
///Transition mode for a Selectable.
/// </summary>
export enum Transition {
    /// <summary>
    /// No Transition.
    /// </summary>
    None,
    /// <summary>
    /// Use an color tint transition.
    /// </summary>
    ColorTint,
    /// <summary>
    /// Use a sprite swap transition.
    /// </summary>
    SpriteSwap,
    /// <summary>
    /// Use an animation transition.
    /// </summary>
    Animation
}

class ButtonColors {
    @serializable()
    colorMultiplier!: 1;
    @serializable(RGBAColor)
    disabledColor!: RGBAColor;
    @serializable()
    fadeDuration!: number;
    @serializable(RGBAColor)
    highlightedColor!: RGBAColor;
    @serializable(RGBAColor)
    normalColor!: RGBAColor;
    @serializable(RGBAColor)
    pressedColor!: RGBAColor;
    @serializable(RGBAColor)
    selectedColor!: RGBAColor;
}

declare type AnimationTriggers = {
    disabledTrigger: string,
    highlightedTrigger: string,
    normalTrigger: string,
    pressedTrigger: string,
    selectedTrigger: string,
}

export class Button extends Behaviour implements IPointerEventHandler {

    @serializable(EventList)
    onClick?: EventList;

    private _isHovered: boolean = false;

    onPointerEnter(_) {
        if (debug)
            console.log("Button Enter", this.animationTriggers?.highlightedTrigger, this.animator);
        this._isHovered = true;
        if (this.transition == Transition.Animation && this.animationTriggers && this.animator) {
            this.animator.SetTrigger(this.animationTriggers.highlightedTrigger);
        }
        else if(this.transition === Transition.ColorTint && this.colors) {
            this._image?.setState("hovered");
        }
        this.context.input.setCursorPointer();
    }

    onPointerExit() {
        if (debug)
            console.log("Button Exit", this.animationTriggers?.highlightedTrigger, this.animator);
        this._isHovered = false;
        if (this.transition == Transition.Animation && this.animationTriggers && this.animator) {
            this.animator.SetTrigger(this.animationTriggers.normalTrigger);
        }
        else if(this.transition === Transition.ColorTint && this.colors) {
            this._image?.setState("normal");
        }
        this.context.input.setCursorNormal();
    }

    onPointerDown(_) {
        if (debug)
            console.log("Button Down", this.animationTriggers?.highlightedTrigger, this.animator);
        if (this.transition == Transition.Animation && this.animationTriggers && this.animator) {
            this.animator.SetTrigger(this.animationTriggers.pressedTrigger);
        }
        else if(this.transition === Transition.ColorTint && this.colors) {
            this._image?.setState("pressed");
        }
    }

    onPointerUp(_) {
        if (debug)
            console.log("Button Down", this.animationTriggers?.highlightedTrigger, this.animator);
        if (this.transition == Transition.Animation && this.animationTriggers && this.animator) {
            this.animator.SetTrigger(this._isHovered ? this.animationTriggers.highlightedTrigger : this.animationTriggers.normalTrigger);
        }
        else if(this.transition === Transition.ColorTint && this.colors) {
            this._image?.setState(this._isHovered ? "hovered" : "normal");
        }
    }

    onPointerClick(_args: PointerEventData) {
        if (debug)
            console.trace("Button Click", this.onClick);
        this.onClick?.invoke();
    }

    @serializable()
    colors?: ButtonColors;
    @serializable()
    transition?: Transition;

    @serializable()
    animationTriggers?: AnimationTriggers;

    @serializable(Animator)
    animator?: Animator;

    // @serializable(Image)
    // image? : Image;

    @serializable()
    set interactable(value) {
        this._interactable = value;
        if (this._image) {
            this._image.setInteractable(value);
            if (value)
                this._image.setState("normal");
            else
                this._image.setState("disabled");
        }
    }
    get interactable(): boolean { return this._interactable; }

    private _interactable: boolean = true;
    private set_interactable(value: boolean) {
        this.interactable = value;
    }

    awake(): void {
        super.awake();
        if (debug)
            console.log(this);
        this.init();
    }

    start() {
        this._image?.setInteractable(this.interactable);
    }

    onEnable() {
        super.onEnable();
    }

    private _requestedAnimatorTrigger?: string;
    private *setAnimatorTriggerAtEndOfFrame(requestedTriggerId: string) {
        this._requestedAnimatorTrigger = requestedTriggerId;
        yield;
        yield;
        if (this._requestedAnimatorTrigger == requestedTriggerId) {
            this.animator?.SetTrigger(requestedTriggerId);
        }
    }

    private _isInit: boolean = false;
    private _image?: Image;

    private init() {
        if (this._isInit) return;
        this._isInit = true;
        this._image = GameObject.getComponent(this.gameObject, Image) as Image;
        if (this._image) {
            this.stateSetup(this._image);
            if (this.interactable)
                this._image.setState("normal");
            else
                this._image.setState("disabled");
        }
    }

    private stateSetup(image: Image) {
        image.setInteractable(this.interactable);

        const normal = this.getFinalColor(image.color, this.colors?.normalColor);
        const normalState = {
            state: "normal",
            attributes: {
                backgroundColor: normal,
                backgroundOpacity: normal.alpha,
            },
        };
        image.setupState(normalState);

        const hover = this.getFinalColor(image.color, this.colors?.highlightedColor);
        const hoverState = {
            state: "hovered",
            attributes: {
                backgroundColor: hover,
                backgroundOpacity: hover.alpha,
            },
        };
        image.setupState(hoverState);

        const pressed = this.getFinalColor(image.color, this.colors?.pressedColor);
        const pressedState = {
            state: "pressed",
            attributes: {
                backgroundColor: pressed,
                backgroundOpacity: pressed.alpha,
            }
        };
        image.setupState(pressedState);

        const selected = this.getFinalColor(image.color, this.colors?.selectedColor);
        const selectedState = {
            state: "selected",
            attributes: {
                backgroundColor: selected,
                backgroundOpacity: selected.alpha,
            }
        };
        image.setupState(selectedState);

        const disabled = this.getFinalColor(image.color, this.colors?.disabledColor);
        const disabledState = {
            state: "disabled",
            attributes: {
                backgroundColor: disabled,
                backgroundOpacity: disabled.alpha,
            }
        };
        image.setupState(disabledState);
    }

    private getFinalColor(col: RGBAColor, col2?: RGBAColor) {
        if (col2) {
            return col.clone().multiply(col2);
        }
        return col.clone();
    }
}