using System;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.NetworkInformation;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;

namespace Needle.Engine.Utils
{
	public static class WebHelper
	{
		public static async Task<UnityWebRequest> MakeHeaderOnlyRequest(string url, int timeout = 1000, CancellationToken cancel = default)
		{
			var req = new UnityWebRequest(url);
			req.timeout = timeout;
			req.certificateHandler = new AllowAllCertHandler();
			req.SendWebRequest();
			while (!req.isDone && !cancel.IsCancellationRequested) await Task.Delay(30, cancel);
			return req;
		}
		
		public static async Task<bool> IsResponding(string url, CancellationToken cancel = default)
		{
			try
			{
				var req = new UnityWebRequest(url);
				req.timeout = 100;
				req.certificateHandler = new AllowAllCertHandler();
				req.SendWebRequest();
				while (!req.isDone && !cancel.IsCancellationRequested) await Task.Delay(30, cancel);
				// it is responding so at least the website exists
				if (req.responseCode == 404) return true;
				return req.result == UnityWebRequest.Result.Success;
			}
			catch (InvalidOperationException)
			{
				return false;
			}
		}
		
		public static async Task<(bool success, UnityWebRequest.Result result, string error, bool isCertificateError, long code)> IsRespondingWithStatus(string url, CancellationToken cancel = default)
		{
			if (string.IsNullOrWhiteSpace(url)) return (false, UnityWebRequest.Result.ConnectionError, "No url", false, -1);
			var req = new UnityWebRequest(url);
			req.timeout = 100;
			req.certificateHandler = new AllowAllCertHandler();
			req.SendWebRequest();
			while (!req.isDone && !cancel.IsCancellationRequested) await Task.Delay(30, cancel);
			// it is responding so at least the website exists
			var isCertificateError = req.error?.Contains("certificate error") ?? false;
			if (req.responseCode == 404) return (true, UnityWebRequest.Result.Success, req.error, isCertificateError, req.responseCode);
			return (req.result == UnityWebRequest.Result.Success, req.result, req.error, isCertificateError, req.responseCode);
		}

		public class AllowAllCertHandler : CertificateHandler
		{
			protected override bool ValidateCertificate(byte[] certificateData)
			{
				return true;
			}
		}

		// public static async Task<bool> IsRespondingHeaderOnly(string url, CancellationToken token = default)
		// {
		// 	var client = WebRequest.Create(new Uri(url));
		// 	client.Timeout = 1000;
		// 	client.Method = "HEAD";
		// 	var res = await client.GetResponseAsync();
		// 	return res != null;
		// }
		
		public static string GetLocalServerUrl(bool tryGetIp = true, int port = 3000)
		{
			var url = "https://localhost:" + port;
			if (tryGetIp && TryGetIp(out var ip)) url = "https://" + ip + ":" + port;
			return url;
		}
		
		public static bool TryGetIp(out IPAddress address)
		{
			var interfaces = NetworkInterface.GetAllNetworkInterfaces();
			foreach (var ni in interfaces.Where(x => x.OperationalStatus == OperationalStatus.Up))
			{
				var isSuitable = IsSuitableNetworkInterface(ni);
				if (!isSuitable) continue;
				foreach (var ip in ni.GetIPProperties().UnicastAddresses)
				{
					if (ip.Address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
					{
						address = ip.Address;
						return true;
					}
				}
			}

			bool IsSuitableNetworkInterface(NetworkInterface ni)
			{
				// ignore all but Ethernet / Wifi (e.g. Bluetooth)
				if (ni.NetworkInterfaceType != NetworkInterfaceType.Wireless80211 && ni.NetworkInterfaceType != NetworkInterfaceType.Ethernet)
					return false;

				// filter out known virtual adapters (e.g. VMWare)
				if (ni.Name.IndexOf("vEthernet", StringComparison.InvariantCultureIgnoreCase) >= 0 ||
				    ni.Name.IndexOf("VMware", StringComparison.InvariantCultureIgnoreCase) >= 0)
					return false;

				var hasInterNetworkAddress = ni
					.GetIPProperties()
					.UnicastAddresses
					.Any(ip => ip.Address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork);

				return hasInterNetworkAddress;
			}

			address = null;
			return false;
		}
	}
}