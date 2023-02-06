import { serializable } from '../../engine/engine_serialization_decorator';
import { Color, Texture } from 'three';
import { MaskableGraphic } from './Graphic';


class Sprite {
    @serializable(Texture)
    texture?: THREE.Texture;

    rect?: { width: number, height: number };
}

export class Image extends MaskableGraphic {

    @serializable(Sprite)
    get sprite(): Sprite | undefined {
        return this._sprite;
    }
    set sprite(sprite: Sprite | undefined) {
        if (this._sprite === sprite) return;
        this._sprite = sprite;
        this.onAfterCreated();
    }

    private _sprite?: Sprite;

    private isBuiltinSprite() {
        switch (this.sprite?.texture?.name) {
            case "InputFieldBackground":
            case "UISprite":
            case "Background":
                return true;
        }
        // this is a hack/workaround for production builds where the name of the sprite is missing
        // need to remove this!!!!
        if (this.sprite?.texture?.image?.width === 32 && this.sprite?.texture?.image?.height === 32)
            return true;
        return false;
    }

    protected onBeforeCreate(opts: any): void {
        if (this.isBuiltinSprite()) {
            opts.borderRadius = 5;
            opts.borderColor = new Color(.4, .4, .4);
            opts.borderOpacity = this.color.alpha;
            opts.borderWidth = .3;
        }
    }

    protected onAfterCreated(): void {
        if(!this.__didAwake) return;
        super.onAfterCreated();
        if (this.isBuiltinSprite()) return;
        this.setTexture(this.sprite?.texture);
    }
}

export class RawImage extends MaskableGraphic {
    @serializable(Texture)
    get mainTexture(): Texture | undefined {
        return this._mainTexture;
    }
    set mainTexture(texture: Texture | undefined) {
        if (this._mainTexture === texture) return;
        this._mainTexture = texture;
        this.onAfterCreated();
    }

    private _mainTexture?: Texture;

    protected onAfterCreated(): void {
        if(!this.__didAwake) return;
        super.onAfterCreated();
        // console.log(this);
        // if (this.mainTexture) {
        //     this.mainTexture.flipY = true;
        //     this.mainTexture.needsUpdate = true;
        // }
        this.setTexture(this.mainTexture);
    }
}
