import { existsSync, readFileSync } from 'fs';

export async function loadConfig(path) {
    try {
        // const root = process.cwd();
        if (!path)
            path = './src/generated/meta.json';
        if (existsSync(path)) {
            const text = readFileSync(path, 'utf8');
            if (!text) return null;
            return JSON.parse(text);
        }
        else console.error("Could not find config file at " + path);
        return null;
    }
    catch (err) {
        console.error("Error loading config file");
        console.error(err);
        return null;
    }
}

export function tryLoadProjectConfig() {
    try {
        const root = process.cwd();
        const path = root + '/needle.config.json';
        if (existsSync(path)) {
            const text = readFileSync(path);
            if (!text) return null;
            const json = JSON.parse(text);
            return json;
        }
    }
    catch (err) {
        console.error("Error loading config file");
        console.error(err);
    }

    return null;
}