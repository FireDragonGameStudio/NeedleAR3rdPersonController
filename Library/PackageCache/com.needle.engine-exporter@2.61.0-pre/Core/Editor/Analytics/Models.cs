using System;
using Needle.Engine.Utils;
using UnityEditor;
using UnityEngine;

namespace Needle.Engine
{
	internal class UserEditorModel
	{
		public string editorVersion;
		public bool isPro;
		public string userId;
		public string userName;
		public string organization;

		public UserEditorModel()
		{
			editorVersion = Application.unityVersion;
			isPro = Application.HasProLicense();
			userName = CloudProjectSettings.userName;
			userId = GuidGenerator.GetGuid(userName);
			organization = CloudProjectSettings.organizationId;
		}
	}

	internal class UserCreatedProjectFromTemplateModel : UserEditorModel
	{
		public string projectName;
		public string templateName;

		public UserCreatedProjectFromTemplateModel(string projectName, string templateName)
		{
			this.projectName = projectName;
			this.templateName = templateName;
		}

		internal static string AnonymizeProjectName(string name)
		{
			var unityProjectNameIndex = name.LastIndexOf(Application.productName, StringComparison.OrdinalIgnoreCase);
			if (unityProjectNameIndex > 0)
			{
				return name.Substring(unityProjectNameIndex);
			}
			return name;
		}
	}
}