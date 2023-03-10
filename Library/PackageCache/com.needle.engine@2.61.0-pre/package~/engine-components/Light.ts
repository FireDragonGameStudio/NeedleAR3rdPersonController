import { Behaviour, GameObject } from "./Component";
import * as THREE from "three";
import { getParam, isMobileDevice } from "../engine/engine_utils";
import { setWorldPositionXYZ } from "../engine/engine_three_utils";
import { FrameEvent } from "../engine/engine_setup";
import { serializable } from "../engine/engine_serialization_decorator";
import { Color, DirectionalLight, OrthographicCamera } from "three";
import { WebXR, WebXREvent } from "./WebXR";
import { WebARSessionRoot } from "./WebARSessionRoot";
import { ILight } from "../engine/engine_types";
import { Mathf } from "../engine/engine_math";
import { isLocalNetwork } from "../engine/engine_networking_utils";

// https://threejs.org/examples/webgl_shadowmap_csm.html


function toDegrees(radians) {
    return radians * 180 / Math.PI;
}

function toRadians(degrees) {
    return degrees * Math.PI / 180;
}

const shadowMaxDistance = 300;
const debug = getParam("debuglights");


/// <summary>
///   <para>The type of a Light.</para>
/// </summary>
export enum LightType {
    /// <summary>
    ///   <para>The light is a spot light.</para>
    /// </summary>
    Spot = 0,
    /// <summary>
    ///   <para>The light is a directional light.</para>
    /// </summary>
    Directional = 1,
    /// <summary>
    ///   <para>The light is a point light.</para>
    /// </summary>
    Point = 2,
    Area = 3,
    /// <summary>
    ///   <para>The light is a rectangle shaped area light. It affects only baked lightmaps and lightprobes.</para>
    /// </summary>
    Rectangle = 3,
    /// <summary>
    ///   <para>The light is a disc shaped area light. It affects only baked lightmaps and lightprobes.</para>
    /// </summary>
    Disc = 4,
}
export enum LightmapBakeType {
    /// <summary>
    ///   <para>Realtime lights cast run time light and shadows. They can change position, orientation, color, brightness, and many other properties at run time. No lighting gets baked into lightmaps or light probes..</para>
    /// </summary>
    Realtime = 4,
    /// <summary>
    ///   <para>Baked lights cannot move or change in any way during run time. All lighting for static objects gets baked into lightmaps. Lighting and shadows for dynamic objects gets baked into Light Probes.</para>
    /// </summary>
    Baked = 2,
    /// <summary>
    ///   <para>Mixed lights allow a mix of realtime and baked lighting, based on the Mixed Lighting Mode used. These lights cannot move, but can change color and intensity at run time. Changes to color and intensity only affect direct lighting as indirect lighting gets baked. If using Subtractive mode, changes to color or intensity are not calculated at run time on static objects.</para>
    /// </summary>
    Mixed = 1,
}

/// <summary>
///   <para>Shadow casting options for a Light.</para>
/// </summary>
enum LightShadows {
    /// <summary>
    ///   <para>Do not cast shadows (default).</para>
    /// </summary>
    None = 0,
    /// <summary>
    ///   <para>Cast "hard" shadows (with no shadow filtering).</para>
    /// </summary>
    Hard = 1,
    /// <summary>
    ///   <para>Cast "soft" shadows (with 4x PCF filtering).</para>
    /// </summary>
    Soft = 2,
}

export class Light extends Behaviour implements ILight {

    @serializable()
    private type: LightType = 0;

    public range: number = 1;
    public spotAngle: number = 1;
    public innerSpotAngle: number = 1;

    @serializable(Color)
    public color: THREE.Color = new THREE.Color(0xffffff);

    @serializable()
    set shadowNearPlane(val: number) {
        if (val === this._shadowNearPlane) return;
        this._shadowNearPlane = val;
        if (this.light?.shadow?.camera !== undefined) {
            const cam = this.light.shadow.camera as THREE.OrthographicCamera;
            cam.near = val;
        }
    }
    get shadowNearPlane(): number { return this._shadowNearPlane; }
    private _shadowNearPlane: number = .1;

    @serializable()
    set shadowBias(val: number) {
        if (val === this._shadowBias) return;
        this._shadowBias = val;
        if (this.light?.shadow?.bias !== undefined) {
            this.light.shadow.bias = val;
            this.light.shadow.needsUpdate = true;
        }
    }
    get shadowBias(): number { return this._shadowBias; }
    private _shadowBias: number = 0;

    @serializable()
    set shadowNormalBias(val: number) {
        if (val === this._shadowNormalBias) return;
        this._shadowNormalBias = val;
        if (this.light?.shadow?.normalBias !== undefined) {
            this.light.shadow.normalBias = val;
            this.light.shadow.needsUpdate = true;
        }
    }
    get shadowNormalBias(): number { return this._shadowNormalBias; }
    private _shadowNormalBias: number = 0;

    /** when enabled this will remove the multiplication when setting the shadow bias settings initially */
    private _overrideShadowBiasSettings: boolean = false;

    @serializable()
    set shadows(val: LightShadows) {
        this._shadows = val;
        if (this.light) {
            this.light.castShadow = val !== LightShadows.None;
            this.updateShadowSoftHard();
        }
    }
    get shadows(): LightShadows { return this._shadows; }
    private _shadows: LightShadows = 1;

    @serializable()
    private lightmapBakeType: LightmapBakeType = LightmapBakeType.Realtime;

    @serializable()
    set intensity(val: number) {
        this._intensity = val;
        if (this.light) {
            let factor: number = 1;
            if (this.context.isInXR && this._webARRoot) {
                const scaleFactor = this._webARRoot?.arScale;
                if (typeof scaleFactor === "number" && scaleFactor > 0) {
                    factor /= scaleFactor;
                }
            }
            this.light.intensity = val * factor;
        }
    }
    get intensity(): number { return this._intensity; }
    private _intensity: number = -1;

    @serializable()
    get shadowDistance(): number {
        const light = this.light;
        if (light) {
            const cam = light.shadow.camera as OrthographicCamera;
            return cam.far;
        }
        return -1;
    }
    set shadowDistance(val: number) {
        this._shadowDistance = val;
        const light = this.light;
        if (light) {
            const cam = light.shadow.camera as OrthographicCamera;
            cam.far = val;
            cam.updateProjectionMatrix();
        }
    }
    private _shadowDistance?: number;
    // set from additional component
    private shadowWidth?: number;
    private shadowHeight?: number;

    @serializable()
    get shadowResolution(): number {
        const light = this.light;
        if (light) {
            return light.shadow.mapSize.x;
        }
        return -1;
    }
    set shadowResolution(val: number) {
        if (val === this._shadowResolution) return;
        this._shadowResolution = val;
        const light = this.light;
        if (light) {
            light.shadow.mapSize.set(val, val);
            light.shadow.needsUpdate = true;
        }
    }
    private _shadowResolution?: number = undefined;

    get isBaked() {
        return this.lightmapBakeType === LightmapBakeType.Baked;
    }

    private get selfIsLight(): boolean {
        if (this.gameObject["isLight"] === true) return true;
        switch (this.gameObject.type) {
            case "SpotLight":
            case "PointLight":
            case "DirectionalLight":
                return true;
        }
        return false;
    }

    private light: THREE.Light | undefined = undefined;

    public getWorldPosition(vec: THREE.Vector3): THREE.Vector3 {
        if (this.light) {
            if (this.type === LightType.Directional) {
                return this.light.getWorldPosition(vec).multiplyScalar(1);
            }
            return this.light.getWorldPosition(vec);
        }
        return vec;
    }

    public updateIntensity() {
        this.intensity = this._intensity;
    }

    awake() {
        this.color = new THREE.Color(this.color ?? 0xffffff);
        if(debug) console.log(this.name, this);
    }

    onEnable(): void {
        this.createLight();
        if (this.isBaked) return;
        else if (this.light) {
            if (this.selfIsLight) {
                // nothing to do
            }
            else if (this.light.parent !== this.gameObject)
                this.gameObject.add(this.light);
        }
        if (this.type === LightType.Directional)
            this.startCoroutine(this.updateMainLightRoutine(), FrameEvent.LateUpdate);

        this._webXRStartedListener = WebXR.addEventListener(WebXREvent.XRStarted, this.onWebXRStarted.bind(this));
        this._webXREndedListener = WebXR.addEventListener(WebXREvent.XRStopped, this.onWebXREnded.bind(this));
    }

    onDisable() {
        WebXR.removeEventListener(WebXREvent.XRStarted, this._webXRStartedListener);
        WebXR.removeEventListener(WebXREvent.XRStopped, this._webXREndedListener);
    }

    private _webXRStartedListener?: Function;
    private _webXREndedListener?: Function;
    private _webARRoot?: WebARSessionRoot;

    private onWebXRStarted() {
        this._webARRoot = GameObject.getComponentInParent(this.gameObject, WebARSessionRoot) ?? undefined;
        this.startCoroutine(this._updateLightIntensityInARRoutine());
    }

    private *_updateLightIntensityInARRoutine() {
        while (this.context.isInAR) {
            yield;
            this.updateIntensity();
            for (let i = 0; i < 30; i++) yield;
        }
    }

    private onWebXREnded() {
        this.updateIntensity();
    }

    createLight() {
        const lightAlreadyCreated = this.selfIsLight;

        if (lightAlreadyCreated && !this.light) {
            this.light = this.gameObject as unknown as THREE.Light;
            this._intensity = this.light.intensity;

            switch (this.type) {
                case LightType.Directional:
                    this.setDirectionalLight(this.light as DirectionalLight);
                    break;
            }
        }
        else if (!this.light) {
            switch (this.type) {
                case LightType.Directional:
                    // console.log(this);
                    const dirLight = new THREE.DirectionalLight(this.color, this.intensity * Math.PI);
                    // directional light target is at 0 0 0 by default
                    dirLight.position.set(0, 0, -shadowMaxDistance * .5).applyQuaternion(this.gameObject.quaternion);
                    this.gameObject.add(dirLight.target);
                    setWorldPositionXYZ(dirLight.target, 0, 0, 0);
                    this.light = dirLight;
                    this.gameObject.position.set(0, 0, 0);
                    this.gameObject.rotation.set(0, 0, 0);

                    if (debug) {
                        const spotLightHelper = new THREE.DirectionalLightHelper(this.light as THREE.DirectionalLight, .2, this.color);
                        this.context.scene.add(spotLightHelper);
                        // const bh = new THREE.BoxHelper(this.context.scene, 0xfff0000);
                        // this.context.scene.add(bh);
                    }
                    break;

                case LightType.Spot:
                    const spotLight = new THREE.SpotLight(this.color, this.intensity * Math.PI, this.range, toRadians(this.spotAngle / 2), 1 - toRadians(this.innerSpotAngle / 2) / toRadians(this.spotAngle / 2), 2);
                    spotLight.position.set(0, 0, 0);
                    spotLight.rotation.set(0, 0, 0);

                    this.light = spotLight;
                    const spotLightTarget = spotLight.target;
                    spotLight.add(spotLightTarget);
                    spotLightTarget.position.set(0, 0, this.range);
                    spotLightTarget.rotation.set(0, 0, 0);
                    break;

                case LightType.Point:
                    const pointLight = new THREE.PointLight(this.color, this.intensity * Math.PI, this.range);
                    this.light = pointLight;

                    // const pointHelper = new THREE.PointLightHelper(pointLight, this.range, this.color);
                    // scene.add(pointHelper);
                    break;
            }
        }


        if (this.light) {
            if (this._intensity >= 0)
                this.light.intensity = this._intensity;
            else
                this._intensity = this.light.intensity;

            if (this.shadows !== LightShadows.None) {
                this.light.castShadow = true;
            }
            else this.light.castShadow = false;

            // shadow intensity is currently not a thing: https://github.com/mrdoob/three.js/pull/14087
            if (this._shadowResolution !== undefined && this._shadowResolution > 4) {
                this.light.shadow.mapSize.width = this._shadowResolution;
                this.light.shadow.mapSize.height = this._shadowResolution;
            }
            else {
                this.light.shadow.mapSize.width = 2048;
                this.light.shadow.mapSize.height = 2048;
            }
            // this.light.shadow.needsUpdate = true;
            // console.log(this.light.shadow.mapSize);
            // return;

            if (debug)
                console.log("Override shadow bias?", this._overrideShadowBiasSettings, this.shadowBias, this.shadowNormalBias);

            this.light.shadow.bias = this.shadowBias;
            this.light.shadow.normalBias = this.shadowNormalBias;

            this.updateShadowSoftHard();

            const cam = this.light.shadow.camera as THREE.OrthographicCamera;
            cam.near = this.shadowNearPlane;
            // use shadow distance that was set explictly (if any)
            if (this._shadowDistance !== undefined && typeof this._shadowDistance === "number")
                cam.far = this._shadowDistance;
            else // otherwise fallback to object scale and max distance
                cam.far = shadowMaxDistance * Math.abs(this.gameObject.scale.z);

            // width and height
            this.gameObject.scale.set(1, 1, 1);
            if (this.shadowWidth !== undefined) {
                cam.left = -this.shadowWidth / 2;
                cam.right = this.shadowWidth / 2;
            }
            else {
                const sx = this.gameObject.scale.x;
                cam.left *= sx;
                cam.right *= sx;
            }
            if (this.shadowHeight !== undefined) {
                cam.top = this.shadowHeight / 2;
                cam.bottom = -this.shadowHeight / 2;
            }
            else {
                const sy = this.gameObject.scale.y;
                cam.top *= sy;
                cam.bottom *= sy;
            }


            this.light.shadow.needsUpdate = true;
            if (debug)
                this.context.scene.add(new THREE.CameraHelper(cam));


            if (this.isBaked) {
                this.light.removeFromParent();
            }
            else if (!lightAlreadyCreated)
                this.gameObject.add(this.light);
        }

    }

    *updateMainLightRoutine() {
        while (true) {
            if (this.type === LightType.Directional) {
                if (!this.context.mainLight || this.intensity > this.context.mainLight.intensity) {
                    this.context.mainLight = this;
                }
                yield;
            }
            break;
        }
    }

    static allowChangingRendererShadowMapType: boolean = true;

    private updateShadowSoftHard() {
        if (!this.light) return;
        if (this.shadows === LightShadows.Soft) {
            // const radius = this.light.shadow.mapSize.width / 1024 * 5;
            // const samples = Mathf.clamp(Math.round(radius), 2, 10);
            // this.light.shadow.radius = radius;
            // this.light.shadow.blurSamples = samples;
            // if (isMobileDevice()) {
            //     this.light.shadow.radius *= .5;
            //     this.light.shadow.blurSamples = Math.floor(this.light.shadow.blurSamples * .5);
            // }
            // if (Light.allowChangingRendererShadowMapType) {
            //     if(this.context.renderer.shadowMap.type !== THREE.VSMShadowMap){
            //         if(isLocalNetwork()) console.warn("Changing renderer shadow map type to VSMShadowMap because a light with soft shadows enabled was found (this will cause all shadow receivers to also cast shadows). If you don't want this behaviour either set the shadow type to hard or set Light.allowChangingRendererShadowMapType to false.", this);
            //         this.context.renderer.shadowMap.type = THREE.VSMShadowMap;
            //     }
            // }
        }
        else {
            this.light.shadow.radius = 1;
            this.light.shadow.blurSamples = 1;
        }
    }

    private setDirectionalLight(dirLight: DirectionalLight) {
        dirLight.add(dirLight.target);
        dirLight.target.position.set(0, 0, -1);
        // dirLight.position.add(vec.set(0,0,1).multiplyScalar(shadowMaxDistance*.1).applyQuaternion(this.gameObject.quaternion));
    }
}

const vec = new THREE.Vector3(0, 0, 0);

