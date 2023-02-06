import { GLTFLoaderPlugin, GLTFParser } from "three/examples/jsm/loaders/GLTFLoader";
import * as THREE from 'three';
import { FindShaderTechniques, whiteDefaultTexture, ToUnityMatrixArray, SetUnitySphericalHarmonics } from '../engine_shaders';
import { IUniform, RawShaderMaterial, Vector4 } from 'three';
import { Context } from '../engine_setup';
import { getParam } from "../engine_utils";
import * as SHADERDATA from "../shaders/shaderData"
import { SourceIdentifier } from "../engine_types";
import { ILight } from "../engine_types";
import { getWorldPosition } from "../engine_three_utils";

const debug = getParam("debugshaders");

export const NEEDLE_TECHNIQUES_WEBGL_NAME = "NEEDLE_techniques_webgl";

//@ts-ignore
enum UniformType {
    INT = 5124,
    FLOAT = 5126,
    FLOAT_VEC2 = 35664,
    FLOAT_VEC3 = 35665,
    FLOAT_VEC4 = 35666,
    INT_VEC2 = 35667,
    INT_VEC3 = 35668,
    INT_VEC4 = 35669,
    BOOL = 35670, // exported as int
    BOOL_VEC2 = 35671,
    BOOL_VEC3 = 35672,
    BOOL_VEC4 = 35673,
    FLOAT_MAT2 = 35674, // exported as vec2[2]
    FLOAT_MAT3 = 35675, // exported as vec3[3]
    FLOAT_MAT4 = 35676, // exported as vec4[4]
    SAMPLER_2D = 35678,
    SAMPLER_3D = 35680, // added, not in the proposed extension
    SAMPLER_CUBE = 35681, // added, not in the proposed extension
    UNKNOWN = 0,
}

class ObjectRendererData {
    objectToWorldMatrix: THREE.Matrix4 = new THREE.Matrix4();
    worldToObjectMatrix: THREE.Matrix4 = new THREE.Matrix4();

    objectToWorld: Array<Vector4> = new Array<Vector4>();
    worldToObject: Array<Vector4> = new Array<Vector4>();

    updateFrom(obj: THREE.Object3D) {
        this.objectToWorldMatrix.copy(obj.matrixWorld);
        ToUnityMatrixArray(this.objectToWorldMatrix, this.objectToWorld);

        this.worldToObjectMatrix.copy(obj.matrixWorld).invert();
        ToUnityMatrixArray(this.worldToObjectMatrix, this.worldToObject);
    }
}

enum CullMode {
    Off = 0,
    Front = 1,
    Back = 2,
}
enum ZTestMode {
    Never = 1,
    Less = 2,
    Equal = 3,
    LEqual = 4,
    Greater = 5,
    NotEqual = 6,
    GEqual = 7,
    Always = 8,
}

export class CustomShader extends RawShaderMaterial {

    private identifier: SourceIdentifier;
    private onBeforeRenderSceneCallback = this.onBeforeRenderScene.bind(this);

    clone() {
        const clone = super.clone();
        createUniformProperties(clone);
        return clone;
    }

    constructor(identifier: SourceIdentifier, ...args) {
        super(...args);

        this.identifier = identifier;

        // this["normalMap"] = true;
        // this.needsUpdate = true;
        if (debug)
            console.log(this);

        this.type = "NEEDLE_CUSTOM_SHADER";
        if (!this.uniforms[this._objToWorldName])
            this.uniforms[this._objToWorldName] = { value: [] };
        if (!this.uniforms[this._worldToObjectName])
            this.uniforms[this._worldToObjectName] = { value: [] };
        if (!this.uniforms[this._viewProjectionName])
            this.uniforms[this._viewProjectionName] = { value: [] };

        if (this.uniforms[this._sphericalHarmonicsName]) {
            this.waitForLighting();
        }

        if (this.depthTextureUniform || this.opaqueTextureUniform) {
            Context.Current.pre_render_callbacks.push(this.onBeforeRenderSceneCallback);
        }
    }

    dispose(): void {
        super.dispose();
        const index = Context.Current.pre_render_callbacks.indexOf(this.onBeforeRenderSceneCallback);
        if (index >= 0)
            Context.Current.pre_render_callbacks.splice(index, 1);
    }

    async waitForLighting() {
        const context: Context = Context.Current;
        if (!context) {
            console.error("Missing context");
            return;
        }
        const data = await context.rendererData.getSceneLightingData(this.identifier);
        if (!data || !data.array) {
            console.warn("Missing lighting data for custom shader, getSceneLightingData did not return anything");
            return;
        }
        if (debug)
            console.log(data);
        const array = data.array;
        const envTexture = data.texture;
        // console.log(envTexture);
        this.uniforms["unity_SpecCube0"] = { value: envTexture };
        SetUnitySphericalHarmonics(this.uniforms, array);
        const hdr = Math.sqrt(Math.PI * .5);
        this.uniforms["unity_SpecCube0_HDR"] = { value: new THREE.Vector4(hdr, hdr, hdr, hdr) };
        // this.needsUpdate = true;
        // this.uniformsNeedUpdate = true;
        if (debug) console.log("Set environment lighting", this.uniforms);
    }

    private _sphericalHarmonicsName = "unity_SpecCube0";

    private _objToWorldName = "hlslcc_mtx4x4unity_ObjectToWorld";
    private _worldToObjectName = "hlslcc_mtx4x4unity_WorldToObject";

    private static viewProjection: THREE.Matrix4 = new THREE.Matrix4();
    private static _viewProjectionValues: Array<Vector4> = [];
    private _viewProjectionName = "hlslcc_mtx4x4unity_MatrixVP";

    private static viewMatrix: THREE.Matrix4 = new THREE.Matrix4();
    private static _viewMatrixValues: Array<Vector4> = [];
    private _viewMatrixName = "hlslcc_mtx4x4unity_MatrixV";

    private static _worldSpaceCameraPosName = "_WorldSpaceCameraPos";
    private static _worldSpaceCameraPos: THREE.Vector3 = new THREE.Vector3();

    private static _mainLightColor: THREE.Vector4 = new THREE.Vector4();
    private static _mainLightPosition: THREE.Vector3 = new THREE.Vector3();
    private static _lightData: THREE.Vector4 = new THREE.Vector4();

    private _rendererData = new ObjectRendererData();

    private get depthTextureUniform(): IUniform<any> | undefined {
        if (!this.uniforms) return undefined;
        return this.uniforms["_CameraDepthTexture"];
    }
    private get opaqueTextureUniform(): IUniform<any> | undefined {
        if (!this.uniforms) return undefined;
        return this.uniforms["_CameraOpaqueTexture"];
    }

    private onBeforeRenderScene() {
        if (this.opaqueTextureUniform) {
            Context.Current.setRequireColor(true);
        }
        if (this.depthTextureUniform) {
            Context.Current.setRequireDepth(true);
        }
    }

    onBeforeRender(_renderer, _scene, camera, _geometry, obj, _group) {
        if (!_geometry.attributes["tangent"])
            _geometry.computeTangents();
        this.onUpdateUniforms(camera, obj);
    }

    onUpdateUniforms(camera?: THREE.Camera, obj?: any) {

        const context = Context.Current;

        // TODO cache by camera
        // if (context.time.frame != this._lastFrame)
        {
            if (camera) {
                if (CustomShader.viewProjection && this.uniforms[this._viewProjectionName]) {
                    CustomShader.viewProjection.copy(camera.projectionMatrix).multiply(camera.matrixWorldInverse);
                    ToUnityMatrixArray(CustomShader.viewProjection, CustomShader._viewProjectionValues)
                }

                if (CustomShader.viewMatrix && this.uniforms[this._viewMatrixName]) {
                    CustomShader.viewMatrix.copy(camera.matrixWorldInverse);
                    ToUnityMatrixArray(CustomShader.viewMatrix, CustomShader._viewMatrixValues)
                }

                if (this.uniforms[CustomShader._worldSpaceCameraPosName]) {
                    CustomShader._worldSpaceCameraPos.setFromMatrixPosition(camera.matrixWorld);
                }
            }
        }

        // this._lastFrame = context.time.frame;

        if (this.uniforms["_TimeParameters"]) {
            this.uniforms["_TimeParameters"].value = context.rendererData.timeVec4;
        }
        else if (this.uniforms["_Time"]) {
            this.uniforms["_Time"].value = context.rendererData.timeVec4;
        }

        const mainLight: ILight | null = context.mainLight;
        if (mainLight) {

            const lp = getWorldPosition(mainLight.gameObject, CustomShader._mainLightPosition);
            this.uniforms["_MainLightPosition"] = { value: lp.normalize() };

            CustomShader._mainLightColor.set(mainLight.color.r, mainLight.color.g, mainLight.color.b, 0);
            this.uniforms["_MainLightColor"] = { value: CustomShader._mainLightColor };

            const intensity = mainLight.intensity;// * (Math.PI * .5);
            CustomShader._lightData.z = intensity;
            this.uniforms["unity_LightData"] = { value: CustomShader._lightData };
        }

        if (camera) {
            if (CustomShader.viewProjection && this.uniforms[this._viewProjectionName]) {
                this.uniforms[this._viewProjectionName].value = CustomShader._viewProjectionValues;
            }

            if (CustomShader.viewMatrix && this.uniforms[this._viewMatrixName]) {
                this.uniforms[this._viewMatrixName].value = CustomShader._viewMatrixValues;
            }

            if (this.uniforms[CustomShader._worldSpaceCameraPosName]) {
                this.uniforms[CustomShader._worldSpaceCameraPosName] = { value: CustomShader._worldSpaceCameraPos };
            }

            if (context.mainCameraComponent) {
                if (this.uniforms["_ProjectionParams"]) {
                    const params = this.uniforms["_ProjectionParams"].value;
                    params.x = 1;
                    params.y = context.mainCameraComponent.nearClipPlane;
                    params.z = context.mainCameraComponent.farClipPlane;
                    params.w = 1 / params.z;
                    this.uniforms["_ProjectionParams"].value = params
                }
                if (this.uniforms["_ZBufferParams"]) {
                    const params = this.uniforms["_ZBufferParams"].value;
                    const cam = context.mainCameraComponent;
                    params.x = 1 - cam.farClipPlane / cam.nearClipPlane;
                    params.y = cam.farClipPlane / cam.nearClipPlane;
                    params.z = params.x / cam.farClipPlane;
                    params.w = params.y / cam.farClipPlane;
                    this.uniforms["_ZBufferParams"].value = params;
                }
                if (this.uniforms["_ScreenParams"]) {
                    const params = this.uniforms["_ScreenParams"].value;
                    params.x = context.domWidth;
                    params.y = context.domHeight;
                    params.z = 1.0 + 1.0 / params.x;
                    params.w = 1.0 + 1.0 / params.y;
                    this.uniforms["_ScreenParams"].value = params;
                }
            }
        }

        const depthTexture = this.depthTextureUniform;
        if (depthTexture) {
            depthTexture.value = context.depthTexture;
        }

        const colorTexture = this.opaqueTextureUniform;
        if (colorTexture) {
            colorTexture.value = context.opaqueColorTexture;
        }

        if (obj) {
            const objData = this._rendererData;
            objData.updateFrom(obj);
            this.uniforms[this._worldToObjectName].value = objData.worldToObject;
            this.uniforms[this._objToWorldName].value = objData.objectToWorld;
        }

        this.uniformsNeedUpdate = true;
    }
}


export class NEEDLE_techniques_webgl implements GLTFLoaderPlugin {

    get name(): string {
        return NEEDLE_TECHNIQUES_WEBGL_NAME;
    }

    private parser: GLTFParser;
    private identifier: SourceIdentifier;

    constructor(loader: GLTFParser, identifier: SourceIdentifier) {
        this.parser = loader;
        this.identifier = identifier;
    }

    loadMaterial(index: number): Promise<THREE.Material> | null {

        const mat = this.parser.json.materials[index];
        if (!mat) {
            if (debug) console.log(index, this.parser.json.materials);
            return null;
        }
        if (!mat.extensions || !mat.extensions[NEEDLE_TECHNIQUES_WEBGL_NAME]) {
            if (debug) console.log("material " + index + " does not use NEEDLE_techniques_webgl");
            return null;
        }
        const techniqueIndex = mat.extensions[NEEDLE_TECHNIQUES_WEBGL_NAME].technique;
        if (techniqueIndex < 0) return null;
        const shaders: SHADERDATA.ShaderData = this.parser.json.extensions[NEEDLE_TECHNIQUES_WEBGL_NAME];
        if (!shaders) return null;
        if (debug) console.log(shaders);
        const technique: SHADERDATA.Technique = shaders.techniques[techniqueIndex];
        if (!technique) return null;

        return new Promise<THREE.Material>(async (resolve, reject) => {
            const bundle = await FindShaderTechniques(shaders, technique.program!);
            const frag = bundle?.fragmentShader;
            const vert = bundle?.vertexShader;
            // console.log(techniqueIndex, shaders.techniques);
            if (!frag || !vert) return reject();

            if (debug)
                console.log("loadMaterial", mat, bundle);

            const uniforms: {} = {};
            const techniqueUniforms = technique.uniforms;

            if (vert.includes("_Time"))
                uniforms["_Time"] = { value: new THREE.Vector4(0, 0, 0, 0) };

            for (const u in techniqueUniforms) {
                const uniformName = u;
                // const uniformValues = techniqueUniforms[u];
                // const typeName = UniformType[uniformValues.type];
                switch (uniformName) {
                    case "_TimeParameters":
                        const timeUniform = new THREE.Vector4();
                        uniforms[uniformName] = { value: timeUniform };
                        break;

                    case "hlslcc_mtx4x4unity_MatrixV":
                    case "hlslcc_mtx4x4unity_MatrixVP":
                        uniforms[uniformName] = { value: [] };
                        break;

                    case "_MainLightPosition":
                    case "_MainLightColor":
                    case "_WorldSpaceCameraPos":
                        uniforms[uniformName] = { value: [0, 0, 0, 1] };
                        break;

                    case "unity_OrthoParams":
                        break;

                    case "unity_SpecCube0":
                        uniforms[uniformName] = { value: null };
                        break;
                    default:

                    case "_ScreenParams":
                    case "_ZBufferParams":
                    case "_ProjectionParams":
                        uniforms[uniformName] = { value: [0, 0, 0, 0] };
                        break;


                    case "_CameraOpaqueTexture":
                    case "_CameraDepthTexture":
                        uniforms[uniformName] = { value: null };
                        break;

                        // switch (uniformValues.type) {
                        //     case UniformType.INT:
                        //         break;
                        //     case UniformType.FLOAT:
                        //         break;
                        //     case UniformType.FLOAT_VEC3:
                        //         console.log("VEC", uniformName);
                        //         break;
                        //     case UniformType.FLOAT_VEC4:
                        //         console.log("VEC", uniformName);
                        //         break;
                        //     case UniformType.SAMPLER_CUBE:
                        //         console.log("cube", uniformName);
                        //         break;
                        //     default:
                        //         console.log(typeName);
                        //         break;
                        // }

                        break;
                }
            }

            let isTransparent = false;
            if (mat.extensions && mat.extensions[NEEDLE_TECHNIQUES_WEBGL_NAME]) {
                const materialExtension = mat.extensions[NEEDLE_TECHNIQUES_WEBGL_NAME];
                if (materialExtension.technique === techniqueIndex) {
                    if (debug) console.log(mat.name, "Material Properties", materialExtension);
                    for (const key in materialExtension.values) {
                        const val = materialExtension.values[key];
                        if (typeof val === "string") {
                            if (val.startsWith("/textures/")) {
                                const indexString = val.substring("/textures/".length);
                                const texIndex = Number.parseInt(indexString);
                                if (texIndex >= 0) {
                                    const tex = await this.parser.getDependency("texture", texIndex);
                                    if (tex) {
                                        tex.encoding = THREE.LinearEncoding;
                                        tex.needsUpdate = true;
                                    }
                                    uniforms[key] = { value: tex };
                                    continue;
                                }
                            }
                            switch (key) {
                                case "alphaMode":
                                    if (val === "BLEND") isTransparent = true;
                                    continue;
                            }
                        }
                        if (Array.isArray(val) && val.length === 4) {
                            uniforms[key] = { value: new THREE.Vector4(val[0], val[1], val[2], val[3]) };
                            continue;
                        }
                        uniforms[key] = { value: val };
                    }
                }
            }


            const material = new CustomShader(this.identifier,
                {
                    name: mat.name ?? "",
                    uniforms: uniforms,
                    vertexShader: vert,
                    fragmentShader: frag,
                    lights: false,
                    // defines: {
                    //     "USE_SHADOWMAP" : true
                    // },
                });

            const culling = uniforms["_Cull"]?.value;
            switch (culling) {
                case CullMode.Off:
                    material.side = THREE.DoubleSide;
                    break;
                case CullMode.Front:
                    material.side = THREE.BackSide;
                    break;
                case CullMode.Back:
                    material.side = THREE.FrontSide;
                    break;
                default:
                    material.side = THREE.FrontSide;
                    break;
            }

            const zTest = uniforms["_ZTest"]?.value as ZTestMode;
            switch (zTest) {
                case ZTestMode.Equal:
                    material.depthTest = true;
                    material.depthFunc = THREE.EqualDepth;
                    break;
                case ZTestMode.NotEqual:
                    material.depthTest = true;
                    material.depthFunc = THREE.NotEqualDepth;
                    break;
                case ZTestMode.Less:
                    material.depthTest = true;
                    material.depthFunc = THREE.LessDepth;
                    break;
                case ZTestMode.LEqual:
                    material.depthTest = true;
                    material.depthFunc = THREE.LessEqualDepth;
                    break;
                case ZTestMode.Greater:
                    material.depthTest = true;
                    material.depthFunc = THREE.GreaterDepth;
                    break;
                case ZTestMode.GEqual:
                    material.depthTest = true;
                    material.depthFunc = THREE.GreaterEqualDepth;
                    break;
                case ZTestMode.Always:
                    material.depthTest = false;
                    material.depthFunc = THREE.AlwaysDepth;
                    break;
            }

            material.transparent = isTransparent;
            if (isTransparent)
                material.depthWrite = false;

            // set spherical harmonics once
            SetUnitySphericalHarmonics(uniforms);
            // update once to test if everything is assigned
            material.onUpdateUniforms();

            for (const u in techniqueUniforms) {
                const uniformName = u;
                const type: SHADERDATA.UniformType = techniqueUniforms[u].type;
                if (uniforms[uniformName]?.value === undefined) {
                    switch (type) {
                        case SHADERDATA.UniformType.SAMPLER_2D:
                            uniforms[uniformName] = { value: whiteDefaultTexture };
                            console.warn("Missing/unassigned texture, fallback to white: " + uniformName)
                            break;
                        default:

                            console.warn("TODO: EXPECTED UNIFORM / fallback NOT SET: " + uniformName, techniqueUniforms[u]);
                            break;
                    }
                }
            }
            if (debug)
                console.log(material.uuid, uniforms);

            createUniformProperties(material);

            resolve(material);
        });
    }

}


// when animating custom material properties (uniforms) the path resolver tries to access them via material._MyProperty. 
// That doesnt exist by default for custom properties
// We could re-write the path in the khr path resolver but that would require it to know beforehand
// if the material uses as custom shader or not
// this way all properties of custom shaders are also accessible via material._MyProperty
function createUniformProperties(material: CustomShader) {
    if (material.uniforms) {
        for (const key in material.uniforms) {
            if (!Object.getOwnPropertyDescriptor(material, key)) {
                Object.defineProperty(material, key, {
                    get: () => material.uniforms[key].value,
                    set: (value) => {
                        material.uniforms[key].value = value
                        material.needsUpdate = true;
                    }
                });
            }
        }
    }
}