using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace LastSignal
{
    [Flags]
    public enum PadButtons
    {
        None=0,Up=1,Down=2,Left=4,Right=8,Start=16,Back=32,LS=64,RS=128,
        LB=256,RB=512,A=4096,B=8192,X=16384,Y=32768,LT=65536,RT=131072
    }
    public struct PadState
    {
        public bool Connected;
        public string Name;
        public PadButtons Buttons;
        public float LX,LY,RX,RY,LT,RT;
    }
    public partial class Config
    {
        public int PadPreset;
        public float PadSensitivity=1;
        public bool PadInvert;
    }
    public partial class Game
    {
        public bool PadActive,PadConnected,PadSprint,PadCrouch;
        public float PadMoveX,PadMoveY,PadLean;
        public string PadName="";
        internal int PadDeviceEpoch;
    }

    public sealed partial class ArenaPad : IDisposable
    {
        static readonly PadButtons[] buttons={PadButtons.Start,PadButtons.Back,PadButtons.Up,PadButtons.Down,PadButtons.Left,
            PadButtons.Right,PadButtons.A,PadButtons.B,PadButtons.X,PadButtons.Y,PadButtons.LB,PadButtons.RB,PadButtons.LS,PadButtons.RS,PadButtons.LT,PadButtons.RT};
        static readonly string[] actions={"Guard","Attack","Throw","Use","Jump","Dodge","Shove","Cycle","Craft","Build","Pack","Sprint","Crouch","Dismiss"};
        PadButtons previous,blocked;
        bool connected,viewChord,attackHeld,guardHeld,throwHeld,foreground;
        string device="",oldMode,oldPanel,oldBuild;
        float lastLX,lastLY,lastRX,lastRY,repeatIn,discoverIn;
        int oldEpoch;
        bool neutralSticks;
        string repeat="";
        public static string Label(Game g,string action){return Label(g.Settings,action);}
        public static string Label(Config c,string action)
        {
            switch(action)
            {
                case "Forward":case "Back":case "Left":case "Right":case "Move":return "Left stick";
                case "Look":return "Right stick";
                case "Lean left":return "View + D-pad left";case "Lean right":return "View + D-pad right";
                case "Rotate":return "LB / RB";case "Place":return "A / RT";case "Cancel":return "B";
                case "Pause":return "Menu";
            }
            string token=c.PadButton(action);if(token.StartsWith("Back+")){string end=token.Substring(5);return "View + "+(end=="Up"||end=="Down"?"D-pad ":"")+end;}
            switch(token){case "Up":return "D-pad up";case "Down":return "D-pad down";case "Left":return "D-pad left";case "Right":return "D-pad right";
                case "LS":return "L3";case "RS":return "R3";case "Back":return "View";default:return String.IsNullOrEmpty(token)?action:token;}
        }
        static void ClearMotion(Game g)
        {
            g.PadMoveX=g.PadMoveY=g.PadLean=0;g.PadSprint=g.PadCrouch=false;
        }
        public static void KeyboardMouse(Game g)
        {
            if(!g.PadActive)return;
            g.InputUnfocus();ClearMotion(g);g.PadActive=false;g.PadDeviceEpoch++;
        }
        void Interrupt(Game g)
        {
            if(g.PadActive&&(attackHeld||guardHeld||throwHeld))g.InputUnfocus();
            attackHeld=guardHeld=throwHeld=viewChord=false;ClearMotion(g);repeat="";repeatIn=0;
        }
        static void Stick(ref float x,ref float y,float zone)
        {
            float length=(float)Math.Sqrt(x*x+y*y);
            if(length<=zone){x=y=0;return;}
            float amount=Math.Min(1,(length-zone)/(1-zone))/length;x*=amount;y*=amount;
        }
        static float Aim(float v){return v*(.30f+.70f*Math.Abs(v));}
        static void Look(Game g,float x,float y,float dt)
        {
            if(x==0&&y==0)return;
            float gain=Math.Max(.2f,Math.Min(3f,g.Settings.PadSensitivity))/.0024f/Math.Max(.20f,g.Settings.Sensitivity);
            g.Look(Aim(x)*3.35f*gain*dt,Aim(y)*(g.Settings.PadInvert?1:-1)*2.17f*gain*dt);
        }
        static PadButtons Effective(Config c,string action)
        {
            PadButtons token;return Enum.TryParse<PadButtons>(c.PadButton(action),out token)?token:PadButtons.None;
        }
        static bool Has(PadButtons value,PadButtons key){return key!=PadButtons.None&&(value&key)!=0;}
        bool Changed(Game g)
        {
            return g.Mode!=oldMode||g.Panel!=oldPanel||g.BuildId!=oldBuild;
        }
        void Remember(Game g)
        {
            oldMode=g.Mode;oldPanel=g.Panel;oldBuild=g.BuildId;oldEpoch=g.PadDeviceEpoch;
        }
        void Boundary(Game g,PadButtons now)
        {
            Interrupt(g);blocked|=now;neutralSticks=Math.Abs(lastLX)+Math.Abs(lastLY)+Math.Abs(lastRX)+Math.Abs(lastRY)>.055f;Remember(g);
        }
        // Poll only in a foreground game window. On focus changes, held buttons must
        // return to neutral before controlling the new scene.
        public void Poll(Game g,Ui ui,float dt,bool active)
        {
            if(!active)
            {
                if(foreground){Interrupt(g);previous=blocked=0;connected=false;device="";lastLX=lastLY=lastRX=lastRY=0;}
                foreground=false;return;
            }
            foreground=true;discoverIn-=Math.Max(0,dt);
            if(!connected && discoverIn>0)return;
            PadState p=NativeState();
            if(!p.Connected)discoverIn=.62f;
            Frame(g,ui,p,dt);
        }
        public void Frame(Game g,Ui ui,PadState state,float dt)
        {
            dt=Math.Max(0,Math.Min(.10f,dt));
            if(!state.Connected)
            {
                if(connected||g.PadConnected||g.PadActive)Interrupt(g);
                connected=false;g.PadActive=false;g.PadConnected=false;g.PadName="";device="";previous=blocked=0;return;
            }
            g.PadConnected=true;g.PadName=String.IsNullOrEmpty(state.Name)?"Gamepad":state.Name;
            float lx=state.LX,ly=state.LY,rx=state.RX,ry=state.RY;
            Stick(ref lx,ref ly,.19f);Stick(ref rx,ref ry,.16f);
            PadButtons now=state.Buttons;
            if(state.LT>(Has(previous,PadButtons.LT)?.25f:.35f))now|=PadButtons.LT;
            if(state.RT>(Has(previous,PadButtons.RT)?.25f:.35f))now|=PadButtons.RT;
            if(!connected || device!=g.PadName)
            {
                if(connected)Interrupt(g);
                connected=true;device=g.PadName;previous=blocked=now;neutralSticks=Math.Abs(lx)+Math.Abs(ly)+Math.Abs(rx)+Math.Abs(ry)>.055f;
                lastLX=lx;lastLY=ly;lastRX=rx;lastRY=ry;Remember(g);return;
            }
            if(Changed(g))Boundary(g,previous);
            if(oldEpoch!=g.PadDeviceEpoch){Interrupt(g);blocked|=previous;neutralSticks=Math.Abs(lastLX)+Math.Abs(lastLY)+Math.Abs(lastRX)+Math.Abs(lastRY)>.055f;Remember(g);}
            PadButtons oldBlocked=blocked;
            blocked&=now;
            PadButtons down=(now&~previous)&~blocked,up=(previous&~now)&~oldBlocked;
            bool axisChange=Math.Abs(lx-lastLX)+Math.Abs(ly-lastLY)+Math.Abs(rx-lastRX)+Math.Abs(ry-lastRY)>.055f;
            bool stickLive=Math.Abs(lx)+Math.Abs(ly)+Math.Abs(rx)+Math.Abs(ry)>.055f;
            lastLX=lx;lastLY=ly;lastRX=rx;lastRY=ry;previous=now;
            if(!stickLive)neutralSticks=false;
            if(down!=0 || (!neutralSticks&&axisChange&&stickLive))
            {
                if(!g.PadActive){g.InputUnfocus();ClearMotion(g);}
                g.PadActive=true;
            }
            if(!g.PadActive)return;
            if(neutralSticks){lx=ly=rx=ry=0;}
            if(ui.Captures(g)||g.Mode=="spectate")
            {
                g.PadMoveX=g.PadMoveY=g.PadLean=0;
                MenuFrame(g,ui,now&~blocked,down,lx,ly,rx,ry,dt);
            }
            else if(g.Mode=="match")
            {
                if(Has(down,PadButtons.Start)){ui.Pad(g,"Start");}
                else if(!String.IsNullOrEmpty(g.BuildId))
                {
                    g.PadMoveX=lx;g.PadMoveY=ly;g.PadLean=0;Look(g,rx,ry,dt);
                    if(Has(down,PadButtons.B))g.InputCancel();
                    else if(Has(down,PadButtons.A)||Has(down,PadButtons.RT))g.InputPlace(Has(now,PadButtons.LT));
                    else if(Has(down,PadButtons.LB)||Has(down,PadButtons.RB))g.InputRotate(Has(down,PadButtons.LB)?-1:1);
                }
                else
                {
                    g.PadMoveX=lx;g.PadMoveY=ly;Look(g,rx,ry,dt);
                    PlayFrame(g,now&~blocked,down,up);
                }
            }
            if(Changed(g))Boundary(g,now);
        }
        void MenuFrame(Game g,Ui ui,PadButtons held,PadButtons down,float lx,float ly,float rx,float ry,float dt)
        {
            bool capture=ui.PadWaiting(g),radial=g.Panel=="craft"||g.Panel=="build";
            if(ui.PadChordWaiting(g)){
                if(Has(down,PadButtons.Start)){ui.Pad(g,"Start");return;}
                if(Has(held,PadButtons.Back))foreach(PadButtons button in buttons){
                    if(button==PadButtons.Back||!Has(down,button))continue;
                    ui.Pad(g,"Back+"+button);return;
                }
                return;
            }
            if(radial&&!capture){ui.PadWheel(g,lx,ly);Look(g,rx,ry,dt);}
            foreach(PadButtons b in buttons)
            {
                if(!Has(down,b))continue;
                ui.Pad(g,b.ToString());if(Changed(g)||capture||ui.PadWaiting(g))return;
            }
            if(capture)return;
            string dir="";
            if(Has(held,PadButtons.Up))dir="Up";else if(Has(held,PadButtons.Down))dir="Down";
            else if(Has(held,PadButtons.Left))dir="Left";else if(Has(held,PadButtons.Right))dir="Right";
            else if(!radial&&Math.Max(Math.Abs(lx),Math.Abs(ly))>.45f)
                dir=Math.Abs(ly)>Math.Abs(lx)?(ly>0?"Up":"Down"):(lx>0?"Right":"Left");
            if(dir==""){repeat="";repeatIn=0;return;}
            if(dir!=repeat)
            {
                repeat=dir;repeatIn=.39f;
                if(!Has(down,DirButton(dir)))ui.Pad(g,dir);
            }
            else if((repeatIn-=dt)<=0){repeatIn=.14f;ui.Pad(g,dir);}
        }
        static PadButtons DirButton(string dir)
        {
            return dir=="Up"?PadButtons.Up:dir=="Down"?PadButtons.Down:dir=="Left"?PadButtons.Left:PadButtons.Right;
        }
        void SwitchChord(Game g,string action,ref PadButtons down){
            string chord=g.Settings.PadButton(action);PadButtons trigger;
            if(chord.Length<=5||!Enum.TryParse<PadButtons>(chord.Substring(5),out trigger)||!Has(down,trigger))return;
            viewChord=true;down&=~trigger;g.InputPress(action);
        }
        void PlayFrame(Game g,PadButtons held,PadButtons down,PadButtons up)
        {
            if(Has(down,PadButtons.Back))viewChord=false;
            if(Has(held,PadButtons.Back))
            {
                SwitchChord(g,"Previous weapon",ref down);
                SwitchChord(g,"Next weapon",ref down);
                bool left=Has(held,PadButtons.Left),right=Has(held,PadButtons.Right);
                if(left||right)viewChord=true;
                g.PadLean=(right?1:0)-(left?1:0);down&=~(PadButtons.Left|PadButtons.Right);
            }
            else g.PadLean=0;
            if(Has(up,PadButtons.Back)&&!viewChord){g.InputPress("Pack");viewChord=false;if(Changed(g))return;}
            if(guardHeld&&Has(up,Effective(g.Settings,"Guard"))){g.InputRelease("Guard");guardHeld=false;}
            if(attackHeld&&Has(up,Effective(g.Settings,"Attack"))){g.InputRelease("Attack");attackHeld=false;}
            if(throwHeld&&Has(up,Effective(g.Settings,"Throw"))){g.InputRelease("Throw");throwHeld=false;}
            if(down==0)return;
            foreach(string action in actions)
            {
                if(!Has(down,Effective(g.Settings,action)))continue;
                if(action=="Sprint"){g.PadSprint=!g.PadSprint;if(g.PadSprint)g.PadCrouch=false;}
                else if(action=="Crouch"){g.PadCrouch=!g.PadCrouch;if(g.PadCrouch)g.PadSprint=false;}
                else
                {
                    g.InputPress(action);if(action=="Attack")attackHeld=true;else if(action=="Guard")guardHeld=true;else if(action=="Throw")throwHeld=true;
                }
                if(Changed(g))return;
            }
        }
    }
}

namespace LastSignal
{
    public sealed partial class ArenaPad
    {
        [StructLayout(LayoutKind.Sequential)]
        struct XboxGamepad
        {
            public ushort Buttons;public byte LeftTrigger,RightTrigger;
            public short LeftX,LeftY,RightX,RightY;
        }
        [StructLayout(LayoutKind.Sequential)]
        struct XboxState { public uint Packet;public XboxGamepad Pad; }
        [UnmanagedFunctionPointer(CallingConvention.StdCall)]
        delegate uint GetXboxState(uint index,out XboxState value);
        [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]
        static extern IntPtr LoadLibraryW(string fullPath);
        [DllImport("kernel32.dll",CharSet=CharSet.Ansi,ExactSpelling=true)]
        static extern IntPtr GetProcAddress(IntPtr handle,string name);
        [DllImport("kernel32.dll")]
        static extern bool FreeLibrary(IntPtr handle);
        [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]
        struct JoyCaps
        {
            public ushort Manufacturer,Product;
            [MarshalAs(UnmanagedType.ByValTStr,SizeConst=32)] public string Name;
            public uint XMin,XMax,YMin,YMax,ZMin,ZMax,ButtonCount,PeriodMin,PeriodMax;
            public uint RMin,RMax,UMin,UMax,VMin,VMax,Features,MaxAxes,Axes,MaxButtons;
            [MarshalAs(UnmanagedType.ByValTStr,SizeConst=32)]public string Key;
            [MarshalAs(UnmanagedType.ByValTStr,SizeConst=260)]public string Driver;
        }
        [StructLayout(LayoutKind.Sequential)]
        struct JoyInfo
        {
            public uint Size,Flags,X,Y,Z,R,U,V,Buttons,Number,POV,Reserved1,Reserved2;
        }
        [DllImport("winmm.dll")]static extern uint joyGetNumDevs();
        [DllImport("winmm.dll",EntryPoint="joyGetDevCapsW",CharSet=CharSet.Unicode)]
        static extern uint joyGetDevCaps(UIntPtr index,out JoyCaps caps,uint size);
        [DllImport("winmm.dll")]
        static extern uint joyGetPosEx(uint index,ref JoyInfo info);
        bool initialized,disposed;
        IntPtr library;
        GetXboxState readXbox;
        int xboxSlot=-1,legacySlot=-1;
        JoyCaps legacyCaps;
        readonly string[] xboxNames={"XInput controller 1","XInput controller 2","XInput controller 3","XInput controller 4"};
        void OpenXbox()
        {
            initialized=true;
            foreach(string dll in new[]{"xinput1_4.dll","xinput1_3.dll","xinput9_1_0.dll"})
            {
                IntPtr mod=LoadLibraryW(Path.Combine(Environment.SystemDirectory,dll));if(mod==IntPtr.Zero)continue;
                IntPtr proc=GetProcAddress(mod,"XInputGetState");
                if(proc!=IntPtr.Zero)
                {
                    library=mod;readXbox=(GetXboxState)Marshal.GetDelegateForFunctionPointer(proc,typeof(GetXboxState));return;
                }
                FreeLibrary(mod);
            }
        }
        static float Axis(short v){return v<0?v/32768f:v/32767f;}
        PadState Xbox(int index,XboxState native)
        {
            XboxGamepad p=native.Pad;
            return new PadState{Connected=true,Name=xboxNames[index],Buttons=(PadButtons)p.Buttons,LX=Axis(p.LeftX),LY=Axis(p.LeftY),
                RX=Axis(p.RightX),RY=Axis(p.RightY),LT=p.LeftTrigger/255f,RT=p.RightTrigger/255f};
        }
        static float Axis(uint v,uint min,uint max)
        {
            if(min>=max)return 0;
            return Math.Max(-1,Math.Min(1,2*((float)v-min)/(max-min)-1));
        }
        static bool LegacyReport(uint index,out JoyInfo info)
        {
            info=new JoyInfo{Size=(uint)Marshal.SizeOf(typeof(JoyInfo)),Flags=0xFF,POV=65535};
            return joyGetPosEx(index,ref info)==0;
        }
        static readonly PadButtons[] legacyButtons={PadButtons.X,PadButtons.A,PadButtons.B,PadButtons.Y,PadButtons.LB,PadButtons.RB,
            PadButtons.LT,PadButtons.RT,PadButtons.Back,PadButtons.Start,PadButtons.LS,PadButtons.RS};
        static readonly PadButtons[] legacyCompact={PadButtons.A,PadButtons.B,PadButtons.X,PadButtons.Y,PadButtons.LB,PadButtons.RB,
            PadButtons.Back,PadButtons.Start,PadButtons.LS,PadButtons.RS};
        PadState Legacy(JoyInfo p)
        {
            JoyCaps caps=legacyCaps;
            PadState s=new PadState{Connected=true,Name="Windows gamepad "+(legacySlot+1)+(String.IsNullOrWhiteSpace(caps.Name)?"":" · "+caps.Name),
                LX=Axis(p.X,caps.XMin,caps.XMax),LY=-Axis(p.Y,caps.YMin,caps.YMax)};
            // Twelve-button DirectInput layouts expose two trigger buttons; ten-button
            // devices commonly use a centered shared trigger axis. The pack also works on
            // the fixed View button when using a pad without a hat.
            bool full=caps.ButtonCount>=12;
            PadButtons[] map=full?legacyButtons:legacyCompact;
            for(int i=0;i<map.Length;i++)if((p.Buttons&(1u<<i))!=0)s.Buttons|=map[i];
            if((caps.Features&16)!=0&&p.POV<36000)
            {
                int angle=(int)((p.POV+2250)%36000)/4500;
                if(angle==0||angle==1||angle==7)s.Buttons|=PadButtons.Up;
                if(angle>=1&&angle<=3)s.Buttons|=PadButtons.Right;
                if(angle>=3&&angle<=5)s.Buttons|=PadButtons.Down;
                if(angle>=5&&angle<=7)s.Buttons|=PadButtons.Left;
            }
            if(caps.Axes>=4)
            {
                if(!full&&caps.Axes>=5&&(caps.Features&4)!=0)
                {
                    s.RX=Axis(p.R,caps.RMin,caps.RMax);s.RY=-Axis(p.U,caps.UMin,caps.UMax);
                    float both=Axis(p.Z,caps.ZMin,caps.ZMax);s.LT=Math.Max(0,both);s.RT=Math.Max(0,-both);
                }
                else
                {
                    s.RX=Axis(p.Z,caps.ZMin,caps.ZMax);
                    // Sony's HID mapping uses Rz as the second camera axis.
                    bool sony=caps.Manufacturer==0x54c || (caps.Name??"").IndexOf("Wireless Controller",StringComparison.OrdinalIgnoreCase)>=0;
                    s.RY=sony&&(caps.Features&8)!=0?-Axis(p.V,caps.VMin,caps.VMax):-Axis(p.R,caps.RMin,caps.RMax);
                }
            }
            return s;
        }
        PadState NativeState()
        {
            if(disposed)return new PadState();if(!initialized)OpenXbox();
            XboxState x;
            if(xboxSlot>=0 && readXbox!=null && readXbox((uint)xboxSlot,out x)==0)return Xbox(xboxSlot,x);
            xboxSlot=-1;JoyInfo info;
            if(legacySlot>=0 && LegacyReport((uint)legacySlot,out info))return Legacy(info);
            legacySlot=-1;
            if(readXbox!=null)
            {
                int selected=-1;XboxState chosen=new XboxState();
                for(int i=0;i<4;i++)
                {
                    XboxState candidate;if(readXbox((uint)i,out candidate)!=0)continue;
                    if(selected<0||candidate.Pad.Buttons!=0){selected=i;chosen=candidate;}
                    if(candidate.Pad.Buttons!=0)break;
                }
                if(selected>=0){xboxSlot=selected;return Xbox(selected,chosen);}
            }
            uint count=Math.Min(16u,joyGetNumDevs()),size=(uint)Marshal.SizeOf(typeof(JoyCaps));
            for(uint i=0;i<count;i++)
            {
                if(!LegacyReport(i,out info))continue;
                JoyCaps caps;if(joyGetDevCaps(new UIntPtr(i),out caps,size)!=0||caps.Axes<2||caps.ButtonCount<6)continue;
                legacySlot=(int)i;legacyCaps=caps;return Legacy(info);
            }
            return new PadState();
        }
        public void Dispose()
        {
            if(disposed)return;disposed=true;readXbox=null;if(library!=IntPtr.Zero){FreeLibrary(library);library=IntPtr.Zero;}
        }
    }
}

