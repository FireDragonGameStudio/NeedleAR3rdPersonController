import { serializable } from "../engine/engine_serialization_decorator";
import { Behaviour, GameObject } from "./Component";
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader";
import { EquirectangularRefractionMapping, sRGBEncoding, Texture, TextureLoader } from "three"
import { syncField } from "../engine/engine_networking_auto";


export class RemoteSkybox extends Behaviour {

    @syncField("setSkybox")
    @serializable()
    url?: string;

    @serializable()
    allowDrop: boolean = true;

    @serializable()
    background: boolean = true;

    @serializable()
    environment: boolean = true;

    private _loader?: RGBELoader | EXRLoader | TextureLoader;
    private _prevLoadedEnvironment?: Texture;
    private _prevEnvironment: Texture | null = null;
    private _prevBackground: any = null;

    onEnable() {
        this.setSkybox(this.url);
        this.registerDropEvents();
    }

    onDisable() {
        if (this.context.scene.environment === this._prevLoadedEnvironment) {
            if (!this.context.isInXR) {
                this.context.scene.environment = this._prevEnvironment;
                this.context.scene.background = this._prevBackground;
            }
            this._prevLoadedEnvironment = undefined;
        }
        this.unregisterDropEvents();
    }

    async setSkybox(url: string | undefined | null) {
        if (!url) return;
        if (!url?.endsWith(".hdr") && !url.endsWith(".exr")) {
            console.warn("Potentially invalid skybox url", this.url, "on", this.name);
        }

        // if (!this._loader) 
        {
            const isEXR = url.endsWith(".exr");
            const isHdr = url.endsWith(".hdr");
            if (isEXR) {
                this._loader = new EXRLoader();
            }
            else if (isHdr) {
                this._loader = new RGBELoader();
            }
            else {
                this._loader = new TextureLoader();
            }
        }
        console.log("Loading skybox: " + url);
        const envMap = await this._loader.loadAsync(url);
        if (!envMap) return;
        if (!this.enabled) return;
        this.url = url;
        envMap.mapping = EquirectangularRefractionMapping;
        if (this._loader instanceof TextureLoader) {
            envMap.encoding = sRGBEncoding;
        }
        this._prevBackground = this.context.scene.background;
        this._prevEnvironment = this.context.scene.environment;
        console.log("Set skybox", this.url);
        if (this.environment)
            this.context.scene.environment = envMap;
        if (this.background)
            this.context.scene.background = envMap;
        this._prevLoadedEnvironment = envMap;
        const nameIndex = url.lastIndexOf("/");
        envMap.name = url.substring(nameIndex >= 0 ? nameIndex + 1 : 0);
        if (this.context.mainCameraComponent?.backgroundBlurriness !== undefined)
            this.context.scene.backgroundBlurriness = this.context.mainCameraComponent.backgroundBlurriness;
    }


    private dragOverEvent?: any;
    private dropEvent?: any;

    private registerDropEvents() {
        if (this.dragOverEvent) return;

        this.dragOverEvent = (e: DragEvent) => {
            if (!this.allowDrop) return;
            if (!e.dataTransfer) return;
            for (const type of e.dataTransfer.types) {
                // in ondragover we dont get access to the content
                // but if we have a uri list we can assume
                // someone is maybe dragging a image file
                // so we want to capture this
                if (type === "text/uri-list") {
                    e.preventDefault();
                }
            }
        };

        this.dropEvent = (e: DragEvent) => {
            if (!this.allowDrop) return;
            e.preventDefault();
            if (!e.dataTransfer) return;
            for (const type of e.dataTransfer.types) {
                if (type === "text/uri-list") {
                    const url = e.dataTransfer.getData(type);
                    console.log(type, url);
                    let name = new RegExp(/polyhaven.com\/asset_img\/.+?\/(?<name>.+)\.png/).exec(url)?.groups?.name;
                    if (!name) {
                        name = new RegExp(/polyhaven\.com\/a\/(?<name>.+)/).exec(url)?.groups?.name;
                    }
                    console.log(name);
                    if (name) {
                        const envurl = "https://dl.polyhaven.org/file/ph-assets/HDRIs/exr/1k/" + name + "_1k.exr";
                        this.setSkybox(envurl);
                    }
                    else console.warn("Could not resolve skybox name from dropped url", url);
                }
            }
        };

        this.context.domElement.addEventListener("dragover", this.dragOverEvent);
        this.context.domElement.addEventListener("drop", this.dropEvent);
    }

    private unregisterDropEvents() {
        if (!this.dragOverEvent) return;
        this.context.domElement.removeEventListener("dragover", this.dragOverEvent);
        this.context.domElement.removeEventListener("drop", this.dropEvent);
    }
}