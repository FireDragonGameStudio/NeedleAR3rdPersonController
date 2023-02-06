export const NEED_UPDATE_INSTANCE_KEY = Symbol("NEEDLE_NEED_UPDATE_INSTANCE");



export class InstancingUtil {
    
    static isUsingInstancing(instance: THREE.Object3D): boolean { return instance["__isUsingInstancing"] === true; }

    // TODO: change this so it does not set matrix world directly but some flag that is only used by instancing
    static markDirty(go: THREE.Object3D | null, recursive: boolean = true) {
        if (!go) return;
        // potential optimization:
        // if(go.matrixWorldNeedsUpdate) return;
        // console.trace(go, GameObject.isUsingInstancing(go));
        if (this.isUsingInstancing(go)) {
            go[NEED_UPDATE_INSTANCE_KEY] = true;
            go.matrixWorldNeedsUpdate = true;
        }
        if (recursive) {
            for (const child of go.children) {
                InstancingUtil.markDirty(child, true);
            }
        }
    }
}