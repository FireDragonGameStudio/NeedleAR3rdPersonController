import { getErrorCount } from "./debug_overlay";
import { getParam, isMobileDevice } from "../engine_utils";
import { isLocalNetwork } from "../engine_networking_utils";

let consoleInstance: any = null;
let consoleHtmlElement: HTMLElement | null = null;
let consoleSwitchButton: HTMLElement | null = null;
let isLoading = false;
let isVisible = false;
let watchInterval: any = null;
const defaultButtonIcon = "📜";

const showConsole = getParam("console");
const suppressConsole = getParam("noerrors");
if (showConsole) {
    showDebugConsole();
}

if (!suppressConsole && (showConsole || isLocalNetwork())) {
    if (isLocalNetwork())
        console.log("Add the ?console query parameter to the url to show the debug console (on mobile it will automatically open for local development when your get errors)");
    const isMobile = isMobileDevice();
    if (isMobile) {
        beginWatchingLogs();
        createConsole(true);
        if (isMobile) {
            const engineElement = document.querySelector("needle-engine");
            engineElement?.addEventListener("enter-ar", () => {
                if (showConsole || consoleInstance || getErrorCount() > 0) {
                    if (getParam("noerrors")) return;
                    const overlay = engineElement["getAROverlayContainer"]?.call(engineElement);
                    const consoleElement = getConsoleElement();
                    if (consoleElement && overlay) {
                        overlay.appendChild(consoleElement);
                    }
                }
            });
            engineElement?.addEventListener("exit-ar", () => {
                onResetConsoleElementToDefaultParent();
            });
        }
    }
}

const $defaultConsoleParent = Symbol("consoleParent");

export function showDebugConsole() {

    if (consoleInstance !== null) {
        isVisible = true;
        consoleInstance.showSwitch();
        return;
    }
    createConsole();
}

export function hideDebugConsole() {
    if (consoleInstance === null) return;
    isVisible = false;
    consoleInstance.hide();
    consoleInstance.hideSwitch();
}

function beginWatchingLogs() {
    if (watchInterval) return;
    watchInterval = setInterval(consoleElementUpdateInterval, 500);
}

let lastErrorCount = 0;
function consoleElementUpdateInterval() {
    const currentCount = getErrorCount();
    const receivedNewErrors = currentCount !== lastErrorCount;
    lastErrorCount = currentCount;
    if (receivedNewErrors) {
        onNewConsoleErrors();
    }
}

function onNewConsoleErrors() {
    showDebugConsole();
    if (consoleSwitchButton) {
        consoleSwitchButton.setAttribute("error", "true");
        consoleSwitchButton.innerText = "🤬"
    }
}

function onConsoleSwitchButtonClicked() {
    if (consoleSwitchButton) {
        consoleSwitchButton.removeAttribute("error");
        consoleSwitchButton.innerText = defaultButtonIcon;
    }
}

function onResetConsoleElementToDefaultParent() {
    if (consoleHtmlElement && consoleHtmlElement[$defaultConsoleParent]) {
        consoleHtmlElement[$defaultConsoleParent].appendChild(consoleHtmlElement);
    }
}

function createConsole(startHidden: boolean = false) {
    if (consoleInstance) return;
    if (isLoading) return;
    isLoading = true;

    const script = document.createElement("script");
    script.src = "https://unpkg.com/vconsole@latest/dist/vconsole.min.js";
    script.onload = () => {
        isLoading = false;
        isVisible = true;
        beginWatchingLogs();
        //@ts-ignore
        consoleInstance = new window.VConsole();
        consoleHtmlElement = getConsoleElement();
        if (consoleHtmlElement) {
            consoleHtmlElement[$defaultConsoleParent] = consoleHtmlElement.parentElement;
        }
        consoleInstance.setSwitchPosition(20, 10);
        consoleSwitchButton = getConsoleSwitchButton();
        if (consoleSwitchButton) {
            consoleSwitchButton.innerText = defaultButtonIcon;
            consoleSwitchButton.addEventListener("click", onConsoleSwitchButtonClicked);
            const buttonStyles = document.createElement("style");
            const size = 40;
            buttonStyles.innerHTML = `
                #__vconsole .vc-switch {
                    border: 1px solid rgba(255,255,255,.2);
                    border-radius: 50%;
                    width: ${size}px;
                    height: ${size}px;
                    padding: 0;
                    line-height: ${size}px;
                    font-size: ${size * .4}px;
                    text-align: center;
                    background: rgba(200,200,200,.2);
                    backdrop-filter: blur(10px);
                    user-select: none;
                    pointer-events: auto;
                    transition: transform .2s ease-in-out;
                }
                #__vconsole .vc-switch:hover {
                    cursor: pointer;
                    transform: scale(1.1);
                    transition: transform .1s ease-in-out;
                }
                #__vconsole .vc-switch[error] {
                    background: rgba(255,0,0,.2);
                    animation: vconsole-notify 1s ease-in-out;
                }
                @keyframes vconsole-notify {
                    from {
                        transform: scale(1, 1);
                    }
                    10% {
                        transform: scale(1.3, 1.3);
                    }
                    70% {
                        transform: scale(1.4, 1.4);
                    }
                    to {
                        transform: scale(1, 1);
                    }
                }
            `;
            document.head.appendChild(buttonStyles);
            if (startHidden === true)
                hideDebugConsole();
        }

    };
    document.body.appendChild(script);
}

function getConsoleSwitchButton(): HTMLElement | null {
    const el = document.querySelector("#__vconsole .vc-switch");
    if (el) return el as HTMLElement;
    return null;
}

function getConsoleElement(): HTMLElement | null {
    const el = document.querySelector("#__vconsole");
    if (el) return el as HTMLElement;
    return null;
}