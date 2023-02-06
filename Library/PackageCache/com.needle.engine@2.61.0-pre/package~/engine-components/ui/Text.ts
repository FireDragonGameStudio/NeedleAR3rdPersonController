import { Graphic } from './Graphic';
import * as ThreeMeshUI from 'three-mesh-ui'
import { $shadowDomOwner, includesDir } from "./BaseUIComponent";
import { RectTransform } from './RectTransform';
import { Color } from 'three';
import { FrameEvent } from '../../engine/engine_setup';
import { updateRenderSettings } from './Utils';
import { Canvas } from './Canvas';
import { serializable } from '../../engine/engine_serialization_decorator';
import { getParam, getPath } from '../../engine/engine_utils';

const debug = getParam("debugtext");

export enum TextAnchor {
    UpperLeft = 0,
    UpperCenter = 1,
    UpperRight = 2,
    MiddleLeft = 3,
    MiddleCenter = 4,
    MiddleRight = 5,
    LowerLeft = 6,
    LowerCenter = 7,
    LowerRight = 8,
}

export enum VerticalWrapMode {
    Truncate = 0,
    Overflow = 1,
}
enum HorizontalWrapMode {
    Wrap = 0,
    Overflow = 1,
}

enum FontStyle {
    Normal = 0,
    Bold = 1,
    Italic = 2,
    BoldAndItalic = 3,
}

export class Text extends Graphic {

    @serializable(Canvas)
    canvas?: Canvas;
    @serializable()
    alignment: TextAnchor = TextAnchor.UpperLeft;
    @serializable()
    verticalOverflow: VerticalWrapMode = VerticalWrapMode.Truncate;
    @serializable()
    horizontalOverflow: HorizontalWrapMode = HorizontalWrapMode.Wrap;
    @serializable()
    lineSpacing: number = 1;
    @serializable()
    supportRichText: boolean = false;
    @serializable()
    font?: string;
    @serializable()
    fontStyle: FontStyle = FontStyle.Normal;

    @serializable()
    get text(): string {
        return this._text;
    }
    set text(val: string) {
        this._text = val;
        if (!this._textMeshUi && this._text.length > 0 && this.context.time.frame > 0) {
            this.createText(val, this.getTextOpts(), this.supportRichText);
        }
        if (this._textMeshUi) {
            if (this._textMeshUi.length > 1) {
                this.requestRebuild();
                return;
            }
            //@ts-ignore
            this._textMeshUi[0].set({ content: val });
            this.markDirty();
        }
    }
    private set_text(val: string) {
        this.text = val;
    }

    @serializable()
    get fontSize(): number { return this._fontSize; }
    set fontSize(val: number) {
        this._fontSize = val;
        if (this._textMeshUi) {
            if (this._textMeshUi.length > 1) {
                this.requestRebuild();
                return;
            }
            //@ts-ignore
            this._textMeshUi[0].set({ fontSize: val });
            this.markDirty();
        }
    }

    protected onColorChanged(): void {
        if (this._textMeshUi) {
            if (this._textMeshUi.length > 1) {
                this.requestRebuild();
                return;
            }
            const col = this.color;
            //@ts-ignore
            this._textMeshUi[0].set({ fontColor: col, fontOpacity: col.alpha });
            this.markDirty();
        }
    }

    private _isWaitingForRebuild: boolean = false;
    private requestRebuild() {
        if (this._isWaitingForRebuild) return;
        this._isWaitingForRebuild = true,
            this.startCoroutine(this.rebuildDelayedRoutine(), FrameEvent.EarlyUpdate);
    }
    private *rebuildDelayedRoutine() {
        this._isWaitingForRebuild = false;
        if (this._textMeshUi) {
            for (const text of this._textMeshUi) {
                text.removeFromParent();
            }
            this._textMeshUi.length = 0;
        }
        this.createText(this.text, this.getTextOpts(), this.supportRichText);
        this.markDirty();
    }

    protected onCreate(_opts: any): void {
        if (debug) console.log(this);
        const hideOverflow = this.verticalOverflow == VerticalWrapMode.Truncate && this.horizontalOverflow == HorizontalWrapMode.Wrap;
        if (hideOverflow)
            this.context.renderer.localClippingEnabled = true;

        const rt = this.rectTransform;
        // this._container = this._textMeshUi;
        // every mesh ui component must be inside a block
        // images emit nothing but blocks
        // this code should probably be moved somewhere else and also handle raw image / anything that emits block (sprite?)
        // so we only add extra blocks if the parent doesnt have one yet
        // maybe we can just ask the component the text will be added to to not rely on our unity components?
        // this can hopefully be removed once this is fixed/improved: https://github.com/felixmariotto/three-mesh-ui/issues/168
        this._textContainer = this.uiObject = this.createBlock(rt, hideOverflow, null, true);


        this.createText(this.text, this.getTextOpts(), this.supportRichText);
        if (this.uiObject) {
            //@ts-ignore
            // this._container.width += this.fontSize * .333; // avoid word wrapping
        }
        this.uiObject = this.createBlock(rt, hideOverflow, this.uiObject, false);
    }

    onAfterAddedToScene() {
        super.onAfterAddedToScene();
        this.handleTextRenderOnTop();
    }

    private _text: string = "";
    private _fontSize: number = 12;
    private _textMeshUi: Array<ThreeMeshUI.Text> | null = null;
    private _textContainer: any = null;

    private getTextOpts(): object {
        let fontSize = this.fontSize;
        // if (this.canvas) {
        //     fontSize /= this.canvas?.scaleFactor;
        // }
        const textOpts = {
            content: this.text,
            fontColor: this.color,
            fontOpacity: this.color.alpha,
            fontSize: fontSize,
            fontKerning: "normal",
        };
        this.font = this.font?.toLocaleLowerCase();
        this.setFont(textOpts, this.fontStyle);
        return textOpts;
    }


    onEnable(): void {
        super.onEnable();
        this._didHandleTextRenderOnTop = false;
        if (this.uiObject) {
            // @ts-ignore
            this.uiObject.onAfterUpdate = this.updateWidth.bind(this);
        }
    }

    private createBlock(rt: RectTransform, hideOverflow: boolean, content: THREE.Object3D | Array<THREE.Object3D> | null, isTextIntermediate: boolean = false): ThreeMeshUI.Block | null {
        //@ts-ignore
        const opts: ThreeMeshUI.BlockOptions = {};
        opts.hiddenOverflow = hideOverflow;
        opts.interLine = (this.lineSpacing - 1) * this.fontSize * 1.333;
        this.getAlignment(opts, isTextIntermediate);
        const block = rt.createNewBlock(opts);
        if (content) {
            if (Array.isArray(content)) {
                block.add(...content);
            } else {
                block.add(content);
            }
        }
        return block;
    }


    private getAlignment(opts: ThreeMeshUI.BlockOptions | any, isTextIntermediate: boolean = false): ThreeMeshUI.BlockOptions {
        if (!isTextIntermediate)
            opts.contentDirection = "row";
        switch (this.alignment) {
            default:
            case TextAnchor.UpperLeft:
            case TextAnchor.UpperCenter:
            case TextAnchor.UpperRight:
                opts.justifyContent = "start";
                break;
            case TextAnchor.MiddleLeft:
            case TextAnchor.MiddleCenter:
            case TextAnchor.MiddleRight:
                opts.justifyContent = "center";
                break;
            case TextAnchor.LowerLeft:
            case TextAnchor.LowerCenter:
            case TextAnchor.LowerRight:
                opts.justifyContent = "end";
                break;
        }
        switch (this.alignment) {
            case TextAnchor.UpperLeft:
            case TextAnchor.MiddleLeft:
            case TextAnchor.LowerLeft:
                opts.alignContent = isTextIntermediate ? "left" : "top";
                break;
            case TextAnchor.UpperCenter:
            case TextAnchor.MiddleCenter:
            case TextAnchor.LowerCenter:
                opts.alignContent = "center";
                break;
            case TextAnchor.UpperRight:
            case TextAnchor.MiddleRight:
            case TextAnchor.LowerRight:
                opts.alignContent = isTextIntermediate ? "right" : "bottom";
                break;
        }
        return opts;
    }

    private updateWidth() {
        if (this.horizontalOverflow === HorizontalWrapMode.Overflow) {
            setTimeout(() => {
                if (!this._textMeshUi) return;
                const container = this._textMeshUi[0].parent;
                if (!container) return;
                //@ts-ignore
                if (container.lines) {
                    //@ts-ignore
                    let newWidth = container.lines.reduce((accu, line) => { return accu + line.width }, 0);
                    //@ts-ignore
                    newWidth += container.getFontSize() * 5;
                    //@ts-ignore
                    newWidth += (container.padding * 2 || 0);
                    newWidth += this.fontSize * 1.5;
                    // TODO: handle alignment!
                    // const pos = container.position;
                    // pos.x = this.gameObject.position.x * -.01 + newWidth * .5 - this.rect.sizeDelta.x * .005;
                    // this._textMeshUi.set({ position: pos });
                    //@ts-ignore
                    container.set({ width: newWidth });
                    this.ensureShadowComponentOwner();
                }
            }, 1);
        }
    }

    private ensureShadowComponentOwner() {
        if (this.shadowComponent) {
            this.shadowComponent.traverse(c => {
                if (c[$shadowDomOwner] === undefined)
                    c[$shadowDomOwner] = this;
            });
        }
    }

    private createText(text: string, opts: any, richText: boolean) {
        if (!text || text.length <= 0) return;
        if (!this._textMeshUi)
            this._textMeshUi = [];
        if (!richText) {
            // console.log(text)
            const opt = { ...opts };
            opt.content = text;
            const element = new ThreeMeshUI.Text(opt);
            this._textMeshUi.push(element);
            if (this._textContainer) {
                this._textContainer.add(element);
            }
        }
        else {
            let currentTag: TagInfo | null = this.getNextTag(text);
            if (!currentTag) {
                return this.createText(text, opts, false);
            }
            else if (currentTag.startIndex > 0) {
                this.createText(text.substring(0, currentTag.startIndex), opts, false);
            }
            const stackArray: Array<TagStackEntry> = [];
            while (currentTag) {
                const next = this.getNextTag(text, currentTag.endIndex);
                if (next) {
                    const content = this.getText(text, currentTag, next);
                    this.handleTag(currentTag, opts, stackArray);
                    this.createText(content, opts, false);
                }
                else {
                    const content = text.substring(currentTag.endIndex);
                    this.handleTag(currentTag, opts, stackArray);
                    this.createText(content, opts, false);
                }
                currentTag = next;
            }
        }
    }

    private _didHandleTextRenderOnTop: boolean = false;
    private handleTextRenderOnTop() {
        if (this._didHandleTextRenderOnTop) return;
        this._didHandleTextRenderOnTop = true;
        this.startCoroutine(this.renderOnTopCoroutine());
    }

    // waits for all the text objects to be ready to set the render on top setting
    private *renderOnTopCoroutine() {
        if (!this.canvas) return;
        const updatedRendering: boolean[] = [];
        const canvas = this.canvas;
        const settings = { renderOnTop: canvas.renderOnTop, depthWrite: canvas.depthWrite, doubleSided: canvas.doubleSided };
        while (true) {
            let isWaitingForElementToUpdate = false;
            if (this._textMeshUi) {
                for (let i = 0; i < this._textMeshUi.length; i++) {
                    if (updatedRendering[i] === true) continue;
                    isWaitingForElementToUpdate = true;
                    const textMeshObject = this._textMeshUi[i];
                    // text objects have this textContent which is the mesh
                    // it is not ready immediately so we have to check if it exists 
                    // and only then setting the render on top property works
                    if (!textMeshObject["textContent"]) continue;
                    updateRenderSettings(textMeshObject, settings);
                    updatedRendering[i] = true;
                    // console.log(textMeshObject);
                }
            }
            if (!isWaitingForElementToUpdate) break;
            yield;
        }
    }

    private handleTag(tag: TagInfo, opts: any, stackArray: Array<TagStackEntry>) {
        // console.log(tag);
        if (!tag.isEndTag) {
            if (tag.type.includes("color")) {
                const stackEntry = new TagStackEntry(tag, { fontColor: opts.fontColor });
                stackArray.push(stackEntry);
                if (tag.type.length > 6) // color=
                {
                    const col = tag.type.substring(6);
                    opts.fontColor = getColorFromString(col);
                }
                else {
                    // if it does not contain a color it is white
                    opts.fontColor = new Color(1, 1, 1);
                }
            }
            else if (tag.type == "b") {
                const stackEntry = new TagStackEntry(tag, {
                    fontFamily: opts.fontFamily,
                    fontTexture: opts.fontTexture,
                });
                stackArray.push(stackEntry);
                this.setFont(opts, FontStyle.Bold);
            }
            else if (tag.type == "i") {
                const stackEntry = new TagStackEntry(tag, {
                    fontFamily: opts.fontFamily,
                    fontTexture: opts.fontTexture,
                });
                stackArray.push(stackEntry);
                this.setFont(opts, FontStyle.Italic);
            }
        }
        else {
            if (stackArray.length > 0) {
                const last = stackArray.pop();
                if (last) {
                    for (const key in last.previousValues) {
                        const prevValue = last.previousValues[key];
                        // console.log(key, val);
                        opts[key] = prevValue;
                    }
                }
            }
        }
    }

    private getText(text: string, start: TagInfo, end: TagInfo) {
        return text.substring(start.endIndex, end.startIndex);
    }

    private getNextTag(text: string, startIndex: number = 0): TagInfo | null {
        const start = text.indexOf("<", startIndex);
        const end = text.indexOf(">", start);
        if (start >= 0 && end >= 0) {
            const tag = text.substring(start + 1, end);
            return { type: tag, startIndex: start, endIndex: end + 1, isEndTag: tag.startsWith("/") };
        }
        return null;
    }

    private setFont(opts: any, fontStyle: FontStyle) {
        const name = this.getFontName(fontStyle);
        let family = name;
        if (!family?.endsWith("-msdf.json")) family += "-msdf.json";
        opts.fontFamily = family;

        let texture = name;
        if (!texture?.endsWith(".png")) texture += ".png";
        opts.fontTexture = texture;
    }

    private getFontName(_fontStyle: FontStyle): string | null {
        if (!this.font) return null;
        // switch (fontStyle) {
        //     case FontStyle.Normal:
        //         return this.font;
        //     case FontStyle.Bold:
        //         if (!this.font.includes("-bold"))
        //             return this.font + "-bold";
        //     case FontStyle.Italic:
        //         if (!this.font.includes("-italic"))
        //             return this.font + "-italic";
        //     case FontStyle.BoldAndItalic:
        //         if (!this.font.includes("-bold-italic"))
        //             return this.font + "-bold-italic";
        // }
        this.font = getPath(this.sourceId, this.font);
        return this.font;
    }
}

class TagStackEntry {
    tag: TagInfo;
    previousValues: object;
    constructor(tag: TagInfo, previousValues: object) {
        this.tag = tag;
        this.previousValues = previousValues;
    }
}

declare type TagInfo = {
    type: string,
    startIndex: number,
    endIndex: number,
    isEndTag: boolean
}


function getColorFromString(str: string): Color {
    if (str.startsWith("#")) {
        const hex = str.substring(1);
        var bigint = parseInt(hex, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return new Color(r / 255, g / 255, b / 255);
    }
    switch (str) {
        // basic colors // https://www.rapidtables.com/web/color/RGB_Color.html
        case "black": return new Color(0, 0, 0);
        case "white": return new Color(1, 1, 1);
        case "red": return new Color(1, 0, 0);
        case "lime": return new Color(0, 1, 0);
        case "blue": return new Color(0, 0, 1);
        case "yellow": return new Color(1, 1, 0);
        case "cyan": return new Color(0, 1, 1);
        case "magenta": return new Color(1, 0, 1);
        case "silver": return new Color(0.75, 0.75, 0.75);
        case "gray": return new Color(0.5, 0.5, 0.5);
        case "maroon": return new Color(0.5, 0, 0);
        case "olive": return new Color(0.5, 0.5, 0);
        case "green": return new Color(0, 0.5, 0);
        case "purple": return new Color(0.5, 0, 0.5);
        case "teal": return new Color(0, 0.5, 0.5);
        case "navy": return new Color(0, 0, 0.5);

        // case "maroon": return new Color(0.5, 0, 0);
        case "darkred": return new Color(0.54, 0, 0);
        case "brown": return new Color(0.55, 0.27, 0);
        case "firebrick": return new Color(0.69, 0.13, 0.13);
        case "crimson": return new Color(0.86, 0.08, 0.24);
        // case "red": return new Color(1, 0, 0);
        case "tomato": return new Color(1, 0.39, 0.28);
        case "coral": return new Color(1, 0.49, 0.31);
        case "indianred": return new Color(0.6, 0.31, 0.51);
        case "lightcoral": return new Color(0.94, 0.5, 0.5);
        case "darkorange": return new Color(1, 0.55, 0);
        case "orange": return new Color(1, 0.65, 0);
        case "gold": return new Color(1, 0.84, 0);
        case "darkgoldenrod": return new Color(0.72, 0.53, 0.04);
        case "goldenrod": return new Color(0.85, 0.65, 0.13);
        case "palegoldenrod": return new Color(0.93, 0.87, 0.67);
        case "darkkhaki": return new Color(0.74, 0.7, 0.42);
        case "khaki": return new Color(0.94, 0.9, 0.55);
        // case "olive": return new Color(0.5, 0.5, 0);
        // case "yellow": return new Color(1, 1, 0);
        case "yellowgreen": return new Color(0.6, 0.8, 0.19);
        case "darkolivegreen": return new Color(0.33, 0.42, 0.18);
        case "olivedrab": return new Color(0.42, 0.56, 0.14);
        case "lawngreen": return new Color(0.49, 0.99, 0.0);
        case "chartreuse": return new Color(0.5, 1, 0);
        case "greenyellow": return new Color(0.68, 1, 0.18);
        case "darkgreen": return new Color(0, 0.39, 0);
        // case "green": return new Color(0, 1, 0);
        case "forestgreen": return new Color(0.13, 0.55, 0.13);
        // case "lime": return new Color(0, 1, 0);
        case "limegreen": return new Color(0.19, 0.80, 0.19);
        case "lightgreen": return new Color(0.56, 0.93, 0.56);
        case "palegreen": return new Color(0.59, 0.98, 0.59);
        case "darkseagreen": return new Color(0.56, 0.74, 0.56);
        case "mediumspringgreen": return new Color(0, 0.98, 0.6);
        case "springgreen": return new Color(0, 1, 0.5);
        case "seagreen": return new Color(0.18, 0.31, 0.31);
        case "mediumaquamarine": return new Color(0.4, 0.8, 0.66);
        case "mediumseagreen": return new Color(0.24, 0.70, 0.44);
        case "lightseagreen": return new Color(0.13, 0.70, 0.67);
        case "darkslategray": return new Color(0.18, 0.31, 0.31);
        // case "teal": return new Color(0, 0.5, 0.5);
        case "darkcyan": return new Color(0, 0.55, 0.55);
        case "aqua": return new Color(0, 1, 1);
        // case "cyan": return new Color(0, 1, 1);
        case "lightcyan": return new Color(0.8, 1, 1);
        case "darkturquoise": return new Color(0, 0.81, 0.82);
        case "turquoise": return new Color(0, 0.82, 0.82);
        case "mediumturquoise": return new Color(0.28, 0.82, 0.8);
        case "paleturquoise": return new Color(0.68, 1, 0.93);
        case "aquamarine": return new Color(0.5, 1, 0.83);
        case "powderblue": return new Color(0.69, 0.88, 0.9);
        case "cadetblue": return new Color(0.37, 0.62, 0.63);
        case "steelblue": return new Color(0.27, 0.51, 0.71);
        case "cornflowerblue": return new Color(0.39, 0.58, 0.93);
        case "deepskyblue": return new Color(0, 0.7, 1);
        case "dodgerblue": return new Color(0.12, 0.56, 1);
        case "lightblue": return new Color(0.68, 0.85, 0.9);
        case "skyblue": return new Color(0.53, 0.81, 0.92);
        case "lightskyblue": return new Color(0.53, 0.81, 0.98);
        case "midnightblue": return new Color(0.18, 0.18, 0.31);
        // case "navy": return new Color(0, 0, 0.5);
        case "darkblue": return new Color(0, 0, 0.55);
        case "mediumblue": return new Color(0, 0, 0.82);
        // case "blue": return new Color(0, 0, 1);
        case "royalblue": return new Color(0.25, 0.41, 0.88);
        case "blueviolet": return new Color(0.54, 0.17, 0.89);
        case "indigo": return new Color(0.29, 0, 0.51);
        case "darkslateblue": return new Color(0.28, 0.24, 0.55);
        case "slateblue": return new Color(0.42, 0.35, 0.80);
        case "mediumslateblue": return new Color(0.48, 0.41, 0.9);
        case "mediumpurple": return new Color(0.58, 0.44, 0.86);
        case "darkmagenta": return new Color(0.55, 0, 0.55);
        case "darkviolet": return new Color(0.58, 0, 0.83);
        case "darkorchid": return new Color(0.6, 0.2, 0.8);
        case "mediumorchid": return new Color(0.73, 0.33, 0.83);
        // case "purple": return new Color(0.5, 0, 0.5);
        case "thistle": return new Color(0.84, 0.75, 0.85);
        case "plum": return new Color(0.87, 0.63, 0.87);
        case "violet": return new Color(0.93, 0.51, 0.93);
        // case "magenta": return new Color(1, 0, 1);
        case "fuchsia": return new Color(1, 0, 1);
        case "orchid": return new Color(0.85, 0.44, 0.84);
        case "mediumvioletred": return new Color(0.78, 0.08, 0.52);
        case "palevioletred": return new Color(0.86, 0.44, 0.58);
        case "hotpink": return new Color(1, 0.4, 0.71);
        case "deeppink": return new Color(1, 0.08, 0.58);
        case "lightpink": return new Color(1, 0.71, 0.76);
        case "pink": return new Color(1, 0.75, 0.78);
        case "antiquewhite": return new Color(0.98, 0.92, 0.84);
        case "beige": return new Color(0.96, 0.96, 0.86);
        case "bisque": return new Color(1, 0.89, 0.77);
        case "blanchedalmond": return new Color(1, 0.92, 0.82);
        case "wheat": return new Color(0.96, 0.87, 0.87);
        case "cornsilk": return new Color(1, 0.97, 0.86);
        case "lemonchiffon": return new Color(1, 0.98, 0.8);
        case "lightgoldenrodyellow": return new Color(0.98, 0.98, 0.82);
        case "lightyellow": return new Color(1, 1, 0.8);
        case "saddlebrown": return new Color(0.55, 0.27, 0.07);
        case "sienna": return new Color(0.63, 0.32, 0.18);
        case "chocolate": return new Color(0.82, 0.41, 0.12);
        case "peru": return new Color(0.82, 0.52, 0.25);
        case "sandybrown": return new Color(0.96, 0.64, 0.38);
        case "burlywood": return new Color(0.87, 0.72, 0.53);
        case "tan": return new Color(0.82, 0.71, 0.55);
        case "rosybrown": return new Color(0.74, 0.56, 0.56);
        case "moccasin": return new Color(1, 0.89, 0.71);
        case "navajowhite": return new Color(1, 0.87, 0.68);
        case "peachpuff": return new Color(1, 0.85, 0.73);
        case "mistyrose": return new Color(1, 0.89, 0.88);
        case "lavenderblush": return new Color(1, 0.94, 0.93);
        case "linen": return new Color(0.98, 0.94, 0.9);
        case "oldlace": return new Color(0.99, 0.96, 0.9);
        case "papayawhip": return new Color(1, 0.94, 0.84);
        case "seashell": return new Color(1, 0.96, 0.93);
        case "mintcream": return new Color(0.98, 1, 0.98);
        case "slategray": return new Color(0.44, 0.5, 0.56);
        case "lightslategray": return new Color(0.47, 0.53, 0.6);
        case "lightsteelblue": return new Color(0.69, 0.77, 0.87);
        case "lavender": return new Color(0.9, 0.9, 0.98);
        case "floralwhite": return new Color(1, 0.98, 0.98);
        case "aliceblue": return new Color(0.94, 0.97, 1);
        case "ghostwhite": return new Color(0.97, 0.97, 1);
        case "honeydew": return new Color(0.94, 1, 0.94);
        case "ivory": return new Color(1, 1, 0.94);
        case "azure": return new Color(0.94, 1, 1);
        case "snow": return new Color(1, 0.98, 0.98);
        // case "black": return new Color(0, 0, 0);
        case "dimgray": return new Color(0.4, 0.4, 0.4);
        // case "gray": return new Color(0.5, 0.5, 0.5);
        case "darkgray": return new Color(0.66, 0.66, 0.66);
        // case "silver": return new Color(0.75, 0.75, 0.75);
        case "lightgray": return new Color(0.83, 0.83, 0.83);
        case "gainsboro": return new Color(0.86, 0.86, 0.86);
        case "whitesmoke": return new Color(0.96, 0.96, 0.96);

    }
    return new Color(1, 1, 1);
}

// const anyTag = new RegExp('<.+?>', 'g');
// const regex = new RegExp('<(?<type>.+?)>(?<text>.+?)<\/.+?>', 'g');
