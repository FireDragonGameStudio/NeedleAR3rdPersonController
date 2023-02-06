// automatically generated by the FlatBuffers compiler, do not modify

import * as flatbuffers from 'flatbuffers';

import { Vec3 } from './vec3';


export class SyncedCameraModel {
  bb: flatbuffers.ByteBuffer|null = null;
  bb_pos = 0;
__init(i:number, bb:flatbuffers.ByteBuffer):SyncedCameraModel {
  this.bb_pos = i;
  this.bb = bb;
  return this;
}

static getRootAsSyncedCameraModel(bb:flatbuffers.ByteBuffer, obj?:SyncedCameraModel):SyncedCameraModel {
  return (obj || new SyncedCameraModel()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
}

static getSizePrefixedRootAsSyncedCameraModel(bb:flatbuffers.ByteBuffer, obj?:SyncedCameraModel):SyncedCameraModel {
  bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
  return (obj || new SyncedCameraModel()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
}

userId():string|null
userId(optionalEncoding:flatbuffers.Encoding):string|Uint8Array|null
userId(optionalEncoding?:any):string|Uint8Array|null {
  const offset = this.bb!.__offset(this.bb_pos, 4);
  return offset ? this.bb!.__string(this.bb_pos + offset, optionalEncoding) : null;
}

guid():string|null
guid(optionalEncoding:flatbuffers.Encoding):string|Uint8Array|null
guid(optionalEncoding?:any):string|Uint8Array|null {
  const offset = this.bb!.__offset(this.bb_pos, 6);
  return offset ? this.bb!.__string(this.bb_pos + offset, optionalEncoding) : null;
}

dontSave():boolean {
  const offset = this.bb!.__offset(this.bb_pos, 8);
  return offset ? !!this.bb!.readInt8(this.bb_pos + offset) : false;
}

pos(obj?:Vec3):Vec3|null {
  const offset = this.bb!.__offset(this.bb_pos, 10);
  return offset ? (obj || new Vec3()).__init(this.bb_pos + offset, this.bb!) : null;
}

rot(obj?:Vec3):Vec3|null {
  const offset = this.bb!.__offset(this.bb_pos, 12);
  return offset ? (obj || new Vec3()).__init(this.bb_pos + offset, this.bb!) : null;
}

static startSyncedCameraModel(builder:flatbuffers.Builder) {
  builder.startObject(5);
}

static addUserId(builder:flatbuffers.Builder, userIdOffset:flatbuffers.Offset) {
  builder.addFieldOffset(0, userIdOffset, 0);
}

static addGuid(builder:flatbuffers.Builder, guidOffset:flatbuffers.Offset) {
  builder.addFieldOffset(1, guidOffset, 0);
}

static addDontSave(builder:flatbuffers.Builder, dontSave:boolean) {
  builder.addFieldInt8(2, +dontSave, +false);
}

static addPos(builder:flatbuffers.Builder, posOffset:flatbuffers.Offset) {
  builder.addFieldStruct(3, posOffset, 0);
}

static addRot(builder:flatbuffers.Builder, rotOffset:flatbuffers.Offset) {
  builder.addFieldStruct(4, rotOffset, 0);
}

static endSyncedCameraModel(builder:flatbuffers.Builder):flatbuffers.Offset {
  const offset = builder.endObject();
  return offset;
}

static finishSyncedCameraModelBuffer(builder:flatbuffers.Builder, offset:flatbuffers.Offset) {
  builder.finish(offset);
}

static finishSizePrefixedSyncedCameraModelBuffer(builder:flatbuffers.Builder, offset:flatbuffers.Offset) {
  builder.finish(offset, undefined, true);
}

}