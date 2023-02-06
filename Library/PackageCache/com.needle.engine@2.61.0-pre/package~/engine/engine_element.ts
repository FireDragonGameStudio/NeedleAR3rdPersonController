import { Context, build_scene_functions, LoadingOptions, LoadingProgressArgs } from "./engine_setup";
import { AROverlayHandler, arContainerClassName } from "./engine_element_overlay";
import { GameObject } from "../engine-components/Component";
import { processNewScripts } from "./engine_mainloop_utils";
import { calculateProgress01, EngineLoadingView, ILoadingViewHandler } from "./engine_element_loading";
import { delay, getParam } from "./engine_utils";
import { setDracoDecoderPath, setDracoDecoderType, setKtx2TranscoderPath } from "./engine_loaders";
import { getLoader, registerLoader } from "../engine/engine_gltf";
import { NeedleGltfLoader } from "./engine_scenetools";
import { INeedleEngineComponent } from "./engine_types";

// registering loader here too to make sure it's imported when using engine via vanilla js
registerLoader(NeedleGltfLoader);

const debug = getParam("debugwebcomponent");

class EngineElementSourceFileWatcher {

    private id: string;
    private context: Context;
    private previouslyAdded: any;
    private previousSource?: string;
    private networkEvent: string;

    constructor(id: string, context: Context) {
        this.id = id;
        this.context = context;
        this.networkEvent = "needle-engine-source-changed";
        if (this.id) this.networkEvent += "-" + this.id;
        this.context.connection.beginListen(this.networkEvent, fn => {
            this.onSourceChanged(fn, true);
        });
    }

    async onSourceChanged(newSource: string, dontSend: boolean = false, isStartup: boolean = false) {
        if (this.previouslyAdded) {
            // if event was from remote and source didnt change do nothing
            if (dontSend && newSource === this.previousSource) { }
            else
                GameObject.destroySynced(this.previouslyAdded);
        }
        this.previouslyAdded = null;

        if (!dontSend) {
            this.context.connection.send(this.networkEvent, newSource);
        }

        this.previousSource = newSource;
        Context.Current = this.context;
        const res = await getLoader().loadSync(this.context, newSource, this.getHashFromString(newSource), false);
        if (!isStartup)
            processNewScripts(this.context);
        const obj = res?.scene;
        if (obj) {
            this.previouslyAdded = obj;
            this.context.scene.add(obj);
        }
    }

    private getHashFromString(str: string) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return hash;
    }
}

const htmlTagName = "needle-engine";
const vrContainerClassName = "vr";
const desktopContainerClassname = "desktop";
const knownClasses = [arContainerClassName, vrContainerClassName, desktopContainerClassname];
const arSessionActiveClassName = "ar-session-active";
const desktopSessionActiveClassName = "desktop-session-active";

// https://developers.google.com/web/fundamentals/web-components/customelements
export class EngineElement extends HTMLElement implements INeedleEngineComponent {

    public get loadingProgress01(): number { return this._loadingProgress01; }
    public get loadingFinished(): boolean { return this.loadingProgress01 > .999; }

    public getContext(): Promise<Context> {
        return new Promise((res, _rej) => {
            if (this._context && this.loadingFinished) {
                res(this._context);
            }
            else {
                const cb = () => {
                    this.removeEventListener("loadfinished", cb);
                    if (this._context && this.loadingFinished) {
                        res(this._context);
                    }
                };
                this.addEventListener("loadfinished", cb);
            }
        });
    }

    public get Context() { return this._context; }

    /**@obsolete use GameObject */
    private gameObject = GameObject; // used to access static methods from regular js
    private GameObject = GameObject;

    private _context: Context | null = null;
    private _overlay_ar: AROverlayHandler;
    private _loadingProgress01: number = 0;

    private _watcher?: EngineElementSourceFileWatcher;
    private _loadingView?: ILoadingViewHandler;

    constructor() {
        super();
        this._overlay_ar = new AROverlayHandler();
    }

    async connectedCallback() {
        this.onSetupDesktop();

        var observer = new MutationObserver(this.onElementsChanged.bind(this));
        observer.observe(this, { childList: true })

        // user can set a function name or a path to a gltf or glb to be loaded
        const srcFile = () => {
            const srcVal = this.getAttribute("src");
            if (srcVal?.endsWith(".glb") || srcVal?.endsWith(".gltf")) {
                return srcVal;
            }
            return null;
        };
        let src: string | null = "loadScene";
        const srcAttributeValue = srcFile();
        if (srcAttributeValue) src = srcAttributeValue;

        const alias = this.getAttribute("alias");
        const hash = this.getAttribute("hash");
        this._context = new Context({ name: src, domElement: this, alias: alias, hash: hash ?? undefined });
        this._watcher = new EngineElementSourceFileWatcher(this.getAttribute("id") ?? alias ?? "", this._context);

        if (src && src.length > 0) {
            // try to get the load function

            // HACK: if no explicit glb is assigned we have to wait for the codegen function to be available
            // it happened in one case during local development where the function was not yet registered
            // but this component was connected already
            if (!srcAttributeValue) {
                while (Object.keys(build_scene_functions).length <= 0) {
                    if (!this.isConnected) return;
                    await delay(10);
                }
            }

            let fn: (context: Context) => Promise<void> = build_scene_functions[src] ?? window[src];
            // if no load function is found (e.g. when generated code was deleted or import removed) then just load the glb
            // or if an explicit src file is provided
            let previousFileLoaded: string | null = null;
            if (!fn || srcAttributeValue) {
                if (srcAttributeValue)
                    src = srcAttributeValue;
                fn = async _ => {
                    const file = srcFile();
                    if (file && this._watcher) {
                        previousFileLoaded = file;
                        await this._watcher.onSourceChanged(file, true, true);
                    }
                }
            }
            if (fn) {
                this.classList.add("loading");
                if (debug)
                    console.log("Needle Engine: Begin loading", alias ?? "");
                const allowOverridingDefaultLoading = true;
                // default loading can be overriden by calling preventDefault in the onload start event
                const useDefaultLoading = this.dispatchEvent(new CustomEvent("loadstart", {
                    detail: {
                        context: this._context,
                        alias: alias
                    },
                    cancelable: allowOverridingDefaultLoading
                }));
                if (!this._loadingView && useDefaultLoading)
                    this._loadingView = new EngineLoadingView(this);
                if (useDefaultLoading)
                    this._loadingView?.onLoadingBegin("begin load");
                // setup the loading callback for the default loading handler and the user defined one
                const loadingCallback = (progress: LoadingProgressArgs, message?: string) => {
                    this._loadingProgress01 = calculateProgress01(progress);
                    if (useDefaultLoading)
                        this._loadingView?.onLoadingUpdate(progress, message);
                    this.dispatchEvent(new CustomEvent("progress", {
                        detail: {
                            context: this._context,
                            name: progress.name,
                            progress: progress.progress,
                            index: progress.index,
                            count: progress.count,
                            totalProgress01: this._loadingProgress01
                        }
                    }));
                }
                this.onBeforeBeginLoading();
                await this._context.onCreate(fn, { progress: loadingCallback });
                const file = srcFile();
                if (file) {
                    // only if we didnt load this file here already
                    if (file !== previousFileLoaded)
                        await this._watcher.onSourceChanged(file, true, true);
                }
                this._loadingProgress01 = 1;
                if (useDefaultLoading)
                    this._loadingView?.onLoadingFinished("create scene");
                this.classList.remove("loading");
                this.classList.add("loading-finished");
                if (debug)
                    console.log("Needle Engine: finished loading", alias ?? "");
                this.dispatchEvent(new CustomEvent("loadfinished", {
                    detail: {
                        context: this._context,
                        src: alias ?? src
                    }
                }));
                this.onSetupDesktop();
            }
            else {
                console.error("Could not find scene function named \"" + src + "\", it must be either in global scope " +
                    "or added to build_scene_functions", build_scene_functions);
            }
        } else {
            console.error("Missing src attribute - please provide a function name", this);
        }
    }

    disconnectedCallback() {
        if (this._context) {
            this._context.onDestroy();
        }
    }

    static get observedAttributes() {
        return ["hash", "src", "loadstart", "progress", "loadfinished", "dracoDecoderPath", "dracoDecoderType", "ktx2DecoderPath"];
    }

    attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
        // console.log(name, oldValue, newValue);
        switch (name) {
            case "src":
                this._watcher?.onSourceChanged(newValue);
                break;
            case "loadstart":
            case "progress":
            case "loadfinished":
                if (typeof newValue === "string" && newValue.length > 0) {
                    if (debug) console.log(name + " attribute changed", newValue);
                    this.registerEventFromAttribute(name, newValue);
                }
                break;
            case "dracoDecoderPath":
                if (debug) console.log("dracoDecoderPath", newValue);
                setDracoDecoderPath(newValue);
                break;
            case "dracoDecoderType":
                if (newValue === "wasm" || newValue === "js") {
                    if (debug) console.log("dracoDecoderType", newValue);
                    setDracoDecoderType(newValue);
                }
                else console.error("Invalid dracoDecoderType", newValue, "expected js or wasm");
                break;
            case "ktx2DecoderPath":
                if (debug) console.log("ktx2DecoderPath", newValue);
                setKtx2TranscoderPath(newValue);
                break;
        }
    }

    private registerEventFromAttribute(eventName: string, code: string) {
        if (typeof code === "string" && code.length > 0) {
            // indirect eval https://esbuild.github.io/content-types/#direct-eval
            const fn = (0, eval)(code);
            // const fn = new Function(newValue);
            if (typeof fn === "function") {
                this.addEventListener(eventName, evt => fn?.call(globalThis, this._context, evt));
            }
        }
    }

    getAROverlayContainer(): HTMLElement {
        return this._overlay_ar.findOrCreateARContainer(this);
    }

    getVROverlayContainer(): HTMLElement | null {
        for (let i = 0; i < this.children.length; i++) {
            const ch = this.children[i] as HTMLElement;
            if (ch.classList.contains("vr"))
                return ch;
        }
        return null;
    }

    onEnterAR(session: XRSession, overlayContainer: HTMLElement) {
        this.onSetupAR();
        this._overlay_ar.onBegin(this._context!, overlayContainer, session);
        this.dispatchEvent(new CustomEvent("enter-ar", { detail: { session: session, context: this._context, htmlContainer: this._overlay_ar?.ARContainer } }));
    }

    onExitAR(session: XRSession) {
        this._overlay_ar.onEnd(this._context!);
        this.onSetupDesktop();
        this.dispatchEvent(new CustomEvent("exit-ar", { detail: { session: session, context: this._context, htmlContainer: this._overlay_ar?.ARContainer } }));
    }

    onEnterVR(session: XRSession) {
        this.onSetupVR();
        this.dispatchEvent(new CustomEvent("enter-vr", { detail: { session: session, context: this._context } }));
    }

    onExitVR(session: XRSession) {
        this.onSetupDesktop();
        this.dispatchEvent(new CustomEvent("exit-vr", { detail: { session: session, context: this._context } }));
    }

    private onElementsChanged() {

    }

    private onSetupAR() {
        this.classList.add(arSessionActiveClassName);
        this.classList.remove(desktopSessionActiveClassName);
        const arContainer = this.getAROverlayContainer();
        if (arContainer) {
            arContainer.classList.add(arSessionActiveClassName);
            arContainer.classList.remove(desktopSessionActiveClassName);
        }
        this.foreachHtmlElement(ch => this.setupElementsForMode(ch, arContainerClassName));
    }

    private onSetupVR() {
        this.classList.remove(arSessionActiveClassName);
        this.classList.remove(desktopSessionActiveClassName);
        this.foreachHtmlElement(ch => this.setupElementsForMode(ch, vrContainerClassName));
    }

    private onSetupDesktop() {
        this.classList.remove(arSessionActiveClassName);
        this.classList.add(desktopSessionActiveClassName);
        const arContainer = this.getAROverlayContainer();
        if (arContainer) {
            arContainer.classList.remove(arSessionActiveClassName);
            arContainer.classList.add(desktopSessionActiveClassName);
        }
        this.foreachHtmlElement(ch => this.setupElementsForMode(ch, desktopContainerClassname));
    }

    private setupElementsForMode(el: HTMLElement, currentSessionType: string, _session: XRSession | null = null) {
        if (el === this._context?.renderer.domElement) return;
        if (el.id === "VRButton" || el.id === "ARButton") return;
        el.style.position = "absolute";
        // el.style.zIndex = "100";
        // ch.style.width = "100hv";
        // ch.style.height = "100hv";
        // set pointer events to none by default (if not explicitly declared)
        // if (!el.style.pointerEvents)
        //     el.style.pointerEvents = "none";

        const classList = el.classList;
        if (classList.contains(currentSessionType)) {
            el.style.visibility = "visible";
            if (el.style.display === "none")
                el.style.display = "block";
        }
        else {
            // only modify style for elements that have a known class (e.g. marked as vr ar desktop)
            for (const known of knownClasses) {
                if (el.classList.contains(known)) {
                    el.style.visibility = "hidden";
                    el.style.display = "none";
                }
            }
        }
    }

    private foreachHtmlElement(cb: (HTMLElement) => void) {
        for (let i = 0; i < this.children.length; i++) {
            const ch = this.children[i] as HTMLElement;
            if (ch.style) cb(ch);
        }
    }

    private onBeforeBeginLoading() {
        const customDracoDecoderPath = this.getAttribute("dracoDecoderPath");
        if (customDracoDecoderPath) {
            if (debug) console.log("using custom draco decoder path", customDracoDecoderPath);
            setDracoDecoderPath(customDracoDecoderPath);
        }
        const customDracoDecoderType = this.getAttribute("dracoDecoderType");
        if (customDracoDecoderType) {
            if (debug) console.log("using custom draco decoder type", customDracoDecoderType);
            setDracoDecoderType(customDracoDecoderType);
        }
        const customKtx2DecoderPath = this.getAttribute("ktx2DecoderPath");
        if (customKtx2DecoderPath) {
            if (debug) console.log("using custom ktx2 decoder path", customKtx2DecoderPath);
            setKtx2TranscoderPath(customKtx2DecoderPath);
        }
    }
}

if (!window.customElements.get(htmlTagName))
    window.customElements.define(htmlTagName, EngineElement);



