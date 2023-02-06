export declare interface IModel {
    guid: string;
    dontSave?: boolean; // if set to true the model will not be saved in the server room state
}


export enum SendQueue {
    OnConnection,
    OnRoomJoin,
    Queued,
    Immediate,
}

export declare interface INetworkConnection {
    get isConnected(): boolean;

    send(key: string, data: IModel | object | boolean | null | string | number, queue: SendQueue): unknown;

}