using System;
using System.Reflection;
using UnityEngine;

namespace Needle.Engine.Core.References.MemberHandlers
{
	public class KeyCodeHandler : ITypeMemberHandler
	{
		public bool ShouldIgnore(Type currentType, MemberInfo member)
		{
			return false;
		}

		public bool ShouldRename(MemberInfo member, out string newName)
		{
			newName = "";
			return false;
		}

		public bool ChangeValue(MemberInfo member, Type type, ref object value, object instance)
		{
			if (value is KeyCode key)
			{
				switch (key)
				{
					case KeyCode.Backspace:
						value = 8;
						break;
					case KeyCode.Tab:
						value = 9;
						break;
					case KeyCode.Return:
						value = 13;
						break;
					case KeyCode.LeftShift:
					case KeyCode.RightShift:
						value = 16;
						break;
					case KeyCode.LeftControl:
					case KeyCode.RightControl:
						value = 17;
						break;
					case KeyCode.AltGr:
					case KeyCode.LeftAlt:
					case KeyCode.RightAlt:
						value = 18;
						break;
					case KeyCode.Pause:
						value = 19;
						break;
					case KeyCode.CapsLock:
						value = 20;
						break;
					case KeyCode.Escape:
						value = 27;
						break;
					case KeyCode.Space:
						value = 32;
						break;
					case KeyCode.PageUp:
						value = 33;
						break;
					case KeyCode.PageDown:
						value = 34;
						break;
					case KeyCode.End:
						value = 35;
						break;
					case KeyCode.Home:
						value = 36;
						break;
					case KeyCode.LeftArrow:
						value = 37;
						break;
					case KeyCode.UpArrow:
						value = 38;
						break;
					case KeyCode.RightArrow:
						value = 39;
						break;
					case KeyCode.DownArrow:
						value = 40;
						break;
					case KeyCode.Insert:
						value = 45;
						break;
					case KeyCode.Delete:
						value = 46;
						break;
					case KeyCode.Alpha0:
						value = 48;
						break;
					case KeyCode.Alpha1:
						value = 49;
						break;
					case KeyCode.Alpha2:
						value = 50;
						break;
					case KeyCode.Alpha3:
						value = 51;
						break;
					case KeyCode.Alpha4:
						value = 52;
						break;
					case KeyCode.Alpha5:
						value = 53;
						break;
					case KeyCode.Alpha6:
						value = 54;
						break;
					case KeyCode.Alpha7:
						value = 55;
						break;
					case KeyCode.Alpha8:
						value = 56;
						break;
					case KeyCode.Alpha9:
						value = 57;
						break;
					case KeyCode.A:
						value = 65;
						break;
					case KeyCode.B:
						value = 66;
						break;
					case KeyCode.C:
						value = 67;
						break;
					case KeyCode.D:
						value = 68;
						break;
					case KeyCode.E:
						value = 69;
						break;
					case KeyCode.F:
						value = 70;
						break;
					case KeyCode.G:
						value = 71;
						break;
					case KeyCode.H:
						value = 72;
						break;
					case KeyCode.I:
						value = 73;
						break;
					case KeyCode.J:
						value = 74;
						break;
					case KeyCode.K:
						value = 75;
						break;
					case KeyCode.L:
						value = 76;
						break;
					case KeyCode.M:
						value = 77;
						break;
					case KeyCode.N:
						value = 78;
						break;
					case KeyCode.O:
						value = 79;
						break;
					case KeyCode.P:
						value = 80;
						break;
					case KeyCode.Q:
						value = 81;
						break;
					case KeyCode.R:
						value = 82;
						break;
					case KeyCode.S:
						value = 83;
						break;
					case KeyCode.T:
						value = 84;
						break;
					case KeyCode.U:
						value = 85;
						break;
					case KeyCode.V:
						value = 86;
						break;
					case KeyCode.W:
						value = 87;
						break;
					case KeyCode.X:
						value = 88;
						break;
					case KeyCode.Y:
						value = 89;
						break;
					case KeyCode.Z:
						value = 90;
						break;

					case KeyCode.None:
						break;
					case KeyCode.Clear:
						break;
					case KeyCode.Keypad0:
						break;
					case KeyCode.Keypad1:
						break;
					case KeyCode.Keypad2:
						break;
					case KeyCode.Keypad3:
						break;
					case KeyCode.Keypad4:
						break;
					case KeyCode.Keypad5:
						break;
					case KeyCode.Keypad6:
						break;
					case KeyCode.Keypad7:
						break;
					case KeyCode.Keypad8:
						break;
					case KeyCode.Keypad9:
						break;
					case KeyCode.KeypadPeriod:
						break;
					case KeyCode.KeypadDivide:
						break;
					case KeyCode.KeypadMultiply:
						break;
					case KeyCode.KeypadMinus:
						break;
					case KeyCode.KeypadPlus:
						break;
					case KeyCode.KeypadEnter:
						break;
					case KeyCode.KeypadEquals:
						break;
					case KeyCode.F1:
						break;
					case KeyCode.F2:
						break;
					case KeyCode.F3:
						break;
					case KeyCode.F4:
						break;
					case KeyCode.F5:
						break;
					case KeyCode.F6:
						break;
					case KeyCode.F7:
						break;
					case KeyCode.F8:
						break;
					case KeyCode.F9:
						break;
					case KeyCode.F10:
						break;
					case KeyCode.F11:
						break;
					case KeyCode.F12:
						break;
					case KeyCode.F13:
						break;
					case KeyCode.F14:
						break;
					case KeyCode.F15:
						break;
					case KeyCode.Exclaim:
						break;
					case KeyCode.DoubleQuote:
						break;
					case KeyCode.Hash:
						break;
					case KeyCode.Dollar:
						break;
					case KeyCode.Percent:
						break;
					case KeyCode.Ampersand:
						break;
					case KeyCode.Quote:
						break;
					case KeyCode.LeftParen:
						break;
					case KeyCode.RightParen:
						break;
					case KeyCode.Asterisk:
						break;
					case KeyCode.Plus:
						break;
					case KeyCode.Comma:
						break;
					case KeyCode.Minus:
						break;
					case KeyCode.Period:
						break;
					case KeyCode.Slash:
						break;
					case KeyCode.Colon:
						break;
					case KeyCode.Semicolon:
						break;
					case KeyCode.Less:
						break;
					case KeyCode.Equals:
						break;
					case KeyCode.Greater:
						break;
					case KeyCode.Question:
						break;
					case KeyCode.At:
						break;
					case KeyCode.LeftBracket:
						break;
					case KeyCode.Backslash:
						break;
					case KeyCode.RightBracket:
						break;
					case KeyCode.Caret:
						break;
					case KeyCode.Underscore:
						break;
					case KeyCode.BackQuote:
						break;
					case KeyCode.LeftCurlyBracket:
						break;
					case KeyCode.Pipe:
						break;
					case KeyCode.RightCurlyBracket:
						break;
					case KeyCode.Tilde:
						break;
					case KeyCode.Numlock:
						break;
					case KeyCode.ScrollLock:
						break;
					case KeyCode.LeftCommand:
						break;
					case KeyCode.LeftWindows:
						break;
					case KeyCode.RightCommand:
						break;
					case KeyCode.RightWindows:
						break;
					case KeyCode.Help:
						break;
					case KeyCode.Print:
						break;
					case KeyCode.SysReq:
						break;
					case KeyCode.Break:
						break;
					case KeyCode.Menu:
						break;
				}
				return true;
			}

			return false;
		}
	}
}