import { applyPrototypeExtensions, registerPrototypeExtensions } from "./ExtensionUtils";
import { Object3D } from "three";
import { Constructor, ConstructorConcrete, IComponent } from "../../engine/engine_types"
import { IComponent as Component } from "../../engine/engine_types";
import { addNewComponent, getComponent, getComponentInChildren, getComponentInParent, getComponents, getComponentsInChildren, getComponentsInParent, getOrAddComponent, removeComponent } from "../../engine/engine_components";
import { isActiveSelf, setActive } from "../../engine/engine_gameobject";

// used to decorate cloned object3D objects with the same added components defined above
export function apply(object: Object3D) {
    if (object && object.isObject3D === true) {
        applyPrototypeExtensions(object, Object3D);
    }
}



// do we still need this?
Object3D.prototype["SetActive"] = function (active: boolean) {
    this.visible = active;
}

Object3D.prototype["addNewComponent"] = function <T extends Component>(type: ConstructorConcrete<T>) {
    return addNewComponent(this, new type());
}

Object3D.prototype["removeComponent"] = function (inst: Component) {
    return removeComponent(this, inst);
}

Object3D.prototype["getOrAddComponent"] = function <T extends IComponent>(typeName: ConstructorConcrete<T>): T {
    return getOrAddComponent<T>(this, typeName);
}

Object3D.prototype["getComponent"] = function <T extends IComponent>(type: Constructor<T>) {
    return getComponent(this, type);
}

Object3D.prototype["getComponents"] = function <T extends IComponent>(type: Constructor<T>, arr?: []) {
    return getComponents(this, type, arr);
}

Object3D.prototype["getComponentInChildren"] = function <T extends IComponent>(type: Constructor<T>) {
    return getComponentInChildren(this, type);
}

Object3D.prototype["getComponentsInChildren"] = function <T extends IComponent>(type: Constructor<T>, arr?: []) {
    return getComponentsInChildren(this, type, arr);
}

Object3D.prototype["getComponentInParent"] = function <T extends IComponent>(type: Constructor<T>) {
    return getComponentInParent(this, type);
}

Object3D.prototype["getComponentsInParent"] = function <T>(type: Constructor<T>, arr?: []) {
    return getComponentsInParent(this, type, arr);
}

// this is a fix to allow gameObject active animation be applied to a three object
if (!Object.getOwnPropertyDescriptor(Object3D.prototype, "activeSelf")) {
    Object.defineProperty(Object3D.prototype, "activeSelf", {
        get: function () {
            return isActiveSelf(this)
        },
        set: function (val: boolean | number) {
            setActive(this, val, true);
        }
    });
}




// do this after adding the component extensions
registerPrototypeExtensions(Object3D);
