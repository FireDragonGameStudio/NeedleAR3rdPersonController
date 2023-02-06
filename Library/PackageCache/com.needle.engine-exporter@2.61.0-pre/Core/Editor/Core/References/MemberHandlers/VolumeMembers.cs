#if SRP_INSTALLED
using System;
using System.Linq;
using System.Reflection;
using JetBrains.Annotations;
using UnityEngine.Rendering;

namespace Needle.Engine.Core.References.MemberHandlers
{
    [UsedImplicitly]
    public class VolumeMembers : ITypeMemberHandler
    {
        public static readonly string[] excludeMembers = new string[]
        {
            "profile", // excluded because accessing it instantiates the asset
        };
        
        public bool ShouldRename(MemberInfo member, out string newName)
        {
            newName = null;
            return false;
        }

        public bool ChangeValue(MemberInfo member, Type type, ref object value, object instance)
        {
            return false;
        }

        public bool ShouldIgnore(Type currentType, MemberInfo member)
        {
            if (typeof(Volume).IsAssignableFrom(currentType))
            {
                if (excludeMembers.Contains(member.Name))
                    return true;
            }

            return false;
        }
    }
}
#endif