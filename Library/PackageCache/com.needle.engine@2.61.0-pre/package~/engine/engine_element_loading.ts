import { showBalloonWarning } from "./api";
import { Mathf } from "./engine_math";
import { LoadingProgressArgs } from "./engine_setup";
import { getParam } from "./engine_utils";

const debug = getParam("debugloadingbar");
const debugRendering = getParam("debugloadingbarrendering");

export class LoadingElementOptions {
    className?: string;
    additionalClasses?: string[];
}

export interface ILoadingViewHandler {
    onLoadingBegin(message?: string);
    onLoadingUpdate(progress: LoadingProgressArgs, message?: string);
    onLoadingFinished(message?: string);
}

let currentFileProgress = 0;
let currentFileName: string;
export function calculateProgress01(progress: LoadingProgressArgs) {
    if (debug) console.log(progress.progress.loaded.toFixed(0) + "/" + progress.progress.total.toFixed(0), progress);

    const count = progress.count;
    const total: number | undefined = progress.progress.total;
    // if the progress event total amount is unknown / not reported
    // we slowly move the progress bar forward
    if (total === 0 || total === undefined) {
        // reset the temp progress when the file has changed
        if (currentFileName !== progress.name)
            currentFileProgress = 0;
        currentFileName = progress.name;
        // slowly move the progress bar forward
        currentFileProgress += (1 - currentFileProgress) * .001;
        if (debug) showBalloonWarning("Loading " + progress.name + " did not report total size");
    }
    else {
        currentFileProgress = progress.progress.loaded / total;
    }
    const prog = progress.index / count + currentFileProgress / count;
    return Mathf.clamp01(prog);
}

export class EngineLoadingView implements ILoadingViewHandler {

    static LoadingContainerClassName = "loading";

    // the raw progress
    loadingProgress: number = 0;

    private container: HTMLElement;
    private _progress: number = 0;
    private _allowCustomLoadingElement: boolean = true;
    private _loadingElement?: HTMLElement;
    private _loadingTextContainer: HTMLElement | null = null;
    private _loadingBar: HTMLElement | null = null;
    private _messageContainer: HTMLElement | null = null;
    private _loadingElementOptions?: LoadingElementOptions;

    constructor(container: HTMLElement, opts?: LoadingElementOptions) {
        this.container = container;
        this._loadingElementOptions = opts;
    }

    onLoadingBegin(message?: string) {
        if(debug) console.log("Begin Loading")
        if (!this._loadingElement) {
            for (let i = 0; i < this.container.children.length; i++) {
                const el = this.container.children[i] as HTMLElement;
                if (el.classList.contains(EngineLoadingView.LoadingContainerClassName)) {
                    if (!this._allowCustomLoadingElement) {
                        if(debug) console.warn("Remove custom loading container")
                        this.container.removeChild(el);
                        continue;
                    }
                    this._loadingElement = this.createLoadingElement(el);
                }
            }
            if (!this._loadingElement)
                this._loadingElement = this.createLoadingElement();
        }
        this._progress = 0;
        this.loadingProgress = 0;
        this._loadingElement.style.display = "flex";
        this.container.appendChild(this._loadingElement);
        this.smoothProgressLoop();
        this.setMessage(message ?? "");
    }

    onLoadingUpdate(progress: LoadingProgressArgs | ProgressEvent | number, message?: string) {
        // if the element has no parent we want to add it
        if (!this._loadingElement?.parentElement) {
            this.onLoadingBegin(message);
        }
        // console.log(callback.name, callback.progress.loaded / callback.progress.total, callback.index + "/" + callback.count);
        let total01 = 0;
        if (typeof progress === "number") {
            total01 = progress;
        }
        else {
            if ("index" in progress)
                total01 = calculateProgress01(progress);
            if (!message && "name" in progress)
                this.setMessage(progress.name);
        }
        this.loadingProgress = total01;
        if (message) this.setMessage(message);
        this.updateDisplay();
    }

    onLoadingFinished(message?: string) {
        this.loadingProgress = 1;
        this.setMessage(message ?? "");
    }

    setMessage(message: string) {
        if (this._messageContainer) {
            this._messageContainer.innerText = message;
        }
    }

    private _progressLoop: any;
    private smoothProgressLoop() {
        if (this._progressLoop) return;
        let dt = 1 / 12;
        const max = 1 - .05;
        if(debugRendering) dt = 1 / 500;
        this._progressLoop = setInterval(() => {
            if (this.loadingProgress >= 1 && this._progress >= max) {
                if (this._loadingElement) {
                    if(debug) console.log("Hiding loading element");
                    this._loadingElement.style.display = "none";
                    this._loadingElement.remove();
                }
                clearInterval(this._progressLoop);
                this._progressLoop = null;
                return;
            }
            this._progress = Mathf.lerp(this._progress, this.loadingProgress, dt * this.loadingProgress);
            this.updateDisplay();
        }, dt);
    }

    private updateDisplay() {
        const t = this._progress;
        const percent = (t * 100).toFixed(0) + "%";
        if (this._loadingBar) {
            this._loadingBar.style.width = t * 100 + "%";
        }

        if (this._loadingTextContainer)
            this._loadingTextContainer.textContent = percent;
    }

    private createLoadingElement(existing?: HTMLElement): HTMLElement {
    if(debug && !existing) console.log("Creating loading element");
        this._loadingElement = existing || document.createElement("div");
        if (!existing) {
            this._loadingElement.style.position = "fixed";
            this._loadingElement.style.width = "100%";
            this._loadingElement.style.height = "100%";
            this._loadingElement.style.left = "0";
            this._loadingElement.style.top = "0";
            this._loadingElement.style.backgroundColor = "#000000";
            this._loadingElement.style.display = "flex";
            this._loadingElement.style.alignItems = "center";
            this._loadingElement.style.justifyContent = "center";
            this._loadingElement.style.zIndex = "1000";
            this._loadingElement.style.flexDirection = "column";
            this._loadingElement.style.pointerEvents = "none";
            this._loadingElement.style.color = "white";
        }

        const className = this._loadingElementOptions?.className ?? EngineLoadingView.LoadingContainerClassName;
        this._loadingElement.classList.add(className);
        if (this._loadingElementOptions?.additionalClasses) {
            for (const c of this._loadingElementOptions.additionalClasses) {
                this._loadingElement.classList.add(c);
            }
        }


        const loadingBarContainer = document.createElement("div");
        const maxWidth = 30;
        loadingBarContainer.style.display = "flex";
        loadingBarContainer.style.width = maxWidth + "%";
        loadingBarContainer.style.height = "2px";
        loadingBarContainer.style.background = "rgba(255,255,255,.1)"
        this._loadingElement.appendChild(loadingBarContainer);

        this._loadingBar = document.createElement("div");
        loadingBarContainer.appendChild(this._loadingBar);
        const getGradientPos = function (t: number): string {
            return Mathf.lerp(maxWidth * .5, 100 - maxWidth * .5, t) + "%";
        }
        this._loadingBar.style.background =
            `linear-gradient(90deg, #02022B ${getGradientPos(0)}, #0BA398 ${getGradientPos(.4)}, #99CC33 ${getGradientPos(.5)}, #D7DB0A ${getGradientPos(1)})`;
        this._loadingBar.style.backgroundAttachment = "fixed";
        this._loadingBar.style.width = "0%";
        this._loadingBar.style.height = "100%";

        this._loadingTextContainer = document.createElement("div");
        this._loadingTextContainer.style.display = "flex";
        this._loadingTextContainer.style.justifyContent = "center";
        this._loadingTextContainer.style.marginTop = ".9em";
        this._loadingElement.appendChild(this._loadingTextContainer);

        const messageContainer = document.createElement("div");
        this._messageContainer = messageContainer;
        messageContainer.style.display = "flex";
        messageContainer.style.fontSize = ".8em";
        messageContainer.style.paddingTop = ".5em";
        messageContainer.style.color = "rgba(255,255,255,.5)";
        // messageContainer.style.border = "1px solid rgba(255,255,255,.1)";
        messageContainer.style.justifyContent = "center";
        this._loadingElement.appendChild(messageContainer);

        return this._loadingElement;
    }
}