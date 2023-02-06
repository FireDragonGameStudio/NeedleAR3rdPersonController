import { Behaviour, serializeable } from "@needle-tools/engine";

// Documentation → https://docs.needle.tools/scripting

export class component_name extends Behaviour {

    @serializeable()
    myStringField: string = "Hello World";
    
    start() {
    }
}