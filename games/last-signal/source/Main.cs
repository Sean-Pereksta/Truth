using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
[assembly:AssemblyTitle("Last Signal")]
[assembly:AssemblyProduct("Last Signal")]
[assembly:AssemblyDescription("First-person survival arena with solo and hosted multiplayer")]
[assembly:AssemblyVersion("1.5.0.0")]
[assembly:AssemblyFileVersion("1.5.0.0")]
namespace LastSignal {
    sealed class ArenaWindow : Form {
        readonly Ui ui; readonly Game game; bool locked,active;Point lastPointer;bool pointerSeen;
        public bool InputActive {get{return active&&!game.Quit&&WindowState!=FormWindowState.Minimized;}}
        Keys MouseKey(MouseButtons b){return b==MouseButtons.Left?Keys.LButton:b==MouseButtons.Right?Keys.RButton:b==MouseButtons.Middle?Keys.MButton:b==MouseButtons.XButton1?Keys.XButton1:Keys.XButton2;}
        public ArenaWindow(Game g,Ui u){
            game=g;ui=u;Text="Last Signal";BackColor=Color.FromArgb(17,25,23);StartPosition=FormStartPosition.CenterScreen;KeyPreview=true;
            Rectangle r=Screen.PrimaryScreen.WorkingArea;
            ClientSize=new Size(Math.Min(1280,(int)(r.Width*.91)),Math.Min(760,(int)(r.Height*.86)));
            MinimumSize=new Size(700,480);SetStyle(ControlStyles.UserPaint|ControlStyles.AllPaintingInWmPaint|ControlStyles.Opaque,true);
            Icon=Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            Activated+=(s,e)=>{active=true;};
            Deactivate+=(s,e)=>{active=false;Unlock();game.InputUnfocus();if(game.Mode=="match"&&game.Panel=="")game.Panel="pause";};
            FormClosing+=(s,e)=>{Unlock();game.Quit=true;};
            KeyDown+=(s,e)=>{HandleDown(e.KeyCode);e.SuppressKeyPress=true;e.Handled=true;};
            KeyUp+=(s,e)=>{HandleUp(e.KeyCode);e.SuppressKeyPress=true;e.Handled=true;};
            MouseMove+=(s,e)=>{if(!locked){
                Point pos=PointToScreen(new Point(e.X,e.Y));
                if(active&&pointerSeen&&(Math.Abs(pos.X-lastPointer.X)+Math.Abs(pos.Y-lastPointer.Y)>3))ArenaPad.KeyboardMouse(game);
                lastPointer=pos;pointerSeen=true;if(!game.PadActive)ui.MouseMove(e.X,e.Y);
            }};
            MouseDown+=(s,e)=>{
                ArenaPad.KeyboardMouse(game);
                if(ui.Captures(game)){string before=game.Mode;ui.Click(game,e.X,e.Y,e.Button);if(before!=game.Mode||game.Panel=="")game.Unfocus();}
                else HandleDown(MouseKey(e.Button));
            };
            MouseUp+=(s,e)=>{if(e.Button==MouseButtons.Right)ui.EndLook();HandleUp(MouseKey(e.Button));};
            MouseWheel+=(s,e)=>{ArenaPad.KeyboardMouse(game);if(!ui.Scroll(game,e.Delta)&&game.CanAct){
                int direction=e.Delta>0?-1:1;
                if(!String.IsNullOrEmpty(game.BuildId))game.InputRotate(-direction);
                else if(game.FocusOptions.Count>1)game.InputCycle(-direction);
                else game.InputWeapon(direction);
            }};
        }
        protected override CreateParams CreateParams{get{var p=base.CreateParams;p.ClassStyle|=0x20;return p;}}
        protected override bool IsInputKey(Keys keyData){return true;}
        protected override void OnPaintBackground(PaintEventArgs e){}
        protected override void OnPaint(PaintEventArgs e){}
        void HandleDown(Keys k){
            ArenaPad.KeyboardMouse(game);
            if(game.Held.Contains(k))return;
            if(ui.Captures(game)||k==Keys.Escape||game.Mode=="spectate"){
                if(ui.Key(game,k)){game.Unfocus();game.Held.Add(k);return;}
            }
            game.Held.Add(k);
            foreach(var pair in game.Settings.KeysMap)if(pair.Value==k){game.InputPress(pair.Key);break;}
        }
        void HandleUp(Keys k){if(!game.Held.Remove(k))return;foreach(var pair in game.Settings.KeysMap)if(pair.Value==k){game.InputRelease(pair.Key);break;}}
        void Unlock(){if(locked){locked=false;Cursor.Clip=Rectangle.Empty;Cursor.Show();lastPointer=Cursor.Position;pointerSeen=true;}}
        public void PollMouse(){
            bool want=active&&!game.Quit&&!game.PadActive&&game.Mode=="match"&&(game.Panel==""||ui.Looking)&&WindowState!=FormWindowState.Minimized;
            if(!want){Unlock();return;}
            Point center=PointToScreen(new Point(ClientSize.Width/2,ClientSize.Height/2));
            if(!locked){locked=true;Cursor.Clip=RectangleToScreen(ClientRectangle);Cursor.Position=center;Cursor.Hide();return;}
            Point at=Cursor.Position;if(at!=center){game.Look(at.X-center.X,at.Y-center.Y);Cursor.Position=center;}
        }
    }
    static class Program {
        [DllImport("user32.dll")]static extern bool SetProcessDPIAware();
        [STAThread] static int Main(string[] args){
            bool diag=args.Length>0&&(args[0]=="--check"||args[0]=="--capture"||args[0]=="--simulate");
            try{
                SetProcessDPIAware();Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
                if(diag)return Checks.Run(args);
                var game=new Game();Ui.Load(game.Settings);game.Menu();
                using(var online=new OnlineSession(game))using(var ui=new Ui())using(var w=new ArenaWindow(game,ui)){
                    game.Online=online;
                    if(args.Length>0){
                        if(args[0]=="--host")online.Host(Ui.OnlinePlayerName(game));
                        else if(args[0]=="--join"&&args.Length>1)online.Join(args[1],Ui.OnlinePlayerName(game));
                        else if(args[0]=="--multiplayer")game.Panel="multiplayer";
                    }
                    w.Show();w.Update();
                    using(var renderer=new Renderer(w.Handle))using(var audio=new ArenaAudio())using(var pad=new ArenaPad()){
                        game.Audio=audio.Cue;var sw=Stopwatch.StartNew();double prev=sw.Elapsed.TotalSeconds,acc=0;
                        double nextTitle=0;
                        while(!game.Quit&&!w.IsDisposed){
                            Application.DoEvents();if(game.Quit||w.IsDisposed)break;
                            double now=sw.Elapsed.TotalSeconds;double dt=Math.Min(.35,now-prev);prev=now;
                            pad.Poll(game,ui,(float)dt,w.InputActive);w.PollMouse();
                            bool minimized=w.WindowState==FormWindowState.Minimized;
                            bool onlineActive=online.Phase!="idle"&&online.Phase!="error";
                            if(minimized&&!onlineActive){Thread.Sleep(35);continue;}
                            acc+=dt;while(acc>=1d/30){if(!online.Pump(1f/30))game.Tick(1f/30);acc-=1d/30;}
                            if(minimized){Thread.Sleep(12);continue;}
                            audio.Environment(game);audio.Pump();
                            if(now>=nextTitle){
                                string state=game.Panel!=""?System.Globalization.CultureInfo.InvariantCulture.TextInfo.ToTitleCase(game.Panel):
                                    game.Mode=="menu"?"Main Menu":game.Mode=="results"?"Match Complete":game.Mode=="dead"?"Eliminated":
                                    (game.Mode=="spectate"?"Spectating":"Arena")+"  |  "+game.AliveCount+" alive";
                                string caption="Last Signal  -  "+state;if(w.Text!=caption)w.Text=caption;nextTitle=now+.3;
                            }
                            int width=w.ClientSize.Width,height=w.ClientSize.Height;
                            if(width>0&&height>0){renderer.Draw(game,width,height);renderer.Overlay(ui.Paint(game,width,height));renderer.Present();}
                            double spare=.0165-(sw.Elapsed.TotalSeconds-now);if(spare>.001)Thread.Sleep((int)(spare*1000));
                        }
                    }
                }
                return 0;
            }catch(Exception ex){
                string message="Last Signal could not continue.\r\n\r\n"+ex.Message;
                try{string folder=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"LastSignal");Directory.CreateDirectory(folder);File.WriteAllText(Path.Combine(folder,"last-error.txt"),ex.ToString());}catch{}
                if(diag){if(args.Length>1)try{File.WriteAllText(args[1]+".error.txt",ex.ToString());}catch{}}
                else MessageBox.Show(message,"Last Signal",MessageBoxButtons.OK,MessageBoxIcon.Error);return 1;
            }
        }
    }
}
