import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getPosterPath() {
    return "include/poster.webp";
}

export const needlePoster = (command) => {
    // only relevant for local development
    if (command === 'build') return [];

    return {
        name: 'save-screenshot',
        configureServer(server) {
            server.ws.on('needle:screenshot', async (data, client) => {
                if(!data?.data){
                    console.warn("Received empty screenshot data, ignoring");
                    return;
                }
                const targetPath = "./" + getPosterPath();
                console.log("Received poster, saving to " + targetPath);
                // remove data:image/png;base64, from the beginning of the string
                if (targetPath.endsWith(".webp"))
                    data.data = data.data.replace(/^data:image\/webp;base64,/, "");
                else
                    data.data = data.data.replace(/^data:image\/png;base64,/, "");
                const dir = path.dirname(targetPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true })
                }
                fs.writeFileSync(targetPath, Buffer.from(data.data, "base64"));
            });
        },
        transformIndexHtml: {
            enforce: 'pre',
            transform(html, ctx) {
                const file = path.join(__dirname, 'poster-client.js');
                return [
                    {
                        tag: 'script',
                        attrs: {
                            type: 'module',
                        },
                        children: fs.readFileSync(file, 'utf8'),
                        injectTo: 'body',
                    },
                ];
            },
        },
    }
};