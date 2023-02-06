

async function generatePoster() {
    const { screenshot } = await import("@needle-tools/engine/engine/engine_utils_screenshot");

    try {
        const needleEngine = document.querySelector("needle-engine");
        if (!needleEngine) return null;

        const width = 1920;
        const height = 1920;
        const context = await needleEngine.getContext();

        // wait until a few update loops have run
        while (context.time.frameCount < 3) {
            await new Promise((resolve) => setTimeout(resolve, 50));
        }

        const mimeType = "image/webp";
        console.log("Generating poster...");
        const dataUrl = screenshot(context, width, height, mimeType);

        return dataUrl;
    }
    catch (e) {
        console.error(e);
        return null;
    }
}

async function sendPoster() {
    const blob = await generatePoster();
    import.meta.hot.send("needle:screenshot", { data: blob });
}

// communicate via vite
if (import.meta.hot) {
    // wait for needle engine to be fully loaded
    const needleEngine = document.querySelector("needle-engine");
    needleEngine.addEventListener("loadfinished", () => {
        // wait a moment
        setTimeout(() => {
            sendPoster();
        }, 200);
    });

    // for debugging: build extra button with dev-only options
    /*
    var button = document.createElement("button");
    button.id = "send-msg";
    button.innerHTML = "Generate Poster";
    button.style.position = "fixed";
    button.style.zIndex = "9999";
    document.body.appendChild(button);

    document.querySelector("#send-msg").addEventListener("click", async () => {
        sendPoster();
    });
    */
}