using System.Threading.Tasks;
using JetBrains.Annotations;
using Needle.Engine.Utils;

namespace Needle.Engine.Problems
{
	public class OldGltfPackScript : PackageJsonProblem
	{
		public const string newGltfPackCommand = "npm run pack-gltf --prefix node_modules/@needle-tools/engine";
		
		public OldGltfPackScript(string packageJsonPath, string field, string key, string value) 
			: base(packageJsonPath, field, key, value, 
				"Package is using old gltf-pack command", new UpdateGltfPack(packageJsonPath, field, key))
		{
			// cd node_modules/@needle-tools/engine && npm run pack-gltf
		}
		

		private class UpdateGltfPack : IProblemFix
		{
			private readonly string packageJsonPath;
			private readonly string field;
			private readonly string key;

			public UpdateGltfPack(string packageJsonPath, string field, string key)
			{
				this.packageJsonPath = packageJsonPath;
				this.field = field;
				this.key = key;
			}

			public string Suggestion { get; } = "Click button below";
			
			public async Task<ProblemFixResult> Run(ProblemContext context)
			{
				if (PackageUtils.TryReadBlock(packageJsonPath, field, out var dict))
				{
					dict[key] = newGltfPackCommand;
					if (PackageUtils.TryWriteBlock(packageJsonPath, field, dict))
					{
						return new ProblemFixResult(true, "Updated gltf-pack command");
					}
				}

				await Task.Yield();
				return new ProblemFixResult(true, "Failed updating gltf-pack command");
			}
		}
	}
}