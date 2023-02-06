import { Behaviour } from "./Component";
import { NoToneMapping, LinearToneMapping, ACESFilmicToneMapping, ReinhardToneMapping } from "three";
import { serializable } from "../engine/engine_serialization_decorator";
import { Context } from "../engine/engine_setup";
import { getParam } from "../engine/engine_utils";

const debug = getParam("debugvolume");

export enum TonemappingMode {
    None = 0,
    Neutral = 1, // Neutral tonemapper
    ACES = 2,    // ACES Filmic reference tonemapper (custom approximation)
}

export class VolumeParameter {
    overrideState: boolean = false;
    value: number = 0;
}

export class VolumeComponent {
    active: boolean = false;
    parameters?: VolumeParameter[];
}

export class ToneMapping extends VolumeComponent {
    mode?: VolumeParameter;
    get isToneMapping() { return true; }
}

export class ColorAdjustments extends VolumeComponent {
    postExposure?: VolumeParameter;
}

// resolve the types:
function resolveComponentType(data) {
    if ("mode" in data) return ToneMapping;
    if ("postExposure" in data) return ColorAdjustments;
    return VolumeComponent;
}

const volumeKey = Symbol("volumeprofile");

export class VolumeProfile {
    @serializable([d => resolveComponentType(d), VolumeComponent])
    components?: VolumeComponent[];

    apply(context: Context) {
        this.onUpdate(context, false);
    }

    unapply(context: Context) {
        this.onUpdate(context, true);
    }

    private onUpdate(context: Context, remove: boolean) {
        if (!this.components) return;
        const renderer = context.renderer;
        const currentProfile = renderer[volumeKey];
        const isActive = currentProfile !== undefined;
        if (remove) {
            // can not remove volume profile that is not active
            if (!isActive) return;
        }
        else {
            renderer[volumeKey] = this;
        }
        for (const component of this.components) {

            if (component instanceof ToneMapping) {
                const tonemapping = component as ToneMapping;
                if (!component.active || remove) {
                    context.renderer.toneMapping = LinearToneMapping;
                    continue;
                }
                if (debug) console.log("VOLUME:", TonemappingMode[tonemapping.mode?.value ?? 0]);
                const mode = tonemapping.mode;
                const value = mode?.overrideState ? mode?.value : 0;
                switch (value ?? 0) {
                    case TonemappingMode.None:
                        context.renderer.toneMapping = LinearToneMapping;
                        break;
                    case TonemappingMode.Neutral:
                        context.renderer.toneMapping = ReinhardToneMapping;
                        break;
                    case TonemappingMode.ACES:
                        context.renderer.toneMapping = ACESFilmicToneMapping;
                        break;
                }
            }
            else if (component instanceof ColorAdjustments) {
                const colorAdjustments = component as ColorAdjustments;
                // unity range goes from -15..15
                // three.js range goes from 0..inf
                if (debug)
                    console.log(colorAdjustments.postExposure);
                let exposure = 1;
                // convert to linear
                if (colorAdjustments.postExposure)
                    exposure = Math.pow(2, colorAdjustments.postExposure.value);
                // ACES applies a factor of roughly 1.666 ( /= .6 )
                if (context.renderer.toneMapping === ACESFilmicToneMapping) {
                    // exposure /= Math.PI / 2;
                }
                const useExposure = colorAdjustments.postExposure?.overrideState && !remove;
                context.renderer.toneMappingExposure = useExposure ? exposure : 1;
                if (!context.renderer.toneMapping)
                    context.renderer.toneMapping = LinearToneMapping;
            }
        }
    }
}


export class Volume extends Behaviour {

    @serializable(VolumeProfile)
    sharedProfile?: VolumeProfile;

    awake() {
        if (debug) {
            console.log(this);
            console.log("Press P to toggle post processing");
            window.addEventListener("keydown", (e) => {
                if (e.key === "p") {
                    console.log("Toggle volume: " + this.name, !this.enabled);
                    this.enabled = !this.enabled;
                }
            });
        }
    }

    onEnable() {
        if (debug) console.log("APPLY VOLUME", this)
        this.sharedProfile?.apply(this.context);
    }

    onDisable() {
        this.sharedProfile?.unapply(this.context);
    }
}
