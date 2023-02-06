using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Needle.Engine.Core.Converters;
using UnityEngine;

namespace Needle.Engine.Core.References.ReferenceResolvers
{
	public class ParticleSystemModules : IReferenceResolver
	{
		private readonly IJavascriptConverter converter = JsConverter.CreateDefault();

		private readonly List<(Type type, string name)> names = new List<(Type type, string name)>()
		{
			(typeof(ParticleSystem.MainModule), "main"),
			(typeof(ParticleSystem.EmissionModule), "emit"),
		};

		public bool TryResolve(ReferenceResolver resolver, ReferenceCollection references, string path, object value, out string result)
		{
			if (value == null)
			{
				result = null;
				return false;
			}

			var type = value.GetType();
			if (type.DeclaringType == typeof(ParticleSystem))
			{
				// if(value is ParticleSystem.ShapeModule sm) Debug.Log(sm.shapeType + " = " + (int)sm.shapeType);
				
				var match = names.FirstOrDefault(e => e.type == type);
				if (match.name != null)
				{
					return Resolve(match.name, out result);
				}
				if (type.Name.EndsWith("Module"))
				{
					var name = type.Name.ToJsVariable();
					return Resolve(name, out result);
				}

				bool Resolve(string name, out string res)
				{
					var mainModulePath = $"{path}_{name}";
					if (TryWriteModule(resolver.CurrentWriter as ICodeWriter, mainModulePath, value))
					{
						res = mainModulePath;
						return true;
					}
					res = default;
					return false;
				}
			}


			result = null;
			return false;
		}

		private bool TryWriteModule(ICodeWriter writer, string path, object module)
		{
			writer.Write($"const {path} = {{");
			writer.Indentation += 1;
			var props = module.GetType()
				.GetProperties(BindingFlags.Instance | BindingFlags.Public | BindingFlags.Default);
			foreach (var member in props)
			{
				if (!member.CanRead) continue;
				try
				{
					var val = member.GetValue(module);
					var name = member.Name.ToJsVariable();
					if (converter.TryConvertToJs(val, out var res))
					{
						writer.Write($"{name} : {res},");
						continue;
					}

					if (val is ParticleSystem.MinMaxCurve minMax)
					{
						switch (minMax.mode)
						{
							case ParticleSystemCurveMode.Constant:
								writer.Write($"{name} : {minMax.constant},");
								continue;
							case ParticleSystemCurveMode.TwoConstants:
								writer.Write($"{name} : new THREE.Vector2({minMax.constantMin}, {minMax.constantMax}),");
								continue;
							default:
								writer.Write($"{name} : undefined, // {member.PropertyType} mode {minMax.mode.ToString()} not supported");
								continue;
						}
					}
					if (val is ParticleSystem.MinMaxGradient gradient)
					{
						// Debug.Log(gradient);
						switch (gradient.mode)
						{
							case ParticleSystemGradientMode.Color:
								writer.Write($"{name} : new THREE.Color({gradient.color.r}, {gradient.color.g}, {gradient.color.b}),");
								continue;
							case ParticleSystemGradientMode.TwoColors:
								writer.Write($"{name} : new THREE.Color({gradient.colorMax.r}, {gradient.colorMax.g}, {gradient.colorMax.b}),");
								writer.Write($"{name}1 : new THREE.Color({gradient.colorMin.r}, {gradient.colorMin.g}, {gradient.colorMin.b}),");
								continue;
							default:
								writer.Write($"{name} : undefined, // {member.PropertyType} mode {gradient.mode.ToString()} not supported");
								continue;
						}
					}
					
					writer.Write($"{name} : undefined, // {member.PropertyType}");
				}
				catch (TargetInvocationException ex)
				{
					if (ex.InnerException is NotImplementedException) continue;
					throw;
				}
			}
			writer.Indentation -= 1;
			writer.Write("}");
			return true;
		}
	}
}