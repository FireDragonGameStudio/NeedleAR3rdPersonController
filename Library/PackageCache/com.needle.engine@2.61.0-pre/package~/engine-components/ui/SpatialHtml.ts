import * as THREE from 'three'
import { HTMLMesh } from 'three/examples/jsm/interactive/HTMLMesh.js';
import { InteractiveGroup } from 'three/examples/jsm/interactive/InteractiveGroup.js';
import { getWorldEuler, getWorldRotation, setWorldRotationXYZ } from '../../engine/engine_three_utils';
import { Behaviour } from '../Component';

export class SpatialHtml extends Behaviour {

    id: string | null = null;
    keepAspect: boolean = false;

    start() {
        if (!this.id || !this.context.mainCamera) return;
        const div = document.getElementById(this.id);
        if (!div) {
            console.warn("Could not find element with id \"" + this.id + "\"");
            return;
        }
        div.style.display = "block";
        div.style.visibility = "hidden";

        const group = new InteractiveGroup(this.context.renderer, this.context.mainCamera!);
        this.gameObject.add(group);

        const mesh = new HTMLMesh(div);
        group.add(mesh);
        mesh.visible = false;

        console.log(mesh);
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.transparent = true;

        // need to wait one frame for it to render to get bounds
        setTimeout(() => {
            mesh.visible = true;
            // align box to get bounding box
            const rot = getWorldRotation(this.gameObject).clone();
            setWorldRotationXYZ(this.gameObject, 0, 0, 0);
            this.gameObject.updateMatrixWorld();
            const aabb = new THREE.Box3();
            aabb.setFromObject(group);
            this.setWorldRotation(rot.x, rot.y, rot.z);
            // apply bounds
            const width = aabb.max.x - aabb.min.x;
            const height = aabb.max.y - aabb.min.y;
            if (this.keepAspect) {
                const aspect = width / height;
                if (width > height) {
                    mesh.scale.set(1 / width, 1 / height / aspect, 1);
                }
                else {
                    mesh.scale.set(1 / width * aspect, 1 / height, 1);
                }
            }
            else {
                mesh.scale.set(1 / width, 1 / height, 1);
            }
            // TODO: replace with world scale once we have that
            const factor = this.gameObject.scale;
            mesh.scale.multiply(factor);
        }, 1);
    }
}
