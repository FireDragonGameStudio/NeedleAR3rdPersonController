import { GLTF } from "three/examples/jsm/loaders/GLTFLoader";
import { getParam } from "./engine_utils";
import { Object3D } from "three";
import { Context } from "./engine_setup";
import { isPersistentAsset } from "./extensions/NEEDLE_persistent_assets";
import { SourceIdentifier } from "./engine_types";
import { debugExtension } from "../engine/engine_default_parameters";
import { LogType, addLog } from "./debug/debug_overlay";
import { isLocalNetwork } from "./engine_networking_utils";
import { $BuiltInTypeFlag } from "./engine_typestore";

const debug = getParam("debugserializer");


export type Constructor<T> = { new(...args: any[]): T };
export declare type NodeToObjectMap = { [nodeId: string]: Object3D };
export declare type ObjectToNodeMap = { [uuid: string]: number };

// internal helper class that we can ask for registered type serializers
// register your own type by deriving from ITypeSerializer and calling helper.register
class SerializationHelper {
    register(type: string, ser: ITypeSerializer) {
        if (this.typeMap[type] !== undefined) {
            if (this.typeMap[type] === ser) return;
            console.warn("Type " + type + " is already registered", ser, this.typeMap[type]);
        }
        if (debug)
            console.log("Register type serializer for " + type, ser);
        this.typeMap[type] = ser;
    }

    typeMap: { [type: string]: ITypeSerializer } = {};

    getSerializer(type: string): ITypeSerializer | undefined {
        if (!type) return undefined;
        return this.typeMap[type];
    }

    getSerializerForConstructor(type: any, level: number = 0): ITypeSerializer | undefined {
        if (level > 20) return undefined;
        if (!type || !type.constructor) {
            if (debug)
                console.log("invalid type");
            return undefined;
        }
        const name = type.name ?? type.constructor?.name;
        if (!name) {
            if (debug)
                console.log("invalid name", name);
            return undefined;
        }
        const res = this.getSerializer(name);
        if (res !== undefined) {
            if (debug)
                console.log("FOUND " + name, type.name, type.constructor.name, res, this.typeMap);
            return res;
        }
        let parent = Object.getPrototypeOf(type);
        const hasPrototypeOrConstructor = parent.prototype || parent.constructor;
        // console.log(name, type, parent);
        if (!hasPrototypeOrConstructor) {
            if (debug)
                console.warn("No prototype for " + name, type, type.name, type.prototype, type.constructor.name);
            // console.log(type.constructor);
            // console.dir(type);
            // console.log(Object.getPrototypeOf(type))
            // console.dir(parent, Object.getPrototypeOf(type));
            // if(level <= 0){
            //     const t = TypeStore.get(type.name);
            //     console.log(type['__proto__'].name);
            //     if(t) return this.getSerializerForConstructor(t, level + 1);
            // }
            return undefined;
        }
        const prot = parent.prototype ?? parent.constructor;
        if (prot !== type) {
            const resultFromChildren = this.getSerializerForConstructor(prot, ++level);
            if (resultFromChildren) {
                if (debug)
                    console.log("FOUND " + prot.constructor.name, prot.name, prot, resultFromChildren);
                // register sub type
                const typeName = prot.name ?? prot.constructor.name;
                if (typeName === "Function") {
                    console.error("Registering Function is not allowed, something went wrong", type, prot, resultFromChildren);
                }
                else
                    this.register(typeName, resultFromChildren);
            }
            return resultFromChildren;
        }
        return undefined;
    }
}

export const helper: SerializationHelper = new SerializationHelper();


export interface ITypeSerializer {
    onSerialize(data: any, context: SerializationContext): any;
    onDeserialize(data: any, context: SerializationContext): any;
}



/**
 * implement and call super(<type string or array>) with the type names this serializer can handle
 * for example: 
 * class ColorSerializer extends TypeSerializer { 
 *  constructor() { 
 *      super("Color") 
 *  } 
 * } 
*/
export abstract class TypeSerializer implements ITypeSerializer {

    // register<T>(c: Constructor<T> | Constructor<T>[])
    // {
    //     if (Array.isArray(c)) {
    //         for (const t of c) {
    //             helper.register(t.name, this);
    //         }
    //     }
    //     else {
    //         helper.register(c.name, this);
    //     }
    // }

    constructor(type: Constructor<any> | Constructor<any>[]) {
        if (Array.isArray(type)) {
            for (const key of type)
                helper.register(key.name, this);
        }
        else
            helper.register(type.name, this);
    }
    abstract onSerialize(data: any, context: SerializationContext): any | void;
    abstract onDeserialize(data: any, context: SerializationContext): any | void;
}




export interface ITypeInformation {
    type?: Constructor<any>;
}

/** holds information if a field was undefined before serialization. This gives us info if we might want to warn the user about missing attributes */
export class ImplementationInformation {

    private isDevMode = isLocalNetwork();
    private cache: { [key: string]: string[] } = {};


    /** only call when assigning values for the very first time */
    registerDefinedKeys(typeName: string, type: object) {
        if (!this.isDevMode) return;
        if (this.cache[typeName] === undefined) {
            this.cache[typeName] = Object.keys(type);
        }
    }


    getDefinedKey(typeName: string, key: string) {
        if (this.cache[typeName] === undefined) return false;
        const keys = this.cache[typeName];
        const res = keys.includes(key);
        return res;
    }
}

// passed to serializers
export class SerializationContext {
    root: THREE.Object3D;

    gltf?: GLTF;
    gltfId?: SourceIdentifier;
    object!: THREE.Object3D;
    target?: object;
    nodeId?: number;
    nodeToObject?: NodeToObjectMap;
    objectToNode?: ObjectToNodeMap;
    context?: Context;
    path?: string;
    type?: Constructor<any>;
    /** holds information if a field was undefined before serialization. This gives us info if we might want to warn the user about missing attributes */
    implementationInformation?: ImplementationInformation;

    constructor(root: THREE.Object3D) {
        this.root = root;
    }
}


export interface ISerializable {
    $serializedTypes?: { [key: string]: Constructor<any> | ITypeInformation | null };
    // onDeserialize?(context: SerializationContext): void;
    // example:
    /* $serializedTypes : {

        // it can be a constructor
        myFieldName: Vector3,

        // it can be null if it is a primitve type
        myFieldName: null,

        // it can be an object containing a field type that has a constructor
        // this is just so we have some flexibility later if we need superspecialcustom overrides
        myFieldName : { type: THREE.Color },
    }
    */

    onBeforeDeserialize?(data: any, context: SerializationContext): void | undefined | boolean;
    onBeforeDeserializeMember?(key: string, data: any, context: SerializationContext): void | undefined | boolean;
    onAfterDeserializeMember?(key: string, data: any, context: SerializationContext): void;
    onAfterDeserialize?(data: any, context: SerializationContext): void;
};


export function serializeObject(obj: ISerializable, context: SerializationContext): object | null {
    const types = obj.$serializedTypes;
    if (types === undefined) return null;
    const res = {};
    for (const key in types) {
        let val = obj[key];

        // if the object bein serialized is some type of object check if we have special handling registered for it
        if (val !== undefined && val !== null && typeof val === "object") {
            // get type name
            // get registered serialization handler
            const ser = helper.getSerializerForConstructor(val);
            if (ser) {
                // serialize data using that handler
                res[key] = ser.onSerialize(val, context);
                continue;
            }
        }
        res[key] = val;
    }
    // name is the component type
    res["name"] = obj.constructor.name;
    // serialize guid
    if (typeof obj["guid"] === "string")
        res["guid"] = obj["guid"];
    return res;
}


const buffer: Array<any> = [];

function collectSerializedTypesInBaseTypes(obj: ISerializable, typeInfoObject?: object): object | undefined {
    if (!obj) return typeInfoObject;
    if (typeof obj.$serializedTypes === "object") {
        if (!typeInfoObject) typeInfoObject = {};
        Object.assign(typeInfoObject, obj.$serializedTypes);
    }
    const parentTarget = Object.getPrototypeOf(obj);
    return collectSerializedTypesInBaseTypes(parentTarget, typeInfoObject);
}


export function deserializeObject(obj: ISerializable, serializedData: object, context: SerializationContext): boolean {
    if (!obj) return false;

    context.target = obj;

    if (obj.onBeforeDeserialize !== undefined) {
        const res = obj.onBeforeDeserialize(serializedData, context);
        if (typeof res === "boolean") return res;
    }

    // const typeInfo = obj.$serializedTypes;
    const typeInfo = collectSerializedTypesInBaseTypes(obj);
    if (serializedData) {
        // restore guid (see serializeObject)
        if (typeof serializedData["guid"] === "string")
            obj["guid"] = serializedData["guid"];

        if (typeInfo) {
            for (const key in typeInfo) {
                const serializedEntryInfo = typeInfo[key];
                const data = serializedData[key];


                if (obj[key] !== undefined && data === undefined) {
                    // if a field is marked as serialized and has some default value
                    // but no data was serialized do not override the default value with undefined
                    continue;
                }

                context.type = undefined;
                context.path = key;

                if (serializedEntryInfo === null) {
                    obj[key] = data;
                }
                else {

                    if (obj.onBeforeDeserializeMember !== undefined) {
                        // callback to the instance, if it returns true assume it's done all the things itself
                        if (obj.onBeforeDeserializeMember(key, data, context) === true) continue;
                    }

                    if (Array.isArray(serializedEntryInfo)) {
                        for (let i = 0; i < serializedEntryInfo.length; i++) {
                            const typeInfoOrConstructor = serializedEntryInfo[i];
                            const res = tryResolve(typeInfoOrConstructor);
                            if (res !== undefined || i === serializedEntryInfo.length - 1) {
                                obj[key] = res;
                                break;
                            }
                        }
                    }
                    else {
                        obj[key] = tryResolve(serializedEntryInfo);
                    }

                    function tryResolve(typeInfoOrConstructor) {
                        const typeInformationOrConstructor = typeInfoOrConstructor as ITypeInformation;
                        // if the entry does specify an object of type ITypeInformation and has the type field set
                        const type = typeInformationOrConstructor.type;
                        if (type) {
                            return deserializeObjectWithType(data, type, context, undefined, obj[key]);
                        }
                        // it can also just contain a constructor
                        else {
                            const constructor = typeInfoOrConstructor as Constructor<any>;
                            return deserializeObjectWithType(data, constructor, context, undefined, obj[key]);
                        }
                    }

                    buffer.length = 0;

                    if (obj.onAfterDeserializeMember !== undefined) {
                        obj.onAfterDeserializeMember(key, data, context);
                    }
                }
            }
        }

        // ***
        // the code below could be used to implictly assign serialized data if they are primitive types
        // if we decide not to do this we always have to write out all the $serializedTypes
        // *** 
        implictlyAssignPrimitiveTypes(obj, serializedData);
    }

    checkObjectAssignments(obj, serializedData, context.implementationInformation);

    if (obj.onAfterDeserialize !== undefined) {
        obj.onAfterDeserialize(serializedData, context);
    }

    context.path = undefined;
    return true;
}

const blockChecks = getParam("noerrors");
function checkObjectAssignments(obj: any, serializedData: any, implementationInformation?: ImplementationInformation) {
    if (blockChecks) return;
    if (!serializedData) return;
    if (isLocalNetwork() === false) return;
    if (!obj) return;

    // ignore builtin components that we dont want to check
    if (obj.constructor && obj.constructor[$BuiltInTypeFlag] === true) return;

    const typeName = obj.constructor?.name as string;
    // test if any object reference is missing serializable
    const ownKeys = Object.getOwnPropertyNames(serializedData);
    for (const key of ownKeys) {
        if (key === "sourceId") continue;
        const value = obj[key];
        if(value == null) continue;
        const serialized = serializedData[key];
        // check if the field is defined in the class
        if (implementationInformation?.getDefinedKey(typeName, key) === false) {
            
            // if the field is defined but the defined key is uppercase we need to show a warning
            // because all fields are serialized in lowercase
            const firstCharUppercase = key.charAt(0).toUpperCase() + key.slice(1);
            if (implementationInformation.getDefinedKey(typeName, firstCharUppercase)) {
                addLog(LogType.Warn, "<strong>Please rename</strong> \"" + firstCharUppercase + "\" to \"" + key + "\" in " + typeName);
                console.warn("Please use lowercase for field: \"" + firstCharUppercase + "\" in " + typeName, serialized, obj);
            }

            continue;
        }
        if (serialized === undefined || serialized === null) continue;
        if (typeof serialized === "object") {
            if (value === undefined || !value.isObject3D) {
                if (typeof serialized["node"] === "number" || typeof serialized["guid"] === "string") {
                    if (serialized["could_not_resolve"]) {
                        continue;
                    }
                    const hasOtherKeys = value !== undefined && Object.keys(value).length > 1;
                    if (!hasOtherKeys) {
                        addLog(LogType.Warn, `<strong>Missing serialization for object reference!</strong>\n\nPlease change to: \n@serializable(Object3D)\n${key}? : Object3D;\n\nin script ${typeName}.ts\n<a href="https://docs.needle.tools/serializable" target="_blank">documentation</a>`);
                        console.warn(typeName, key, obj[key], obj);
                        continue;
                    }
                }
            }
        }
        if (typeof value === "string") {
            if (serialized.endsWith(".gltf") || serialized.endsWith(".glb")) {
                addLog(LogType.Warn, `<strong>Missing serialization for object reference!</strong>\n\nPlease change to: \n@serializable(AssetReference)\n${key}? : AssetReference;\n\nin script ${typeName}.ts\n<a href="https://docs.needle.tools/serializable" target="_blank">documentation</a>`);
                console.warn(typeName, key, obj[key], obj);
                continue;
            }
        }
    }
}

function implictlyAssignPrimitiveTypes(obj: any, serializedData: any) {
    // implictly assign serialized primitive fields
    for (const key of Object.keys(serializedData)) {
        const data = serializedData[key];
        if (typeof data === "object" && data !== null && data !== undefined) {
            const member = obj[key];
            if (!member) {
                if (debug)
                    console.log(key, "is undefined on", obj);
                continue;
            }
            for (const key of Object.keys(data)) {
                const targetMember = member[key];
                // implictly assign number, string, boolean if they are undefined
                if (targetMember !== undefined) continue;
                // resolve serialized primitive types
                if (isPrimitiveType(data[key]) && !isPrimitiveType(member)) {
                    // console.log("ASSIGN", key, member, member[key], targetMember, data[key]);
                    member[key] = data[key];
                }
            }
        }
    }
}

function isPrimitiveType(val): boolean {
    switch (typeof val) {
        case "number":
        case "string":
        case "boolean":
            return true;
    }
    return false;
}

// this is a wrapper for the cached serializer
// we use this to avoid trying to retrieve a serializer for a type multiple times
// e.g. when a type is actually an array of types
declare type TypeDeserializeReference = {
    serializer?: ITypeSerializer
}

function deserializeObjectWithType(data: any, typeOrConstructor: Constructor<any>, context: SerializationContext, typeContext?: TypeDeserializeReference, currentValue?: any): any {

    // e.g. @serializable((data) => { })
    let typeIsFunction = typeof typeOrConstructor === "function" && (typeOrConstructor.prototype === undefined);
    let type = typeOrConstructor;
    if (typeIsFunction) {
        // it's possible to assign a function to serializable to dynamically say which type we expect
        // e.g. if you have an array of types and you want the array to be resolved with different class instances
        try {
            const resolvedType = (typeOrConstructor as any)?.call(typeOrConstructor, currentValue);
            type = resolvedType;
            typeIsFunction = false;
            if (type === null || type === undefined) return;
        }
        catch (err) {
            console.error("Error in callback", err, data);
        }
    }
    context.type = type;

    // e.g. when @serializable(Texture) and the texture is already resolved via json pointer from gltf
    // then we dont need to do anything else
    if (!typeIsFunction && currentValue instanceof type) return currentValue;

    // if the value was already resolved via the persistent asset extension dont try to override that again
    if (currentValue && typeof currentValue === "object" && isPersistentAsset(currentValue)) {
        // if the persistent asset was already resolved to a concrete instance we dont need to do anything anymore
        if (currentValue["__concreteInstance"]) {
            return currentValue["__concreteInstance"];
        }
        const serializableInstance = currentValue as ISerializable;
        if (!serializableInstance.$serializedTypes && type.prototype.$serializedTypes)
            serializableInstance.$serializedTypes = type.prototype.$serializedTypes;
        if (serializableInstance.$serializedTypes) {
            deserializeObject(serializableInstance, data, context);
        }

        if (currentValue && type !== undefined) {
            try {
                // we create a concrete instance for a persistent asset here
                // hence we want to have the same instance across all usages of this asset
                const instance = new type();
                if (debugExtension)
                    console.log("Create concrete instance for persistent asset", currentValue, "instance:", instance);
                assign(instance, currentValue);
                // save it so if another component references the same persistent asset it will automatically use the concrete instance
                currentValue["__concreteInstance"] = instance;
                currentValue = instance;
            }
            catch (err) {
                console.error("Error creating instance or creating values on instance", err, currentValue, type);
            }
        }
        return currentValue;
    }

    // try to resolve the serializer for a type only once
    if (!typeContext) {
        typeContext = {
            serializer: helper.getSerializerForConstructor(type)
        }
    }

    // if the type is an array resolve each entries recursively
    if (Array.isArray(data)) {
        const newArr: any[] = [];
        for (let i = 0; i < data.length; i++) {
            const obj = data[i];
            // debugger;
            const res = deserializeObjectWithType(obj, typeOrConstructor, context, typeContext, obj)
            newArr.push(res);
        }
        // return value;
        return newArr;
    }

    const ser = typeContext.serializer;
    if (ser) {
        return ser.onDeserialize(data, context);
    }

    // console.log(type.prototype.get("$serializedTypes"));

    let instance: any = undefined;
    if (data && (data.isMaterial || data.isTexture || data.isObject3D)) {
        // if the data is already a threejs object we dont want to create a new instance
        // e.g. if we have a serialized class with a serializable(Material)
        instance = data;
    }
    else {
        // happens when exporting e.g. Animation component with only clip assigned (clips array is marked as serialized but it might be undefined if no clips are assigned in e.g. blender)
        if (data === undefined) return undefined;
        // the fallback - this assumes that the type has a constructor that accepts the serialized arguments
        // made originally with THREE.Vector3 in mind but SHOULD actually not be used/called anymore
        instance = new type(...setBuffer(data));
    }

    // recurse if the deserialized member also implements Iserializable
    const serializableInstance = instance as ISerializable;
    if (serializableInstance.$serializedTypes) {
        deserializeObject(serializableInstance, data, context);
    }
    return instance;
}

function setBuffer(value): Array<any> {
    buffer.length = 0;
    if (typeof value === "object" && value !== null && value !== undefined) {
        for (const key of Object.keys(value)) {
            buffer.push(value[key]);
        }
    }
    return buffer;
}


/** set to true while assigning properties during instantiation. 
 * Used for validate decorator to not invoke callbacks on components that are currently in the process of being built */
export const $isAssigningProperties = Symbol("assigned component properties");

// const developmentMode = getParam("dev")

/** Object.assign behaviour but check if property is writeable (e.g. getter only properties are skipped) */
export function assign(target: any, source: any, info?: ImplementationInformation) {
    if (source === undefined || source === null) return;
    if (target === undefined || target === null) return;

    let onlyDeclared = false;
    // if (onlyDeclared === true && target.constructor) {
    //     if (target.constructor[ALL_PROPERTIES_MARKER] === true)
    //         onlyDeclared = false;
    // }

    // if (onlyDeclared !== true && target.constructor) {
    //     if (target.constructor[STRICT_MARKER] === true)
    //         onlyDeclared = true;
    // }

    // if (onlyDeclared === undefined)
    //     onlyDeclared = true;

    // if (developmentMode)
    //     onlyDeclared = false;

    target[$isAssigningProperties] = true;
    const typeName = target.constructor?.name ?? "unknown";

    // register the keys that the actual type has defined
    // this will be used later when checking if deserialization has assigned all properties
    // or if anything could not be deserialized to warn the user
    info?.registerDefinedKeys(typeName, target);

    for (const key of Object.keys(source)) {
        const desc = getPropertyDescriptor(target, key);
        if (onlyDeclared && desc === undefined) continue;
        if (!desc || desc.writable === true) {
            target[key] = source[key];
        }
        else if (desc?.set !== undefined) {
            target[key] = source[key];
        }
    }
    delete target[$isAssigningProperties];
}

// we need to recurse because the property might be defined in a base class
function getPropertyDescriptor(obj: any, prop: string): PropertyDescriptor | undefined {
    let desc;
    do {
        desc = Object.getOwnPropertyDescriptor(obj, prop);
    } while (!desc && (obj = Object.getPrototypeOf(obj)));
    return desc;
}