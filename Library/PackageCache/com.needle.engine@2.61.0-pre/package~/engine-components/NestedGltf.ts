import { getParam } from "../engine/engine_utils";
import { Behaviour } from "../engine-components/Component";
import { AssetReference, ProgressCallback } from "../engine/engine_addressables";
import { serializable } from "../engine/engine_serialization_decorator";
import { InstantiateIdProvider } from "../engine/engine_networking_instantiate";
import { InstantiateOptions } from "../engine/engine_gameobject";

const debug = getParam("debugnestedgltf");

export class NestedGltf extends Behaviour {
    @serializable(AssetReference)
    filePath?: AssetReference;

    private _isLoadingOrDoneLoading: boolean = false;

    listenToProgress(evt: ProgressCallback) {
        this.filePath?.beginListenDownload(evt)
    }

    preload() {
        this.filePath?.preload();
    }

    async start() {
        if (this._isLoadingOrDoneLoading) return;
        if (debug) console.log(this, this.guid);

        const parent = this.gameObject.parent;
        if (parent) {
            this._isLoadingOrDoneLoading = true;
            const opts = new InstantiateOptions();
            // we need to provide stable guids for creating nested gltfs
            opts.idProvider = new InstantiateIdProvider(this.hash(this.guid));
            opts.parent = parent;
            this.gameObject.updateMatrix();
            const matrix = this.gameObject.matrix;
            if (debug) console.log("Load nested:", this.filePath?.uri ?? this.filePath, this.gameObject.position)
            const res = await this.filePath?.instantiate?.call(this.filePath, opts);
            if (res) {
                res.matrixAutoUpdate = false;
                res.matrix.identity();
                res.applyMatrix4(matrix);
                res.matrixAutoUpdate = true;
                res.layers.disableAll();
                res.layers.set(this.layer);
            }
            this.destroy();
            if (debug) console.log("Nested loading done:", this.filePath?.uri ?? this.filePath, res);
        }
    }

    hash(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return hash;
    }
}