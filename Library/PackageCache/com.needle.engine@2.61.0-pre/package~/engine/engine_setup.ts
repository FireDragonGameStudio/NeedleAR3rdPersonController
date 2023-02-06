import { Camera, DepthTexture, PerspectiveCamera, WebGLRenderer, WebGLRenderTarget } from 'three'
import * as THREE from 'three'
import { Input } from './engine_input';
import { Physics } from './engine_physics';
import { Time } from './engine_time';
import { NetworkConnection } from './engine_networking';

import * as looputils from './engine_mainloop_utils';
import * as utils from "./engine_utils";

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';

import { AssetDatabase } from './engine_assetdatabase';

import { logHierarchy } from './engine_three_utils';

import * as Stats from 'three/examples/jsm/libs/stats.module';
import { RendererData } from './engine_rendererdata';
import { Addressables } from './engine_addressables';
import { Application } from './engine_application';
import { LightDataRegistry, ILightDataRegistry } from './engine_lightdata';
import { PlayerViewManager } from './engine_playerview';

import { CoroutineData, ICamera, IComponent, IContext, ILight } from "./engine_types"
import { destroy, foreachComponent } from './engine_gameobject';
import { ContextEvent, ContextRegistry } from './engine_context_registry';
// import { createCameraWithOrbitControl } from '../engine-components/CameraUtils';


const debug = utils.getParam("debugSetup");
const stats = utils.getParam("stats");
const debugActive = utils.getParam("debugactive");


// this is where functions that setup unity scenes will be pushed into
// those will be accessed from our custom html element to load them into their context
export const build_scene_functions: { [name: string]: (context: Context) => Promise<void> } = {};

export declare class LoadingProgressArgs {
	name: string;
	progress: ProgressEvent;
	index: number;
	count: number;
}
export declare class LoadingOptions {
	progress: (args: LoadingProgressArgs) => void;
}

export class ContextArgs {
	name: string | undefined | null;
	alias: string | undefined | null = undefined;
	domElement: HTMLElement | null;
	renderer?: THREE.WebGLRenderer = undefined;
	hash?: string;

	constructor(domElement: HTMLElement | null) {
		this.domElement = domElement ?? document.body;
	}
}

export enum FrameEvent {
	EarlyUpdate = 0,
	Update = 1,
	LateUpdate = 2,
	OnBeforeRender = 3,
	OnAfterRender = 4,
	PrePhysicsStep = 9,
	PostPhysicsStep = 10,
}

export enum XRSessionMode {
	ImmersiveVR = "immersive-vr",
	ImmersiveAR = "immersive-ar",
}

export declare type OnBeforeRenderCallback = (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, geometry: THREE.BufferGeometry, material: THREE.Material, group: THREE.Group) => void


export function registerComponent(script: IComponent, context?: Context) {
	if (!script) return;
	const new_scripts = context?.new_scripts ?? Context.Current.new_scripts;
	if (!new_scripts.includes(script)) {
		new_scripts.push(script);
	}
}

export class Context implements IContext {

	private static _current: Context;

	static get Current(): Context {
		return this._current;
	}

	static set Current(context: Context) {
		ContextRegistry.Current = context;
		this._current = context;
	}

	name: string;
	alias: string | undefined | null;
	isManagedExternally: boolean = false;
	isPaused: boolean = false;
	runInBackground: boolean = false;

	/** used to append to loaded assets */
	hash?: string;

	domElement: HTMLElement;
	get resolutionScaleFactor() { return this._resolutionScaleFactor; }
	/** use to scale the resolution up or down of the renderer. default is 1 */
	set resolutionScaleFactor(val: number) {
		if (val === this._resolutionScaleFactor) return;
		if (typeof val !== "number") return;
		if (val <= 0) {
			console.error("Invalid resolution scale factor", val);
			return;
		}
		this._resolutionScaleFactor = val;
		this.updateSize();
	}
	private _resolutionScaleFactor: number = 1;

	// domElement.clientLeft etc doesnt return absolute position
	private _boundingClientRectFrame: number = -1;
	private _boundingClientRect: DOMRect | null = null;
	private _domX; private _domY;
	private calculateBoundingClientRect() {
		// workaround for mozilla webXR viewer
		if (this.isInAR) {
			this._domX = 0;
			this._domY = 0;
			return;
		}
		if (this._boundingClientRectFrame === this.time.frame) return;
		this._boundingClientRectFrame = this.time.frame;
		this._boundingClientRect = this.domElement.getBoundingClientRect();
		this._domX = this._boundingClientRect.x;
		this._domY = this._boundingClientRect.y;
	}

	get domWidth(): number {
		// for mozilla XR
		if (this.isInAR) return window.innerWidth;
		return this.domElement.clientWidth;
	}
	get domHeight(): number {
		// for mozilla XR
		if (this.isInAR) return window.innerHeight;
		return this.domElement.clientHeight;
	}
	get domX(): number {
		this.calculateBoundingClientRect();
		return this._domX;
	}
	get domY(): number {
		this.calculateBoundingClientRect();
		return this._domY;
	}
	get isInXR() { return this.renderer.xr?.isPresenting || false; }
	xrSessionMode: XRSessionMode | undefined = undefined;
	get isInVR() { return this.xrSessionMode === XRSessionMode.ImmersiveVR; }
	get isInAR() { return this.xrSessionMode === XRSessionMode.ImmersiveAR; }
	get xrSession() { return this.renderer.xr?.getSession(); }
	get arOverlayElement(): HTMLElement {
		const el = this.domElement as any;
		if (typeof el.getAROverlayContainer === "function")
			return el.getAROverlayContainer();
		return this.domElement;
	}
	/** Current event of the update cycle */
	get currentFrameEvent(): FrameEvent {
		return this._currentFrameEvent;
	}
	private _currentFrameEvent: FrameEvent = -1;

	scene: THREE.Scene;
	renderer: THREE.WebGLRenderer;
	composer: EffectComposer | null = null;

	// all scripts
	scripts: IComponent[] = [];
	scripts_pausedChanged: IComponent[] = [];
	// scripts with update event
	scripts_earlyUpdate: IComponent[] = [];
	scripts_update: IComponent[] = [];
	scripts_lateUpdate: IComponent[] = [];
	scripts_onBeforeRender: IComponent[] = [];
	scripts_onAfterRender: IComponent[] = [];
	scripts_WithCorroutines: IComponent[] = [];
	coroutines: { [FrameEvent: number]: Array<CoroutineData> } = {}

	get mainCamera(): THREE.Camera | null {
		if (this.mainCameraComponent) {
			const cam = this.mainCameraComponent as ICamera;
			if (!cam.cam)
				cam.buildCamera();
			return cam.cam;
		}
		return null;
	}
	mainCameraComponent: ICamera | undefined;

	post_setup_callbacks: Function[] = [];
	pre_update_callbacks: Function[] = [];
	pre_render_callbacks: Function[] = [];
	post_render_callbacks: Function[] = [];

	new_scripts: IComponent[] = [];
	new_script_start: IComponent[] = [];
	new_scripts_pre_setup_callbacks: Function[] = [];
	new_scripts_post_setup_callbacks: Function[] = [];

	application: Application;
	time: Time;
	input: Input;
	physics: Physics;
	connection: NetworkConnection;
	/** 
	 * @deprecated AssetDataBase is deprecated
	 */
	assets: AssetDatabase;
	mainLight: ILight | null = null;
	rendererData: RendererData;
	addressables: Addressables;
	lightmaps: ILightDataRegistry;
	players: PlayerViewManager;

	private _sizeChanged: boolean = false;
	private _isCreated: boolean = false;
	private _isVisible: boolean = false;

	private _stats: Stats.default | null = stats ? Stats.default() : null;

	constructor(args: ContextArgs | undefined) {
		this.name = args?.name || "";
		this.alias = args?.alias;
		this.domElement = args?.domElement || document.body;
		this.hash = args?.hash;
		if (args?.renderer) {
			this.renderer = args.renderer;
			this.isManagedExternally = true;
		}
		else {
			const useComposer = utils.getParam("postfx");
			this.renderer = new WebGLRenderer({ antialias: true, });

			// some tonemapping other than "NONE" is required for adjusting exposure with EXR environments
			this.renderer.toneMappingExposure = 1; // range [0...inf] instead of the usual -15..15
			this.renderer.toneMapping = THREE.NoToneMapping; // could also set to LinearToneMapping, ACESFilmicToneMapping

			this.renderer.setClearColor(new THREE.Color('lightgrey'), 0);
			// @ts-ignore
			this.renderer.antialias = true;
			// @ts-ignore
			this.renderer.alpha = false;
			this.renderer.shadowMap.enabled = true;
			this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
			this.renderer.setSize(this.domWidth, this.domHeight);
			this.renderer.outputEncoding = THREE.sRGBEncoding;
			this.renderer.physicallyCorrectLights = true;

			this.composer = useComposer ? new EffectComposer(this.renderer) : null;
		}

		this.scene = new THREE.Scene();

		ContextRegistry.register(this);

		this.application = new Application(this);
		this.time = new Time();
		this.input = new Input(this);
		this.physics = new Physics(this);
		this.connection = new NetworkConnection(this);
		this.assets = new AssetDatabase();
		this.rendererData = new RendererData(this);
		this.addressables = new Addressables(this);
		this.lightmaps = new LightDataRegistry(this);
		this.players = new PlayerViewManager(this);

		const resizeCallback = () => this._sizeChanged = true;
		window.addEventListener('resize', resizeCallback);
		this._disposeCallbacks.push(() => window.removeEventListener('resize', resizeCallback));

		const resizeObserver = new ResizeObserver(_ => this._sizeChanged = true);
		resizeObserver.observe(this.domElement);
		this._disposeCallbacks.push(() => resizeObserver.disconnect());

		const intersectionObserver = new IntersectionObserver(entries => { this._isVisible = entries[0].isIntersecting; });
		intersectionObserver.observe(this.domElement);
		this._disposeCallbacks.push(() => intersectionObserver.disconnect());
	}

	private _disposeCallbacks: Function[] = [];

	// private _requestSizeUpdate : boolean = false;

	updateSize() {
		if (!this.isManagedExternally && !this.renderer.xr.isPresenting) {
			this._sizeChanged = false;
			const scaleFactor = this.resolutionScaleFactor;
			const width = this.domWidth * scaleFactor;
			const height = this.domHeight * scaleFactor;
			const camera = this.mainCamera as PerspectiveCamera;
			this.updateAspect(camera);
			this.renderer.setSize(width, height);
			this.renderer.setPixelRatio(window.devicePixelRatio);
			// avoid setting pixel values here since this can cause pingpong updates
			// e.g. when system scale is set to 125%
			// https://github.com/needle-tools/needle-engine-support/issues/69
			this.renderer.domElement.style.width = "100%";
			this.renderer.domElement.style.height = "100%";
			if (this.composer) {
				this.composer.setSize?.call(this.composer, width, height);
				this.composer.setPixelRatio?.call(this.composer, window.devicePixelRatio);
			}
		}
	}

	updateAspect(camera: THREE.PerspectiveCamera, width?: number, height?: number) {
		if (!camera) return;
		if (width === undefined)
			width = this.domWidth;
		if (height === undefined)
			height = this.domHeight;
		const pa = camera.aspect;
		camera.aspect = width / height;
		if (pa !== camera.aspect)
			camera.updateProjectionMatrix();
	}

	onCreate(buildScene?: (context: Context, loadingOptions?: LoadingOptions) => Promise<void>, opts?: LoadingOptions) {
		if (this._isCreated) {
			console.warn("Context already created");
			return null;
		}
		this._isCreated = true;
		return this.internalOnCreate(buildScene, opts);
	}

	onDestroy() {
		if (!this._isCreated) return;
		this._isCreated = false;
		destroy(this.scene, true);
		this.renderer?.setAnimationLoop(null);
		if (!this.isManagedExternally) {
			this.renderer?.dispose();
		}
		for (const cb of this._disposeCallbacks) {
			try {
				cb();
			}
			catch (e) {
				console.error("Error in on dispose callback:", e, cb);
			}
		}
		if (this.domElement?.parentElement) {
			this.domElement.parentElement.removeChild(this.domElement);
		}

		ContextRegistry.dispatchCallback(ContextEvent.ContextDestroyed, this);
		ContextRegistry.unregister(this);
	}

	registerCoroutineUpdate(script: IComponent, coroutine: Generator, evt: FrameEvent): Generator {
		if (!this.coroutines[evt]) this.coroutines[evt] = [];
		this.coroutines[evt].push({ comp: script, main: coroutine });
		return coroutine;
	}

	unregisterCoroutineUpdate(coroutine: Generator, evt: FrameEvent): void {
		if (!this.coroutines[evt]) return;
		const idx = this.coroutines[evt].findIndex(c => c.main === coroutine);
		if (idx >= 0) this.coroutines[evt].splice(idx, 1);
	}

	stopAllCoroutinesFrom(script: IComponent) {
		for (const evt in this.coroutines) {
			const rout: CoroutineData[] = this.coroutines[evt];
			for (let i = rout.length - 1; i >= 0; i--) {
				const r = rout[i];
				if (r.comp === script) {
					rout.splice(i, 1);
				}
			}
		}
	}

	private _cameraStack: ICamera[] = [];

	setCurrentCamera(cam: ICamera) {
		if (!cam) return;
		if (!cam.cam) cam.buildCamera(); // < to build camera
		if (!cam.cam) {
			console.warn("Camera component is missing camera", cam)
			return;
		}
		const index = this._cameraStack.indexOf(cam);
		if (index >= 0) this._cameraStack.splice(index, 1);
		this._cameraStack.push(cam);
		this.mainCameraComponent = cam;
		const camera = cam.cam as THREE.PerspectiveCamera;
		if (camera.isPerspectiveCamera)
			this.updateAspect(camera);
		(this.mainCameraComponent as ICamera)?.applyClearFlagsIfIsActiveCamera();
	}

	removeCamera(cam?: ICamera | null) {
		if (!cam) return;
		const index = this._cameraStack.indexOf(cam);
		if (index >= 0) this._cameraStack.splice(index, 1);

		if (this.mainCameraComponent === cam) {
			this.mainCameraComponent = undefined;

			if (this._cameraStack.length > 0) {
				const last = this._cameraStack[this._cameraStack.length - 1];
				this.setCurrentCamera(last);
			}
		}
	}

	private _onBeforeRenderListeners: { [key: string]: OnBeforeRenderCallback[] } = {};

	/** use this to subscribe to onBeforeRender events on threejs objects */
	addBeforeRenderListener(target: THREE.Object3D, callback: OnBeforeRenderCallback) {
		if (!this._onBeforeRenderListeners[target.uuid]) {
			this._onBeforeRenderListeners[target.uuid] = [];
			const onBeforeRenderCallback = (renderer, scene, camera, geometry, material, group) => {
				const arr = this._onBeforeRenderListeners[target.uuid];
				if (!arr) return;
				for (let i = 0; i < arr.length; i++) {
					const fn = arr[i];
					fn(renderer, scene, camera, geometry, material, group);
				}
			}
			target.onBeforeRender = onBeforeRenderCallback as any;
		}
		this._onBeforeRenderListeners[target.uuid].push(callback);
	}

	removeBeforeRenderListener(target: THREE.Object3D, callback: OnBeforeRenderCallback) {
		if (this._onBeforeRenderListeners[target.uuid]) {
			const arr = this._onBeforeRenderListeners[target.uuid];
			const idx = arr.indexOf(callback);
			if (idx >= 0) arr.splice(idx, 1);
		}
	}

	private _requireDepthTexture: boolean = false;
	private _requireColorTexture: boolean = false;
	private _renderTarget?: WebGLRenderTarget;
	private _isRendering: boolean = false;

	get isRendering() { return this._isRendering; }

	setRequireDepth(val: boolean) {
		this._requireDepthTexture = val;
	}

	setRequireColor(val: boolean) {
		this._requireColorTexture = val;
	}

	get depthTexture(): THREE.DepthTexture | null {
		return this._renderTarget?.depthTexture || null;
	}

	get opaqueColorTexture(): THREE.Texture | null {
		return this._renderTarget?.texture || null;
	}

	/** returns true if the dom element is visible on screen */
	get isVisibleToUser() {
		if (this.isInXR) return true;
		if (!this._isVisible) return false;
		const style = getComputedStyle(this.domElement);
		return style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
	}


	private async internalOnCreate(buildScene?: (context: Context, opts?: LoadingOptions) => Promise<void>, opts?: LoadingOptions) {

		// TODO: we could configure if we need physics
		await this.physics.createWorld();

		// load and create scene
		let prepare_succeeded = true;
		try {
			Context.Current = this;
			if (buildScene)
				await buildScene(this, opts);
		}
		catch (err) {
			console.error(err);
			prepare_succeeded = false;
		}
		if (!prepare_succeeded) return;

		// console.log(prepare_succeeded);

		if (!this.isManagedExternally)
			this.domElement.prepend(this.renderer.domElement);

		Context._current = this;
		ContextRegistry.dispatchCallback(ContextEvent.ContextCreated, this);

		// Setup
		Context._current = this;
		for (let i = 0; i < this.new_scripts.length; i++) {
			const script = this.new_scripts[i];
			if (script.gameObject !== undefined && script.gameObject !== null) {
				if (script.gameObject.userData === undefined) script.gameObject.userData = {};
				if (script.gameObject.userData.components === undefined) script.gameObject.userData.components = [];
				const arr = script.gameObject.userData.components;
				if (!arr.includes(script)) arr.push(script);
			}
			// if (script.gameObject && !this.raycastTargets.includes(script.gameObject)) {
			// 	this.raycastTargets.push(script.gameObject);
			// }
		}

		// const context = new SerializationContext(this.scene);
		// for (let i = 0; i < this.new_scripts.length; i++) {
		// 	const script = this.new_scripts[i];
		// 	const ser = script as unknown as ISerializable;
		// 	if (ser.$serializedTypes === undefined) continue;
		// 	context.context = this;
		// 	context.object = script.gameObject;
		// 	deserializeObject(ser, script, context);
		// }

		// resolve post setup callbacks (things that rely on threejs objects having references to components)
		if (this.post_setup_callbacks) {
			for (let i = 0; i < this.post_setup_callbacks.length; i++) {
				Context._current = this;
				await this.post_setup_callbacks[i](this);
			}
		}

		if (!this.mainCamera) {
			Context._current = this;
			let camera: ICamera | null = null;
			foreachComponent(this.scene, comp => {
				const cam = comp as ICamera;
				if (cam?.isCamera) {
					looputils.updateActiveInHierarchyWithoutEventCall(cam.gameObject);
					if (!cam.activeAndEnabled) return undefined;
					if (cam.tag === "MainCamera") {
						camera = cam;
						return true;
					}
					else camera = cam;
				}
				return undefined;
			});
			if (camera) {
				this.setCurrentCamera(camera);
			}
			else {
				ContextRegistry.dispatchCallback(ContextEvent.MissingCamera, this);
				if (!this.mainCamera)
					console.error("MISSING camera", this);
			}
		}

		Context._current = this;
		looputils.processNewScripts(this);

		// const mainCam = this.mainCameraComponent as Camera;
		// if (mainCam) {
		// 	mainCam.applyClearFlagsIfIsActiveCamera();
		// }

		if (!this.isManagedExternally && this.composer && this.mainCamera) {
			const renderPass = new RenderPass(this.scene, this.mainCamera);
			this.renderer.setSize(this.domWidth, this.domHeight);
			this.composer.addPass(renderPass);
			this.composer.setSize(this.domWidth, this.domHeight);
		}

		this._sizeChanged = true;

		if (this._stats) {
			this._stats.showPanel(1);
			this.domElement.appendChild(this._stats.dom);
		}

		this.renderer.setAnimationLoop(this.render.bind(this));

		if (debug)
			logHierarchy(this.scene, true);
	}

	private render(_, frame) {

		this._currentFrameEvent = -1;

		if (this.onHandlePaused()) return;

		this._stats?.begin();

		Context._current = this;
		this.time.update();

		looputils.processNewScripts(this);
		looputils.updateIsActive(this.scene);
		looputils.processStart(this);

		while (this._cameraStack.length > 0 && (!this.mainCameraComponent || this.mainCameraComponent.destroyed)) {
			this._cameraStack.splice(this._cameraStack.length - 1, 1);
			const last = this._cameraStack[this._cameraStack.length - 1];
			this.setCurrentCamera(last);
		}

		if (this.pre_update_callbacks) {
			for (const i in this.pre_update_callbacks) {
				this.pre_update_callbacks[i]();
			}
		}

		this._currentFrameEvent = FrameEvent.EarlyUpdate;

		for (let i = 0; i < this.scripts_earlyUpdate.length; i++) {
			const script = this.scripts_earlyUpdate[i];
			if (!script.activeAndEnabled) continue;
			if (script.earlyUpdate !== undefined) {
				Context._current = this;
				script.earlyUpdate();
			}
		}
		this.executeCoroutines(FrameEvent.EarlyUpdate);
		if (this.onHandlePaused()) return;

		this._currentFrameEvent = FrameEvent.Update;

		for (let i = 0; i < this.scripts_update.length; i++) {
			const script = this.scripts_update[i];
			if (!script.activeAndEnabled) continue;
			if (script.update !== undefined) {
				Context._current = this;
				script.update();
			}
		}
		this.executeCoroutines(FrameEvent.Update);
		if (this.onHandlePaused()) return;

		this._currentFrameEvent = FrameEvent.LateUpdate;

		for (let i = 0; i < this.scripts_lateUpdate.length; i++) {
			const script = this.scripts_lateUpdate[i];
			if (!script.activeAndEnabled) continue;
			if (script.lateUpdate !== undefined) {
				Context._current = this;
				script.lateUpdate();
			}
		}

		// this.mainLight = null;
		this.executeCoroutines(FrameEvent.LateUpdate);
		if (this.onHandlePaused()) return;

		const physicsSteps = 1;
		const dt = this.time.deltaTime / physicsSteps;
		for (let i = 0; i < physicsSteps; i++) {
			this._currentFrameEvent = FrameEvent.PrePhysicsStep;
			this.executeCoroutines(FrameEvent.PrePhysicsStep);
			this.physics.step(dt);
			this._currentFrameEvent = FrameEvent.PostPhysicsStep;
			this.executeCoroutines(FrameEvent.PostPhysicsStep);
		}
		this.physics.postStep();
		if (this.onHandlePaused()) return;

		if (this.isVisibleToUser) {

			this._currentFrameEvent = FrameEvent.OnBeforeRender;

			// should we move these callbacks in the regular three onBeforeRender events?
			for (let i = 0; i < this.scripts_onBeforeRender.length; i++) {
				const script = this.scripts_onBeforeRender[i];
				if (!script.activeAndEnabled) continue;
				// if(script.isActiveAndEnabled === false) continue;
				if (script.onBeforeRender !== undefined) {
					Context._current = this;
					script.onBeforeRender(frame);
				}
			}

			this.executeCoroutines(FrameEvent.OnBeforeRender);

			if (this._sizeChanged)
				this.updateSize();

			if (this.pre_render_callbacks) {
				for (const i in this.pre_render_callbacks) {
					this.pre_render_callbacks[i]();
				}
			}


			if (!this.isManagedExternally) {
				looputils.runPrewarm(this);
				this._currentFrameEvent = -10;
				this.renderNow();
				this._currentFrameEvent = FrameEvent.OnAfterRender;
			}


			for (let i = 0; i < this.scripts_onAfterRender.length; i++) {
				const script = this.scripts_onAfterRender[i];
				if (!script.activeAndEnabled) continue;
				if (script.onAfterRender !== undefined) {
					Context._current = this;
					script.onAfterRender();
				}
			}

			this.executeCoroutines(FrameEvent.OnAfterRender);

			if (this.post_render_callbacks) {
				for (const i in this.post_render_callbacks) {
					this.post_render_callbacks[i]();
				}
			}
		}

		this._currentFrameEvent = -1;

		this.connection.sendBufferedMessagesNow();

		this._stats?.end();
	}

	renderNow(camera?: Camera) {
		if (!camera) {
			camera = this.mainCamera as Camera;
			if (!camera) return false;
		}
		this._isRendering = true;
		this.renderRequiredTextures();
		if (this.composer && !this.isInXR) {
			this.composer.render();
		}
		else if (this.mainCamera) {
			this.renderer.render(this.scene, camera);
		}
		this._isRendering = false;
		return true;
	}

	/** returns true if we should return out of the frame loop */
	private _wasPaused: boolean = false;
	private onHandlePaused(): boolean {
		const paused = this.evaluatePaused();
		if (this._wasPaused !== paused) {
			if (debugActive) console.log("Paused?", paused, "context:" + this.alias);
			for (let i = 0; i < this.scripts_pausedChanged.length; i++) {
				const script = this.scripts_pausedChanged[i];
				if (!script.activeAndEnabled) continue;
				if (script.onPausedChanged !== undefined) {
					Context._current = this;
					script.onPausedChanged(paused, this._wasPaused);
				}
			}
		}
		this._wasPaused = paused;
		return paused;
	}

	private evaluatePaused() {
		if (this.isInXR) return false;
		if (this.isPaused) return true;
		// if the element is not visible use the runInBackground flag to determine if we should continue
		if (this.runInBackground) {
			return false;
		}
		return !this.isVisibleToUser;
	}

	private renderRequiredTextures() {
		if (!this.mainCamera) return;
		if (!this._requireDepthTexture && !this._requireColorTexture) return;
		if (!this._renderTarget) {
			this._renderTarget = new THREE.WebGLRenderTarget(this.domWidth, this.domHeight);
			if (this._requireDepthTexture) {
				const dt = new DepthTexture(this.domWidth, this.domHeight);;
				this._renderTarget.depthTexture = dt;
			}
			if (this._requireColorTexture) {
				this._renderTarget.texture = new THREE.Texture();
				this._renderTarget.texture.generateMipmaps = false;
				this._renderTarget.texture.minFilter = THREE.NearestFilter;
				this._renderTarget.texture.magFilter = THREE.NearestFilter;
				this._renderTarget.texture.format = THREE.RGBAFormat;
			}
		}
		const rt = this._renderTarget;
		if (rt.texture) {
			rt.texture.encoding = this.renderer.outputEncoding;
		}
		const prevTarget = this.renderer.getRenderTarget();
		this.renderer.setRenderTarget(rt);
		this.renderer.render(this.scene, this.mainCamera);
		this.renderer.setRenderTarget(prevTarget);
	}

	private executeCoroutines(evt: FrameEvent) {
		if (this.coroutines[evt]) {
			const evts = this.coroutines[evt];
			for (let i = 0; i < evts.length; i++) {
				try {
					const evt = evts[i];
					// TODO we might want to keep coroutines playing even if the component is disabled or inactive
					const remove = !evt.comp || evt.comp.destroyed || !evt.main || evt.comp["enabled"] === false;
					if (remove) {
						evts.splice(i, 1);
						--i;
						continue;
					}
					const iter = evt.chained;
					if (iter && iter.length > 0) {
						const last: Generator = iter[iter.length - 1];
						const res = last.next();
						if (res.done) {
							iter.pop();
						}
						if (isGenerator(res)) {
							if (!evt.chained) evt.chained = [];
							evt.chained.push(res.value);
						}
						if (!res.done) continue;
					}

					const res = evt.main.next();
					if (res.done === true) {
						evts.splice(i, 1);
						--i;
						continue;
					}
					const val = res.value;
					if (isGenerator(val)) {
						// invoke once if its a generator
						// this means e.g. WaitForFrame(1) works and will capture
						// the frame it was created
						const gen = val as Generator;
						const res = gen.next();
						if (res.done) continue;
						if (!evt.chained) evt.chained = [];
						evt.chained.push(val as Generator);
					}
				}
				catch (e) {
					console.error(e);
				}
			}
		}

		function isGenerator(val: any): boolean {
			if (val) {
				if (val.next && val.return) {
					return true;
				}
			}
			return false;
		}
	}

}


// const scene = new THREE.Scene();
// const useComposer = utils.getParam("postfx");
// const renderer = new WebGLRenderer({ antialias: true });
// const composer = useComposer ? new EffectComposer(renderer) : undefined;

// renderer.setClearColor(new THREE.Color('lightgrey'), 0)
// renderer.antialias = true;
// renderer.alpha = false;
// renderer.shadowMap.enabled = true;
// renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// renderer.setSize(window.innerWidth, window.innerHeight);
// renderer.outputEncoding = THREE.sRGBEncoding;
// renderer.physicallyCorrectLights = true;
// document.body.appendChild(renderer.domElement);

// // generation pushes loading requests in this array
// const sceneData: {
//     mainCamera: THREE.Camera | undefined
// } = {
//     preparing: [],
//     resolving: [],
//     scripts: [],
//     raycastTargets: [],
//     mainCamera: undefined,
//     mainCameraComponent: undefined,
// };

// // contains a list of functions to be called after loading is done
// const post_setup_callbacks = [];

// const pre_render_Callbacks = [];
// const post_render_callbacks = [];

// const new_scripts = [];
// const new_scripts_post_setup_callbacks = [];
// const new_scripts_pre_setup_callbacks = [];

// export {
//     scene, renderer, composer,
//     new_scripts,
//     new_scripts_post_setup_callbacks, new_scripts_pre_setup_callbacks,
//     sceneData,
//     post_setup_callbacks,
//     pre_render_Callbacks,
//     post_render_callbacks
// }
