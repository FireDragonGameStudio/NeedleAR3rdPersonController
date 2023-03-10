import { LightmapType } from "./extensions/NEEDLE_lightmaps";
import { Texture } from "three";
import { Context } from "./engine_setup";
import * as THREE from "three";
import { getParam } from "./engine_utils";
import { SourceIdentifier } from "./engine_types";

const debugLightmap = getParam("debuglightmaps") ? true : false;

export interface ILightDataRegistry {
    registerTexture(sourceId: SourceIdentifier, type: LightmapType, texture: Texture, index?: number);
    tryGet(sourceId: SourceIdentifier | undefined, type: LightmapType, index: number): Texture | null;
    tryGetLightmap(sourceId: SourceIdentifier | null | undefined, index: number): Texture | null;
    tryGetSkybox(sourceId?: SourceIdentifier | null): Texture | null;
    tryGetReflection(sourceId?: SourceIdentifier | null): Texture | null;
}

// how do we know which lightmap should be used for which object
// e.g. if we load in 3 gltf objects and all bring their own lightmaps
// we need a good way for e.g. Renderer components to safely get THEIR lightmap 

// similarly how do we deal with a gltf bringing its own skybox
// e.g. it contains a camera and a skybox - the camera should be able to access this skybox if necessary
// and reflection data should be accessible as well

export class LightDataRegistry implements ILightDataRegistry {

    private _context: Context;
    private _lightmaps: Map<SourceIdentifier, Map<LightmapType, Texture[]>> = new Map();

    constructor(context: Context) {
        this._context = context;
    }

    registerTexture(sourceId: SourceIdentifier, type: LightmapType, tex: Texture, index: number) {
        if (debugLightmap) console.log("Registering ", LightmapType[type], tex, sourceId);
        if (!this._lightmaps.has(sourceId))
            this._lightmaps.set(sourceId, new Map());
        const map = this._lightmaps.get(sourceId);
        const arr = map?.get(type) ?? [];
        if (arr.length < index) arr.length = index + 1;
        arr[index] = tex;
        map?.set(type, arr);
    }

    tryGetLightmap(sourceId: SourceIdentifier | null | undefined, index: number = 0): Texture | null {
        return this.tryGet(sourceId, LightmapType.Lightmap, index);
    }

    tryGetSkybox(sourceId?: SourceIdentifier | null): Texture | null {
        return this.tryGet(sourceId, LightmapType.Skybox, 0);
    }

    tryGetReflection(sourceId?: SourceIdentifier | null): Texture | null {
        return this.tryGet(sourceId, LightmapType.Reflection, 0);
    }

    tryGet(sourceId: SourceIdentifier | undefined | null, type: LightmapType, index: number): Texture | null {
        if (!sourceId) {
            if (debugLightmap) console.warn("Missing source id");
            return null;
        }
        const arr = this._lightmaps.get(sourceId)?.get(type) ?? null;
        if (!arr?.length || arr.length <= index) return null;
        return arr[index];
    }

}




// all the chunks we can patch
// console.log(THREE.ShaderChunk);
// Unity: ambientOrLightmapUV.xy = v.uv1.xy * unity_LightmapST.xy + unity_LightmapST.zw; ambientOrLightmapUV.zw = 0;
THREE.ShaderChunk.lights_fragment_maps = THREE.ShaderChunk.lights_fragment_maps.replace("vec4 lightMapTexel = texture2D( lightMap, vUv2 );", `

    vec2 lUv = vUv2.xy * lightmapScaleOffset.xy + vec2(lightmapScaleOffset.z, (1. - (lightmapScaleOffset.y + lightmapScaleOffset.w)));
    vec4 lightMapTexel = texture2D( lightMap, lUv);
    // The range of RGBM lightmaps goes from 0 to 34.49 (5^2.2) in linear space, and from 0 to 5 in gamma space.
    lightMapTexel.rgb *= lightMapTexel.a * 8.; // no idea where that "8" comes from... heuristically derived
    lightMapTexel.a = 1.;
    lightMapTexel = conv_sRGBToLinear(lightMapTexel);
    `);

THREE.ShaderChunk.lightmap_pars_fragment = `
    #ifdef USE_LIGHTMAP
        uniform sampler2D lightMap;
        uniform float lightMapIntensity;
        uniform vec4 lightmapScaleOffset;
        
        // took from threejs 05fc79cd52b79e8c3e8dec1e7dca72c5c39983a4
        vec4 conv_sRGBToLinear( in vec4 value ) {
            return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
        }
    #endif
    `;

// When objects use Lightmaps in Unity, they already have IBL applied on the Lightmap,
// so they shouldn't receive light probe lighting.
// TODO: this gets difficult if there are additional real-time lightprobes added; we would need to exclude
// exactly those that were active when lighting was baked... that's complicated!
THREE.ShaderChunk.lights_fragment_begin = THREE.ShaderChunk.lights_fragment_begin.replace(
    "irradiance += getLightProbeIrradiance( lightProbe, geometry.normal );", `
#if defined(USE_LIGHTMAP)
irradiance += 0.;
#else
irradiance += getLightProbeIrradiance( lightProbe, geometry.normal );
#endif`);

THREE.UniformsLib.lightmap["lightmapScaleOffset"] = { value: new THREE.Vector4(1, 1, 0, 0) };