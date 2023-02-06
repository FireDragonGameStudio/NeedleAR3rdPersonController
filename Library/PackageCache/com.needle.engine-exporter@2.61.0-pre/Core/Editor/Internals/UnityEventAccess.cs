#nullable enable

using System.Collections.Generic;
using UnityEngine.Events;
using Object = UnityEngine.Object;


// ReSharper disable once CheckNamespace
namespace Needle.Engine
{
    
    public static class UnityEventAccess
    {
        // private static UnityEngine.Events.PersistentCallGroup cache;

        public static IEnumerable<(Object target, string methodName, object? argument, UnityEventCallState state)> EnumerateCalls(object _callGroup)
        {
            var group = (PersistentCallGroup)_callGroup;
            foreach (var m in group.GetListeners())
            {
                var info = (m.target, m.methodName, Argument:default(object), m.callState);
                var args = m.arguments;
                switch (m.mode)
                {
                    case PersistentListenerMode.EventDefined:
                        break;
                    case PersistentListenerMode.Void:
                        break;
                    case PersistentListenerMode.Object:
                        info.Argument = args.unityObjectArgument;
                        break;
                    case PersistentListenerMode.Int:
                        info.Argument = args.intArgument;
                        break;
                    case PersistentListenerMode.Float:
                        info.Argument = args.floatArgument;
                        break;
                    case PersistentListenerMode.String:
                        info.Argument = args.stringArgument;
                        break;
                    case PersistentListenerMode.Bool:
                        info.Argument = args.boolArgument;
                        break;
                }
                // var type = System.Type.GetType(args.unityObjectArgumentAssemblyTypeName, false);
                // Debug.Log(args.unityObjectArgumentAssemblyTypeName);
                // switch (type)
                // {
                //     
                // }
                yield return info;
            }
        }
    }
}
