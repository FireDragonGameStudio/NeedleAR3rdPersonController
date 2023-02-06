import { Behaviour, GameObject } from "./Component";
import * as THREE from "three";
import { Texture } from "three";
import { Context, OnBeforeRenderCallback } from "../engine/engine_setup";

// this component is automatically added by the Renderer if the object has lightmap uvs AND we have a lightmap
// for multimaterial objects GLTF exports a "Group" with the renderer component
// and every child mesh is a material from unity
export class RendererLightmap {

    get lightmap(): Texture | null {
        return this.lightmapTexture;
    }
    set lightmap(tex: Texture | null) {
        if (tex !== this.lightmapTexture) {
            this.lightmapTexture = tex;
            this.setupLightmap();
        }
    }

    lightmapIndex: number = -1;
    lightmapScaleOffset: THREE.Vector4 = new THREE.Vector4(1, 1, 0, 0);

    private context: Context;
    private gameObject: GameObject;
    private lightmapTexture: THREE.Texture | null = null;
    private lightmapScaleOffsetUniform = { value: new THREE.Vector4(1, 1, 0, 0) };
    private lightmapUniform: { value: THREE.Texture | null } = { value: null };

    private beforeRenderCallback?: OnBeforeRenderCallback;

    constructor(gameObject: GameObject, context: Context) {
        this.gameObject = gameObject;
        this.context = context;
    }

    init(lightmapIndex: number, lightmapScaleOffset: THREE.Vector4, lightmapTexture: THREE.Texture, debug: boolean = false) {
        console.assert(this.gameObject !== undefined && this.gameObject !== null, "Missing gameobject", this);

        this.lightmapIndex = lightmapIndex;
        if (this.lightmapIndex < 0) return;
        this.lightmapScaleOffset = lightmapScaleOffset;
        this.lightmapTexture = lightmapTexture;

        const debugLightmaps = debug;
        if (debugLightmaps) this.setLightmapDebugMaterial();
        this.setupLightmap();
    }

    bindOnBeforeRender() {
        this.beforeRenderCallback = this.onBeforeRenderThreeComplete.bind(this);
        this.context.addBeforeRenderListener(this.gameObject, this.beforeRenderCallback);
        // this.gameObject.onBeforeRender = this.onBeforeRenderThreeComplete.bind(this);
    }

    private onBeforeRenderThreeComplete(_renderer, _scene, _camera, _geometry, material, _group) {
        this.onBeforeRenderThree(material);
    }

    private setupLightmap() {

        if (this.gameObject.type === "Object3D") {
            // console.warn("Can not add lightmap. Is this object missing a renderer?");
            return;
        }

        if (this.gameObject.type === "Group") {
            console.warn("Lightmap on multimaterial object is not supported yet... please ask kindly for implementation.");
            return;
        }

        console.assert(this.gameObject.type === "Mesh", "Lightmap only works on meshes", this);


        const mesh = this.gameObject as unknown as THREE.Mesh;
        // TODO: ensure uv2 exists
        if (!mesh.geometry.getAttribute("uv2"))
            mesh.geometry.setAttribute("uv2", mesh.geometry.getAttribute("uv"));

        const mat = this.gameObject["material"].clone();
        this.gameObject["material"] = mat;

        this.gameObject["material"].onBeforeCompile = (shader, _) => {
            shader.uniforms.lightmap = this.lightmapUniform;
            shader.uniforms.lightmapScaleOffset = this.lightmapScaleOffsetUniform;
        };


        if (this.lightmapIndex >= 0) {
            const lightmap = this.lightmapTexture;
            const mat = this.gameObject["material"];
            if (mat && lightmap) {
                if (!mat.uniforms) mat.uniforms = {};
                mat.lightMap = lightmap;
                mat.uniforms.lightmap = { value: lightmap };
            }
        }
    }

    onBeforeRenderThree(material: THREE.Material) {

        const uniforms = material["uniforms"];
        if (uniforms && uniforms.lightmap) {
            this.lightmapScaleOffsetUniform.value = this.lightmapScaleOffset;
            this.lightmapUniform.value = this.lightmapTexture;
            uniforms.lightmap = this.lightmapUniform;
            uniforms.lightmapScaleOffset = this.lightmapScaleOffsetUniform;
        }
    }

    private setLightmapDebugMaterial() {

        // debug lightmaps
        this.gameObject["material"] = new THREE.ShaderMaterial({
            vertexShader: `
                attribute vec2 uv2;
                varying vec2 vUv2;
                void main()
                {
                    vUv2 = uv2;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
                }
                `,
            fragmentShader: `
                uniform sampler2D lightmap;
                uniform float lightMapIntensity;
                uniform vec4 lightmapScaleOffset;
                varying vec2 vUv2;

                // took from threejs 05fc79cd52b79e8c3e8dec1e7dca72c5c39983a4
                vec4 conv_sRGBToLinear( in vec4 value ) {
                    return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
                }

                void main() {
                    vec2 lUv = vUv2.xy * lightmapScaleOffset.xy + vec2(lightmapScaleOffset.z, (1. - (lightmapScaleOffset.y + lightmapScaleOffset.w)));
                    
                    vec4 lightMapTexel = texture2D( lightmap, lUv);
                    // The range of RGBM lightmaps goes from 0 to 34.49 (5^2.2) in linear space, and from 0 to 5 in gamma space.
                    //lightMapTexel.rgb *= lightMapTexel.a * 8.; // no idea where that "8" comes from... heuristically derived
                    //lightMapTexel.a = 1.;
                    //lightMapTexel = conv_sRGBToLinear(lightMapTexel);
                    // lightMapTexel.rgb = vec3(1.);

                    // gl_FragColor = vec4(vUv2.xy, 0, 1);
                    gl_FragColor = lightMapTexel;
                }
                `,
            defines: { USE_LIGHTMAP: '' }
        });
    }
}