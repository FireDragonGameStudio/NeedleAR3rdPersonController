import { AmbientLight, Color, HemisphereLight } from "three";
import { GLTF, GLTFLoaderPlugin, GLTFParser } from "three/examples/jsm/loaders/GLTFLoader";
import { SourceIdentifier } from "../engine_types";
import { Behaviour, GameObject } from "../../engine-components/Component";
import { AmbientMode, DefaultReflectionMode } from "../engine_rendererdata";
import { LightmapType } from "./NEEDLE_lightmaps";
import { getParam } from "../engine_utils";
import { Context } from "../engine_setup";
import { LightProbe } from "three";

export const EXTENSION_NAME = "NEEDLE_lighting_settings";
const debug = getParam("debugenvlight");

export type LightingSettings = {
    ambientMode: AmbientMode;
    ambientIntensity: number,
    ambientLight: number[],
    ambientTrilight: Array<number[]>,
    environmentReflectionSource: DefaultReflectionMode;
}

export class NEEDLE_lighting_settings implements GLTFLoaderPlugin {

    get name(): string {
        return EXTENSION_NAME;
    }

    private parser: GLTFParser;
    private sourceId: SourceIdentifier;
    private context: Context;

    constructor(parser: GLTFParser, sourceId: SourceIdentifier, context: Context) {
        this.parser = parser;
        this.sourceId = sourceId;
        this.context = context;
    }

    afterRoot(_result: GLTF): Promise<void> | null {

        const extensions = this.parser.json.extensions;
        if (extensions) {
            const ext: LightingSettings = extensions[EXTENSION_NAME];
            if (ext) {
                if (debug)
                    console.log(ext);
                // add a component to the root of the scene
                const settings = GameObject.addNewComponent(_result.scene, SceneLightSettings, false);
                settings.sourceId = this.sourceId;
                settings.ambientIntensity = ext.ambientIntensity;
                settings.ambientLight = new Color().fromArray(ext.ambientLight);
                if (Array.isArray(ext.ambientTrilight))
                    settings.ambientTrilight = ext.ambientTrilight.map(c => new Color().fromArray(c));
                settings.ambientMode = ext.ambientMode;
                settings.environmentReflectionSource = ext.environmentReflectionSource;
                if (this.context) this.context.rendererData.registerSceneLightSettings(settings);
            }
        }
        return null;
    }

}

// exists once per gltf scene root (if it contains reflection)
// when enabled it does currently automatically set the reflection
// this might not be desireable
export class SceneLightSettings extends Behaviour {

    ambientMode: AmbientMode = AmbientMode.Skybox;
    ambientLight?: Color;
    ambientTrilight?: Color[];
    ambientIntensity: number = 1;
    environmentReflectionSource: DefaultReflectionMode = DefaultReflectionMode.Skybox;

    private _hasReflection: boolean = false;
    private _ambientLightObj?: AmbientLight;
    // used when skybox is used to support ambient intensity for "non custom shaders"
    private _lightProbeObj?: LightProbe;

    awake() {
        if (this.sourceId) {
            const type = this.environmentReflectionSource === DefaultReflectionMode.Skybox ? LightmapType.Skybox : LightmapType.Reflection;
            const tex = this.context.lightmaps.tryGet(this.sourceId, type, 0);
            this._hasReflection = tex !== null && tex !== undefined;
            if (tex)
                this.context.rendererData.registerReflection(this.sourceId, tex);
        }

        if (debug) {
            window.addEventListener("keydown", evt => {
                switch (evt.key) {
                    case "l":
                        this.enabled = !this.enabled;
                        break;
                }
            });
        }
    }

    onEnable() {
        const isActive = this.context.mainCameraComponent?.sourceId === this.sourceId;
        if (debug)
            console.log("Enable scene lighting", this.sourceId, isActive, this, this.context.mainCameraComponent?.sourceId);
        if (!isActive) {
            if(debug) console.warn("This is no active?!", this.context.mainCameraComponent?.sourceId)
            // this.enabled = false;
            // return;
        }
        if (this.ambientMode == AmbientMode.Flat) {
            if (this.ambientLight && !this._ambientLightObj) {
                this._ambientLightObj = new AmbientLight(this.ambientLight, Math.PI * this.ambientIntensity);
            }
            if (this._ambientLightObj) {
                this.gameObject.add(this._ambientLightObj)
            }
            if (this._lightProbeObj) this._lightProbeObj.removeFromParent();
        }
        else if (this.ambientMode === AmbientMode.Trilight) {
            if (this.ambientTrilight) {
                const ground = this.ambientTrilight[0];
                const sky = this.ambientTrilight[this.ambientTrilight.length - 1];
                const hemisphere = new HemisphereLight(sky, ground, this.ambientIntensity);
                this.gameObject.add(hemisphere)
            }
        }
        else {
            if (this._ambientLightObj)
                this._ambientLightObj.removeFromParent();

            // create light probe object
            if (!this._lightProbeObj) {
                if (this.sourceId) {
                    this.context.rendererData.getSceneLightingData(this.sourceId).then(data => {
                        if (debug)
                            console.log(data);
                        if (!data) return;
                        this._lightProbeObj = data.lightProbe;
                        if (this.enabled && !this.destroyed && this._lightProbeObj) {
                            this.scene.add(this._lightProbeObj);
                        }
                    });
                }
            }
            else {
                if (this.enabled && this.destroyed && this._lightProbeObj) {
                    this.scene.add(this._lightProbeObj);
                }
            }
        }

        if (this.sourceId)
            this.context.rendererData.enableReflection(this.sourceId);

    }

    onDisable() {
        if (debug)
            console.log("disable", this.sourceId, this);
        if (this._lightProbeObj) this._lightProbeObj.removeFromParent();
        if(this._ambientLightObj) this._ambientLightObj.removeFromParent();
        if (this.sourceId)
            this.context.rendererData.disableReflection();
    }
}