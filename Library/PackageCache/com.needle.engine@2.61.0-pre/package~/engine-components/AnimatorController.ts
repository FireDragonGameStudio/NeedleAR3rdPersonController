import { Animator } from "./Animator";
import { AnimatorConditionMode, AnimatorControllerModel, AnimatorControllerParameterType, AnimatorStateInfo, Condition, createMotion, State, StateMachineBehaviour } from "../engine/extensions/NEEDLE_animator_controller_model";
import { AnimationAction, AnimationClip, AnimationMixer, AxesHelper, Euler, KeyframeTrack, LoopOnce, LoopRepeat, Matrix4, Object3D, Quaternion, Vector3 } from "three";
import { deepClone, getParam } from "../engine/engine_utils";
import { Context } from "../engine/engine_setup";
import * as THREE from "three";
import { TypeStore } from "../engine/engine_typestore";
import { assign } from "../engine/engine_serialization_core";
import { Mathf } from "../engine/engine_math";
import { isAnimationAction } from "../engine/engine_three_utils";

const debug = getParam("debuganimatorcontroller");
const debugRootMotion = getParam("debugrootmotion");

export class AnimatorController {

    Play(name: string | number, layerIndex: number = -1, normalizedTime: number = Number.NEGATIVE_INFINITY, durationInSec: number = 0) {
        if (layerIndex < 0) layerIndex = 0;
        else if (layerIndex >= this.model.layers.length) {
            console.warn("invalid layer");
            return;
        }
        const layer = this.model.layers[layerIndex];
        const sm = layer.stateMachine;
        for (const state of sm.states) {
            if (state.name === name || state.hash === name) {
                if (debug)
                    console.log("transition to ", state);
                this.transitionTo(state, durationInSec, normalizedTime);
                return;
            }
        }
        console.warn("Could not find " + name + " to play");
    }

    Reset() {
        this.setStartTransition();
    }

    SetBool(name: string | number, value: boolean) {
        const key = typeof name === "string" ? "name" : "hash";
        return this.model?.parameters?.filter(p => p[key] === name).forEach(p => p.value = value);
    }

    GetBool(name: string | number): boolean {
        const key = typeof name === "string" ? "name" : "hash";
        return this.model?.parameters?.find(p => p[key] === name)?.value as boolean ?? false;
    }

    SetFloat(name: string | number, val: number) {
        const key = typeof name === "string" ? "name" : "hash";
        return this.model?.parameters?.filter(p => p[key] === name).forEach(p => p.value = val);
    }

    GetFloat(name: string | number): number {
        const key = typeof name === "string" ? "name" : "hash";
        return this.model?.parameters?.find(p => p[key] === name)?.value as number ?? 0;
    }

    SetInteger(name: string | number, val: number) {
        const key = typeof name === "string" ? "name" : "hash";
        return this.model?.parameters?.filter(p => p[key] === name).forEach(p => p.value = val);
    }

    GetInteger(name: string | number): number {
        const key = typeof name === "string" ? "name" : "hash";
        return this.model?.parameters?.find(p => p[key] === name)?.value as number ?? 0;
    }

    SetTrigger(name: string | number) {
        if (debug)
            console.log("SET TRIGGER", name);
        const key = typeof name === "string" ? "name" : "hash";
        return this.model?.parameters?.filter(p => p[key] === name).forEach(p => p.value = true);
    }

    ResetTrigger(name: string | number) {
        const key = typeof name === "string" ? "name" : "hash";
        return this.model?.parameters?.filter(p => p[key] === name).forEach(p => p.value = false);
    }

    IsInTransition(): boolean {
        return this._activeStates.length > 1;
    }

    SetSpeed(speed: number) {
        this._speed = speed;
    }

    FindState(name: string | undefined | null): State | null {
        if (!name) return null;
        if (Array.isArray(this.model.layers)) {
            for (const layer of this.model.layers) {
                for (const state of layer.stateMachine.states) {
                    if (state.name === name) return state;
                }
            }
        }
        return null;
    }

    normalizedStartOffset: number = 0;

    private _speed: number = 1;

    animator?: Animator;
    model: AnimatorControllerModel;
    get context(): Context | undefined | null { return this.animator?.context; }


    // applyRootMotion(obj: THREE.Object3D) {
    //     // this.internalApplyRootMotion(obj);
    // }

    bind(animator: Animator) {
        this.animator = animator;
        this._mixer = new AnimationMixer(this.animator.gameObject);
        this.createActions(this.animator);
    }

    clone() {
        if (typeof this.model === "string") {
            console.warn("AnimatorController has not been resolved, can not create model from string", this.model);
            return null;
        }
        // clone runtime controller but dont clone clip or action
        const clonedModel = deepClone(this.model, (_owner, _key, _value) => {
            if (_value === null || _value === undefined) return true;
            // dont clone three Objects
            if (_value.type === "Object3D" || _value.isObject3D === true) return false;
            // dont clone AnimationAction
            if (isAnimationAction(_value)) { //.constructor.name === "AnimationAction") {
                // console.log(_value);
                return false;
            }
            // dont clone AnimationClip
            if (_value["tracks"] !== undefined) return false;
            return true;
        }) as AnimatorControllerModel;
        console.assert(clonedModel !== this.model);
        const controller = new AnimatorController(clonedModel);
        return controller;
    }

    update() {
        if (!this.animator) return;
        this.evaluateTransitions();
        this.updateActiveStates();
        const dt = this.animator.context.time.deltaTime;
        if (this.animator.applyRootMotion) {
            this.rootMotionHandler?.onBeforeUpdate();
        }
        this._mixer.update(dt);
        if (this.animator.applyRootMotion) {
            this.rootMotionHandler?.onAfterUpdate();
        }
    }


    private _mixer!: THREE.AnimationMixer;
    private _activeState?: State;

    constructor(model: AnimatorControllerModel) {
        this.model = model;
        if (debug) console.log(this);
    }

    private _activeStates: State[] = [];

    private updateActiveStates() {
        for (let i = 0; i < this._activeStates.length; i++) {
            const state = this._activeStates[i];
            const motion = state.motion;
            if (!motion.action) {
                this._activeStates.splice(i, 1);
                i--;
            }
            else {
                const action = motion.action;
                // console.log(action.getClip().name, action.getEffectiveWeight(), action.isScheduled());
                if ((action.getEffectiveWeight() <= 0 && !action.isRunning())) {
                    if (debug)
                        console.debug("REMOVE", state.name, action.getEffectiveWeight(), action.isRunning(), action.isScheduled())
                    this._activeStates.splice(i, 1);
                    i--;
                }
            }
        }
    }

    private setStartTransition() {
        for (const layer of this.model.layers) {
            const sm = layer.stateMachine;
            if (sm.defaultState === undefined) {
                if (debug)
                    console.warn("AnimatorController default state is undefined, will assign state 0 as default", layer);
                sm.defaultState = 0;
            }
            const start = sm.states[sm.defaultState];
            this.transitionTo(start, 0, this.normalizedStartOffset);
        }
    }

    private evaluateTransitions() {

        const currentLayer = 0;

        let didEnterStateThisFrame = false;
        if (!this._activeState) {
            this.setStartTransition();
            if (!this._activeState) return;
            didEnterStateThisFrame = true;
        }

        const state = this._activeState;
        const action = state.motion.action;
        let index = 0;
        for (const transition of state.transitions) {
            ++index;
            // transition without exit time and without condition that transition to itself are ignored
            if (!transition.hasExitTime && transition.conditions.length <= 0) {
                // if (this._activeState && this.getState(transition.destinationState, currentLayer)?.hash === this._activeState.hash)
                continue;
            }

            let allConditionsAreMet = true;
            for (const cond of transition.conditions) {
                if (!this.evaluateCondition(cond)) {
                    allConditionsAreMet = false;
                    break;
                }
            }
            if (!allConditionsAreMet) continue;

            if (debug && allConditionsAreMet) {
                // console.log("All conditions are met", transition);
            }

            // disable triggers
            for (const cond of transition.conditions) {
                const param = this.model.parameters.find(p => p.name === cond.parameter);
                if (param?.type === AnimatorControllerParameterType.Trigger) {
                    param.value = false;
                }
            }

            if (action) {
                const dur = state.motion.clip!.duration;
                const normalizedTime = dur <= 0 ? 1 : action.time / dur;
                const makeTransition = transition.hasExitTime ? normalizedTime >= transition.exitTime : true;
                // console.log(state.name, makeTransition, transition.hasExitTime, normalizedTime, transition.exitTime)
                if (makeTransition) {
                    // if (transition.hasExitTime && transition.exitTime >= .9999) 
                    action.clampWhenFinished = true;
                    // else action.clampWhenFinished = false;
                    if (debug) {
                        console.log("transition to " + transition.destinationState, transition, normalizedTime, transition.exitTime, transition.hasExitTime);
                        // console.log(action.time, transition.exitTime);
                    }
                    this.transitionTo(transition.destinationState as State, transition.duration, transition.offset);
                    // use the first transition that matches all conditions and make the transition as soon as in range
                    return;
                }
            }
            else {
                this.transitionTo(transition.destinationState as State, transition.duration, transition.offset);
                return;
            }
            // if none of the transitions can be made continue searching for another transition meeting the conditions
        }

        let didTriggerLooping = false;
        if (state.motion.isLooping && action) {
            // we dont use the three loop state here because it prevents the transition check above
            // it is easier if we re-trigger loop here. 
            // We also can easily add the cycle offset settings from unity later
            if (action.time >= action.getClip().duration) {
                didTriggerLooping = true;
                action.reset();
                action.time = 0;
                action.play();
            }
        }

        // call update state behaviours:
        if (!didTriggerLooping && state && !didEnterStateThisFrame && action && this.animator) {
            if (state.behaviours) {
                const duration = action?.getClip().duration;
                const normalizedTime = action.time / duration;
                const info = new AnimatorStateInfo(this._activeState, normalizedTime, duration, this._speed)
                for (const beh of state.behaviours) {
                    if (beh.instance) {
                        beh.instance.onStateUpdate?.call(beh.instance, this.animator, info, 0);
                    }
                }
            }
        }

    }

    private getState(state: State | number, layerIndex: number): State | null {
        if (typeof state === "number") {
            if (state == -1) {
                state = this.model.layers[layerIndex].stateMachine.defaultState; // exit state -> entry state
                if (state === undefined) {
                    if (debug)
                        console.warn("AnimatorController default state is undefined: ", this.model, "Layer: " + layerIndex);
                    state = 0;
                }
            }
            state = this.model.layers[layerIndex].stateMachine.states[state];
        }
        return state;
    }

    private transitionTo(state: State | number, durationInSec: number, offsetNormalized: number) {

        if (!this.animator) return;

        const layerIndex = 0;

        state = this.getState(state, layerIndex) as State;

        if (!state?.motion || !state.motion.clip) {
            // if(debug) console.warn("State has no clip or motion", state);
            return;
        }

        const isSelf = this._activeState === state;
        if (isSelf) {
            const motion = state.motion;
            if (!motion.action_loopback && motion.clip) {
                this._mixer.uncacheAction(motion.clip, this.animator.gameObject);
                motion.action_loopback = this.createAction(motion.clip);
            }
        }

        // call exit state behaviours
        if (this._activeState?.behaviours && this._activeState.motion.action) {
            const duration = this._activeState?.motion.clip!.duration;
            const normalizedTime = this._activeState.motion.action.time / duration;
            const info = new AnimatorStateInfo(this._activeState, normalizedTime, duration, this._speed);
            for (const beh of this._activeState.behaviours) {
                beh.instance?.onStateExit?.call(beh.instance, this.animator, info, layerIndex);
            }
        }

        const prevAction = this._activeState?.motion.action;
        if (prevAction) {
            prevAction!.fadeOut(durationInSec);
        }
        if (isSelf) {
            state.motion.action = state.motion.action_loopback;
            state.motion.action_loopback = prevAction;
        }
        const prev = this._activeState;
        this._activeState = state;

        const action = state.motion?.action;
        if (action) {

            offsetNormalized = Math.max(0, Math.min(1, offsetNormalized));
            if (action.isRunning())
                action.stop();
            action.reset();
            action.timeScale = this._speed;
            action.enabled = true;
            const duration = state.motion.clip!.duration;
            action.time = offsetNormalized * duration;
            action.clampWhenFinished = true;
            action.setLoop(LoopOnce, 0);
            if (durationInSec > 0)
                action.fadeIn(durationInSec);
            else action.setEffectiveWeight(1);
            action.play();


            if (this.rootMotionHandler) {
                this.rootMotionHandler.onStart(action);
            }

            if (!this._activeStates.includes(state))
                this._activeStates.push(state);

            // call enter state behaviours
            if (this._activeState.behaviours) {
                const info = new AnimatorStateInfo(state, offsetNormalized, duration, this._speed);
                for (const beh of this._activeState.behaviours) {
                    beh.instance?.onStateEnter?.call(beh.instance, this.animator, info, layerIndex);
                }
            }
        }
        else console.warn("No action", state.motion, this);

        if (debug)
            console.log("TRANSITION FROM " + prev?.name + " TO " + state.name, durationInSec, prevAction, action, action?.getEffectiveTimeScale(), action?.getEffectiveWeight(), action?.isRunning(), action?.isScheduled(), action?.paused);
    }

    private createAction(clip: AnimationClip) {

        // uncache clip causes issues when multiple states use the same clip
        // this._mixer.uncacheClip(clip);
        // instead only uncache the action when one already exists to make sure
        // we get unique actions per state
        const existing = this._mixer.existingAction(clip);
        if (existing) this._mixer.uncacheAction(clip, this.animator?.gameObject);

        if (this.animator?.applyRootMotion) {
            if (!this.rootMotionHandler) {
                this.rootMotionHandler = new RootMotionHandler(this);
            }
            // TODO: find root bone properly
            const root = this.animator.gameObject;
            return this.rootMotionHandler.createClip(this._mixer, root, clip);
        }
        else {
            const action = this._mixer.clipAction(clip);
            return action;
        }
    }

    private evaluateCondition(cond: Condition): boolean {
        const param = this.model.parameters.find(p => p.name === cond.parameter);
        if (!param) return false;
        // console.log(param.name, param.value);
        switch (cond.mode) {
            case AnimatorConditionMode.If:
                return param.value === true;
            case AnimatorConditionMode.IfNot:
                return param.value === false;
            case AnimatorConditionMode.Greater:
                return param.value > cond.threshold;
            case AnimatorConditionMode.Less:
                return param.value < cond.threshold;
            case AnimatorConditionMode.Equals:
                return param.value === cond.threshold;
            case AnimatorConditionMode.NotEqual:
                return param.value !== cond.threshold;
        }
        return false;
    }

    private createActions(_animator: Animator) {
        // console.trace(this.model, _animator);
        for (const layer of this.model.layers) {
            const sm = layer.stateMachine;
            for (let index = 0; index < sm.states.length; index++) {
                const state = sm.states[index];

                // ensure we have a transitions array
                if (!state.transitions) {
                    state.transitions = [];
                }
                for (const t of state.transitions) {
                    // can happen if conditions are empty in blender - the exporter seems to skip empty arrays
                    if (!t.conditions) t.conditions = [];
                }

                // ensure we have a motion even if none was exported
                if (!state.motion) {
                    state.motion = createMotion(state.name);
                    // console.warn("Missing motion", "AnimatorController: " + this.model.name, state);
                    // sm.states.splice(index, 1);
                    // index -= 1;
                    // continue;
                }
                // the clips array contains which animator has which animationclip
                if (this.animator && state.motion.clips) {
                    // TODO: we have to compare by name because on instantiate we clone objects but not the node object
                    const mapping = state.motion.clips?.find(e => e.node.name === this.animator?.gameObject?.name);
                    // console.log(state.name, mapping?.clip);
                    state.motion.clip = mapping?.clip;
                }

                // ensure we have a clip to blend to
                if (!state.motion.clip) {
                    const clip = new AnimationClip(undefined, undefined, []);
                    state.motion.clip = clip;
                }

                if (state.motion?.clip) {
                    const clip = state.motion.clip;
                    const action = this.createAction(clip);
                    state.motion.action = action;
                }

                // create state machine behaviours
                if (state.behaviours && Array.isArray(state.behaviours)) {
                    for (const behaviour of state.behaviours) {
                        if (!behaviour?.typeName) continue;
                        const type = TypeStore.get(behaviour.typeName);
                        const instance: StateMachineBehaviour = new type() as StateMachineBehaviour;
                        if (instance.isStateMachineBehaviour) {
                            instance._context = this.context ?? undefined;
                            assign(instance, behaviour.properties);
                            behaviour.instance = instance;
                        }
                        if (debug) console.log("Created animator controller behaviour", state.name, behaviour.typeName, behaviour.properties, instance);
                    }
                }
            }
        }
    }

    *enumerateActions() {

        for (const layer of this.model.layers) {
            const sm = layer.stateMachine;
            for (let index = 0; index < sm.states.length; index++) {
                const state = sm.states[index];
                if (state?.motion) {
                    if (state.motion.action)
                        yield state.motion.action;
                    if (state.motion.action_loopback)
                        yield state.motion.action_loopback;
                }
            }
        }
    }


    // https://docs.unity3d.com/Manual/RootMotion.html
    private rootMotionHandler?: RootMotionHandler;


    // private findRootBone(obj: THREE.Object3D): THREE.Object3D | null {
    //     if (this.animationRoot) return this.animationRoot;
    //     if (obj.type === "Bone") {
    //         this.animationRoot = obj as THREE.Bone;
    //         return this.animationRoot;
    //     }
    //     if (obj.children) {
    //         for (const ch of obj.children) {
    //             const res = this.findRootBone(ch);
    //             if (res) return res;
    //         }
    //     }
    //     return null;
    // }
}

class TrackEvaluationWrapper {

    track?: KeyframeTrack;
    createdInterpolant?: any;
    originalEvaluate?: Function;
    private customEvaluate?: (time: number) => any;

    constructor(track: KeyframeTrack, evaluate: (time: number, value: any) => any) {
        this.track = track;
        const t = track as any;
        const createOriginalInterpolator = t.createInterpolant.bind(track);
        t.createInterpolant = () => {
            t.createInterpolant = createOriginalInterpolator;
            this.createdInterpolant = createOriginalInterpolator();
            this.originalEvaluate = this.createdInterpolant.evaluate.bind(this.createdInterpolant);
            this.customEvaluate = time => {
                if (!this.originalEvaluate) return;
                const res = this.originalEvaluate(time);
                return evaluate(time, res);
            };
            this.createdInterpolant.evaluate = this.customEvaluate;
            return this.createdInterpolant;
        }
    };

    evaluate(time) {
        if (this.customEvaluate) {
            this.customEvaluate(time);
        }
    }

    dispose() {
        if (this.createdInterpolant && this.originalEvaluate) {
            this.createdInterpolant.evaluate = this.originalEvaluate;
        }
        this.track = undefined;
        this.createdInterpolant = null;
        this.originalEvaluate = undefined;
        this.customEvaluate = undefined;
    }
}

class RootMotionAction {

    private static lastObjPosition: { [key: string]: THREE.Vector3 } = {};
    static lastObjRotation: { [key: string]: THREE.Quaternion } = {};

    // we remove the first keyframe rotation from the space rotation when updating
    private static firstKeyframeRotation: { [key: string]: THREE.Quaternion } = {};
    // this is used to rotate the space on clip end / start (so the transform direction is correct)
    private static spaceRotation: { [key: string]: THREE.Quaternion } = {};
    private static effectiveSpaceRotation: { [key: string]: THREE.Quaternion } = {};

    private static clipOffsetRotation: { [key: string]: THREE.Quaternion } = {};


    set action(val: AnimationAction) {
        this._action = val;
    }
    get action() {
        return this._action;
    }

    private _action!: AnimationAction;

    private root: Object3D;
    private clip: AnimationClip;
    private positionWrapper: TrackEvaluationWrapper | null = null;
    private rotationWrapper: TrackEvaluationWrapper | null = null;
    private context: Context;

    positionChange: Vector3 = new Vector3();
    rotationChange: Quaternion = new Quaternion();

    constructor(context: Context, root: THREE.Object3D, clip: AnimationClip, positionTrack: KeyframeTrack | null, rotationTrack: KeyframeTrack | null) {
        // console.log(this, positionTrack, rotationTrack);
        this.context = context;
        this.root = root;
        this.clip = clip;

        if (!RootMotionAction.firstKeyframeRotation[clip.uuid])
            RootMotionAction.firstKeyframeRotation[clip.uuid] = new THREE.Quaternion();
        if (rotationTrack) {
            const values = rotationTrack.values;
            RootMotionAction.firstKeyframeRotation[clip.uuid]
                .set(values[0], values[1], values[2], values[3])
        }

        if (!RootMotionAction.spaceRotation[clip.uuid])
            RootMotionAction.spaceRotation[clip.uuid] = new Quaternion();

        if (!RootMotionAction.effectiveSpaceRotation[clip.uuid])
            RootMotionAction.effectiveSpaceRotation[clip.uuid] = new Quaternion();

        RootMotionAction.clipOffsetRotation[clip.uuid] = new Quaternion();
        if (rotationTrack) {
            RootMotionAction.clipOffsetRotation[clip.uuid]
                .set(rotationTrack.values[0], rotationTrack.values[1], rotationTrack.values[2], rotationTrack.values[3])
                .invert();
        }

        this.handlePosition(clip, positionTrack);
        this.handleRotation(clip, rotationTrack);
    }

    onStart(action: AnimationAction) {
        if (action.getClip() !== this.clip) return;

        const lastRotation = RootMotionAction.lastObjRotation[this.root.uuid];
        // const firstKeyframe = RootMotionAction.firstKeyframeRotation[this.clip.uuid];
        // lastRotation.invert().premultiply(firstKeyframe).invert();
        RootMotionAction.spaceRotation[this.clip.uuid].copy(lastRotation);

        if (debugRootMotion) 
        {
            const euler = new THREE.Euler().setFromQuaternion(lastRotation);
            console.log("START", this.clip.name, Mathf.toDegrees(euler.y));
        }
    }

    private getClipRotationOffset() {
        return RootMotionAction.clipOffsetRotation[this.clip.uuid];
    }

    private handlePosition(_clip: AnimationClip, track: KeyframeTrack | null) {
        if (track) {
            const root = this.root;
            if (debugRootMotion)
                root.add(new AxesHelper());
            if (!RootMotionAction.lastObjPosition[root.uuid]) RootMotionAction.lastObjPosition[root.uuid] = new Vector3();
            const valuesDiff = new Vector3();
            const valuesPrev = new Vector3();
            let prevTime: number = 0;
            // const rotation = new Quaternion();
            this.positionWrapper = new TrackEvaluationWrapper(track, (time, value: Float64Array) => {

                const weight = this.action.getEffectiveWeight();

                // root.position.copy(RootMotionAction.lastObjPosition[root.uuid]);

                // reset for testing
                if (debugRootMotion) {
                    if (root.position.length() > 8)
                        root.position.set(0, root.position.y, 0);
                }


                if (time > prevTime) {
                    valuesDiff.set(value[0], value[1], value[2]);
                    valuesDiff.sub(valuesPrev);
                    valuesDiff.multiplyScalar(weight);
                    valuesDiff.applyQuaternion(this.getClipRotationOffset());

                    const id = this.clip.uuid;
                    // RootMotionAction.effectiveSpaceRotation[id].slerp(RootMotionAction.spaceRotation[id], weight);
                    valuesDiff.applyQuaternion(RootMotionAction.spaceRotation[id]);
                    this.positionChange.copy(valuesDiff);
                    // root.position.add(valuesDiff);
                }
                // RootMotionAction.lastObjPosition[root.uuid].copy(root.position);
                valuesPrev.fromArray(value);
                prevTime = time;
                value[0] = 0;
                value[1] = 0;
                value[2] = 0;
                return value;

            });
        }
    }

    private static identityQuaternion = new Quaternion();

    private handleRotation(clip: AnimationClip, track: KeyframeTrack | null) {
        if (track) {
            if (debugRootMotion) {
                const arr = track.values;
                const firstKeyframe = new Euler().setFromQuaternion(new Quaternion(arr[0], arr[1], arr[2], arr[3]));
                console.log(clip.name, track.name, "FIRST ROTATION IN TRACK", Mathf.toDegrees(firstKeyframe.y));
                const i = track.values.length - 4;
                const lastKeyframe = new Quaternion().set(arr[i], arr[i + 1], arr[i + 2], arr[i + 3]);
                const euler = new Euler().setFromQuaternion(lastKeyframe);
                console.log(clip.name, track.name, "LAST ROTATION IN TRACK", Mathf.toDegrees(euler.y));
            }


            const root = this.root;
            if (!RootMotionAction.lastObjRotation[root.uuid]) RootMotionAction.lastObjRotation[root.uuid] = new Quaternion();
            // const temp = new Quaternion();
            let prevTime: number = 0;
            const valuesPrev = new Quaternion();
            const valuesDiff = new Quaternion();
            // const summedRot = new Quaternion();
            this.rotationWrapper = new TrackEvaluationWrapper(track, (time, value: Float64Array) => {
                // root.quaternion.copy(RootMotionAction.lastObjRotation[root.uuid]);
                if (time > prevTime) {
                    valuesDiff.set(value[0], value[1], value[2], value[3]);
                    valuesPrev.invert();
                    valuesDiff.multiply(valuesPrev);
                    // if(weight < .99) valuesDiff.slerp(RootMotionAction.identityQuaternion, 1 - weight);
                    this.rotationChange.copy(valuesDiff);
                    // root.quaternion.multiply(valuesDiff);
                }
                // else
                //     root.quaternion.multiply(this.getClipRotationOffset());

                // RootMotionAction.lastObjRotation[root.uuid].copy(root.quaternion);
                valuesPrev.fromArray(value);
                prevTime = time;
                value[0] = 0;
                value[1] = 0;
                value[2] = 0;
                value[3] = 1;
                return value;
            });
        }
    }

    // private lastPos: Vector3 = new Vector3();

    onBeforeUpdate() {
        this.positionChange.set(0, 0, 0);
        this.rotationChange.set(0, 0, 0, 1);
    }

    onAfterUpdate() {
        const weight = this.action.getEffectiveWeight();
        this.positionChange.multiplyScalar(weight);
        this.rotationChange.slerp(RootMotionAction.identityQuaternion, 1 - weight);
        // const root = this.root;
        // RootMotionAction.lastObjRotation[root.uuid].slerp(root.quaternion, weight);
        // if (weight > .5) {
        // }
        // this.obj.position.copy(this.lastPos).add(this.positionDiff);
    }
}

class RootMotionHandler {

    private controller: AnimatorController;
    private handler: RootMotionAction[] = [];
    private root!: THREE.Object3D;

    constructor(controller: AnimatorController) {
        this.controller = controller;
    }

    createClip(mixer: AnimationMixer, root: THREE.Object3D, clip: AnimationClip): AnimationAction {
        this.root = root;
        let rootName = "";
        if (root && "name" in root) {
            rootName = root.name;
        }
        const positionTrack = this.findRootTrack(clip, ".position");
        const rotationTrack = this.findRootTrack(clip, ".quaternion");
        const handler = new RootMotionAction(this.controller.context!, root, clip, positionTrack, rotationTrack);
        this.handler.push(handler);

        // it is important we do this after the handler is created
        // otherwise we can not hook into threejs interpolators
        const action = mixer.clipAction(clip);
        handler.action = action;
        return action;
    }

    onStart(action: AnimationAction) {
        for (const handler of this.handler) {
            handler.onStart(action);
        }
    }

    onBeforeUpdate() {
        for (const hand of this.handler)
            hand.onBeforeUpdate();
    }

    private summedPosition: Vector3 = new Vector3();
    private summedRotation: Quaternion = new Quaternion();

    onAfterUpdate() {
        this.summedPosition.set(0, 0, 0);
        this.summedRotation.set(0, 0, 0, 1);
        for (const entry of this.handler) {
            entry.onAfterUpdate();
            this.summedPosition.add(entry.positionChange);
            this.summedRotation.multiply(entry.rotationChange);
        }
        this.root.position.add(this.summedPosition);
        this.root.quaternion.multiply(this.summedRotation);
        RootMotionAction.lastObjRotation[this.root.uuid].copy(this.root.quaternion);
    }

    private findRootTrack(clip: AnimationClip, name: string) {
        const tracks = clip.tracks;
        for (const track of tracks) {
            if (track.name.endsWith(name)) {
                // if (track.name.includes("Hips"))
                //     return track;
                return track;
            }
        }
        return null;
    }
}