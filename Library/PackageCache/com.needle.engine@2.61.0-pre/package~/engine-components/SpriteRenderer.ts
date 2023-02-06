import { Behaviour } from "./Component";
import * as THREE from "three";
import { serializable, serializeable } from "../engine/engine_serialization_decorator";
import { Color, Material, NearestFilter, Texture, Vector2, TextureFilter } from "three";
import { RGBAColor } from "./js-extensions/RGBAColor";
import { getParam } from "../engine/engine_utils";

const debug = getParam("debugspriterenderer")

class SpriteUtils {

    static cache: { [key: string]: THREE.BufferGeometry } = {};

    static getOrCreateGeometry(sprite: Sprite): THREE.BufferGeometry {
        if (sprite._geometry) return sprite._geometry;
        if (sprite.guid) {
            if (SpriteUtils.cache[sprite.guid]) {
                if (debug) console.log("Take cached geometry for sprite", sprite.guid);
                return SpriteUtils.cache[sprite.guid];
            }
        }
        const geo = new THREE.BufferGeometry();
        sprite._geometry = geo;
        const vertices = new Float32Array(sprite.triangles.length * 3);
        const uvs = new Float32Array(sprite.triangles.length * 2);
        for (let i = 0; i < sprite.triangles.length; i += 1) {
            const index = sprite.triangles[i];

            vertices[i * 3] = -sprite.vertices[index].x;
            vertices[i * 3 + 1] = sprite.vertices[index].y;

            vertices[i * 3 + 2] = 0;
            const uv = sprite.uv[index];
            uvs[i * 2] = uv.x;
            uvs[i * 2 + 1] = 1 - uv.y;
        }
        geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
        geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
        if (sprite.guid)
            this.cache[sprite.guid] = geo;
        if (debug)
            console.log("Built sprite geometry", sprite, geo);
        return geo;
    }
}

/// <summary>
///   <para>SpriteRenderer draw mode.</para>
/// </summary>
export enum SpriteDrawMode {
    /// <summary>
    ///   <para>Displays the full sprite.</para>
    /// </summary>
    Simple = 0,
    /// <summary>
    ///   <para>The SpriteRenderer will render the sprite as a 9-slice image where the corners will remain constant and the other sections will scale.</para>
    /// </summary>
    Sliced = 1,
    /// <summary>
    ///   <para>The SpriteRenderer will render the sprite as a 9-slice image where the corners will remain constant and the other sections will tile.</para>
    /// </summary>
    Tiled = 2,
}

class Vec2 {
    x!: number;
    y!: number;
}

export class Sprite {

    @serializable()
    guid?: string;
    @serializable(Texture)
    texture?: THREE.Texture;
    @serializeable()
    triangles!: Array<number>;
    @serializeable()
    uv!: Array<Vec2>;
    @serializeable()
    vertices!: Array<Vec2>;

    _geometry?: THREE.BufferGeometry;
}


class Slice {
    @serializable()
    name!: string;
    @serializable(Vector2)
    offset!: Vector2;
    @serializable(Vector2)
    size!: Vector2;
}

const $spriteTexOwner = Symbol("spriteOwner");

export class SpriteSheet {

    @serializable(Sprite)
    sprite?: Sprite;
    @serializable()
    index: number = 0;
    @serializable(Slice)
    slices!: Slice[];

    update() {
        const index = this.index;
        if (index < 0 || index >= this.slices.length)
            return;
        const slice = this.slices[index];
        let tex = this.sprite?.texture;
        if (!tex) return;
        tex.encoding = THREE.sRGBEncoding;
        tex.offset.set(slice.offset.x, slice.offset.y);
        // aniso > 1 makes the texture blurry
        if (tex.minFilter == NearestFilter && tex.magFilter == NearestFilter)
            tex.anisotropy = 1;
        // tex.repeat.set(slice.size.x, -slice.size.y);
        tex.needsUpdate = true;
    }
}


export class SpriteRenderer extends Behaviour {

    @serializable()
    drawMode: SpriteDrawMode = SpriteDrawMode.Simple;

    size: Vec2 = { x: 1, y: 1 };

    @serializable(RGBAColor)
    color?: RGBAColor;

    @serializable(Material)
    sharedMaterial?: THREE.Material;

    @serializable(SpriteSheet)
    get sprite(): SpriteSheet | undefined {
        return this._spriteSheet;
    }
    set sprite(value: SpriteSheet | undefined | number) {
        if (value === this._spriteSheet) return;
        if (typeof value === "number") {
            const index = Math.floor(value);;
            if (index === value)
                this.spriteIndex = index;
            return;
        }
        else {
            this._spriteSheet = value;
            this.updateSprite();
        }
    }

    set spriteIndex(value: number) {
        if (!this._spriteSheet) return;
        this._spriteSheet.index = value;
        this._spriteSheet.update();
    }
    get spriteIndex(): number {
        return this._spriteSheet?.index ?? 0;
    }
    get spriteFrames(): number {
        return this._spriteSheet?.slices.length ?? 0;
    }

    private _spriteSheet?: SpriteSheet;
    private _currentSprite?: THREE.Mesh;

    awake(): void {
        this._currentSprite = undefined;
        if(debug) {
            console.log("Awake", this.name, this, this.sprite?.sprite?.texture);
            if(this.sprite?.sprite?.texture)
                console.log(this.sprite.sprite.texture.minFilter.toString(), this.sprite.sprite.texture.magFilter.toString());
        }
    }

    start() {
        if (!this._currentSprite)
            this.updateSprite();
        else if (this.gameObject)
            this.gameObject.add(this._currentSprite);
    }

    // frame : number = 0;
    // update(){
    //     // const frameRate = 12;
    //     // this.frame += frameRate * this.context.time.deltaTime;
    //     // if(this.frame >= this.spriteFrames)
    //     //     this.frame = 0;
    //     // this.spriteIndex = Math.floor(this.frame);
    //     // console.log(this.spriteIndex);
    // }

    private updateSprite() {
        if (!this.__didAwake) return;
        if (!this.sprite?.sprite) return;
        const sprite = this.sprite.sprite;
        if (!this._currentSprite) {
            const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
            if (!mat) return;
            if (this.color) {
                if (!mat["color"]) mat["color"] = new THREE.Color();
                mat["color"].copy(this.color);
                mat["opacity"] = this.color.alpha;
            }
            mat.alphaTest = 0.5;

            if (sprite.texture && !mat.wireframe) {
                let tex = sprite.texture;
                // the sprite renderer modifies the textue offset 
                // so we need to clone the texture 
                // if the same texture is used multiple times
                if (tex[$spriteTexOwner] !== undefined && tex[$spriteTexOwner] !== this && this.spriteFrames > 1) {
                    tex = sprite!.texture = tex.clone();
                }
                tex[$spriteTexOwner] = this;
                mat["map"] = tex;
            }
            this.sharedMaterial = mat;
            this._currentSprite = new THREE.Mesh(SpriteUtils.getOrCreateGeometry(sprite), mat);
        }
        else {
            this._currentSprite.geometry = SpriteUtils.getOrCreateGeometry(sprite);
            this._currentSprite.material["map"] = sprite.texture;
        }

        if (this._currentSprite.parent !== this.gameObject) {
            if (this.drawMode === SpriteDrawMode.Tiled)
                this._currentSprite.scale.set(this.size.x, this.size.y, 1);
            if (this.gameObject)
                this.gameObject.add(this._currentSprite);
        }

        this._spriteSheet?.update();
    }
}
