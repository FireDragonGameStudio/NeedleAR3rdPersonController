import { Context } from "./engine_setup";

export enum ApplicationEvents {
    Visible = "application-visible",
    Hidden = "application-hidden",
}

export class Application extends EventTarget {

    private context : Context;

    public get hasFocus() : boolean {
        return document.hasFocus();
    }

    public get isVisible(): boolean {
        return this._isVisible;
    }

    private _isVisible: boolean = true;

    constructor(context : Context) {
        super();
        this.context = context;
        // console.log("APP");
        window.addEventListener("visibilitychange", this.onVisiblityChanged.bind(this), false);
    }

    private onVisiblityChanged(evt) {
        // console.log(evt.target.visibilityState)
        switch (evt.target.visibilityState) {
            case "hidden":
                this._isVisible = false;
                this.dispatchEvent(new Event(ApplicationEvents.Hidden));
                break;
            case "visible":
                this._isVisible = true;
                this.dispatchEvent(new Event(ApplicationEvents.Visible));
                break;
        }
    }
}
