import { Behaviour, GameObject } from "./Component";
import { RGBAColor } from "./js-extensions/RGBAColor";
import { Renderer } from "./Renderer";
import { ShadowMaterial, AdditiveBlending, Material } from "three";
import { serializable } from "../engine/engine_serialization_decorator";

enum ShadowMode {
    ShadowMask = 0,
    Additive = 1,
}

export class ShadowCatcher extends Behaviour {

    //@type Needle.Engine.ShadowCatcher.Mode
    @serializable()
    mode: ShadowMode = ShadowMode.ShadowMask;

    //@type UnityEngine.Color
    @serializable(RGBAColor)
    shadowColor: RGBAColor = new RGBAColor(0, 0, 0, 1);

    awake() {

        switch (this.mode) {
            case ShadowMode.ShadowMask:
                this.applyShadowMaterial();
                break;
            case ShadowMode.Additive:
                this.applyLightBlendMaterial();
                break;
        }

    }

    // Custom blending, diffuse-only lighting blended onto the scene additively.
    // Works great for Point Lights and spot lights, 
    // doesn't work for directional lights (since they're lighting up everything else).
    // Works even better with an additional black-ish gradient to darken parts of the AR scene
    // so that lights become more visible on bright surfaces.
    applyLightBlendMaterial() {
        const renderer = GameObject.getComponent(this.gameObject, Renderer);
        if (renderer) {
            const material = renderer.sharedMaterial;
            material.blending = AdditiveBlending;
            this.applyMaterialOptions(material);
            material.onBeforeCompile = (shader) => {
                // see https://github.com/mrdoob/three.js/blob/dev/src/renderers/shaders/ShaderLib/meshphysical.glsl.js#L181
                // see https://github.com/mrdoob/three.js/blob/dev/src/renderers/shaders/ShaderLib.js#LL284C11-L284C11
                // see https://github.com/mrdoob/three.js/blob/dev/src/renderers/shaders/ShaderLib/shadow.glsl.js#L40
                // see https://github.com/mrdoob/three.js/blob/dev/src/renderers/shaders/ShaderChunk/shadowmask_pars_fragment.glsl.js#L2
                // see https://github.com/mrdoob/three.js/blob/dev/src/renderers/shaders/ShaderChunk/shadowmap_pars_fragment.glsl.js#L281

                shader.fragmentShader = shader.fragmentShader.replace("vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;",
                    `vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
                // diffuse-only lighting with overdrive to somewhat compensate
                // for the loss of indirect lighting and to make it more visible.
                vec3 direct = reflectedLight.directDiffuse * 3.;
                float max = max(direct.r, max(direct.g, direct.b));
                
                // early out - we're simply returning direct lighting and some alpha based on it so it can 
                // be blended onto the scene.
                gl_FragColor = vec4(direct, max);
                return;
                `);
            }
        }
    }

    // THREE.ShadowMaterial: only does a mask; shadowed areas are fully black.
    // doesn't take light attenuation into account.
    // works great for Directional Lights.
    applyShadowMaterial() {
        const renderer = GameObject.getComponent(this.gameObject, Renderer);
        if (renderer) {
            if (renderer.sharedMaterial?.type !== "ShadowMaterial") {
                const material = new ShadowMaterial();
                material.color = this.shadowColor;
                material.opacity = this.shadowColor.alpha;
                this.applyMaterialOptions(material);
                renderer.sharedMaterial = material;
            }
            else {
                const material = renderer.sharedMaterial as ShadowMaterial;
                material.color = this.shadowColor;
                material.opacity = this.shadowColor.alpha;
                this.applyMaterialOptions(material);
            }
        }
    }

    private applyMaterialOptions(material: Material) {
        if (material) {
            material.depthWrite = false;
            material.stencilWrite = false;
        }
    }
}