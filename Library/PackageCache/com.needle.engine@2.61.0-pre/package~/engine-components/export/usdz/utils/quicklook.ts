import { Context } from "../../../../engine/engine_setup";


export function ensureQuicklookLinkIsCreated(context: Context) : HTMLAnchorElement {
    const existingLink = context.domElement.querySelector("link[rel='ar']");
    if(existingLink) return existingLink as HTMLAnchorElement;

    /*
    generating this:
    <div class="menu">
      <button id="open-in-ar">Open in QuickLook</button>
      <a style="display:none;" id="link" rel="ar" href="" download="asset.usdz">
        <img id="button" width="100" src="files/arkit.png">
      </a>
    </div>
    */

    const div = document.createElement("div");
    div.classList.add("menu");
    div.classList.add("quicklook-menu");
    div.style.display = "none";
    div.style.visibility = "hidden";

    const button = document.createElement("button");
    button.id = "open-in-ar";
    button.innerText = "Open in QuickLook";
    div.appendChild(button);

    const link = document.createElement("a");
    link.id = "needle-usdz-link";
    link.style.display = "none";
    link.rel = "ar";
    link.href = "";
    div.appendChild(link);

    const img = document.createElement("img");
    img.id = "button";
    // img.src = "files/arkit.png";
    link.appendChild(img);

    context.domElement.appendChild(div);
    return link as HTMLAnchorElement;
}