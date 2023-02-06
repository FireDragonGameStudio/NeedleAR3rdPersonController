import * as ThreeMeshUI from 'three-mesh-ui'
import * as THREE from 'three'
import { BaseUIComponent, includesDir } from './BaseUIComponent';
import { Text } from './Text';
import { getWorldScale } from '../../engine/engine_three_utils';
import { RectTransform } from './RectTransform';
import { GameObject } from '../Component';


enum KeymapOption {
    fr,
    ru,
    de,
    es,
    el,
    nord,
    eng
}


// see https://github.com/felixmariotto/three-mesh-ui/blob/master/examples/keyboard.js
export class Keyboard extends BaseUIComponent {

    font?: string;
    text?: Text;
    keymap?: KeymapOption;
    padding?: number;
    margin?: number;
    fontSize?: number;
    borderRadius?: number;


    private colors = {
        keyboardBack: 0x858585,
        panelBack: 0x262626,
        button: 0x363636,
        hovered: 0x1c1c1c,
        selected: 0x109c5d,
    };


    awake() {
        super.awake();
        const langKey = KeymapOption[this.keymap || KeymapOption.eng];
        this.makeKeyboard(langKey);
    }
    onEnable(): void {
        this.addShadowComponent(this.keyboard);
    }
    onDisable(): void {
        this.removeShadowComponent();
    }

    private keyboard: ThreeMeshUI.Keyboard | null = null!;
    private _lastKeyPressed: any;
    private _lastKeyPressedStartTime: number = 0;
    private _lastKeyPressedTime: number = 0;

    private makeKeyboard(language?: string) {

        if (!language && !navigator.language) {
            language = "en";
        }

        const fontName = this.font ? this.font : "arial";

        const rt = GameObject.getComponent(this.gameObject, RectTransform);
        if(!rt){
            console.error("Missing rect transform, please add this component inside a canvas");
            return;
        }
        const opts = {
            ...rt.getBasicOptions(),
            margin: this.margin || 0,
            padding: this.padding || 0,
            language: language,
            fontFamily: includesDir + "/" + fontName + "-msdf.json",
            fontTexture: includesDir + "/" + fontName + ".png",
            fontSize: this.fontSize || 6, // fontSize will propagate to the keys blocks
            backgroundColor: new THREE.Color(this.colors.keyboardBack),
            backspaceTexture: includesDir + '/backspace.png',
            shiftTexture: includesDir + '/shift.png',
            enterTexture: includesDir + '/enter.png',
            borderRadius: this.borderRadius || 0,
            autoLayout: false,

        };
        // const ws = getWorldScale(this.gameObject);
        const scale = this.gameObject.scale;
        opts.width *= this.gameObject.scale.x;
        opts.height *= this.gameObject.scale.y;
        opts.fontSize *= Math.max(scale.x, scale.y);
        this.keyboard = new ThreeMeshUI.Keyboard(opts);

        // const scale = this.gameObject.scale;
        // const max = Math.max(scale.x, scale.y, scale.z);
        this.gameObject.scale.set(1, 1, 1);

        //@ts-ignore
        this.keyboard.keys.forEach((key) => {

            key.setupState({
                state: 'normal',
                attributes: {
                    offset: 0.003,
                    backgroundColor: new THREE.Color(this.colors.button),
                    backgroundOpacity: 1
                }
            });
            key.setState("normal");

            key.setupState({
                state: 'hovered',
                attributes: {
                    offset: 0.3,
                    backgroundColor: new THREE.Color(this.colors.hovered),
                    backgroundOpacity: 1
                }
            });

            key.setupState({
                state: 'pressed',
                attributes: {
                    offset: 0.1,
                    backgroundColor: new THREE.Color(this.colors.selected),
                    backgroundOpacity: 1
                },
                // triggered when the user clicked on a keyboard's key
                onSet: () => {
                    const input = key.info.input;
                    const cmd = key.info.command;
                    if (this._lastKeyPressed !== input) {
                        this._lastKeyPressedStartTime = this.context.time.time;
                    }
                    else if (this.context.time.time - this._lastKeyPressedTime > .05) {
                        // there was probably a key up inbetween
                        this._lastKeyPressedStartTime = this.context.time.time;
                    }
                    else if (this.context.time.time - this._lastKeyPressedStartTime < .5
                        || cmd == "switch"
                        || cmd == "shift"
                        || cmd == "switch-set"
                    ) {
                        this._lastKeyPressedTime = this.context.time.time;
                        return;
                    }
                    this._lastKeyPressedTime = this.context.time.time;
                    this._lastKeyPressed = input;
                    // if the key have a command (eg: 'backspace', 'switch', 'enter'...)
                    // special actions are taken
                    if (cmd) {
                        switch (cmd) {
                            // switch between panels
                            case 'switch':
                                //@ts-ignore
                                this.keyboard.setNextPanel();
                                break;

                            // switch between panel charsets (eg: russian/english)
                            case 'switch-set':
                                //@ts-ignore
                                this.keyboard.setNextCharset();
                                break;

                            case 'enter':
                                this.tryAppend('\n');
                                break;

                            case 'space':
                                this.tryAppend(' ');
                                break;

                            case 'backspace':
                                //@ts-ignore
                                if (!this.text?.text?.length) break
                                if (this.text?.text)
                                    this.text.text = this.text.text.substring(0, this.text.text.length - 1) || ""
                                break;

                            case 'shift':
                                //@ts-ignore
                                this.keyboard.toggleCase();
                                break;

                        };

                        // print a glyph, if any
                    } else if (key.info.input !== undefined) {
                        this.tryAppend(key.info.input);
                    };

                }
            });

        });
    };

    private tryAppend(char: string) {
        if (this.text) {
            this.text.text += char;
            this.markDirty();
        }
    }
}