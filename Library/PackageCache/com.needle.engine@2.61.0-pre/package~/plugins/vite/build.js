
export const needleBuild = (command, config, userSettings) => {

    // TODO: need to set this when building a dist
    const isDeployOnlyBuild = config?.deployOnly === true;

    return {
        name: 'build',
        config(config) {
            if (!config.build) {
                config.build = {};
            }
            if (isDeployOnlyBuild)
            {
                console.log("Deploy only build - will not empty output directory")
                config.build.emptyOutDir = false;
            }
        }
    }
}