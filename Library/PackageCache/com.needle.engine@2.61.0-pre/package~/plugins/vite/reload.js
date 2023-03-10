import path from 'path';
import { loadConfig, tryLoadProjectConfig } from './config.js';
import { getPosterPath } from './poster.js';
import * as crypto from 'crypto';
import { existsSync, readFileSync, statSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filesUsingHotReload = new Set();

export const needleReload = (command, config, userSettings) => {
    if (command === "build") return;


    let isUpdatingConfig = false;
    const updateConfig = async () => {
        if (isUpdatingConfig) return;
        isUpdatingConfig = true;
        const res = await loadConfig();
        isUpdatingConfig = false;
        if (res) config = res;
    }


    const projectConfig = tryLoadProjectConfig();
    const buildDirectory = projectConfig?.buildDirectory?.length ? process.cwd().replaceAll("\\", "/") + "/" + projectConfig?.buildDirectory : "";
    if (buildDirectory?.length) {
        setTimeout(() => console.log("Build directory: ", buildDirectory), 100);
    }

    // These ignore patterns will be injected into user config to better control vite reloading
    const ignorePatterns = ["dist/**/*", "src/generated/*", "**/package~/**/codegen/**/*", "**/codegen/register_types.js"];
    if (projectConfig?.buildDirectory?.length) ignorePatterns.push(`${projectConfig?.buildDirectory}/**/*`);
    if (projectConfig?.codegenDirectory?.length) ignorePatterns.push(`${projectConfig?.codegenDirectory}/**/*`);

    return {
        name: 'reload',
        config(config) {
            if (!config.server) config.server = { watch: { ignored: [] } };
            else if (!config.server.watch) config.server.watch = { ignored: [] };
            else if (!config.server.watch.ignored) config.server.watch.ignored = [];
            for (const pattern of ignorePatterns)
                config.server.watch.ignored.push(pattern);
            setTimeout(() => console.log("Updated server ignore patterns: ", config.server.watch.ignored), 100);
        },
        handleHotUpdate(args) {
            args.buildDirectory = buildDirectory;
            return handleReload(args);
        },
        transform(src, id) {
            if (!id.includes(".ts")) return;
            updateConfig();
            if (config?.allowHotReload === false) return;
            if (userSettings?.allowHotReload === false) return;
            src = insertScriptRegisterHotReloadCode(src, id);
            return insertScriptHotReloadCode(src, id);
        },
        transformIndexHtml: {
            enforce: 'pre',
            transform(html, _) {
                if (config?.allowHotReload === false) return [html];
                if (userSettings?.allowHotReload === false) return [html];
                const file = path.join(__dirname, 'reload-client.js');
                return [
                    {
                        tag: 'script',
                        attrs: {
                            type: 'module',
                        },
                        children: readFileSync(file, 'utf8'),
                        injectTo: 'body',
                    },
                ];
            },
        },
    };
}


const ignorePatterns = [];
const ignoreRegex = new RegExp(ignorePatterns.join("|"));

let lastReloadTime = 0;
const posterPath = getPosterPath();
let reloadIsScheduled = false;
const lockFileName = "needle.lock";

function notifyClientWillReload(server, file) {
    console.log("Send reload notification");
    server.ws.send('needle:reload', { type: 'will-reload', file: file });
}

async function handleReload({ file, server, modules, read, buildDirectory }) {

    // dont reload the full page on css changes
    const isCss = file.endsWith(".css") || file.endsWith(".scss") || file.endsWith(".sass")
    if (isCss) return;

    // Dont reload the whole server when a file that is using hot reload changes
    if (filesUsingHotReload.has(file)) {
        console.log("File is using hot reload: " + file);
        return;
    }

    // the poster is generated after the server has started
    // we dont want to specifically handle the png or webp that gets generated
    if (file.includes(posterPath)) return;

    if (file.endsWith("build.log")) return;

    // if (file.endsWith("/codegen/register_types.js" || file.endsWith("/generated/register_types.js"))) {
    //     console.log("Ignore change in codegen file: " + file);
    //     return [];
    // }

    // This was a test for ignoring files via regex patterns
    // instead of relying on the vite server watch ignore array
    // we could here also match paths that we know we dont want to track
    if (ignorePatterns.length > 0 && ignoreRegex.test(file)) {
        console.log("Ignore change in file: " + getFileNameLog(file));
        return [];
    }

    // Ignore files changing in output directory
    // this happens during build time when e.g. dist is not ignored in vite config
    // we still dont want to reload the local server in that case
    if (buildDirectory?.length) {
        const dir = path.dirname(file).replaceAll("\\", "/");
        if (dir.startsWith(buildDirectory)) {
            console.log("Ignore change in build directory: " + getFileNameLog(file));
            return [];
        }
    }

    // Check if codegen files actually changed their content
    // this will return false if its the first update
    // meaning if its the first export after the server starts those will not trigger a reload
    const shouldCheckIfContentChanged = file.includes("/codegen/") || file.includes("/generated/") || file.endsWith("gen.js");// || file.endsWith(".glb") || file.endsWith(".gltf") || file.endsWith(".bin");
    if (shouldCheckIfContentChanged) {
        if (reloadIsScheduled) {
            return [];
        }
        if (await testIfFileContentChanged(file, read) === false) {
            console.log("File content didnt change: " + getFileNameLog(file));
            return [];
        }
    }

    if (file.endsWith(".vue") || file.endsWith(".ts") || file.endsWith(".js") || file.endsWith(".jsx") || file.endsWith(".tsx"))
        return;

    if (file.endsWith(lockFileName)) return;
    let fileSize = "";
    const isGlbOrGltfFile = file.endsWith(".glb") || file.endsWith(".bin");
    if (isGlbOrGltfFile && existsSync(file)) {
        fileSize = statSync(file).size;
        // the file is about to be created/written to
        if (fileSize <= 0) {
            // console.log("> File is changing: " + getFileNameLog(file));
            return;
        }
    }

    console.log("> Detected file change: ", getFileNameLog(file) + " (" + ((fileSize / (1024 * 1024)).toFixed(1)) + " MB)");
    notifyClientWillReload(server);
    scheduleReload(server);
    return [];
}


async function scheduleReload(server, level = 0) {
    if (reloadIsScheduled && level === 0) return;
    reloadIsScheduled = true;

    const lockFile = path.join(process.cwd(), lockFileName);
    if (existsSync(lockFile)) {
        if (level === 0)
            console.log("Lock file exists, waiting for export to finish...");
        setTimeout(() => scheduleReload(server, level += 1), 300);
        return;
    }

    reloadIsScheduled = false;

    const timeDiff = Date.now() - lastReloadTime;
    if (timeDiff < 1000) {
        // Sometimes file changes happen immediately after triggering a reload 
        // we dont want to reload again in that case
        console.log("Ignoring reload, last reload was too recent", timeDiff);
        return;
    }

    lastReloadTime = Date.now();
    const readableTime = new Date(lastReloadTime).toLocaleTimeString();
    console.log("< Reloading... " + readableTime)
    server.ws.send({
        type: 'full-reload',
        path: '*'
    });
}

const projectDirectory = process.cwd().replaceAll("\\", "/");

function getFileNameLog(file) {
    if (file.startsWith(projectDirectory)) {
        return file.substring(projectDirectory.length);
    }
    return file;
}

const hashes = new Map();
const hash256 = crypto.createHash('sha256');

async function testIfFileContentChanged(file, read) {
    let content = await read(file);
    content = removeVersionQueryArgument(content);

    const hash = hash256.copy();
    hash.update(content);
    // compare if hash string changed
    const newHash = hash.digest('hex');
    const oldHash = hashes.get(file);
    if (oldHash !== newHash) {
        // console.log("Update hash for file: " + getFileNameLog(file) + " to " + newHash);
        hashes.set(file, newHash);
        // if its the first update we dont want to trigger a reload
        if (!oldHash) return false;
        return true;
    }
    return false;
}
function removeVersionQueryArgument(content) {
    if (typeof content === "string") {
        // Some codegen files include hashes for loading glb files (e.g. ?v=213213124)
        // Or context.hash = "54543453"
        // We dont want to use those hashes for detecting if the file changed
        let res = content.replaceAll(/(v=[0-9]+)/g, "");
        res = res.replaceAll(/(hash = \"[0-9]+\")/g, "hash = \"\"");
        return res;
    }
    return content;
}



function insertScriptRegisterHotReloadCode(src, filePath) {
    if (!filePath.includes("needle-engine.ts")) {
        return src;
    }

    // this code injects a register call into the component method
    const code = `

import { register, unregister } from "./engine/engine_hot_reload";
import { Component as ComponentType } from "./engine-components/Component";

const prototype = ComponentType.prototype;
const created = prototype.__internalNewInstanceCreated;
prototype.__internalNewInstanceCreated = function (...args) {
    created.call(this, ...args);
    register(this);
}
const destroy = prototype.__internalDestroy;
prototype.__internalDestroy = function (...args) {
    destroy.call(this, ...args);
    unregister(this);
}
        `
    return code + src;
}


const HOT_RELOAD_START_MARKER = "NEEDLE_HOT_RELOAD_BEGIN";
const HOT_RELOAD_END_MARKER = "NEEDLE_HOT_RELOAD_END";

function insertScriptHotReloadCode(src, filePath) {
    if (filePath.includes("engine_hot_reload")) return;
    if (filePath.includes(".vite")) return;

    const originalFilePath = filePath;

    // default import path when outside package
    let importPath = "@needle-tools/engine/engine/engine_hot_reload";

    if (filePath.includes("package~/engine")) {
        // convert local dev path to project node_modules path 
        const folderName = "package~";
        const startIndex = filePath.indexOf(folderName);
        const newPath = process.cwd() + "/node_modules/@needle-tools/engine" + filePath.substring(startIndex + folderName.length);
        filePath = newPath;
    }

    if (filePath.includes("@needle-tools/engine")) {
        // only make engine components hot reloadable
        if (!filePath.includes("engine/engine-components"))
            return;
        // make import path from engine package
        const fullPathToHotReload = process.cwd() + "/node_modules/@needle-tools/engine/engine/engine_hot_reload.ts";
        // console.log(fullPathToHotReload);
        const fileDirectory = path.dirname(filePath);
        // console.log("DIR", fileDirectory)
        const relativePath = path.relative(fileDirectory, fullPathToHotReload);
        importPath = relativePath.replace(/\\/g, "/");
        // console.log("importPath: ", importPath);
    }

    // console.log(importPath, ">", filePath);


    const code = `

// ${HOT_RELOAD_START_MARKER}
// Inserted by needle reload plugin (vite)
import { applyChanges } from "${importPath}";
//@ts-ignore
if (import.meta.hot) {
    //@ts-ignore
    import.meta.hot.accept((newModule) => {
        if (newModule) {

            const success = applyChanges(newModule);
            if(success === false){
                //@ts-ignore
                import.meta.hot.invalidate()
            }
        }
    })
}
// ${HOT_RELOAD_END_MARKER}
`

    if (!filesUsingHotReload.has(originalFilePath))
        filesUsingHotReload.add(originalFilePath);

    return {
        code: code + src,
        map: null
    }

}