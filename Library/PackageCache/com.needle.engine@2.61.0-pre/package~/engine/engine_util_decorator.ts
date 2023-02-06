import { $isAssigningProperties } from "./engine_serialization_core";
import { LogType, showBalloonMessage } from "./debug/debug";
import { Constructor, IComponent } from "./engine_types";


declare type setter = (v: any) => void;
declare type getter = () => any;

/** create accessor callbacks for a field */
export const validate = function (set?: setter, get?: getter) {
    // "descriptor : undefined" prevents @validate() to be added to property getters or setters
    return function (target: IComponent | any, propertyKey: string, descriptor?: undefined) {
        createPropertyWrapper(target, propertyKey, descriptor, set, get);
    }
}


function createPropertyWrapper(target: IComponent | any, propertyKey: string, descriptor?: PropertyDescriptor,
    set?: setter,
    get?: getter) {

    if (!get && !set && !target.onValidate) return;

    // this is not undefined when its a property getter or setter already and not just a field
    // we currently only support validation of fields
    if (descriptor !== undefined) {
        console.error("Invalid usage of validate decorator. Only fields can be validated.", target, propertyKey, descriptor);
        showBalloonMessage("Invalid usage of validate decorator. Only fields can be validated. Property: " + propertyKey, LogType.Error);
        return;
    }

    if (target.__internalAwake) {
        // this is the hidden key we save the original property to
        const $prop = Symbol(propertyKey);
        // save the original awake method
        // we need to delay decoration until the object has been created
        const awake = target.__internalAwake;
        target.__internalAwake = function () {

            // only build wrapper once per type
            if (this[$prop] === undefined) {

                // make sure the field is initialized in a hidden property
                this[$prop] = this[propertyKey];

                Object.defineProperty(this, propertyKey, {
                    set: function (v) {
                        if (this[$isAssigningProperties] === true) {
                            this[$prop] = v;
                        }
                        else {
                            set?.call(this, v);
                            const oldValue = this[$prop];
                            this[$prop] = v;
                            this.onValidate?.call(this, propertyKey, oldValue);
                        }
                    },
                    get: function () {
                        get?.call(this);
                        return this[$prop];
                    },
                });
            }

            // call the original awake method
            awake.call(this);
        };
    }
}




/** experimental attribute - use to hook into another type's methods and run before the other methods run (similar to Harmony prefixes).
 * Return false to prevent the original method from running.
 */
export const prefix = function <T>(type: Constructor<T>) {
    return function (target: IComponent | any, propertyKey: string, _PropertyDescriptor: PropertyDescriptor) {

        const targetType = type.prototype;
        const originalProp = Object.getOwnPropertyDescriptor(targetType, propertyKey);
        if (!originalProp?.value) {
            console.warn("Can not apply prefix: type does not have method named", propertyKey, type);
            return;
        }
        const originalValue = originalProp.value;
        const prefix = target[propertyKey];
        Object.defineProperty(targetType, propertyKey, {
            value: function(...args){
                const res = prefix?.call(this, ...args);
                if(res === false) return;
                return originalValue.call(this, ...args);
            },
        });
    }
}
