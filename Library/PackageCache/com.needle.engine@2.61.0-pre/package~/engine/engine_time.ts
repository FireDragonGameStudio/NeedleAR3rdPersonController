import { Clock } from 'three'
import { getParam } from './engine_utils';

const timescaleUrl = getParam("timescale");
let timeScale = 1;
if(typeof timescaleUrl === "number") timeScale = timescaleUrl;

export class Time {

    deltaTime = 0;
    time = 0;
    timeScale = 1;

    /** same as frameCount */
    frame = 0;

    get realtimeSinceStartup(): number {
        return this.clock.elapsedTime;
    }

    get frameCount() { return this.frame; }
    get smoothedFps() { return this._smoothedFps; }


    private clock = new Clock();

    private _smoothedFps: number = 0;
    private _fpsSamples: number[] = [];
    private _fpsSampleIndex: number = 0;

    update() {
        this.deltaTime = this.clock.getDelta();
        // clamp delta time because if tab is not active clock.getDelta can get pretty big
        this.deltaTime = Math.min(.1, this.deltaTime);
        this.deltaTime *= timeScale * this.timeScale;
        if(this.deltaTime <= 0) this.deltaTime = 0.000000000001;
        this.frame += 1;
        this.time += this.deltaTime;

        if (this._fpsSamples.length < 30) this._fpsSamples.push(this.deltaTime);
        else this._fpsSamples[(this._fpsSampleIndex++) % 30] = this.deltaTime;
        let sum = 0;
        for (let i = 0; i < this._fpsSamples.length; i++)
            sum += this._fpsSamples[i];
        this._smoothedFps = 1/(sum / this._fpsSamples.length);
    }
}