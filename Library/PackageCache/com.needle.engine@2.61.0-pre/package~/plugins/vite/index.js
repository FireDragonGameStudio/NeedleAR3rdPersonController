import { needleBuild } from "./build.js";
import { needleMeta } from "./meta.js"
import { needlePoster } from "./poster.js"
import { needleReload } from "./reload.js"

export * from "./gzip.js";
export * from "./config.js";

const defaultUserSettings = {
    allowRemoveMetaTags: true,
    allowHotReload: true,
}

export const needlePlugins = (command, config, userSettings) => {
    // ensure we have user settings initialized with defaults
    userSettings = { ...defaultUserSettings, ...userSettings }
    return [
        needleMeta(command, config, userSettings),
        needlePoster(command),
        needleReload(command, config, userSettings),
        needleBuild(command, config, userSettings)
    ]
}
