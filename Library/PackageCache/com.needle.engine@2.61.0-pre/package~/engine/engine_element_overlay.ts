import { Context } from "./engine_setup";
import { getParam, isMozillaXR } from "./engine_utils";

const debug = getParam("debugaroverlay");
export const arContainerClassName = "ar";
export const quitARClassName = "quit-ar";

// https://developers.google.com/web/fundamentals/web-components/customelements
export class AROverlayHandler {

    get ARContainer(): HTMLElement | null { return this.arContainer; }

    constructor() {
        this.closeARCallback = this.onRequestedEndAR.bind(this);
    }

    private arContainer: HTMLElement | null = null;
    closeARCallback: any;
    currentSession: XRSession | null = null;
    registeredCloseEventElements: Element[] = [];

    private _createdAROnlyElements: Array<any> = [];
    private _reparentedObjects: Array<{ el: Element, previousParent: HTMLElement | null }> = [];

    requestEndAR() {
        this.onRequestedEndAR();
    }

    onBegin(context: Context, overlayContainer: HTMLElement, session: XRSession) {
        this.currentSession = session;
        this.arContainer = overlayContainer;

        const arElements = context.domElement.querySelectorAll(`.${arContainerClassName}`);
        arElements.forEach(el => {
            if (!el) return;
            if (el === this.arContainer) return;
            this._reparentedObjects.push({ el: el, previousParent: el.parentElement });
            this.arContainer?.appendChild(el);
        });

        const quit_Elements = overlayContainer.getElementsByClassName(quitARClassName);
        if (!quit_Elements || quit_Elements.length <= 0) {
            console.warn(`Missing quit AR elements, creating fallback X button. Use class name '${quitARClassName}' to override.`);
            this.createFallbackCloseARButton(this.arContainer);
        }
        else {
            for (let i = 0; i < quit_Elements.length; i++) {
                const el = quit_Elements[i];
                if (!el) continue;
                el.addEventListener("click", this.closeARCallback);
                this.registeredCloseEventElements.push(el);
            }
        }
    }

    onEnd(_context: Context) {
        // if (this.arContainer)
        // this.arContainer.classList.remove("ar-session-active");
        for (const created of this._createdAROnlyElements) {
            if (created.remove) {
                created.remove();
            }
        }

        for (const prev of this._reparentedObjects) {
            const el = prev.el as HTMLElement;
            prev.previousParent?.appendChild(el);
        }
        this._reparentedObjects.length = 0;

        // mozilla XR exit AR fixes
        if (isMozillaXR()) {
            // without the timeout we get errors in mozillas code and can not enter XR again
            // not sure why we have to wait
            setTimeout(() => {
                // Canvas is not in DOM anymore after AR using Mozilla XR
                const canvas = _context.renderer.domElement;
                if (canvas) {
                    _context.domElement.insertBefore(canvas, _context.domElement.firstChild);
                }

                // Fix visibility
                const elements = document.querySelectorAll("*");
                for (var i = 0; i < elements.length; i++) {
                    const child = elements[i] as any;
                    if (child && child._displayChanged !== undefined && child._displayWas !== undefined) {
                        child.style.display = child._displayWas;
                    }
                }
            }, 10);
        }
    }

    findOrCreateARContainer(element: HTMLElement): HTMLElement {
        // search in the needle-engine element
        if (element.classList.contains(arContainerClassName)) {
            return element;
        }
        if (element.children) {
            for (let i = 0; i < element.children.length; i++) {
                const ch = element.children[i] as HTMLElement;
                if (!ch || !ch.classList) continue;
                if (ch.classList.contains(arContainerClassName)) {
                    return ch;
                }
            }
        }

        // search in document as well; "ar" element could live outside needle-engine element
        const arElements = document.getElementsByClassName(arContainerClassName);
        if (arElements && arElements.length > 0)
            return arElements[0] as HTMLElement;

        if (debug)
            console.log("No overlay container found in document - generating new ony");
        const el = document.createElement("div");
        el.classList.add(arContainerClassName);
        el.style.position = "absolute";
        el.style.width = "100%";
        el.style.height = "100%";
        el.style.display = "flex";
        el.style.visibility = "visible";
        return element.appendChild(el);
    }

    private onRequestedEndAR() {
        if (!this.currentSession) return;
        this.currentSession.end();
        this.currentSession = null;

        for (const el of this.registeredCloseEventElements) {
            el.removeEventListener("click", this.closeARCallback);
        }
        this.registeredCloseEventElements.length = 0;
    }

    private createFallbackCloseARButton(element: HTMLElement) {
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', "38px");
        svg.setAttribute('height', "38px");
        svg.style.position = 'absolute';
        svg.style.right = '20px';
        svg.style.top = '40px';
        svg.style.zIndex = '9999';
        svg.style.pointerEvents = 'auto';
        svg.addEventListener('click', this.closeARCallback);
        element.appendChild(svg);
        this._createdAROnlyElements.push(svg);

        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M 12,12 L 28,28 M 28,12 12,28');
        path.setAttribute('stroke', '#ddd');
        path.setAttribute('stroke-width', "3px");
        svg.appendChild(path);
        this._createdAROnlyElements.push(path);
    }

}
