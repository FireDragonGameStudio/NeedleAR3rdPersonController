import { Animator } from "../../../Animator";
import { Object3D, Color, AnimationClip, KeyframeTrack } from "three";
import { AnimationExtension } from "../extensions/Animation";
import { GameObject } from "../../../Component";
import { getParam } from "../../../../engine/engine_utils";

const debug = getParam("debugusdz");

export function registerAnimatorsImplictly(root: Object3D, ext: AnimationExtension) {

    // collect animators and their clips
    const animationClips: { root: Object3D, clips: THREE.AnimationClip[] }[] = [];
    const animators = GameObject.getComponentsInChildren(root, Animator);

    // insert rest pose clip
    let injectedRestPose = false;

    if (debug)
        console.log(animators);

    for (const animator of animators) {
        if (!animator || !animator.runtimeAnimatorController) continue;

        if (debug)
            console.log(animator);

        const clips: THREE.AnimationClip[] = [];


        for (const action of animator.runtimeAnimatorController.enumerateActions()) {
            if (debug)
                console.log(action);
            const clip = action.getClip();

            // we need to inject a rest pose clip so that the animation position is correct
            // e.g. when the animation starts in the air and animates down we dont want the object to move under the ground
            if (!injectedRestPose && clip.tracks.length > 0) {
                injectedRestPose = true;
                const track = clip.tracks[0];
                const trackBaseName = track.name.substring(0, track.name.lastIndexOf("."));
                const currentPositionTrack = new KeyframeTrack(trackBaseName + ".position", [0, .01], [0, 0, 0, 0, 0, 0]);
                const currentRotationTrack = new KeyframeTrack(trackBaseName + ".quaternion", [0, .01], [0, 0, 0, 1, 0, 0, 0, 1]);
                clips.push(new AnimationClip("rest", .01, [currentPositionTrack, currentRotationTrack]));
            }

            if (!clips.includes(clip))
                clips.push(clip);
        }

        animationClips.push({ root: animator.gameObject, clips: clips });
    }

    if (debug)
        console.log(animationClips);

    for (const pair of animationClips) {
        for (const clip of pair.clips)
            ext.registerAnimation(pair.root, clip);
    }
}