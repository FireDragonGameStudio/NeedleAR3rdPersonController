import { Constructor } from "./engine_types";

export declare type TypeResolver<T> = (data) => Constructor<T> | null;

/** Please use "@serializable" - this version has a typo and will be removed in future versions */
export const serializeable = function <T>(type?: Constructor<T> | null | Array<Constructor<any> | TypeResolver<T>> | TypeResolver<T>) {
    return serializable(type)
}

export const serializable = function <T>(type?: Constructor<T> | null | Array<Constructor<any> | TypeResolver<T>> | TypeResolver<T>) {
    if (type === undefined) type = null;
    // for primitive types the serialization handles it without the constructor and just assigns the value
    // if the user still passes in a primitive type constructor we can just throw it away :)
    if (!Array.isArray(type)) {
        type = setNullForPrimitiveTypes(type);
    }
    else {
        for (let i = 0; i < type.length; i++) {
            const entry = type[i];
            type[i] = setNullForPrimitiveTypes(entry);
        }
    }

    return function (_target: any, _propertyKey: string) {
        // this is important so objects with inheritance dont override their serialized type 
        // info if e.g. multiple classes inheriting from the same type implement a member with the same name
        // and both use @serializable() with different types 
        if (!Object.getOwnPropertyDescriptor(_target, '$serializedTypes'))
            _target["$serializedTypes"] = {};
        const types = _target["$serializedTypes"] = _target["$serializedTypes"] || {}
        types[_propertyKey] = type;
    }
}

function setNullForPrimitiveTypes(type) {
    switch (type?.prototype?.constructor?.name) {
        case "Number":
        case "String":
        case "Boolean":
            return null;
    }
    return type;
}


export const ALL_PROPERTIES_MARKER = "__NEEDLE__ALL_PROPERTIES";


/** @deprecated current not used */
export function allProperties(constructor: Function) {
    constructor[ALL_PROPERTIES_MARKER] = true;
}


export const STRICT_MARKER = "__NEEDLE__STRICT";

/** @deprecated  current not used */
export function strict(constructor: Function) {
    constructor[STRICT_MARKER] = true;
}