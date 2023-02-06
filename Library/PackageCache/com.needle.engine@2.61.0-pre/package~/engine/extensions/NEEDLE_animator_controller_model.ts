import { Animator } from "../../engine-components/Animator";
import { AnimationAction, AnimationClip, MathUtils, Object3D } from "three"
import { Context } from "../engine_setup";
import { InstantiateIdProvider } from "../../engine/engine_networking_instantiate";


export declare type AnimatorControllerModel = {
    name: string,
    guid: string,
    parameters: Parameter[],
    layers: Layer[],
}

export declare type Parameter = {
    name: string;
    /** the animator string to hash result, test against this if a number is used to get a param value */
    hash: number;
    type: AnimatorControllerParameterType;
    value: number | boolean | string;
}

export declare type Layer = {
    name: string,
    stateMachine: StateMachine
}

export declare type StateMachine = {
    defaultState: number;
    states: State[],
}

export declare type State = {
    name: string,
    hash: number;
    motion: Motion,
    transitions: Transition[],
    behaviours: StateMachineBehaviourModel[],
}

export declare type StateMachineBehaviourModel = {
    typeName: string;
    properties: object;
    instance?: StateMachineBehaviour;
}

export abstract class StateMachineBehaviour {
    _context?: Context;
    get context(): Context { return this._context ?? Context.Current; }
    get isStateMachineBehaviour() { return true; }
    onStateEnter?(animator: Animator, _animatorStateInfo: AnimatorStateInfo, layerIndex: number);
    onStateUpdate?(animator: Animator, animatorStateInfo: AnimatorStateInfo, _layerIndex: number);
    onStateExit?(animator: Animator, animatorStateInfo: AnimatorStateInfo, layerIndex: number);
}

export class AnimatorStateInfo {

    private _name: string;
    get name(): string { return this._name; }

    private _nameHash: number;
    get nameHash(): number { return this._nameHash; }

    private _normalizedTime: number;
    get normalizedTime(): number { return this._normalizedTime; }

    private _length: number;
    get length() {
        return this._length;
    }

    private _speed: number;
    get speed() {
        return this._speed;
    }

    constructor(state: State, normalizedTime: number, length: number, speed: number) {
        this._name = state.name;
        this._nameHash = state.hash;
        this._normalizedTime = normalizedTime;
        this._length = length;
        this._speed = speed;
    }
}

export declare type Motion = {
    name: string,
    isLooping: boolean,
    guid: string,
    /** clip index in gltf animations array */
    index: number,
    /** the resolved clip */
    clip?: AnimationClip,
    /** the clip mapping -> which object has which animationclip */
    clips?: ClipMapping[];
    action?: AnimationAction,
    /** used when a transition points to the same state we need another action to blend */
    action_loopback?: AnimationAction,
}

export function createMotion(name: string, id?: InstantiateIdProvider): Motion {
    return {
        name: "",
        isLooping: false,
        guid: id?.generateUUID() ?? MathUtils.generateUUID(),
        index: -1,
        clip: new AnimationClip(name, 1, []),
    }
}

export declare type ClipMapping = {
    /** the object this clip is for */
    node: Object3D;
    /** the animationclip we resolve from a json ptr */
    clip: AnimationClip;
}

export declare type Transition = {
    isExit: boolean;
    exitTime: number,
    hasFixedDuration: boolean,
    offset: number,
    duration: number,
    hasExitTime: number,
    destinationState: number | State,
    conditions: Condition[],
    // isAny?: boolean
}

export declare type Condition = {
    parameter: string,
    mode: AnimatorConditionMode,
    threshold: number,
}


/// <summary>
///   <para>The mode of the condition.</para>
/// </summary>
export enum AnimatorConditionMode {
    /// <summary>
    ///   <para>The condition is true when the parameter value is true.</para>
    /// </summary>
    If = 1,
    /// <summary>
    ///   <para>The condition is true when the parameter value is false.</para>
    /// </summary>
    IfNot = 2,
    /// <summary>
    ///   <para>The condition is true when parameter value is greater than the threshold.</para>
    /// </summary>
    Greater = 3,
    /// <summary>
    ///   <para>The condition is true when the parameter value is less than the threshold.</para>
    /// </summary>
    Less = 4,
    /// <summary>
    ///   <para>The condition is true when parameter value is equal to the threshold.</para>
    /// </summary>
    Equals = 6,
    /// <summary>
    ///   <para>The condition is true when the parameter value is not equal to the threshold.</para>
    /// </summary>
    NotEqual = 7,
}

/// <summary>
///   <para>The type of the parameter.</para>
/// </summary>
export enum AnimatorControllerParameterType {
    /// <summary>
    ///   <para>Float type parameter.</para>
    /// </summary>
    Float = 1,
    /// <summary>
    ///   <para>Int type parameter.</para>
    /// </summary>
    Int = 3,
    /// <summary>
    ///   <para>Boolean type parameter.</para>
    /// </summary>
    Bool = 4,
    /// <summary>
    ///   <para>Trigger type parameter.</para>
    /// </summary>
    Trigger = 9,
}