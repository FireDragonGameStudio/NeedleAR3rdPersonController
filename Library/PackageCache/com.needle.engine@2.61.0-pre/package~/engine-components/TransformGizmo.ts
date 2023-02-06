import { Behaviour, GameObject } from "./Component";
import { SyncedTransform } from "./SyncedTransform";
import { serializable } from "../engine/engine_serialization_decorator";
import * as params from "../engine/engine_default_parameters";
import { Mesh, MathUtils, EventListener } from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

export class TransformGizmo extends Behaviour {

    @serializable()
    public isGizmo: boolean = true;

    private control?: TransformControls;
    private orbit?: OrbitControls;

    awake() {
        if (this.isGizmo && !params.showGizmos) return;
        if (!this.context.mainCamera) return;
        this.control = new TransformControls(this.context.mainCamera, this.context.renderer.domElement);
        this.control.visible = true;
        this.control.enabled = true;
        this.control.getRaycaster().layers.set(2);

        this.control.size = 0.6;
        this.control.traverse(x => {
            const mesh = x as Mesh;
            mesh.layers.set(2);
            if (mesh) {
                const gizmoMat = mesh.material as THREE.MeshBasicMaterial;
                if (gizmoMat) {
                    gizmoMat.opacity = 0.3;
                }
            }
        });
    }

    start() {
        if (this.context.mainCamera) {
            const orbit = GameObject.getComponentInParent(this.context.mainCamera, OrbitControls) ?? undefined;
            this.orbit = orbit;
        }
    }

    private changeEventListener?: any;
    private windowKeyDownListener?: any;
    private windowKeyUpListener?: any;

    onEnable() {
        if (this.control) {
            this.context.scene.add(this.control);
            this.control.attach(this.gameObject);
        }
        this.changeEventListener = this.onControlChangedEvent.bind(this);
        this.control?.addEventListener('dragging-changed', this.changeEventListener);
        this.attachWindowEvents();
    }

    onDisable() {
        this.control?.removeFromParent();
        if (this.changeEventListener)
            this.control?.removeEventListener('dragging-changed', this.changeEventListener);
    }

    private onControlChangedEvent(event) {
        const orbit = this.orbit;
        if (orbit) orbit.enabled = !event.value;
        if (event.value) {
            // request ownership on drag start
            const sync = GameObject.getComponentInParent(this.gameObject, SyncedTransform);
            if (sync) {
                sync.requestOwnership();
            }
        }
    }

    private attachWindowEvents() {
        const control = this.control;
        if (!control) return;

        if (!this.windowKeyDownListener) {
            this.windowKeyDownListener = (event) => {
                switch (event.keyCode) {

                    case 81: // Q
                        control.setSpace(control.space === 'local' ? 'world' : 'local');
                        break;

                    case 16: // Shift
                        control.setTranslationSnap(100);
                        control.setRotationSnap(MathUtils.degToRad(15));
                        control.setScaleSnap(0.25);
                        break;

                    case 87: // W
                        control.setMode('translate');
                        break;

                    case 69: // E
                        control.setMode('rotate');
                        break;

                    case 82: // R
                        control.setMode('scale');
                        break;

                    /*
                    case 67: // C
                        const position = currentCamera.position.clone();
    
                        currentCamera = currentCamera.isPerspectiveCamera ? cameraOrtho : cameraPersp;
                        currentCamera.position.copy( position );
    
                        orbit.object = currentCamera;
                        control.camera = currentCamera;
    
                        currentCamera.lookAt( orbit.target.x, orbit.target.y, orbit.target.z );
                        onWindowResize();
                        break;
    
                    case 86: // V
                        const randomFoV = Math.random() + 0.1;
                        const randomZoom = Math.random() + 0.1;
    
                        cameraPersp.fov = randomFoV * 160;
                        cameraOrtho.bottom = - randomFoV * 500;
                        cameraOrtho.top = randomFoV * 500;
    
                        cameraPersp.zoom = randomZoom * 5;
                        cameraOrtho.zoom = randomZoom * 5;
                        onWindowResize();
                        break;
                    */
                    case 187:
                    case 107: // +, =, num+
                        control.setSize(control.size + 0.1);
                        break;

                    case 189:
                    case 109: // -, _, num-
                        control.setSize(Math.max(control.size - 0.1, 0.1));
                        break;

                    case 88: // X
                        control.showX = !control.showX;
                        break;

                    case 89: // Y
                        control.showY = !control.showY;
                        break;

                    case 90: // Z
                        control.showZ = !control.showZ;
                        break;

                    case 32: // Spacebar
                        control.enabled = !control.enabled;
                        break;

                }

            };
        }

        if (!this.windowKeyUpListener) {
            this.windowKeyUpListener = (event) => {

                switch (event.keyCode) {

                    case 16: // Shift
                        control.setTranslationSnap(null);
                        control.setRotationSnap(null);
                        control.setScaleSnap(null);
                        break;

                }

            };
        }

        
        window.addEventListener('keydown', this.windowKeyDownListener);
        window.addEventListener('keyup', this.windowKeyUpListener);
    }
}