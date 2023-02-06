import { Behaviour, GameObject } from "./Component";
import * as THREE from "three";
// import { RendererCustomShader } from "./RendererCustomShader";
import { RendererLightmap } from "./RendererLightmap";
import { Context, FrameEvent } from "../engine/engine_setup";
import { getParam } from "../engine/engine_utils";
import { serializable } from "../engine/engine_serialization_decorator";
import { AxesHelper, Material, Mesh, Object3D, SkinnedMesh, Texture, Vector4 } from "three";
import { NEEDLE_render_objects } from "../engine/extensions/NEEDLE_render_objects";
import { NEEDLE_progressive } from "../engine/extensions/NEEDLE_progressive";
import { NEED_UPDATE_INSTANCE_KEY } from "../engine/engine_instancing";
import { IRenderer, ISharedMaterials } from "../engine/engine_types";
import { debug, ReflectionProbe } from "./ReflectionProbe";
import { setCustomVisibility } from "../engine/js-extensions/Layers";
import { isLocalNetwork } from "../engine/engine_networking_utils";
import { showBalloonWarning } from "../engine/debug/debug";

// for staying compatible with old code
export { InstancingUtil } from "../engine/engine_instancing";

const suppressInstancing = getParam("noInstancing");
const debugLightmap = getParam("debuglightmaps") ? true : false;
const debugInstancing = getParam("debuginstancing");
const debugProgressiveLoading = getParam("debugprogressive");
const suppressProgressiveLoading = getParam("noprogressive");

const showWireframe = getParam("wireframe");

export enum ReflectionProbeUsage {
    Off = 0,
    BlendProbes = 1,
    BlendProbesAndSkybox = 2,
    Simple = 3,
}


export class FieldWithDefault {
    public path: string | null = null;
    public asset: object | null = null;
    public default: any;
}

export enum RenderState {
    Both = 0,
    Back = 1,
    Front = 2,
}


// support sharedMaterials[index] assigning materials directly to the objects
class SharedMaterialArray implements ISharedMaterials {

    [num: number]: THREE.Material;

    private _renderer: Renderer;
    private _targets: THREE.Object3D[] = [];

    private _indexMapMaxIndex?: number;
    private _indexMap?: Map<number, number>;

    is(renderer: Renderer) {
        return this._renderer === renderer;
    }

    constructor(renderer: Renderer, originalMaterials: Material[]) {
        this._renderer = renderer;
        const setMaterial = this.setMaterial.bind(this);
        const getMaterial = this.getMaterial.bind(this);
        const go = renderer.gameObject;
        this._targets = [];
        if (go) {
            switch (go.type) {
                case "Group":
                    this._targets = [...go.children];
                    break;
                case "SkinnedMesh":
                case "Mesh":
                    this._targets.push(go);
                    break;
            }
        }

        // this is useful to have an index map when e.g. materials are trying to be assigned by index
        let hasMissingMaterials = false;
        let indexMap: Map<number, number> | undefined = undefined;
        let maxIndex: number = 0;
        for (let i = 0; i < this._targets.length; i++) {
            const target = this._targets[i] as Mesh;
            if (!target) continue;
            const mat = target.material as Material;
            if (!mat) continue;
            for (let k = 0; k < originalMaterials.length; k++) {
                const orig = originalMaterials[k];
                if (!orig) {
                    hasMissingMaterials = true;
                    continue;
                }
                if (mat.name === orig.name) {
                    if (indexMap === undefined) indexMap = new Map();
                    indexMap.set(k, i);
                    maxIndex = Math.max(maxIndex, k);
                    // console.log(`Material ${mat.name} at ${k} was found at index ${i} in renderer ${renderer.name}.`)
                    break;
                }
            }
        }
        if (hasMissingMaterials) {
            this._indexMapMaxIndex = maxIndex;
            this._indexMap = indexMap;
            const warningMessage = `Renderer ${renderer.name} was initialized with missing materials - this may lead to unexpected behaviour when trying to access sharedMaterials by index.`;
            console.warn(warningMessage);
            if(isLocalNetwork()) showBalloonWarning("Found renderer with missing materials: please check the console for details.");
        }

        // this lets us override the javascript indexer, only works in ES6 tho
        // but like that we can use sharedMaterials[index] and it will be assigned to the object directly
        return new Proxy(this, {
            get(target, key) {
                if (typeof key === "string") {
                    const index = parseInt(key);
                    if (!isNaN(index)) {
                        return getMaterial(index);
                    }
                }
                return target[key];
            },
            set(target, key, value) {
                if (typeof key === "string")
                    setMaterial(value, Number.parseInt(key));
                // console.log(target, key, value);
                return Reflect.set(target, key, value);
            }
        });
    }

    get length(): number {
        if (this._indexMapMaxIndex !== undefined) return this._indexMapMaxIndex + 1;
        return this._targets.length;
    }

    private resolveIndex(index: number): number {
        const map = this._indexMap;
        // if we have a index map it means that some materials were missing
        if (map) {
            if (map.has(index)) return map.get(index) as number;
            // return -1;
        }
        return index;
    }

    private setMaterial(mat: Material, index: number) {
        index = this.resolveIndex(index);
        if (index < 0 || index >= this._targets.length) return;
        const target = this._targets[index];
        if (!target || target["material"] === undefined) return;
        target["material"] = mat;
    }

    private getMaterial(index: number) {
        index = this.resolveIndex(index);
        if (index < 0) return null;
        const obj = this._targets;
        if (index >= obj.length) return null;
        const target = obj[index];
        if (!target) return null;
        return target["material"];
    }

}

export class Renderer extends Behaviour implements IRenderer {

    /** Set the rendering state only of an object (makes it visible or invisible) without affecting component state or child hierarchy visibility! You can also just enable/disable the Renderer component on that object for the same effect!
     * 
     * If you want to activate or deactivate a complete object you can use obj.visible as usual (it acts the same as setActive in Unity) */
    static setVisible(obj: Object3D, visible: boolean) {
        setCustomVisibility(obj, visible);
    }

    @serializable()
    receiveShadows: boolean = false;
    @serializable()
    shadowCastingMode: ShadowCastingMode = ShadowCastingMode.Off;
    @serializable()
    lightmapIndex: number = -1;
    @serializable(Vector4)
    lightmapScaleOffset: THREE.Vector4 = new THREE.Vector4(1, 1, 0, 0);
    @serializable()
    enableInstancing: boolean[] | undefined = undefined;
    @serializable()
    renderOrder: number[] | undefined = undefined;
    @serializable()
    allowOcclusionWhenDynamic: boolean = true;

    @serializable(Object3D)
    probeAnchor?: Object3D;
    @serializable()
    reflectionProbeUsage: ReflectionProbeUsage = ReflectionProbeUsage.Off;

    // custom shader
    // get materialProperties(): Array<MaterialProperties> | undefined {
    //     return this._materialProperties;
    // }
    // set materialProperties(value: Array<MaterialProperties> | undefined) {
    //     this._materialProperties = value;
    // }

    // private customShaderHandler: RendererCustomShader | undefined = undefined;

    // private _materialProperties: Array<MaterialProperties> | undefined = undefined;
    private _lightmaps?: RendererLightmap[];

    get sharedMesh(): Mesh | undefined {
        if (this.gameObject.type === "Mesh") {
            return this.gameObject as unknown as Mesh
        }
        else if (this.gameObject.type === "SkinnesMesh") {
            return this.gameObject as unknown as SkinnedMesh;
        }
        else if (this.gameObject.type === "Group") {
            return this.gameObject.children[0] as unknown as Mesh;
        }
        return undefined;
    }

    get sharedMaterial(): THREE.Material {
        return this.sharedMaterials[0];
    }

    set sharedMaterial(mat: THREE.Material) {
        this.sharedMaterials[0] = mat;
    }

    /**@deprecated please use sharedMaterial */
    get material(): THREE.Material {
        return this.sharedMaterials[0];
    }

    /**@deprecated please use sharedMaterial */
    set material(mat: THREE.Material) {
        this.sharedMaterials[0] = mat;
    }

    private _sharedMaterials!: SharedMaterialArray;
    private _originalMaterials: Material[] = [];

    // this is just available during deserialization
    private set sharedMaterials(_val: Array<Material | null>) {
        // TODO: elements in the array might be missing at the moment which leads to problems if an index is serialized
        this._originalMaterials = _val as Material[];
    }

    //@ts-ignore
    get sharedMaterials(): SharedMaterialArray {
        if (!this._sharedMaterials || !this._sharedMaterials.is(this))
            this._sharedMaterials = new SharedMaterialArray(this, this._originalMaterials);
        return this._sharedMaterials!;
    }

    public static get shouldSuppressInstancing() {
        return suppressInstancing;
    }

    private _lightmapTextureOverride: Texture | null | undefined = undefined;
    public get lightmap(): Texture | null {
        if (this._lightmaps?.length) {
            return this._lightmaps[0].lightmap;
        }
        return null;
    }
    public set lightmap(tex: Texture | null | undefined) {
        this._lightmapTextureOverride = tex;
        // set undefined to return to default
        if (tex === undefined) {
            tex = this.context.lightmaps.tryGetLightmap(this.sourceId, this.lightmapIndex);
        }
        if (this._lightmaps?.length) {
            for (const lm of this._lightmaps) {
                lm.lightmap = tex;
            }
        }
    }
    get hasLightmap(): boolean {
        const lm = this.lightmap;
        return lm !== null && lm !== undefined;
    }

    public allowProgressiveLoading: boolean = true;

    registering() {
        if (!this.enabled) {
            this.setVisibility(false);
        }
    }

    awake() {
        this.clearInstancingState();

        if (this.probeAnchor && debug) this.probeAnchor.add(new AxesHelper(.2));

        this._reflectionProbe = null;

        const type = this.gameObject.type;
        if (this.isMultiMaterialObject(this.gameObject)) {
            for (const child of this.gameObject.children) {
                this.context.addBeforeRenderListener(child, this.onBeforeRenderThree.bind(this));
                child.layers.mask = this.gameObject.layers.mask;
            }

            if (this.renderOrder !== undefined) {
                // Objects can have nested renderers (e.g. contain 2 meshes and then again another group)
                // or perhaps just regular child objects that have their own renderer component (?)
                let index = 0;
                for (let i = 0; i < this.gameObject.children.length; i++) {
                    const ch = this.gameObject.children[i];
                    // ignore nested groups or objects that have their own renderer (aka their own render order settings)
                    if (ch.type !== "Mesh" || GameObject.getComponent(ch, Renderer)) continue;
                    if (this.renderOrder.length <= index) {
                        console.error("Incorrect element count", this);
                        break;
                    }
                    ch.renderOrder = this.renderOrder[index];
                    index += 1;
                }
            }
        }
        // TODO: custom shader with sub materials
        else if (this.isMeshOrSkinnedMesh(this.gameObject)) {

            this.context.addBeforeRenderListener(this.gameObject, this.onBeforeRenderThree.bind(this));

            if (this.renderOrder !== undefined && this.renderOrder.length > 0)
                this.gameObject.renderOrder = this.renderOrder[0];
        }

        if (this.lightmapIndex >= 0) {
            // use the override lightmap if its not undefined
            const tex = this._lightmapTextureOverride !== undefined
                ? this._lightmapTextureOverride
                : this.context.lightmaps.tryGetLightmap(this.sourceId, this.lightmapIndex);
            if (tex) {
                // tex.encoding = THREE.LinearEncoding;
                this._lightmaps = [];

                if (type === "Mesh") {
                    const mat = this.gameObject["material"];
                    if (!mat?.isMeshBasicMaterial) {
                        const rm = new RendererLightmap(this.gameObject, this.context);// GameObject.addNewComponent(this.gameObject, RendererLightmap);
                        this._lightmaps.push(rm);
                        rm.init(this.lightmapIndex, this.lightmapScaleOffset, tex, debugLightmap);
                    }
                    else {
                        if (mat)
                            console.warn("Lightmapping is not supported on MeshBasicMaterial", mat.name)
                    }
                }
                // for multi materials we need to loop through children 
                // and then we add a lightmap renderer component to each of them
                else if (this.isMultiMaterialObject(this.gameObject) && this.sharedMaterials.length > 0) {
                    for (const child of this.gameObject.children) {
                        if (!child["material"]?.isMeshBasicMaterial) {
                            const rm = new RendererLightmap(child as GameObject, this.context);
                            this._lightmaps.push(rm);
                            rm.init(this.lightmapIndex, this.lightmapScaleOffset, tex, debugLightmap);
                            // onBeforeRender is not called when the renderer is on a group
                            // this is an issue we probably also need to handle for custom shaders
                            // and need a better solution, but for now this fixes lightmaps for multimaterial objects
                            rm.bindOnBeforeRender();
                        }
                    }
                }
            }
        }



        if (showWireframe) {
            for (let i = 0; i < this.sharedMaterials.length; i++) {
                const mat: any = this.sharedMaterials[i];
                if (mat) {
                    mat.wireframe = true;
                }
            }
        }

    }

    private _isInstancingEnabled: boolean = false;
    private handles: InstanceHandle[] | null | undefined = undefined;
    private prevLayers: number[] | null | undefined = undefined;

    private clearInstancingState() {
        this._isInstancingEnabled = false;
        this.handles = undefined;
        this.prevLayers = undefined;
    }
    setInstancingEnabled(enabled: boolean): boolean {
        if (this._isInstancingEnabled === enabled) return enabled && (this.handles === undefined || this.handles != null && this.handles.length > 0);
        this._isInstancingEnabled = enabled;
        if (enabled) {
            // if handles is undefined we
            if (this.handles === undefined) {
                this.handles = instancing.setup(this.gameObject, this.context, null, { rend: this, foundMeshes: 0 });
                if (this.handles) {
                    // const disableSelf = this.gameObject.type === "Mesh" || this.gameObject.children?.length === this.handles.length;
                    // this.gameObject.visible = !disableSelf;
                    // this.gameObject.type = "Object3D";
                    // this.gameObject.material = null;
                    // console.log("Using instancing", this.gameObject.visible);
                    // this.gameObject.onBeforeRender = () => console.log("SHOULD NOT BE CALLED");
                    GameObject.markAsInstancedRendered(this.gameObject, true);
                    return true;
                }
            }
            else if (this.handles !== null) {
                for (const handler of this.handles) {
                    handler.updateInstanceMatrix(true);
                    handler.add();
                }
                // this.gameObject.type = "Object3D";
                // this.gameObject.visible = false;
                GameObject.markAsInstancedRendered(this.gameObject, true);
                return true;
            }
        }
        else {
            if (this.handles) {
                for (const handler of this.handles) {
                    handler.remove();
                }
            }
            // this.gameObject.visible = true;
            return true;
        }

        return false;
    }

    start() {
        if (this.enableInstancing && !suppressInstancing) {
            this.setInstancingEnabled(true);
        }
        this.gameObject.frustumCulled = this.allowOcclusionWhenDynamic;
        if (this.isMultiMaterialObject(this.gameObject)) {
            for (let i = 0; i < this.gameObject.children.length; i++) {
                const ch = this.gameObject.children[i];
                ch.frustumCulled = this.allowOcclusionWhenDynamic;
            }
        }
    }

    onEnable() {
        this.setVisibility(true);

        if (this._isInstancingEnabled) {
            this.setInstancingEnabled(true);
        }
        else if (this.enabled) {
            // this.gameObject.visible = true;
            this.applyStencil();
        }

        this.updateReflectionProbe();
    }

    onDisable() {
        this.setVisibility(false);

        if (this.handles && this.handles.length > 0) {
            this.setInstancingEnabled(false);
        }
    }

    onDestroy(): void {
        this.handles = null;
    }

    applyStencil() {
        NEEDLE_render_objects.applyStencil(this);
    }

    static envmap: THREE.Texture | null = null;

    onBeforeRender() {
        if (!this.gameObject) {
            return;
        }

        Renderer.envmap = this.scene.environment;

        const needsUpdate: boolean = this.gameObject[NEED_UPDATE_INSTANCE_KEY] === true || this.gameObject.matrixWorldNeedsUpdate;

        if (this.isMultiMaterialObject(this.gameObject) && this.gameObject.children?.length > 0) {
            for (const ch of this.gameObject.children) {
                this.applySettings(ch);
            }
        }
        else {
            this.applySettings(this.gameObject);
        }

        if (needsUpdate) {
            delete this.gameObject[NEED_UPDATE_INSTANCE_KEY];
            if (this.handles) {
                const remove = false;// Math.random() < .01;
                for (let i = this.handles.length - 1; i >= 0; i--) {
                    const h = this.handles[i];
                    if (remove) {
                        h.remove();
                        this.handles.splice(i, 1);
                    }
                    else
                        h.updateInstanceMatrix();
                }
                this.gameObject.matrixWorldNeedsUpdate = false;
            }
        }

        if (this.handles && this.handles.length <= 0) {
            GameObject.markAsInstancedRendered(this.gameObject, false);
        }

        if (this._isInstancingEnabled && this.handles) {
            for (let i = 0; i < this.handles.length; i++) {
                const handle = this.handles[i];
                if (!this.prevLayers) this.prevLayers = [];
                const layer = handle.object.layers.mask;
                if (i >= this.prevLayers.length) this.prevLayers.push(layer);
                else this.prevLayers[i] = layer;
                handle.object.layers.disableAll();
            }
        }

        if (this.reflectionProbeUsage !== ReflectionProbeUsage.Off && this._reflectionProbe) {
            this._reflectionProbe.onSet(this);
        }

    }

    onBeforeRenderThree(_renderer, _scene, _camera, _geometry, material, _group) {

        // progressive load before rendering so we only load textures for visible materials
        if (!suppressProgressiveLoading && material._didRequestTextureLOD === undefined && this.allowProgressiveLoading) {
            material._didRequestTextureLOD = 0;
            if (debugProgressiveLoading) {
                console.log("Load material LOD", material.name);
            }
            NEEDLE_progressive.assignTextureLOD(this.context, this.sourceId, material);
        }

        if (material.envMapIntensity !== undefined) {
            const factor = this.hasLightmap ? Math.PI : 1;
            material.envMapIntensity = Math.max(0, this.context.rendererData.environmentIntensity / factor);
        }
        // if (this._reflectionProbe?.texture) {
        //     material.envMap = this._reflectionProbe.texture;
        //     // this.context.renderer.prop
        //     // console.log(material.name);
        //     // this.context.renderer.properties.get(material);
        //     // this.context.renderer.properties.update(material, "environment", this._reflectionProbe.texture);
        // }

        //     _scene.environment = null;
        // else _scene.environment = Renderer.envmap;
        // if (!material.envmap)
        //     material.envMap = Renderer.envmap;
        // material.needsUpdate = true;

        // if (!camera) {
        //     let isXRCamera = false;
        //     if (this.context.isInXR) {
        //         // @ts-ignore
        //         const arr = this.context.renderer.xr.getCamera() as ArrayCamera;
        //         if (arr.cameras?.length > 0) {
        //             camera = arr;
        //             isXRCamera = true;
        //         }
        //     }
        // }

        // if (this.customShaderHandler) {
        //     this.customShaderHandler.onBeforeRender(renderer, scene, camera, geometry, material, group);
        // }
        // else if (this.rawShaderHandler) {
        //     for (const h of this.rawShaderHandler) {
        //         h.onBeforeRender(this.gameObject, camera);
        //     }
        // }

        if (this._lightmaps) {
            for (const lm of this._lightmaps) {
                lm.onBeforeRenderThree(material);
            }
        }
    }

    onAfterRender() {
        if (this._isInstancingEnabled && this.handles && this.prevLayers && this.prevLayers.length >= this.handles.length) {
            for (let i = 0; i < this.handles.length; i++) {
                const handle = this.handles[i];
                handle.object.layers.mask = this.prevLayers[i];
            }
        }

        if (this.reflectionProbeUsage !== ReflectionProbeUsage.Off && this._reflectionProbe) {
            this._reflectionProbe.onUnset(this)
        }
    }

    private applySettings(go: THREE.Object3D) {
        go.receiveShadow = this.receiveShadows;
        if (this.shadowCastingMode == ShadowCastingMode.On) {
            go.castShadow = true;
        }
        else go.castShadow = false;
    }

    private _reflectionProbe: ReflectionProbe | null = null;
    private updateReflectionProbe() {
        // handle reflection probe
        this._reflectionProbe = null;
        if (this.reflectionProbeUsage !== ReflectionProbeUsage.Off) {
            if (!this.probeAnchor) return;
            // update the reflection probe right before rendering
            // if we do it immediately the reflection probe might not be enabled yet 
            // (since this method is called from onEnable)
            this.startCoroutine(this._updateReflectionProbe(), FrameEvent.LateUpdate);
        }
    }
    private *_updateReflectionProbe() {
        const obj = this.probeAnchor || this.gameObject;
        const isAnchor = this.probeAnchor ? true : false;
        this._reflectionProbe = ReflectionProbe.get(obj, this.context, isAnchor, this.probeAnchor);
    }

    private setVisibility(visible: boolean) {

        if (!this.isMultiMaterialObject(this.gameObject)) {
            setCustomVisibility(this.gameObject, visible);
        }
        else {
            for (const ch of this.gameObject.children) {
                if (this.isMeshOrSkinnedMesh(ch)) {
                    setCustomVisibility(ch, visible);
                }
            }
        }
    }

    private isMultiMaterialObject(obj: Object3D) {
        return obj.type === "Group";
    }

    private isMeshOrSkinnedMesh(obj: Object3D): obj is Mesh | SkinnedMesh {
        return obj.type === "Mesh" || obj.type === "SkinnedMesh";
    }
}

export class MeshRenderer extends Renderer {

}

export class SkinnedMeshRenderer extends MeshRenderer {
    awake() {
        super.awake();
        // disable skinned mesh occlusion because of https://github.com/mrdoob/three.js/issues/14499
        this.allowOcclusionWhenDynamic = false;
    }
}

export enum ShadowCastingMode {
    /// <summary>
    ///   <para>No shadows are cast from this object.</para>
    /// </summary>
    Off,
    /// <summary>
    ///   <para>Shadows are cast from this object.</para>
    /// </summary>
    On,
    /// <summary>
    ///   <para>Shadows are cast from this object, treating it as two-sided.</para>
    /// </summary>
    TwoSided,
    /// <summary>
    ///   <para>Object casts shadows, but is otherwise invisible in the Scene.</para>
    /// </summary>
    ShadowsOnly,
}



declare class InstancingSetupArgs { rend: Renderer; foundMeshes: number };

class InstancingHandler {

    public objs: InstancedMeshRenderer[] = [];

    public setup(obj: THREE.Object3D, context: Context, handlesArray: InstanceHandle[] | null, args: InstancingSetupArgs, level: number = 0)
        : InstanceHandle[] | null {

        const res = this.tryCreateOrAddInstance(obj, context, args);
        if (res) {
            if (handlesArray === null) handlesArray = [];
            handlesArray.push(res);
            return handlesArray;
        }

        if (level <= 0 && obj.type !== "Mesh") {
            const nextLevel = level + 1;
            for (const ch of obj.children) {
                handlesArray = this.setup(ch, context, handlesArray, args, nextLevel);
            }
        }
        return handlesArray;
    }

    private tryCreateOrAddInstance(obj: THREE.Object3D, context: Context, args: InstancingSetupArgs): InstanceHandle | null {
        if (obj.type === "Mesh") {
            const index = args.foundMeshes;
            args.foundMeshes += 1;
            if (!args.rend.enableInstancing) return null;
            if (index >= args.rend.enableInstancing.length) {
                // console.error("Something is wrong with instance setup", obj, args.rend.enableInstancing, index);
                return null;
            }
            if (!args.rend.enableInstancing[index]) {
                // instancing is disabled
                // console.log("Instancing is disabled", obj);
                return null;
            }
            // instancing is enabled:
            const mesh = obj as THREE.Mesh;
            const geo = mesh.geometry as THREE.BufferGeometry;
            const mat = mesh.material as THREE.Material;

            for (const i of this.objs) {
                if (i.isFull()) continue;
                if (i.geo === geo && i.material === mat) {
                    return i.addInstance(mesh);
                }
            }
            // console.log("Add new instance mesh renderer", obj);
            const i = new InstancedMeshRenderer(obj.name, geo, mat, 200, context);
            this.objs.push(i);
            return i.addInstance(mesh);
        }
        return null;
    }
}
const instancing: InstancingHandler = new InstancingHandler();

class InstanceHandle {

    get name(): string {
        return this.object.name;
    }

    instanceIndex: number = -1;
    object: THREE.Mesh;
    instancer: InstancedMeshRenderer;

    constructor(instanceIndex: number, originalObject: THREE.Mesh, instancer: InstancedMeshRenderer) {
        this.instanceIndex = instanceIndex;
        this.object = originalObject;
        this.instancer = instancer;
        GameObject.markAsInstancedRendered(originalObject, true);
        // this.object.visible = false;
    }

    updateInstanceMatrix(updateChildren: boolean = false) {
        if (this.instanceIndex < 0) return;
        this.object.updateWorldMatrix(true, updateChildren);
        this.instancer.updateInstance(this.object.matrixWorld, this.instanceIndex);
    }

    add() {
        if (this.instanceIndex >= 0) return;
        this.instancer.add(this);
    }

    remove() {
        if (this.instanceIndex < 0) return;
        this.instancer.remove(this);
    }
}

class InstancedMeshRenderer {

    public name: string = "";
    public geo: THREE.BufferGeometry;
    public material: THREE.Material;
    get currentCount(): number { return this.inst.count; }

    private context: Context;
    private inst: THREE.InstancedMesh;
    private handles: (InstanceHandle | null)[] = [];
    private maxCount: number;

    private static nullMatrix: THREE.Matrix4 = new THREE.Matrix4();

    isFull(): boolean {
        return this.currentCount >= this.maxCount;
    }

    constructor(name: string, geo: THREE.BufferGeometry, material: THREE.Material, count: number, context: Context) {
        this.name = name;
        this.geo = geo;
        this.material = material;
        this.context = context;
        this.maxCount = count;
        if (debugInstancing) {
            material = new THREE.MeshBasicMaterial({ color: this.randomColor() });
        }
        this.inst = new THREE.InstancedMesh(geo, material, count);
        this.inst.count = 0;
        this.inst.layers.set(2);
        this.inst.visible = true;
        // this.inst.castShadow = true;
        // this.inst.receiveShadow = true;
        this.context.scene.add(this.inst);
        // console.log(this.inst);
        // this.context.pre_render_callbacks.push(this.onPreRender.bind(this));

        // setInterval(() => {
        //     this.inst.visible = !this.inst.visible;
        // }, 500);
    }

    private randomColor() {
        return new THREE.Color(Math.random(), Math.random(), Math.random());
    }

    addInstance(obj: THREE.Mesh): InstanceHandle | null {
        if (this.currentCount >= this.maxCount) {
            console.error("TOO MANY INSTANCES - resize is not yet implemented!", this.inst.count); // todo: make it resize
            return null;
        }
        const handle = new InstanceHandle(-1, obj, this);
        this.add(handle);
        return handle;
    }


    add(handle: InstanceHandle) {
        if (handle.instanceIndex < 0) {
            handle.instanceIndex = this.currentCount;
            // console.log(handle.instanceIndex, this.currentCount);
            if (handle.instanceIndex >= this.handles.length)
                this.handles.push(handle);
            else this.handles[handle.instanceIndex] = handle;
        }
        // console.log("Handle instance");
        handle.object.updateWorldMatrix(true, true);
        this.inst.setMatrixAt(handle.instanceIndex, handle.object.matrixWorld);
        this.inst.instanceMatrix.needsUpdate = true;
        this.inst.count += 1;

        if (this.inst.count > 0)
            this.inst.visible = true;

        // console.log("Added", this.name, this.inst.count, this.handles);
    }

    remove(handle: InstanceHandle) {
        if (!handle) return;
        if (handle.instanceIndex < 0 || handle.instanceIndex >= this.handles.length || this.inst.count <= 0) {
            return;
        }
        if (this.handles[handle.instanceIndex] !== handle) {
            console.error("instance handle is not part of renderer, was it removed before?", handle.instanceIndex, this.name);
            const index = this.handles.indexOf(handle);
            if (index < 0)
                return;
            handle.instanceIndex = index;
        }
        this.handles[handle.instanceIndex] = null;
        this.inst.setMatrixAt(handle.instanceIndex, InstancedMeshRenderer.nullMatrix);
        const removedLastElement = handle.instanceIndex >= this.currentCount - 1;
        // console.log(removedLastElement, this.currentCount, handle.instanceIndex, this.handles);
        if (!removedLastElement && this.currentCount > 0) {
            const lastElement = this.handles[this.currentCount - 1];
            if (lastElement) {
                lastElement.instanceIndex = handle.instanceIndex;
                lastElement.updateInstanceMatrix();
                this.handles[handle.instanceIndex] = lastElement;
                this.handles[this.currentCount - 1] = null;
                // this.inst.setMatrixAt(handle.instanceIndex, lastElement.object.matrixWorld);
                // this.inst.setMatrixAt(this.currentCount - 1, InstancedMeshRenderer.nullMatrix);
            }
        }

        if (this.inst.count > 0)
            this.inst.count -= 1;
        handle.instanceIndex = -1;

        if (this.inst.count <= 0)
            this.inst.visible = false;

        this.inst.instanceMatrix.needsUpdate = true;
    }

    updateInstance(mat: THREE.Matrix4, index: number) {
        this.inst.setMatrixAt(index, mat);
        this.inst.instanceMatrix.needsUpdate = true;
    }
}