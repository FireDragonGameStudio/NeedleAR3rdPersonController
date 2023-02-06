import { addLog, LogType } from "./debug_overlay";
import { showDebugConsole } from "./debug_console";
import { isLocalNetwork } from "../engine_networking_utils";

export { showDebugConsole }
export { LogType };

export function showBalloonMessage(text: string, logType: LogType = LogType.Log) {
    addLog(logType, text);
}

export function showBalloonWarning(text: string) {
    showBalloonMessage(text, LogType.Warn);
}

export function isDevEnvironment(){
    return isLocalNetwork();
}