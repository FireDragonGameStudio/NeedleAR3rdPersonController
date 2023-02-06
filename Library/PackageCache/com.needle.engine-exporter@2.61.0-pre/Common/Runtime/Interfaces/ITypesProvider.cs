using System.Collections.Generic;

namespace Needle.Engine
{
	public interface ITypesProvider
	{
		void AddImports(List<ImportInfo> imports, IProjectInfo ctx);
	}
}