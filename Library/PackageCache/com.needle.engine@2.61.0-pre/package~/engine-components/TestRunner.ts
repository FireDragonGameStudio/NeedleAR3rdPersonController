import { Behaviour } from "./Component";
import * as tests from "../engine/tests/test_utils";
import { createTransformModel, SyncedTransform, SyncedTransformIdentifier } from "./SyncedTransform";
import * as flatbuffers from 'flatbuffers';
import { SyncedTransformModel } from "../engine-schemes/synced-transform-model";
import { Rigidbody } from "./RigidBody";
import { Vector3 } from "three";
import { IModel } from "../engine/engine_networking_types";

export class TestRunner extends Behaviour {
    awake(): void {
        tests.detect_run_tests();
    }
}

export class TestSimulateUserData extends Behaviour {

    transformsPerFrame: number = 10;
    interval: number = 0;
    useFlatbuffers: boolean = true;

    awake(): void {
        if (this.useFlatbuffers) {
            this.context.connection.beginListenBinrary(SyncedTransformIdentifier, (_mod: SyncedTransformModel) => {
                // console.log("Received transform");
                // const sc = SyncedTransformModel.getRootAsSyncedTransformModel(bin);
                // console.log(mod.guid());
                // console.log("Received transform", sc, sc.transform()?.position()?.x(), sc.fast(), bin.getBufferIdentifier());
            });
        }
        else {
            this.models = [];
            for (let i = 0; i < this.transformsPerFrame; i++) {
                this.models.push(new TransformModel(this.context.connection.connectionId + "_simulatedTransform_" + i, this));
            }
        }
    }

    private builder: flatbuffers.Builder | null = null;
    private models: TransformModel[] | null = null;

    update() {
        if (!this.context.connection.isConnected) return;

        if (this.useFlatbuffers) {
            if (!this.context.connection.connectionId || this.context.time.frameCount % this.interval !== 0) return;
            if (this.builder === null)
                this.builder = new flatbuffers.Builder(1024);
            const builder = this.builder;
            for (let i = 0; i < this.transformsPerFrame; i++) {
                builder.clear();
                const buf = createTransformModel(this.context.connection.connectionId!, this);
                this.context.connection.sendBinary(buf);
            }
        }
        else {
            if (this.models) {
                for (let i = 0; i < this.models.length; i++) {
                    const mod = this.models[i];
                    mod.dontSave = true;
                    mod.update(this, null);
                    this.context.connection.send("TestSimulateUserData-" + i, mod);
                }
            }
        }
    }

}


// use flatbuffer SyncedTransformModel
class TransformModel implements IModel {
    guid: string;
    fast: boolean = false;
    position: { x: number, y: number, z: number };
    rotation: { x: number, y: number, z: number, w: number };
    // scale : { x : number, y : number, z : number } | undefined = undefined;
    velocity: { x: number, y: number, z: number } | undefined = undefined;
    dontSave?: boolean | undefined;

    isValid(): boolean {
        return this.fast !== undefined || this.position !== undefined || this.rotation !== undefined || this.velocity !== undefined;
    }

    constructor(guid: string, obj: Behaviour) {
        this.guid = guid;
        this.position = { x: 0, y: 0, z: 0 };
        this.rotation = { x: 0, y: 0, z: 0, w: 0 };
        this.update(obj, null)
    }
    public static temp: THREE.Vector3 = new Vector3();

    update(beh: Behaviour, rb: Rigidbody | undefined | null) {
        const world = beh.worldPosition;// go.getWorldPosition(TransformModel.temp);
        this.position.x = world.x;
        this.position.y = world.y;
        this.position.z = world.z;

        const rot = beh.worldQuaternion;
        this.rotation.x = rot.x;
        this.rotation.y = rot.y;
        this.rotation.z = rot.z;
        this.rotation.w = rot.w;

        this.fast = false;

        if (rb) {
            const vel = rb.getVelocity();
            if (this.velocity === undefined) this.velocity = { x: 0, y: 0, z: 0 };
            this.velocity.x = vel.x;
            this.velocity.y = vel.y;
            this.velocity.z = vel.z;
        }
    }
}