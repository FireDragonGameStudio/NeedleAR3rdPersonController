
import * as flatbuffers from "flatbuffers"
import { Transform } from "./transform";
import { SyncedTransformModel } from "./synced-transform-model";

// registry
const binaryIdentifierCasts : {[key:string] : (bin:flatbuffers.ByteBuffer) => object} = {};

export function registerType(identifier:string, cast: (bin:flatbuffers.ByteBuffer) => object) {
    binaryIdentifierCasts[identifier] = cast;
}

// called by networking on receiving a new binary blob
// it's just a little helper method so listeners dont have to cast to types every time
export function tryCast(bin : flatbuffers.ByteBuffer) : object {

    const id = bin.getBufferIdentifier();
    const cast = binaryIdentifierCasts[id];
    const mod = cast(bin);
    return mod;
}


export function tryGetGuid(obj:any) : string | undefined | null{
    if(typeof obj["guid"] === "function"){
        return obj.guid();
    }
    return null;
}