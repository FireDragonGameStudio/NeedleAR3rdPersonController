import { getParam } from "../engine_utils";
import { isLocalNetwork } from "../engine_networking_utils";
import { ContextRegistry } from "../engine_context_registry";



const debug = getParam("debugdebug");
const hide = getParam("noerrors");

const arContainerClassName = "ar";
const errorContainer: Map<HTMLElement, HTMLElement> = new Map();
const locationRegex = new RegExp("    at .+\/(.+?\.ts)", "g");

export enum LogType {
    Log,
    Warn,
    Error
}

export function getErrorCount() {
    return errorCount;
}

export function makeErrorsVisibleForDevelopment() {
    if (hide) return;
    const isLocal = isLocalNetwork();
    if (isLocal) {
        if (debug)
            console.log(window.location.hostname);
        const error = console.error;
        console.error = (...args: any[]) => {
            error.apply(console, args);
            onParseError(args);
            addLog(LogType.Error, args, null, null);
            onReceivedError();
        };
        window.addEventListener("error", (event) => {
            if (!event) return;
            addLog(LogType.Error, event.error, event.filename, event.lineno);
            onReceivedError();
        }, true);
        window.addEventListener("unhandledrejection", (event) => {
            if (!event) return;
            addLog(LogType.Error, event.reason.message, event.reason.stack);
            onReceivedError();
        });
    }
}

let errorCount = 0;

function onReceivedError() {
    errorCount += 1;
}

function onParseError(args: Array<any>) {
    if (Array.isArray(args)) {
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (typeof arg === "string" && arg.startsWith("THREE.PropertyBinding: Trying to update node for track:")) {
                args[i] = "Some animated objects couldn't be found: see console for details";
            }
        }
    }
}

export function addLog(type: LogType, message: string | any[], _file?: string | null, _line?: number | null) {
    if (hide) return;
    const context = ContextRegistry.Current;
    const domElement = context?.domElement ?? document.querySelector("needle-engine");
    if (!domElement) return;
    if (Array.isArray(message)) {
        let newMessage = "";
        for (let i = 0; i < message.length; i++) {
            if (typeof message[i] === "object") continue;
            if (i > 0) newMessage += " ";
            newMessage += message[i];
        }
        message = newMessage;
    }
    showMessage(type, domElement, message);
}

// function getLocation(err: Error): string {
//     const location = err.stack;
//     console.log(location);
//     if (location) {
//         locationRegex.exec(location);
//         const match = locationRegex.exec(location);
//         return match ? match[1] : "";
//     }
//     return "";
// }

const currentMessages = new Set<string>();

function showMessage(type: LogType, element: HTMLElement, msg: string) {
    const container = getLogsContainer(element);
    if (container.childElementCount >= 20) {
        return;
    }
    if (currentMessages.has(msg)) return;
    currentMessages.add(msg);
    const msgcontainer = getMessageContainer(type, msg);
    container.prepend(msgcontainer);

    setTimeout(() => {
        currentMessages.delete(msg);
        returnMessageContainer(msgcontainer);
    }, 10000);
}


const logsContainerStyles = `

@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap');


div {
    font-family: 'Roboto', sans-serif;
    font-weight: 400;
}

strong {
    font-weight: 700;
}

a {
    color: white;
    text-decoration: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.3);
}

a:hover {
    text-decoration: none;
    border: none;
}

.log strong {
    color: rgba(200,200,200,.9);
}

.warn strong {
    color: rgba(255,255,230, 1);
}

.error strong {
    color: rgba(255,100,120, 1);
}

`;

function getLogsContainer(domElement: HTMLElement): HTMLElement {
    if (errorContainer.has(domElement)) {
        return errorContainer.get(domElement)!;
    } else {
        const container = document.createElement("div");
        container.classList.add(arContainerClassName);
        container.classList.add("desktop");
        container.classList.add("debug-container");
        container.style.position = "absolute";
        container.style.top = "0";
        container.style.right = "5px";
        container.style.paddingTop = "0px";
        container.style.maxWidth = "70%";
        container.style.maxHeight = "calc(100% - 5px)";
        container.style.zIndex = "1000";
        // container.style.pointerEvents = "none";
        container.style.pointerEvents = "scroll";
        // container.style["-webkit-overflow-scrolling"] = "touch";
        container.style.display = "flex";
        container.style.alignItems = "end";
        container.style.flexDirection = "column";
        container.style.color = "white";
        container.style.overflow = "auto";
        // container.style.border = "1px solid red";
        domElement.appendChild(container);
        errorContainer.set(domElement, container);

        const style = document.createElement("style");
        style.innerHTML = logsContainerStyles;
        container.appendChild(style);
        return container;
    }
}


const typeSymbol = Symbol("logtype");
const containerCache = new Map<LogType, HTMLElement[]>();

function returnMessageContainer(container: HTMLElement) {
    container.remove();
    const type = container[typeSymbol];
    const containers = containerCache.get(type) ?? [];
    containers.push(container);
    containerCache.set(type, containers);
}

function getMessageContainer(type: LogType, msg: string): HTMLElement {
    if (containerCache.has(type)) {
        const containers = containerCache.get(type)!;
        if (containers.length > 0) {
            const container = containers.pop()!;
            container.innerHTML = msg;
            return container;
        }
    }
    const element = document.createElement("div");
    element.style.marginRight = "5px";
    element.style.padding = ".5em";
    element.style.backgroundColor = "rgba(0,0,0,.9)";
    element.style.marginTop = "5px";
    element.style.marginBottom = "3px";
    element.style.borderRadius = "8px";
    element.style.pointerEvents = "all";
    element.style.userSelect = "text";
    element.style.maxWidth = "250px";
    element.style.whiteSpace = "pre-wrap";
    element.style["backdrop-filter"] = "blur(10px)";
    element.style.backgroundColor = "rgba(20,20,20,.8)";
    element.style.boxShadow = "inset 0 0 80px rgba(0,0,0,.2), 0 0 5px rgba(0,0,0,.2)";
    element.style.border = "1px solid rgba(160,160,160,.2)";
    element[typeSymbol] = type;
    switch (type) {
        case LogType.Log:
            element.classList.add("log");
            element.style.color = "rgba(200,200,200,.7)";
            element.style.backgroundColor = "rgba(40,40,40,.7)";
            // element.style.backgroundColor = "rgba(200,200,200,.5)";
            break;
        case LogType.Warn:
            element.classList.add("warn");
            element.style.color = "rgb(255, 255, 150)";
            element.style.backgroundColor = "rgba(50,50,20,.8)";
            // element.style.backgroundColor = "rgba(245,245,50,.5)";
            break;
        case LogType.Error:
            element.classList.add("error");
            element.style.color = "rgb(255, 50, 50";
            element.style.backgroundColor = "rgba(50,20,20,.8)";
            // element.style.backgroundColor = "rgba(255,50,50,.5)";
            break;
    }
    element.title = "Open the browser console (F12) for more information";

    // msg = msg.replace(/[\n\r]/g, "<br/>");
    // console.log(msg);
    element.innerHTML = msg;

    return element;
}