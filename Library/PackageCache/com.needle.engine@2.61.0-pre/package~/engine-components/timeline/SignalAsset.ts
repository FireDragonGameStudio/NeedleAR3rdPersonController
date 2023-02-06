import { EventList } from "../EventList";
import { Behaviour } from "../Component";
import { ISerializable, SerializationContext, TypeSerializer } from "../../engine/engine_serialization_core";
import { eventListSerializer } from "../../engine/engine_serialization_builtin_serializer";
import { serializable } from "../../engine/engine_serialization_decorator";



export class SignalAsset {
    guid!: string;
}

export class SignalReceiverEvent implements ISerializable {
    signal!: SignalAsset;
    reaction!: EventList;

    $serializedTypes = {
        signal: SignalAsset,
        reaction: EventList
    }
}

export class SignalReceiver extends Behaviour {


    @serializable(SignalReceiverEvent)
    events?: SignalReceiverEvent[];


    start() {
        console.log(this);
    }

    invoke(sig: SignalAsset | string) {
        if (!this.events || !Array.isArray(this.events)) return;
        let id = typeof sig === "object" ? sig.guid : sig;
        for (const evt of this.events) {
            if (evt.signal.guid === id) {
                try {
                    if (!evt.reaction) {
                        console.warn("Missing reaction for signal", evt, this);
                        continue;
                    }
                    else if (!evt.reaction.invoke) {
                        console.warn("Missing invoke - possibly a serialization error", evt, this);
                        continue;
                    }
                    evt.reaction.invoke();
                }
                catch (err) {
                    console.error(err);
                }
            }
        }
    }

    // onDeserialize(key: string, value: any): any | void
    // {
    //     switch(key){
    //         case "events":
    //             console.log(value);
    //             const evt = eventListSerializer;
    //             for(const e in value){

    //             }
    //             break;
    //     }
    // }
}



// class SignalAssetSerializer extends TypeSerializer {
//     constructor() {
//         super("SignalReceiverEvent");
//     }

//     onSerialize(_data: EventList, _context: SerializationContext) {
//         console.log("TODO: SERIALIZE EVENT");
//         return undefined;
//     }

//     onDeserialize(data: SignalReceiverEvent, context: SerializationContext): EventList | undefined | null {
//         console.log("DESERIALIZE", data);
//         // if (data && data.type === "EventList") {
//         //     console.log("DESERIALIZE EVENT", data);
//         //     const fns = new Array<Function>();
//         //     for (const call of data.calls) {
//         //         const target = componentSerializer.findObjectForGuid(call.target, context.root);
//         //         let fn;
//         //         if (call.argument) {
//         //             let arg = call.argument;
//         //             if (typeof arg === "object") {
//         //                 arg = objectSerializer.onDeserialize(call.argument, context);
//         //                 if (!arg) arg = componentSerializer.onDeserialize(call.argument, context);
//         //             }
//         //             fn = () => target[call.method](arg);
//         //         }
//         //         else fn = () => target[call.method]();
//         //         fns.push(fn);
//         //     }
//         //     const evt: EventList = new EventList(fns);
//         //     return evt;
//         // }
//         return undefined;
//     }
// }
// new SignalAssetSerializer();