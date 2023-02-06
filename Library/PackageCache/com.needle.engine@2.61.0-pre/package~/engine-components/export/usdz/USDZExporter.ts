import { delay, getParam, isiOS, isMobileDevice, isSafari } from "../../../engine/engine_utils";
import { Object3D, Color } from "three";
import * as THREE from "three";
import { USDZExporter as ThreeUSDZExporter } from "three/examples/jsm/exporters/USDZExporter";
import { AnimationExtension } from "./extensions/Animation"
import { ensureQuicklookLinkIsCreated } from "./utils/quicklook";
import { getFormattedDate } from "./utils/timeutils";
import { registerAnimatorsImplictly } from "./utils/animationutils";
import { IUSDZExporterExtension } from "./Extension";
import { Behaviour, GameObject } from "../../Component";
import { WebXR } from "../../WebXR"
import { serializable } from "../../../engine/engine_serialization";
import { showBalloonWarning } from "../../../engine/debug/debug";
import { Context } from "../../../engine/engine_setup";
import { WebARSessionRoot } from "../../WebARSessionRoot";

const debug = getParam("debugusdz");

export type QuickLookOverlay = {
    callToAction?: string;
    checkoutTitle?: string;
    checkoutSubtitle?: string;
}

export class USDZExporter extends Behaviour {

    @serializable(Object3D)
    objectToExport?: THREE.Object3D;

    @serializable()
    autoExportAnimations: boolean = false;

    extensions: IUSDZExporterExtension[] = [];

    private link!: HTMLAnchorElement;
    private webxr?: WebXR;
    private webARSessionRoot: WebARSessionRoot | undefined;


    start() {
        if (debug) {
            window.addEventListener("keydown", (evt) => {
                switch (evt.key) {
                    case "t":
                        this.exportAsync();
                        break;
                }
            });
            if (isMobileDevice()) {
                setTimeout(() => {
                    this.exportAsync();
                }, 2000)
            }
        }
        document.getElementById("open-in-ar")?.addEventListener("click", (evt) => {
            evt.preventDefault();
            this.exportAsync();
        });

        if (!this.objectToExport) this.objectToExport = this.gameObject;
    }



    onEnable() {
        const ios = isiOS()
        const safari = isSafari();
        if (debug || (ios && safari)) {
            this.createQuicklookButton();
            this.webARSessionRoot = GameObject.findObjectOfType(WebARSessionRoot) ?? undefined;
            this.lastCallback = this.quicklookCallback.bind(this);
            this.link = ensureQuicklookLinkIsCreated(this.context);
            this.link.addEventListener('message', this.lastCallback);
        }
    }

    onDisable() {
        this.link?.removeEventListener('message', this.lastCallback);
    }

    async exportAsync() {
        if (!this.objectToExport) return;

        // make sure we apply the AR scale
        if (this.webARSessionRoot) {
            const scene = this.webARSessionRoot.gameObject;
            const scale = 1 / this.webARSessionRoot!.arScale;
            scene.matrix.makeScale(scale, scale, scale);
            if (this.webARSessionRoot.invertForward) {
                scene.matrix.multiply(new THREE.Matrix4().makeRotationY(Math.PI));
            }
        }

        const exporter = new ThreeUSDZExporter();
        const extensions: any = [...this.extensions]

        // collect animators and their clips
        const animExt = new AnimationExtension();
        extensions.push(animExt);

        if (this.autoExportAnimations)
            registerAnimatorsImplictly(this.objectToExport, animExt);

        const eventArgs = { self: this, exporter: exporter, extensions: extensions, object: this.objectToExport };
        this.dispatchEvent(new CustomEvent("before-export", { detail: eventArgs }))

        let name = "needle";
        if (debug) name += "-" + getFormattedDate();

        //@ts-ignore
        exporter.debug = debug;
        //@ts-ignore
        const arraybuffer = await exporter.parse(this.objectToExport, extensions);
        const blob = new Blob([arraybuffer], { type: 'application/octet-stream' });

        this.dispatchEvent(new CustomEvent("after-export", { detail: eventArgs }))

        // second file: USDA (without assets)
        //@ts-ignore
        // const usda = exporter.lastUsda;
        // const blob2 = new Blob([usda], { type: 'text/plain' });
        // this.link.download = name + ".usda";
        // this.link.href = URL.createObjectURL(blob2);
        // this.link.click();

        // see https://developer.apple.com/documentation/arkit/adding_an_apple_pay_button_or_a_custom_action_in_ar_quick_look
        const overlay = this.buildQuicklookOverlay();
        const callToAction = overlay.callToAction ? encodeURIComponent(overlay.callToAction) : "";
        const checkoutTitle = overlay.checkoutTitle ? encodeURIComponent(overlay.checkoutTitle) : "";
        const checkoutSubtitle = overlay.checkoutSubtitle ? encodeURIComponent(overlay.checkoutSubtitle) : "";
        this.link.href = URL.createObjectURL(blob) + `#callToAction=${callToAction}&checkoutTitle=${checkoutTitle}&checkoutSubtitle=${checkoutSubtitle}&`;


        if (!this.lastCallback) {
            this.lastCallback = this.quicklookCallback.bind(this);
            this.link.addEventListener('message', this.lastCallback);
        }

        // open quicklook
        this.link.download = name + ".usdz";
        this.link.click();

        // TODO detect QuickLook availability:
        // https://webkit.org/blog/8421/viewing-augmented-reality-assets-in-safari-for-ios/#:~:text=inside%20the%20anchor.-,Feature%20Detection,-To%20detect%20support
    }

    private lastCallback?: any;

    private quicklookCallback(event) {
        if ((event as any)?.data == '_apple_ar_quicklook_button_tapped') {
            if (debug) showBalloonWarning("Quicklook closed via call to action button");
            this.dispatchEvent(new CustomEvent("quicklook-button-tapped", { detail: this }));
        }
    }

    private buildQuicklookOverlay(): QuickLookOverlay {
        const obj: QuickLookOverlay = {};
        obj.callToAction = "Close";
        obj.checkoutTitle = "🌵 Made with Needle";
        obj.checkoutSubtitle = "_";
        // Use the quicklook-overlay event to customize the overlay
        this.dispatchEvent(new CustomEvent("quicklook-overlay", { detail: obj }));
        return obj;
    }

    private _arButton?: HTMLElement;
    private async createQuicklookButton() {
        if (!this.webxr) {
            await delay(1);
            this.webxr = GameObject.findObjectOfType(WebXR) ?? undefined;
            if (this.webxr) {
                if (this.webxr.VRButton) this.webxr.VRButton.parentElement?.removeChild(this.webxr.VRButton);
                // check if we have an AR button already and re-use that
                if (this.webxr.ARButton && this._arButton !== this.webxr.ARButton) {
                    this._arButton = this.webxr.ARButton;
                    // Hack to remove the immersiveweb link
                    const linkInButton = this.webxr.ARButton.parentElement?.querySelector("a");
                    if (linkInButton) {
                        linkInButton.href = "";
                    }
                    this.webxr.ARButton.innerText = "Open in Quicklook";
                    this.webxr.ARButton.disabled = false;
                    this.webxr.ARButton.addEventListener("click", evt => {
                        evt.preventDefault();
                        this.exportAsync();
                    });
                    this.webxr.ARButton.classList.add("quicklook-ar-button");
                    this.dispatchEvent(new CustomEvent("created-button", { detail: this.webxr.ARButton }))
                }
                // create a button if WebXR didnt create one yet
                else {
                    this.webxr.createARButton = false;
                    this.webxr.createVRButton = false;
                    let container = window.document.querySelector(".webxr-buttons");
                    if (!container) {
                        container = document.createElement("div");
                        container.classList.add("webxr-buttons");
                    }
                    const button = document.createElement("button");
                    button.innerText = "Open in Quicklook";
                    button.addEventListener("click", () => {
                        this.exportAsync();
                    });
                    button.classList.add('webxr-ar-button');
                    button.classList.add('webxr-button');
                    button.classList.add("quicklook-ar-button");
                    container.appendChild(button);
                    this.dispatchEvent(new CustomEvent("created-button", { detail: button }))
                }
            }
            else {
                console.warn("Could not find WebXR component: will not create Quicklook button", Context.Current);
            }
        }
    }

    private resetStyles(el: HTMLElement) {
        el.style.position = "";
        el.style.top = "";
        el.style.left = "";
        el.style.width = "";
        el.style.height = "";
        el.style.margin = "";
        el.style.padding = "";
        el.style.border = "";
        el.style.background = "";
        el.style.color = "";
        el.style.font = "";
        el.style.textAlign = "";
        el.style.opacity = "";
        el.style.zIndex = "";
    }
}
