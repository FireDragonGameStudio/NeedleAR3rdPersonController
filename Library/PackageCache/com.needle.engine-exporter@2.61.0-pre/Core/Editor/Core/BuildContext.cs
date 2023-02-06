using UnityEditor;

namespace Needle.Engine.Core
{
    // Things we may want to enable individually:
    // 1 do we want to export glTF files
    // 2 do we want to emit generated JS
    // 3 do we want to emit config data
    // 4 do we want to run a NPM process afterwards (only start server, run build)
    // 5 do we want to apply optimizations (emit sourceMaps, pack glTF files or not, ...)
        
    // export a glTF with Needle extensions: 1
    // local server (press play): 1 + 2 + 3 + 4
    // update running server: 1 + 2 + 3, can skip 4
    // build for production: 1 + 2 + 3 + 4 + 5
    // update build to deploy somewhere else: 3 + 4
    
    public class BuildContext : IBuildContext
    {
        private BuildContext(BuildCommand command)
        {
            this.Command = command;
        }

        public readonly BuildCommand Command;
        public string LiveUrl;
        public bool ViaContextMenu = false;
        bool IBuildContext.ViaContextMenu => ViaContextMenu;

        public bool IsWebDeployment => !string.IsNullOrWhiteSpace(LiveUrl);
        public bool ApplyGltfTextureCompression => Command == BuildCommand.BuildProduction;

        public override string ToString()
        {
            return ObjectNames.NicifyVariableName(Command.ToString());
        }
        
        public static BuildContext LocalDevelopment => new BuildContext(BuildCommand.BuildLocalDev);
        public static BuildContext Development => new BuildContext(BuildCommand.BuildDev);
        /// <summary>
        /// For when a build should only transform html and css etc and not re-export / re-compress
        /// </summary>
        public static BuildContext PrepareDeploy => new BuildContext(BuildCommand.PrepareDeploy);
        public static BuildContext Production => new BuildContext(BuildCommand.BuildProduction);
        public static BuildContext Distribution(bool production)
        {
            return production ? Production : Development;
        }

        public bool IsDistributionBuild => Command == BuildCommand.BuildProduction || Command == BuildCommand.BuildDev;
    }

    public enum BuildCommand
    {
        /// <summary>
        /// Local server update, just updating html, css etc
        /// </summary>
        BuildLocalDev,
        /// <summary>
        /// Distribution without compression
        /// </summary>
        BuildDev,
        /// <summary>
        /// Distribution with compression and optimizations
        /// </summary>
        BuildProduction,
        /// <summary>
        /// TODO document
        /// </summary>
        PrepareDeploy,
    }
}