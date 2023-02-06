import { Behaviour, GameObject } from "../Component";
import { IPointerClickHandler, IPointerEventHandler, PointerEventData } from "./PointerEvents";
import { FrameEvent } from "../../engine/engine_setup";
import { serializable } from "../../engine/engine_serialization_decorator";
import { Text } from "./Text";
import { getParam, isiOS } from "../../engine/engine_utils";
import { EventList } from "../EventList";
import { showBalloonMessage } from "../../engine/debug/debug";
import { Physics } from "../../engine/engine_physics";
import { tryGetUIComponent } from "./Utils";

const debug = getParam("debuginputfield");

export class InputField extends Behaviour implements IPointerEventHandler {

    get text() : string {
        return this.textComponent?.text ?? "";
    }

    get isFocused() {
        return InputField.active === this;
    }

    @serializable(Text)
    private textComponent?: Text;

    @serializable(Text)
    private placeholder?: Text;

    @serializable(EventList)
    onValueChanged?: EventList;

    @serializable(EventList)
    onEndEdit?: EventList;


    private static active: InputField | null = null;
    private static activeTime: number = -1;
    private static htmlField: HTMLInputElement | null = null;

    private inputEventFn: any;
    private _iosEventFn: any;

    start() {
        if (debug)
            console.log(this.name, this);
    }

    onEnable() {
        if (!InputField.htmlField) {
            InputField.htmlField = document.createElement("input");
            InputField.htmlField.style.caretColor = "transparent";
            InputField.htmlField.classList.add("ar");
            document.body.appendChild(InputField.htmlField);
        }
        if (!this.inputEventFn) {
            this.inputEventFn = this.onInput.bind(this);
        }
        // InputField.htmlField.addEventListener("input", this.mobileInputEventListener);
        InputField.htmlField.addEventListener("keyup", this.inputEventFn);
        // InputField.htmlField.addEventListener("change", this.inputEventFn);
        if (this.placeholder && this.textComponent?.text.length) {
            GameObject.setActive(this.placeholder.gameObject, false);
        }
        if (isiOS()) {
            this._iosEventFn = this.processInputOniOS.bind(this);
            window.addEventListener("touchend", this._iosEventFn);
        }
    }

    onDisable() {
        // InputField.htmlField?.removeEventListener("input", this.mobileInputEventListener);
        InputField.htmlField?.removeEventListener("keyup", this.inputEventFn);
        // InputField.htmlField?.removeEventListener("change", this.inputEventFn);
        this.onDeselected();
        if (this._iosEventFn) {
            window.removeEventListener("touchend", this._iosEventFn);
        }
    }

    onPointerClick(_args) {
        if (debug) console.log("CLICK", _args, InputField.active);
        InputField.activeTime = this.context.time.time;
        if (InputField.active !== this) {
            this.startCoroutine(this.activeLoop(), FrameEvent.LateUpdate);
        }
        this.selectInputField();
    }

    private *activeLoop() {
        this.onSelected();
        while (InputField.active === this) {
            if (this.context.input.getPointerUp(0)) {
                if (this.context.time.time - InputField.activeTime > 0.2) {
                    break;
                }
            }
            this.setTextFromInputField();
            yield;
        }
        this.onDeselected();
    }

    private onSelected() {
        if (InputField.active === this) return;
        if (debug) console.log("Select", this.name, this, InputField.htmlField, this.context.isInXR, this.context.arOverlayElement, this.textComponent?.text, InputField.htmlField?.value);

        InputField.active?.onDeselected();
        InputField.active = this;

        if (this.placeholder)
            GameObject.setActive(this.placeholder.gameObject, false);

        if (InputField.htmlField) {

            InputField.htmlField.value = this.textComponent?.text || "";
            if (debug)
                console.log("set input field value", InputField.htmlField.value);

            if (this.context.isInXR) {
                const overlay = this.context.arOverlayElement;
                if (overlay) {
                    InputField.htmlField.style.width = "0px";
                    InputField.htmlField.style.height = "0px";
                    overlay.append(InputField.htmlField)
                }
            }

            this.selectInputField();
        }
    }

    private onDeselected() {
        if (InputField.active !== this) return;
        InputField.active = null;

        if (debug) console.log("Deselect", this.name, this);
        if (InputField.htmlField) {
            InputField.htmlField.blur();
            document.body.append(InputField.htmlField);
            InputField.htmlField.style.width = "";
            InputField.htmlField.style.height = "";
        }
        if (this.placeholder && (!this.textComponent || this.textComponent.text.length <= 0))
            GameObject.setActive(this.placeholder.gameObject, true);

        this.onEndEdit?.invoke();
    }


    private onInput(evt: KeyboardEvent) {
        if (InputField.active !== this) return;
        if (debug)
            console.log(evt.code, evt, InputField.htmlField?.value, this.textComponent?.text);
        if (evt.code === "Escape" || evt.code === "Enter") {
            this.onDeselected();
            return;
        }
        if (InputField.htmlField) {
            if (this.textComponent) {
                this.setTextFromInputField();
                if (this.placeholder) {
                    GameObject.setActive(this.placeholder.gameObject, this.textComponent.text.length <= 0);
                }
            }
            this.selectInputField();
        }
        // switch (evt.inputType) {
        //     case "insertCompositionText":
        //         this.appendLetter(evt.data?.charAt(evt.data.length - 1) || null);
        //         break;
        //     case "insertText":
        //         console.log(evt.data);
        //         this.appendLetter(evt.data);
        //         break;
        //     case "deleteContentBackward":
        //         this.deleteLetter();
        //         break;
        // }
    }

    private setTextFromInputField() {
        if (this.textComponent && InputField.htmlField) {
            if (this.textComponent.text !== InputField.htmlField.value) {
                if (debug)
                    console.log("VALUE CHANGED");
                const oldValue = this.textComponent.text;
                const newValue = InputField.htmlField.value;
                this.onValueChanged?.invoke(newValue, oldValue);
            }
            this.textComponent.text = InputField.htmlField.value;
        }
    }

    private selectInputField() {
        if (InputField.htmlField) {
            InputField.htmlField.setSelectionRange(InputField.htmlField.value.length, InputField.htmlField.value.length);
            InputField.htmlField.focus();
        }
    }

    private processInputOniOS() {
        // focus() on safari ios doesnt open the keyboard when not processed from dom event
        // so we try in a touch end event if this is hit
        const hits = this.context.physics.raycast();
        if (!hits.length) return;
        const hit = hits[0];
        const obj = hit.object;
        const component = tryGetUIComponent(obj);
        if (component?.gameObject === this.gameObject || component?.gameObject.parent === this.gameObject)
            this.selectInputField();
    }


    // private static _lastDeletionTime: number = 0;
    // private static _lastKeyInputTime: number = 0;

    // TODO: support modifiers, refactor to not use backspace as string etc
    // private handleKey(key: string | null) {
    //     if (!this.textComponent) return;
    //     if (!key) return;

    //     InputField._lastKey = key || "";

    //     const text = this.textComponent.text;
    //     if (debug)
    //         console.log(key, text);
    //     switch (key) {
    //         case "Backspace":
    //             this.deleteLetter();
    //             break;

    //         default:
    //             this.appendLetter(key);
    //             break;
    //     }
    // }

    // private appendLetter(key: string | null) {
    //     if (this.textComponent && key) {
    //         const timeSinceLastInput = this.context.time.time - InputField._lastKeyInputTime;
    //         if (key.length === 1 && (this.context.input.getKeyDown() === key || timeSinceLastInput > .1)) {
    //             this.textComponent.text += key;
    //             InputField._lastKeyInputTime = this.context.time.time;
    //         }
    //     }
    // }

    // private deleteLetter() {
    //     if (this.textComponent) {
    //         const text = this.textComponent.text;
    //         if (text.length > 0 && this.context.time.time - InputField._lastDeletionTime > 0.05) {
    //             this.textComponent.text = text.slice(0, -1);
    //             InputField._lastDeletionTime = this.context.time.time;
    //         }
    //     }
    // }
}