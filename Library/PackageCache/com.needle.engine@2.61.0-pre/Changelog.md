# Changelog
All notable changes to this package will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [2.61.0-pre] - 2023-01-30
- Add: canvas applyRenderSettings
- Add: progressive support for particle system textures

## [2.60.4-pre] - 2023-01-27
- Fix UI prefab instantiate throwing error at runtime
- Change: show warning when unsupported canvas type is selected
- Change: show warning when trying to use webxr features in non-secure context

## [2.60.3-pre] - 2023-01-26
- Fix: camera fov for blender export allowing fieldOfView property to be undefined, where the fov should be handled by the blender exporter completely.

## [2.60.2-pre] - 2023-01-26
- Fix: particle textures being flipped horizontally

## [2.60.1-pre] - 2023-01-25
- Change: export Mathf in `@needle.tools/engine`

## [2.60.0-pre] - 2023-01-25
- Add: Particles support for horizontal and vertical billboards
- Add: Timeline now supports reversed clip (for blender timeline)
- Change: bump gltf pipeline package dependency adding support for global `NEEDLE_TOKTX` environment variable
- Change: timeline clip pos and rot are now optional (for blender timeline)
- Fix: when first loading a gltf pass guidsmap to components (for blender timeline)
- Fix: scrubbing TimelineTrack scrubs audio sources as well now
- Fix: stencils for multimaterial objects

## [2.59.2-pre] - 2023-01-21
- Add: particles basic support for on birth and ondeath subemitter behaviour

## [2.59.1-pre.1] - 2023-01-20
- Fix: issue where click on overlay html element did also trigger events in the underlying engine scene  

## [2.59.1-pre] - 2023-01-20
- Add: SpectatorCam.useKeys to allow users to disable spectator cam keyboard input usage (`f` to send follow request to connected users and `esc` to stop following)
- Change: expose SyncedRoom.RoomPrefix

## [2.59.0-pre] - 2023-01-18
- Add: AssetReference.unload does now dispose materials and mesh geometry
- Add: ``setParamWithoutReload`` now accepts null as paramValue which will remove the query parameter from the url
- Change: timeline does now skip export for muted tracks
- Change: OrbitControls can now use a custom html target when added via script and before enable/awake is being called (e.g. ``const orbit = GameObject.addNewComponent(this.gameObject, OrbitControls, false); orbit.targetElement = myElement``)
- Change: Input start events are now being ignored if a html element is ontop of the canvas
- Fix: use custom element registry to avoid error with `needle-engine element has already been defined`
- Fix: timeline not stopping audio on stop
- Fix: input click event being invoked twice in certain cases
- Fix: ParticleSystem start color from gradient
- Fix: ParticleSystem not properly cleaning up / removing particles in the scene in onDestroy
- Fix: ParticleSystem velocity now respects scale (when mode is set to worldscale)

## [2.58.4-pre] - 2023-01-14
- Update gltf-extensions package dependency

## [2.58.3-pre] - 2023-01-13
- Bump version

## [2.58.2-pre] - 2023-01-12
- Change: use draco and ktx loader from gstatic server by default
- Change: reduce circular dependencies
- Fix: Reflectionprobe selecting wrong probe when multiple probes had the exact same position

## [2.58.1-pre] - 2023-01-09
- Add: Prewarm rendering of newly loaded objects to remove lag/jitter when they become visible for the first time
- Change: renderer now warns when sharedMaterials have missing entries. It then tries to remap those values when accessing them by index (e.g. when another component has a material index serialized and relies on that index to be pointing to the correct object)

## [2.58.0-pre] - 2023-01-09
- Add: EventSystem input events (e.g. IPointerClick) are now invoked for all buttons (e.g. right click)
- Add: Hot reload for components

## [2.57.0-pre] - 2023-01-07
- Remove: Meshline dependency
- Fix: Testrunner Rigidbody import error

## [2.56.2-pre] - 2023-01-06
- Change: Component.addEventListener argument can now derive from Event

## [2.56.1-pre] - 2023-01-05
- Fix: UI setting Image.sprite property did apply vertical flip every time the sprite was set

## [2.56.0-pre] - 2023-01-04
- Add: file-dropped event to DropListener
- Add: UI image and raw image components now support updating texture/sprite at runtime
- Change: Bump needle gltf-transform extensions package adding mesh compression and caching for texture compression leading to significant speedups for subsequent production builds (only changed textures are re-processed)
- Fix: light normal bias defaults

## [2.55.2-pre] - 2023-01-02
- Add: Rigidbody.gravityScale property
- Add: Gizmos.DrawArrow method
- Add: Rigidbody.getAngularVelocity method
- Fix: Mesh collider center of mass

## [2.55.1-pre] - 2022-12-30
- Add: Warning when serialized component field name is starting with uppercase letter
- Change: bump component compiler dependency
- Fix: Particle rotation over lifetime
- Fix: Particles should not emit when emission module is disabled
- Fix: LODGroup breaking rendering when used with multi-material objects or added on mesh to be culled directly

## [2.55.0-pre] - 2022-12-21
- Add: PhysicsMaterial support
- Add: ``Time.timesScale`` factor
- Change: VideoPlayer exposes underlying HTML video element
- Change: EffectComposer check if ``setPixelRatio`` method exists before calling
- Change: WebARSessionRoot and Rig rotation
- Fix: WebXRController raycast line not being visible in Quest AR
- Fix: Renderer that is disabled initially now hides object
- Fix: Some ParticleSystem worldspace settings when calling emit directly

## [2.54.2-pre] - 2022-12-19
- Change: debug parameter can now take ``=0`` for disabling them (e.g. ``freecam=0``)
- Fix: InputField opens keyboard on iOS

## [2.54.1-pre] - 2022-12-15
- Fix: issue with progressive loading, loading files multiple times if a texture was used in multiple materials/material slots. This was causing problems and sometimes crashes on mobile devices 
- Fix: balloon messages using cached containers didnt update the message sometimes and displaying an old message instead

## [2.54.0-pre.1] - 2022-12-14
- Fix: bump gltf extensions package fixing issue with progressive texture loading when multiple textures had the same name 

## [2.54.0-pre] - 2022-12-14
- Add: start and end events for progressive loading
- Add: USDZExporter events for button creation and after export
- Change: apply WebARSessionRoot scale to exported object, e.g. if scene is scaled down on Android it should receive the same scale when exporting for Quicklook
- Fix: process reflection probe update in update event to avoid visible flickr after component enabled state has changed

## [2.53.1-pre.1] - 2022-12-12
- Fix: implement ButtonColors

## [2.53.1-pre] - 2022-12-12
- Add: GroundProjection appyOnAwake to make it possible to just use it when the environment changes via remote skybox and not apply it to the default skybox
- Change: more strict tsconfig
- Change: allow overriding loading element
- Fix: apply shape module rotation to direction
- Fix: ParticleSystem world position not being set when shape module was disabled

## [2.53.0-pre] - 2022-12-08
- Add: InstantiateIdProvider constructor can now take string too for initializing seed
- Add: USDZExpoter component enabling ``Open in Quicklook`` option by default when running on iOS Safari
- Fix: Light intensity
- Fix: Add workaround texture image encoding issue: https://github.com/needle-tools/needle-engine-support/issues/109
- Fix: OrbitControls.enableKeys
- Fix: Remove warning message about missing ``serializable`` when the reference is really missing
- Fix: ``context.domX`` and ``domY`` using wrong values when in AR mode

## [2.52.0-pre] - 2022-12-05
- Add iOS platform util methods
- Add ``?debugrig`` to render XRRig gizmo
- Add support for Spritesheet Animation
- Add: EventTrigger implementations for onPointerClick, onPointerEnter, onPointerExit, onPointerDown, onPointerUp
- Add: RemoteSkybox environmentBlurriness setting
- Fix: Renderer reflection probe event order issue not applying reflection probes when enabling/disabling object because reflection probes have not been enabled
- Fix: remove log in ParticleSystemModules

## [2.51.0-pre] - 2022-11-30
- Change: remove nebula, dat.gui and symlink package dependencies
- Change: Light does not change renderer shadowtype anymore
- Change: update threejs to 146
- Change: update threejs types
- Change: Screencapture should not start on click when not connected to networked room
- Change: WebXR returns ar supported when using Mozilla WebXR
- Fix DragControls drag interaction not disabling OrbitControls at right time
- Fix physics collider position in certain cases
- Fix Rigidbody not syncing physics position when parent transform changes
- Fix Timeline awake / active and enable
- Fix: OrbitControls calulcating target position with middle mouse click in worldspace instead of localspace causing wrong movement when parent is transformed
- Fix: Raycast in Mozilla WebXR / using window sizes instead of dom element sizes
- Fix input with scrolled window
- Fix: destroy local avatar on end of webxr session (https://github.com/needle-tools/needle-engine-support/issues/117)
- Fix: WebXRAvatar setting correct XRFlags

## [2.50.0-pre] - 2022-11-28
- Add warning to Light when soft shadows change renderer shadow type
- Add: RemoteSkybox can now load jpg and png textures as skybox
- Change: Instantiate does now copy Vector, Quaternion and Euler objects to ensure multiple components dont share the same objects
- Fix: AnimatorController causes threejs error when creating empty animationclip (Blender) 
- Fix: AnimatorController error when transition has no conditions array (Blender)

## [2.49.1-pre] - 2022-11-25
- Add circular instantiation check to AssetReference
- Allow filtering ``context.input.foreachPointerId()`` by pointer types (e.g. mouse or touch)
- Fix typescript error in particle system module function (happened only when ``strict`` was set to false in tsconfig)
- Fix XRFlag component not being applied on startup

## [2.49.0-pre] - 2022-11-24
- Add: input iterator methods to loop over currently active input pointer ids
- Change: input refactor to work better with touch
- Fix GraphicRaycaster serialization warning
- Fix deserialization bug when Animation clips array is not serialized (exported from blender)
- Fix: remove leftover log in AnimatorController when cloning
- Fix XR flag not correctly restoring state
- Fix reticle not being rendered when XRRig is inside WebARSessionRoot
- Fix Mozilla XR AR overlay (https://github.com/needle-tools/needle-engine-support/issues/81)
- Fix Mozilla XR removing renderer canvas on exit AR (https://github.com/needle-tools/needle-engine-support/issues/115)

## [2.48.0-pre] - 2022-11-23
- Add: debug console for better mobile debugging (shows up on error on mobile in local dev environment or when using the ``?console`` query parameter)
- Add: dom element visibility checks and suspend rendering and update loops (if ``this.context.runInBackground`` is false)
- Add: ``this.context.isPaused`` to manually suspend rendering
- Add: ``IComponent.onPausedChanged`` event method which is called when rendering is paused or resumed
- Change: update copy-from-to dev dependency version to fix build error when path contains ``(``
- Change: ``this.context.input`` does now support pointer lock state (properly reports delta)
- Fix: make sure VRButton has the same logic as in three again (regex instead of try-catch)
- Fix: WebXRViewer DOM Overlay bugs when dom overlay element is inside canvas
- Fix: exitAR not being called in some cases when exiting AR
- Fix: ``this.context.domX`` and ``this.context.domY`` when web component is not fullscreen

## [2.47.0-pre] - 2022-11-17
- Add: Initial react three fiber components
- Change: OrbitControls made lerp stop distance smaller 
- Change: expose ``*enumerateActions()`` in AnimatorController
- Fix: Flipped custom reflection texture
- Fix: Volume exposure not being applied when no Tonemapping effect was set
- Fix: Volume tonemapping not respecting override state setting
- Fix: ``AudioSource.loop`` not working
- Fix: Collider center being not not applied correctly
- Fix: MeshCollider scale not being applied from object

## [2.46.0-pre] - 2022-11-16
- Add: Particles subemitter support
- Add: Particles inherit velocity support
- Add: Particles size by speed support
- Add: Particles color by speed support
- Add: Particles trail now fadeout properly when "die with particle" is disabled
- Add: Particles circle shape
- Change: button hover now sets cursor to pointer
- Fix: WebXR controller disabling raycast line for hands
- Fix: WebXR hands path when not assigned in Unity
- Fix: Mesh Particles not rendering because of rotation being wrongly applied
- Fix: Mesh particles size in AR
- Fix: Particles color and size lerp between two curves

## [2.45.0-pre] - 2022-11-14
- Add: RemoteSkybox option to control if its set as background and/or environment
- Add: @serializable decorator, @serializeable will be removed in a future version
- Add: getComponent etc methods to IGameObject interface
- Add: Renderer.enable does now set visible state only without affecting the hierarchy or component active state
- Change: Expose Typestore
- Change: Animation componet does loop by default (use the AdditionalAnimationData component to set the default loop setting)
- Fix: WebXR relative hands path in subfolders
- Fix: Rigidbody did not properly detect object position change if the position change was applied a second time at the exact same target position (it worked setting it once and didnt work in subsequent calls - now it does always detect it)

## [2.44.1-pre] - 2022-11-13
- Add: RemoteSkybox exposes ``background`` and ``environmnet`` properties to configure if the loaded skybox is set for the scene background and/or the environment light
- Change: Expose TypeStore

## [2.44.0-pre] - 2022-11-11
- Add: Particles limit velocity over time
- Add: Particles rotation by speed
- Add: ParticleSystem play, pause, stop and emit(count) methods
- Add: ``WebXR.showRaycastLine`` exposed so it can be disabled from code
- Fix: issues in applying some forces/values for different scaling and worldspace <> localspace scenarios
- Change: raise input events in core method to also allow receiving WebAR mock touch events
- Change: ``Animation.play()`` does not require argument anymore

## [2.43.0-pre] - 2022-11-10
- Add: particles emission over distance
- Add: particles can enable trail (settings are not yet applied tho) 
- Add: camera now useses culling mask settings
- Add: particle VelocityOverLife
- Add: particle basic texture sheet animation support
- Change: ensure ``time.deltaTime`` is always > 0 and nevery exactly 0
- Fix: progressbar handle progress event not reporting total file size
- Fix: layer on camera did affect visibility
- Fix: cloning animatorcontrollers in builds did fail because of legacy AnimatorAction name check
- Fix: ``RGBAColor.lerpColors`` did produce wrong alpha value
- Fix: custom shader ``_ZTest`` value is now applied as threejs depthTest function

## [2.42.0-pre] - 2022-11-09
- add ``Graphics.copyTexture``
- add ``Renderer.allowProgressiveLoad``
- add ``Gizmos.DrawBox`` and ``DrawBox3``
- add particles burst emission
- add particles color interpolation between two gradients
- fix: reflection probe material caching for when material is being changed at certain times outside of animation loop and cache applied wrong material
- fix: AnimationCurve evaluation when time and keyframe are both exactly 0
- change: reflection probe now requires anchor override
- change: bump threejs dependency 

## [2.41.0-pre] - 2022-11-07
- Add: start adding particle systems support again
- Change: update dependency version to needle gltf-transform-extensions package
- Change: light set to soft shadows now changes renderer shadow mode to ``VSMShadowMap`` (can be disabled by setting ``Light.allowChangingShadowMapType`` to false)
- Fix: WebXR creating AR button when called from script in awake 
- Fix: ``AnimationCurve.evaluate``

## [2.40.0-pre] - 2022-11-05
- Add support for deleting all room state by calling ``context.connection.sendDeleteRemoteStateAll()`` (requires backend to update ``@needle-tools/needle-tiny-networking-ws`` to ``^1.1.0-pre``)
- Add Hinge joint
- Add ``Gizmos.DrawLine``, ``DrawRay`` ``DrawWireSphere`` and ``DrawSphere``
- Add: physics Collision Contacts now contain information about ``impulse`` and ``friction``
- Add ``physics.raycastPhysicsFast`` as a first method to raycast against physics colliders, the returning object contains the point in worldspace and the collider. This is the most simplest and thus fastest way to raycast using Rapier. More complex options will follow in future versions.
- Fix joint matrix calculation
- Fix and improve physics Contacts point calculations  
- Fix issue in physics event callbacks where ``onCollisionStay`` and ``onCollisionExit`` would only be called when ``onCollisionEnter`` was defined

## [2.39.0-pre] - 2022-11-04
- Add: physics FixedJoint
- Change: CharacterController now rotates with camera
- Change: scaled mesh colliders are now cached
- Change: disable OrbitControls when in XR
- Change: first enabled camera component sets itself as rendering camera if no camera is yet assigned (mainCamera still overrides that)
- Change: package module field now shows to ``src/needle-engine``
- Change: ``Camera.backgroundColor`` assigning Color without alpha sets alpha to 1 now
- Fix: improved missing ``serializable`` detection / warning: now only shows warning for members actually declared in script 
- Fix: wrong light intensity in VR when light is child of WebARSessionRoot [issue 103](https://github.com/needle-tools/needle-engine-support/issues/103) 

## [2.38.0-pre] - 2022-11-02
- Add ``context.isInAR`` and ``context.isInVR`` properties
- Add physics capsule collider support
- Add basic character controller implementation (experimental)
- Add ``context.input.getMouseWheelDeltaY()``
- Add: SmoothFollow option to restrict following on certain axes only for position
- Add: ``Rigidbody.teleport`` method to properly reset internal state
- Add: load glbs using build hash (appended as ``?v=123``)
- Change: Collision event args now exposes contacts array
- Fix Exit AR (X) button not showing up
- Fix physics collider center offset
- Fix removing colliders and rigidbodies throwing error (when trying to access properties for already removed bodies)
- Fix bug in AnimatorController causing broken animations when the same clip is used in multiple states (caused by ``mixer.uncacheCip``)
- Fix rigidbody friction allowing for physical bodies being transported on e.g. platforms
- Fix ``onTriggerStay`` being invoked with the correct collider argument
- Fix AnimatorController exit time not being used properly
- Fix AnimatorController not checking all possible transitions if one transition did match conditions but could not be made due to exit time setting
- Fix ``Renderer.sharedMaterials`` not handling SkinnedMeshRenderer
- Fix environment blend mode for mozilla XR browser on iOS
- Fix: Camera now removing self from being set as currently rendering in ``onDisable``

## [2.37.0-pre] - 2022-10-28
- Add: rapier physics backend and overall improved physics system like constraint support, fixed physics collider updates and synchronization between rendering and physics world or animation of physical bodies 
- Remove: cannon-es
- Add basic mesh collider support
- Add ``@validate`` decorator and ``onValidate`` event method that can be used to automatically get callbacks when marked properties are being written to (for example internally this is used on the Rigidbody to update the physics body when values on the Rigidbody component are being updated)
- Change: assign nested gltf layers
- Change: reworked Rigidbody api
- Fix: allow Draco and KRTX compression on custom hand models
- Fix: applying Unity layers to threejs objects
- Fix: BoxHelper stopped working with SpatialTrigger
- Fix: AR reticle showing up in wrong position with transformed WebARSessionRoot

## [2.36.0-pre] - 2022-10-26
- Add: Expose WebXR hand model path
- Add: Animation component can now be configured with random time scale and offset
- Change: allow blocking overlay errors using the ``?noerrors`` query parameter
- Change: don't use Composer for postprocessing in XR (see [issue](https://github.com/needle-tools/needle-engine-support/issues/101)) 
- Change: physics intersections causing NaN's are now reported prominently and physics bodies are removed from physics world as an interim solution, this provides more information about problematic colliders for debugging
- Fix: bug that caused component events for onEnable and onDisable not being called anymore in some cases
- Fix: cases where loading overlay using old project template wouldnt be removed/hidden anymore
- Fix: WebXR hide large hand grab sphere
- Fix: onPointerUp event not firing using WebXR controllers when grabbing an object for the second time
- Fix: GroundProjection can now be removed again
- Fix: Custom shaders exported using builtin RP can now use  _Time property
- Fix: Only create two controllers when in AR on oculus browser
- Fix: BoxHelperComponent can now handle multi-material objects (groups) 

## [2.35.6-pre] - 2022-10-24
- Add: warning balloon when unknown components are detected and have been most likely forgot to be installed, linking to npmdef docs 
- Fix: dont show serialization warning for builtin components where specific fields are not deserialized on purpose (since right now the serializer does not check which fields are actually implemented) 

## [2.35.5-pre] - 2022-10-24
- Change: AudioSource exposes ``clip`` field
- Change: improve error and messaging overlay
- Change: detect when serialized Object3D and AssetReference are missing ``@serializable`` attribute and show message in overlay
- Change: add WebXR hands path to controllers
- Fix: WebXR controllers now use interactable object when grabbing (instead of hit object previously) which fixes interaction with nested hierarchies in XR and DragControls

## [2.35.4-pre] - 2022-10-23
- Change: Renderer ``material`` is now ``sharedMaterial`` to make it more clear for Unity devs that the material is not being cloned when accessed
- Fix: When not specifying any explicit networking backend for glitch deployment it now falls back to the current glitch instance for networking

## [2.35.3-pre] - 2022-10-21
- Add: Screenshare component ``share`` method now takes optional options to configure device and MediaStreamConstraints for starting the stream 
- Fix: WebXR should show EnterVR button when enabled in Unity
- Fix: component ``enable`` boolean wasnt correctly initialized when loaded from gltf
- Fix: Object3D prototype extensions weren't correctly applied anymore
- Fix: Interaction bug when using DragControls with OrbitControls with multitouch

## [2.35.2-pre] - 2022-10-20
- Add ``Renderer.mesh`` getter property
- Change: ``Renderer.material`` now returns first entry in ``sharedMaterials`` array so it automatically works in cases where a Renderer is actually a multi-material object
- Change: warn when trying to access components using string name instead of type
- Change: update needle gltf-transform-extensions to 0.6.2
- Fix: remove log from UIRaycastUtil
- Fix: move TypeStore import in builtin engine again to not break cases where ``import @needle-engine`` was never used
- Fix: React3Fiber template and AR overlay container access when using react

## [2.35.1-pre] - 2022-10-19
- Change: unify component access methods, first argument is now always the object with the component type as second argument
- Fix physics collision events throwing caused by refactoring in last version
- Fix loading screen css

## [2.35.0-pre] - 2022-10-19
- Change: First pass of reducing circular dependencies
- Change: Update @needle-tools/gltf-transform-extensions version
- Change: Update component compiler to 1.9.0. Changed include:
   * Private and protected methods will now not be emitted anymore
   * ``onEnable/onDisable`` will be emitted as ``OnEnable`` and ``OnDisable`` [issue 93](https://github.com/needle-tools/needle-engine-support/issues/93)
- Change: handle Vector3 prototype extensions
- Fix: issue with UI causing rendering to break when enabling text components during runtime that have not yet been active before
- Fix: OrbitControls LookAtConstraint reference deserialization
- Fix: WebXRController raycasting against UI marked as ``noRaycastTarget`` or in CanvasGroup with disabled ``interactable`` or ``blocksRaycast``

## [2.34.0-pre] - 2022-10-17
- Add: start adding support for 2D video overlay mode
- Change: Install threejs from @needle-tools/npm - this removes the requirement to have git installed and should fix a case where pulling the package from github would fail 
- Change: Move Screensharing aspect mode settings into VideoPlayer component
- Change: Move ``InstancingUtils`` into ``engine/engine_instancing.ts``
- Change: BoxCollider now checks if ``attachedRigidBody`` is assigned at start
- Change: Collision now exposes internal cannon data via ``__internalCollision`` property
- Fix: EventSystem now properly unsubscribes WebXRController events

## [2.33.0-pre] - 2022-10-17
- Add: ScreenCapture has mode for capturing webgl canvas (unfortunately it doesnt seem to work well in Chrome or Firefox yet)
- Change: move threejs prototype extensions into own file and make available to vanilla js builds
- Change: ScreenCapture component has explicit VideoPlayer component reference
- Fix: animating properties on custom shaders

## [2.32.0-pre] - 2022-10-15
- Add: start implementing trigger callbacks for ``onTriggerEnter``, ``onTriggerExit`` and ``onTriggerStay``
- Change: ``GameObject.setActive`` now updates ``isActiveAndEnabled`` state and executes ``awake`` and ``onEnable`` calls when the object was activated for the first time (e.g. when instantiating from an previously inactive prefab)
- Change: improve collision callback events for components (``onCollisionEnter``, ``onCollisionExit`` and ``onCollisionStay``)
- Change: this.context.input keycode enums are now strings
- Fix: local dev error overlay now also displays errors that happen before web component is completely loaded (e.g. when script has import error)
- Fix: Rigidbody force is now correctly applied when the component was just instantiated (from inactive prefab) and added to the physics world for the first time
- Fix: DragControls component keyboard events ("space" and "d" for modifying height and rotation)

## [2.31.1-pre] - 2022-10-14
- Change: Rigidbody now tracks position changes to detect when to update/override simulated physics body
- Fix: loading relative font paths when exported via Asset context menu

## [2.31.0-pre] - 2022-10-13
- Add: inital ScreenCapture component for sharing screens and camera streams across all connected users
- Add: ``onCollisionEnter``, ``onCollisionStay`` and ``onCollisionExit`` event methods to components

## [2.30.0-pre] - 2022-10-12
- Add: Quest 2 passthrough support
- Add: UI Graphic components now support ``raycastTarget`` again
- Add: VideoPlayer now supports ``materialTarget`` option which allows for assigning any renderer in the scene that should be used as a video canvas
- Changed: updated three-mesh-ui dependency version
- Changed: updated needle-gltfTransform extensions package, fixing an issue with passthrough of texture json pointers
- Changed: selecting SpectatorCam now requires click (instead of just listening to pointer up event)
- Fix: Avatars using instanced materials should now update transforms correctly again

## [2.29.0-pre] - 2022-10-10
- Add: Context.removeCamera method
- Add: SpectatorCam allows to follow other users across devices by clicking on respective avatar (e.g. clicking SyncedCam avatar or WebXR avatar, ESC or long press to stop spectating)
- Add: ``Input`` events for pointerdown, pointerup, pointermove and keydown, keyup, keypress. Subscribe via ``this.context.input.addEventListener(InputEvents.pointerdown, evt => {...})`` 
- Change: Default WebXR rig matches Unity forward
- Fix: WebXRController raycast line being rendered as huge line before first world hit
- Fix: SpectatorCam works again
- Fix: ``serializable()`` does now not write undefined values if serialize data is undefined
- Fix: exit VR lighting

## [2.28.0-pre] - 2022-10-06
- Add: ``resolutionScaleFactor`` to context
- Fix ``IsLocalNetwork`` regex
- Fix custom shaders failing to render caused by json pointer change
- Change: rename Context ``AROverlayElement`` to ``arOverlayElement``

## [2.27.0-pre] - 2022-10-06
- Fix: EventList failing to find target when targeting a Object3D without any components
- Fix: text now showing up when disabling and enabling again after the underlying three-mesh-ui components have been created
- Fix: Builtin sprites not rendering correctly in production builds
- Change: Bump needle glTF transform extensions version
- Change: json pointers now have correct format (e.g. ``/textures/0`` instead ``textures/0``)
- Change: Bump UnityGLTF version

## [2.26.1-pre] - 2022-10-05
- Fix animating ``activeSelf`` on GameObject in canvas hierarchy
- Fix SpectatorCam component
- Fix WebXRController raycast line being rendered as huge line before first world hit

## [2.26.0-pre] - 2022-10-05
- Add: experimental AlignmentConstraint and OffsetConstraint
- Remove: MeshCollider script since it is not supported yet
- Change: Camera does now use XRSession environment blend mode to determine if background should be transparent or not.
- Change: WebXR exposes ``IsInVR`` and ``IsInAR``
- Fix: RGBAColor copy alpha fix
- Fix: Avatar mouth shapes in networked environment

## [2.25.1-pre] - 2022-10-04
- Change: DropListener file drop event does send whole gltf instead of just the scene

## [2.25.0-pre] - 2022-10-04
- Add: allow overriding draco and ktx2 decoders on <needle-engine> web component by setting ``dracoDecoderPath``, ``dracoDecoderType``, ``ktx2DecoderPath`` 
- Add: ``loadstart`` and ``progress`` events to <needle-engine> web component
- Fix rare timeline animation bug where position and rotation of objects would be falsely applied
- Change: update to three v245
- Change: export ``THREE`` to global scope for bundled version

## [2.24.0-pre] - 2022-10-01
- Add: make engine code easily accessible from vanilla javascript
- Fix: handle number animation setting component enable where values are interpolated
- Change: Remove internal shadow bias multiplication
- Change: Addressable references are now resolved using relative paths
- Change: Update package json

## [2.23.2-pre] - 2022-09-29
- Add: Light component shadow settings can not be set/updated at runtime
- Fix: enter XR using GroundProjectedEnv component
- Fix: Light shadows missing when LightShadowData component was not added in Unity (was using wrong shadowResolution)
- Change: dont allow raycasting by default on GroundProjectedEnv sphere

## [2.23.1-pre] - 2022-09-29
- Add: Light exposes shadow resolution

## [2.23.0-pre] - 2022-09-28
- Add RemoteSkybox component to use HDRi images from e.g. polyhaven
- Add GroundProjectedEnv component to use threejs skybox projection 
- Fix: export ``GameObject`` in ``@needle-tools/engine``

## [2.22.1-pre] - 2022-09-28
- Add: ``noerrors`` url parameter to hide overlay
- Fix: WebXR avatar rendering may be visually offset due to root transform. Will now reset root transform to identity

## [2.22.0-pre] - 2022-09-28
- Add: ``@needle-tools/engine`` now exports all components
- Add: environment light from tricolor (used for envlight when set to custom but without custom cubemap assigned)
- Add: show console error on screen for localhost / local dev environment
- Fix: create environment lighting textures from exported colors
- Change: UI InputField expose text
- Change: Bump threejs version to latest (> r144) which also contains USDZExporter PR

## [2.21.0-pre] - 2022-09-26
- Add: custom shader set ``_ScreenParams``
- Change: DropListener event ``details`` now contains whole gltf file (instead of just scene object)

## [2.20.1-pre] - 2022-09-23
- Add: AudioSource volume and spatial blending settings can now be set at runtime
- Fix: AudioSource not playing on ``play`` when ``playOnAwake`` is false

## [2.20.0-pre] - 2022-09-23
- Add: VideoPlayer crossorigin attribute support
- Add: ``debuginstancing`` url parameter flag
- Add: Image handle builtin ``Background`` sprite
- Add: Component now implements EventTargt so you can use ``addEventListener`` etc on every component
- Add: EventList does automatically dispatch event with same name on component. E.g. UnityEvent named ``onClick`` will be dispatched on component as ``on-click``
- Add: experimental progressive loading of textures
- Add: ``WebXR`` exposes ``IsARSupported`` and ``IsVRSupported``
- Fix: remove Ambient Intensity
- Fix: ShadowCatcher material should not write depth

## [2.19.1-pre] - 2022-09-21
- Fix: SpatialTrigger intersection check when it's not a mesh
- Fix: UnityEvent / EventList argument of ``0`` not being passed to the receiving method
- Fix: Physics rigidbody/collider instantiate calls
- Fix: Physics rigidbody transform changes will now be applied to internal physics body 
- Fix: ``needle-engine.getContext`` now listens to loading finished event namely ``loadfinished``
- Change: cleanup some old code in Rigidbody component

## [2.19.0-pre] - 2022-09-20
- Add: initial support for ``InputField`` UI (rendering, input handling on desktop, mobile and AR, change and endedit events)
- Add: ``EventList.invoke`` can now handle an arbitrary number of arguments
- Change: lower double click threshold to 200ms instead of 500ms
- Change: runtime font-style does not change font being used in this version. This will temporarely break rich text support.
- Fix: custom shader regression where multiple objects using the same material were not rendered correctly
- Fix: Text sometimes using invalid path
- Fix: Remove unused imports

## [2.18.0-pre] - 2022-09-20
- Add basic support for ``CameraDepth`` and ``OpaqueTexture`` (the opaque texture still contains transparent textures in this first version) being used in custom shaders

## [2.17.1-pre] - 2022-09-17
- Improve Animator root motion blending
- Fix SpatialTrigger error when adding both SpatialTrigger as well as SpatialTrigger receiver components to the same object
- AnimatorController can now handle states with empty motion or missing clips

## [2.17.0-pre] - 2022-09-15
- Add: automatic runtime font atlas generation from Unity font assets 
- Remove: shipped font assets in ``include/fonts``
- Fix: Physics pass custom vector into ``getWorldPosition``, internal vector buffer size increased to 100
- Fix: SpatialTrigger and SpatialTrigger receivers didnt work anymore due to LayerMask serialization

## [2.16.1-pre] - 2022-09-14
- Change: UI disable shadow receiving and casting by default, can be configured via Canvas
- Fix: ``gameObject.getComponentInParent`` was making false call to ``getComponentsInParent`` and returning an array instead of a single object
- Fix: light intensity in AR

## [2.16.0-pre] - 2022-09-14
- Add: first draft of Animator root motion support
- Fix: ``Renderer.sharedMaterials`` assignment bug when GameObject was mesh
- Fix: Buttons set to color transition did not apply transition colors
- Fix: UI textures being flipped
- Fix: UI textures were not stretched across panel but instead being clipped if the aspect ratio didnt match perfectly

## [2.15.0-pre] - 2022-09-12
- Add stencil support to ``Renderer``
- Add timeline ``removeTrackOffset`` support
- Fix timeline animation track offset only being applied to root
- Fix timeline clip offsets not being applied when no track for e.g. rotation or translation exists

## [2.14.0-pre] - 2022-09-11
- Add initial UI anchoring support
- Add initial support for URP RenderObject Stencil via ``NEEDLE_render_objects`` extension

## [2.13.4-pre] - 2022-09-09
- Fix UI transform handling for [issue 42](https://github.com/needle-tools/needle-engine-support/issues/42) and [issue 30](https://github.com/needle-tools/needle-engine-support/issues/30)
- Fix AudioSource not restarting to play at onEnable when ``playOnAwake`` is true (this is the default behaviour in Unity)

## [2.13.3-pre] - 2022-09-09
- Fix RGBAColor not implementing copy which caused alpha to be set to 0 (this caused ``Camera.backgroundColor`` to not work properly)

## [2.13.2-pre] - 2022-09-07
- Add support to set OrbitControls camera position immediately

## [2.13.1-pre] - 2022-09-07
- Fix EventList invocation not using deserialized method arguments

## [2.13.0-pre] - 2022-09-07
- Add ``context`` to ``StateMachineBehaviour``
- Fix ``StateMachineBehaviour`` binding (event functions were called with wrong binding)

## [2.12.0-pre.1] - 2022-09-06
- Fix deserialization error when data is null or undefined

## [2.12.0-pre] - 2022-09-05
- Add initial tonemapping and exposure support
- Add AR shadow catcher
- Fix objects parented to camera appear behind camera
- Fix reticle showing and never disappearing when no WebARSessionRoot is in scene
- Fix WebARSessionRoot when on same gameobject as WebXR component
- Fix deserialization of ``@serializable(Material)`` producing a new default instance in certain cases
- Fix ``OrbitControls`` enable when called from UI button event
- Fix EventList / UnityEvent calls to properties (e.g. ``MyComponent.enable = true`` works now from UnityEvent)

## [2.11.1-pre] - 2022-09-02
- Change: ``OrbitControls.setTarget`` does now lerp by default. Use method parameter ``immediate`` to change it immediately
- Change: bump component compiler dependency to ``1.8.0``

## [2.10.3-pre] - 2022-09-01
- Fix EventList serialization for cross-glb references
- Fix AnimatorController transition from state without animation

## [2.10.2-pre] - 2022-09-01
- Fix: skybox/camera background on exit AR
- Change: AnimatorController can now contain empty states
- Change: Expose ``Animator.Play`` transition duration

## [2.10.1-pre] - 2022-08-31
- Improved RectTransform animation support and canvas element positioning
- Fix ``Animator.Play``
- Change: Expose ``AnimatorController.FindState(name)`` 

## [2.10.0-pre] - 2022-08-29
- Add UI to gltf export
- Add button animation transition support for triggers ``Normal``, ``Highlighted`` and ``Pressed``

## [2.9.0-pre] - 2022-08-26
- Add ``Canvas.renderOnTop`` option
- Fix ``OrbitControls`` changing focus/moving when interacting with the UI
- Fix nullref in AnimatorController with empty state

## [2.8.0-pre] - 2022-08-25
- Add export for ``Renderer.allowOcclusionWhenDynamic``
- Fix: bug in ``@serializable`` type assignment for inherited classes with multiple members with same name but different serialized types
- Change: ``GameObject.findObjectOfType`` now also accepts an object as a search root

## [2.7.3-pre] - 2022-08-25
- Fix canvas button breaking orbit controls [issue #4](https://github.com/needle-tools/needle-engine-support/issues/4)

## [2.7.2-pre] - 2022-08-23
- Fix SyncedRoom to not append room parameter multiple times

## [2.7.1-pre] - 2022-08-22
- Add: Timeline AudioTrack nullcheck when audio file is missing
- Fix: AnimatorController error when behaviours are undefined
- Change StateMachineBehaviour methods to be lowercase

## [2.7.0-pre] - 2022-08-22
- Add initial StateMachineBehaviour support with "OnStateEnter", "OnStateUpdate" and "OnStateExit"
- Fix input raycast position calculation for scrolled content

## [2.6.1-pre] - 2022-08-22
- Fix texture pointer remapping in gltf-transform opaque extension
- Change: skip texture-transform for textures starting with "Lightmap" for now until we can configure this properly 

## [2.6.0-pre] - 2022-08-18
- Add scale to instantiation sync messages
- Fix ``BoxHelper``
- Fix AR reticle being not visible when ``XRRig`` is child of ``WebARSessionRoot`` component
- Fix exception in ``DragControls`` when dragged object was deleted while dragging

## [2.5.0-pre] - 2022-08-18
- Change name of ``KHR_webgl_extension`` to ``NEEDLE_webgl_extension``
- Change: dont write depth for custom shader set to transparent 
- Deprecate and disable ``AssetDatabase``

## [2.4.1-pre] - 2022-08-17
- Add ``Mathf.MoveTowards``
- Change: rename ``needle-tiny`` webcomponent to ``needle-engine``
- Fix ordering issue in needle web component when codegen.js is executed too late

## [2.3.0-pre] - 2022-08-16
- Add SyncedCamera prefab/AssetReference support
- Add TypeArray support for ``serializable`` to provide multiple possible deserialization types for one field (e.g. ``serializable([Object3D, AssetReference])`` to try to deserialize a type as Object3D first and then as AssetReference)

## [2.2.0-pre] - 2022-08-14
- Add event callbacks for Gltf loading: ``BeforeLoad`` (use to register custom extensions), ``AfterLoaded`` (to receive loaded gltf), ``FinishedSetup`` (called after components have been created)

## [2.1.2-pre] - 2022-08-14
- Fix AnimatorController exit state
- Fix AR camera background alpha to be fully transparent by default 

## [2.1.1-pre] - 2022-08-12
- Fix: light shadow bias

## [2.1.0-pre] - 2022-08-11
- Add ``@needle-tools/engine`` to be used as import for "most used" apis and functions
- Change: remove obsolete ``Renderer.materialProperties``
- Fix: ``NEEDLE_persistent_assets`` extension is now valid format (change from array to object)

## [2.0.0-pre] - 2022-08-08
- Renamed package

## [1.21.2-pre] - 2022-08-08
- Fix: NestedGltf transform

## [1.20.1-pre] - 2022-08-06
- Remove: Duplicateable animation time offset hack
- Change: GameObjectData extension properly await assigning values
- Change: NestedGltf instantiate using guid
- Change: ``instantiate`` does now again create guids for three Objects too

## [1.20.0-pre] - 2022-08-05
- Add: NestedGltf ``listenToProgress`` method
- Add: Allow changing Renderer lightmap at runtime
- Fix: Environment lighting when set to flat or gradient (instead of skybox)
- Fix: ``this.gameObject.getComponentInChildren`` - was internally calling wrong method
- Fix: Spectator camera, requires Camera component in glb now

## [1.19.0-pre] - 2022-08-03
- Add: Animator.keepAnimatorStateOnDisable, defaults to false as in Unity so start state is entered on enable again
- Add: warning if different types with the same name are registered
- Add: timeline track ``onMutedChanged`` callback
- Change: PlayableDirector expose audio tracks
- Change: BoxCollider and SphereCollider being added to the physics scene just once
- Change: try catch around physics step

## [1.18.0-pre] - 2022-08-01
- Add: Addressable download progress is now observeable
- Add: Addressable preload support, allows to load raw bytes without actually building any components
- Add: PlayableDirector exposes tracks / clips
- Change: modify default engine loading progress bar to be used from user code
- Change: add option to Instantiate call to keep world position (set ``keepWorldPosition`` in ``InstantiateOptions`` object that you can pass into instantiate)
- Change: light uses shadow bias from Unity
- Fix: instancing requiring worldmatrix update being not properly processed
- Fix: Duplicatable world position being off (using ``keepWorldPosition``)
- Fix: ``Animation`` component, it does allow to use one main clip only now, for more complex setups please use AnimationController or Timeline
- Fix: ``SyncedRoom`` room connection on enter WebXR
- Fix: WebXR avatar loading

## [1.17.1-pre] - 2022-07-27
- Change: bump component compiler dependency to ``1.7.1``
- Change: ``context.mainCameraComponent`` is now of type ``Camera``
- Fix: timeline control track
- Fix: timeline animation track post extrapolation
- Fix: custom shader does not fail when scene uses object with transmission (additional render pass)

## [1.17.0-pre] - 2022-07-21
- engine: add loading bar and show loading state text

## [1.16.0-pre] - 2022-07-20
- engine: add using ambient light settings (Intensity Multiplier) exported from Unity

## [1.15.1-pre] - 2022-07-18
- engine: fix nullref in registering texture

## [1.15.0-pre] - 2022-07-15
- engine: remove legacy file
- engine: add basic implementation of ``Context.destroy``
- engine: fix ``<needle-tiny>`` src attribute
- engine: add implictly creating camera with orbit controls when loaded glb doesnt contain any (e.g. via src) 

## [1.14.2-pre] - 2022-07-12
- engine: fix dont apply lightmaps to unlit materials
- engine: remove log in PlayableDirector
- engine: add support to override (not automatically create) WebXR buttons 

## [1.14.1-pre] - 2022-07-11
- engine: Fix AnimatorController finding clip when cloned via ``AssetReference.instantiate``
- engine: Fix deep clone array type
- engine: Fix PlayableDirectory binding when cloned via ``AssetReference.instantiate``

## [1.14.0] - 2022-07-10
- engine: add VideoPlayer using ``AudioOutputMode.None``
- engine: fix VideoPlayer waiting for input before playing video with audio (unmuted) and being loaded lazily

## [1.13.0-pre] - 2022-07-07
- engine: Add ``getComponent`` etc methods to THREE.Object3D prototype so we can use it like in Unity: ``this.gameObject.getComponent...``
- engine: Change ``Duplictable`` serialization

## [1.12.2-pre] - 2022-07-06
- engine: Fix networking localhost detection
- engine: update component generator package version (supporting now CODEGEN_START and END sections as well as //@ifdef for fields)

## [1.12.1-pre] - 2022-07-06
- engine: change lightmap extension to be object

## [1.12.0-pre] - 2022-07-06
- engine: Add DeviceFlag component
- engine: Fix VideoPlayer loop and playback speed
- engine: Improve VideoTrack sync

## [1.11.0-pre] - 2022-07-04
- engine: fix ``enabled`` not being always assigned
- engine: fix react-three-fiber component setting camera
- engine: add support for custom timeline track
- engine: add VideoTrack npmdef

## [1.10.3-pre] - 2022-07-01
- engine: Change; PlayableDirector Wrap.None now stops/resets timeline on end
- engine: Change; PlayableDirector now stops on disabling  

## [1.10.2-pre] - 2022-07-01
- engine: fix timeline clip offsets and hold
- engine: fix timeline animationtrack support for post-extrapolation (hold, loop, pingpong)

## [1.10.1-pre] - 2022-06-30
- engine: improve timeline clip offsets

## [1.10.0-pre] - 2022-06-30
- engine: Improved timeline clip- and track offset (ongoing)
- engine: Change assigning all serialized properties by default again (instead of require ``@allProperties`` decorator)
- engine: Change; deprecate ``@allProperties`` and ``@strict`` decorators

## [1.9.1-pre] - 2022-06-29
- engine: add methods for unsubscribing to EventList and make constructor args optional
- engine: change camera to not change transform anymore

## [1.9.0-pre] - 2022-06-28
- engine: add support for transparent rendering using camera background alpha

## [1.8.0-pre] - 2022-06-27
- Add: transform gizmo component
- Change: component generator for npmdef is not required anymore
- Change: component gen runs in background now
- Fix: typescript drag drop adding component twice in some cases
- engine: update component gen package dependency
- engine: fix redundant camera creation when exported in GLTF
- engine: fix orbit controls focus lerp, stops now on input

## [1.7.1-pre] - 2022-06-25
- Override PlayMode in sub-scene
- engine: lightmaps encoding fix
- engine: directional light direction fix 

## [1.7.0-pre] - 2022-06-25
- engine: animator controler can handle multiple target animators
- engine: fix WebXR being a child of WebARSessionRoot
- engine: improve Camera, OrbitControls, Lights OnEnable/Disable behaviour
- engine: add ``Input.getKeyPressed()``

## [1.6.0-pre] - 2022-06-23
- engine: fix light error "can't add object to self" when re-enabled
- engine: remove extension log
- engine: log missing info when UnityEvent has not target (or method not found)
- engine: use lightmap index for supporting multiple lightmaps

## [1.5.2-pre] - 2022-06-23
- engine: Camera dont set skybox when in XR
- engine: dont add lights to scene if baked

## [1.5.1-pre] - 2022-06-22
- engine: fix threejs dependency pointer

## [1.5.0-pre] - 2022-06-22
- engine: ``<needle-tiny>`` added awaitable ``getContext()`` (waits for scene being loaded to be used in external js)
- engine: fix finding main camera warning
- engine: add ``SourceIdentifier`` to components to be used to get gltf specific data (e.g. lightmaps shipped per gltf)
- engine: persistent asset resolve fix
- engine: update three dependency to support khr_pointer
- engine: remove custom khr_pointer extension
- engine: fix WebARSessionRoot exported in gltf
- engine: smaller AR reticle

## [1.4.1-pre] - 2022-06-17
- engine: create new GltfLoader per loading request
- engine: fix bug in core where it could happen that scripts were added multiple times
- engine: Added SyncedRoom auto rejoin option (to handle disconnection by server due to window inactivity)
- engine: guid resolving first in loaded gltf and retry in whole scene on fail
- engine: fix nullref in DropListener
- engine: register main camera before first awake

## [1.4.0-pre] - 2022-06-15
- engine: add ``GameObject.getOrAddComponent``
- engine: ``OrbitControl`` exposing controlled object
- engine: ``getWorldPosition`` now uses buffer of cached vector3's instead of only one
- engine: add ``AvatarMarker`` to synced camera (also allows to easily attach ``PlayerColor``)
- engine: fix ``Animation`` component when using khr_pointer extension
- engine: ``VideoPlayer`` expose current time
- engine: fix ``Animator.runtimeController`` serialization
- engine: make ``SyncedRoom.tryJoinRoom`` public

## [1.3.1-pre] - 2022-06-10
- engine: allow ``@serializeable`` taking abstract types
- engine: add ``Renderer.sharedMaterials`` support

## [1.3.0-pre] - 2022-06-09
- engine: move log behind debug flag
- engine: improved serialization property assignment respecting getter only properties
- engine: add optional serialization callbacks to ``ISerializable``
- engine: default to only assign declared properties

## [1.2.3-pre] - 2022-06-09
- engine: downloading dropped file shows minimal preview box
- engine: ``DropListener`` can use localhost
- engine: ``SyncedRoom`` avoid reload due to room parameter
- engine: ``LODGroup`` instantiate workaround
- engine: improve deserialization supporting multiple type levels

## [1.2.2-pre] - 2022-05-30
- engine: change md5 hashing package
- engine: file upload logs proper server error

## [1.2.1-pre] - 2022-05-30
- engine: disable light in gltf if mode is baked
- engine: use tiny starter as default networking backend
- engine: synced file init fix for resolving references
- engine: allow removing of gen.js completely
- engine: expose ``Camera.buildCamera`` for core allowing to use blender camera
- engine: on filedrop only add drag control if none is found

## [1.2.0-pre] - 2022-05-27
- engine: fix networked flatbuffer state not being stored
- engine: make ``src`` on ``<needle-tiny>`` web component optional
- engine: ``src`` can now point to glb or gltf directly
- engine: fix ``Raycaster`` registration
- engine: add ``GameObject.destroySynced``
- engine: add ``context.setCurrentCamera``
- engine: make ``DropListener`` to EventTarget
- engine: make ``DropListener`` accept explicit backend url

## [1.1.0-pre.6] - 2022-05-26
- Fix gltf transform textures output when used in custom shaders only

## [1.1.0-pre.5] - 2022-05-25
- engine: fix ``VideoPlayer`` being hidden, play automatically muted until interaction
- engine: added helpers to update window history
- engine: fix setting custom shader ``Vector4`` property
- 
## [1.1.0-pre.4] - 2022-05-25
- engine: fix tsc error in ``Animation`` component
- engine: fix ``Animation`` component assigning animations for GameObject again
- engine: fix ``Animation`` calling play before awake
- engine: ``AnimatorController`` handle missing motion (not assigned in Unity)
- engine: ``AnimatorController.IsInTransition()`` fix

## [1.1.0-pre.1] - 2022-05-20
- engine: minor tsc issues fixed

## [1.1.0-pre] - 2022-05-20
- engine: add ``isManagedExternally`` if renderer is not owned (e.g. when using react-fiber)

## [1.0.0-pre.18] - 2022-05-19
- engine: add basic support for ``stopEventPropagation`` (to make e.g. ``DragControls`` camera control agnostic in preparation of react support)

## [1.0.0-pre.17] - 2022-05-17
- fix ``EventList`` outside of gltf
- fix ``EventList`` without any function assigned (``No Function`` in Unity)
- engine: support changing ``WebARSessionRoot.arScale`` changing at runtime

## [1.0.0-pre.16] - 2022-05-12
- engine: fix webx avatar instantiate
- engine: stop input preventing key event defaults

## [1.0.0-pre.15] - 2022-05-12
- engine: log error if ``instantiate`` is called with false parent
- engine: fix instantiate with correct ``AnimatorController`` cloning

## [1.0.0-pre.14] - 2022-05-11
- engine: fix ``@syncField()``
- engine: fix ``AssetReference.instantiate`` and ``AssetReference.instantiateSynced`` parenting
- engine: improve ``PlayerSync`` and ``PlayerState``

## [1.0.0-pre.13] - 2022-05-11
- engine: prepend three canvas to the web element instead of appending
- engine: ``SyncedRoom`` logs warning when disconnected
- engine: internal networking does not attempt to reconnect on connection closed
- engine: internal networking now empties user list when disconnected from room
- engine: ``GameObject.instantiate`` does not always generate new guid to support cases where e.g. ``SyncTransform`` is on cloned object and requires unique id
- engine: ``syncedInstantiate`` add fallback to ``Context.Current`` when missing
- engine: ``EventList`` refactored to use list of ``CallInfo`` objects internally instead of plain function array to more easily attach meta info like ``UnityEvent.off`` 
- engine: add ``GameObject.instantiateSynced``

## [1.0.0-pre.12] - 2022-05-10
- engine: fix font path
- engine: add ``debugnewscripts`` url parameter
- engine: start adding simplifcation to automatic instance creation + sync per player
- engine: allow InstantiateOptions in ``GameObject.instantiate`` to be inlined as e.g. ``{ position: ... }``
- engine: add ``AvatarMarker`` creation and destroy events
- engine: fix networking message buffering

## [1.0.0-pre.11] - 2022-05-08
- engine: ``SpatialTrigger`` is serializable
- engine: fix ``DragControls`` offset when using without ground
- engine: fix ``WebXRController`` interaction with UI ``Button.onClick``

## [1.0.0-pre.10] - 2022-05-04
- engine: fix gltf extension not awaiting dependencies
- engine: fix persistent asset @serializable check for arrays
- engine: add ``setWorldScale``
- engine: fix ``instantiate`` setting position
- engine: ``AssetReference`` does now create new instance in ``instantiate`` call
- engine: add awaitable ``delay`` util method
- engine: fix scripts being active when loaded in gltf but never added to scene
- engine: minimal support for mocking pointer input
- engine: emit minimal down and up input events when in AR

## [1.0.0-pre.9] - 2022-05-03
- improved default loading element
- changed animation pointer to support emissive intensity

## [1.0.0-pre.8] - 2022-05-02
- lightmaps fixed
- glitch upload shows time estimate
- deployment build error fix
- json pointer resolve
- improved auto install
- started basic ``SpriteRenderer`` support
- basic ``AnimationCurve`` support
- fixed ``PlayerColor``
- fixed ``persistent_assets`` and ``serializeable`` conflict
- basic export of references to components in root prefab

## [1.0.0-pre.7] - 2022-04-30
- ``WebXR`` does not load avatar from prefab reference
- ``WebXRSync`` is added implictly and creates local avatar even when not networked
- ``SpectatorCam`` is using local avatar
- ``SpectatorCam`` camera component in Unity is now optional and implictly added if missing

## [1.0.0-pre.6] - 2022-04-29
- fix environment light
- fix light shadows setting
- fix video player in extension
- fix video player texture not overlaying rendering while awaiting interaction
- fix webAR root reticle when no rig component is in scene

## [1.0.0-pre.5] - 2022-04-28
- start adding support for ``AssetReference`` again

## [1.0.0-pre.4] - 2022-04-27
- add persistent asset extension
- removed timeline and animator controller extensions as both are now serialized and resolved in assets
- can resolve json pointers (``animations/``, ``materials/``, ``textures/``, ``extensions``) in component paths
- add ``syncField()`` decorator

## [1.0.0-pre.2] - 2022-04-20
- updated to https:// three.js url instead of git:// url
- fixated flatbuffers dependency to 2.0.4 due to breaking changes and bugs in 2.0.6

## [1.0.0-pre] - 2022-04-19
- initial release