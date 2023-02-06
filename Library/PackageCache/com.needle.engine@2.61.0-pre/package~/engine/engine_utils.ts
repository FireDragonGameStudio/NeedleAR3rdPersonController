// use for typesafe interface method calls
import { SourceIdentifier } from "./engine_types";

// https://schneidenbach.gitbooks.io/typescript-cookbook/content/nameof-operator.html
export const nameofFactory = <T>() => (name: keyof T) => name;
export function nameof<T>(name: keyof T) {
    return nameofFactory<T>()(name);
}


export function isDebugMode(): boolean {
    return getParam("debug") ? true : false;
}



export class CircularBuffer<T> {
    private _factory: () => T;
    private _cache: T[] = [];
    private _maxSize: number;
    private _index: number = 0;

    constructor(factory: () => T, maxSize: number) {
        this._factory = factory;
        this._maxSize = maxSize;
    }

    get(): T {
        let i = this._index++;
        if (i >= this._cache.length) {
            if (i >= this._maxSize) {
                i = this._index = 0;
            }
            else {
                this._cache.push(this._factory());
            }
        }
        return this._cache[i];
    }
}



let saveParams: boolean = false;
const requestedParams: Array<string> = [];
setTimeout(() => {
    if (saveParams)
        console.log(requestedParams);
}, 100);

export function getUrlParams() {
    return new URLSearchParams(window.location.search);
}

export function getParam(paramName: string): string | boolean | number {

    if (saveParams && !requestedParams.includes(paramName))
        requestedParams.push(paramName);
    const urlParams = getUrlParams();
    if (urlParams.has(paramName)) {
        const val = urlParams.get(paramName);
        if (val) {
            const num = Number(val);
            if (!isNaN(num)) return num; 
            return val;
        }
        else return true;
    }
    return false;
}
saveParams = getParam("help") === true;

export function setParam(paramName: string, paramValue: string): void {
    const urlParams = getUrlParams();
    if (urlParams.has(paramName)) {
        urlParams.set(paramName, paramValue);
    }
    else
        urlParams.append(paramName, paramValue);
    document.location.search = urlParams.toString();
}

export function setParamWithoutReload(paramName: string, paramValue: string | null, appendHistory = true): void {
    const urlParams = getUrlParams();
    if (urlParams.has(paramName)) {
        if(paramValue === null) urlParams.delete(paramName);
        else urlParams.set(paramName, paramValue);
    }
    else if(paramValue !== null)
        urlParams.append(paramName, paramValue);
    if (appendHistory) pushState(paramName, urlParams);
    else setState(paramName, urlParams);
}

export function setOrAddParamsToUrl(url: URLSearchParams, paramName: string, paramValue: string | number): void {
    if (url.has(paramName)) {
        url.set(paramName, paramValue.toString());
    }
    else
        url.append(paramName, paramValue.toString());
}

export function pushState(title: string, urlParams: URLSearchParams) {
    window.history.pushState(null, title, "?" + urlParams.toString());
}

export function setState(title: string, urlParams: URLSearchParams) {
    window.history.replaceState(null, title, "?" + urlParams.toString());
}

// for room id
export function makeId(length): string {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() *
            charactersLength));
    }
    return result;
}

export function randomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

const adjectives = ["smol", "tiny", "giant", "interesting", "smart", "bright", "dull", "extreme", "beautiful", "pretty", "dark", "epic", "salty", "silly", "funny", "lame", "lazy", "loud", "lucky", "mad", "mean", "mighty", "mysterious", "nasty", "odd", "old", "powerful", "quiet", "rapid", "scary", "shiny", "shy", "silly", "smooth", "sour", "spicy", "stupid", "sweet", "tasty", "terrible", "ugly", "unusual", "vast", "wet", "wild", "witty", "wrong", "zany", "zealous", "zippy", "zombie", "zorro"];
const nouns = ["cat", "dog", "mouse", "pig", "cow", "horse", "sheep", "chicken", "duck", "goat", "panda", "tiger", "lion", "elephant", "monkey", "bird", "fish", "snake", "frog", "turtle", "hamster", "penguin", "kangaroo", "whale", "dolphin", "crocodile", "snail", "ant", "bee", "beetle", "butterfly", "dragon", "eagle", "fish", "giraffe", "lizard", "panda", "penguin", "rabbit", "snake", "spider", "tiger", "zebra"]
export function makeIdFromRandomWords(): string {
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    return randomAdjective + "_" + randomNoun;
}

// for url parameters
export function sanitizeString(str): string {
    str = str.replace(/[^a-z0-9áéíóúñü \.,_-]/gim, "");
    return str.trim();
}


// TODO: taken from scene utils
export function tryFindObject(globalObjectIdentifier: string, obj, recursive: boolean = true, searchComponents: boolean = false) {
    if (obj === undefined || obj === null) return null;

    if (obj.userData && obj.userData.guid === globalObjectIdentifier) return obj;
    else if (obj.guid == globalObjectIdentifier) return obj;

    if (searchComponents) {
        if (obj.userData?.components) {
            for (const comp of obj.userData.components) {
                if (comp.guid === globalObjectIdentifier) return comp;
            }
        }
    }

    if (recursive) {

        if (obj.scenes) {
            for (const i in obj.scenes) {
                const scene = obj.scenes[i];
                const found = tryFindObject(globalObjectIdentifier, scene, recursive, searchComponents);
                if (found) return found;
            }
        }

        if (obj.children) {
            for (const i in obj.children) {
                const child = obj.children[i];
                const found = tryFindObject(globalObjectIdentifier, child, recursive, searchComponents);
                if (found) return found;
            }
        }
    }
}

declare type deepClonePredicate = (owner: any, propertyName: string, current: any) => boolean;

export function deepClone(obj: any, predicate?: deepClonePredicate): any {
    if (obj !== null && obj !== undefined && typeof obj === "object") {
        let clone;
        if (Array.isArray(obj)) clone = [];
        else {
            clone = Object.create(obj);
            Object.assign(clone, obj);
        }
        for (const key of Object.keys(obj)) {
            const val = obj[key];
            if (predicate && !predicate(obj, key, val)) {
                // console.log("SKIP", val);
                clone[key] = val;
            }
            else if (val?.clone !== undefined && typeof val.clone === "function")
                clone[key] = val.clone();
            else
                clone[key] = deepClone(val, predicate);
        }
        return clone;
    }
    return obj;
}

export function delay(milliseconds: number): Promise<void> {
    return new Promise((res, _) => {
        setTimeout(res, milliseconds);
    });
}

// if a timeline is exported via menu item the audio clip path is relative to the glb (same folder)
// we need to detect that here and build the new audio source path relative to the new glb location
// the same is/might be true for any file that is/will be exported via menu item
const debugGetPath = getParam("debugsourcepath");
export function getPath(source: SourceIdentifier | undefined, uri: string): string {
    if (source === undefined) {
        if (debugGetPath) console.warn("getPath: source is undefined, returning uri", uri);
        return uri;
    }
    if (uri.startsWith("http")) {
        if (debugGetPath) console.warn("getPath: uri is absolute, returning uri", uri);
        return uri;
    }
    const pathIndex = source.lastIndexOf("/");
    if (pathIndex >= 0) {
        let newUri = source.substring(0, pathIndex + 1);

        const uriDirectoryIndex = uri.lastIndexOf("/");
        if (uriDirectoryIndex >= 0) {
            newUri += uri.substring(uriDirectoryIndex + 1);
        } else {
            newUri += uri;
        }
        if (debugGetPath) console.log("getPath:", source, " - changed uri from\n", uri, "\n→ ", newUri);
        return newUri;
    }
    return uri;
}
// export function getPath(glbLocation: SourceIdentifier | undefined, path: string) {
//     if (path && glbLocation && !path.includes("/")) {
//         // get directory of glb and prepend it to the audio file path
//         const pathIndex = glbLocation.lastIndexOf("/");
//         if (pathIndex >= 0) {
//             const newPath = glbLocation.substring(0, pathIndex + 1) + path;
//             return newPath;
//         }
//     }
//     return path;
// }


export type WriteCallback = (data: any, prop: string) => void;

export interface IWatch {
    subscribeWrite(callback: WriteCallback);
    apply();
    revoke();
    dispose();
}


// TODO: make it possible to add multiple watches to the same object property
class WatchImpl implements IWatch {
    subscribeWrite(callback: WriteCallback) {
        this.writeCallbacks.push(callback);
    }
    private writeCallbacks: (WriteCallback)[] = [];

    constructor(object: object, prop: string) {
        this._object = object;
        this._prop = prop;
        this._wrapperProp = Symbol("$" + prop);
        this.apply();
    }

    private _applied: boolean = false;
    private _object: any;
    private _prop: string;
    private _wrapperProp: symbol;

    apply() {
        if (this._applied) return;
        if (!this._object) return;
        const object = this._object;
        const prop = this._prop;
        if (object[prop] === undefined) return;
        this._applied = true;

        if (object[this._wrapperProp] !== undefined) {
            console.warn("Watcher is being applied to an object that already has a wrapper property. This is not (yet) supported");
        }

        // create a wrapper property
        const current = object[prop];
        object[this._wrapperProp] = current;
        // create wrapper methods
        const getter = () => {
            return object[this._wrapperProp];
        }
        const setter = (value) => {
            object[this._wrapperProp] = value;
            for (const write of this.writeCallbacks) {
                write(value, this._prop);
            }
        }
        // add the wrapper to the object
        Object.defineProperty(object, prop, {
            get: getter,
            set: setter
        });
    }

    revoke() {
        if (!this._applied) return;
        if (!this._object) return;
        this._applied = false;
        const object = this._object;
        const prop = this._prop;
        Reflect.deleteProperty(object, prop);
        const current = object[this._wrapperProp];
        object[prop] = current;
        Reflect.deleteProperty(object, this._wrapperProp);
    }

    dispose() {
        this.revoke();
        this.writeCallbacks.length = 0;
        this._object = null;
    }
}

export class Watch implements IWatch {

    private readonly _watches: IWatch[] = [];

    constructor(object: object, str: string[] | string) {
        if (Array.isArray(str)) {
            for (const s of str) {
                this._watches.push(new Watch(object, s));
            }
        }
        else {
            this._watches.push(new WatchImpl(object, str));
        }
    }

    subscribeWrite(callback: WriteCallback) {
        for (const w of this._watches) {
            w.subscribeWrite(callback);
        }
    }

    apply() {
        for (const w of this._watches) {
            w.apply();
        }
    }

    revoke() {
        for (const w of this._watches) {
            w.revoke();
        }
    }

    dispose() {
        for (const w of this._watches) {
            w.dispose();
        }
        this._watches.length = 0;
    }
}


export function isMobileDevice() {
    return (typeof window.orientation !== "undefined") || (navigator.userAgent.indexOf('IEMobile') !== -1);
}

export function isMozillaXR() {
    return /WebXRViewer\//i.test(navigator.userAgent);
}

const iosDevices = ['iPad Simulator', 'iPhone Simulator', 'iPod Simulator', 'iPad', 'iPhone', 'iPod'];
export function isiOS() {
    return iosDevices.includes(navigator.platform)
        // iPad on iOS 13 detection
        || (navigator.userAgent.includes("Mac") && "ontouchend" in document)
}

export function isSafari() {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

export function isQuest() {
    return navigator.userAgent.includes("OculusBrowser");
}