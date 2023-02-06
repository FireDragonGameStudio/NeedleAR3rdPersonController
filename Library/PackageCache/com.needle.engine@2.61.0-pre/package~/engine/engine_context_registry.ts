import { IContext } from "./engine_types";

export enum ContextEvent {
    ContextCreated = "ContextCreated",
    ContextDestroyed = "ContextDestroyed",
    MissingCamera = "MissingCamera",
}

export type ContextEventArgs = {
    event: ContextEvent;
    context: IContext;
}

export type ContextCallback = (evt: ContextEventArgs) => void;

export class ContextRegistry {
    static Current: IContext;

    static Registered: IContext[] = [];

    static register(ctx: IContext) {
        this.Registered.push(ctx);
    }

    static unregister(ctx: IContext) {
        const index = this.Registered.indexOf(ctx);
        if (index === -1) return;
        this.Registered.splice(index, 1);
    }

    private static _callbacks: { [evt: string]: Array<ContextCallback> } = {};

    static registerCallback(evt: ContextEvent, callback: ContextCallback) {
        if (!this._callbacks[evt]) this._callbacks[evt] = [];
        this._callbacks[evt].push(callback);
    }

    static unregisterCallback(evt: ContextEvent, callback: ContextCallback) {
        if (!this._callbacks[evt]) return;
        const index = this._callbacks[evt].indexOf(callback);
        if (index === -1) return;
        this._callbacks[evt].splice(index, 1);
    }

    static dispatchCallback(evt: ContextEvent, context:IContext) {
        if (!this._callbacks[evt]) return;
        const args = { event: evt, context }
        this._callbacks[evt].forEach(cb => cb(args));
    }
}