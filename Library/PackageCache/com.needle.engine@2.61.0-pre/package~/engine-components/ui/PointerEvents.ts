import { Input } from "../../engine/engine_input";

export interface IInputEventArgs {
    get used(): boolean;
    Use(): void;
    StopPropagation?(): void;
}

export class PointerEventData implements IInputEventArgs {
    used: boolean = false;

    Use() {
        this.used = true;
    }

    StopPropagation() {
        this.event?.stopImmediatePropagation();
    }

    inputSource: Input | any;
    object!: THREE.Object3D;

    pointerId: number | undefined;
    isDown: boolean | undefined;
    isUp: boolean | undefined;
    isPressed: boolean | undefined;
    isClicked: boolean | undefined;

    private event?: Event;

    constructor(events?: Event) {
        this.event = events;
    }
}

export interface IPointerDownHandler {
    onPointerDown?(args: PointerEventData);
}

export interface IPointerUpHandler {
    onPointerUp?(args: PointerEventData);
}

export interface IPointerEnterHandler {
    onPointerEnter?(args: PointerEventData);
}

export interface IPointerExitHandler {
    onPointerExit?(args: PointerEventData);
}

export interface IPointerClickHandler {
    onPointerClick?(args: PointerEventData);
}

export interface IPointerEventHandler extends IPointerDownHandler,
    IPointerUpHandler, IPointerEnterHandler, IPointerExitHandler, IPointerClickHandler { }
