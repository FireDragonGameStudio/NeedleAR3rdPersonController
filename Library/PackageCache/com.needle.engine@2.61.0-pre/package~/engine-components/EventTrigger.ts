import { serializable } from "../engine/engine_serialization";
import { EventList } from "./EventList";
import { IPointerEventHandler, PointerEventData } from "./ui/PointerEvents"
import { Behaviour } from "./Component"
import { EventType } from "./EventType"

class TriggerEvent {
    @serializable()
    eventID!: EventType;
    @serializable(EventList)
    callback!: EventList;
}

export class EventTrigger extends Behaviour implements IPointerEventHandler {
    
    @serializable(TriggerEvent)
    private triggers?: Array<TriggerEvent>;

    invoke(type: EventType) {
        if(!this.triggers) return;
        for(const trigger of this.triggers){
            if(trigger.eventID === type){
                trigger.callback.invoke();
            }
        }
    }

    onPointerClick(_: PointerEventData) {
        this.invoke(EventType.PointerClick);
    }
    
    onPointerEnter(_: PointerEventData) {
        this.invoke(EventType.PointerEnter);
    }

    onPointerExit(_: PointerEventData) {
        this.invoke(EventType.PointerExit);
    }

    onPointerDown(_: PointerEventData) {
        this.invoke(EventType.PointerDown);
    }

    onPointerUp(_: PointerEventData) {
        this.invoke(EventType.PointerUp);
    }

}