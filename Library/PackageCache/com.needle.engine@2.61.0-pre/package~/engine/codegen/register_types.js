import { TypeStore } from "./../engine_typestore"

// Import types
import { __Ignore } from "../../engine-components/codegen/components.ts";
import { AlignmentConstraint } from "../../engine-components/AlignmentConstraint.ts";
import { Animation } from "../../engine-components/Animation.ts";
import { AnimationCurve } from "../../engine-components/AnimationCurve.ts";
import { AnimationExtension } from "../../engine-components/export/usdz/extensions/Animation.ts";
import { AnimationTrackHandler } from "../../engine-components/timeline/TimelineTracks.ts";
import { Animator } from "../../engine-components/Animator.ts";
import { AnimatorController } from "../../engine-components/AnimatorController.ts";
import { AttachedObject } from "../../engine-components/WebXRController.ts";
import { AudioListener } from "../../engine-components/AudioListener.ts";
import { AudioSource } from "../../engine-components/AudioSource.ts";
import { AudioTrackHandler } from "../../engine-components/timeline/TimelineTracks.ts";
import { Avatar_Brain_LookAt } from "../../engine-components/avatar/Avatar_Brain_LookAt.ts";
import { Avatar_MouthShapes } from "../../engine-components/avatar/Avatar_MouthShapes.ts";
import { Avatar_MustacheShake } from "../../engine-components/avatar/Avatar_MustacheShake.ts";
import { Avatar_POI } from "../../engine-components/avatar/Avatar_Brain_LookAt.ts";
import { AvatarBlink_Simple } from "../../engine-components/avatar/AvatarBlink_Simple.ts";
import { AvatarEyeLook_Rotation } from "../../engine-components/avatar/AvatarEyeLook_Rotation.ts";
import { AvatarLoader } from "../../engine-components/AvatarLoader.ts";
import { AvatarMarker } from "../../engine-components/WebXRAvatar.ts";
import { AvatarModel } from "../../engine-components/AvatarLoader.ts";
import { AxesHelper } from "../../engine-components/AxesHelper.ts";
import { BaseUIComponent } from "../../engine-components/ui/BaseUIComponent.ts";
import { BasicIKConstraint } from "../../engine-components/BasicIKConstraint.ts";
import { BoxCollider } from "../../engine-components/Collider.ts";
import { BoxGizmo } from "../../engine-components/Gizmos.ts";
import { BoxHelperComponent } from "../../engine-components/BoxHelperComponent.ts";
import { Button } from "../../engine-components/ui/Button.ts";
import { CallInfo } from "../../engine-components/EventList.ts";
import { Camera } from "../../engine-components/Camera.ts";
import { Canvas } from "../../engine-components/ui/Canvas.ts";
import { CanvasGroup } from "../../engine-components/ui/CanvasGroup.ts";
import { CapsuleCollider } from "../../engine-components/Collider.ts";
import { CharacterController } from "../../engine-components/CharacterController.ts";
import { CharacterControllerInput } from "../../engine-components/CharacterController.ts";
import { Collider } from "../../engine-components/Collider.ts";
import { ColorAdjustments } from "../../engine-components/Volume.ts";
import { ColorBySpeedModule } from "../../engine-components/ParticleSystemModules.ts";
import { ColorOverLifetimeModule } from "../../engine-components/ParticleSystemModules.ts";
import { ControlTrackHandler } from "../../engine-components/timeline/TimelineTracks.ts";
import { Deletable } from "../../engine-components/DeleteBox.ts";
import { DeleteBox } from "../../engine-components/DeleteBox.ts";
import { DeviceFlag } from "../../engine-components/DeviceFlag.ts";
import { DragControls } from "../../engine-components/DragControls.ts";
import { DropListener } from "../../engine-components/DropListener.ts";
import { Duplicatable } from "../../engine-components/Duplicatable.ts";
import { EmissionModule } from "../../engine-components/ParticleSystemModules.ts";
import { EventList } from "../../engine-components/EventList.ts";
import { EventListEvent } from "../../engine-components/EventList.ts";
import { EventSystem } from "../../engine-components/ui/EventSystem.ts";
import { EventTrigger } from "../../engine-components/EventTrigger.ts";
import { FieldWithDefault } from "../../engine-components/Renderer.ts";
import { FixedJoint } from "../../engine-components/Joints.ts";
import { FlyControls } from "../../engine-components/FlyControls.ts";
import { Fog } from "../../engine-components/Fog.ts";
import { GltfExport } from "../../engine-components/export/gltf/GltfExport.ts";
import { GltfExportBox } from "../../engine-components/export/gltf/GltfExport.ts";
import { Gradient } from "../../engine-components/ParticleSystemModules.ts";
import { Graphic } from "../../engine-components/ui/Graphic.ts";
import { GraphicRaycaster } from "../../engine-components/ui/Raycaster.ts";
import { GridHelper } from "../../engine-components/GridHelper.ts";
import { GridLayoutGroup } from "../../engine-components/ui/Layout.ts";
import { GroundProjectedEnv } from "../../engine-components/GroundProjection.ts";
import { HingeJoint } from "../../engine-components/Joints.ts";
import { HorizontalLayoutGroup } from "../../engine-components/ui/Layout.ts";
import { Image } from "../../engine-components/ui/Image.ts";
import { InheritVelocityModule } from "../../engine-components/ParticleSystemModules.ts";
import { InputField } from "../../engine-components/ui/InputField.ts";
import { Interactable } from "../../engine-components/Interactable.ts";
import { Keyboard } from "../../engine-components/ui/Keyboard.ts";
import { LayoutGroup } from "../../engine-components/ui/Layout.ts";
import { Light } from "../../engine-components/Light.ts";
import { LimitVelocityOverLifetimeModule } from "../../engine-components/ParticleSystemModules.ts";
import { LODGroup } from "../../engine-components/LODGroup.ts";
import { LODModel } from "../../engine-components/LODGroup.ts";
import { LogStats } from "../../engine-components/debug/LogStats.ts";
import { LookAtConstraint } from "../../engine-components/LookAtConstraint.ts";
import { MainModule } from "../../engine-components/ParticleSystemModules.ts";
import { MaskableGraphic } from "../../engine-components/ui/Graphic.ts";
import { MeshCollider } from "../../engine-components/Collider.ts";
import { MeshRenderer } from "../../engine-components/Renderer.ts";
import { MinMaxCurve } from "../../engine-components/ParticleSystemModules.ts";
import { MinMaxGradient } from "../../engine-components/ParticleSystemModules.ts";
import { NestedGltf } from "../../engine-components/NestedGltf.ts";
import { Networking } from "../../engine-components/Networking.ts";
import { NoiseModule } from "../../engine-components/ParticleSystemModules.ts";
import { ObjectRaycaster } from "../../engine-components/ui/Raycaster.ts";
import { OffsetConstraint } from "../../engine-components/OffsetConstraint.ts";
import { OrbitControls } from "../../engine-components/OrbitControls.ts";
import { ParticleBurst } from "../../engine-components/ParticleSystemModules.ts";
import { ParticleSubEmitter } from "../../engine-components/ParticleSystemSubEmitter.ts";
import { ParticleSystem } from "../../engine-components/ParticleSystem.ts";
import { ParticleSystemRenderer } from "../../engine-components/ParticleSystem.ts";
import { PlayableDirector } from "../../engine-components/timeline/PlayableDirector.ts";
import { PlayerColor } from "../../engine-components/PlayerColor.ts";
import { PlayerState } from "../../engine-components-experimental/networking/PlayerSync.ts";
import { PlayerSync } from "../../engine-components-experimental/networking/PlayerSync.ts";
import { PointerEventData } from "../../engine-components/ui/PointerEvents.ts";
import { PresentationMode } from "../../engine-components-experimental/Presentation.ts";
import { RawImage } from "../../engine-components/ui/Image.ts";
import { Raycaster } from "../../engine-components/ui/Raycaster.ts";
import { Rect } from "../../engine-components/ui/RectTransform.ts";
import { RectTransform } from "../../engine-components/ui/RectTransform.ts";
import { ReflectionProbe } from "../../engine-components/ReflectionProbe.ts";
import { RegisteredAnimationInfo } from "../../engine-components/export/usdz/extensions/Animation.ts";
import { RemoteSkybox } from "../../engine-components/Skybox.ts";
import { Renderer } from "../../engine-components/Renderer.ts";
import { RendererLightmap } from "../../engine-components/RendererLightmap.ts";
import { RGBAColor } from "../../engine-components/js-extensions/RGBAColor.ts";
import { Rigidbody } from "../../engine-components/RigidBody.ts";
import { RotationBySpeedModule } from "../../engine-components/ParticleSystemModules.ts";
import { RotationOverLifetimeModule } from "../../engine-components/ParticleSystemModules.ts";
import { ScreenCapture } from "../../engine-components/ScreenCapture.ts";
import { ShadowCatcher } from "../../engine-components/ShadowCatcher.ts";
import { ShapeModule } from "../../engine-components/ParticleSystemModules.ts";
import { SignalAsset } from "../../engine-components/timeline/SignalAsset.ts";
import { SignalReceiver } from "../../engine-components/timeline/SignalAsset.ts";
import { SignalReceiverEvent } from "../../engine-components/timeline/SignalAsset.ts";
import { SignalTrackHandler } from "../../engine-components/timeline/TimelineTracks.ts";
import { Size } from "../../engine-components/ui/RectTransform.ts";
import { SizeBySpeedModule } from "../../engine-components/ParticleSystemModules.ts";
import { SizeOverLifetimeModule } from "../../engine-components/ParticleSystemModules.ts";
import { SkinnedMeshRenderer } from "../../engine-components/Renderer.ts";
import { SmoothFollow } from "../../engine-components/SmoothFollow.ts";
import { SpatialHtml } from "../../engine-components/ui/SpatialHtml.ts";
import { SpatialTrigger } from "../../engine-components/SpatialTrigger.ts";
import { SpatialTriggerReceiver } from "../../engine-components/SpatialTrigger.ts";
import { SpectatorCamera } from "../../engine-components/SpectatorCamera.ts";
import { SphereCollider } from "../../engine-components/Collider.ts";
import { Sprite } from "../../engine-components/SpriteRenderer.ts";
import { SpriteRenderer } from "../../engine-components/SpriteRenderer.ts";
import { SpriteSheet } from "../../engine-components/SpriteRenderer.ts";
import { SubEmitterSystem } from "../../engine-components/ParticleSystem.ts";
import { SyncedCamera } from "../../engine-components/SyncedCamera.ts";
import { SyncedRoom } from "../../engine-components/SyncedRoom.ts";
import { SyncedTransform } from "../../engine-components/SyncedTransform.ts";
import { TeleportTarget } from "../../engine-components/WebXRController.ts";
import { TestRunner } from "../../engine-components/TestRunner.ts";
import { TestSimulateUserData } from "../../engine-components/TestRunner.ts";
import { Text } from "../../engine-components/ui/Text.ts";
import { TextureSheetAnimationModule } from "../../engine-components/ParticleSystemModules.ts";
import { ToneMapping } from "../../engine-components/Volume.ts";
import { TrailModule } from "../../engine-components/ParticleSystemModules.ts";
import { TransformData } from "../../engine-components/export/usdz/extensions/Animation.ts";
import { TransformGizmo } from "../../engine-components/TransformGizmo.ts";
import { UIRaycastUtils } from "../../engine-components/ui/RaycastUtils.ts";
import { UIRootComponent } from "../../engine-components/ui/BaseUIComponent.ts";
import { UsageMarker } from "../../engine-components/Interactable.ts";
import { USDZExporter } from "../../engine-components/export/usdz/USDZExporter.ts";
import { VelocityOverLifetimeModule } from "../../engine-components/ParticleSystemModules.ts";
import { VerticalLayoutGroup } from "../../engine-components/ui/Layout.ts";
import { VideoPlayer } from "../../engine-components/VideoPlayer.ts";
import { Voip } from "../../engine-components/Voip.ts";
import { Volume } from "../../engine-components/Volume.ts";
import { VolumeComponent } from "../../engine-components/Volume.ts";
import { VolumeParameter } from "../../engine-components/Volume.ts";
import { VolumeProfile } from "../../engine-components/Volume.ts";
import { VRUserState } from "../../engine-components/WebXRSync.ts";
import { WebAR } from "../../engine-components/WebXR.ts";
import { WebARSessionRoot } from "../../engine-components/WebARSessionRoot.ts";
import { WebXR } from "../../engine-components/WebXR.ts";
import { WebXRAvatar } from "../../engine-components/WebXRAvatar.ts";
import { WebXRController } from "../../engine-components/WebXRController.ts";
import { WebXRSync } from "../../engine-components/WebXRSync.ts";
import { XRFlag } from "../../engine-components/XRFlag.ts";
import { XRGrabModel } from "../../engine-components/WebXRGrabRendering.ts";
import { XRGrabRendering } from "../../engine-components/WebXRGrabRendering.ts";
import { XRRig } from "../../engine-components/WebXRRig.ts";
import { XRState } from "../../engine-components/XRFlag.ts";

// Register types
TypeStore.add("__Ignore", __Ignore);
TypeStore.add("AlignmentConstraint", AlignmentConstraint);
TypeStore.add("Animation", Animation);
TypeStore.add("AnimationCurve", AnimationCurve);
TypeStore.add("AnimationExtension", AnimationExtension);
TypeStore.add("AnimationTrackHandler", AnimationTrackHandler);
TypeStore.add("Animator", Animator);
TypeStore.add("AnimatorController", AnimatorController);
TypeStore.add("AttachedObject", AttachedObject);
TypeStore.add("AudioListener", AudioListener);
TypeStore.add("AudioSource", AudioSource);
TypeStore.add("AudioTrackHandler", AudioTrackHandler);
TypeStore.add("Avatar_Brain_LookAt", Avatar_Brain_LookAt);
TypeStore.add("Avatar_MouthShapes", Avatar_MouthShapes);
TypeStore.add("Avatar_MustacheShake", Avatar_MustacheShake);
TypeStore.add("Avatar_POI", Avatar_POI);
TypeStore.add("AvatarBlink_Simple", AvatarBlink_Simple);
TypeStore.add("AvatarEyeLook_Rotation", AvatarEyeLook_Rotation);
TypeStore.add("AvatarLoader", AvatarLoader);
TypeStore.add("AvatarMarker", AvatarMarker);
TypeStore.add("AvatarModel", AvatarModel);
TypeStore.add("AxesHelper", AxesHelper);
TypeStore.add("BaseUIComponent", BaseUIComponent);
TypeStore.add("BasicIKConstraint", BasicIKConstraint);
TypeStore.add("BoxCollider", BoxCollider);
TypeStore.add("BoxGizmo", BoxGizmo);
TypeStore.add("BoxHelperComponent", BoxHelperComponent);
TypeStore.add("Button", Button);
TypeStore.add("CallInfo", CallInfo);
TypeStore.add("Camera", Camera);
TypeStore.add("Canvas", Canvas);
TypeStore.add("CanvasGroup", CanvasGroup);
TypeStore.add("CapsuleCollider", CapsuleCollider);
TypeStore.add("CharacterController", CharacterController);
TypeStore.add("CharacterControllerInput", CharacterControllerInput);
TypeStore.add("Collider", Collider);
TypeStore.add("ColorAdjustments", ColorAdjustments);
TypeStore.add("ColorBySpeedModule", ColorBySpeedModule);
TypeStore.add("ColorOverLifetimeModule", ColorOverLifetimeModule);
TypeStore.add("ControlTrackHandler", ControlTrackHandler);
TypeStore.add("Deletable", Deletable);
TypeStore.add("DeleteBox", DeleteBox);
TypeStore.add("DeviceFlag", DeviceFlag);
TypeStore.add("DragControls", DragControls);
TypeStore.add("DropListener", DropListener);
TypeStore.add("Duplicatable", Duplicatable);
TypeStore.add("EmissionModule", EmissionModule);
TypeStore.add("EventList", EventList);
TypeStore.add("EventListEvent", EventListEvent);
TypeStore.add("EventSystem", EventSystem);
TypeStore.add("EventTrigger", EventTrigger);
TypeStore.add("FieldWithDefault", FieldWithDefault);
TypeStore.add("FixedJoint", FixedJoint);
TypeStore.add("FlyControls", FlyControls);
TypeStore.add("Fog", Fog);
TypeStore.add("GltfExport", GltfExport);
TypeStore.add("GltfExportBox", GltfExportBox);
TypeStore.add("Gradient", Gradient);
TypeStore.add("Graphic", Graphic);
TypeStore.add("GraphicRaycaster", GraphicRaycaster);
TypeStore.add("GridHelper", GridHelper);
TypeStore.add("GridLayoutGroup", GridLayoutGroup);
TypeStore.add("GroundProjectedEnv", GroundProjectedEnv);
TypeStore.add("HingeJoint", HingeJoint);
TypeStore.add("HorizontalLayoutGroup", HorizontalLayoutGroup);
TypeStore.add("Image", Image);
TypeStore.add("InheritVelocityModule", InheritVelocityModule);
TypeStore.add("InputField", InputField);
TypeStore.add("Interactable", Interactable);
TypeStore.add("Keyboard", Keyboard);
TypeStore.add("LayoutGroup", LayoutGroup);
TypeStore.add("Light", Light);
TypeStore.add("LimitVelocityOverLifetimeModule", LimitVelocityOverLifetimeModule);
TypeStore.add("LODGroup", LODGroup);
TypeStore.add("LODModel", LODModel);
TypeStore.add("LogStats", LogStats);
TypeStore.add("LookAtConstraint", LookAtConstraint);
TypeStore.add("MainModule", MainModule);
TypeStore.add("MaskableGraphic", MaskableGraphic);
TypeStore.add("MeshCollider", MeshCollider);
TypeStore.add("MeshRenderer", MeshRenderer);
TypeStore.add("MinMaxCurve", MinMaxCurve);
TypeStore.add("MinMaxGradient", MinMaxGradient);
TypeStore.add("NestedGltf", NestedGltf);
TypeStore.add("Networking", Networking);
TypeStore.add("NoiseModule", NoiseModule);
TypeStore.add("ObjectRaycaster", ObjectRaycaster);
TypeStore.add("OffsetConstraint", OffsetConstraint);
TypeStore.add("OrbitControls", OrbitControls);
TypeStore.add("ParticleBurst", ParticleBurst);
TypeStore.add("ParticleSubEmitter", ParticleSubEmitter);
TypeStore.add("ParticleSystem", ParticleSystem);
TypeStore.add("ParticleSystemRenderer", ParticleSystemRenderer);
TypeStore.add("PlayableDirector", PlayableDirector);
TypeStore.add("PlayerColor", PlayerColor);
TypeStore.add("PlayerState", PlayerState);
TypeStore.add("PlayerSync", PlayerSync);
TypeStore.add("PointerEventData", PointerEventData);
TypeStore.add("PresentationMode", PresentationMode);
TypeStore.add("RawImage", RawImage);
TypeStore.add("Raycaster", Raycaster);
TypeStore.add("Rect", Rect);
TypeStore.add("RectTransform", RectTransform);
TypeStore.add("ReflectionProbe", ReflectionProbe);
TypeStore.add("RegisteredAnimationInfo", RegisteredAnimationInfo);
TypeStore.add("RemoteSkybox", RemoteSkybox);
TypeStore.add("Renderer", Renderer);
TypeStore.add("RendererLightmap", RendererLightmap);
TypeStore.add("RGBAColor", RGBAColor);
TypeStore.add("Rigidbody", Rigidbody);
TypeStore.add("RotationBySpeedModule", RotationBySpeedModule);
TypeStore.add("RotationOverLifetimeModule", RotationOverLifetimeModule);
TypeStore.add("ScreenCapture", ScreenCapture);
TypeStore.add("ShadowCatcher", ShadowCatcher);
TypeStore.add("ShapeModule", ShapeModule);
TypeStore.add("SignalAsset", SignalAsset);
TypeStore.add("SignalReceiver", SignalReceiver);
TypeStore.add("SignalReceiverEvent", SignalReceiverEvent);
TypeStore.add("SignalTrackHandler", SignalTrackHandler);
TypeStore.add("Size", Size);
TypeStore.add("SizeBySpeedModule", SizeBySpeedModule);
TypeStore.add("SizeOverLifetimeModule", SizeOverLifetimeModule);
TypeStore.add("SkinnedMeshRenderer", SkinnedMeshRenderer);
TypeStore.add("SmoothFollow", SmoothFollow);
TypeStore.add("SpatialHtml", SpatialHtml);
TypeStore.add("SpatialTrigger", SpatialTrigger);
TypeStore.add("SpatialTriggerReceiver", SpatialTriggerReceiver);
TypeStore.add("SpectatorCamera", SpectatorCamera);
TypeStore.add("SphereCollider", SphereCollider);
TypeStore.add("Sprite", Sprite);
TypeStore.add("SpriteRenderer", SpriteRenderer);
TypeStore.add("SpriteSheet", SpriteSheet);
TypeStore.add("SubEmitterSystem", SubEmitterSystem);
TypeStore.add("SyncedCamera", SyncedCamera);
TypeStore.add("SyncedRoom", SyncedRoom);
TypeStore.add("SyncedTransform", SyncedTransform);
TypeStore.add("TeleportTarget", TeleportTarget);
TypeStore.add("TestRunner", TestRunner);
TypeStore.add("TestSimulateUserData", TestSimulateUserData);
TypeStore.add("Text", Text);
TypeStore.add("TextureSheetAnimationModule", TextureSheetAnimationModule);
TypeStore.add("ToneMapping", ToneMapping);
TypeStore.add("TrailModule", TrailModule);
TypeStore.add("TransformData", TransformData);
TypeStore.add("TransformGizmo", TransformGizmo);
TypeStore.add("UIRaycastUtils", UIRaycastUtils);
TypeStore.add("UIRootComponent", UIRootComponent);
TypeStore.add("UsageMarker", UsageMarker);
TypeStore.add("USDZExporter", USDZExporter);
TypeStore.add("VelocityOverLifetimeModule", VelocityOverLifetimeModule);
TypeStore.add("VerticalLayoutGroup", VerticalLayoutGroup);
TypeStore.add("VideoPlayer", VideoPlayer);
TypeStore.add("Voip", Voip);
TypeStore.add("Volume", Volume);
TypeStore.add("VolumeComponent", VolumeComponent);
TypeStore.add("VolumeParameter", VolumeParameter);
TypeStore.add("VolumeProfile", VolumeProfile);
TypeStore.add("VRUserState", VRUserState);
TypeStore.add("WebAR", WebAR);
TypeStore.add("WebARSessionRoot", WebARSessionRoot);
TypeStore.add("WebXR", WebXR);
TypeStore.add("WebXRAvatar", WebXRAvatar);
TypeStore.add("WebXRController", WebXRController);
TypeStore.add("WebXRSync", WebXRSync);
TypeStore.add("XRFlag", XRFlag);
TypeStore.add("XRGrabModel", XRGrabModel);
TypeStore.add("XRGrabRendering", XRGrabRendering);
TypeStore.add("XRRig", XRRig);
TypeStore.add("XRState", XRState);
