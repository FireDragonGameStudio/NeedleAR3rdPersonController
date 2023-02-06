import { Behaviour } from "./Component";
import { IPointerClickHandler, IPointerEnterHandler, PointerEventData } from "./ui/PointerEvents";


export class Interactable extends Behaviour implements IPointerClickHandler {

    canGrab : boolean = true;

    onPointerClick(_args: PointerEventData) {
        // console.log("CLICK");
    }

    // OnPointerEnter(args: PointerEventData) {
    //     console.log("ENTER");
    // }

    // OnPointerExit(args: PointerEventData) {
    //     console.log("Exit");
    // }
}


// TODO: how do we sync things like that...
export class UsageMarker extends Behaviour
{
    public isUsed : boolean = true;
    public usedBy : any = null;
}