import { foreachComponent } from "../../engine/engine_gameobject";
import { objectSerializer } from "../../engine/engine_serialization_builtin_serializer";
import { IComponent } from "../../engine/engine_types";
import { $shadowDomOwner } from "./BaseUIComponent";
import { ICanvasGroup, IGraphic } from "./Interfaces";
import { Object3D } from "three";


export class UIRaycastUtils {

    /** returns the real object when dealing with shadow UI */
    static getObject(obj: Object3D): Object3D {
        const shadowOwner = obj[$shadowDomOwner];
        if(shadowOwner) 
        {
            if((shadowOwner as IComponent).isComponent === true) obj = (shadowOwner as IComponent).gameObject;
            else obj = shadowOwner;
        }
        return obj;
    };

    static isInteractable(obj: THREE.Object3D, out?: { canvasGroup?: ICanvasGroup, graphic?: IGraphic }): boolean {
        if(obj === null || obj === undefined || !obj.visible) return false;

        obj = this.getObject(obj);

        if(!obj.visible) return false;
        
        const canvasGroup = this.tryFindCanvasGroup(obj);
        if (canvasGroup?.isCanvasGroup === true) {
            if (out) out.canvasGroup = canvasGroup as ICanvasGroup;
            if (canvasGroup.blocksRaycasts === false) return false;
            if (canvasGroup.interactable === false) return false;
        }
        // handle Graphic Raycast target
        const graphic = foreachComponent(obj, c => {
            if ((c as unknown as IGraphic).isGraphic === true) return c;
            return undefined;
        }, false);
        // console.log(obj, graphic?.raycastTarget);
        if (out) {
            if (graphic?.isGraphic === true)
                out.graphic = graphic as IGraphic;
        }
        if (graphic?.raycastTarget === false) return false;

        return true;
    }


    private static tryFindCanvasGroup(obj: THREE.Object3D | null): ICanvasGroup | null {
        if (!obj) return null;
        // test for canvas groups
        const res = foreachComponent(obj, c => {
            const gr = c as unknown as ICanvasGroup;
            if (gr.blocksRaycasts !== undefined && gr.interactable !== undefined) return gr;
            return undefined;
        }, false);
        if (res !== undefined) return res;
        return this.tryFindCanvasGroup(obj.parent);
    }
}

