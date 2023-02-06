
export class CallInfo {
    method?: Function;
    enabled: boolean;

    constructor(method?: Function, enabled?: boolean) {
        this.method = method;
        this.enabled = enabled !== undefined ? enabled : true;
    }

    invoke(...args: any) {
        if (this.enabled === false) return;
        if (!this.method) {
            console.warn("No function. Please check you assigned a method to invoke on export", this);
            return;
        }
        this.method(...args);
    }

}

const isUpperCase = (string) => /^[A-Z]*$/.test(string);

export class EventListEvent extends Event { //implements ArrayLike<T> {

    args?: [];
}

// UnityEvent is emitted as EventList
export class EventList {

    private target?: object;
    private key?: string;

    // TODO: serialization should not take care of the args but instead give them to the eventlist directly
    // so we can handle passing them on here instead of in the serializer
    // this would also allow us to pass them on to the component EventTarget

    /** set an event target to try invoke the EventTarget dispatchEvent when this EventList is invoked */
    setEventTarget(key: string, target: object) {
        this.key = key;
        this.target = target;
        if (this.key !== undefined) {
            let temp = "";
            let foundFirstLetter = false;
            for (let c of this.key) {
                if (foundFirstLetter && isUpperCase(c))
                    temp += "-";
                foundFirstLetter = true;
                temp += c.toLowerCase();
            }
            this.key = temp;
        }
    }

    private _isInvoking: boolean = false;

    // TODO: can we make functions serializable?
    private methods: CallInfo[] = [];

    constructor(evts?: CallInfo[]) {
        this.methods = evts ?? [];
    }

    invoke(...args: any) {
        if (this._isInvoking) {
            console.warn("Circular event invocation detected. Please check your event listeners for circular references.", this);
            return;
        }


        this._isInvoking = true;
        try {

            // first invoke all the methods that were subscribed to this eventlist
            for (const m of this.methods) {
                m.invoke(...args);
            }

            // then try to dispatch the event on the object that is owning this eventlist
            // with this we get automatic event listener support for unity events on all componnets
            // so example for a component with a click UnityEvent you can also subscribe to the component like this:
            // myComponent.addEventListener("click", args => {...")
            if (typeof this.target === "object" && typeof this.key === "string") {
                const fn = this.target["dispatchEvent"];
                if (typeof fn === "function") {
                    const evt = new EventListEvent(this.key);
                    evt.args = args;
                    fn.call(this.target, evt);
                }
            }
        }
        finally {
            this._isInvoking = false;
        }
    }

    addEventListener(cb: Function): Function {
        this.methods.push(new CallInfo(cb, true));
        return cb;
    }

    removeEventListener(cb: Function | null | undefined) {
        if (!cb) return;
        for (let i = this.methods.length - 1; i >= 0; i--) {
            if (this.methods[i].method === cb) {
                this.methods[i].enabled = false;
                this.methods.splice(i, 1);
            }
        }
    }

    removeAllEventListeners() {
        this.methods.length = 0;
    }
}