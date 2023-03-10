


export enum PhysicsMaterialCombine
{
  Average = 0,
  Multiply = 1,
  Minimum = 2,
  Maximum = 3,
}

export type PhysicsMaterial = {
  bounceCombine: PhysicsMaterialCombine;
  bounciness: number;
  frictionCombine: PhysicsMaterialCombine;
  dynamicFriction: number;
  staticFriction: number;
}

export enum CollisionDetectionMode {
  Discrete = 0,
  Continuous = 1,
}

export enum RigidbodyConstraints {
  None = 0,
  FreezePositionX = 2,
  FreezePositionY = 4,
  FreezePositionZ = 8,
  FreezePosition = 14,
  FreezeRotationX = 16,
  FreezeRotationY = 32,
  FreezeRotationZ = 64,
  FreezeRotation = 112,
  FreezeAll = 126,
}


export enum Axes {
  None = 0,
  X = 2,
  Y = 4,
  Z = 8,
  All = ~0,
}