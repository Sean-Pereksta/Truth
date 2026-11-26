using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.Globalization;
using System.IO;
using System.Windows.Forms;

namespace LastSignal {
    public sealed partial class Ui : IDisposable {
        static readonly Color Ivory=Color.FromArgb(242,238,217), Muted=Color.FromArgb(174,184,164), Gold=Color.FromArgb(232,184,100), Brass=Color.FromArgb(151,122,76), Ink=Color.FromArgb(13,22,22), Moss=Color.FromArgb(103,167,139), Rust=Color.FromArgb(225,122,101);
        readonly Dictionary<string,Font> fonts=new Dictionary<string,Font>();
        readonly Dictionary<string,Image> icons=new Dictionary<string,Image>();
        readonly List<Hit> hits=new List<Hit>();
        Bitmap image; Graphics pen; float sw=1280,sh=720,scale=1,fx=1,fy=1; int mx=-100,my=-100;
        string route="",selected="",bind="",backPanel=""; bool hoverMoved; int packOffset;
        readonly string[] bindings={"Forward","Back","Left","Right","Sprint","Crouch","Jump","Use","Dodge","Shove","Craft","Build","Pack","Rotate","Cycle","Dismiss","Lean left","Lean right","Attack","Guard","Throw","Previous weapon","Next weapon","Weapon 1","Weapon 2","Weapon 3","Weapon 4","Weapon 5","Weapon 6","Weapon 7"};
        class Hit { public RectangleF Rect; public string Id; public bool Nav; }
        internal static string SettingsOverride=null;
        static string PortableSettings {get{return Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"settings.txt");}}
        static string LocalSettings {
            get {
                string profile=Environment.GetEnvironmentVariable("LOCALAPPDATA");
                if(string.IsNullOrEmpty(profile)||!Path.IsPathRooted(profile))profile=Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                return Path.Combine(profile,"LastSignal","settings.txt");
            }
        }
        static string[] ReadSettings(){
            if(SettingsOverride!=null)return File.Exists(SettingsOverride)?File.ReadAllLines(SettingsOverride):new string[0];
            string portable=PortableSettings,local=LocalSettings;
            if(File.Exists(portable)){
                // A protected installation may ship defaults while retaining new settings in the profile.
                try{using(File.Open(portable,FileMode.Open,FileAccess.ReadWrite,FileShare.ReadWrite)){}return File.ReadAllLines(portable);}
                catch(UnauthorizedAccessException){}catch(IOException){}
                if(!File.Exists(local))return File.ReadAllLines(portable);
            }
            return File.Exists(local)?File.ReadAllLines(local):new string[0];
        }
        static bool WriteSettings(string target,string[] lines){
            string folder=Path.GetDirectoryName(Path.GetFullPath(target)),temp=null;
            try{
                if(File.Exists(target)&&(File.GetAttributes(target)&FileAttributes.ReadOnly)!=0)return false;
                Directory.CreateDirectory(folder);
                temp=Path.Combine(folder,".settings-"+Guid.NewGuid().ToString("N")+".tmp");
                File.WriteAllLines(temp,lines);
                if(File.Exists(target))File.Replace(temp,target,null);
                else {
                    try{File.Move(temp,target);}
                    catch(IOException){if(!File.Exists(target))throw;File.Replace(temp,target,null);}
                }
                return true;
            }catch(IOException){return false;}catch(UnauthorizedAccessException){return false;}
            finally{if(temp!=null&&File.Exists(temp))try{File.Delete(temp);}catch(IOException){}catch(UnauthorizedAccessException){}}
        }
        public static void Load(Config c) {
            try {
                string[] saved=ReadSettings();if(saved.Length==0)return;
                var padKeys=new List<KeyValuePair<string,string>>();
                foreach(string line in saved) {
                    int eq=line.IndexOf('='); if(eq<1)continue;
                    string k=line.Substring(0,eq),v=line.Substring(eq+1);float f;int i;
                    if(k=="online.name")c.OnlineName=PlayerName(v);
                    if(k.StartsWith("pad."))padKeys.Add(new KeyValuePair<string,string>(k.Substring(4),v));
                    if(k.StartsWith("key.")&&c.KeysMap.ContainsKey(k.Substring(4))&&int.TryParse(v,out i)&&i>0&&i<256)AssignKey(c,k.Substring(4),(Keys)i);
                    if(!float.TryParse(v,NumberStyles.Float,CultureInfo.InvariantCulture,out f)||float.IsNaN(f)||float.IsInfinity(f))continue;
                    if(k=="fov")c.Fov=Clamp(f,55,105); if(k=="bob")c.Bob=Clamp(f,0,1); if(k=="sensitivity")c.Sensitivity=Clamp(f,.2f,3);
                    if(k=="padpreset")c.SetPadPreset((int)f);if(k=="padsens")c.PadSensitivity=Clamp(f,.25f,3f);if(k=="padinvert")c.PadInvert=f!=0;
                    if(k=="arena")c.ArenaId=(int)Clamp(f,0,2);if(k=="bots")c.Bots=(int)Clamp(f,1,23);if(k=="difficulty")c.Difficulty=(int)Clamp(f,0,3);if(k=="hunger")c.Hunger=(int)Clamp(f,0,2);if(k=="events")c.Events=f!=0;
                }
                foreach(var mapping in padKeys)c.SetPadBinding(mapping.Key,mapping.Value);
            }catch(IOException){}catch(UnauthorizedAccessException){}
        }
        public static void Save(Config c) {
            try {
                var lines=new List<string>(); foreach(var kv in c.KeysMap)lines.Add("key."+kv.Key+"="+(int)kv.Value);
                lines.Add("fov="+c.Fov.ToString(CultureInfo.InvariantCulture));lines.Add("bob="+c.Bob.ToString(CultureInfo.InvariantCulture));lines.Add("sensitivity="+c.Sensitivity.ToString(CultureInfo.InvariantCulture));
                lines.Add("padpreset="+c.PadPreset);lines.Add("padsens="+c.PadSensitivity.ToString(CultureInfo.InvariantCulture));lines.Add("padinvert="+(c.PadInvert?"1":"0"));
                foreach(var kv in c.PadMap)lines.Add("pad."+kv.Key+"="+kv.Value);
                if(!string.IsNullOrEmpty(c.OnlineName))lines.Add("online.name="+PlayerName(c.OnlineName));
                lines.Add("arena="+c.ArenaId);lines.Add("bots="+c.Bots);lines.Add("difficulty="+c.Difficulty);lines.Add("hunger="+c.Hunger);lines.Add("events="+(c.Events?"1":"0"));
                string[] data=lines.ToArray();if(SettingsOverride!=null)WriteSettings(SettingsOverride,data);else if(!WriteSettings(PortableSettings,data))WriteSettings(LocalSettings,data);
            }catch(IOException){}catch(UnauthorizedAccessException){}
        }
        static float Clamp(float a,float lo,float hi){return Math.Max(lo,Math.Min(hi,a));}
        static Color A(Color color,int opacity){return Color.FromArgb(Math.Max(0,Math.Min(255,opacity)),color);}
        static string KeyName(Keys key) {
            switch(key){case Keys.LButton:return "LMB";case Keys.RButton:return "RMB";case Keys.MButton:return "MMB";case Keys.ControlKey:return "CTRL";case Keys.ShiftKey:return "SHIFT";case Keys.Menu:return "ALT";case Keys.Space:return "SPACE";case Keys.Tab:return "TAB";case Keys.Escape:return "ESC";case Keys.Return:return "ENTER";case Keys.OemOpenBrackets:return "[";case Keys.OemCloseBrackets:return "]";}
            if(key>=Keys.D0&&key<=Keys.D9)return ((int)key-(int)Keys.D0).ToString(); return key.ToString().ToUpperInvariant();
        }
        static string K(Game g,string action){return g.PadActive?g.InputLabel(action):KeyName(g.Settings.KeysMap[action]);}
        Font F(float n,bool bold=false,bool mono=false,bool display=false){
            string k=(display?"D":mono?"M":"S")+(bold?"B":"R")+n.ToString(CultureInfo.InvariantCulture);Font f;
            if(!fonts.TryGetValue(k,out f)){f=new Font(display?"Bahnschrift":mono?"Consolas":"Segoe UI",n,bold?FontStyle.Bold:FontStyle.Regular,GraphicsUnit.Pixel);fonts[k]=f;}return f;
        }
        float Width(string s,float size,bool bold=false,bool mono=false){return pen.MeasureString(s,F(size,bold,mono),10000,StringFormat.GenericTypographic).Width;}
        void T(string s,float x,float y,float size,Color color,bool bold=false,bool mono=false,bool display=false){
            if(string.IsNullOrEmpty(s))return;using(var b=new SolidBrush(color))pen.DrawString(s,F(size,bold,mono,display),b,x,y,StringFormat.GenericTypographic);
        }
        void Right(string s,float x,float y,float size,Color c,bool bold=false,bool mono=false){T(s,x-Width(s,size,bold,mono),y,size,c,bold,mono);}
        void Mid(string s,float x,float y,float size,Color c,bool bold=false,bool mono=false){T(s,x-Width(s,size,bold,mono)/2,y,size,c,bold,mono);}
        void Para(string s,float x,float y,float w,float h,float size,Color color) {
            using(var b=new SolidBrush(color))using(var fmt=new StringFormat(StringFormat.GenericTypographic)){fmt.Trimming=StringTrimming.EllipsisWord;pen.DrawString(s,F(size),b,new RectangleF(x,y,w,h),fmt);}
        }
        void Box(float x,float y,float w,float h,Color c){if(w<=0||h<=0)return;using(var b=new SolidBrush(c))pen.FillRectangle(b,x,y,w,h);}
        void Line(float x,float y,float x2,float y2,Color c,float width=1){using(var p=new Pen(c,width))pen.DrawLine(p,x,y,x2,y2);}
        void Edge(float x,float y,float w,float h,Color c,float width=1){using(var p=new Pen(c,width))pen.DrawRectangle(p,x,y,w,h);}
        void Dot(float x,float y,float r,Color c){using(var b=new SolidBrush(c))pen.FillEllipse(b,x-r,y-r,r*2,r*2);}
        void Ring(float x,float y,float r,Color c,float width=1){using(var p=new Pen(c,width))pen.DrawEllipse(p,x-r,y-r,r*2,r*2);}
        void Gradient(float x,float y,float w,float h,Color a,Color b,bool vertical=false){
            if(w<=1||h<=1)return;var rect=new RectangleF(x,y,w,h);using(var grad=new LinearGradientBrush(rect,a,b,vertical?90:0))pen.FillRectangle(grad,rect);
        }
        void Mark(float x,float y,float r){
            using(var p=new Pen(Gold,1.6f)){pen.DrawArc(p,x-r,y-r,r*2,r*2,-151,116);pen.DrawArc(p,x-r,y-r,r*2,r*2,29,123);pen.DrawArc(p,x-r*.67f,y-r*.67f,r*1.34f,r*1.34f,-146,111);}
            Line(x-r*.53f,y+r*.58f,x,y-r*.5f,Gold,1.6f);Line(x,y-r*.5f,x+r*.51f,y+r*.58f,Gold,1.6f);Line(x-r*.28f,y+r*.09f,x+r*.27f,y+r*.09f,Gold,1.6f);
        }
        void HitBox(string id,float x,float y,float w,float h,bool nav=true){hits.Add(new Hit{Id=id,Rect=new RectangleF(x,y,w,h),Nav=nav});}
        void Action(string id,string label,float x,float y,float w,float h,bool primary=false){
            HitBox(id,x,y,w,h);bool hot=selected==id;
            if(hot){Gradient(x,y,w,h,Color.FromArgb(232,219,185,121),Color.FromArgb(231,206,162,91));}
            else {Box(x,y,w,h,A(Ink,180));Edge(x,y,w,h,A(Brass,120));}
            T(label,x+18,y+h/2-13,20,hot?Ink:Ivory,true,false,true);
            if(hot||primary){Line(x+w-28,y+h/2-5,x+w-22,y+h/2,hot?Ink:Gold,1.8f);Line(x+w-22,y+h/2,x+w-28,y+h/2+5,hot?Ink:Gold,1.8f);}
        }
        void Keycap(string s,float x,float y){float w=Width(s,12,true,true)+12;Box(x,y,w,20,A(Ink,210));Edge(x,y,w,20,A(Ivory,105));Mid(s,x+w/2,y+2,12,Ivory,true,true);}
        void Field(string id,string label,string value,float x,float y,float w){
            float h=43;HitBox(id,x,y,w,h);bool hot=selected==id||selected==id+"-"||selected==id+"+";
            Box(x,y,w,h,hot?Color.FromArgb(220,55,59,46):A(Ink,200));Line(x,y+h,x+w,y+h,A(Brass,80));if(hot)Box(x,y,3,h,Gold);
            float stepper=id=="arena"?235:174;T(label,x+15,y+10,17,Ivory);Mid(value,x+w-stepper/2,y+11,15,Gold,true,true);
            HitBox(id+"-",x+w-stepper,y,34,h,false);HitBox(id+"+",x+w-34,y,34,h,false);
            Mid("‹",x+w-stepper+17,y+1,28,Muted);Mid("›",x+w-17,y+1,28,Muted);
        }
        public void MouseMove(int x,int y) {if(x!=mx||y!=my)hoverMoved=true;mx=x;my=y;}
        string At(float x,float y) {
            for(int i=hits.Count-1;i>=0;i--)if(hits[i].Rect.Contains(x,y))return hits[i].Id;return "";
        }
        void Observe(Game g){string s=g.Mode+"/"+g.Panel;if(s==route)return;route=s;hits.Clear();bind="";padBind="";Looking=false;
            string p=g.Panel; selected=p=="custom"?"startcustom":p=="pause"?"resume":p=="settings"?"sensitivity":p=="bindings"?"keyForward":p=="controller"?"padpreset":p=="padbinds"?"padkeyJump":p=="craft"||p=="build"?"workFirst":p=="pack"?"pack0":g.Mode=="menu"?"play":g.Mode=="dead"?"spectate":g.Mode=="results"?"replay":"";
            if(p!="craft"&&p!="build"){materialView="";materialReturn="";}
            workOffset=0;workRecipe="";
            selected=OnlineSelection(g,selected);packOffset=0;hoverMoved=false;}
        public bool Captures(Game g){return g.Panel!=""||g.Mode=="menu"||g.Mode=="dead"||g.Mode=="results";}
        public Bitmap Paint(Game g,int width,int height) {
            width=Math.Max(1,width);height=Math.Max(1,height);float fit=Math.Min(1f,Math.Min(1400f/width,900f/height));int iw=Math.Max(1,(int)(width*fit)),ih=Math.Max(1,(int)(height*fit));
            if(image==null||image.Width!=iw||image.Height!=ih){if(pen!=null)pen.Dispose();if(image!=null)image.Dispose();image=new Bitmap(iw,ih,PixelFormat.Format32bppPArgb);pen=Graphics.FromImage(image);}
            scale=Math.Min(iw/1280f,ih/720f);sw=iw/scale;sh=ih/scale;fx=(float)iw/width/scale;fy=(float)ih/height/scale;
            pen.ResetTransform();pen.Clear(Color.Transparent);pen.ScaleTransform(scale,scale);pen.SmoothingMode=SmoothingMode.AntiAlias;pen.TextRenderingHint=TextRenderingHint.AntiAliasGridFit;
            Observe(g);if(hoverMoved&&!g.PadActive&&Captures(g)&&bind==""&&padBind==""){string over=At(mx*fx,my*fy);if(over!="")selected=over;hoverMoved=false;}hits.Clear();
            if(g.Mode!="menu"&&g.Player!=null&&g.Panel!="pause"&&g.Panel!="settings"&&g.Panel!="bindings"&&g.Panel!="controller"&&g.Panel!="padbinds"&&g.Mode!="results"&&g.Mode!="dead")Hud(g);
            if(PaintOnline(g))return image;
            if(g.Panel=="custom")Custom(g);else if(g.Panel=="settings")Settings(g);else if(g.Panel=="bindings")Bindings(g);else if(g.Panel=="controller")Controller(g);else if(g.Panel=="padbinds")PadBindings(g);else if(g.Panel=="pause")Pause(g);
            else if(g.Panel=="craft"||g.Panel=="build")Workbench(g);else if(g.Panel=="pack")Pack(g);
            else if(g.Mode=="menu")Home(g);else if(g.Mode=="dead"||g.Mode=="results")Results(g);
            return image;
        }
        void Backdrop(bool full=false){if(full)Box(0,0,sw,sh,A(Ink,210));else {Gradient(0,0,sw*.87f,sh,Color.FromArgb(251,10,19,20),Color.FromArgb(0,10,19,20));Gradient(0,sh-110,sw,110,Color.Transparent,A(Ink,145),true);}}
        void Header(string title,string secondary,float x,float y){T(title,x,y,42,Ivory,true,false,true);T(secondary,x,y+56,16,Muted);}
        void Home(Game g){
            Backdrop();float x=Math.Max(64,sw*.065f), y=sh*.13f;
            Mark(x+17,y+14,17);
            T("LAST",x-3,y+36,87,Ivory,true,false,true);T("SIGNAL",x-3,y+111,87,Ivory,true,false,true);
            Line(x,y+214,x+51,y+214,Gold,2);T("Last survivor wins.",x,y+232,21,Ivory);
            T("23 rivals   /   Standard hunger   /   Arena events",x,y+268,13,Muted,false,true);
            Action("play","Play Arena",x,y+309,323,51,true);Action("custom","Custom Arena",x,y+370,323,45);
            Action("multiplayer","Multiplayer",x,y+425,323,45);Action("settings","Settings",x,y+480,323,45);
            HitBox("quit",x,y+535,140,32);T("Quit game",x+3,y+540,15,selected=="quit"?Gold:Muted);
            Right(g.PadActive?"A  Select      D-pad or left stick  Navigate":g.PadConnected?"Enter / A  Select      Arrows / D-pad  Navigate":"Enter  Select      Arrow keys  Navigate",sw-42,sh-36,13,Muted,false,true);
        }
        void Custom(Game g){
            Backdrop();float x=sw*.07f,y=sh*.095f;Header("Custom Arena","Select one of three maps and set the match conditions.",x,y);float t=y+97,w=480;
            Field("arena","Arena map",Arena.NameOf(g.Settings.ArenaId),x,t,w);
            Field("bots","AI contestants",g.Settings.Bots.ToString(),x,t+50,w);Field("difficulty","Opponent skill",Diff(g.Settings.Difficulty),x,t+100,w);
            Field("hunger","Hunger pressure",Hunger(g.Settings.Hunger),x,t+150,w);Field("events","Local arena events",g.Settings.Events?"On":"Off",x,t+200,w);
            Para(DiffDetail(g.Settings.Difficulty),x,t+257,w,52,16,Ivory);
            Action("startcustom","Start match",x,t+312,w,48,true);Action("back","Back",x,t+372,160,42);PadHelp(g,"Left / right  Adjust      A  Select      B  Back");
        }
        static string Diff(int value){return value==0?"Novice":value==3?"Champion":value==2?"Expert":"Standard";}
        static string DiffDetail(int level){switch(level){case 0:return "Novice opponents react slowly and leave wider openings.";case 2:return "With 3+ bots, nearby rivals can offer truces, recruit allies and share supplies.";case 3:return "Rivals can offer truces with 3+ bots. At 15+ bots, two packs can form. Alliances end before the final fight.";default:return "Standard opponents contest your reach and guard when they see a swing.";} }
        static string Hunger(int value){return value==0?"Gentle":value==2?"Harsh":"Standard";}
        void Settings(Game g){
            Backdrop();float x=sw*.07f,y=sh*.14f;Header("Settings","Camera, movement and controls",x,y);float t=y+107;float w=443;
            Field("sensitivity","Mouse sensitivity",g.Settings.Sensitivity.ToString("0.0")+"×",x,t,w);
            Field("fov","Field of view",Math.Round(g.Settings.Fov)+"°",x,t+53,w);Field("bob","Head bob",Math.Round(g.Settings.Bob*100)+"%",x,t+106,w);
            Action("bindings","Keyboard and mouse",x,t+179,w,44);Action("controller","Controller",x,t+233,w,44);Action("back","Back",x,t+298,155,42);PadHelp(g,"Left / right  Adjust      A  Select      B  Back");
        }
        void Bindings(Game g){
            Backdrop(true);float x=(sw-940)/2,y=(sh-640)/2;Header("Keyboard and mouse",bind==""?"Select an action to change its binding.":g.PadActive?"Waiting for a keyboard key or mouse button. B cancels.":"Press a key or mouse button. Esc cancels.",x,y);float t=y+99;
            int rows=(bindings.Length+1)/2;
            for(int i=0;i<bindings.Length;i++){string k=bindings[i];float bx=x+(i/rows)*480, by=t+(i%rows)*31;string id="key"+k;bool hot=selected==id||bind==k;
                HitBox(id,bx,by,448,29);Box(bx,by,448,29,hot?Color.FromArgb(230,59,63,48):A(Ink,200));if(hot)Box(bx,by,3,29,Gold);
                T(k=="Throw"?"Throw spear":k.StartsWith("Weapon ")?k+"  /  "+SlotWeapon(k):k,bx+12,by+4,15,Ivory);Right(bind==k?"Press input…":KeyName(g.Settings.KeysMap[k]),bx+432,by+4,15,Gold,true,true);}
            Action("back","Back",x,t+rows*31+14,155,43);
            T("Hold "+KeyName(g.Settings.KeysMap["Guard"])+" to raise a shield. Tap to parry with a weapon. Dodge with "+KeyName(g.Settings.KeysMap["Dodge"])+".",x+185,t+rows*31+25,15,Muted);
            PadHelp(g,"D-pad  Navigate      A  Select      B  Back");
        }
        static string SlotWeapon(string k){switch(k){case "Weapon 1":return "Knife";case "Weapon 2":return "Spear";case "Weapon 3":return "Bow";case "Weapon 4":return "Hatchet";case "Weapon 5":return "Sling";case "Weapon 6":return "Sword";case "Weapon 7":return "Crossbow";default:return "";}}
        void Pause(Game g){
            Backdrop();float x=sw*.08f,y=sh*.23f;Header(g.NetworkMatch?"Match menu":"Match paused",g.NetworkMatch?"The online round is live.":g.Zone,x,y);
            Action("resume","Resume",x,y+107,316,49,true);Action("settings","Settings",x,y+166,316,45);Action("leave",g.NetworkMatch?(g.Online.IsHost?"Close hosted room":"Leave match"):"Return to title",x,y+222,316,45);PadHelp(g,"D-pad  Navigate      A  Select      B  Resume");
        }
        void Results(Game g){
            Backdrop();float x=sw*.075f,y=sh*.18f;bool done=g.Mode=="results";Mark(x+14,y+12,14);T(done?"FINAL SIGNAL":"SIGNAL LOST",x+38,y+1,15,Gold,true,true);
            string title=done?(g.Winner==g.Player?"You survived":"Match complete"):"Eliminated";
            T(title,x,y+46,57,Ivory,true,false,true);if(done&&g.Winner!=null)T("Winner   "+g.Winner.Name,x,y+125,24,Ivory,true);
            else if(!done)T(g.AliveCount+" contestants remain in the arena.",x,y+125,19,Muted);
            if(g.Player!=null){T("PLACEMENT",x,y+194,12,Muted,true,true);T("ELIMINATIONS",x+178,y+194,12,Muted,true,true);
                T("#"+Math.Max(1,g.Player.Placement),x,y+216,34,Gold,true,false,true);T(g.Player.Kills.ToString(),x+178,y+216,34,Ivory,true,false,true);}
            PadHelp(g,"D-pad  Navigate      A  Select");
            if(g.NetworkMatch){
                if(done&&g.Online.IsHost)Action("replay","Return everyone to lobby",x,y+304,320,50,true);
                else if(done)T("Waiting for the host to start another round.",x,y+317,18,Muted);
                else Action("spectate","Spectate",x,y+304,320,50,true);
                Action("leave",g.Online.IsHost?"Close hosted room":"Leave room",x,y+368,320,45);return;
            }
            if(done){Action("replay","Play Again",x,y+304,320,50,true);Action("leave","Return to title",x,y+368,320,45);}
            else{Action("spectate","Spectate",x,y+304,320,50,true);Action("replay","Play Again",x,y+367,320,45);Action("leave","Return to title",x,y+423,320,45);}
        }
        public void Dispose(){foreach(var f in fonts.Values)f.Dispose();foreach(var im in icons.Values)if(im!=null)im.Dispose();if(map!=null)map.Dispose();if(pen!=null)pen.Dispose();if(image!=null)image.Dispose();}
    }
}










