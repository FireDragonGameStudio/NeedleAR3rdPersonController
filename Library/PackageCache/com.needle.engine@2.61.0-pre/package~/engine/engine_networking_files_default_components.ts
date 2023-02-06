// import { SyncedTransform } from "../engine-components/SyncedTransform";
// import { DragControls } from "../engine-components/DragControls"
// import { ObjectRaycaster } from "../engine-components/ui/Raycaster";
import { UIDProvider } from "./engine_types";
import { GLTF } from "three/examples/jsm/loaders/GLTFLoader";
// import { Animation } from "../engine-components/Animation";


export function onDynamicObjectAdded(_obj: THREE.Object3D, _idProv: UIDProvider, _gltf?: GLTF) {

    console.warn("Adding components on object has been temporarily disabled");
    
    // // this ensures we have a drag component
    // let drag = getComponentInChildren(obj as GameObject, DragControls);
    // if (!drag) {
    //     drag = GameObject.addNewComponent(obj as GameObject, DragControls, false);
    //     drag.guid = idProv.generateUUID();
    // }

    // // if a drag component is found we add a syncedTransform if none exists
    // if (drag && !GameObject.getComponent(drag.gameObject, SyncedTransform)) {
    //     const st = GameObject.addNewComponent(drag.gameObject, SyncedTransform, false);
    //     st.guid = idProv.generateUUID();
    //     // st.autoOwnership = true;

    //     //drag.transformGroup = true;
    //     //drag.targets = [obj];
    // }

    // // if a drag component is found we add a syncedTransform if none exists
    // if (drag && !GameObject.getComponentInParent(drag.gameObject, ObjectRaycaster)) {
    //     const st = GameObject.addNewComponent(drag.gameObject, ObjectRaycaster, false);
    //     st.guid = idProv.generateUUID();
    // }

    // if (gltf) {
    //     if (gltf.animations?.length > 0) {
    //         const firstAnimation = gltf.animations[0];
    //         const anim = GameObject.addNewComponent(obj, Animation, false);
    //         anim.animations = [firstAnimation];
    //     }
    // }

    // let didDisablFrustumCulling = false;
    // obj.traverse(o => {
    //     if (!o) return;

    //     if (o["isSkinnedMesh"] === true) {
    //         if (!didDisablFrustumCulling) console.log("Disabling frustum culling for skinned meshes", gltf);
    //         didDisablFrustumCulling = true;
    //         o.frustumCulled = false;
    //     }

    // });
}