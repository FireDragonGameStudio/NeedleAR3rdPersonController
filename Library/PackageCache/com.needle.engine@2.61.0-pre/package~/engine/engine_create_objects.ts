import { PlaneGeometry, MeshBasicMaterial, DoubleSide, Mesh, Material } from "three"


export enum PrimitiveType {
    Quad = 0
}

export type ObjectOptions = {
    name?: string,
    material?: Material,
}

export class ObjectUtils {

    static createPrimitive(type: PrimitiveType, opts?: ObjectOptions): Mesh {
        let obj: Mesh;
        switch (type) {
            case PrimitiveType.Quad:
                const geometry = new PlaneGeometry(1, 1, 1, 1);
                const material = opts?.material ?? new MeshBasicMaterial({ color: 0xffffff });
                obj = new Mesh(geometry, material);
        }
        if (opts?.name)
            obj.name = opts.name;
        return obj;
    }
} 