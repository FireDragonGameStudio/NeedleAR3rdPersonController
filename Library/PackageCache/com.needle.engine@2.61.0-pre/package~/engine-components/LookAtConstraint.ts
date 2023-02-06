import { Behaviour, GameObject } from "./Component";
import * as THREE from "three";
import { serializable } from "../engine/engine_serialization_decorator";
import { Object3D } from "three";

export class LookAtConstraint extends Behaviour {

    constraintActive: boolean = true;
    locked: boolean = false;
    @serializable(Object3D)
    sources: THREE.Object3D[] = [];
}