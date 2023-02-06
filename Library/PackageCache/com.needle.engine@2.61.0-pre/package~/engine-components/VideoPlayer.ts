import { Behaviour, GameObject } from "./Component";
import * as THREE from "three";
import { serializable } from "../engine/engine_serialization_decorator";
import { LinearFilter, Material, Mesh, Object3D, RawShaderMaterial, ShaderMaterial, Texture, TextureLoader, Vector2, Vector4, VideoTexture } from "three";
import { awaitInput } from "../engine/engine_input_utils";
import { getParam } from "../engine/engine_utils";
import { Renderer } from "./Renderer";
import { getWorldScale } from "../engine/engine_three_utils";
import { ObjectUtils, PrimitiveType } from "../engine/engine_create_objects";
import { Context } from "../engine/engine_setup";

const debug = getParam("debugvideo");


export enum AspectMode {
    None = 0,
    AdjustHeight = 1,
    AdjustWidth = 2,
}

export enum VideoSource {
    /// <summary>
    ///   <para>Use the current clip as the video content source.</para>
    /// </summary>
    VideoClip,
    /// <summary>
    ///   <para>Use the current URL as the video content source.</para>
    /// </summary>
    Url,
}

export enum VideoAudioOutputMode {
    None = 0,
    AudioSource = 1,
    Direct = 2,
    APIOnly = 3,
}

export enum VideoRenderMode {
    CameraFarPlane = 0,
    CameraNearPlane = 1,
    RenderTexture = 2,
    MaterialOverride = 3,
}

export class VideoPlayer extends Behaviour {

    @serializable(Object3D)
    renderer: THREE.Object3D | null = null;
    @serializable()
    playOnAwake: boolean = true;
    @serializable()
    playOnEnable?: boolean;

    @serializable()
    aspectMode: AspectMode = AspectMode.None;

    @serializable()
    private renderMode?: VideoRenderMode;

    @serializable()
    private targetMaterialProperty?: string;

    @serializable(Renderer)
    private targetMaterialRenderer?: Renderer;

    @serializable(Texture)
    private targetTexture?: Texture;

    @serializable()
    private time: number = 0;

    private _playbackSpeed: number = 1;
    @serializable()
    get playbackSpeed(): number {
        return this._videoElement?.playbackRate ?? this._playbackSpeed;
    }
    set playbackSpeed(val: number) {
        this._playbackSpeed = val;
        if (this._videoElement)
            this._videoElement.playbackRate = val;
    }

    private _isLooping: boolean = false;
    get isLooping(): boolean {
        return this._videoElement?.loop ?? this._isLooping;
    }
    @serializable()
    set isLooping(val: boolean) {
        this._isLooping = val;
        if (this._videoElement)
            this._videoElement.loop = val;
    }

    get currentTime(): number {
        return this._videoElement?.currentTime ?? this.time;
    }
    set currentTime(val: number) {
        if (this._videoElement) {
            this._videoElement.currentTime = val;
        }
        else this.time = val;
    }

    get isPlaying(): boolean {
        const video = this._videoElement;
        if (video) {
            return video.currentTime > 0 && !video.paused && !video.ended
                && video.readyState > video.HAVE_CURRENT_DATA;
        }
        return false;
    }

    get crossOrigin(): string | null {
        return this._videoElement?.crossOrigin ?? this._crossOrigin;
    }
    set crossOrigin(val: string | null) {
        this._crossOrigin = val;
        if (this._videoElement) {
            if (val !== null) this._videoElement.setAttribute("crossorigin", val);
            else this._videoElement.removeAttribute("crossorigin");
        }
    }

    get videoTexture() {
        return this._videoTexture;
    }

    get videoElement() {
        return this._videoElement;
    }

    private _crossOrigin: string | null = "anonymous";

    private audioOutputMode: VideoAudioOutputMode = VideoAudioOutputMode.AudioSource;

    private source!: VideoSource;
    private clip?: string | MediaStream | null = null;
    private url?: string | null = null;

    private _videoElement: HTMLVideoElement | null = null;
    private _videoTexture: THREE.VideoTexture | null = null;
    private videoMaterial: Material | null = null;

    private _isPlaying: boolean = false;
    private wasPlaying: boolean = false;

    setVideo(video: MediaStream) {
        this.clip = video;
        this.source = VideoSource.VideoClip;
        if (!this._videoElement) this.create(true);
        else {
            // TODO: how to prevent interruption error when another video is already playing
            this._videoElement.srcObject = video;
            if (this._isPlaying)
                this._videoElement.play();
            this.updateAspect();
        }
    }

    setClipURL(url: string) {
        if (this.url === url) return;
        // console.log("SET URL", url);
        this.url = url;
        this.source = VideoSource.Url;
        if (debug) console.log("set url", url);
        if (!this._videoElement) this.create(true);
        else {
            this._videoElement.src = url;
            if (this._isPlaying) {
                this.stop();
                this.play();
            }
        }
    }

    awake(): void {
        this.create(this.playOnAwake);

        window.addEventListener('visibilitychange', _evt => {
            switch (document.visibilityState) {
                case "hidden":
                    this.wasPlaying = this._isPlaying;
                    this.pause();
                    break;
                case "visible":
                    if (this.wasPlaying) this.play();
                    break;
            }
        });
    }

    onEnable(): void {
        if (this.playOnEnable === true) {
            this.handleBeginPlaying(true);
        }
        if (this.screenspace) {
            this._overlay?.start();
        }
        else this._overlay?.stop();
    }

    onDisable(): void {
        this.pause();
    }

    onDestroy(): void {
        if (this._videoElement) {
            this._videoElement.parentElement?.removeChild(this._videoElement);
            this._videoElement = null;
        }
        if (this._videoTexture) {
            this._videoTexture.dispose();
            this._videoTexture = null;
        }
    }

    private _receivedInput: boolean = false;

    constructor() {
        super();
        awaitInput(() => {
            this._receivedInput = true;
            this.updateVideoElementSettings();
        });
        this._targetObjects = [];

        if (getParam("videoscreenspace")) {
            window.addEventListener("keydown", evt => {
                if (evt.key === "f") {
                    this.screenspace = !this.screenspace;
                }
            });
        }
    }

    play() {
        if (!this._videoElement) return;
        if (this._isPlaying && !this._videoElement?.ended && !this._videoElement?.paused) return;
        this._isPlaying = true;
        if (!this._receivedInput) this._videoElement.muted = true;
        this.updateVideoElementSettings();
        this._videoElement?.play().catch(err => {
            console.warn(err);
        });
        if (debug) console.log("play", this._videoElement);
    }

    stop() {
        this._isPlaying = false;
        if (!this._videoElement) return;
        this._videoElement.currentTime = 0;
        this._videoElement.pause();
    }

    pause(): void {
        this._isPlaying = false;
        this._videoElement?.pause();
    }


    create(playAutomatically: boolean) {
        let src;
        switch (this.source) {
            case VideoSource.VideoClip:
                src = this.clip;
                break;
            case VideoSource.Url:
                src = this.url;
                break;
        }

        if (!src) return;

        // console.log(src, this);

        if (!this._videoElement) {
            this._videoElement = this.createVideoElement();
            this.context.domElement?.prepend(this._videoElement);
            // hide it because otherwise it would overlay the website with default css
            this.updateVideoElementStyles();
        }
        if (typeof src === "string") {
            this._videoElement.src = src;
            const str = this._videoElement["captureStream"]?.call(this._videoElement);
            this.clip = str;
        }
        else
            this._videoElement.srcObject = src;


        if (!this._videoTexture)
            this._videoTexture = new THREE.VideoTexture(this._videoElement);
        this._videoTexture.flipY = false;
        this._videoTexture.encoding = THREE.sRGBEncoding;
        this.handleBeginPlaying(playAutomatically);
        if(debug)
            console.log(this);
    }

    updateAspect() {
        if (this.aspectMode === AspectMode.None) return;
        this.startCoroutine(this.updateAspectImpl());
    }

    private _overlay: VideoOverlay | null = null;

    get screenspace(): boolean {
        return this._overlay?.enabled ?? false;
    }

    set screenspace(val: boolean) {
        if (val) {
            if (!this._videoTexture) return;
            if (!this._overlay) this._overlay = new VideoOverlay(this.context);
            this._overlay.add(this._videoTexture);
        }
        else this._overlay?.remove(this._videoTexture);
        if (this._overlay) this._overlay.enabled = val;
    }

    private _targetObjects: Array<Object3D>;

    private createVideoElement(): HTMLVideoElement {
        const video = document.createElement("video") as HTMLVideoElement;
        if (this._crossOrigin)
            video.setAttribute("crossorigin", this._crossOrigin);
        if (debug) console.log("create video elment", video);
        return video;
    }

    private handleBeginPlaying(playAutomatically: boolean) {
        if (!this.enabled) return;
        if (!this._videoElement) return;

        this._targetObjects.length = 0;

        let target: Object3D | undefined = this.gameObject;

        switch (this.renderMode) {
            case VideoRenderMode.MaterialOverride:
                target = this.targetMaterialRenderer?.gameObject;
                if (!target) target = GameObject.getComponent(this.gameObject, Renderer)?.gameObject;
                break;
            case VideoRenderMode.RenderTexture:
                console.error("VideoPlayer renderTexture not implemented yet. Please use material override instead");
                return;
        }

        if (!target) {
            console.error("Missing target for video material renderer", this.name, VideoRenderMode[this.renderMode!], this);
            return;
        }
        const mat = target["material"];
        if (mat) {
            this._targetObjects.push(target);

            if (mat !== this.videoMaterial) {
                this.videoMaterial = mat.clone();
                target["material"] = this.videoMaterial;
            }

            if (!this.targetMaterialProperty) {
                (this.videoMaterial as any).map = this._videoTexture;
            }
            else {
                switch (this.targetMaterialProperty) {
                    default:
                        (this.videoMaterial as any).map = this._videoTexture;
                        break;
                    // doesnt render:
                    // case "emissiveTexture":
                    //     console.log(this.videoMaterial);
                    //     // (this.videoMaterial as any).map = this.videoTexture;
                    //     (this.videoMaterial as any).emissive?.set(1,1,1);// = this.videoTexture;
                    //     (this.videoMaterial as any).emissiveMap = this.videoTexture;
                    //     break;
                }
            }
        }
        else {
            console.warn("Can not play video, no material found, this might be a multimaterial case which is not supported yet");
            return;
        }
        this.updateVideoElementSettings();
        this.updateVideoElementStyles();
        if (playAutomatically)
            this.play();
    }

    private updateVideoElementSettings() {
        if (!this._videoElement) return;
        this._videoElement.loop = this._isLooping;
        this._videoElement.currentTime = this.currentTime;
        this._videoElement.playbackRate = this._playbackSpeed;
        // dont open in fullscreen on ios
        this._videoElement.playsInline = true;
        this._videoElement.muted = !this._receivedInput && this.audioOutputMode !== VideoAudioOutputMode.None;
        if (this.playOnAwake || this.playOnEnable)
            this._videoElement.autoplay = true;
    }

    private updateVideoElementStyles() {
        if (!this._videoElement) return;
        // set style here so preview frame is rendered
        // set display and selectable because otherwise is interfers with input/focus e.g. breaks orbit control
        this._videoElement.style.userSelect = "none";
        this._videoElement.style.visibility = "hidden";
        this._videoElement.style.display = "none";
        this.updateAspect();
    }




    private _updateAspectRoutineId: number = -1;
    private *updateAspectImpl() {
        const id = ++this._updateAspectRoutineId;
        const lastAspect: number | undefined = undefined;
        const stream = this.clip;
        while (id === this._updateAspectRoutineId && this.aspectMode !== AspectMode.None && this.clip && stream === this.clip && this._isPlaying) {
            if (!stream || typeof stream === "string") {
                return;
            }
            let aspect: number | undefined = undefined;
            for (const track of stream.getVideoTracks()) {
                const settings = track.getSettings();
                if (settings && settings.width && settings.height) {
                    aspect = settings.width / settings.height;
                    break;
                }
                // on firefox capture canvas stream works but looks like 
                // the canvas stream track doesnt contain settings?!!?
                else {
                    aspect = this.context.renderer.domElement.clientWidth / this.context.renderer.domElement.clientHeight;
                }
            }
            if (aspect === undefined) {
                for (let i = 0; i < 10; i++)
                    yield;
                if (!this.isPlaying) break;
                continue;
            }
            if (lastAspect === aspect) {
                yield;
                continue;
            }
            for (const obj of this._targetObjects) {
                let worldAspect = 1;
                if (obj.parent) {
                    const parentScale = getWorldScale(obj.parent);
                    worldAspect = parentScale.x / parentScale.y;
                }
                switch (this.aspectMode) {
                    case AspectMode.AdjustHeight:
                        obj.scale.y = 1 / aspect * obj.scale.x * worldAspect;
                        break;
                    case AspectMode.AdjustWidth:
                        obj.scale.x = aspect * obj.scale.y * worldAspect;
                        break;
                }
            }
            for (let i = 0; i < 3; i++)
                yield;
        }
    }
}


class VideoOverlay {

    readonly context: Context;

    constructor(context: Context) {
        this.context = context;
        this._input = new VideoOverlayInput(this);
    }

    get enabled() {
        return this._isInScreenspaceMode;
    }

    set enabled(val: boolean) {
        if (val) this.start();
        else this.stop();
    }


    add(video: VideoTexture) {
        if (this._videos.indexOf(video) === -1) {
            this._videos.push(video);
        }
    }

    remove(video: VideoTexture | null | undefined) {
        if (!video) return;
        const index = this._videos.indexOf(video);
        if (index >= 0) {
            this._videos.splice(index, 1);
        }
    }

    start() {
        if (this._isInScreenspaceMode) return;
        if (this._videos.length < 0) return;
        const texture = this._videos[this._videos.length - 1];
        if (!texture) return;

        this._isInScreenspaceMode = true;
        if (!this._screenspaceModeQuad) {
            this._screenspaceModeQuad = ObjectUtils.createPrimitive(PrimitiveType.Quad, {
                material: new ScreenspaceTexture(texture)
            });
            if (!this._screenspaceModeQuad) return;
            this._screenspaceModeQuad.geometry.scale(2, 2, 2);
        }
        
        const quad = this._screenspaceModeQuad;
        this.context.scene.add(quad);
        this.updateScreenspaceMaterialUniforms();

        const mat = quad.material as ScreenspaceTexture;
        mat?.reset();

        this._input?.enable(mat);
    }

    stop() {
        this._isInScreenspaceMode = false;
        if (this._screenspaceModeQuad) {
            this._input?.disable();
            this._screenspaceModeQuad.removeFromParent();
        }
    }

    updateScreenspaceMaterialUniforms() {
        const mat = this._screenspaceModeQuad?.material as ScreenspaceTexture;
        if (!mat) return;
        // mat.videoAspect = this.videoTexture?.image?.width / this.videoTexture?.image?.height;
        mat.screenAspect = this.context.domElement.clientWidth / this.context.domElement.clientHeight;
    }

    private _videos: VideoTexture[] = [];
    private _screenspaceModeQuad: Mesh | undefined;
    private _isInScreenspaceMode: boolean = false;
    private _input: VideoOverlayInput;
}

class VideoOverlayInput {

    private _onResizeScreenFn?: () => void;
    private _onKeyUpFn?: (e: KeyboardEvent) => void;
    private _onMouseWheelFn?: (e: WheelEvent) => void;

    private readonly context: Context;
    private readonly overlay: VideoOverlay;

    constructor(overlay: VideoOverlay) {
        this.overlay = overlay;
        this.context = overlay.context;
    }

    private _material?: ScreenspaceTexture;

    enable(mat: ScreenspaceTexture) {
        this._material = mat;

        window.addEventListener("resize", this._onResizeScreenFn = () => {
            this.overlay.updateScreenspaceMaterialUniforms();
        });
        window.addEventListener("keyup", this._onKeyUpFn = (args) => {
            if (args.key === "Escape")
                this.overlay.stop();
        });

        window.addEventListener("wheel", this._onMouseWheelFn = (args) => {
            if (this.overlay.enabled) {
                mat.zoom += args.deltaY * .0005;
                args.preventDefault();
            }
        }, { passive: false });


        const delta: Vector2 = new Vector2();

        window.addEventListener("mousemove", (args: MouseEvent) => {
            if (this.overlay.enabled && this.context.input.getPointerPressed(0)) {
                const normalizedMovement = new Vector2(args.movementX, args.movementY);
                normalizedMovement.x /= this.context.domElement.clientWidth;
                normalizedMovement.y /= this.context.domElement.clientHeight;
                delta.set(normalizedMovement.x, normalizedMovement.y);
                delta.multiplyScalar(mat.zoom / -this.context.time.deltaTime * .01);
                mat.offset = mat.offset.add(delta);
            }
        });

        window.addEventListener("pointermove", (args: PointerEvent) => {
            if (this.overlay.enabled && this.context.input.getPointerPressed(0)) {
                const count = this.context.input.getTouchesPressedCount();
                if (count === 1) {
                    delta.set(args.movementX, args.movementY);
                    delta.multiplyScalar(mat.zoom * -this.context.time.deltaTime * .05);
                    mat.offset = mat.offset.add(delta);
                }
            }
        });

        let lastTouchStartTime = 0;
        window.addEventListener("touchstart", e => {
            if (e.touches.length < 2) {
                if (this.context.time.time - lastTouchStartTime < .3) {
                    this.overlay.stop();
                }
                lastTouchStartTime = this.context.time.time;
                return;
            }
            this._isPinching = true;
            this._lastPinch = 0;
        })
        window.addEventListener("touchmove", e => {
            if (!this._isPinching || !this._material) return;
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const dx = touch1.clientX - touch2.clientX;
            const dy = touch1.clientY - touch2.clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (this._lastPinch !== 0) {
                const delta = distance - this._lastPinch;
                this._material.zoom -= delta * .004;
            }
            this._lastPinch = distance;
        })
        window.addEventListener("touchend", () => {
            this._isPinching = false;
        })
    }

    private _isPinching: boolean = false;
    private _lastPinch = 0;

    disable() {

        if (this._onResizeScreenFn) {
            window.removeEventListener("resize", this._onResizeScreenFn);
            this._onResizeScreenFn = undefined;
        }
        if (this._onKeyUpFn) {
            window.removeEventListener("keyup", this._onKeyUpFn);
            this._onKeyUpFn = undefined;
        }
        if (this._onMouseWheelFn) {
            window.removeEventListener("wheel", this._onMouseWheelFn);
            this._onMouseWheelFn = undefined;
        }
    }

}

class ScreenspaceTexture extends ShaderMaterial {

    set screenAspect(val: number) {
        this.uniforms["screenAspect"].value = val;
        this.needsUpdate = true;
    }

    set offset(vec: Vector2 | { x: number, y: number }) {
        const val = this.uniforms["offsetScale"].value;
        val.x = vec.x;
        val.y = vec.y;
        // console.log(val);
        this.uniforms["offsetScale"].value = val;
        this.needsUpdate = true;
    }

    private readonly _offset: Vector2 = new Vector2();
    get offset(): Vector2 {
        const val = this.uniforms["offsetScale"].value;
        this._offset.set(val.x, val.y);
        return this._offset;
    }

    set zoom(val: number) {
        const zoom = this.uniforms["offsetScale"].value;
        if (val < .001) val = .001;
        zoom.z = val;
        // zoom.z = this.maxZoom - val;
        // zoom.z /= this.maxZoom;
        this.needsUpdate = true;
    }

    get zoom(): number {
        return this.uniforms["offsetScale"].value.z;// * this.maxZoom;
    }

    reset() {
        this.offset = this.offset.set(0, 0);
        this.zoom = 1;
        this.needsUpdate = true;
    }

    // maxZoom : number = 10

    constructor(tex: Texture) {
        super();

        this.uniforms = {
            map: { value: tex },
            screenAspect: { value: 1 },
            offsetScale: { value: new Vector4(0, 0, 1, 1) }
        };

        this.vertexShader = `
        uniform sampler2D map;
        uniform float screenAspect;
        uniform vec4 offsetScale;
        varying vec2 vUv;

        void main() {

            gl_Position = vec4( position , 1.0 );
            vUv = uv;
            vUv.y = 1. - vUv.y;

            // fit into screen
            ivec2 res = textureSize(map, 0);
            float videoAspect = float(res.x) / float(res.y);
            float aspect = videoAspect / screenAspect;
            if(aspect >= 1.0) 
            {
                vUv.y = vUv.y * aspect;
                float offset = (1. - aspect) * .5;
                vUv.y = vUv.y + offset;
            }
            else
            {
                vUv.x = vUv.x / aspect;
                float offset = (1. - 1. / aspect) * .5;
                vUv.x = vUv.x + offset;
            }

            vUv.x -= .5;
            vUv.y -= .5;

            vUv.x *= offsetScale.z;
            vUv.y *= offsetScale.z;
            vUv.x += offsetScale.x;
            vUv.y += offsetScale.y;

            vUv.x += .5;
            vUv.y += .5;
        }

        `
        this.fragmentShader = `
        uniform sampler2D map;
        varying vec2 vUv;
        void main() {
            if(vUv.x < 0. || vUv.x > 1. || vUv.y < 0. || vUv.y > 1.)
                gl_FragColor = vec4(0., 0., 0., 1.);
            else
                gl_FragColor = texture2D(map, vUv);
        }
        `
    }
}
