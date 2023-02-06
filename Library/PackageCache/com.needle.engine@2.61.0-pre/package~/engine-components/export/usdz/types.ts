import { Object3D, Matrix4, Material, BufferGeometry } from "three";

// keep in sync with USDZExporter.js

/** implementation is in three */
export declare class USDZDocument {
    name: string;
    get isDocumentRoot(): boolean;
    add(obj: USDZObject);
    remove(obj: USDZObject);
    traverse(callback: (obj: USDZObject) => void);
    findById(uuid: string): USDZObject | undefined;
    get isDynamic(): boolean;
}



/** implementation is in three */
export declare class USDZObject {
    static createEmptyParent(parent: USDZObject);
    uuid: string;
    name: string;
    matrix: Matrix4;
    material: Material;
    geometry: BufferGeometry;
    parent: USDZObject | USDZDocument | null;
    children: USDZObject[];
    _eventListeners: { [event: string]: Function[] };
    isDynamic: boolean;

    is(obj: Object3D): boolean;
    isEmpty(): boolean;
    clone();
    getPath();
    add(child: USDZObject);
    remove(child: USDZObject);
    addEventListener(evt: string, listener: Function);
    removeEventListener(evt: string, listener: Function);
}
