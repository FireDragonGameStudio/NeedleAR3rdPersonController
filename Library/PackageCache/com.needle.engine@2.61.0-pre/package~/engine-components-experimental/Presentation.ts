import { Behaviour } from "../engine-components/Component";
import { KeyCode } from "../engine/engine_input";

export class PresentationMode extends Behaviour {

    toggleKey : KeyCode = KeyCode.KEY_P;

    update(): void {
        if (this.context.input.isKeyDown(KeyCode.KEY_P)) {
            this.context.domElement.classList.toggle("presentation-mode");
        }
    }
}