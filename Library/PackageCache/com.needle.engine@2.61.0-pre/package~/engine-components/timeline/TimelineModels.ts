

export declare type TimelineAssetModel = {
    name: string;
    tracks: TrackModel[];
}


export enum TrackType {
    Activation = "ActivationTrack",
    Animation = "AnimationTrack",
    Audio = "AudioTrack",
    Control = "ControlTrack",
    Marker = "MarkerTrack",
    Signal = "SignalTrack",
}

export enum ClipExtrapolation {
    None = 0,
    Hold = 1,
    Loop = 2,
    PingPong = 3,
    Continue = 4
};

export declare type TrackModel = {
    name: string;
    type: TrackType;
    muted: boolean;
    outputs: Array<null | string | object>;
    clips: Array<ClipModel>;
    markers: Array<MarkerModel>;
    trackOffset?: TrackOffset;
}

declare type Vec3 = { x: number, y: number, z: number };
declare type Quat = { x: number, y: number, z: number, w: number };

export declare type TrackOffset = {
    position: Vec3 | THREE.Vector3;
    rotation: Quat | THREE.Quaternion;
}

export declare type ClipModel = {
    start: number;
    end: number;
    duration: number;
    timeScale: number;
    asset: any | AudioClipModel | ControlClipModel | AnimationClipModel;
    clipIn: number;
    easeInDuration: number;
    easeOutDuration: number;
    preExtrapolationMode: ClipExtrapolation;
    postExtrapolationMode: ClipExtrapolation;
    reversed?: boolean;
}

export declare type AnimationClipModel = {
    clip: string | number | THREE.AnimationClip;
    loop: boolean;
    duration: number;
    removeStartOffset: boolean;
    position?: Vec3 | THREE.Vector3;
    rotation?: Quat | THREE.Quaternion;
}

export declare type AudioClipModel = {
    clip: string;
    loop: boolean;
    volume: number;
}

export declare type ControlClipModel = {
    sourceObject: string | THREE.Object3D;
    controlActivation: boolean;
    updateDirector: boolean;
}

export enum MarkerType {
    Signal = "SignalEmitter",
}

export declare class MarkerModel {
    type: MarkerType;
    time: number;
}

export declare class SignalMarkerModel extends MarkerModel {
    retroActive: boolean;
    emitOnce: boolean;
    asset: string;
}
