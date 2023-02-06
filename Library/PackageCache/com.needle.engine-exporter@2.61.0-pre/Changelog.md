# Changelog
All notable changes to this package will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [2.61.0-pre] - 2023-01-30
### Exporter
- Add: batch export now allows `-scene` arg to point to a prefab or asset and adds `-outputPath` argument to define the path and name of the exported glb(s)
- Fix: rare vite plugin poster error when include directory does not exist
- Fix poster incorrectly being generated when building
- Fix: Dialog that shows up when lightmap encoding settings are wrong now shows up less often
- Fix: serialized npmdefs with wrong paths are not automatically repaired or cleaned up from serialized data
- Change: Bug reporter now assumes .bin next to .gltf is a dependency until .bin is properly registered as a dependency in Unity
- Change: bump gltf-pipeline package fixing a rare bug where toktx could not be found

### Engine
- Add: canvas applyRenderSettings
- Add: progressive support for particle system textures

## [2.60.4-pre] - 2023-01-27
### Exporter
- Change: dont reload page while build preview is in progress (when running ExportInfo/Compress/PreviewBuild)
- Fix: bump build pipeline package to fix issue where texture compression settings were taken from wrong texture
- Fix: vite reload plugin sometimes preventing reload

### Engine
- Fix UI prefab instantiate throwing error at runtime
- Change: show warning when unsupported canvas type is selected
- Change: show warning when trying to use webxr features in non-secure context

## [2.60.3-pre] - 2023-01-26
### Exporter
- Fix register type error when component class with the same name exists multiple times in the same web-project in different files [issue 49](https://github.com/needle-tools/needle-engine-support/issues/49)
- Fix: NeedleAssetSettingsProvider and simplify setting texture settings on import like so:
   ```csharp
   if (NeedleAssetSettingsProvider.TryGetTextureSettings(assetPath, out var settings))
   {
      settings.Override = true;
      settings.CompressionMode = TextureCompressionMode.UASTC;
      NeedleAssetSettingsProvider.TrySetTextureSettings(assetPath, settings);
   }
   ```

### Engine
- Fix: camera fov for blender export allowing fieldOfView property to be undefined, where the fov should be handled by the blender exporter completely.

## [2.60.2-pre.1] - 2023-01-26
### Exporter
- Fix: remove accidental codice namespace using in 2022

## [2.60.2-pre] - 2023-01-26
### Exporter
- Add: Api to access texture compression settings (use `NeedleAssetSettingsProvider`)
- Add pre-build script to run tsc
- Fix: cubemap export fallbacks to LDR format if trying to export cubemap on unsupported build target (e.g. Android)
- Fix: project paths replacement when path has spaces
- Fix: remove global tsc call before building

### Engine
- Fix: particle textures being flipped horizontally

## [2.60.1-pre.1] - 2023-01-25
### Exporter
- Fix: Smart export file size check if file doesnt exist

## [2.60.1-pre] - 2023-01-25
### Exporter
- Change: Make cubemaps use correct convolution mode, downgrade error to warning
- Change: Cubemap warning should not show for skybox
- Change: Smart export check if file exported was < 1 kb in which case we always want to re-export
- Change: vite server plugin now communicates scheduled page reload to client
- Change: bump gltf extensions package dependency
- Fix: vite reload on changed codegen files (it should not reload there)

### Engine
- Change: export Mathf in `@needle.tools/engine`

## [2.60.0-pre] - 2023-01-25
### Exporter
- Add: check allowed cubemap convolution types and log error if that doesn't match
- Change: Remove `backgroundBlurriness` setting on RemoteSkybox (should be controlled on the camera)
- Fix: ExportInfo now doesnt display packages as `local` on OSX anymore
- Fix: GltfReference nullref when exporting via context menu, always ignore smart export for context menu exports
- Fix NEEDLE_gltf_dependencies extension causing gltfs to be invalid
- Fix: Platform compiler errors

### Engine
- Add: Particles support for horizontal and vertical billboards
- Add: Timeline now supports reversed clip (for blender timeline)
- Change: bump gltf pipeline package dependency adding support for global `NEEDLE_TOKTX` environment variable
- Change: timeline clip pos and rot are now optional (for blender timeline)
- Fix: when first loading a gltf pass guidsmap to components (for blender timeline)
- Fix: scrubbing TimelineTrack scrubs audio sources as well now
- Fix: stencils for multimaterial objects

## [2.59.3-pre] - 2023-01-21
### Exporter
- Add: particles basic support for on birth and ondeath subemitter behaviour
- Change: run typescript check before building for distribution
- Fix: saving referenced prefab with auto-export causing export to happen recursively
- Fix: improve vite reloading, generate needle.lock when exporting from referenced scene or prefab to prevent reloading while still exporting
- Fix: vite reloading scripts for usage with vuejs

### Engine
- Add: particles basic support for on birth and ondeath subemitter behaviour

## [2.59.2-pre.1] - 2023-01-20
### Engine
- Fix: issue where click on overlay html element did also trigger events in the underlying engine scene  

## [2.59.2-pre] - 2023-01-20
### Exporter
- Add: save in Prefab Mode does now attempt to re-export currently viewed prefab (similarly to how referenced scenes will re-export if they are referenced in a currently running web project)
- Change: EXR textures are now exported zipped (UnityGLTF)
- Change: OrbitControls now use damping (threejs)
- Change: default mipmap bias is now -0.5 (threejs)
- Change: DeployToFTP inspector now shows info if password is missing in server config asset 
- Change: Bump dependencies 
- Fix: export of human animation without transform when discovered from animatorcontroller should not cause errors
- Fix: handle cubemap export error on creating texture when Unity is on unsupported platform
- Fix: context click export for nested element in hierarchy
- Fix: bump gltf-transform-extensions package fixing a failure when using previously cached texture data but not setting the texture mime-type which caused errors at runtime and the texture to not load
- Fix: timeline now skips exporting clips with missing audio assets in AudioTrack
- Fix: subasset importer throwing nullref when selecting subassets from multiple assets and modifying their import settings
- Fix: Unity build being blocked by BuildPlayerHandler
- Fix: Unity build errors

### Engine
- Add: SpectatorCam.useKeys to allow users to disable spectator cam keyboard input usage (`f` to send follow request to connected users and `esc` to stop following)
- Change: expose SyncedRoom.RoomPrefix

## [2.59.1-pre] - 2023-01-18
### Exporter
- Fix: export error where object was being exported twice in the same event as transform and as gameObject due to self-referencing

## [2.59.0-pre] - 2023-01-18
### Exporter
- Add: Smart Export option, which will not re-export referenced prefabs or scenes if they didnt change since the last export (enable via ProjectSettings/Needle) improving export speeds significantly in certain cases. This option is off by default
- Add: lock file to prevent vite from reloading while export is still in process
- Add: warning when older nodejs version fails because of unknown ``--no-experimental-fetch`` argument
- Change: Some methods of DeployToFTP can now be overriden to customize uploading
- Change: TextureCompressionSettings can now be overriden to customize compression settings
- Change: Minor optimization of exported json, removing some unused data to reduce output size slightly for large or deeply nested projects 
- Fix: Issue where vite reload plugin did sometimes not trigger a reload after files have changed
- Fix: Issue where prefab containing GltfObject did not create a nested gltf to be lazily loaded
- Fix: Issue where nested gltf would cause IOException when it had the same name as an glb in the parent hierarchy
- Fix: TextureSizeHandler not being used when not added to GltfObject. It can now be added to any object in the scene to globally clamp the size of exported textures.
- Fix: Export of default font in 2022 (LegacyRuntime)
- Fix: AnimatorOverrideController is now properly ignored (currently not supported) instead of being serialized in a wrong/unexpected format which did cause errors at runtime
- Fix: Issue where DeployOnly did cause already compressed assets in output directory being replaced by uncompressed assets
- Fix: Texture compression set to ``Auto`` did not be properly export
- Fix: issue where default compression wasnt applied anymore when no specific compression settings where selected / setup anywhere
- Fix: Context menu export with compression from Project window now runs full compression pipeline (applying progressive transformation as well as compression) 
- Remove: Experimental SmartExport option on GltfObject

### Engine
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
### Exporter
- Update template vite config to improve reloading (you can update the vite config in existing projects via ExportInfo Context Menu > Update vite config) 

### Engine
- Update gltf-extensions package dependency

## [2.58.3-pre] - 2023-01-13
### Exporter
- Change: Update UnityGLTF dependency including fixes for gltf texture imports 
- Fix: run install on referenced npmdefs for distribution builds when packages have changed
- Fix: catch WebRequest invalid operation exception

## [2.58.2-pre.1] - 2023-01-13
### Exporter
- Fix: compiler error on osx and linux

## [2.58.2-pre] - 2023-01-12
### Exporter
- Add: start support for targeting existing web projects
- Add: support for animating color tracks when only alpha channel is exported
- Change: use vite for internal compiling of distributable npm package of needle-engine 
- Change: remove scene asset context menu override
- Change: bump UnityGLTF dependency
- Change: run compression commands when building web project from Unity
- Fix: OSX component compiler commands not being executed when containing spaces
- Fix: Linux using sh for terminal commands instead of zsh 
- Fix: Blendshape normals export
- Fix: error in vite plugin generating poster image
- Fix: Embedded assets for 2022 could not select Needle Engine compression settings
- Fix: Texture MaxSize setting not being passed to UnityGLTF
- Fix: Occasional error when exporting fog caused by component not being in runtime assembly
- Fix: Component compiler should update watcher when project directory changes
- Fix: Export of color alpha animation
- Fix: Light shadow bias settings export for URP when light didnt have UniversalAdditionalLightData component

### Engine
- Change: use draco and ktx loader from gstatic server by default
- Change: reduce circular dependencies
- Fix: Reflectionprobe selecting wrong probe when multiple probes had the exact same position

## [2.58.1-pre] - 2023-01-09
### Exporter
- Fix: light default shadow bias values
- Fix: template vite config
- Fix: timeline exported from prefab was sometimes not exported correctly (due to Playable graphs) - this is now fixed by rebuilding the graph once before export

### Engine
- Add: Prewarm rendering of newly loaded objects to remove lag/jitter when they become visible for the first time
- Change: renderer now warns when sharedMaterials have missing entries. It then tries to remap those values when accessing them by index (e.g. when another component has a material index serialized and relies on that index to be pointing to the correct object)

## [2.58.0-pre] - 2023-01-09
### Exporter
- Add hot reload setting (requires vite.config to be updated which can be done from ExportInfo context menu)
- Add fog export

### Engine
- Add: EventSystem input events (e.g. IPointerClick) are now invoked for all buttons (e.g. right click)
- Add: Hot reload for components

## [2.57.0-pre] - 2023-01-07
### Exporter
- Add: meta info export for vite template
- Add: HtmlMeta component to allow modification of html title and meta title/description from Unity
- Add: Support for poster image generation
- Change: Use custom vite plugin for gzip setting

### Engine
- Remove: Meshline dependency
- Fix: Testrunner Rigidbody import error

## [2.56.2-pre] - 2023-01-06
### Exporter
- Fix: BuildPlatform option for Unity 2021 and newer
- Fix: npm install command for npm 9
- Fix: Light shadowBias settings for Builtin RP
- Change: Include npm logs and version info in bug report logs

### Engine
- Change: Component.addEventListener argument can now derive from Event

## [2.56.1-pre] - 2023-01-05
### Exporter
- Add: initial batch mode / headless export support, can be invoked using `path/to/Unity.exe -batchmode -projectPath "path/to/project" -executeMethod Needle.Engine.ActionsBatch.Execute -buildProduction -scene "Assets/path/to/scene.unity"`, use `-debug` to show Unity console window during process
- Fix: sample window now locks assembly reload while downloading until after installation has finished, show progress report for user feedback 
- Fix: sample window not respecting user cancel

### Engine
- Fix: UI setting Image.sprite property did apply vertical flip every time the sprite was set

## [2.56.0-pre] - 2023-01-04
### Exporter
- Add: mesh compression support
- Add: compression settings for textures and meshes in embedded assets (e.g. an imported fbx or glb now has options to setup compression for production builds)
- Change: Bump UnityGLTF dependency adding caching of exported image data to speed up exports for texture heavy scenes

### Engine
- Add: file-dropped event to DropListener
- Add: UI image and raw image components now support updating texture/sprite at runtime
- Change: Bump needle gltf-transform extensions package adding mesh compression and caching for texture compression leading to significant speedups for subsequent production builds (only changed textures are re-processed)
- Fix: light normal bias defaults

## [2.55.2-pre] - 2023-01-02
### Exporter
- Change: log warning if node is not installed or can not be found before trying to invoke component compiler
- Fix: handle `node` commands similarly to how `npm` commands work

### Engine
- Add: Rigidbody.gravityScale property
- Add: Gizmos.DrawArrow method
- Add: Rigidbody.getAngularVelocity method
- Fix: Mesh collider center of mass

## [2.55.1-pre] - 2022-12-30
### Exporter
- Add: Command Tester window
- Fix: error on OSX when nvm directory does not exist

### Engine
- Add: Warning when serialized component field name is starting with uppercase letter
- Change: bump component compiler dependency
- Fix: Particle rotation over lifetime
- Fix: Particles should not emit when emission module is disabled
- Fix: LODGroup breaking rendering when used with multi-material objects or added on mesh to be culled directly

## [2.55.0-pre] - 2022-12-21
### Exporter
- Add: PhysicsMaterial support
- Fix Spline export
- Fix: Renderer not exporting enabled bool
- Fix: Dev <> Production build flip in DeployToGlitch component

### Engine
- Add: PhysicsMaterial support
- Add: ``Time.timesScale`` factor
- Change: VideoPlayer exposes underlying HTML video element
- Change: EffectComposer check if ``setPixelRatio`` method exists before calling
- Change: WebARSessionRoot and Rig rotation
- Fix: WebXRController raycast line not being visible in Quest AR
- Fix: Renderer that is disabled initially now hides object
- Fix: Some ParticleSystem worldspace settings when calling emit directly

## [2.54.3-pre] - 2022-12-19
### Exporter
- Change: OSX now automatically trys to detect npm install directory when installed using nvm

## [2.54.2-pre] - 2022-12-19
### Exporter
- Change: Improve SamplesWindow adding search field and better styling
- Change: Rename ``UseProgressiveTextures`` to ``ProgressiveTextureSettings``
- Change: Progressive texture loading can now be disabled completely using ProgressiveTextureSettings component
- Change: Only generate progressive loading textures when building for distribution / making a build for deployment
- Change: Remove internal ``ObjectNames.NicifyVariableNames`` which caused unexpected output for variable names starting with `_`
- Change: Remove unused NavMesh components
- Fix: Help menu item order
- Fix: Sample window styling for single column
- Fix: Initial project generation does now run installation once before replacing template variables which previously caused errors because the paths did not yet exist.

### Engine
- Change: debug parameter can now take ``=0`` for disabling them (e.g. ``freecam=0``)
- Fix: InputField opens keyboard on iOS

## [2.54.1-pre] - 2022-12-15
### Engine
- Fix: issue with progressive loading, loading files multiple times if a texture was used in multiple materials/material slots. This was causing problems and sometimes crashes on mobile devices 
- Fix: balloon messages using cached containers didnt update the message sometimes and displaying an old message instead

## [2.54.0-pre.1] - 2022-12-14
### Engine
- Fix: bump gltf extensions package fixing issue with progressive texture loading when multiple textures had the same name 

## [2.54.0-pre] - 2022-12-14
### Exporter
- Add: custom texture compression and progressive loading settings for Needle Engine platform to texture importer
- Add: support for webp texture compression
- Add: tsc menu item to manually compile typescript from Unity 
- Add: support for spritesheet animationclips
- Add: menu item to open bug reports location
- Change: sort component exports by name
- Change: update UnityGLTF version
- Fix: issue with wrong threejs path being written to package.json causing button "Run Needle Project Setup" to appear on ExportInfo

### Engine
- Add: start and end events for progressive loading
- Add: USDZExporter events for button creation and after export
- Change: apply WebARSessionRoot scale to exported object, e.g. if scene is scaled down on Android it should receive the same scale when exporting for Quicklook
- Fix: process reflection probe update in update event to avoid visible flickr after component enabled state has changed

## [2.53.3-pre.1] - 2022-12-12
### Engine
- Fix: implement ButtonColors

## [2.53.3-pre] - 2022-12-12
### Exporter: 
- Fix: InvalidCastException when trying to export AnimatorOverrideController

### Engine
- Add: GroundProjection appyOnAwake to make it possible to just use it when the environment changes via remote skybox and not apply it to the default skybox
- Change: more strict tsconfig
- Change: allow overriding loading element
- Fix: apply shape module rotation to direction
- Fix: ParticleSystem world position not being set when shape module was disabled

## [2.53.2-pre] - 2022-12-09
### Exporter
- Change: order generated types alphabetically
- Fix: engine export codegen should only run in local dev environment

## [2.53.1-pre] - 2022-12-08
### Exporter
- Fix OSX bugs regarding nvm and additional search paths not being used correctly

## [2.53.0-pre] - 2022-12-08
### Exporter
- Add: progressive build step is now separated from Unity Exporter and runs in the background to transform exported gltfs to be progressively loaded. That requires a ``UseProgressiveTextures`` component in the scene. Textures can be excluded from being processed by adding a ``noprogressive`` AssetLabel
- Add: USDZExpoter component which will display ``Open in Quicklook`` option when running on iOS Safari instead of WebXR not supported message.
- Add: Automatically update @types/three in referenced project dependencies to match types declared in core engine
- Change: Only open dist directory after building when not deploying to either FTP or Glitch
- Change: Display toktx message about non-power-of-two textures as warning in Unity
- Change: DeployToFTP inspector now behaves just like DeployToGlitch (using ALT to toggle build type)

### Engine
- Add: InstantiateIdProvider constructor can now take string too for initializing seed
- Add: USDZExpoter component enabling ``Open in Quicklook`` option by default when running on iOS Safari
- Fix: Light intensity
- Fix: Add workaround texture image encoding issue: https://github.com/needle-tools/needle-engine-support/issues/109
- Fix: OrbitControls.enableKeys
- Fix: Remove warning message about missing ``serializable`` when the reference is really missing
- Fix: ``context.domX`` and ``domY`` using wrong values when in AR mode

## [2.52.0-pre] - 2022-12-05
### Exporter
- Add initial support for Spritesheet export (spritesheet animationclip export will be added in one of the next releases)
- Add: RemoteSkybox environmentBlurriness setting
- Add: environmentBlurriness and -Intensity setting to CameraAdditionalData component
- Update templates tsConfig adding skipLibCheck to avoid errors when types/three have errors
- Change: Dont open dist folder when deploying to a server like FTP or Glitch
- Change: Start server now checks vite.config for configured port
- Change: adjust materials to UnityGltf/PBRGraph for better cross-pipeline compatibility

### Engine
- Add iOS platform util methods
- Add ``?debugrig`` to render XRRig gizmo
- Add support for Spritesheet Animation
- Add: EventTrigger implementations for onPointerClick, onPointerEnter, onPointerExit, onPointerDown, onPointerUp
- Add: RemoteSkybox environmentBlurriness setting
- Fix: Renderer reflection probe event order issue not applying reflection probes when enabling/disabling object because reflection probes have not been enabled
- Fix: remove log in ParticleSystemModules

## [2.51.0-pre] - 2022-11-30
### Exporter
- Add: basic texture compression control using ``ETC1S`` and ``UASTC`` Asset Labels, they can be added to either textures or exported Asset (for example gltf asset) to enforce chosen method in toktx (production builds) 
- Change: Improve BugReporter
- Fix: DefaultAvatar XRFlags
- Fix: Progressive texture export (high-res glb) not using selected texture compression method

### Engine
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
### Exporter
- Add: Skybox export checks to ensure texture is power of two and not bigger than 4k when exported using hdr
- Add: RemoteSkybox component to allow referencing local image texture
- Add: Set UASTC compression to sprite textures to improve production build quality for UI graphics

### Engine
- Add warning to Light when soft shadows change renderer shadow type
- Add: RemoteSkybox can now load jpg and png textures as skybox
- Change: Instantiate does now copy Vector, Quaternion and Euler objects to ensure multiple components dont share the same objects
- Fix: AnimatorController causes threejs error when creating empty animationclip (Blender) 
- Fix: AnimatorController error when transition has no conditions array (Blender)

## [2.49.1-pre] - 2022-11-25
### Engine
- Add circular instantiation check to AssetReference
- Allow filtering ``context.input.foreachPointerId()`` by pointer types (e.g. mouse or touch)
- Fix typescript error in particle system module function (happened only when ``strict`` was set to false in tsconfig)
- Fix XRFlag component not being applied on startup

## [2.49.0-pre] - 2022-11-24
### Exporter
- Change: Exporter now shows dialogue when trying to export lightmaps with wrong Lightmap encoding

### Engine
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
### Exporter
- Add menu item to copy project info to clipboard (``Needle Engine/Report Bug/Copy Project Info``)
- Change: Reduce max size of default cubemap to 256 (instead of 2048)
- Change: ExportInfo can open folder without explicit workspace in workspace
- Change: remove keep names options in react vite template
- Change: move default project path from ``Projects/`` to ``Needle/``
- Change: remove .quit-ar styles from templates
- Fix: Export skybox in referenced prefabs using minimal size (64px) unless otherwise defined

### Engine
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

## [2.47.2-pre] - 2022-11-17
### Exporter
- Add info to log about where to change colorspace from gamma to linear
 
### Engine
- Add: Initial react three fiber components
- Change: OrbitControls made lerp stop distance smaller 
- Change: expose ``*enumerateActions()`` in AnimatorController
- Fix: Flipped custom reflection texture
- Fix: Volume exposure not being applied when no Tonemapping effect was set
- Fix: Volume tonemapping not respecting override state setting
- Fix: ``AudioSource.loop`` not working
- Fix: Collider center being not not applied correctly
- Fix: MeshCollider scale not being applied from object

## [2.47.1-pre] - 2022-11-16
### Exporter
- Bump Engine version and export particle trail material

### Engine
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

## [2.47.0-pre] - 2022-11-14
### Exporter
- Change: AxesHelper component now shows axes like in threejs
- Change: bump UnityGLTF version

### Engine
- Add: RemoteSkybox option to control if its set as background and/or environment
- Add: @serializable decorator, @serializeable will be removed in a future version
- Add: getComponent etc methods to IGameObject interface
- Add: Renderer.enable does now set visible state only without affecting the hierarchy or component active state
- Change: Expose Typestore
- Change: Animation componet does loop by default (use the AdditionalAnimationData component to set the default loop setting)
- Fix: WebXR relative hands path in subfolders
- Fix: Rigidbody did not properly detect object position change if the position change was applied a second time at the exact same target position (it worked setting it once and didnt work in subsequent calls - now it does always detect it)

## [2.46.0-pre] - 2022-11-11
### Exporter
- Change: ``Setup scene`` when creating a new camera it sets near clip plane to smaller value than default
- Change: ExportInfo pick directory button now opens last selected directory if it still exists and is in the same Unity project

### Engine
- Add: Particles limit velocity over time
- Add: Particles rotation by speed
- Add: ParticleSystem play, pause, stop and emit(count) methods
- Add: ``WebXR.showRaycastLine`` exposed so it can be disabled from code
- Fix: issues in applying some forces/values for different scaling and worldspace <> localspace scenarios
- Change: raise input events in core method to also allow receiving WebAR mock touch events
- Change: ``Animation.play()`` does not require argument anymore

## [2.45.0-pre] - 2022-11-10
### Exporter
- Add: gzip option to build menu
- Change default build to not gzipped (can be enabled in Unity's Build Window)
- Change: open output directory after building distribution
- Change: bump UnityGLTF dependency
- Fix: glitch project name must not contain spaces

### Engine
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

## [2.44.2-pre] - 2022-11-09
### Exporter
- add: export of particle mesh
- change: bump UnityGLTF dependency
- change cubemap export: make sure the path for flipping Y and not flipping Y applies the same Y rotation

### Engine
- add ``Graphics.copyTexture``
- add ``Renderer.allowProgressiveLoad``
- add ``Gizmos.DrawBox`` and ``DrawBox3``
- add particles burst emission
- add particles color interpolation between two gradients
- fix: reflection probe material caching for when material is being changed at certain times outside of animation loop and cache applied wrong material
- fix: AnimationCurve evaluation when time and keyframe are both exactly 0
- change: reflection probe now requires anchor override
- change: bump threejs dependency 

## [2.44.1-pre] - 2022-11-07
### Exporter
- Fix: serialization error for destroyed component

### Engine
- Add: start adding particle systems support again
- Change: update dependency version to needle gltf-transform-extensions package
- Change: light set to soft shadows now changes renderer shadow mode to ``VSMShadowMap`` (can be disabled by setting ``Light.allowChangingShadowMapType`` to false)
- Fix: WebXR creating AR button when called from script in awake 
- Fix: ``AnimationCurve.evaluate``

## [2.44.0-pre] - 2022-11-05
### Exporter
- Add: ``Create/Typescript`` can now create script files in ``src/scripts`` if the selected file in the ProjectBrowser is not part of an npmdef - it will create a template typscript file with your entered name and open the workspace
- Change: Update component compiler version fixing codegen for e.g. ``new Vector2(1, .5)`` which previously generated wrong C# code trying to assign doubles instead of floats

### Engine
- Add support for deleting all room state by calling ``context.connection.sendDeleteRemoteStateAll()`` (requires backend to update ``@needle-tools/needle-tiny-networking-ws`` to ``^1.1.0-pre``)
- Add Hinge joint
- Add ``Gizmos.DrawLine``, ``DrawRay`` ``DrawWireSphere`` and ``DrawSphere``
- Add: physics Collision Contacts now contain information about ``impulse`` and ``friction``
- Add ``physics.raycastPhysicsFast`` as a first method to raycast against physics colliders, the returning object contains the point in worldspace and the collider. This is the most simplest and thus fastest way to raycast using Rapier. More complex options will follow in future versions.
- Fix joint matrix calculation
- Fix and improve physics Contacts point calculations  
- Fix issue in physics event callbacks where ``onCollisionStay`` and ``onCollisionExit`` would only be called when ``onCollisionEnter`` was defined

## [2.43.0-pre] - 2022-11-04
### Exporter
- Change: Set template body background to black

### Engine
- Add: physics FixedJoint
- Change: CharacterController now rotates with camera
- Change: scaled mesh colliders are now cached
- Change: disable OrbitControls when in XR
- Change: first enabled camera component sets itself as rendering camera if no camera is yet assigned (mainCamera still overrides that)
- Change: package module field now shows to ``src/needle-engine``
- Change: ``Camera.backgroundColor`` assigning Color without alpha sets alpha to 1 now
- Fix: improved missing ``serializable`` detection / warning: now only shows warning for members actually declared in script 
- Fix: wrong light intensity in VR when light is child of WebARSessionRoot [issue 103](https://github.com/needle-tools/needle-engine-support/issues/103) 

## [2.42.0-pre] - 2022-11-02
### Exporter
- Add: explicit shadow bias settings to ``LightShadowData`` component (can be added via Light component button at the bottom of the component)
- Fix ComponentCompiler / CodeWatcher not starting to watch directory when project is not installed yet
- Fix ``CubemapExporter.ConvertCubemapToEquirectTexture`` now using same codepath as skybox export
- Fix ``ExportInfo.Play`` button does not use same code path as Editor Play button

### Engine
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


## [2.41.0-pre] - 2022-10-28
### Exporter
- Change: enable Auto Reference in Needle Engine asmdef

### Engine
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

## [2.40.0-pre] - 2022-10-26
### Exporter
- Add: Warnings when nesting GltfObjects with gltf models that are only copied to the output directory (effectively not re-exported) with prefab overrides
- Add: Animation component can now be configured with random time scale and offset using the additional data component (see "Add AnimationData" button on Animation component)
- Add: nested .gltf assets now copy their dependencies to the output directory
- Change: Refactor deploy to FTP using ScriptableObjects for server settings
- Change: Better compression is only used when explicitly configured by adding a ``TextureCompressionSettings`` component to the GltfObject because it also increases filesize significantly and is not always needed
- Fix: Remove old texture callback that caused textures to be added to a glb twice in some cases

### Engine
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

## [2.39.3-pre] - 2022-10-24
### Exporter
- Change: Remove GltfObject component from default Avatar prefab
- Fix: DeployToFTP connection error

### Engine
- Add: warning balloon when unknown components are detected and have been most likely forgot to be installed, linking to npmdef docs 
- Fix: dont show serialization warning for builtin components where specific fields are not deserialized on purpose (since right now the serializer does not check which fields are actually implemented) 

## [2.39.2-pre] - 2022-10-24
### Exporter
- Change: Disable timer logs

### Engine
- Change: AudioSource exposes ``clip`` field
- Change: improve error and messaging overlay
- Change: detect when serialized Object3D and AssetReference are missing ``@serializable`` attribute and show message in overlay
- Change: add WebXR hands path to controllers
- Fix: WebXR controllers now use interactable object when grabbing (instead of hit object previously) which fixes interaction with nested hierarchies in XR and DragControls

## [2.39.1-pre] - 2022-10-23
### Exporter
- Fix: improve generating temporary project with npmdef dependencies
- Fix: avoid attempting to start server twice when project is being generated

## [2.39.0-pre] - 2022-10-23
### Exporter
- Add DeployToFTP component
- Fix automatically installing dependencies to temporary project when the project was already generated from another scene

### Engine
- Change: Renderer ``material`` is now ``sharedMaterial`` to make it more clear for Unity devs that the material is not being cloned when accessed
- Fix: When not specifying any explicit networking backend for glitch deployment it now falls back to the current glitch instance for networking

## [2.38.1-pre] - 2022-10-21
### Exporter
- Add: creating npmdef now automatically creates ``index.ts`` entry point (and adds it to ``main`` in package.json)
- Change: bump UnityGLTF dependency

### Engine
- Add: Screenshare component ``share`` method now takes optional options to configure device and MediaStreamConstraints for starting the stream 
- Fix: WebXR should show EnterVR button when enabled in Unity
- Fix: component ``enable`` boolean wasnt correctly initialized when loaded from gltf
- Fix: Object3D prototype extensions weren't correctly applied anymore
- Fix: Interaction bug when using DragControls with OrbitControls with multitouch

## [2.38.0-pre] - 2022-10-20
### Exporter
- Add: toktx compression extension is now automatically used, can be disabled by adding the ``TextureCompressionSettings`` component to the GltfObject and disabling it
- Change: adjust menu items

### Engine
- Add ``Renderer.mesh`` getter property
- Change: ``Renderer.material`` now returns first entry in ``sharedMaterials`` array so it automatically works in cases where a Renderer is actually a multi-material object
- Change: warn when trying to access components using string name instead of type
- Change: update needle gltf-transform-extensions to 0.6.2
- Fix: remove log from UIRaycastUtil
- Fix: move TypeStore import in builtin engine again to not break cases where ``import @needle-engine`` was never used
- Fix: React3Fiber template and AR overlay container access when using react

## [2.37.1-pre] - 2022-10-19
### Exporter
- Change: allow overriding minimum skybox resolution for root scene (minimum is 64)

### Engine
- Change: unify component access methods, first argument is now always the object with the component type as second argument
- Fix physics collision events throwing caused by refactoring in last version
- Fix loading screen css

## [2.37.0-pre] - 2022-10-19
### Exporter
- Add ``ImageReference`` type: textures exported as ``ImageReference`` will be copied to output assets directory and serialized as filepaths instead of being included in glTF
- Change: Reduce default size of progressive textures (in ``UseProgressiveTextures`` component)
- Change: Update UnityGLTF dependency fixing normal export bug and serializing text in extensions now using UTF8

### Engine
- Change: First pass of reducing circular dependencies
- Change: Update @needle-tools/gltf-transform-extensions version
- Change: Update component compiler to 1.9.0. Changed include:
   * Private and protected methods will now not be emitted anymore
   * ``onEnable/onDisable`` will be emitted as ``OnEnable`` and ``OnDisable`` [issue 93](https://github.com/needle-tools/needle-engine-support/issues/93)
- Change: handle Vector3 prototype extensions
- Fix: issue with UI causing rendering to break when enabling text components during runtime that have not yet been active before
- Fix: OrbitControls LookAtConstraint reference deserialization
- Fix: WebXRController raycasting against UI marked as ``noRaycastTarget`` or in CanvasGroup with disabled ``interactable`` or ``blocksRaycast``

## [2.36.0-pre] - 2022-10-17
### Exporter
- Change: Move Screensharing aspect mode settings into VideoPlayer component (in ``VideoPlayerData``)

### Engine
- Add: start adding support for 2D video overlay mode
- Change: Install threejs from @needle-tools/npm - this removes the requirement to have git installed and should fix a case where pulling the package from github would fail 
- Change: Move Screensharing aspect mode settings into VideoPlayer component
- Change: Move ``InstancingUtils`` into ``engine/engine_instancing.ts``
- Change: BoxCollider now checks if ``attachedRigidBody`` is assigned at start
- Change: Collision now exposes internal cannon data via ``__internalCollision`` property
- Fix: EventSystem now properly unsubscribes WebXRController events

## [2.35.5-pre] - 2022-10-17
### Exporter
- Change: rename ``codegen/exports.ts`` to ``codegen/components.ts``
- Change: ScreenCapture component has explicit VideoPlayer component reference to make it clear how it should be used
 
### Engine
- Add: ScreenCapture has mode for capturing webgl canvas (unfortunately it doesnt seem to work well in Chrome or Firefox yet)
- Change: move threejs prototype extensions into own file and make available to vanilla js builds
- Change: ScreenCapture component has explicit VideoPlayer component reference
- Fix: animating properties on custom shaders

## [2.35.4-pre] - 2022-10-15
### Exporter
- Change: dont automatically run install on referenced npmdefs when performing export
- Fix issue where browser scrollbar would flicker in certain cases when OS resolution was scaled 

### Engine
- Add: start implementing trigger callbacks for ``onTriggerEnter``, ``onTriggerExit`` and ``onTriggerStay``
- Change: ``GameObject.setActive`` now updates ``isActiveAndEnabled`` state and executes ``awake`` and ``onEnable`` calls when the object was activated for the first time (e.g. when instantiating from an previously inactive prefab)
- Change: improve collision callback events for components (``onCollisionEnter``, ``onCollisionExit`` and ``onCollisionStay``)
- Change: this.context.input keycode enums are now strings
- Fix: local dev error overlay now also displays errors that happen before web component is completely loaded (e.g. when script has import error)
- Fix: Rigidbody force is now correctly applied when the component was just instantiated (from inactive prefab) and added to the physics world for the first time
- Fix: DragControls component keyboard events ("space" and "d" for modifying height and rotation)

## [2.35.3-pre] - 2022-10-14
### Exporter
- Change: delete another vite cache
- Change: improve Codewatcher for scripts in ``src/scripts``

## [2.35.2-pre] - 2022-10-14
### Exporter
- Change: delete vite caches before starting server

## [2.35.1-pre] - 2022-10-14
### Exporter
- Change: only serialize used Camera fields
- Change: prevent serializing TextGenerator
- Change: prevent exporting Skybox if no skybox material exists
- Change: prevent installing referenced npmdefs while server is running hopefully fixing some issues wiht vite/chrome where type declarations become unknown
- Fix: loading relative font paths when exported via Asset context menu

### Engine
- Change: Rigidbody now tracks position changes to detect when to update/override simulated physics body
- Fix: loading relative font paths when exported via Asset context menu

## [2.35.0-pre] - 2022-10-13
### Exporter
- Change: make default SyncCam prefab slightly bigger
- Change: log error when ExportInfo GameObject is disabled in the hierarchy

### Engine
- Add: inital ScreenCapture component for sharing screens and camera streams across all connected users
- Add: ``onCollisionEnter``, ``onCollisionStay`` and ``onCollisionExit`` event methods to components

## [2.34.0-pre] - 2022-10-12
### Exporter
- Add temporary support for legacy json pointer format
- Add warning to Build Window when production build is selected but installed toktx version does not match recommended version
- Add warning if web project template does not contain package.json
- Add react template
- Add: allow exporting glbs from selected assets via context menu (previously this only worked in scene hierarchy, it now works also in project window)
- Changed: SpectatorCam improvements, copying main camera settings (background, skybox, near/far plane)
- Changed: improved ExportInfo when selecing web project template
- changed: dont export hidden Cinemachine Volume component
- Changed: update UnityGLTF dependency
- Changed: use source identifier everywhere to resolve absolute uri from relative uris as a first step of loading glbs including dependencies from previously unknown directories
- Fix: when exporting selected glbs with compression all dependent glbs (with nested references) will automatically also be compressed after export
- Fix: Cubemap rotation

### Engine
- Add: Quest 2 passthrough support
- Add: UI Graphic components now support ``raycastTarget`` again
- Add: VideoPlayer now supports ``materialTarget`` option which allows for assigning any renderer in the scene that should be used as a video canvas
- Changed: updated three-mesh-ui dependency version
- Changed: updated needle-gltfTransform extensions package, fixing an issue with passthrough of texture json pointers
- Changed: selecting SpectatorCam now requires click (instead of just listening to pointer up event)
- Fix: Avatars using instanced materials should now update transforms correctly again

## [2.33.0-pre] - 2022-10-10
### Exporter
- Fix: error log caused by unused scene template subasset
- Change: allow exporting ParticleSystem settings
- Change: re-word some unclear warnings, adjust welcome window copy
- Change: dont automatically open output folder after building

### Engine
- Add: Context.removeCamera method
- Add: SpectatorCam allows to follow other users across devices by clicking on respective avatar (e.g. clicking SyncedCam avatar or WebXR avatar, ESC or long press to stop spectating)
- Add: ``Input`` events for pointerdown, pointerup, pointermove and keydown, keyup, keypress. Subscribe via ``this.context.input.addEventListener(InputEvents.pointerdown, evt => {...})`` 
- Change: Default WebXR rig matches Unity forward
- Fix: WebXRController raycast line being rendered as huge line before first world hit
- Fix: SpectatorCam works again
- Fix: ``serializable()`` does now not write undefined values if serialize data is undefined
- Fix: exit VR lighting

## [2.32.0-pre] - 2022-10-07
### Exporter
- Add: toktx warning if toktx version < 4.1 is installed.
- Add: button to download recommended toktx installer to Settings 
- Change: Bump UnityGLTF version
- Change: Builder will install automatically if Needle Engine directory is not found

### Engine
- Add: ``resolutionScaleFactor`` to context
- Fix ``IsLocalNetwork`` regex
- Fix custom shaders failing to render caused by json pointer change
- Change: rename Context ``AROverlayElement`` to ``arOverlayElement``

## [2.31.0-pre] - 2022-10-06
### Exporter
- Add first version of TextureCompressionSettings component which will modify toktx compression settings per texture
- Fix skybox export being broken sometimes
- Fix Vite template update version of vite compression plugin to fix import error
- Change: json pointers now have correct format (e.g. ``/textures/0`` instead ``textures/0``)
- Change: Bump needle glTF transform extensions version

### Engine
- Fix: EventList failing to find target when targeting a Object3D without any components
- Fix: text now showing up when disabling and enabling again after the underlying three-mesh-ui components have been created
- Fix: Builtin sprites not rendering correctly in production builds
- Change: Bump needle glTF transform extensions version
- Change: json pointers now have correct format (e.g. ``/textures/0`` instead ``textures/0``)
- Change: Bump UnityGLTF version

## [2.30.1-pre] - 2022-10-05
### Exporter
- Fix animating ``activeSelf`` on GameObject in canvas hierarchy
- Fix ExportInfo directory picker
- Removed unused dependencies in Vite project template
- Removed wrapper div in Vite project template

### Engine
- Fix animating ``activeSelf`` on GameObject in canvas hierarchy
- Fix SpectatorCam component
- Fix WebXRController raycast line being rendered as huge line before first world hit

## [2.30.0-pre] - 2022-10-05
### Exporter
- Add: experimental AlignmentConstraint and OffsetConstraint
- Fix: font-gen script did use require instead of import
- Change: delete vite cache on server start

### Engine
- Add: experimental AlignmentConstraint and OffsetConstraint
- Remove: MeshCollider script since it is not supported yet
- Change: Camera does now use XRSession environment blend mode to determine if background should be transparent or not.
- Change: WebXR exposes ``IsInVR`` and ``IsInAR``
- Fix: RGBAColor copy alpha fix
- Fix: Avatar mouth shapes in networked environment

## [2.29.1-pre] - 2022-10-04
### Exporter
- Add folder path picker to ExportInfo
- Change message on first installation and when a project does not exist yet
- Change prevent projects being generated in Assets and Packages folders

### Engine
- Change: DropListener file drop event does send whole gltf instead of just the scene

## [2.29.0-pre] - 2022-10-04
### Exporter
- Add: Local error overlay shows in AR
- Add: itchio inspector build type can now be toggled by holding ALT
- Fix: URP 12.1 api change
- Change: Vite template is updated to Vite 3
- Change: Bump UnityGLTF dependency
- Change: Move glTF-transform extension handling into own package, using glTF transform 2 now

### Engine
- Add: allow overriding draco and ktx2 decoders on <needle-engine> web component by setting ``dracoDecoderPath``, ``dracoDecoderType``, ``ktx2DecoderPath`` 
- Add: ``loadstart`` and ``progress`` events to <needle-engine> web component
- Fix rare timeline animation bug where position and rotation of objects would be falsely applied
- Change: update to three v145
- Change: export ``THREE`` to global scope for bundled version

## [2.28.0-pre] - 2022-10-01
### Exporter
- Remove: legacy warning on SyncedCamera script
- Fix: exception during font export or when generating font atlas was aborted
- Change: Export referenced gltf files using relative paths
- Change: Bump runtime engine dependency

### Engine
- Add: make engine code easily accessible from vanilla javascript
- Fix: handle number animation setting component enable where values are interpolated
- Change: Remove internal shadow bias multiplication
- Change: Addressable references are now resolved using relative paths
- Change: Update package json

## [2.27.2-pre] - 2022-09-29
### Exporter
- Bump runtime engine dependency 

### Engine
- Add: Light component shadow settings can not be set/updated at runtime
- Fix: enter XR using GroundProjectedEnv component
- Fix: Light shadows missing when LightShadowData component was not added in Unity (was using wrong shadowResolution)
- Change: dont allow raycasting by default on GroundProjectedEnv sphere

## [2.27.1-pre.1] - 2022-09-29
### Exporter
- Fix compiler flag bug on OSX [issue 76](https://github.com/needle-tools/needle-engine-support/issues/76)

## [2.27.1-pre] - 2022-09-29
### Exporter
- Add: Detect outdated threejs version and automatically run ``npm update three``
- Add: shadow resolution to LightShadowData component
- Add: Warning to GroundProjectedEnvironment inspector when camera far plane is smaller than environment radius

### Engine
- Add: Light exposes shadow resolution

## [2.27.0-pre] - 2022-09-28
### Exporter
- Add RemoteSkybox component to use HDRi images from e.g. polyhaven
- Add GroundProjectedEnv component to use threejs skybox projection 

### Engine
- Add RemoteSkybox component to use HDRi images from e.g. polyhaven
- Add GroundProjectedEnv component to use threejs skybox projection 
- Fix: export ``GameObject`` in ``@needle-tools/engine``

## [2.26.1-pre] - 2022-09-28
### Exporter
- Add LightShadowData component to better control and visualize directional light settings

### Engine
- Add: ``noerrors`` url parameter to hide overlay
- Fix: WebXR avatar rendering may be visually offset due to root transform. Will now reset root transform to identity

## [2.26.0-pre] - 2022-09-28
### Exporter
- Add: tricolor environment light export
- Add: generate exports for all engine components
- Add: export for InputActions (NewInputSystem)

### Engine
- Add: ``@needle-tools/engine`` now exports all components
- Add: environment light from tricolor (used for envlight when set to custom but without custom cubemap assigned)
- Add: show console error on screen for localhost / local dev environment
- Fix: create environment lighting textures from exported colors
- Change: UI InputField expose text
- Change: Bump threejs version to latest (> r144) which also contains USDZExporter PR

## [2.25.2-pre] - 2022-09-26
### Exporter
- Fix collab sandbox scene template, cleanup dependencies
- Fix ShadowCatcher export in Built-in RP
- Fix WebHelper nullreference exception
- Change: remove funding logs, improve log output
- Change: exporting with wrong colorspace is now an error
- Change: Bump UnityGLTF dependency
- Change: add log to Open VSCode workspace

### Engine
- Add: custom shader set ``_ScreenParams``
- Change: DropListener event ``details`` now contains whole gltf file (instead of just scene object)

## [2.25.1-pre] - 2022-09-23
### Exporter
- Bump Engine dependency

### Engine
- Add: AudioSource volume and spatial blending settings can now be set at runtime
- Fix: AudioSource not playing on ``play`` when ``playOnAwake`` is false

## [2.25.0-pre] - 2022-09-23
### Exporter
- Add: automatically include local packages in vscode workspace
- Add: experimental progressive loading of textures
- Fix: Catch ``MissingReferenceException`` in serialization
- Fix: Environment reflection size clamped to 256 for root glb and 64 pixel for referenced glb / asset
- Fix: ShadowCatcher inspector info and handle case without renderer
- Change: ComponentGen types are regenerated when player scriptcount changes

### Engine
- Add: VideoPlayer crossorigin attribute support
- Add: ``debuginstancing`` url parameter flag
- Add: Image handle builtin ``Background`` sprite
- Add: Component now implements EventTargt so you can use ``addEventListener`` etc on every component
- Add: EventList does automatically dispatch event with same name on component. E.g. UnityEvent named ``onClick`` will be dispatched on component as ``on-click``
- Add: experimental progressive loading of textures
- Add: ``WebXR`` exposes ``IsARSupported`` and ``IsVRSupported``
- Fix: remove Ambient Intensity
- Fix: ShadowCatcher material should not write depth

## [2.24.1-pre] - 2022-09-22
### Exporter
- Remove: all scriban templating
- Change: TypeUtils clear cache ond recompile and scene change
- Change: move SyncedCamera into glb in Sandbox template
- Change: Show warning in GltfObject inspector when its disabled in main scene but not marked as editor only since it would still be exported and loaded on startup but most likely not used
- Change: scene template assets use UnityGLTF importer by default
- Change: TypeInfoGenerator for component gen does now prioritize types in ``Needle`` namespace (all codegen types), ``Unity`` types and then everything else (it will also only include types in ``Player`` assemblies)

### Engine
- Fix: SpatialTrigger intersection check when it's not a mesh
- Fix: UnityEvent / EventList argument of ``0`` not being passed to the receiving method
- Fix: Physics rigidbody/collider instantiate calls
- Fix: Physics rigidbody transform changes will now be applied to internal physics body 
- Fix: ``needle-engine.getContext`` now listens to loading finished event namely ``loadfinished``
- Change: cleanup some old code in Rigidbody component

## [2.24.0-pre] - 2022-09-21
### Exporter
- Add: new ``DeployToItch`` component that builds the current project and zips it for uploading to itch.io
- Add: FontGeneration does not try to handle selected font style
- Add: Show ``SmartExport`` dirty state in scene hierarchy (it postfixes the name with a *, similar to how scene dirty state is visualized)
- Add: ``Collect Logs`` now also includes all currently known typescript types in cache
- Remove: legacy ``ScriptEmitter`` and ``TransformEmitter``. Code outside of glb files will not be generated anymore
- Change: Renamed ``Deployment`` to ``DeployToGlitch``
- Change: Set typescript cache to dirty on full export
- Change: automatically run ``npm install`` when opening npmdef workspace
- Change: Bump UnityGLTF dependency to ``1.16.0-pre`` (https://github.com/prefrontalcortex/UnityGLTF/commit/aa19dd2a4f2f3f533888deb47920af6a6b4bf80b)
- Fix: ``Setup Scene`` context menu now sets directional light shadow when creating a light
- Fix: "Project Install Fix" did sometimes fail if an orphan but empty folder was still present in node_modules and ``npm install`` didn't install the missing package again 
- Fix: Exception where FullExport would fail if no ``caches~`` directory exists
- Fix: CodeWatcher threading exception when many typescript files changed (or are added) at once
- Fix: FontGenerator issue where builtin fonts would be unnecessarily re-generated
- Fix: Regression in custom reflection texture export

### Engine
- Add: initial support for ``InputField`` UI (rendering, input handling on desktop, mobile and AR, change and endedit events)
- Add: ``EventList.invoke`` can now handle an arbitrary number of arguments
- Change: lower double click threshold to 200ms instead of 500ms
- Change: runtime font-style does not change font being used in this version. This will temporarely break rich text support.
- Fix: custom shader regression where multiple objects using the same material were not rendered correctly
- Fix: Text sometimes using invalid path
- Fix: Remove unused imports

## [2.23.0-pre] - 2022-09-20
### Exporter
- Add: support for ignoring types commented out using ``//``. For example ``// export class MyScript ...``
- Add: ``Setup Scene`` context menu creates directional light if scene contains no lights
- Add: support for environment light intensity multiplier
- Change: typescache will only be updated on codegen, project change or dependencies changed
- Change: improve font caching and regenerating atlas for better dynamic font asset support

### Engine
- Add basic support for ``CameraDepth`` and ``OpaqueTexture`` (the opaque texture still contains transparent textures in this first version) being used in custom shaders

## [2.22.1-pre] - 2022-09-17
### Exporter
- Fix missing dependency error when serialized depedency in ExportInfo was installed to package.json without the npmdef being present in the project.
- Fix typo in BoxGizmo field name

### Engine
- Improve Animator root motion blending
- Fix SpatialTrigger error when adding both SpatialTrigger as well as SpatialTrigger receiver components to the same object
- AnimatorController can now handle states with empty motion or missing clips

## [2.22.0-pre] - 2022-09-15
### Exporter
- Add: automatic runtime font atlas generation from Unity font assets 
- Change: setup scene menu item does not create grid anymore and setup scene
- Fix: serialization where array of assets that are copied to output directory would fail to export when not all entries of the array were assigned
- Fix: obsolete SRP renderer usage warning in Unity 2021
- Fix: serialize LayerMask as number instead of as ``{ value: <number> }`` object

### Engine
- Add: automatic runtime font atlas generation from Unity font assets 
- Remove: shipped font assets in ``include/fonts``
- Fix: Physics pass custom vector into ``getWorldPosition``, internal vector buffer size increased to 100
- Fix: SpatialTrigger and SpatialTrigger receivers didnt work anymore due to LayerMask serialization

## [2.21.1-pre] - 2022-09-14
### Exporter
- Bump Needle Engine version
- Fix: WebXR default avatar hide hands in AR
- Change: UI disable shadow receiving and casting by default, can be configured via Canvas

### Engine
- Change: UI disable shadow receiving and casting by default, can be configured via Canvas
- Fix: ``gameObject.getComponentInParent`` was making false call to ``getComponentsInParent`` and returning an array instead of a single object
- Fix: light intensity in AR

## [2.21.0-pre] - 2022-09-14
### Exporter
- Remove legacy UnityGLTF export warning
- Fix: add dependencies to Unity package modules (this caused issues when installing in e.g. URP project template)
- Change: will stop running local server before installing new package version
- Change: Bump UnityGLTF version to 1.15.0-pre

### Engine
- Add: first draft of Animator root motion support
- Fix: ``Renderer.sharedMaterials`` assignment bug when GameObject was mesh
- Fix: Buttons set to color transition did not apply transition colors
- Fix: UI textures being flipped
- Fix: UI textures were not stretched across panel but instead being clipped if the aspect ratio didnt match perfectly

## [2.20.0-pre] - 2022-09-12
### Exporter
- Add Timeline AnimationTrack ``SceneOffset`` setting export
- Change: improved ProjectReporter (``Help/Needle Engine/Zip Project``)

### Engine
- Add stencil support to ``Renderer``
- Add timeline ``removeTrackOffset`` support
- Fix timeline animation track offset only being applied to root
- Fix timeline clip offsets not being applied when no track for e.g. rotation or translation exists

## [2.19.0-pre] - 2022-09-11
### Exporter
- Add ShadowCatcher enum for toggling between additive and ShadowMask
- Add initial support for exporting URP RenderObject Stencil settings
- Add support for animating ``activeSelf`` and ``enabled``
- Change: improved ProjectReporter (``Help/Needle Engine/Zip Project``)
- Bump: UnityGLTF dependency

### Engine
- Add initial UI anchoring support
- Add initial support for URP RenderObject Stencil via ``NEEDLE_render_objects`` extension

## [2.18.3-pre] - 2022-09-09
### Exporter
- Bump runtime engine dependency

### Engine
- Fix UI transform handling for [issue 42](https://github.com/needle-tools/needle-engine-support/issues/42) and [issue 30](https://github.com/needle-tools/needle-engine-support/issues/30)
- Fix AudioSource not restarting to play at onEnable when ``playOnAwake`` is true (this is the default behaviour in Unity)

## [2.18.2-pre] - 2022-09-09
### Exporter
- Change default skybox size to 256
- Fix hash cache directory not existing in certain cases

### Engine
- Fix RGBAColor not implementing copy which caused alpha to be set to 0 (this caused ``Camera.backgroundColor`` to not work properly)

## [2.18.1-pre.1] - 2022-09-08
### Exporter
- Fix gitignore not found
- Fix hash cache directory not existing in certain cases

## [2.18.0-pre] - 2022-09-08
### Exporter
- Add ``Zip Project`` in ``Help/Needle Engine/Zip Project`` that will collect required project assets and data and bundle it

## [2.17.3-pre] - 2022-09-07
### Exporter
- Add auto fix if .gitignore file is missing
- Add menu item to only build production dist with last exported files (without re-exporting scene)
- Fix dependency change event causing error when project does not exist yet / on creating a new project
- Fix updating asset hash in cache directory when exporting

### Engine
- Add support to set OrbitControls camera position immediately

## [2.17.2-pre] - 2022-09-07
### Exporter
- Bump Engine dependency version

### Engine
- Fix EventList invocation not using deserialized method arguments

## [2.17.1-pre] - 2022-09-07
### Exporter
- Fix DirectoryNotFound errors caused by dependency report and depdendency cache
- Fix writing dependency hash if exported from play buttons (instead of save) and hash file doesnt exist yet

## [2.17.0-pre] - 2022-09-07
### Exporter
- Add export on dependency change and skip exporting unchanged assets
- Add ``EmbedSkybox`` toggle on GltfObject component
- Add simple skybox export size heuristic when no texture size is explictly defined (256 for prefab skybox, 1024 for scene skybox)
- Add debug information log which allows for basic understanding of why files / assets were exported
- Remove old material export code
- Change: clamp skybox size to 8px
- Fix skybox texture settings when override for Needle Engine is disabled, fallback is now to default max size and size
- Fix exceptions in ``Collect Logs`` method
- Fix Glitch ``Deploy`` button to only enable if deployment folder contains any files

### Engine
- Add ``context`` to ``StateMachineBehaviour``
- Fix ``StateMachineBehaviour`` binding (event functions were called with wrong binding)

## [2.16.0-pre.3] - 2022-09-06
### Exporter
- Fix compiler error when no URP is installed in project

### Engine
- Fix deserialization error when data is null or undefined

## [2.16.0-pre.1] - 2022-09-05
### Exporter
- Add EXR extension and export (HDR skybox)
- Add initial tonemapping and exposure support (start exporting Volume profiles)
- Add AR ShadowCatcher
- Add automatic re-export of current scene if referenced asset changes
- Fix potential nullref in BugReporter
- Change: add additional info to test npm installed call 
- Change server process name to make it more clear that it's the local development server process 
- Change: bumb UnityGLTF dependency

### Engine
- Add initial tonemapping and exposure support
- Add AR shadow catcher
- Fix objects parented to camera appear behind camera
- Fix reticle showing and never disappearing when no WebARSessionRoot is in scene
- Fix WebARSessionRoot when on same gameobject as WebXR component
- Fix deserialization of ``@serializable(Material)`` producing a new default instance in certain cases
- Fix ``OrbitControls`` enable when called from UI button event
- Fix EventList / UnityEvent calls to properties (e.g. ``MyComponent.enable = true`` works now from UnityEvent)

## [2.15.1-pre] - 2022-09-02
### Exporter
- Add skybox export using texture importer settings (for Needle Engine platform) if you use a custom cubemap
- Bump ShaderGraph dependency
- Fix compiler error in Unity 2021
- Change automatically flag component compiler typemap to be regenerated if any generated C# has compiler errors

### Engine
- Change: ``OrbitControls.setTarget`` does now lerp by default. Use method parameter ``immediate`` to change it immediately
- Change: bump component compiler dependency to ``1.8.0``

## [2.14.2-pre] - 2022-09-01
### Exporter
- Bump runtime dependency
- Fix settings window not showing settings when nodejs/npm is not found

### Engine
- Fix EventList serialization for cross-glb references
- Fix AnimatorController transition from state without animation

## [2.14.0-pre] - 2022-09-01
### Exporter
- Add: mark GltfObjects in scene hierarchy (hierarchy elements that will be exported as gltf/glb files)
- Add FAT32 formatting check and warning
- Fix: setup scene
- Fix: try improving ComponentGenerator component to watch script/src changes more reliably

### Engine
- Fix: skybox/camera background on exit AR
- Change: AnimatorController can now contain empty states
- Change: Expose ``Animator.Play`` transition duration

## [2.13.1-pre] - 2022-08-31
### Exporter
- Fix UnityEvent argument serialization 
- Fix generic UnityEvent serialization 

## [2.13.0-pre] - 2022-08-31
### Exporter
- Add report bug menu items to collect project info and logs
- Remove legacy ResourceProvider code

### Engine
- Improved RectTransform animation support and canvas element positioning
- Fix ``Animator.Play``
- Change: Expose ``AnimatorController.FindState(name)`` 

## [2.12.1-pre] - 2022-08-29
### Exporter
- Fix UnityEvent referencing GameObject

## [2.12.0-pre] - 2022-08-29
### Exporter
- Add UI to gltf export
- Add better logging for Glitch deployment to existing sites that were not remixed from Needle template and dont expose required deployment api
- Add AnimatorController support for any state transitions

### Engine
- Add UI to gltf export
- Add button animation transition support for triggers ``Normal``, ``Highlighted`` and ``Pressed``

## [2.11.0-pre] - 2022-08-26
### Exporter
- Add Linux support
- Add additional npm search paths for OSX and Linux to the settings menu
- Add ShaderGraph dependency to fix UnityGLTF import errors for projects in 2021.x
- Fix exporting with Animation Preview enabled

### Engine
- Add ``Canvas.renderOnTop`` option
- Fix ``OrbitControls`` changing focus/moving when interacting with the UI
- Fix nullref in AnimatorController with empty state

## [2.10.0-pre] - 2022-08-25
### Exporter
- Add export for ``Renderer.allowOcclusionWhenDynamic``
- Fix issue in persistent asset export where gameObjects would be serialized when referenced from within an asset

### Engine
- Add export for ``Renderer.allowOcclusionWhenDynamic``
- Fix: bug in ``@serializable`` type assignment for inherited classes with multiple members with same name but different serialized types
- Change: ``GameObject.findObjectOfType`` now also accepts an object as a search root

## [2.9.5-pre] - 2022-08-25
### Exporter
- OSX: add homebrew search path for npm

### Engine
- Fix canvas button breaking orbit controls [issue #4](https://github.com/needle-tools/needle-engine-support/issues/4)

## [2.9.4-pre.1] - 2022-08-23
### Exporter
- Fix glitch component for private projects

## [2.9.3-pre] - 2022-08-23
### Exporter
- Fix passing UnityGLTF export settings to exporter
- Fix old docs link
- Fix timeline extension export in certain cases, ensure it runs before component extension export
- Update minimal template

### Engine
- Fix SyncedRoom to not append room parameter multiple times

## [2.9.2-pre] - 2022-08-22
### Exporter
- Fix: Minor illegal path error
- Change: ExportInfoEditor ``Open`` button to open exporter package
- Change: ExportInfoEditor clear versions cache when clicking update button

### Engine
- Add: Timeline AudioTrack nullcheck when audio file is missing
- Fix: AnimatorController error when behaviours are undefined
- Change StateMachineBehaviour methods to be lowercase

## [2.9.1-pre] - 2022-08-22
### Exporter
- Fix build errors and compilation warnings

## [2.9.0-pre] - 2022-08-22
### Exporter
- Add initial StateMachineBehaviour support with "OnStateEnter", "OnStateUpdate" and "OnStateExit"
- Update UnityGLTF dependency
- Fix: prevent scene templates from cloning assets even tho cloning was disabled
- Fix: ifdef for URP

### Engine
- Add initial StateMachineBehaviour support with "OnStateEnter", "OnStateUpdate" and "OnStateExit"
- Fix input raycast position calculation for scrolled content

## [2.8.2-pre] - 2022-08-22
### Exporter
- Fix exporting relative path when building distribution: audio path did produce absolute path because the file was not yet copied
- Fix bundle registry performance bug causing a complete reload / recreation of FileSystemWatchers
- Fix texture pointer remapping in gltf-transform opaque extension
- Change: skip texture-transform for textures starting with "Lightmap" for now until we can configure this properly 

### Engine
- Fix texture pointer remapping in gltf-transform opaque extension
- Change: skip texture-transform for textures starting with "Lightmap" for now until we can configure this properly 

## [2.8.1-pre] - 2022-08-19
### Exporter
- Fix rare timeline export issue where timeline seems to have cached wrong data and needs to be evaluated once
- Update sharpziplip dependency

## [2.8.0-pre] - 2022-08-18
### Exporter
- Add new template with new beautiful models
- Change start server with ip by default from Play button too
- Fix Glitch deployment inspector swapping warning messages when project does not exist
- Fix certificate error spam when port is blocked by another server

### Engine
- Add scale to instantiation sync messages
- Fix ``BoxHelper``
- Fix AR reticle being not visible when ``XRRig`` is child of ``WebARSessionRoot`` component
- Fix exception in ``DragControls`` when dragged object was deleted while dragging

## [2.7.0-pre] - 2022-08-18
### Exporter
- Change name of ``KHR_webgl_extension`` to ``NEEDLE_webgl_extension``
- Change start server to use IP by default (ALT to open with localhost)
- Fix export cull for ShaderGraph with ``RenderFace`` option (instead of ``TwoSided`` toggle)

### Engine
- Change name of ``KHR_webgl_extension`` to ``NEEDLE_webgl_extension``
- Change: dont write depth for custom shader set to transparent 
- Deprecate and disable ``AssetDatabase``

## [2.6.1-pre] - 2022-08-17
### Exporter
- Add codegen buttons to npmdef inspector (regenerate components, regenerate C# typesmap)
- Add DefaultAvatar and SyncedCam default prefab references
- Change: allow cancelling process task when process does not exist anymore
- Change: ExportInfo inspector cleanup and wording
- Fix Timeline Preview on export (disable and enable temporarely)
- Fix constant names
- Fix XR buttons in project templates
- Fix VideoPlayer for iOS
- Fix Editor Only hierarchy icon
- Fix order of menu items and cleanup/remove old items
- Fix timeline clip offset when not offset should be applied
- Fix project templates due to renamed web component
- Fix and improve setup scene menu item

### Engine
- Add ``Mathf.MoveTowards``
- Change: rename ``needle-tiny`` webcomponent to ``needle-engine``
- Fix ordering issue in needle web component when codegen.js is executed too late

## [2.5.0-pre] - 2022-08-16
### Exporter
- Add ShaderGraph double sided support
- Add ShaderGraph transparent support
- Add SyncedCamera prefab support
- Remove legacy shader export code

### Engine
- Add SyncedCamera prefab/AssetReference support
- Add TypeArray support for ``serializable`` to provide multiple possible deserialization types for one field (e.g. ``serializable([Object3D, AssetReference])`` to try to deserialize a type as Object3D first and then as AssetReference)

## [2.4.1-pre] - 2022-08-15
### Exporter
- Add error message when trying to export compressed gltf from selection but engine is not installed.

### Engine
- Add event callbacks for Gltf loading: ``BeforeLoad`` (use to register custom extensions), ``AfterLoaded`` (to receive loaded gltf), ``FinishedSetup`` (called after components have been created)

## [2.4.0-pre] - 2022-08-15
### Exporter
- Add minimal analytics for new projects and installations
- Add log to feedback form
- Fix minor context menu typo

## [2.3.0-pre] - 2022-08-14
### Exporter
- Add warning to Camera component when background type is solid color and alpha is set to 0
- Add ``CameraARData`` component to override AR background alpha
- Change Glitch deployment secret to only show secret in plain text when ALT is pressed and mouse is hovered over password field 
- Fix ``ExportInfo`` editor "(local)" postfix for installed version text at the bottom of the inspector
- Fix scene templates build command
- Fix Glitch project name paste to not wrongly show "Project does not exist"

### Engine
- Fix AnimatorController exit state
- Fix AR camera background alpha to be fully transparent by default 

## [2.2.1-pre] - 2022-08-12
### Exporter
- Add: Export context menu to scene hierarchy GameObjects
- Fix: Multi column icon rendering in ProjectBrowser
- Fix: Builder now waits for installation finish
- Fix: Copy include command does not log to console anymore
- Fix: Invalid glb filepaths
- Fix: URP light shadow bias exported from RendererAsset (when setup in light)

### Engine
- Fix: light shadow bias

## [2.2.0-pre] - 2022-08-11
### Exporter
- Add: Problem solver "Fix" button
- Change: Use Glitch Api to detect if a project exists and show it in inspector
- Change: Typescript template file
- Change: Disable codegen for immutable packages
- Change: Improved problem solver messages
- Change: Renamed package.json scripts
- Change: Run "copy files" script on build (to e.g. load pre-packed gltf files at runtime when project was never built before)
- Fix: Logged Editor GUI errors on export
- Fix: gltf-transform packing for referenced textures via pointers
- Fix: Don't try to export animations for "EditorOnly" objects in timeline
- Fix: ComponentLink does now npmdef VSCode workspace

### Engine
- Add ``@needle-tools/engine`` to be used as import for "most used" apis and functions
- Change: remove obsolete ``Renderer.materialProperties``
- Fix: ``NEEDLE_persistent_assets`` extension is now valid format (change from array to object)

## [2.1.1-pre] - 2022-08-09
### Exporter
- Add Option to Settings to disable automatic project fixes
- Fix Build Window

## [2.1.0-pre] - 2022-08-08
### Exporter
- Add fixes to automatically update previous projects

## [2.0.0-pre] - 2022-08-08
### Exporter
- Renamed package
- Add: npmdef pre-build callback to run installation if any of the dependencies is not installed
- Add: Glitch Deployment inspector hold ALT to toggle build type (development or production)

### Engine
- Renamed package

## [1.28.0-pre] - 2022-08-08
### Exporter
- Add: Custom Shader vertex color export
- Add: NestedGltf objects and components do now have a stable guid
- Fix: NestedGltf transfrom

### Engine
- Fix: NestedGltf transform

## [1.27.2-pre] - 2022-08-06
### Exporter
- Remove: Scene Inspector experimental scene asset assignment
- Change: update templates
- Change: Component guid generator file ending check to make it work for other file types as well
- Change: add logo to scenes in project hierarchy with Needle Engine setup

### Engine
- Remove: Duplicateable animation time offset hack
- Change: GameObjectData extension properly await assigning values
- Change: NestedGltf instantiate using guid
- Change: ``instantiate`` does now again create guids for three Objects too

## [1.27.1-pre] - 2022-08-05
### Exporter
- Change: always export nested GlbObjects
- Change: update scene templates
- Change: Spectator camera component now requires camera component

### Engine
- Add: NestedGltf ``listenToProgress`` method
- Add: Allow changing Renderer lightmap at runtime
- Fix: Environment lighting when set to flat or gradient (instead of skybox)
- Fix: ``this.gameObject.getComponentInChildren`` - was internally calling wrong method
- Fix: Spectator camera, requires Camera component in glb now

## [1.27.0-pre] - 2022-08-03
### Exporter
- Add: warning if lightmap baking is currently in progress
- Add: support to export multiple selected objects
- Change: Audio clips are being exported relative to glb now (instead of relative to root) to make context menu export work, runtime needs to resolve the path relative to glb
- Fix: Selected object export collect types from ExportInfo

### Engine
- Add: Animator.keepAnimatorStateOnDisable, defaults to false as in Unity so start state is entered on enable again
- Add: warning if different types with the same name are registered
- Add: timeline track ``onMutedChanged`` callback
- Change: PlayableDirector expose audio tracks
- Change: BoxCollider and SphereCollider being added to the physics scene just once
- Change: try catch around physics step


## [1.26.0-pre] - 2022-08-01
### Exporter
- Add: open component compiler menu option to open Npm package site
- Add: feedback form url menu item
- Add: support for nested ``GltfObject``
- Add: support to copy gltf files in your hierarchy to the output directory instead of running export process again (e.g. a ``.glb`` file that is already compressed will just be copied and not be exported again. Adding components or changing values in the inspector won't have any effect in that case)
- Change: Don't export skybox for nested gltfs
- Change: bump component compiler dependency to ``1.7.2``
- Change: Unity progress name changed when running Needle Engine server process
- Remove: legacy export options on ``GltfObject``, components will now always be exported inside gltf extension
- Fix: delete empty folder when creating a new scene from a scene template 
- Fix: CodeWatcher error caused by repaint call from background thread
- Fix: Don't serialize in-memory scene paths in settings (when creating scenes from scene templates)
- Fix: Array serialization of e.g. AudioClip[] to produce Array<string> (because audio clips will be copied to the output directory and be serialized as strings which did previously not work in arrays or lists)
- Fix: component link opens workspace again
- Fix: scene save on scene change does not trigger a new export/build anymore

### Engine
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

## [1.25.0-pre] - 2022-07-27
### Exporter
- Add: Send upload size in header to Glitch to detect if the instance has enough free space
- Add: menu item to export selected object in hierarchy as gltf or glb
- Add: Timeline animation track infinite track export (when a animation track does not use TimelineClips)
- Add: ``AnimatorData`` component to expose and support random animator speed properties and random start clip offsets to easily randomize scenes using animators with the same AnimatorController on multiple GameObjects
- Fix: npmdef import, sometimes npmdefs in a project were not registered/detected properly which led to problems with installing dependencies
- Fix: script import file-gen does not produce invalid javascript if a type is present in multiple packages
- Change: improved error log message when animation export requires ``KHR_animation_pointer``
- Change: server starts using ``localhost`` url by default and can be opened by ip directly by holding ALT (this removes the security warning shown by browsers when opening by ip that does not have a security certificate which is only necessary if you want to open on another device like quest or phone. It can still be opened by ip and is logged in he console if desired)

### Engine
- Change: bump component compiler dependency to ``1.7.1``
- Change: ``context.mainCameraComponent`` is now of type ``Camera``
- Fix: timeline control track
- Fix: timeline animation track post extrapolation
- Fix: custom shader does not fail when scene uses object with transmission (additional render pass)

## [1.24.2-pre] - 2022-07-22
### Exporter
- Add: Deployment component now also shows info in inspector when upload is in process 
- Fix: cancel deploy when build fails
- Fix: better process handling on OSX

## [1.24.1-pre] - 2022-07-22
### Exporter
- Change: ``Remix on Glitch`` button does not immediately remix the glitch template and open the remixed site

## [1.24.0-pre] - 2022-07-21
### Exporter
- Add: glitch deploy auto key request and assignment. You now only need to paste the glitch project name when remixed and the deployment key will be requested and stored automatically (once after remix)
- Fix: process output log on OSX
- Fix: process watcher should now use far less CPU
- Change: move internal publish code into separate package
### Engine
- add loading bar and show loading state text

## [1.23.1-pre] - 2022-07-20
- Fix check if toktx is installed
- Fix: disable build buttons in Build Settings Window and Deployment component when build is currently running
- Fix: dont allow running multiple upload processes at once
- engine: add using ambient light settings (Intensity Multiplier) exported from Unity

## [1.23.0-pre] - 2022-07-18
- Update UnityGLTF dependency version
- Fix packing texture references on empty gameobjects
- Fix npmdef problem factory for needle.engine and three packages
- Add help urls to our components
- engine: fix nullref in registering texture

## [1.22.0-pre.2] - 2022-07-18
- Refactor problem validation and fixing providing better feedback messages
- Add: log of component that is not installed to runtime project but used in scene
- Change: Glitch deploy buttons
- Change: Build Settings window with new icons

## [1.21.0-pre] - 2022-07-15
- Add: moving npmdef in project should now automatically resolve path in package.json (if npmdef name didnt change too)
- Add: ``Show in explorer`` to scene asset context menu
- Add: warn when component is used in scene/gltf that is not installed to current runtime project
- engine: remove legacy file
- engine: add basic implementation of ``Context.destroy``
- engine: fix ``<needle-tiny>`` src attribute
- engine: add implictly creating camera with orbit controls when loaded glb doesnt contain any (e.g. via src) 

## [1.20.3-pre.1] - 2022-07-13
- Fix exception in ComponentCompiler editor
- Fix type list for codegen including display and unavailable types

## [1.20.2-pre.2] - 2022-07-12
- Add warning to Typescript component link (in inspector) when component on GameObject is not the codegen one (e.g. multiple components with the same name exist in the project)
- Change component compiler to not show ``install`` button when package is not installed to project
- Change recreate codewatchers on editor focus
- engine: fix dont apply lightmaps to unlit materials
- engine: remove log in PlayableDirector
- engine: add support to override (not automatically create) WebXR buttons 

## [1.20.1-pre] - 2022-07-11
- Fix TypesGenerator log
- Fix ExportInfo editor when installing
- Fix: ComponentCompiler serialize path relative to project
- Fix Inspector typescript link
- Fix AnimatorController serialization in persistent asset extension
- Fix AnimatorController serialization of transition conditions
- Add more verbose output for reason why project is not being installed, visible when pressing ALT
- Fix process output logs to show more logs
- Update component compiler default version to 1.6.2
- engine: Fix AnimatorController finding clip when cloned via ``AssetReference.instantiate``
- engine: Fix deep clone array type
- engine: Fix PlayableDirectory binding when cloned via ``AssetReference.instantiate``

## [1.20.0-pre] - 2022-07-10
- Add info to ExportInfo component when project is temporary (in Library folder)
- Add ``Open in commandline`` context menu to ExportInfo component
- Add generating types.json for component generator to remove need to specify C# types explicitly via annotations
- Add context menu to ComponentGenerator component version text to open changelog
- Change: hold ALT to perform clean install when clicking install button
- Fix: KHR_animation_pointer now works in production builds
- engine: add VideoPlayer using ``AudioOutputMode.None``
- engine: fix VideoPlayer waiting for input before playing video with audio (unmuted) and being loaded lazily

## [1.19.0-pre] - 2022-07-07
- Add: automatically import npmdef package if npmdef package.json contains (existing) ``main`` file
- Add: Timeline serializer does not automatically create asset model from custom track assets for fields marked with ``[SerializeField]`` attribute
- Change: PlayableDirector allow custom tracks without output binding
- engine: Add ``getComponent`` etc methods to THREE.Object3D prototype so we can use it like in Unity: ``this.gameObject.getComponent...``
- engine: Change ``Duplictable`` serialization

## [1.18.0-pre] - 2022-07-06
- Add temp projects support: projects are temp projects when in Unity Library
- Change prevent creating project in Temp/ directory because Unity deletes content of symdir directories
- Change ExportInfo update button to open Package Manager by default (hold ALT to install without packman)
- Change starting processes with ``timeout`` instead of ``pause``
- Change: try install npmdef dependency when package.json is not found in node_modules
- Fix ComponentGenerator path selection
- Fix warning from UnityGLTF api change
- Fix codegen import of register_types on very first build
- engine: Fix networking localhost detection
- engine: update component generator package version (supporting now CODEGEN_START and END sections as well as //@ifdef for fields)

## [1.17.0-pre] - 2022-07-06
- Add mathematics #ifdef
- Change NpmDef importer to enable GUI to be usable in immutable package
- Change Move modules out of this package
- Fix ``Start Server`` killing own server again
- Fix error when searching typescript workspace in wrong directory
- Change lightmap extension to be object
- engine: change lightmap extension to be object

## [1.16.0-pre] - 2022-07-06
- Add DeviceFlag component
- Add build stats log to successfully built log printing info about file sizes
- Add warning for when Unity returns missing/null lightmap
- Add VideoPlayer ``isPlaying`` that actually checks if video is currently playing
- Add ObjectField for npmdef files to SceneEditor
- Fix BuildTarget for 2022
- Fix serializing UnityEvent without any listeners
- Fix seriailizing component ``enable`` state
- Fix skybox in production builds
- Improve VideoTrack editor preview
- Improve glitch deploy error message when project name is wrong
- Update gltf-transform versions in project templates
- Update UnityGLTF method names for compatibility with 1.10.0-pre
- engine: Add DeviceFlag component
- engine: Fix VideoPlayer loop and playback speed
- engine: Improve VideoTrack sync

## [1.15.0-pre] - 2022-07-04
- add VideoTrack export
- add Spline export
- fix ComponentCompiler finding path automatically
- fix Unity.Mathematics float2, float3, float4 serialization
- change: ExportInfo shows version during installation 
- engine: fix ``enabled`` not being always assigned
- engine: fix react-three-fiber component setting camera
- engine: add support for custom timeline track
- engine: add VideoTrack npmdef

## [1.14.3-pre] - 2022-07-01
- Add: installation progress now tracks and warns on installations taking longer than 5 minutes
- engine: Change; PlayableDirector Wrap.None now stops/resets timeline on end
- engine: Change; PlayableDirector now stops on disabling  

## [1.14.2-pre] - 2022-07-01
- Update UnityGltf dependency
- engine: fix timeline clip offsets and hold
- engine: fix timeline animationtrack support for post-extrapolation (hold, loop, pingpong)

## [1.14.1-pre] - 2022-06-30
- Fix: exception in code watcher when creating new npmdef
- Fix: issue when deleting npmdef
- engine: improve timeline clip offsets

## [1.14.0-pre] - 2022-06-30
- Add: export timeline AnimationTrack TrackOffset
- engine: Improved timeline clip- and track offset (ongoing)
- engine: Change assigning all serialized properties by default again (instead of require ``@allProperties`` decorator)
- engine: Change; deprecate ``@allProperties`` and ``@strict`` decorators

## [1.13.2-pre] - 2022-06-29
- Fix Playmode override
- Fix: Dispose code watcher on npmdef rebuild
- Add button to open npmdef directory in commandline
- Change: keep commandline open on error
- engine: add methods for unsubscribing to EventList and make constructor args optional
- engine: change camera to not change transform anymore

## [1.13.1-pre] - 2022-06-28
- Fix support for Unity 2022.1
- engine: add support for transparent rendering using camera background alpha

## [1.13.0-pre] - 2022-06-27
- Add: transform gizmo component
- Change: component generator for npmdef is not required anymore
- Change: component gen runs in background now
- Fix: typescript drag drop adding component twice in some cases
- engine: update component gen package dependency
- engine: fix redundant camera creation when exported in GLTF
- engine: fix orbit controls focus lerp, stops now on input

## [1.12.1-pre] - 2022-06-25
- Override PlayMode in sub-scene
- engine: lightmaps encoding fix
- engine: directional light direction fix 

## [1.12.0-pre] - 2022-06-25
- SceneAsset: add buttons to open vscode workspace and start server

## [1.11.1-pre] - 2022-06-25
- AnimatorController: can now be re-used on multiple objects
- Add support for exporting current scene to glb, export scene on save when used in running server
- Fix: issue that caused multi-select in hierarchy being changed
- Add glb and gltf hot-reload option to vite.config in template
- Add context menu to ``ExportInfo`` to update vite.config from template
- engine: animator controler can handle multiple target animators
- engine: fix WebXR being a child of WebARSessionRoot
- engine: improve Camera, OrbitControls, Lights OnEnable/Disable behaviour
- engine: add ``Input.getKeyPressed()``

## [1.10.0-pre] - 2022-06-23
- Support exporting multiple lightmaps
- Fix custom reflection being saved to ``Assets/Reflection.exr``
- engine: fix light error "can't add object to self" when re-enabled
- engine: remove extension log
- engine: log missing info when UnityEvent has not target (or method not found)
- engine: use lightmap index for supporting multiple lightmaps

## [1.10.0-pre] - 2022-06-23
- Support exporting multiple lightmaps
- Fix custom reflection being saved to ``Assets/Reflection.exr``
- engine: fix light error "can't add object to self" when re-enabled
- engine: remove extension log
- engine: log missing info when UnityEvent has not target (or method not found)
- engine: use lightmap index for supporting multiple lightmaps

## [1.9.0-pre] - 2022-06-23
- Initial support for exporting SceneAssets 
- GridHelper improved gizmo
- engine: Camera dont set skybox when in XR
- engine: dont add lights to scene if baked

## [1.8.1-pre] - 2022-06-22
- Automatically install referenced npmdef packages
- Refactor IBuildCallbackReceiver to be async
- Remove producing resouces.glb
- engine: fix threejs dependency pointer

## [1.8.0-pre.1] - 2022-06-22
- Add project info inspector to scene asset
- Add custom context menu to scene asset containing three export projects
- Export lightmaps and skybox as part of extension
- Known issue: production build skybox is not working correctly yet
- Fix dragdrop typescript attempting to add non-component-types to objects
- Allow overriding threejs version in project
- Bump UnityGLTF dependency
- engine: ``<needle-tiny>`` added awaitable ``getContext()`` (waits for scene being loaded to be used in external js)
- engine: fix finding main camera warning
- engine: add ``SourceIdentifier`` to components to be used to get gltf specific data (e.g. lightmaps shipped per gltf)
- engine: persistent asset resolve fix
- engine: update three dependency to support khr_pointer
- engine: remove custom khr_pointer extension
- engine: fix WebARSessionRoot exported in gltf
- engine: smaller AR reticle

## [1.7.0-pre] - 2022-06-17
- Component generator inspector: add foldout and currently installed version
- Npmdef: fix register_type when no types are in npmdef (previously it would only update the file if any type was found)
- Npmdef: importer now deletes codegen directory when completely empty
- Export: referenced prefabs dont require GltfObject component anymore
- engine: create new GltfLoader per loading request
- engine: fix bug in core which could lead to scripts being registered multiple times
- engine: Added SyncedRoom auto rejoin option (to handle disconnection by server due to window inactivity)
- engine: guid resolving first in loaded gltf and retry in whole scene on fail
- engine: fix nullref in DropListener
- engine: register main camera before first awake

## [1.6.0-pre.1] - 2022-06-15
- fix serializing components implementing IEnumerable (e.g. Animation component)
- update UnityGLTF dependency
- engine: add ``GameObject.getOrAddComponent``
- engine: ``OrbitControl`` exposing controlled object
- engine: ``getWorldPosition`` now uses buffer of cached vector3's instead of only one
- engine: add ``AvatarMarker`` to synced camera (also allows to easily attach ``PlayerColor``)
- engine: fix ``Animation`` component when using khr_pointer extension
- engine: ``VideoPlayer`` expose current time
- engine: fix ``Animator.runtimeController`` serialization
- engine: make ``SyncedRoom.tryJoinRoom`` public

## [1.5.1-pre] - 2022-06-13
- Generate components from js files
- Fix compiler error in 2022
- Improve component generator editor watchlist
- Serialize dictionary as object with key[] value[] lists
- Prevent running exporter while editor is building
- Remove empty folder triggering warning
- Fix component generator running multiple times per file when file was saved multiple times.

## [1.5.0-pre] - 2022-06-12
- Add ``Create/Typescript`` context menu
- Improved npmdef and typescript UX
- Improved component codegen: does now also delete generated components when typescript file or class will be deleted
- Component gen produces stable guid (generated from type name)

## [1.4.0-pre] - 2022-06-11
- Bumb UnityGLTF dependency to 1.8.0-pre
- Add typescript editor integration to NpmDef importer: typescript files are now being displayed in project browser with look and feel of native Unity C# components. They also show a link to the matching Unity C# component.
- Fix PathUtil error
- Fix register-types generator deleting imports for modules that are not installed in current project

## [1.3.4-pre] - 2022-06-10
- Custom shader: start supporting export for Unity 2022.1
- Custom shader: basic default texture support
- engine: allow ``@serializeable`` taking abstract types
- engine: add ``Renderer.sharedMaterials`` support

## [1.3.3-pre] - 2022-06-09
- engine: move log behind debug flag
- engine: improved serialization property assignment respecting getter only properties
- engine: add optional serialization callbacks to ``ISerializable``
- engine: default to only assign declared properties

## [1.3.2-pre] - 2022-06-09
- update UnityGLTF dependency to 1.7.0-pre
- add google drive module (wip)
- project gen: fix path with spaces
- ExportInfo: fix dependency list for npmdef (for Unity 2022)
- set types dirty before building
- engine: downloading dropped file shows minimal preview box
- engine: ``DropListener`` can use localhost
- engine: ``SyncedRoom`` avoid reload due to room parameter
- engine: ``LODGroup`` instantiate workaround
- engine: improve deserialization supporting multiple type levels

## [1.3.1-pre.2] - 2022-05-30
- minor url parsing fix
- engine: change md5 hashing package
- engine: file upload logs proper server error

## [1.3.1-pre.1] - 2022-05-30
- Check if toktx is installed for production build
- Lightmap export: treat wrong quality setting as error
- engine: disable light in gltf if mode is baked
- engine: use tiny starter as default networking backend
- engine: synced file init fix for resolving references
- engine: allow removing of gen.js completely
- engine: expose ``Camera.buildCamera`` for core allowing to use blender camera
- engine: on filedrop only add drag control if none is found

## [1.3.1-pre] - 2022-05-27
- Improved ``ComponentGenerator`` inspector UX
- Add inspector extension for ``AdditionalComponentData<>`` implementations
- Update vite template index.html and index.scriban
- engine: fix networked flatbuffer state not being stored
- engine: make ``src`` on ``<needle-tiny>`` web component optional
- engine: ``src`` can now point to glb or gltf directly
- engine: fix ``Raycaster`` registration
- engine: add ``GameObject.destroySynced``
- engine: add ``context.setCurrentCamera``
- engine: make ``DropListener`` to EventTarget
- engine: make ``DropListener`` accept explicit backend url

## [1.3.0-pre.1] - 2022-05-26
- NPM Definition importer show package name
- PackageUtils: add indent
- MenuItem "Setup Scene" adds ``ComponentGenerator``
- Added minor warnings and disabled menu items for non existing project
- Fix gltf transform textures output when used in custom shaders only
- Fix ``ExportShader`` asset label for gltf extension

## [1.3.0-pre] - 2022-05-25
- Add ``ExportShader`` asset label to mark shader or material for export
- Add output folder path to ``IBuildDistCallbackReceiver`` interface
- Add button to NpmDef importer to re-generate all typescript components
- Add ``IAdditionalComponentData`` and ``AdditionalComponentData`` to easily emit additional data for another component
- engine: fix ``VideoPlayer`` being hidden, play automatically muted until interaction
- engine: added helpers to update window history
- engine: fix setting custom shader ``Vector4`` property

## [1.2.0-pre.4] - 2022-05-25
- Fix project validator local path check
- remove ``@no-check```(instead should add node_modules as baseUrl in tsconfig)
- fix ``Animation`` component serialization
- engine: fix tsc error in ``Animation`` component
- engine: fix ``Animation`` component assigning animations for GameObject again
- engine: fix ``Animation`` calling play before awake
- engine: ``AnimatorController`` handle missing motion (not assigned in Unity)
- engine: ``AnimatorController.IsInTransition()`` fix

## [1.2.0-pre.1] - 2022-05-20
- Disable separate installation of ``npmdef`` on build again as it would cause problems with react being bundled twice
- Add resolve for react and react-fiber to template vite.config
- Adding ``@no-check`` to react component as a temporary build fix solution
- Make template ``floor.fbx`` readable
- engine: minor tsc issues fixed

## [1.2.0-pre] - 2022-05-20
- Add initial react-three-fiber template
- Vite template: cleanup dependencies and add http2 memory workaround
- Dont show dependencies list in ``ExportInfo`` component when project does not exist yet
- Creating new npmdef with default ``.gitignore`` and catch IOException
- Building with referenced but uninstalled npmdef will now attempt to install those automatically
- engine: add ``isManagedExternally`` if renderer is not owned (e.g. when using react-fiber)

## [1.1.0-pre.6] - 2022-05-19
- Add resolve module for peer dependencies (for ``npmdef``) to vite project template
- Various NullReferenceException fixes
- Easily display and edit ``npmdef`` dependencies in ``ExportInfo`` component
- Add problem detection and run auto resolve for some of those problems (e.g. uninstalled dependency)
- engine: add basic support for ``stopEventPropagation`` (to make e.g. ``DragControls`` camera control agnostic in preparation of react support)

## [1.1.0-pre.5] - 2022-05-19
- ``Clean install`` does now delete node_modules and package-lock
- Mark types dirty after installation to fix missing types on first time install
- Fix ``npmdef`` registration on first project load

## [1.1.0-pre.2] - 2022-05-18
- improved ``NpmDef`` support

## [1.1.0-pre] - 2022-05-17
- fix ``EventList`` outside of gltf
- fix ``EventList`` without any function assigned (``No Function`` in Unity)
- fix minimal template gizmo icon copy
- start implementing ``NpmDef`` support allowing for modular project setup.
- engine: support changing ``WebARSessionRoot.arScale`` changing at runtime

## [1.0.0-pre.31] - 2022-05-12
- engine: fix webx avatar instantiate
- engine: stop input preventing key event defaults

## [1.0.0-pre.30] - 2022-05-12
- replace glb in collab sandbox template with fbx
- minor change in ``ComponentGenerator`` log
- add update info and button to ``ExportInfo`` component
- engine: log error if ``instantiate`` is called with false parent
- engine: fix instantiate with correct ``AnimatorController`` cloning

## [1.0.0-pre.29] - 2022-05-11
- engine: fix ``@syncField()``
- engine: fix ``AssetReference.instantiate`` and ``AssetReference.instantiateSynced`` parenting
- engine: improve ``PlayerSync`` and ``PlayerState``

## [1.0.0-pre.28] - 2022-05-11
- Move ``PlayerState`` and ``PlayerSync`` to experimental components
- Add TypeUtils to get all known typescript components
- Add docs to ``SyncTransform`` component
- Add support for ``UnityEvent.off`` state
- engine: prepend three canvas to the web element instead of appending
- engine: ``SyncedRoom`` logs warning when disconnected
- engine: internal networking does not attempt to reconnect on connection closed
- engine: internal networking now empties user list when disconnected from room
- engine: ``GameObject.instantiate`` does not always generate new guid to support cases where e.g. ``SyncTransform`` is on cloned object and requires unique id
- engine: ``syncedInstantiate`` add fallback to ``Context.Current`` when missing
- engine: ``EventList`` refactored to use list of ``CallInfo`` objects internally instead of plain function array to more easily attach meta info like ``UnityEvent.off`` 
- engine: add ``GameObject.instantiateSynced``

## [1.0.0-pre.27] - 2022-05-10
- add directory check to ``ComponentGenerator``
- parse glitch url in ``Networking.localhost``
- engine: fix font path
- engine: add ``debugnewscripts`` url parameter
- engine: start adding simplifcation to automatic instance creation + sync per player
- engine: allow InstantiateOptions in ``GameObject.instantiate`` to be inlined as e.g. ``{ position: ... }``
- engine: add ``AvatarMarker`` creation and destroy events
- engine: fix networking message buffering

## [1.0.0-pre.26] - 2022-05-10
- Fix js emitter writing guid for glTF root which caused guid to be present on two objects and thus resolved references for gltf root were wrong
- Improved ``SyncedRoom`` and ``Networking`` components tooltips and info
- Improved ``SyncedCam`` reference assignment - warn if asset is assigned instead of scene reference
- Build error fix
- Added versions to ``ExportInfo`` editor and context menu to quickly access package.jsons and changelogs

## [1.0.0-pre.25] - 2022-05-08
- Unity 2022 enter PlayMode fix for broken skybox when invoked from play button or ``[InitializeOnLoad]``
- Unity 2022 minor warning / obsolete fixes
- remove GltFast toggle in ``GltfObject`` as currently not supported/used
- fix build error
- rename and update scene templates
- engine: ``SpatialTrigger`` is serializable
- engine: fix ``DragControls`` offset when using without ground
- engine: fix ``WebXRController`` interaction with UI ``Button.onClick``

## [1.0.0-pre.24] - 2022-05-04
- fix ifdef in template component
- allow disabling component gen component
- fix exporting asset: check if it is root
- fix ``InputAction`` locking export
- engine: fix gltf extension not awaiting dependencies
- engine: fix persistent asset @serializable check for arrays
- engine: add ``setWorldScale``
- engine: fix ``instantiate`` setting position
- engine: ``AssetReference`` does now create new instance in ``instantiate`` call
- engine: add awaitable ``delay`` util method
- engine: fix scripts being active when loaded in gltf but never added to scene
- engine: minimal support for mocking pointer input
- engine: emit minimal down and up input events when in AR

## [1.0.0-pre.23] - 2022-05-03
- show warning in ``^2021`` that templating is currently not supported
- clean install now asks to stop running servers before running
- engine: improved default loading element
- play button does now ask to create a project if none exits

## [1.0.0-pre.22] - 2022-05-02
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

## [1.0.0-pre.21] - 2022-04-30
- cleanup ``WebXR`` and ``WebXRSync``
- Play button does not also trigger installation and setup when necessary
- Fixed addressables export
- Added doc links to ``ComponentGenerator`` and updated urls in welcome window.
- ``Deployment.GlitchModel`` does now support Undo

## [1.0.0-pre.20] - 2022-04-29
- add internal publish button
- dont emit ``khr_techniques_webgl`` extension when not exporting custom shaders
- fix environment light export
- use newtonsoft converters when serializing additional data
- add ``Open Server`` button to ``ExportInfo`` component
- ``component-compiler`` logs command and log output file

## [1.0.0-pre.18] - 2022-04-27
- refactor extension serialization to use Newtonsoft

## [1.0.0-pre.11] - 2022-04-22
- initial release