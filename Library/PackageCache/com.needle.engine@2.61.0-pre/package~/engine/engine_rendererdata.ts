import { Vector4, EquirectangularReflectionMapping, sRGBEncoding, WebGLCubeRenderTarget, Texture, LightProbe, Color } from "three";
import { LightProbeGenerator } from "three/examples/jsm/lights/LightProbeGenerator.js"
import { Context } from "./engine_setup";
import { SceneLightSettings } from "./extensions/NEEDLE_lighting_settings";
import { createFlatTexture, createTrilightTexture } from "./engine_shaders";
import { getParam } from "./engine_utils";
import { SourceIdentifier } from "./engine_types";

const debug = getParam("debugenvlight");


export declare type SphericalHarmonicsData = {
    array: number[],
    texture: THREE.WebGLCubeRenderTarget | THREE.Texture,
    lightProbe?: LightProbe
}

export enum AmbientMode {
    Skybox = 0,
    Trilight = 1,
    Flat = 3,
    Custom = 4,
}

export enum DefaultReflectionMode {
    Skybox = 0,
    Custom = 1,
}

export class RendererData {

    private context: Context;

    constructor(context: Context) {
        this.context = context;
        this.context.pre_update_callbacks.push(this.preUpdate.bind(this))
    }

    private sceneLightSettings?: SceneLightSettings;

    private preUpdate() {
        const time = this.context.time;
        this._timevec4.x = time.time;
        this._timevec4.y = Math.sin(time.time);
        this._timevec4.z = Math.cos(time.time);
        this._timevec4.w = time.deltaTime;
    }

    private _timevec4: Vector4 = new Vector4();
    get timeVec4(): Vector4 {
        return this._timevec4;
    }

    get environmentIntensity(): number {
        if (!this.sceneLightSettings) return 1;
        return this.sceneLightSettings.ambientIntensity;// * Math.PI * .5;
    }

    registerSceneLightSettings(sceneLightSettings: SceneLightSettings) {
        this.sceneLightSettings = sceneLightSettings;
    }

    registerReflection(sourceId: SourceIdentifier, reflectionTexture: Texture) {
        const h = new LightData(this.context, reflectionTexture, 1);
        this._lighting[sourceId] = h;
    }

    getReflection(sourceId: SourceIdentifier): LightData | null | undefined {
        return this._lighting[sourceId];
    }

    enableReflection(sourceId: SourceIdentifier) {
        if (debug) {
            console.log(this.sceneLightSettings ? AmbientMode[this.sceneLightSettings.ambientMode] : "Unknown ambient mode");
        }

        switch (this.sceneLightSettings?.ambientMode) {
            case AmbientMode.Skybox:
            case AmbientMode.Custom:
                // only set environment reflection when ambient mode is skybox or custom
                const existing = this.getReflection(sourceId);
                if (existing && existing.Source) {
                    const scene = this.context.scene;
                    const tex = existing.Source;
                    tex.encoding = sRGBEncoding;
                    tex.mapping = EquirectangularReflectionMapping;
                    scene.environment = tex;
                    return;
                }
                break;
        }

        if (this.sceneLightSettings?.environmentReflectionSource === DefaultReflectionMode.Custom) {
            switch (this.sceneLightSettings?.ambientMode) {
                case AmbientMode.Trilight:
                    if (this.sceneLightSettings.ambientTrilight) {
                        const colors = this.sceneLightSettings.ambientTrilight;
                        const tex = createTrilightTexture(colors[0], colors[1], colors[2], 64, 64);
                        tex.encoding = sRGBEncoding;
                        tex.mapping = EquirectangularReflectionMapping;
                        this.context.scene.environment = tex;
                    }
                    else console.error("Missing ambient trilight", this.sceneLightSettings.sourceId);
                    return;
                case AmbientMode.Flat:
                    if (this.sceneLightSettings.ambientLight) {
                        const tex = createFlatTexture(this.sceneLightSettings.ambientLight, 64);
                        tex.encoding = sRGBEncoding;
                        tex.mapping = EquirectangularReflectionMapping;
                        this.context.scene.environment = tex;
                    }
                    else console.error("Missing ambientlight", this.sceneLightSettings.sourceId);
                    return;
                default:
                    return;
            }
        }
    }

    disableReflection() {
        const scene = this.context.scene;
        scene.environment = null;
    }

    async getSceneLightingData(sourceId: SourceIdentifier): Promise<SphericalHarmonicsData> {
        if (debug)
            console.log("GET SCENE LIGHT DATA");

        // const existing = this.getReflection(sourceId);
        // const sh = existing?.getSphericalHarmonicsArray(this.sceneLightSettings?.ambientIntensity ?? 1);
        // if (sh) {
        //     console.log("HAS EXISTING", sh, existing);
        //     return sh;
        // }

        // fallback
        if (this._waitPromise) return this._waitPromise;
        this._waitPromise = new Promise((res, _rej) => {
            let interval = setInterval(async () => {
                const ex = this.getReflection(sourceId);
                if (ex) {
                    clearInterval(interval);
                    res(ex.getSphericalHarmonicsArray(this.sceneLightSettings?.ambientIntensity ?? 1)!);
                }
            }, 10);
        });
        return this._waitPromise;
    }

    private _waitPromise?: Promise<SphericalHarmonicsData>;
    private _lighting: { [sourceId: SourceIdentifier]: LightData } = {};

}

export class LightData {

    get Source(): Texture { return this._source; }
    get Array(): number[] | undefined { return this._sphericalHarmonicsArray; }

    private _context: Context;
    private _source: THREE.Texture;
    private _sphericalHarmonics: THREE.SphericalHarmonics3 | null = null;
    private _sphericalHarmonicsArray?: number[];
    private _ambientScale: number = 1;
    private _lightProbe?: LightProbe;

    constructor(context: Context, tex: THREE.Texture, ambientScale: number = 1) {
        this._context = context;
        this._source = tex;
        this._ambientScale = ambientScale;
        tex.mapping = EquirectangularReflectionMapping;
        tex.encoding = sRGBEncoding;
    }

    getSphericalHarmonicsArray(intensityFactor: number = 1): SphericalHarmonicsData | null {
        if (this._sphericalHarmonicsArray?.length && this._source) {
            return { array: this._sphericalHarmonicsArray, texture: this._source, lightProbe: this._lightProbe };
        }

        try {
            const reflection = this._source;
            let rt: THREE.WebGLCubeRenderTarget | null = null;
            if (reflection) {
                if (debug) console.log("GENERATING LIGHT PROBE", reflection);
                const size = Math.min(reflection.image.width, 512);
                const target = new WebGLCubeRenderTarget(size);
                rt = target.fromEquirectangularTexture(this._context.renderer, reflection);
                this._source = rt.texture;
            }

            this._sphericalHarmonicsArray = [];
            if (rt) {
                const sampledProbe = LightProbeGenerator.fromCubeRenderTarget(this._context.renderer, rt);
                this._lightProbe = sampledProbe;
                const lightFactor = (this._ambientScale * (intensityFactor * intensityFactor * Math.PI * .5)) - 1;
                // console.log(intensityFactor, lightFactor);
                this._sphericalHarmonics = sampledProbe.sh;
                this._sphericalHarmonicsArray = this._sphericalHarmonics.toArray();
                const factor = ((intensityFactor) / (Math.PI * .5));
                for (let i = 0; i < this._sphericalHarmonicsArray.length; i++) {
                    this._sphericalHarmonicsArray[i] *= factor;
                }
                sampledProbe.sh.scale(lightFactor);
                if (this._source)
                    return { array: this._sphericalHarmonicsArray, texture: this._source, lightProbe: sampledProbe };
            }
        }
        catch (err) {
            console.error(err);
        }

        return null;
    }
}