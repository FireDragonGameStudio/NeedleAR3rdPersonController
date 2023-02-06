

// const testUrls = ["https://192.254.384.122:3000/", "https://my-glitch-page.glitch.me/"]
// for (let url of testUrls)
//     console.log("Testing url: " + url, isLocalNetwork(url));

const localNetworkResults = new Map<string, boolean>();

export function isLocalNetwork(hostname = window.location.hostname) {
    if(localNetworkResults.has(hostname)) return localNetworkResults.get(hostname);
    const isLocalNetwork = new RegExp("[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}|localhost", "gm").test(hostname);
    localNetworkResults.set(hostname, isLocalNetwork);
    if (isLocalNetwork === true) return true;
    return false;
}

export function isHostedOnGlitch() {
    return window.location.hostname.includes("glitch.me");
}