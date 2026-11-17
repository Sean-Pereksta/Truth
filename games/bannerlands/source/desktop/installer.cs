using System;
using System.IO;
using System.Reflection;
using System.Diagnostics;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.Drawing;

internal static class BannerlandsSetup {
    [STAThread] private static void Main(string[] arguments) {
        // Review/CI can inspect the exact embedded payload without installing
        // or changing the desktop, registry, or Start menu.
        if (arguments.Length == 2 && arguments[0] == "/extract") {
            Directory.CreateDirectory(arguments[1]);
            Extract(arguments[1], "payload.zip"); Extract(arguments[1], "install.ps1");
            return;
        }
        Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new SetupWindow());
    }
    internal static void Extract(string directory, string name) {
        using (Stream input = Assembly.GetExecutingAssembly().GetManifestResourceStream("Bannerlands." + name))
        using (FileStream output = File.Create(Path.Combine(directory, name))) { input.CopyTo(output); }
    }
}

internal sealed class SetupWindow : Form {
    private readonly Label message = new Label();
    private readonly Button install = new Button();
    private readonly Button cancel = new Button();
    private readonly ProgressBar progress = new ProgressBar();
    internal SetupWindow() {
        Text = "Install Bannerlands"; ClientSize = new Size(490, 205);
        FormBorderStyle = FormBorderStyle.FixedDialog; MaximizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        message.SetBounds(24, 22, 442, 95);
        message.Text = "Install Bannerlands Multiplayer Preview for Windows.\n\nThe complete game, hosting runtime and temporary connection software are included. A desktop icon and Start menu shortcuts will be created.";
        progress.SetBounds(24, 124, 442, 18); progress.Visible = false;
        install.Text = "Install"; install.SetBounds(280, 160, 88, 28);
        cancel.Text = "Cancel"; cancel.SetBounds(378, 160, 88, 28); cancel.Click += delegate { Close(); };
        install.Click += async delegate { await Install(); };
        Controls.AddRange(new Control[] { message, progress, install, cancel });
        AcceptButton = install; CancelButton = cancel;
    }
    private async Task Install() {
        install.Enabled = false; cancel.Enabled = false; ControlBox = false;
        progress.Visible = true; progress.Style = ProgressBarStyle.Marquee;
        message.Text = "Installing Bannerlands…\n\nVerifying and copying the complete game. This can take a minute. Keep this window open.";
        string staging = Path.Combine(Path.GetTempPath(), "BannerlandsInstaller-" + Guid.NewGuid().ToString("N"));
        try {
            await Task.Run(delegate {
                Directory.CreateDirectory(staging);
                BannerlandsSetup.Extract(staging, "payload.zip"); BannerlandsSetup.Extract(staging, "install.ps1");
                ProcessStartInfo start = new ProcessStartInfo("powershell.exe", "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"" + Path.Combine(staging, "install.ps1") + "\" -Quiet");
                start.UseShellExecute = false; start.CreateNoWindow = true;
                start.RedirectStandardError = true;
                using (Process process = Process.Start(start)) {
                    string error = process.StandardError.ReadToEnd(); process.WaitForExit();
                    if (process.ExitCode != 0) throw new Exception(error.Length > 600 ? error.Substring(0, 600) : error);
                }
            });
            MessageBox.Show(this, "Bannerlands is installed. Open the new desktop icon or find Bannerlands in the Start menu.", "Bannerlands", MessageBoxButtons.OK, MessageBoxIcon.Information);
            Close();
        } catch (Exception error) {
            message.Text = "Installation could not finish. Close any running Bannerlands game, then try again.\n\n" + error.Message;
            install.Text = "Retry"; install.Enabled = true; cancel.Enabled = true; ControlBox = true; progress.Visible = false;
        } finally {
            string verified = Path.GetFullPath(staging);
            if (verified.StartsWith(Path.GetFullPath(Path.GetTempPath()), StringComparison.OrdinalIgnoreCase) && Path.GetFileName(verified).StartsWith("BannerlandsInstaller-")) {
                try { Directory.Delete(verified, true); } catch { }
            }
        }
    }
}
