
import { SourceIdentifier } from "../engine_types";
import { GLTF, GLTFLoaderPlugin, GLTFParser } from "three/examples/jsm/loaders/GLTFLoader";
import { IComponent as Component, IRenderer } from "../engine_types";

import {
    // stencil funcs
    NeverStencilFunc,
    LessStencilFunc,
    EqualStencilFunc,
    LessEqualStencilFunc,
    GreaterStencilFunc,
    NotEqualStencilFunc,
    GreaterEqualStencilFunc,
    AlwaysStencilFunc,
    // stencil ops
    ZeroStencilOp,
    KeepStencilOp,
    ReplaceStencilOp,
    IncrementStencilOp,
    DecrementStencilOp,
    IncrementWrapStencilOp,
    DecrementWrapStencilOp,
    InvertStencilOp,
} from "three";
import { getParam } from "../engine_utils";

const debug = getParam("debugstencil");

function matchesLayer(stencilLayer: number, comp: Component): boolean {
    return (stencilLayer & 1 << comp.layer) != 0;
}


declare type StencilSettingsModel = {
    name: string;
    event: number;
    index: number;
    queue: number;
    layer: number;
    value: number;
    compareFunc: number;
    passOp: number;
    failOp: number;
    zFailOp: number;
}

const $stencils = Symbol("stencils");

export class NEEDLE_render_objects implements GLTFLoaderPlugin {

    private static stencils: { [key: string]: StencilSettingsModel[] } = {};

    static applyStencil(obj?: IRenderer | null) {
        if (!obj) return;
        const source = obj.sourceId;
        if (debug) console.log(source, NEEDLE_render_objects.stencils);
        if (!source) return;
        const settings = NEEDLE_render_objects.stencils[source];
        if (!settings) return;
        for (let i = settings.length - 1; i >= 0; i--) {
            const stencil: StencilSettingsModel = settings[i];
            if (matchesLayer(stencil.layer, obj)) {
                if (debug) console.log(stencil);
                for (let i = 0; i < obj.sharedMaterials.length; i++) {
                    let mat = obj.sharedMaterials[i];
                    if (mat) {
                        // if (!mat[$stencils]) 
                        mat = mat.clone();
                        mat[$stencils] = true;
                        mat.stencilWrite = true;
                        mat.stencilWriteMask = 255;
                        mat.stencilFuncMask = 255;
                        mat.stencilRef = stencil.value;
                        mat.stencilFunc = stencil.compareFunc;
                        mat.stencilZPass = stencil.passOp;
                        mat.stencilFail = stencil.failOp;
                        mat.stencilZFail = stencil.zFailOp;
                        obj.sharedMaterials[i] = mat;
                    }
                }
                // you can have 50 renderer features per event until this breaks
                obj.gameObject.renderOrder = stencil.event * 1000 + stencil.index * 50;
                break;
            }
        }
    }


    private parser: GLTFParser;
    private source: SourceIdentifier;

    constructor(parser: GLTFParser, source: SourceIdentifier) {
        this.parser = parser;
        this.source = source;
    }

    afterRoot(_result: GLTF): Promise<void> | null {

        const extensions = this.parser.json.extensions;
        if (extensions) {
            const ext = extensions[EXTENSION_NAME];
            if (ext) {
                if (debug)
                    console.log(ext);
                const stencils = ext.stencil;
                if (stencils && Array.isArray(stencils)) {
                    for (const stencil of stencils) {
                        const obj: StencilSettingsModel = { ...stencil };
                        obj.compareFunc = ToThreeCompareFunction(obj.compareFunc);
                        obj.passOp = ToThreeStencilOp(obj.passOp);
                        obj.failOp = ToThreeStencilOp(obj.failOp);
                        obj.zFailOp = ToThreeStencilOp(obj.zFailOp);

                        if (!NEEDLE_render_objects.stencils[this.source])
                            NEEDLE_render_objects.stencils[this.source] = [];
                        NEEDLE_render_objects.stencils[this.source].push(obj);
                    }
                }
            }
        }

        return null;
    }

}





enum StencilOp {
    Keep = 0,
    Zero = 1,
    Replace = 2,
    IncrementSaturate = 3,
    DecrementSaturate = 4,
    Invert = 5,
    IncrementWrap = 6,
    DecrementWrap = 7,
}

enum CompareFunction {
    Disabled,
    Never,
    Less,
    Equal,
    LessEqual,
    Greater,
    NotEqual,
    GreaterEqual,
    Always,
}

function ToThreeStencilOp(op: StencilOp): number {
    switch (op) {
        case StencilOp.Keep:
            return KeepStencilOp;
        case StencilOp.Zero:
            return ZeroStencilOp;
        case StencilOp.Replace:
            return ReplaceStencilOp;
        case StencilOp.IncrementSaturate:
            return IncrementStencilOp;
        case StencilOp.DecrementSaturate:
            return DecrementStencilOp;
        case StencilOp.IncrementWrap:
            return IncrementWrapStencilOp;
        case StencilOp.DecrementWrap:
            return DecrementWrapStencilOp;
        case StencilOp.Invert:
            return InvertStencilOp;
    }
    return 0;
}

function ToThreeCompareFunction(func: CompareFunction): number {
    switch (func) {
        case CompareFunction.Never:
            return NeverStencilFunc;
        case CompareFunction.Less:
            return LessStencilFunc;
        case CompareFunction.Equal:
            return EqualStencilFunc;
        case CompareFunction.LessEqual:
            return LessEqualStencilFunc;
        case CompareFunction.Greater:
            return GreaterStencilFunc;
        case CompareFunction.NotEqual:
            return NotEqualStencilFunc;
        case CompareFunction.GreaterEqual:
            return GreaterEqualStencilFunc;
        case CompareFunction.Always:
            return AlwaysStencilFunc;
    }
    return 0;
}


export const EXTENSION_NAME = "NEEDLE_render_objects";

