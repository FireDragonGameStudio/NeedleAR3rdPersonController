import { Context } from "./engine_setup";


export function* WaitForSeconds(seconds: number, context: Context | null = null) {
    const time = context ? context.time : Context.Current.time;
    const start = time.time;
    while(time.time - start < seconds) {
        yield;
    }
}

export function* WaitForFrames(frames: number) {
    for(let i = 0; i < frames; i++) {
        yield;
    }
}
