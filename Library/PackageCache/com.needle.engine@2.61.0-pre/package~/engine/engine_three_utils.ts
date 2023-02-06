import * as THREE from "three";
import { Mathf } from "./engine_math"
import { WebGLRenderer, Vector3, Quaternion, Uniform, Texture, Material, ShaderMaterial, CanvasTexture, AnimationAction, Camera, PerspectiveCamera } from "three";
import { CircularBuffer } from "./engine_utils";


export function slerp(vec: Vector3, end: Vector3, t: number) {
    const len1 = vec.length();
    const len2 = end.length();
    const targetLen = Mathf.lerp(len1, len2, t);
    return vec.lerp(end, t).normalize().multiplyScalar(targetLen);
}

const flipYQuat: Quaternion = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI);
export function lookAtInverse(obj: THREE.Object3D, target: Vector3) {

    obj.lookAt(target);
    obj.quaternion.multiply(flipYQuat);
}


const _worldPositions = new CircularBuffer(() => new THREE.Vector3(), 100);

export function getWorldPosition(obj: THREE.Object3D, vec: THREE.Vector3 | null = null, updateParents: boolean = true): THREE.Vector3 {
    const wp = vec ?? _worldPositions.get();
    if (!obj) return wp.set(0, 0, 0);
    if (!obj.parent) return wp.copy(obj.position);
    if (updateParents)
        obj.updateWorldMatrix(true, false);
    if (obj.matrixWorldNeedsUpdate)
        obj.updateMatrixWorld();
    wp.setFromMatrixPosition(obj.matrixWorld);
    return wp;
}

export function setWorldPosition(obj: THREE.Object3D, val: THREE.Vector3) {
    if (!obj) return;
    const wp = _worldPositions.get();
    if (val !== wp)
        wp.copy(val);
    const obj2 = obj?.parent ?? obj;
    obj2.worldToLocal(wp);
    obj.position.set(wp.x, wp.y, wp.z);
}

export function setWorldPositionXYZ(obj: THREE.Object3D, x: number, y: number, z: number) {
    const wp = _worldPositions.get();
    wp.set(x, y, z);
    setWorldPosition(obj, wp);
}


const _worldQuaternionBuffer: THREE.Quaternion = new THREE.Quaternion();
const _worldQuaternion: THREE.Quaternion = new THREE.Quaternion();
const _tempQuaternionBuffer2: THREE.Quaternion = new THREE.Quaternion();

export function getWorldQuaternion(obj: THREE.Object3D, target: THREE.Quaternion | null = null): THREE.Quaternion {
    if (!obj) return _worldQuaternion.set(0, 0, 0, 1);
    const quat = target ?? _worldQuaternion;
    if (!obj.parent) return quat.copy(obj.quaternion);
    obj.getWorldQuaternion(quat);
    return quat;
}
export function setWorldQuaternion(obj: THREE.Object3D, val: THREE.Quaternion) {
    if (!obj) return;
    if (val !== _worldQuaternionBuffer)
        _worldQuaternionBuffer.copy(val);
    const tempVec = _worldQuaternionBuffer;
    const parent = obj?.parent;
    parent?.getWorldQuaternion(_tempQuaternionBuffer2);
    _tempQuaternionBuffer2.invert();
    const q = _tempQuaternionBuffer2.multiply(tempVec);
    // console.log(tempVec);
    obj.quaternion.set(q.x, q.y, q.z, q.w);
    // console.error("quaternion world to local is not yet implemented");
}
export function setWorldQuaternionXYZW(obj: THREE.Object3D, x: number, y: number, z: number, w: number) {
    _worldQuaternionBuffer.set(x, y, z, w);
    setWorldQuaternion(obj, _worldQuaternionBuffer);
}

const _worldScale: THREE.Vector3 = new THREE.Vector3();
const _worldScale2: THREE.Vector3 = new THREE.Vector3();

export function getWorldScale(obj: THREE.Object3D, vec: THREE.Vector3 | null = null): THREE.Vector3 {
    if (!obj) return _worldScale.set(0, 0, 0);
    if (!obj.parent) return _worldScale.copy(obj.scale);
    obj.getWorldScale(vec ?? _worldScale);
    return vec ?? _worldScale;
}

export function setWorldScale(obj: THREE.Object3D, vec: THREE.Vector3) {
    if (!obj) return;
    if (!obj.parent) {
        obj.scale.copy(vec);
        return;
    }
    const tempVec = _worldScale2;
    const obj2 = obj.parent;
    obj2.getWorldScale(tempVec);
    tempVec.divide(vec);
    obj.scale.copy(tempVec);
}

const _forward = new THREE.Vector3();
const _forwardQuat = new THREE.Quaternion();
export function forward(obj: THREE.Object3D): THREE.Vector3 {
    getWorldQuaternion(obj, _forwardQuat);
    return _forward.set(0, 0, 1).applyQuaternion(_forwardQuat);
}



const _worldEulerBuffer: THREE.Euler = new THREE.Euler();
const _worldEuler: THREE.Euler = new THREE.Euler();
const _worldRotation: THREE.Vector3 = new THREE.Vector3();



// world euler (in radians)
export function getWorldEuler(obj: THREE.Object3D): THREE.Euler {
    obj.getWorldQuaternion(_worldQuaternion);
    _worldEuler.setFromQuaternion(_worldQuaternion);
    return _worldEuler;
}

// world euler (in radians)
export function setWorldEuler(obj: THREE.Object3D, val: THREE.Euler) {
    setWorldQuaternion(obj, _worldQuaternion.setFromEuler(val));;
}

// returns rotation in degrees
export function getWorldRotation(obj: THREE.Object3D): THREE.Vector3 {
    const rot = getWorldEuler(obj);
    const wr = _worldRotation;
    wr.set(rot.x, rot.y, rot.z);
    wr.x = Mathf.toDegrees(wr.x);
    wr.y = Mathf.toDegrees(wr.y);
    wr.z = Mathf.toDegrees(wr.z);
    return wr;
}

export function setWorldRotation(obj: THREE.Object3D, val: THREE.Vector3) {
    setWorldRotationXYZ(obj, val.x, val.y, val.z, true);
}

export function setWorldRotationXYZ(obj: THREE.Object3D, x: number, y: number, z: number, degrees: boolean = true) {
    if (degrees) {
        x = Mathf.toRadians(x);
        y = Mathf.toRadians(y);
        z = Mathf.toRadians(z);
    }
    _worldEulerBuffer.set(x, y, z);
    _worldQuaternionBuffer.setFromEuler(_worldEulerBuffer);
    setWorldQuaternion(obj, _worldQuaternionBuffer);
}





// from https://github.com/mrdoob/three.js/pull/10995#issuecomment-287614722
export function logHierarchy(root: THREE.Object3D | null | undefined, collapsible: boolean = true) {
    if (!root) return;
    if (collapsible) {
        (function printGraph(obj: THREE.Object3D) {
            console.groupCollapsed((obj.name ? obj.name : '(no name : ' + obj.type + ')') + ' %o', obj);
            obj.children.forEach(printGraph);
            console.groupEnd();
        }(root));

    } else {
        root.traverse(function (obj: THREE.Object3D) {
            var s = '|___';
            var obj2 = obj;
            while (obj2.parent !== null) {
                s = '\t' + s;
                obj2 = obj2.parent;
            }
            console.log(s + obj.name + ' <' + obj.type + '>');
        });
    };
}


export function isAnimationAction(obj: object) {
    if (obj) {
        // this doesnt work :(
        // return obj instanceof AnimationAction;
        // instead we do this:
        const act = obj as AnimationAction;
        return act.blendMode !== undefined && act.clampWhenFinished !== undefined && act.enabled !== undefined && act.fadeIn !== undefined && act.getClip !== undefined;
    }
    return false;
}




export class Graphics {
    private static planeGeometry = new THREE.PlaneGeometry(2, 2, 1, 1);
    private static renderer = new WebGLRenderer({ antialias: false });
    private static perspectiveCam = new THREE.PerspectiveCamera();
    private static scene = new THREE.Scene();
    private static readonly vertex = `
    varying vec2 vUv;
    void main(){
        vUv = uv;
        gl_Position = vec4(position.xy * 1.0,0.,.999999);
    }`;
    private static readonly fragment = `
    uniform sampler2D map; 
    varying vec2 vUv;
    void main(){ 
        vec2 uv = vUv;
        uv.y = 1.0 - uv.y;
        gl_FragColor = texture2D( map, uv);
        // gl_FragColor = vec4(uv.xy, 0, 1);
    }`;
    private static readonly blipMaterial = new ShaderMaterial({
        uniforms: { map: new Uniform(null) },
        vertexShader: this.vertex,
        fragmentShader: this.fragment
    });

    static createBlitMaterial(fragment: string): ShaderMaterial {
        return new ShaderMaterial({
            uniforms: { map: new Uniform(null) },
            vertexShader: this.vertex,
            fragmentShader: fragment
        });
    }
    private static readonly mesh = new THREE.Mesh(this.planeGeometry, this.blipMaterial);

    static copyTexture(texture: Texture, blitMaterial?: ShaderMaterial) {
        const material = blitMaterial ?? this.blipMaterial;
        material.uniforms.map.value = texture;
        material.needsUpdate = true;
        material.uniformsNeedUpdate = true;
        const mesh = this.mesh;
        mesh.material = material;
        mesh.frustumCulled = false;
        this.scene.children.length = 0;
        this.scene.add(mesh);
        this.renderer.setSize(texture.image.width, texture.image.height);
        this.renderer.clear();
        this.renderer.render(this.scene, this.perspectiveCam);
        const tex = new Texture(this.renderer.domElement);
        tex.name = "Copy";
        tex.needsUpdate = true; // < important!
        return tex;
    }

    // static blit(src: Texture, target: Texture, blitMaterial?: ShaderMaterial) {
    //     let material = blitMaterial ?? this.blipMaterial;
    //     material.uniforms.map.value = src;
    //     this.mesh.material = material;
    //     this.mesh.frustumCulled = false;
    //     this.mesh.matrix.identity();
    //     this.scene.children.length = 0;
    //     this.scene.add(this.mesh);
    //     this.renderer.setSize(src.image.width, src.image.height);
    //     this.renderer.clear();
    //     this.renderer.render(this.scene, this.perspectiveCam);
    //     return new Texture(this.renderer.domElement);
    // }

    static textureToCanvas(texture: Texture, force: boolean) {
        if (!texture) return null;

        if (force === true || texture["isCompressedTexture"] === true) {
            texture = copyTexture(texture);
        }
        const image = texture.image;
        if (isImageBitmap(image)) {

            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;

            const context = canvas.getContext('2d');
            if (!context) {
                console.error("Failed getting canvas 2d context");
                return null;
            }
            context.drawImage(image, 0, 0, image.width, image.height, 0, 0, canvas.width, canvas.height);
            return canvas;

        }
        return null;
    }
}

/**@obsolete use Graphics.copyTexture */
export function copyTexture(texture: THREE.Texture): THREE.Texture {
    return Graphics.copyTexture(texture);
}

/**@obsolete use Graphics.textureToCanvas */
export function textureToCanvas(texture: THREE.Texture, force: boolean = false): HTMLCanvasElement | null {
    return Graphics.textureToCanvas(texture, force);
}

declare class OffscreenCanvas { };

function isImageBitmap(image) {
    return (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement) ||
        (typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement) ||
        (typeof OffscreenCanvas !== 'undefined' && image instanceof OffscreenCanvas) ||
        (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap);
}
