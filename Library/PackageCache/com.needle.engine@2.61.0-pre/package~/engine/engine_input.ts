import * as THREE from 'three';
import { Vector2 } from 'three';
import { showBalloonMessage, showBalloonWarning } from './debug/debug';
import { assign } from './engine_serialization_core';
import { Context } from './engine_setup';
import { Vec2 } from './engine_types';
import { getParam } from './engine_utils';

const debug = getParam("debuginput");

export declare type PointerEventArgs = {
    pointerType: string,
    button: number;
    clientX: number;
    clientY: number;
    // pointerId: number,
    movementX?: number,
    movementY?: number,
    source?: Event
};

export class KeyEventArgs {
    key: string;
    keyType: string;
    source?: Event;
    constructor(evt: KeyboardEvent) {
        this.key = evt.key;
        this.keyType = evt.type;
        this.source = evt;
    }
}

export enum InputEvents {
    PointerDown = "pointerdown",
    PointerUp = "pointerup",
    PointerMove = "pointermove",
    KeyDown = "keydown",
    KeyUp = "keyup",
    KeyPressed = "keypress"
}

export enum PointerType {
    Mouse = "mouse",
    Touch = "touch",
}
// export class InputEvent extends Event {

//     args : PointerEventArgs;

//     constructor(type: string, args: PointerEventArgs) {
//         super(type);
//         this.args = args;
//     }
// }

export class Input extends EventTarget {

    _doubleClickTimeThreshold = .2;
    _longPressTimeThreshold = 1;

    get mousePosition(): THREE.Vector2 { return this._pointerPositions[0]; };
    get mousePositionRC(): THREE.Vector2 { return this._pointerPositionsRC[0]; }
    get mouseDown(): boolean { return this._pointerDown[0]; }
    get mouseUp(): boolean { return this._pointerUp[0]; }
    get mouseClick(): boolean { return this._pointerClick[0]; }
    get mouseDoubleClick(): boolean { return this._pointerDoubleClick[0]; }
    get mousePressed(): boolean { return this._pointerPressed[0]; }
    get mouseWheelChanged(): boolean { return this.getMouseWheelChanged(0); }

    private _specialCursorTrigger: number = 0;

    setCursorPointer() {
        this._specialCursorTrigger += 1;
        this.context.domElement.style.cursor = "pointer";
    }
    setCursorNormal() {
        this._specialCursorTrigger -= 1;
        this._specialCursorTrigger = Math.max(0, this._specialCursorTrigger);
        if (this._specialCursorTrigger === 0)
            this.context.domElement.style.cursor = "default";
    }

    /** how many pointers are currently pressed */
    getPointerPressedCount(): number {
        let count = 0;
        for (let i = 0; i < this._pointerPressed.length; i++) {
            if (this._pointerPressed[i]) {
                count++;
            }
        }
        return count;
    }

    getPointerPosition(i: number): THREE.Vector2 | null {
        if (i >= this._pointerPositions.length) return null;
        return this._pointerPositions[i];
    }
    getPointerPositionLastFrame(i: number): THREE.Vector2 | null {
        if (i >= this._pointerPositionsLastFrame.length) return null;
        return this._pointerPositionsLastFrame[i];
    }
    getPointerPositionDelta(i: number): THREE.Vector2 | null {
        if (i >= this._pointerPositionsDelta.length) return null;
        return this._pointerPositionsDelta[i];
    }
    getPointerPositionRC(i: number): THREE.Vector2 | null {
        if (i >= this._pointerPositionsRC.length) return null;
        return this._pointerPositionsRC[i];
    }
    getPointerDown(i: number): boolean {
        if (i >= this._pointerDown.length) return false;
        return this._pointerDown[i];
    }
    getPointerUp(i: number): boolean {
        if (i >= this._pointerUp.length) return false;
        return this._pointerUp[i];
    }
    getPointerPressed(i: number): boolean {
        if (i >= this._pointerPressed.length) return false;
        return this._pointerPressed[i];
    }
    getPointerClicked(i: number): boolean {
        if (i >= this._pointerClick.length) return false;
        return this._pointerClick[i];
    }
    getPointerDoubleClicked(i: number): boolean {
        if (i >= this._pointerDoubleClick.length) return false;
        return this._pointerDoubleClick[i];
    }
    getPointerDownTime(i: number): number {
        if (i >= this._pointerDownTime.length) return -1;
        return this._pointerDownTime[i];
    }
    getPointerUpTime(i: number): number {
        if (i >= this._pointerUpTime.length) return -1;
        return this._pointerUpTime[i];
    }
    getPointerLongPress(i: number): boolean {
        if (i >= this._pointerDownTime.length) return false;
        return this.getPointerPressed(i) && this.context.time.time - this._pointerDownTime[i] > this._longPressTimeThreshold;
    }
    getIsMouse(i: number): boolean {
        if (i < 0 || i >= this._pointerTypes.length) return false;
        return this._pointerTypes[i] === PointerType.Mouse;
    }
    getIsTouch(i: number): boolean {
        if (i < 0 || i >= this._pointerTypes.length) return false;
        return this._pointerTypes[i] === PointerType.Touch;
    }
    getTouchesPressedCount(): number {
        let count = 0;
        for (let i = 0; i < this._pointerPressed.length; i++) {
            if (this._pointerPressed[i] && this.getIsTouch(i)) {
                count++;
            }
        }
        return count;
    }
    getMouseWheelChanged(i: number = 0): boolean {
        if (i >= this._mouseWheelChanged.length) return false;
        return this._mouseWheelChanged[i];
    }
    getMouseWheelDeltaY(i: number = 0): number {
        if (i >= this._mouseWheelDeltaY.length) return 0;
        return this._mouseWheelDeltaY[i];
    }
    getPointerEvent(i: number): Event | undefined {
        if (i >= this._pointerEvent.length) return undefined;
        return this._pointerEvent[i] ?? undefined;
    }
    *foreachPointerId(pointerType?: string | PointerType | string[] | PointerType[]): Generator<number> {
        for (let i = 0; i < this._pointerTypes.length; i++) {
            // check if the pointer is active
            if (this._pointerIsActive(i)) {
                // if specific pointer types are requested
                if (pointerType !== undefined) {
                    const type = this._pointerTypes[i];
                    if (Array.isArray(pointerType)) {
                        let isInArray = false;
                        for (const t of pointerType) {
                            if (type === t) {
                                isInArray = true;
                                break;
                            }
                        }
                        if (!isInArray) continue;
                    } else {
                        if (pointerType !== type) continue;
                    }
                }
                yield i;
            }
        }
    }
    *foreachTouchId(): Generator<number> {
        for (let i = 0; i < this._pointerTypes.length; i++) {
            const type = this._pointerTypes[i];
            if (type !== PointerType.Touch) continue;
            if (this._pointerIsActive[i])
                yield i;
        }
    }

    private _pointerIsActive(index: number) {
        if(index < 0) return false;
        return this._pointerPressed[index] || this._pointerDown[index] || this._pointerUp[index];
    }

    private context: Context;

    private _pointerDown: boolean[] = [false];
    private _pointerUp: boolean[] = [false];
    private _pointerClick: boolean[] = [false];
    private _pointerDoubleClick: boolean[] = [false];
    private _pointerPressed: boolean[] = [false];
    private _pointerPositions: THREE.Vector2[] = [new THREE.Vector2()];
    private _pointerPositionsLastFrame: THREE.Vector2[] = [new THREE.Vector2()];
    private _pointerPositionsDelta: THREE.Vector2[] = [new THREE.Vector2()];
    private _pointerPositionsRC: THREE.Vector2[] = [new THREE.Vector2()];
    private _pointerPositionDown: THREE.Vector2[] = [new THREE.Vector2()];
    private _pointerDownTime: number[] = [];
    private _pointerUpTime: number[] = [];
    private _pointerIds: number[] = [];
    private _pointerTypes: string[] = [""];
    private _mouseWheelChanged: boolean[] = [false];
    private _mouseWheelDeltaY: number[] = [0];
    private _pointerEvent: Event[] = [];

    getKeyDown(): string | null {
        for (const key in this.keysPressed) {
            const k = this.keysPressed[key];
            if (k.startFrame === this.context.time.frameCount) return k.key;
        }
        return null;
    }
    getKeyPressed(): string | null {
        for (const key in this.keysPressed) {
            const k = this.keysPressed[key];
            if (k.pressed)
                return k.key;
        }
        return null;
    }
    isKeyDown(keyCode: KeyCode | string | number) {
        if (typeof keyCode === "number") {
            console.warn("Use of keycode as number is not recommended, please use KeyCode or string instead");
            keyCode = String.fromCharCode(keyCode);
        }
        // console.log( this.keysPressed[keyCode]?.frame, time.frameCount);
        return this.context.application.isVisible && this.context.application.hasFocus && this.keysPressed[keyCode]?.startFrame === this.context.time.frameCount && this.keysPressed[keyCode].pressed;
    }
    isKeyUp(keyCode: KeyCode | string | number) {
        if (typeof keyCode === "number") {
            console.warn("Use of keycode as number is not recommended, please use KeyCode or string instead");
            keyCode = String.fromCharCode(keyCode);
        }
        return this.context.application.isVisible && this.context.application.hasFocus && this.keysPressed[keyCode]?.frame === this.context.time.frameCount && !this.keysPressed[keyCode].pressed;
    }
    isKeyPressed(keyCode: KeyCode | string | number) {
        if (typeof keyCode === "number") {
            keyCode = String.fromCharCode(keyCode);
        }
        return this.context.application.isVisible && this.context.application.hasFocus && this.keysPressed[keyCode]?.pressed;// && time.frameCount - this.keysPressed[keyCode].frame < 100;
    }

    createPointerDown(args: PointerEventArgs) {
        if (debug) showBalloonMessage("Create Pointer down");
        this.onDown(args);
    }

    createPointerMove(args: PointerEventArgs) {
        if (debug) showBalloonMessage("Create Pointer move");
        this.onMove(args);
    }

    createPointerUp(args: PointerEventArgs) {
        if (debug) showBalloonMessage("Create Pointer up");
        this.onUp(args);
    }

    convertScreenspaceToRaycastSpace(vec2: Vec2) {
        vec2.x = (vec2.x - this.context.domX) / this.context.domWidth * 2 - 1;
        vec2.y = -((vec2.y - this.context.domY) / this.context.domHeight) * 2 + 1;
    }

    constructor(context: Context) {
        super();
        this.context = context;
        this.context.post_render_callbacks.push(this.onEndOfFrame.bind(this));

        // const eventElement = this.context.renderer.domElement;

        // this.context.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this), false);
        // this.context.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this), false);
        // this.context.renderer.domElement.addEventListener('mouseup', this.onMouseUp.bind(this), false);

        window.addEventListener('touchstart', this.onTouchStart.bind(this), false);
        window.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: true });
        window.addEventListener('touchend', this.onTouchUp.bind(this), false);

        window.addEventListener('mousedown', this.onMouseDown.bind(this), false);
        window.addEventListener('mousemove', this.onMouseMove.bind(this), false);
        window.addEventListener('mouseup', this.onMouseUp.bind(this), false);
        window.addEventListener('wheel', this.onMouseWheel.bind(this), { passive: true });

        window.addEventListener("keydown", this.onKeyDown.bind(this), false);
        window.addEventListener("keypress", this.onKeyPressed.bind(this), false);
        window.addEventListener("keyup", this.onKeyUp.bind(this), false);

        // e.g. when using sharex to capture we loose focus thus dont get e.g. key up events
        window.addEventListener('blur', this.onLostFocus.bind(this));

        // setTimeout(() => {
        //     this.createPointerDown({ pointerId: 0, button: 0, clientX: 0, clientY: 0, pointerType: "mouse" });
        //     setTimeout(() => {
        //         this.createPointerUp({ pointerId: 0, button: 0, clientX: 0, clientY: 0, pointerType: "mouse" });
        //     }, 1000);
        // }, 2000);
    }

    private onLostFocus() {
        for (const kp in this.keysPressed) {
            this.keysPressed[kp].pressed = false;
        }
    }

    private onEndOfFrame() {
        for (let i = 0; i < this._pointerUp.length; i++)
            this._pointerUp[i] = false;
        for (let i = 0; i < this._pointerDown.length; i++)
            this._pointerDown[i] = false;
        for (let i = 0; i < this._pointerClick.length; i++)
            this._pointerClick[i] = false;
        for (let i = 0; i < this._pointerDoubleClick.length; i++)
            this._pointerDoubleClick[i] = false;
        for (const pt of this._pointerPositionsDelta)
            pt.set(0, 0);
        for (let i = 0; i < this._mouseWheelChanged.length; i++)
            this._mouseWheelChanged[i] = false;
        for (let i = 0; i < this._mouseWheelDeltaY.length; i++)
            this._mouseWheelDeltaY[i] = 0;
    }

    private canReceiveInput(evt : Event) {
        // If the user has HTML objects ontop of the canvas
        // if(evt.target === this.context.renderer.domElement) return true;
        // const css = window.getComputedStyle(evt.target as HTMLElement);
        // if(css.pointerEvents === "all") return false;
        return evt.target === this.context.renderer.domElement;
    }

    private keysPressed: { [key: number]: { pressed: boolean, frame: number, startFrame: number, key: string } } = {};

    private onKeyDown(evt: KeyboardEvent) {
        if (!this.context.application.hasFocus)
            return;
        const ex = this.keysPressed[evt.key];
        if (ex && ex.pressed) return;
        this.keysPressed[evt.key] = { pressed: true, frame: this.context.time.frameCount + 1, startFrame: this.context.time.frameCount + 1, key: evt.key };
        this.onDispatchEvent(InputEvents.KeyDown, new KeyEventArgs(evt));
    }
    private onKeyPressed(evt: KeyboardEvent) {
        if (!this.context.application.hasFocus)
            return;
        const p = this.keysPressed[evt.key];
        if (!p) return;
        p.pressed = true;
        p.frame = this.context.time.frameCount + 1;
        this.onDispatchEvent(InputEvents.KeyPressed, new KeyEventArgs(evt));

    }
    private onKeyUp(evt: KeyboardEvent) {
        if (!this.context.application.hasFocus)
            return;
        const p = this.keysPressed[evt.key];
        if (!p) return;
        p.pressed = false;
        p.frame = this.context.time.frameCount + 1;
        this.onDispatchEvent(InputEvents.KeyUp, new KeyEventArgs(evt));
    }

    private onMouseWheel(evt: WheelEvent) {
        if(this.canReceiveInput(evt) === false) return;
        if (this._mouseWheelDeltaY.length <= 0) this._mouseWheelDeltaY.push(0);
        if (this._mouseWheelChanged.length <= 0) this._mouseWheelChanged.push(false);
        this._mouseWheelChanged[0] = true;
        const current = this._mouseWheelDeltaY[0];
        this._mouseWheelDeltaY[0] = current + evt.deltaY;
    }

    private onTouchStart(evt: TouchEvent) {
        if (evt.changedTouches.length <= 0) return;
        if(this.canReceiveInput(evt) === false) return;
        for (let i = 0; i < evt.changedTouches.length; i++) {
            const touch = evt.changedTouches[i];
            const id = this.getPointerIndex(touch.identifier)
            if (debug)
                showBalloonMessage(`touch start #${id}, identifier:${touch.identifier}`);
            const args: PointerEventArgs = { button: id, clientX: touch.clientX, clientY: touch.clientY, pointerType: PointerType.Touch, source: evt };
            this.onDown(args);
        }
    }

    private onTouchMove(evt: TouchEvent) {
        if (evt.changedTouches.length <= 0) return;
        for (let i = 0; i < evt.changedTouches.length; i++) {
            const touch = evt.changedTouches[i];
            const id = this.getPointerIndex(touch.identifier)
            const args: PointerEventArgs = { button: id, clientX: touch.clientX, clientY: touch.clientY, pointerType: PointerType.Touch, source: evt };
            this.onMove(args);
        }
    }

    private onTouchUp(evt) {
        if (evt.changedTouches.length <= 0) return;
        for (let i = 0; i < evt.changedTouches.length; i++) {
            const touch = evt.changedTouches[i];
            const id = this.getPointerIndex(touch.identifier)
            if (debug)
                showBalloonMessage(`touch up #${id}, identifier:${touch.identifier}`);
            const args: PointerEventArgs = { button: id, clientX: touch.clientX, clientY: touch.clientY, pointerType: PointerType.Touch, source: evt };
            this.onUp(args);
        }
    }

    private onMouseDown(evt: MouseEvent) {
        if (evt.defaultPrevented) return;
        if(this.canReceiveInput(evt) === false) return;
        let i = evt.button;
        this.onDown({ button: i, clientX: evt.clientX, clientY: evt.clientY, pointerType: PointerType.Mouse, source: evt });
    }

    private onMouseMove(evt: MouseEvent) {
        if (evt.defaultPrevented) return;
        let i = evt.button;
        const args: PointerEventArgs = { button: i, clientX: evt.clientX, clientY: evt.clientY, pointerType: PointerType.Mouse, source: evt, movementX: evt.movementX, movementY: evt.movementY };
        this.onMove(args);
    }

    private onMouseUp(evt: MouseEvent) {
        if (evt.defaultPrevented) return;
        let i = evt.button;
        this.onUp({ button: i, clientX: evt.clientX, clientY: evt.clientY, pointerType: PointerType.Mouse, source: evt });
    }

    private isInRect(e: { clientX: number, clientY: number }): boolean {
        if(this.context.isInXR) return true;
        const rect = this.context.domElement.getBoundingClientRect();
        const px = e.clientX;
        const py = e.clientY;
        const isInRect = px >= rect.x && px <= rect.right && py >= rect.y && py <= rect.bottom;
        if(debug && !isInRect) console.log("Not in rect", rect, px, py);
        return isInRect;

    }

    private onDown(evt: PointerEventArgs) {
        if (debug) console.log(evt.pointerType, "DOWN", evt.button);
        if (!this.isInRect(evt)) return;
        this.setPointerState(evt.button, this._pointerPressed, true);
        this.setPointerState(evt.button, this._pointerDown, true);
        this.setPointerStateT(evt.button, this._pointerEvent, evt.source);

        while (evt.button >= this._pointerTypes.length) this._pointerTypes.push(evt.pointerType);
        this._pointerTypes[evt.button] = evt.pointerType;

        while (evt.button >= this._pointerPositionDown.length) this._pointerPositionDown.push(new THREE.Vector2());
        this._pointerPositionDown[evt.button].set(evt.clientX, evt.clientY);

        if (evt.button >= this._pointerDownTime.length) this._pointerDownTime.push(0);
        this._pointerDownTime[evt.button] = this.context.time.time;

        this.updatePointerPosition(evt);
        // console.log("DOWN", this._pointerDown, this.mousePositionRC);

        this.onDispatchEvent(InputEvents.PointerDown, evt);
    }
    // moveEvent?: Event;
    private onMove(evt: PointerEventArgs) {
        const isDown = this.getPointerPressed(evt.button);
        if (isDown === false && !this.isInRect(evt)) return;
        if (evt.pointerType === PointerType.Touch && !isDown) return;
        if (debug) console.log(evt.pointerType, "MOVE", evt.button)
        this.updatePointerPosition(evt);
        this.setPointerStateT(evt.button, this._pointerEvent, evt.source);
        this.onDispatchEvent(InputEvents.PointerMove, evt);
    }
    private onUp(evt: PointerEventArgs) {
        if (this._pointerIds?.length >= evt.button)
            this._pointerIds[evt.button] = -1;
        const wasDown = this._pointerPressed[evt.button];
        if (!wasDown) {
            if (debug) console.log(evt.pointerType, "UP", evt.button, "was not down");
            return;
        }
        if (debug) console.log(evt.pointerType, "UP", evt.button);
        this.setPointerState(evt.button, this._pointerPressed, false);
        this.setPointerStateT(evt.button, this._pointerEvent, evt.source);

        // if (!this.isInRect(evt)) {
        //     if (debug) showBalloonWarning("Pointer out of bounds: " + evt.clientX + ", " + evt.clientY);
        //     return;
        // }
        this.setPointerState(evt.button, this._pointerUp, true);

        this.updatePointerPosition(evt);

        if (!this._pointerPositionDown[evt.button]) {
            if (debug) showBalloonWarning("Received pointer up event without matching down event for button: " + evt.button);
            console.warn("Received pointer up event without matching down event for button: " + evt.button)
            return;
        }
        const dx = evt.clientX - this._pointerPositionDown[evt.button].x;
        const dy = evt.clientY - this._pointerPositionDown[evt.button].y;

        if (evt.button >= this._pointerUpTime.length) this._pointerUpTime.push(-99);

        // console.log(dx, dy);
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
            this.setPointerState(evt.button, this._pointerClick, true);

            // handle double click
            const lastUp = this._pointerUpTime[evt.button];
            const dt = this.context.time.time - lastUp;
            // console.log(dt);
            if (dt < this._doubleClickTimeThreshold && dt > 0) {
                this.setPointerState(evt.button, this._pointerDoubleClick, true);
            }
        }
        this._pointerUpTime[evt.button] = this.context.time.time;

        this.onDispatchEvent(InputEvents.PointerUp, evt);
    }

    private updatePointerPosition(evt: PointerEventArgs) {
        // console.log("MOVE");
        while (evt.button >= this._pointerPositions.length) this._pointerPositions.push(new THREE.Vector2());
        while (evt.button >= this._pointerPositionsLastFrame.length) this._pointerPositionsLastFrame.push(new THREE.Vector2());
        while (evt.button >= this._pointerPositionsDelta.length) this._pointerPositionsDelta.push(new THREE.Vector2());

        const lf = this._pointerPositionsLastFrame[evt.button];
        lf.copy(this._pointerPositions[evt.button]);
        const dx = evt.movementX !== undefined ? evt.movementX : evt.clientX - lf.x;
        const dy = evt.movementY !== undefined ? evt.movementY : evt.clientY - lf.y;
        this._pointerPositionsDelta[evt.button].set(dx, dy);

        this._pointerPositions[evt.button].x = evt.clientX;
        this._pointerPositions[evt.button].y = evt.clientY;

        // we want to have the position 01 on the canvas for raycasting
        const px = evt.clientX;
        const py = evt.clientY;
        while (evt.button >= this._pointerPositionsRC.length) this._pointerPositionsRC.push(new THREE.Vector2());
        const rc = this._pointerPositionsRC[evt.button];
        rc.set(px, py);
        this.convertScreenspaceToRaycastSpace(rc);
        // console.log(this.context.alias, rc);
        // this._pointerPositionsRC[evt.button].x = (px - this.context.domX) / this.context.domWidth * 2 - 1;
        // this._pointerPositionsRC[evt.button].y = -((py - this.context.domY) / this.context.domHeight) * 2 + 1;
        // console.log(evt.button)
    }

    /** get the next free id */
    private getPointerIndex(pointerId: number) {
        const ids = this._pointerIds;
        // test if theres a pointer with the id
        let firstFreeIndex = -1;
        for (let i = 0; i < ids.length; i++) {
            if (ids[i] === pointerId) return i;
            else if (firstFreeIndex === -1 && ids[i] === -1)
                firstFreeIndex = i;
        }
        // if not take the free slot if any
        if (firstFreeIndex !== -1) {
            ids[firstFreeIndex] = pointerId;
            return firstFreeIndex;
        }
        ids.push(pointerId);
        return ids.length - 1;
    }

    private setPointerState(index: number, arr: boolean[], value: boolean) {
        while (arr.length <= index) arr.push(false);
        arr[index] = value;
    }

    private setPointerStateT<T>(index: number, arr: T[], value: T) {
        while (arr.length <= index) arr.push(null as any);
        arr[index] = value;
    }

    private onDispatchEvent(name: InputEvents, args: PointerEventArgs | KeyEventArgs) {
        const prevContext = Context.Current;
        try {

            Context.Current = this.context;
            const e = new Event(name);
            assign(e, args);
            this.dispatchEvent(e);
        }
        finally {
            Context.Current = prevContext;
        }
    }
}



export enum KeyCode {
    BACKSPACE = "Backspace",
    TAB = "Tab",
    ENTER = "Enter",
    SHIFT = "Shift",
    CTRL = "Control",
    ALT = "Alt",
    PAUSE = "Pause",
    CAPS_LOCK = "CapsLock",
    ESCAPE = "Escape",
    SPACE = " ",
    PAGE_UP = "PageUp",
    PAGE_DOWN = "PageDown",
    END = "End",
    HOME = "Home",
    LEFT_ARROW = "ArrowLeft",
    UP_ARROW = "ArrowUp",
    RIGHT_ARROW = "ArrowRight",
    DOWN_ARROW = "ArrowDown",
    INSERT = "Insert",
    DELETE = "Delete",
    KEY_0 = "0",
    KEY_1 = "1",
    KEY_2 = "2",
    KEY_3 = "3",
    KEY_4 = "4",
    KEY_5 = "5",
    KEY_6 = "6",
    KEY_7 = "7",
    KEY_8 = "8",
    KEY_9 = "9",
    KEY_A = "a",
    KEY_B = "b",
    KEY_C = "c",
    KEY_D = "d",
    KEY_E = "e",
    KEY_F = "f",
    KEY_G = "g",
    KEY_H = "h",
    KEY_I = "i",
    KEY_K = "k",
    KEY_J = "j",
    KEY_L = "l",
    KEY_M = "m",
    KEY_N = "n",
    KEY_O = "o",
    KEY_P = "p",
    KEY_Q = "q",
    KEY_R = "r",
    KEY_S = "s",
    KEY_T = "t",
    KEY_U = "u",
    KEY_V = "v",
    KEY_W = "w",
    KEY_X = "x",
    KEY_Z = "z",
    KEY_Y = "y",
    SELECT = "Select",
    NUMPAD_0 = "Numpad0",
    NUMPAD_1 = "Numpad1",
    NUMPAD_2 = "Numpad2",
    NUMPAD_3 = "Numpad3",
    NUMPAD_4 = "Numpad4",
    NUMPAD_5 = "Numpad5",
    NUMPAD_6 = "Numpad6",
    NUMPAD_7 = "Numpad7",
    NUMPAD_8 = "Numpad8",
    NUMPAD_9 = "Numpad9",
    MULTIPLY = "Multiply",
    ADD = "Add",
    SUBTRACT = "Subtract",
    DECIMAL = "Decimal",
    DIVIDE = "Divide",
    F1 = "F1",
    F2 = "F2",
    F3 = "F3",
    F4 = "F4",
    F5 = "F5",
    F6 = "F6",
    F7 = "F7",
    F8 = "F8",
    F9 = "F9",
    F10 = "F10",
    F11 = "F11",
    F12 = "F12"
};


    // KEY_1 = 49,
    // KEY_2 = 50,
    // KEY_3 = 51,
    // KEY_4 = 52,
    // KEY_5 = 53,
    // KEY_6 = 54,
    // KEY_7 = 55,
    // KEY_8 = 56,
    // KEY_9 = 57,
    // KEY_A = 65,
    // KEY_B = 66,
    // KEY_C = 67,
    // KEY_D = "d",
    // KEY_E = 69,
    // KEY_F = 70,
    // KEY_G = 71,
    // KEY_H = 72,
    // KEY_I = 73,
    // KEY_J = 74,
    // KEY_K = 75,
    // KEY_L = 76,
    // KEY_M = 77,
    // KEY_N = 78,
    // KEY_O = 79,
    // KEY_P = 80,
    // KEY_Q = 81,
    // KEY_R = 82,
    // KEY_S = 83,
    // KEY_T = 84,
    // KEY_U = 85,
    // KEY_V = 86,
    // KEY_W = 87,
    // KEY_X = 88,
    // KEY_Y = 89,
    // KEY_Z = 90,
    // LEFT_META = 91,
    // RIGHT_META = 92,
    // SELECT = 93,
    // NUMPAD_0 = 96,
    // NUMPAD_1 = 97,
    // NUMPAD_2 = 98,
    // NUMPAD_3 = 99,
    // NUMPAD_4 = 100,
    // NUMPAD_5 = 101,
    // NUMPAD_6 = 102,
    // NUMPAD_7 = 103,
    // NUMPAD_8 = 104,
    // NUMPAD_9 = 105,
    // MULTIPLY = 106,
    // ADD = 107,
    // SUBTRACT = 109,
    // DECIMAL = 110,
    // DIVIDE = 111,
    // F1 = 112,
    // F2 = 113,
    // F3 = 114,
    // F4 = 115,
    // F5 = 116,
    // F6 = 117,
    // F7 = 118,
    // F8 = 119,
    // F9 = 120,
    // F10 = 121,
    // F11 = 122,
    // F12 = 123,
    // NUM_LOCK = 144,
    // SCROLL_LOCK = 145,
    // SEMICOLON = 186,
    // EQUALS = 187,
    // COMMA = 188,
    // DASH = 189,
    // PERIOD = 190,
    // FORWARD_SLASH = 191,
    // GRAVE_ACCENT = 192,
    // OPEN_BRACKET = 219,
    // BACK_SLASH = 220,
    // CLOSE_BRACKET = 221,
    // SINGLE_QUOTE = 222