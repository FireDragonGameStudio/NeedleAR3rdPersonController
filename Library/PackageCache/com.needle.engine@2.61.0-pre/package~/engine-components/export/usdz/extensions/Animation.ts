import { GameObject } from "../../../Component";
import { getParam } from "../../../../engine/engine_utils";
import { Object3D, Color, Matrix4, MeshStandardMaterial, Vector3, Quaternion, Interpolant } from "three";
//@ts-ignore
import { USDZObject, buildMatrix } from "three/examples/jsm/exporters/USDZExporter"
import { IUSDZExporterExtension } from "../Extension";

const debug = getParam("debugusdzanimation");

export interface UsdzAnimation {
    createAnimation(ext: AnimationExtension, model: USDZObject, context);
}

export type AnimationClipCollection = Array<{ root: Object3D, clips: Array<THREE.AnimationClip> }>;

export class RegisteredAnimationInfo {

    get start(): number { return this.ext.getStartTime01(this.root, this.clip); }
    get duration(): number { return this.clip.duration; }

    private ext: AnimationExtension;
    private root: Object3D;
    private clip: THREE.AnimationClip;

    constructor(ext: AnimationExtension, root: THREE.Object3D, clip: THREE.AnimationClip) {
        this.ext = ext;
        this.root = root;
        this.clip = clip;
    }
}

export class TransformData {
    clip: THREE.AnimationClip;
    pos?: THREE.KeyframeTrack;
    rot?: THREE.KeyframeTrack;
    scale?: THREE.KeyframeTrack;
    get frameRate(): number { return 60; }

    private ext: AnimationExtension;
    private root: Object3D;
    private target: Object3D;

    constructor(ext: AnimationExtension, root: Object3D, target: Object3D, clip: THREE.AnimationClip) {
        this.ext = ext;
        this.root = root;
        this.target = target;
        this.clip = clip;
    }

    addTrack(track) {
        if (track.name.endsWith("position")) this.pos = track;
        if (track.name.endsWith("quaternion")) this.rot = track;
        if (track.name.endsWith("scale")) this.scale = track;
    }

    getFrames(): number {
        return Math.max(this.pos?.times?.length ?? 0, this.rot?.times?.length ?? 0, this.scale?.times?.length ?? 0);
    }

    getDuration(): number {
        const times = this.pos?.times ?? this.rot?.times ?? this.scale?.times;
        if (!times) return 0;
        return times[times.length - 1];
    }

    getStartTime(arr: TransformData[]): number {
        let sum = 0;
        for (let i = 0; i < arr.length; i++) {
            const entry = arr[i];
            if (entry === this) {
                return sum;
            }
            else sum += entry.getDuration();
        }
        return sum;
    }
}

declare type AnimationDict = Map<Object3D, Array<TransformData>>;

export class AnimationExtension implements IUSDZExporterExtension {

    get extensionName(): string { return "animation" }
    private dict: AnimationDict = new Map();
    // private rootTargetMap: Map<Object3D, Object3D[]> = new Map();
    private rootTargetMap: Map<Object3D, Object3D[]> = new Map();

    getStartTime01(root: Object3D, clip: THREE.AnimationClip) {
        const targets = this.rootTargetMap.get(root);
        if (!targets) return Infinity;
        let longestStartTime: number = -1;
        for (const target of targets) {
            const data = this.dict.get(target);
            let startTimeInSeconds = 0;
            if (data?.length) {
                for (const entry of data) {
                    if (entry.clip === clip) {
                        break;
                    }
                    startTimeInSeconds += entry.getDuration();
                }
                longestStartTime = Math.max(longestStartTime, startTimeInSeconds);
            }
            else {
                console.warn("No animation found on root", root, clip, data);
            }
        }
        return longestStartTime;
    }

    registerAnimation(root: Object3D, clip: THREE.AnimationClip): RegisteredAnimationInfo | null {
        if (!clip || !root) return null;
        if (!this.rootTargetMap.has(root)) this.rootTargetMap.set(root, []);
        // this.rootTargetMap.get(root)?.push(clip);

        for (const track of clip.tracks) {
            const trackName = track.name.split(".")[2];
            const animationTarget = root.getObjectByName(trackName); // object name
            if (!animationTarget) {
                console.warn("no object found for track", track.name, "using " + root.name + " instead");
                continue;
                // // if no object was found it might be that we have a component that references an animation clip but wants to target another object
                // // in that case UnityGLTF writes the name of the component as track targets because it doesnt know of the intented target
                // animationTarget = root;
            }
            if (!this.dict.has(animationTarget)) {
                this.dict.set(animationTarget, []);
            }
            const arr = this.dict.get(animationTarget);
            if (!arr) continue;

            let model = arr.find(x => x.clip === clip);
            if (!model) {
                model = new TransformData(this, root, animationTarget, clip);
                arr.push(model);
            }
            model.addTrack(track);

            const targets = this.rootTargetMap.get(root);
            if (!targets?.includes(animationTarget)) targets?.push(animationTarget);
        }

        // get the entry for this object. 
        // This doesnt work if we have clips animating multiple objects
        const info = new RegisteredAnimationInfo(this, root, clip);
        return info;
    }

    onAfterHierarchy(_context) {
        if (debug)
            console.log(this.dict);
    }

    private serializers: SerializeAnimation[] = [];

    onAfterBuildDocument(_context: any) {
        for (const ser of this.serializers) {
            const parent = ser.model?.parent;
            const isEmptyParent = parent?.isDynamic === true;
            if (debug)
                console.log(isEmptyParent, ser.model?.parent);
            if (isEmptyParent) {
                ser.registerCallback(parent);
            }
        }
    }

    onExportObject(object, model: USDZObject, _context) {

        GameObject.foreachComponent(object, (comp) => {
            const c = comp as unknown as UsdzAnimation;
            if (typeof c.createAnimation === "function") {
                c.createAnimation(this, model, _context);
            }
        }, false);

        // we need to be able to retarget serialization to empty parents before actually serializing (we do that in another callback)
        const ser = new SerializeAnimation(object, this.dict);
        this.serializers.push(ser);
        ser.registerCallback(model);
    }

}


class SerializeAnimation {

    object: Object3D;
    dict: AnimationDict;
    model: USDZObject;

    private callback?: Function;

    constructor(object: Object3D, dict: AnimationDict) {
        this.object = object;
        this.dict = dict;
    }

    registerCallback(model: USDZObject) {
        if (this.model && this.callback) {
            this.model.removeEventListener("serialize", this.callback);
        }
        if (!this.callback)
            this.callback = this.onSerialize.bind(this);
        if (debug)
            console.log("REPARENT", model);
        this.model = model;
        this.model.addEventListener("serialize", this.callback);
    }

    onSerialize(writer, _context) {
        if (debug)
            console.log("SERIALIZE", this.model.name, this.object.type);
        // do we have a track for this?
        const object = this.object;
        const arr = this.dict.get(object);
        if (!arr) return;

        // console.log("found data for", object, "exporting animation now");



        // assumption: all tracks have the same time values
        // TODO collect all time values and then use the interpolator to access

        const composedTransform = new Matrix4();
        const translation = new Vector3();
        const rotation = new Quaternion();
        const scale = new Vector3(1, 1, 1);

        // TODO doesn't support individual time arrays right now
        // could use these in case we don't have time values that are identical
        /*
        const translationInterpolant = o.pos?.createInterpolant() as THREE.Interpolant;
        const rotationInterpolant = o.rot?.createInterpolant() as THREE.Interpolant;
        const scaleInterpolant = o.scale?.createInterpolant() as THREE.Interpolant;
        */

        writer.appendLine("matrix4d xformOp:transform.timeSamples = {");
        writer.indent++;

        for (const transformData of arr) {
            let timesArray = transformData.pos?.times;
            if (!timesArray || transformData.rot && transformData.rot.times?.length > timesArray?.length) timesArray = transformData.rot?.times;
            if (!timesArray || transformData.scale && transformData.scale.times?.length > timesArray?.length) timesArray = transformData.scale?.times;
            if (!timesArray) {
                console.error("got an animated object but no time values??", object, transformData);
                continue;
            }
            const startTime = transformData.getStartTime(arr);

            if (debug)
                writer.appendLine(transformData.clip.name + ": start=" + startTime.toFixed(3) + ", length=" + transformData.getDuration().toFixed(3) + ", frames=" + transformData.getFrames());

            // ignore until https://github.com/three-types/three-ts-types/pull/293 gets merged
            //@ts-ignore
            const positionInterpolant: Interpolant | undefined = transformData.pos?.createInterpolant();
            //@ts-ignore
            const rotationInterpolant: Interpolant | undefined = transformData.rot?.createInterpolant();
            //@ts-ignore
            const scaleInterpolant: Interpolant | undefined = transformData.scale?.createInterpolant();

            if (!positionInterpolant) translation.set(object.position.x, object.position.y, object.position.z);
            if (!rotationInterpolant) rotation.set(object.quaternion.x, object.quaternion.y, object.quaternion.z, object.quaternion.w);
            if (!scaleInterpolant) scale.set(object.scale.x, object.scale.y, object.scale.z);

            for (let index = 0; index < timesArray.length; index++) {
                const time = timesArray[index];

                if (positionInterpolant) {
                    const pos = positionInterpolant.evaluate(time);
                    translation.set(pos[0], pos[1], pos[2]);
                }
                if (rotationInterpolant) {
                    const quat = rotationInterpolant.evaluate(time);
                    rotation.set(quat[0], quat[1], quat[2], quat[3]);
                }
                if (scaleInterpolant) {
                    const scale = scaleInterpolant.evaluate(time);
                    scale.set(scale[0], scale[1], scale[2]);
                }

                composedTransform.compose(translation, rotation, scale);

                let line = `${(startTime + time) * transformData.frameRate}: ${buildMatrix(composedTransform)},`;
                if (debug) line = "#" + index + "\t" + line;
                writer.appendLine(line);
            }

        }
        writer.indent--;
        writer.appendLine("}");

        /*
        let transform3 = new Matrix4();
        transform3.compose(0.2,0,0);
        const transform = buildMatrix(model.matrix);
        const transform2 = buildMatrix(transform3.multiply(model.matrix));
        
        writer.appendLine(`matrix4d xformOp:transform.timeSamples = {
            0: ${transform},
            30: ${transform2}
        }`);
        */
    }
}
