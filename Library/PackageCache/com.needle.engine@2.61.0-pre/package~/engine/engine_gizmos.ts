import * as THREE from 'three';
import { BufferAttribute, Line, BoxGeometry, EdgesGeometry, Color, LineSegments, LineBasicMaterial, Object3D, Mesh, SphereGeometry, ColorRepresentation, Vector3, Box3, Quaternion, CylinderGeometry } from 'three';
import { Context } from './engine_setup';
import { setWorldPosition, setWorldPositionXYZ } from './engine_three_utils';
import { Vec3, Vec4 } from './engine_types';

const _tmp = new Vector3();
const _tmp2 = new Vector3();
const _quat = new Quaternion();

const defaultColor: ColorRepresentation = 0x888888;

export class Gizmos {

    static DrawRay(origin: Vec3, dir: Vec3, color: ColorRepresentation = defaultColor, duration: number = 0, depthTest: boolean = true) {
        const obj = Internal.getLine(duration);
        const positions = obj.geometry.getAttribute("position");
        positions.setXYZ(0, origin.x, origin.y, origin.z);
        _tmp.set(dir.x, dir.y, dir.z).multiplyScalar(999999999);
        positions.setXYZ(1, origin.x + _tmp.x, origin.y + _tmp.y, origin.z + _tmp.z);
        positions.needsUpdate = true;
        obj.material["color"].set(color);
        obj.material["depthTest"] = depthTest;
    }

    static DrawDirection(pt: Vec3, direction: Vec3 | Vec4, color: ColorRepresentation = defaultColor, duration: number = 0, depthTest: boolean = true, lengthFactor: number = 1) {
        const obj = Internal.getLine(duration);
        const positions = obj.geometry.getAttribute("position");
        positions.setXYZ(0, pt.x, pt.y, pt.z);
        if (direction["w"] !== undefined) {
            _tmp.set(0, 0, -lengthFactor);
            _quat.set(direction["x"], direction["y"], direction["z"], direction["w"]);
            _tmp.applyQuaternion(_quat);
        }
        else {
            _tmp.set(direction.x, direction.y, direction.z);
            _tmp.multiplyScalar(lengthFactor);
        }
        positions.setXYZ(1, pt.x + _tmp.x, pt.y + _tmp.y, pt.z + _tmp.z);
        positions.needsUpdate = true;
        obj.material["color"].set(color);
        obj.material["depthTest"] = depthTest;

    }

    static DrawLine(pt0: Vec3, pt1: Vec3, color: ColorRepresentation = defaultColor, duration: number = 0, depthTest: boolean = true) {
        const obj = Internal.getLine(duration);

        const positions = obj.geometry.getAttribute("position");
        positions.setXYZ(0, pt0.x, pt0.y, pt0.z);
        positions.setXYZ(1, pt1.x, pt1.y, pt1.z);
        positions.needsUpdate = true;
        obj.material["color"].set(color);
        obj.material["depthTest"] = depthTest;
    }

    static DrawWireSphere(center: Vec3, radius: number, color: ColorRepresentation = defaultColor, duration: number = 0, depthTest: boolean = true) {
        const obj = Internal.getSphere(radius, duration, true);
        setWorldPositionXYZ(obj, center.x, center.y, center.z);
        obj.material["color"].set(color);
        obj.material["depthTest"] = depthTest;
    }

    static DrawSphere(center: Vec3, radius: number, color: ColorRepresentation = defaultColor, duration: number = 0, depthTest: boolean = true) {
        const obj = Internal.getSphere(radius, duration, false);
        setWorldPositionXYZ(obj, center.x, center.y, center.z);
        obj.material["color"].set(color);
        obj.material["depthTest"] = depthTest;
    }

    static DrawBox(center: Vec3, size: Vec3, color: ColorRepresentation = defaultColor, duration: number = 0, depthTest: boolean = true) {
        const obj = Internal.getBox(duration);
        obj.position.set(center.x, center.y, center.z);
        obj.scale.set(size.x, size.y, size.z);
        obj.material["color"].set(color);
        obj.material["depthTest"] = depthTest;
        obj.material["wireframe"] = true;
    }

    static DrawBox3(box: Box3, color: ColorRepresentation = defaultColor, duration: number = 0, depthTest: boolean = true) {
        const obj = Internal.getBox(duration);
        obj.position.copy(box.getCenter(_tmp));
        obj.scale.copy(box.getSize(_tmp));
        obj.material["color"].set(color);
        obj.material["depthTest"] = depthTest;
        obj.material["wireframe"] = true;
    }

    private static _up = new Vector3(0, 1, 0);
    static DrawArrow(pt0: Vec3, pt1: Vec3, color: ColorRepresentation = defaultColor, duration: number = 0, depthTest: boolean = true, wireframe: boolean = false) {
        const obj = Internal.getArrowHead(duration);
        obj.position.set(pt1.x, pt1.y, pt1.z);
        obj.quaternion.setFromUnitVectors(this._up.set(0, 1, 0), _tmp.set(pt1.x, pt1.y, pt1.z).sub(_tmp2.set(pt0.x, pt0.y, pt0.z)).normalize());
        const dist = _tmp.set(pt1.x, pt1.y, pt1.z).sub(_tmp2.set(pt0.x, pt0.y, pt0.z)).length();
        const scale = dist * 0.1;
        obj.scale.set(scale, scale, scale);
        obj.material["color"].set(color);
        obj.material["depthTest"] = depthTest;
        obj.material["wireframe"] = wireframe;
        this.DrawLine(pt0, pt1, color, duration, depthTest);
    }
}

const box: BoxGeometry = new BoxGeometry(1, 1, 1);
export function CreateWireCube(col: THREE.ColorRepresentation | null = null): THREE.LineSegments {
    const color = new Color(col ?? 0xdddddd);
    // const material = new THREE.MeshBasicMaterial();
    // material.color = new THREE.Color(col ?? 0xdddddd);
    // material.wireframe = true;
    // const box = new THREE.Mesh(box, material);
    // box.name = "BOX_GIZMO";
    const edges = new EdgesGeometry(box);
    const line = new LineSegments(edges, new LineBasicMaterial({ color: color }));
    return line;
}



const $cacheSymbol = Symbol("GizmoCache");
class Internal {
    // private static createdLines: number = 0;

    static getBox(duration: number): Mesh {
        let box = this.boxesCache.pop();
        if (!box) {
            const geo: BoxGeometry = new BoxGeometry(1, 1, 1);
            box = new Mesh(geo);
        }
        this.registerTimedObject(Context.Current, box, duration, this.boxesCache);
        return box;
    }

    static getLine(duration: number): Line {
        let line = this.linesCache.pop();
        if (!line) {
            line = new Line();
            let positions = line.geometry.getAttribute("position");
            if (!positions) {
                positions = new BufferAttribute(new Float32Array(2 * 3), 3);
                line.geometry.setAttribute("position", positions);
            }
        }
        this.registerTimedObject(Context.Current, line, duration, this.linesCache);
        return line;
    }

    static getSphere(radius: number, duration: number, wireframe: boolean): Mesh {

        let sphere = this.spheresCache.pop();
        if (!sphere) {
            sphere = new Mesh(new SphereGeometry(.5, 8, 8));
        }
        sphere.scale.set(radius, radius, radius);
        sphere.material["wireframe"] = wireframe;
        this.registerTimedObject(Context.Current, sphere, duration, this.spheresCache);
        return sphere;
    }

    static getArrowHead(duration: number): Mesh {
        let arrowHead = this.arrowHeadsCache.pop();
        if (!arrowHead) {
            arrowHead = new Mesh(new CylinderGeometry(0, .5, 1, 8));
        }
        this.registerTimedObject(Context.Current, arrowHead, duration, this.arrowHeadsCache);
        return arrowHead;
    }

    private static linesCache: Array<Line> = [];
    private static spheresCache: Mesh[] = [];
    private static boxesCache: Mesh[] = [];
    private static arrowHeadsCache: Mesh[] = [];

    private static registerTimedObject(context: Context, object: Object3D, duration: number, cache: Array<Object3D>) {
        if (!this.contextPostRenderCallbacks.get(context)) {
            const cb = () => { this.onPostRender(context, this.timedObjectsBuffer, this.timesBuffer) };
            this.contextPostRenderCallbacks.set(context, cb);
            context.post_render_callbacks.push(cb);
        }
        object[$cacheSymbol] = cache;
        this.timedObjectsBuffer.push(object);
        this.timesBuffer.push(Context.Current.time.time + duration);
        context.scene.add(object);
    }


    private static timedObjectsBuffer = new Array<Object3D>();
    private static timesBuffer = new Array<number>();
    private static contextPostRenderCallbacks = new Map<Context, () => void>();

    private static onPostRender(ctx: Context, objects: Array<Object3D>, times: Array<number>) {
        const time = ctx.time.time;
        for (let i = 0; i < objects.length; i++) {
            if (time > times[i]) {
                const obj = objects[i];
                const cache = obj[$cacheSymbol];
                cache.push(obj as Line);
                ctx.scene.remove(obj);
                objects.splice(i, 1);
                times.splice(i, 1);
            }
        }
    }

}