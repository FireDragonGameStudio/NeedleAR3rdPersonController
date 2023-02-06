// automatically generated by the FlatBuffers compiler, do not modify

import * as flatbuffers from 'flatbuffers';

import { Vec3 } from './vec3';


export class Transform {
  bb: flatbuffers.ByteBuffer|null = null;
  bb_pos = 0;
__init(i:number, bb:flatbuffers.ByteBuffer):Transform {
  this.bb_pos = i;
  this.bb = bb;
  return this;
}

position(obj?:Vec3):Vec3|null {
  return (obj || new Vec3()).__init(this.bb_pos, this.bb!);
}

rotation(obj?:Vec3):Vec3|null {
  return (obj || new Vec3()).__init(this.bb_pos + 12, this.bb!);
}

scale(obj?:Vec3):Vec3|null {
  return (obj || new Vec3()).__init(this.bb_pos + 24, this.bb!);
}

static sizeOf():number {
  return 36;
}

static createTransform(builder:flatbuffers.Builder, position_x: number, position_y: number, position_z: number, rotation_x: number, rotation_y: number, rotation_z: number, scale_x: number, scale_y: number, scale_z: number):flatbuffers.Offset {
  builder.prep(4, 36);
  builder.prep(4, 12);
  builder.writeFloat32(scale_z);
  builder.writeFloat32(scale_y);
  builder.writeFloat32(scale_x);
  builder.prep(4, 12);
  builder.writeFloat32(rotation_z);
  builder.writeFloat32(rotation_y);
  builder.writeFloat32(rotation_x);
  builder.prep(4, 12);
  builder.writeFloat32(position_z);
  builder.writeFloat32(position_y);
  builder.writeFloat32(position_x);
  return builder.offset();
}

}