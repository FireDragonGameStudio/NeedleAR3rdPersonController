using System;
using UnityEngine;

namespace Needle.Engine.Core.References
{
    public interface ITypeMemberRegisterHandler
    {
        bool TryRegister(ReferenceRegistry reg, ReferenceCollection collection, string path, Component instance, Type type);
    }
}
