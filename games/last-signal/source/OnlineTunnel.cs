using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using System.Threading;

namespace LastSignal
{
    // One host owns one temporary tunnel and only terminates its own process.
    public sealed class OnlineTunnel : IDisposable
    {
        const string ExpectedDigest = "D5C1D82031DA6253DCDCFF64C944CD0FE063016EDEB2E4FD088075FC9BD52D0A";
        static readonly Regex TunnelAddress = new Regex(@"https://[a-z0-9-]+\.trycloudflare\.com\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        readonly object gate = new object();
        volatile bool closed, started, failed;
        volatile string origin, candidate, problem, status = "Internet hosting is idle.";
        Process child;
        public string PublicOrigin { get { return origin; } }
        public string Status { get { return status; } }
        public bool Failed { get { return failed; } }

        public void Start(int loopbackPort, string instanceId)
        {
            if (loopbackPort < 1 || loopbackPort > 65535 || string.IsNullOrEmpty(instanceId))
                throw new ArgumentException("Missing local room address.");
            lock (gate)
            {
                if (closed || started) throw new InvalidOperationException("This tunnel already started or closed.");
                started = true;
                status = "Opening the Cloudflare connection…";
            }
            var worker = new Thread(delegate() { Run(loopbackPort, instanceId); });
            worker.IsBackground = true;
            worker.Name = "Last Signal internet host";
            worker.Start();
        }

        static string FindComponent()
        {
            string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string[] paths = {
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Hosting", "cloudflared.exe"),
                Path.Combine(local, "Programs", "Bannerlands", "runtime", "cloudflared.exe")
            };
            foreach (string path in paths)
            {
                if (!File.Exists(path)) continue;
                using (var stream = File.OpenRead(path))
                using (var sha = SHA256.Create())
                    if (BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", "") == ExpectedDigest) return path;
            }
            throw new InvalidOperationException("The internet hosting component is missing or damaged. Extract the full game ZIP or repair the game pack.");
        }

        void Output(object sender, DataReceivedEventArgs evt)
        {
            if (closed || evt.Data == null) return;
            if (evt.Data.IndexOf("no such host",StringComparison.OrdinalIgnoreCase)>=0)
                problem="Cloudflare's host name could not be resolved. Check this computer's internet connection and DNS, then retry hosting.";
            if (candidate != null) return;
            var match = TunnelAddress.Match(evt.Data);
            if (match.Success) candidate = match.Value.ToLowerInvariant();
        }

        static bool Probe(string address, string identity, int timeout)
        {
            // Framework-built executables may inherit the legacy TLS default.
            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
            var req = (HttpWebRequest)WebRequest.Create(address + "/health");
            req.Timeout = timeout;
            req.ReadWriteTimeout = timeout;
            req.AllowAutoRedirect = false;
            req.KeepAlive = false;
            req.ProtocolVersion = HttpVersion.Version11;
            using (var response = (HttpWebResponse)req.GetResponse())
            using (var reader = new StreamReader(response.GetResponseStream()))
            {
                if (response.StatusCode != HttpStatusCode.OK) return false;
                string expected = "LastSignal-1:" + identity;
                char[] buffer = new char[expected.Length + 1];
                return reader.ReadBlock(buffer, 0, buffer.Length) == expected.Length &&
                       new string(buffer, 0, expected.Length) == expected;
            }
        }

        void Run(int port, string instanceId)
        {
            Process process = null;
            try
            {
                string exe = FindComponent();
                var settings = new ProcessStartInfo(exe, "tunnel --url http://127.0.0.1:" + port + " --no-autoupdate --protocol http2");
                settings.CreateNoWindow = true;
                settings.UseShellExecute = false;
                settings.RedirectStandardOutput = true;
                settings.RedirectStandardError = true;
                process = new Process { StartInfo = settings };
                process.OutputDataReceived += Output;
                process.ErrorDataReceived += Output;
                lock (gate)
                {
                    if (closed) return;
                    process.Start();
                    child = process;
                }
                process.BeginOutputReadLine();
                process.BeginErrorReadLine();
                var elapsed = Stopwatch.StartNew();
                const int limit = 90000;
                while (!closed && elapsed.ElapsedMilliseconds < limit && !process.HasExited)
                {
                    string address = candidate;
                    if (address != null)
                    {
                        status = "Checking that guests can reach the arena…";
                        try
                        {
                            int timeout = (int)Math.Max(1L, Math.Min(3500L, limit - elapsed.ElapsedMilliseconds));
                            if (Probe(address, instanceId, timeout))
                            {
                                lock (gate)
                                {
                                    if (closed) return;
                                    status = "Internet invitation ready.";
                                    origin = address;
                                }
                                process.WaitForExit();
                                break;
                            }
                        }
                        catch (WebException) {}
                        catch (IOException) {}
                    }
                    Thread.Sleep(address == null ? 100 : 350);
                }
                if (!closed) throw new InvalidOperationException(origin != null
                    ? "The public tunnel closed. Reopen hosting for a new invitation."
                    : problem ?? "Cloudflare could not reach this room. Check the internet connection and retry hosting.");
            }
            catch (Exception error)
            {
                lock (gate) if (!closed) { failed = true; status = error.Message; }
            }
            finally
            {
                lock (gate) { origin = null; if (child == process) child = null; }
                Stop(process);
                if (process != null) process.Dispose();
            }
        }

        static void Stop(Process process)
        {
            if (process == null) return;
            try { if (!process.HasExited) process.Kill(); }
            catch (InvalidOperationException) {}
            catch (System.ComponentModel.Win32Exception) {}
        }

        public void Dispose()
        {
            lock (gate)
            {
                if (closed) return;
                closed = true;
                origin = null;
                status = "Hosting connection closed.";
                Stop(child);
            }
        }
    }
}
