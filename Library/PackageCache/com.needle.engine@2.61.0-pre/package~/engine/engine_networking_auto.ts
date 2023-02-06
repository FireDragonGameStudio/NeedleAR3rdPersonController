import { getParam } from "./engine_utils";
import { Component } from "../engine-components/Component";
import { RoomEvents } from "./engine_networking";

const debug = getParam("debugautosync");

class ComponentsSyncerManager {
    private _syncers: { [key: string]: ComponentPropertiesSyncer } = {};

    getOrCreateSyncer(comp: Component): ComponentPropertiesSyncer | null {
        if (!comp.guid) return null;
        if (this._syncers[comp.guid]) return this._syncers[comp.guid];
        const syncer = new ComponentPropertiesSyncer(comp);
        this._syncers[comp.guid] = syncer;
        return syncer;
    }
}
const syncerHandler = new ComponentsSyncerManager();

/**
 * Collects and bundles all changes in properties per component in a frame
 */
class ComponentPropertiesSyncer {

    comp: Component;

    constructor(comp: Component) {
        // console.log("CREATE NEW SYNC", comp.name, comp.guid);
        this.comp = comp;
    }

    // private getters: { [key: string]: Function } = {};
    private hasChanges: boolean = false;
    private changedProperties: { [key: string]: any } = {};
    private data = {};

    private _boundEvent?: Function;

    get networkingKey(): string {
        const obj = this.comp as object;
        const key = obj.constructor.name;
        return key;
    }

    /** is set to true in on receive call to avoid circular sending */
    private _isReceiving: boolean = false;
    private _isInit = false;

    init(comp) {
        if (this._isInit) return;
        this._isInit = true;
        this.comp = comp;
        // console.log("INIT", this.comp.name, this.networkingKey);
        this._boundEvent = this.onHandleSending.bind(this);
        this.comp.context.post_render_callbacks.push(this._boundEvent);
        this.comp.context.connection.beginListen(this.networkingKey, this.onHandleReceiving.bind(this));

        const state = this.comp.context.connection.tryGetState(this.comp.guid);
        if(state) this.onHandleReceiving(state);
    }

    notifyChanged(propertyName: string, value: any) {
        if (this._isReceiving) return;
        // console.log("Property changed: " + propertyName, value);
        this.hasChanges = true;
        this.changedProperties[propertyName] = value;
    }

    private onHandleSending() {
        if (!this.hasChanges) return;
        this.hasChanges = false;
        // console.log(this.changedProperties);
        const net = this.comp.context.connection;
        if (!net || !net.isConnected) {
            for (const key in this.changedProperties)
                delete this.changedProperties[key];
            return;
        }
        for (const key in this.data) {
            delete this.data[key];
        }
        this.data["guid"] = this.comp.guid;
        for (const name in this.changedProperties) {
            const value = this.changedProperties[name];
            // console.log(value);
            delete this.changedProperties[name];
            this.data[name] = value;
        }
        // console.log("SEND", this.comp.name, this.data, this.networkingKey);
        net.send(this.networkingKey, this.data);
    }

    private onHandleReceiving(val) {
        if (!this._isInit) return;
        if (!this.comp) return;
        const guid = val.guid;
        if (guid && guid !== this.comp.guid) return;
        if (debug)
            console.log("RECEIVED", this.comp.name, this.comp.guid, val);
        try {
            this._isReceiving = true;
            for (const key in val) {
                if (key === "guid") continue;
                const value = val[key];
                // console.log("SET", key, value, this.comp.guid, this.comp);
                this.comp[key] = value;
            }
        }
        catch (err) {
            console.error(err);
        }
        finally {
            this._isReceiving = false;
        }
    }

    // private _seen: Set<any> = new Set();
    // private uniqBy(a, key) {
    //     this._seen.clear();
    //     return a.filter(item => {
    //         let k = key(item);
    //         return this._seen.has(k) ? false : this._seen.add(k);
    //     });
    // }
}

function testValueChanged(newValue, previousValue): boolean {
    let valueChanged = previousValue !== newValue;
    if (!valueChanged && newValue && previousValue) {
        // TODO: array are reference types 
        // so we need to copy the previous array if we really want to compare it
        if (Array.isArray(newValue) && Array.isArray(previousValue)) {
            valueChanged = true;
            // if (value.length !== previousValue.length) {
            //     shouldSend = true;
            // }
            // else {
            //     for (let i = 0; i < value.length; i++) {
            //         if (value[i] !== previousValue[i]) {
            //             shouldSend = true;
            //             break;
            //         }
            //     }
            // }
        }
        else if (typeof newValue === "object" && typeof previousValue === "object") {
            // do we want to traverse / recursively check if anything changed???
            for (const key of Object.keys(newValue)) {
                if (newValue[key] !== previousValue[key]) {
                    valueChanged = true;
                    break;
                }
            }
        }
    }
    return valueChanged;
}

function getSyncer(instance): ComponentPropertiesSyncer | null {
    if (instance["__autoPropertySyncHandler"]) {
        return instance["__autoPropertySyncHandler"];
    }
    const syncer = syncerHandler.getOrCreateSyncer(instance);
    syncer?.init(instance);
    instance["__autoPropertySyncHandler"] = syncer;
    return syncer;
}

export declare type SyncFieldOptions = {
    onPropertyChanged: Function,
};

/**
 * Decorate a field to be automatically networked synced
 * @param onFieldChanged name of a callback function that will be called when the field is changed. 
 * This function may return false to prevent notifyChanged from being called 
 * (for example a networked color is sent as a number and may be converted to a color in the receiver again)
 * 
 * Parameters: (newValue, previousValue)
 * @returns 
 */
export const syncField = function (onFieldChanged?: string) {

    return function (target: any, propertyKey: string) {

        let syncer: ComponentPropertiesSyncer | null = null;
        const fn = onFieldChanged ? target[onFieldChanged] : undefined;

        const t = target;
        const internalAwake = t.__internalAwake;
        if (debug)
            console.log(propertyKey);
        const backingFieldName = propertyKey + "k__BackingField";

        t.__internalAwake = function () {
            if (this[backingFieldName] !== undefined) {
                return;
            }
            this[backingFieldName] = this[propertyKey];
            internalAwake.call(this);

            syncer = syncerHandler.getOrCreateSyncer(this);

            const desc = Object.getOwnPropertyDescriptor(this, propertyKey);
            if (desc?.set === undefined) {
                Object.defineProperty(this, propertyKey, {
                    set: function (value) {
                        const oldValue = this[backingFieldName];
                        this[backingFieldName] = value;
                        if (testValueChanged(value, oldValue)) {
                            if (fn?.call(this, value, oldValue) !== false)
                                getSyncer(this)?.notifyChanged(propertyKey, value);
                        }
                    },
                    get: function () {
                        return this[backingFieldName];
                    },
                    configurable: true,
                    enumerable: true,
                });
            }

            syncer?.init(this);
            
        }

    }
}


export declare type SyncOptions = {
    key?: string,
    fieldName?: string,
};

export const sync = function (_options?: SyncOptions) {

    return function <T>(target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
        // override awake
        const comp = target as Component;
        let syncer: ComponentPropertiesSyncer | null;
        const internalAwake = comp.__internalAwake.bind(comp);
        comp.__internalAwake = function () {
            if (!this.guid) {
                internalAwake?.call(this);
                return;
            }
            internalAwake();
            syncer = syncerHandler.getOrCreateSyncer(this);
            syncer?.init(this);
        }

        // inject getter and setter
        if (!descriptor.get) {
            const previousSetter = descriptor.set;
            const backingFieldName = _propertyKey + "k__BackingField";
            Object.defineProperty(target, _propertyKey, {
                set: function (value) {
                    this[backingFieldName] = value;
                    previousSetter?.call(this, value);
                },
                get: function () {
                    return this[backingFieldName];
                }
            });
            const newDescriptor = Object.getOwnPropertyDescriptor(target, _propertyKey);
            if (newDescriptor) {
                descriptor.set = newDescriptor.set;
                descriptor.get = newDescriptor.get;
            }
        }

        const setter = descriptor.set;
        const getter = descriptor.get;
        let previousValue: T | undefined = undefined;

        if (setter) {
            descriptor.set = function (value: T) {
                let valueChanged = false;

                const syncer = getSyncer(this);

                // test change
                if (syncer && comp.context && comp.context.connection?.isConnected) {
                    testValueChanged(value, previousValue);
                }

                if (valueChanged) {
                    // set the value
                    previousValue = value;
                    setter.call(this, value);
                    syncer?.notifyChanged(_propertyKey, value);
                }
            };
        }
    }

};


