import { INetworkingWebsocketUrlProvider } from "../engine/engine_networking";
import { isLocalNetwork } from "../engine/engine_networking_utils";
import { getParam } from "../engine/engine_utils";
import { Behaviour } from "./Component";

export class Networking extends Behaviour implements INetworkingWebsocketUrlProvider {

    url: string | null = null;
    urlParameterName: string | null = null;

    // used when local host is detected
    localhost: string | null = null;

    awake(){
        this.context.connection.registerProvider(this);
    }

    getWebsocketUrl(): string | null {

        let socketurl = this.url ? Networking.GetUrl(this.url, this.localhost) : null;

        if (this.urlParameterName) {
            const res = getParam(this.urlParameterName);
            if (res && typeof res === "string") {
                socketurl = res;
            }
        }

        if (!socketurl) return null;

        // regex https://regex101.com/r/JQ5WqB/1
        const regex = new RegExp("(((https?)|(?<socket_prefix>wss?)):\/\/)?(www\.)?(?<url>.+)", "gm");
        const match = regex.exec(socketurl);
        if (!match?.groups) return null;
        // if the url has a ws or wss prefix already assume the whole url is in the correct format
        const socketPrefix = match?.groups["socket_prefix"];
        if (socketPrefix) return socketurl;
        // otherwise add the ws prefix
        return "wss://" + match?.groups["url"];
    }


    public static GetUrl(url: string, localhostFallback?: string | null): string {

        let result = url;

        const useLocalHostUrl = Networking.IsLocalNetwork() && localhostFallback;
        if (useLocalHostUrl) {
            result = localhostFallback;
        }

        if (url?.startsWith("/")) {
            const base = useLocalHostUrl ? result : window.location.origin;
            result = base + url;
        }

        return result;
    }

    public static IsLocalNetwork(hostname = window.location.hostname) {
        return isLocalNetwork(hostname);
    }
}