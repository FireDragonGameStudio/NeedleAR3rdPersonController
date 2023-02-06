import { Context } from "./engine_setup";
import { PerspectiveCamera, Camera } from "three";

declare type ImageMimeType = "image/webp" | "image/png";

export function screenshot(context: Context, width: number, height: number, mimeType: ImageMimeType = "image/webp", camera?: Camera | null) {

    if (!camera) {
        camera = context.mainCamera;
        if (!camera) {
            console.error("No camera found");
            return null;
        }
    }
    const prevWidth = context.renderer.domElement.width;
    const prevHeight = context.renderer.domElement.height;

    try {
        const canvas = context.renderer.domElement;

        // set the desired output size
        context.renderer.setSize(width, height);
        // update the camera apsect and matrix
        if (camera instanceof PerspectiveCamera)
            context.updateAspect(camera, width, height);

        // render now
        context.renderNow();

        // const webPMimeType = "image/webp";
        // const pngMimeType = "image/png";
        const dataUrl = canvas.toDataURL(mimeType);
        return dataUrl;
    }
    finally {
        context.renderer.setSize(prevWidth, prevHeight);
        context.updateSize();
    }

    return null;
}