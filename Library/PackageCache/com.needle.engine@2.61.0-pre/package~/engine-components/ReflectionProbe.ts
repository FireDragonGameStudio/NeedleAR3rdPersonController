import { Behaviour } from "./Component";
import { Box3, Color, EquirectangularReflectionMapping, LineBasicMaterial, Material, MeshStandardMaterial, Object3D, sRGBEncoding, Texture, Vector3, WebGLCubeRenderTarget, WebGLRenderTarget } from "three";
import { serializable } from "../engine/engine_serialization";
import { Context } from "../engine/engine_setup";
import { getWorldPosition, getWorldScale } from "../engine/engine_three_utils";
import { IRenderer } from "../engine/engine_types";
import { BoxHelperComponent } from "./BoxHelperComponent";
import { getParam } from "../engine/engine_utils";

export const debug = getParam("debugreflectionprobe");
const disable = getParam("noreflectionprobe");

const $reflectionProbeKey = Symbol("reflectionProbeKey");
const $originalMaterial = Symbol("original material");

export class ReflectionProbe extends Behaviour {

    private static _probes: Map<Context, ReflectionProbe[]> = new Map();

    public static get(object: Object3D | null | undefined, context: Context, isAnchor: boolean, anchor?: Object3D): ReflectionProbe | null {
        if (!object || object.isObject3D !== true) return null;
        if (disable) return null;
        const probes = ReflectionProbe._probes.get(context);
        if (probes) {
            for (const probe of probes) {
                if (!probe.__didAwake) probe.__internalAwake();
                if (probe.enabled) {
                    if (anchor) {
                        // test if anchor is reflection probe object
                        if (probe.gameObject === anchor) {
                            return probe;
                        }
                    }
                    else if (probe.isInBox(object, undefined)) {
                        if (debug) console.log("Found reflection probe", object.name, probe.name);
                        return probe;
                    }
                }
            }
        }
        if (debug)
            console.debug("Did not find reflection probe", object.name, isAnchor, object);
        return null;
    }



    private _texture!: Texture;
    set texture(tex: Texture) {
        this._texture = tex;
    }
    get texture(): Texture {
        return this._texture;
    }

    @serializable(Vector3)
    center?: Vector3;
    @serializable(Vector3)
    size?: Vector3;

    private _boxHelper?: BoxHelperComponent;

    private isInBox(obj: Object3D, scaleFactor?: number) {
        return this._boxHelper?.isInBox(obj, scaleFactor);
    }

    constructor() {
        super();
        if (!ReflectionProbe._probes.has(this.context)) {
            ReflectionProbe._probes.set(this.context, []);
        }
        ReflectionProbe._probes.get(this.context)?.push(this);
    }

    awake() {
        this._boxHelper = this.gameObject.addNewComponent(BoxHelperComponent) as BoxHelperComponent;
        this._boxHelper.updateBox(true);
        if (debug)
            this._boxHelper.showHelper(0x555500, true);

        if (this.texture) {
            this.texture.mapping = EquirectangularReflectionMapping;
            this.texture.encoding = sRGBEncoding;
            // this.texture.rotation = Math.PI;
            // this.texture.flipY = true;
            this.texture.needsUpdate = true;
        }
    }

    onDestroy() {
        const probes = ReflectionProbe._probes.get(this.context);
        if (probes) {
            const index = probes.indexOf(this);
            if (index >= 0) {
                probes.splice(index, 1);
            }
        }
    }


    // when objects are rendered and they share material
    // and some need reflection probe and some don't
    // we need to make sure we don't override the material but use a copy

    private static _rendererMaterialsCache: Map<IRenderer, Array<{ material: Material, copy: Material }>> = new Map();

    onSet(_rend: IRenderer) {
        if (disable) return;
        if (_rend.sharedMaterials?.length <= 0) return;
        if (!this.texture) return;

        let rendererCache = ReflectionProbe._rendererMaterialsCache.get(_rend);
        if (!rendererCache) {
            rendererCache = [];
            ReflectionProbe._rendererMaterialsCache.set(_rend, rendererCache);
        }

        // TODO: dont clone material for every renderer that uses reflection probes, we can do it once per material when they use the same reflection texture

        // need to make sure materials are not shared when using reflection probes
        // otherwise some renderers outside of the probe will be affected or vice versa
        for (let i = 0; i < _rend.sharedMaterials.length; i++) {
            const material = _rend.sharedMaterials[i];
            if (!material) continue;
            if (material["envMap"] === undefined) continue;
            if (material["envMap"] === this.texture) {
                continue;
            }
            let cached = rendererCache[i];

            // make sure we have the currently assigned material cached (and an up to date clone of that)
            if (!cached || cached.material !== material || cached.material.version !== material.version) {
                const clone = material.clone();

                if (cached) {
                    cached.copy = clone;
                    cached.material = material;
                }
                else {
                    cached = {
                        material: material,
                        copy: clone
                    };
                    rendererCache.push(cached);
                }

                clone[$reflectionProbeKey] = this;
                clone[$originalMaterial] = material;

                // make sure the reflection probe is assigned
                clone["envMap"] = this.texture;

                if (debug)
                    console.log("Set reflection", _rend.name, _rend.guid);
            }

            /** this is the material that we copied and that has the reflection probe */
            const copy = cached?.copy;

            _rend.sharedMaterials[i] = copy;
        }
    }

    onUnset(_rend: IRenderer) {
        const rendererCache = ReflectionProbe._rendererMaterialsCache.get(_rend);
        if (rendererCache) {
            for (let i = 0; i < rendererCache.length; i++) {
                const cached = rendererCache[i];
                _rend.sharedMaterials[i] = cached.material;
            }
        }
    }
}