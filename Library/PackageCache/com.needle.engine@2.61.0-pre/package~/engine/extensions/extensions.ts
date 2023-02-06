import { NEEDLE_techniques_webgl } from "./NEEDLE_techniques_webgl";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { NEEDLE_components } from "./NEEDLE_components";
import { EXT_texture_exr } from "./EXT_texture_exr";
import { NEEDLE_gameobject_data } from "./NEEDLE_gameobject_data";
// import { NEEDLE_timeline } from "./NEEDLE_timeline";
// import { NEEDLE_animator_controller } from "./NEEDLE_animator_controller";
import { NEEDLE_persistent_assets } from "./NEEDLE_persistent_assets";
// import { KHR_animation_pointer } from "./KHR_animation_pointer";
import { NEEDLE_lightmaps } from "../extensions/NEEDLE_lightmaps";
import { SourceIdentifier } from "../engine_types";
import { Context } from "../engine_setup";
import { NEEDLE_lighting_settings } from "./NEEDLE_lighting_settings";
import { NEEDLE_render_objects } from "./NEEDLE_render_objects";
import { NEEDLE_progressive } from "./NEEDLE_progressive";

export function registerComponentExtension(loader: GLTFLoader): NEEDLE_components {
    const ext = new NEEDLE_components();
    loader.register(p => {
        ext.parser = p;
        return ext;
    });
    return ext;
}

class PointerResolver {
    resolvePath(path: string) {
        if (path.includes('/extensions/builtin_components/'))
            return path.replace('/extensions/builtin_components/', '/userData/components/');
        if (path.includes('extensions/builtin_components/'))
            return path.replace('extensions/builtin_components/', '/userData/components/');
        return path;
    }
}

export function registerExtensions(loader: GLTFLoader, context: Context, sourceId: SourceIdentifier) {
    loader.register(p => new NEEDLE_gameobject_data(p));
    loader.register(p => new NEEDLE_persistent_assets(p));
    loader.register(p => new NEEDLE_lightmaps(p, context.lightmaps, sourceId));
    loader.register(p => new NEEDLE_lighting_settings(p, sourceId, context));
    loader.register(p => new NEEDLE_techniques_webgl(p, sourceId));
    loader.register(p => new NEEDLE_render_objects(p, sourceId));
    loader.register(p => new NEEDLE_progressive(p, sourceId, context));
    loader.register(p => new EXT_texture_exr(p));

    const setPointerResolverFunction = loader["setAnimationPointerResolver"];
    if (typeof setPointerResolverFunction === "function")
        setPointerResolverFunction.bind(loader)(new PointerResolver());

}