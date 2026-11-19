using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

namespace LastSignal {
    public sealed partial class Ui {
        Bitmap map; int mapArena=-1;string packId="";
        static string CleanId(string id) {
            switch(id){case "campfire":case "firekit":case "fire_kit":return "fire";case "lowwall":case "low_wall":return "barricade";case "fullwall":case "full_wall":return "wall";case "leanto":return "lean_to";case "raw_meat":case "rawmeat":case "raw":case "cooking":return "meat";case "cooked_meat":case "cooked":case "cooked_meal":return "meal";case "arrow":return "arrows";case "stones":case "pebble":return "stone";default:return id;}
        }
        void Icon(string id,float x,float y,float w) {
            string clean=CleanId(id);Image im;
            if(!icons.TryGetValue(clean,out im)){try {string file=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"Assets","icons",clean+".png");if(File.Exists(file))im=Image.FromFile(file);}catch(IOException){}catch(OutOfMemoryException){}if(im==null)im=WeaponIcon(clean);icons[clean]=im;}
            if(im!=null){pen.DrawImage(im,new RectangleF(x,y,w,w));return;}
            Ring(x+w/2,y+w/2,w*.22f,A(Brass,120));T((clean.Length>0?clean.Substring(0,1):"·").ToUpperInvariant(),x+w*.4f,y+w*.26f,w*.31f,Gold,true,true);
        }
        Actor hudActor;
        string lastZone="",lastHint="",needTip="";
        float zoneAt,hintAt,hintX,hintZ,needUntil,spearTipUntil;
        bool wasDismissed,wasStrained,sawSpear,sawSecondWeapon,sawDefense;
        string priorWeapon="";float weaponTipUntil,defenseTipUntil;
        readonly HashSet<string> seenFortTips=new HashSet<string>();
        string fortTip="";
        float fortTipUntil;
        static readonly Color WaterBlue=Color.FromArgb(122,187,204);

        void WatchContext(Game g,Actor a,string zone) {
            if(hudActor!=a){hudActor=a;lastZone="";lastHint="";needUntil=0;wasDismissed=false;wasStrained=false;needTip="";sawSpear=false;spearTipUntil=0;sawSecondWeapon=false;priorWeapon="";weaponTipUntil=0;sawDefense=false;defenseTipUntil=0;seenFortTips.Clear();fortTip="";fortTipUntil=0;}
            if(a==g.Player&&a.Weapon=="spear"&&!sawSpear){sawSpear=true;spearTipUntil=g.Time+8f;}
            if(a==g.Player){
                if(g.BuildId==""||g.Panel!=""||g.Dismissed)fortTipUntil=0;
                else if(seenFortTips.Add(g.BuildId)){
                    fortTip=g.BuildId=="floor"?"Aim at a wall top or ramp lip to build up. Aim at a floor edge to extend.":
                        g.BuildId=="ramp"?"Rotate the ramp so its high end meets the landing.":
                        g.BuildId=="wall"?"Aim at a floor edge to start an upstairs wall.": "";
                    fortTipUntil=g.Time+7;
                }
                if(!sawDefense&&g.Panel==""&&g.BuildId==""&&!Game.Ranged(a)&&(a.Guard||a.DodgeTime>0||a.Hurt>0)){
                    sawDefense=true;defenseTipUntil=g.Time+7;
                }
                string next=Game.PeekWeapon(a,1);
                if(next!=""&&next!="fists"&&next!=a.Weapon&&(priorWeapon!=a.Weapon||!sawSecondWeapon)){
                    sawSecondWeapon=true;weaponTipUntil=g.Time+(priorWeapon==""?5f:3.5f);
                }
                priorWeapon=a.Weapon;
            }
            if(zone!=lastZone){lastZone=zone;zoneAt=g.Time;}
            if(lastHint!=g.Hint||Math.Abs(hintX-g.UseX)+Math.Abs(hintZ-g.UseZ)>.25f){
                lastHint=g.Hint;hintAt=g.Time;hintX=g.UseX;hintZ=g.UseZ;
            }
            bool strained=a.NeedStrain>.025f;
            if(strained&&!wasStrained){
                bool thirsty=a.Hydration/38f<=a.Hunger/35f;
                bool nearWater=g.FocusShore||(g.FocusProp!=null&&(g.FocusProp.Kind=="water"||g.FocusProp.Model=="rain_barrel"&&g.FocusProp.Water>0));
                needTip=thirsty?(nearWater?"Thirst is narrowing your vision. Drink here.":a.WaterCarried>0?"Thirst is narrowing your vision. Drink from your pack.":"Thirst is narrowing your vision. Find water."):"Hunger is narrowing your vision. Eat a cooked meal.";
                needUntil=g.Time+4.5f;
            }
            if(!strained)needUntil=0;
            if(g.Down("Dismiss")||(g.Dismissed&&!wasDismissed)){hintAt=g.Time-8;needUntil=0;spearTipUntil=0;weaponTipUntil=0;defenseTipUntil=0;}
            wasDismissed=g.Dismissed;wasStrained=strained;
        }
        void Hud(Game g){
            bool spec=g.Mode=="spectate";Actor a=spec?g.CameraTarget:g.Player;if(a==null)return;
            string zone=spec?Arena.Zone(a.X,a.Z):g.Zone;WatchContext(g,a,zone);
            float cx=sw/2,cy=sh/2;float heading=(float)((g.CamYaw*180/Math.PI+3600)%360);string[] dirs={"N","NE","E","SE","S","SW","W","NW"};
            if(g.Time-zoneAt<5||g.Panel=="pack"){
                string tag=(g.IsNight?"Night ":"Day ")+g.DayNumber+"   /   "+zone;float zw=Width(tag,15,true)+26;Box(20,19,zw,26,A(Ink,178));T(tag,32,22,15,Ivory,true);
            }
            for(int i=-3;i<=3;i++){int nearest=(int)Math.Round(heading/15)*15+i*15;float x=cx+(nearest-heading)*1.75f;if(Math.Abs(x-cx)>95)continue;int wrapped=(nearest%360+360)%360;
                if(wrapped%45==0){Mid(dirs[wrapped/45],x+1,17,12,A(Ink,211),true,true);Mid(dirs[wrapped/45],x,16,12,Ivory,true,true);}else {Line(x+1,21,x+1,25,A(Ink,183));Line(x,20,x,24,A(Ivory,164));}}
            Dot(cx,31,1.5f,Gold);
            string count=g.AliveCount+" ALIVE";float countW=Width(count,15,true,true)+23;
            Box(sw-countW-20,19,countW,26,A(Ink,185));Right(count,sw-31,23,15,Ivory,true,true);
            if(g.EventTime>0&&!string.IsNullOrEmpty(g.EventText)){float ew=Math.Min(sw-160,Math.Max(245,Width(g.EventText,15,true)+38));Box(cx-ew/2,45,ew,29,A(Ink,209));Box(cx-ew/2,45,2,29,Gold);Mid(g.EventText,cx,50,15,Gold,true);}
            if(g.FeedTime>0&&!string.IsNullOrEmpty(g.KillFeed)){float fw=Width(g.KillFeed,13)+20;Box(sw-20-fw,51,fw,23,A(Ink,172));Right(g.KillFeed,sw-30,54,13,Ivory);}
            StormGuide(g,a);
            if(spec){Box(cx-177,sh-66,354,47,A(Ink,212));Mid(a.Name,cx,sh-62,16,Ivory,true);Mid(g.PadActive?"LB / RB   Cycle contestant      Menu   Pause":"Arrow keys   Cycle contestant      Esc   Menu",cx,sh-37,12,Muted,true,true);return;}
            // The four needs share one glanceable corner. Healthy bars recede together.
            Box(18,sh-81,226,63,A(Ink,190));
            Vital("HEALTH",a.Health,28,sh-75,97,Rust);
            Vital("STAMINA",a.Stamina,137,sh-75,97,Moss);
            Vital("FOOD",a.Hunger,28,sh-47,97,Gold);
            Vital("WATER",a.Hydration,137,sh-47,97,WaterBlue);
            string weapon=a.Weapon=="fists"?"Unarmed":Survival.Label(a.Weapon);
            if(Game.CarriesShield(a))weapon+=" + shield";
            string ammo=a.Weapon=="sling"?"   "+a.Count("stone")+" stones":a.Weapon=="bow"?"   "+a.Count("arrows")+" arrows":"";
            if(a.Weapon=="crossbow")ammo="   "+a.Count("bolts")+" bolts";
            float rx=sw-23;float ww=Width(weapon,16,true)+Width(ammo,13,false,true)+(a.Weapon=="fists"?23:53);
            Box(rx-ww,sh-52,ww,31,A(Ink,190));
            if(a.Weapon!="fists")Icon(a.Weapon,rx-ww+4,sh-52,31);
            T(weapon,rx-ww+(a.Weapon=="fists"?11:39),sh-46,16,Ivory,true);
            if(ammo!="")Right(ammo,rx-11,sh-44,13,Gold,false,true);
            if(a.Weapon=="crossbow"&&a.CrossbowReload>0){
                float remaining=Math.Max(0,Actor.CrossbowReloadTime-a.CrossbowReload);
                string copy="Reloading   "+remaining.ToString("0.0")+"s";
                float tw=Math.Max(ww,Width(copy,12,false,true)+18);
                Box(rx-tw,sh-77,tw,23,A(Ink,210));Right(copy,rx-8,sh-74,12,Ivory,false,true);
                Box(rx-tw,sh-56,tw*Clamp(a.CrossbowReload/Actor.CrossbowReloadTime,0,1),2,Gold);
            }else if(!g.Dismissed&&g.Time<weaponTipUntil&&g.Panel==""){
                string next=Game.PeekWeapon(a,1);
                if(!string.IsNullOrEmpty(next)&&next!="fists"&&next!=a.Weapon){
                    string key=g.PadActive?g.InputLabel("Next weapon"):K(g,"Next weapon")+" / wheel";
                    string copy=key+"   "+weapon+" > "+Survival.Label(next);float tw=Width(copy,12,false,true)+17;
                    Box(rx-tw,sh-77,tw,21,A(Ink,192));Right(copy,rx-8,sh-74,12,Ivory,false,true);
                }
            }
            if(a.Hurt>.01f){float strength=Clamp(a.Hurt*4,0,1);Gradient(0,0,sw*.135f,sh,A(Rust,(int)(strength*72)),Color.Transparent);Gradient(sw*.865f,0,sw*.135f,sh,Color.Transparent,A(Rust,(int)(strength*72)));}
            if(g.Panel!="")return;
            bool drawing=a.Throwing||(g.Charging&&(a.Weapon=="bow"||a.Weapon=="sling"));
            float power=Clamp(a.DrawPower,0,1);
            float spread=drawing?8-5*power:a.Aiming?2:4;
            if(g.Countdown<=0){Color cross=ReticleColor(a);Line(cx-spread-5,cy,cx-spread,cy,A(Ink,170),3);Line(cx+spread,cy,cx+spread+5,cy,A(Ink,170),3);Line(cx,cy-spread-5,cx,cy-spread,A(Ink,170),3);
                Line(cx-spread-5,cy,cx-spread,cy,cross,1.4f);Line(cx+spread,cy,cx+spread+5,cy,cross,1.4f);Line(cx,cy-spread-5,cx,cy-spread,cross,1.4f);Dot(cx,cy,1.2f,cross);}
            if(drawing){Box(cx-18,cy+17,36,4,A(Ink,219));Box(cx-17,cy+18,34*power,2,power>=.98f?Ivory:Gold);}
            float px,py;
            if(g.UseProgress>0&&g.UseProgress<=1&&Project(g,g.UseX,g.UseY,g.UseZ,out px,out py)&&px>=0&&px<=sw&&py>=0&&py<=sh){
                px=Clamp(px+28,60,sw-60);py=Clamp(py-8,115,sh-120);Dot(px,py,13,A(Ink,210));Ring(px,py,10,A(Ivory,91),2);
                using(var p=new Pen(Gold,2.9f))pen.DrawArc(p,px-10,py-10,20,20,-90,360*Clamp(g.UseProgress,0,1));}
            if(!string.IsNullOrWhiteSpace(g.Hint)&&g.Countdown<=0&&(g.Time-hintAt<5.5f||g.UseProgress>0||g.BuildId!="")){
                string message=g.Hint;float w=Math.Min(sw-122,Width(message,15,true)+26);
                bool teaching=g.BuildId!=""&&!g.Dismissed&&fortTip!=""&&g.Time<fortTipUntil;
                if(teaching)w=Math.Max(w,Width(fortTip,13)+24);
                Box(cx-w/2,cy+43,w,teaching?46:28,A(Ink,210));Mid(message,cx,cy+47,15,g.BuildId!=""&&!g.GhostFits?Gold:Ivory,true);
                if(teaching)Mid(fortTip,cx,cy+68,13,Muted);
            }
            string notice=g.NoticeTime>0?g.Notice:g.Time<needUntil?needTip:"";
            if(!string.IsNullOrEmpty(notice)){
                float w=Math.Min(sw-110,Width(notice,15,true)+31);Box(cx-w/2,sh-92,w,29,A(Ink,212));Mid(notice,cx,sh-87,15,Gold,true);
            }else if(!g.Dismissed&&g.Time<defenseTipUntil&&g.BuildId==""){
                string tip=Game.CarriesShield(a)?"Hold "+K(g,"Guard")+" and face the attack to cover yourself with the shield.":
                    "Face the strike. Tap "+K(g,"Guard")+" just before impact. Move + "+K(g,"Dodge")+" to dodge.";
                float w=Width(tip,14)+26;Box(cx-w/2,sh-70,w,26,A(Ink,202));Mid(tip,cx,sh-65,14,Ivory);
            }else if(!g.Dismissed&&g.Time<spearTipUntil&&a.Weapon=="spear"&&g.BuildId==""){
                string tip="Hold "+K(g,"Throw")+" to aim a throw  ·  Release to throw  ·  Recover your spear";
                float tw=Width(tip,14)+26;Box(cx-tw/2,sh-70,tw,26,A(Ink,202));Mid(tip,cx,sh-65,14,Ivory);
            }else if(!g.Dismissed&&g.Time>2&&g.Time<9&&g.Countdown<=0&&g.BuildId==""&&string.IsNullOrEmpty(g.Hint)){
                string tip=K(g,"Use")+" Gather    "+K(g,"Craft")+" Craft    "+K(g,"Build")+" Build    "+K(g,"Pack")+" Pack    "+K(g,"Dismiss")+" Hide";
                float tw=Width(tip,13,false,true)+24;Box(cx-tw/2,sh-51,tw,25,A(Ink,190));Mid(tip,cx,sh-46,13,Ivory,false,true);
            }
            if(g.Countdown>0){float y=sh*.25f;Mid("OPENING HORN",cx,y,16,Gold,true,true);Mid(Math.Ceiling(g.Countdown).ToString(),cx,y+20,55,Ivory,true);}
        }
        static Color ReticleColor(Actor a){
            if(!a.Guard)return A(Ivory,220);
            if(Game.CarriesShield(a))return Game.ShieldRaised(a)?Gold:A(Muted,165);
            if(a.GuardSpent||a.GuardTime<Game.GuardStart||a.GuardTime>Game.BlockEnd)return A(Muted,165);
            return a.GuardTime<=Game.ParryEnd?Ivory:Gold;
        }
        static readonly Color StormInk=Color.FromArgb(188,193,255);
        static string Remaining(float sec){int t=(int)Math.Ceiling(Math.Max(0,sec));return (t/60)+":"+(t%60).ToString("00");}
        void StormGuide(Game g,Actor a){
            if(!g.StormActive&&!g.StormWarning)return;
            float margin=g.StormMargin(a.X,a.Z),dist=Game.Distance(a.X,a.Z,g.StormNextX,g.StormNextZ);
            bool outside=g.StormActive&&margin<0;
            bool forecast=(g.StormWarning||g.StormMoving)&&dist>g.StormNextRadius&&g.StormNextRadius>.7f;
            if(!outside&&!g.StormWarning&&!g.StormMoving)return;
            float tx=forecast?g.StormNextX:g.StormX,tz=forecast?g.StormNextZ:g.StormZ;
            bool direction=(outside||forecast)&&g.StormRadius>.7f;
            string watch=Remaining(g.StormSecondsRemaining),copy;
            if(outside&&g.StormRadius<.7f)copy="Final storm";
            else if(outside)copy="Safe ground  "+(int)Math.Ceiling(-margin)+" m";
            else if(forecast)copy="Next safe ground  "+(int)Math.Ceiling(dist-g.StormNextRadius)+" m   "+watch;
            else copy=(g.StormWarning?"Storm in  ":"Eye closing  ")+watch;
            float x=20,y=50,width=Width(copy,13,true,true)+(direction?39:20);
            Box(x,y,width,25,A(Ink,208));Box(x,y,2,25,StormInk);
            if(direction){
                double angle=Math.Atan2(tx-a.X,tz-a.Z)-g.CamYaw;float dx=(float)Math.Sin(angle),dy=-(float)Math.Cos(angle),bx=x+17,by=y+12;
                Line(bx-dx*5,by-dy*5,bx+dx*6,by+dy*6,StormInk,1.8f);
                Line(bx+dx*6,by+dy*6,bx+dy*4,by-dx*4,StormInk,1.8f);Line(bx+dx*6,by+dy*6,bx-dy*4,by+dx*4,StormInk,1.8f);
            }
            T(copy,x+(direction?31:10),y+5,13,StormInk,true,true);
        }
        bool Project(Game g,float x,float y,float z,out float px,out float py){
            double dx=x-g.CamX,dy=y-g.CamY,dz=z-g.CamZ,sy=Math.Sin(g.CamYaw),cy=Math.Cos(g.CamYaw),sp=Math.Sin(g.CamPitch),cp=Math.Cos(g.CamPitch);
            double forward=sy*dx+cy*dz,depth=forward*cp+dy*sp;px=sw/2;py=sh/2;if(depth<.08)return false;
            double focal=sh/(2*Math.Tan(g.EffectiveFov()*Math.PI/360));px+=(float)(focal*(cy*dx-sy*dz)/depth);py-=(float)(focal*(dy*cp-forward*sp)/depth);return true;
        }
        void Vital(string name,float value,float x,float y,float w,Color color) {
            value=Clamp(value,0,100);
            bool healthy=value>=77;Color text=healthy?Color.FromArgb(203,207,190):Ivory;
            T(name,x,y,12,text,true,true);Right(Math.Ceiling(value).ToString(),x+w,y-1,13,value<25?Gold:text,true,true);
            Box(x,y+17,w,4,Color.FromArgb(97,109,105));
            Box(x,y+17,w*value/100,4,healthy?A(color,159):color);
        }
        void Wheel(Game g){
            bool build=g.Panel=="build";var recipes=build?Survival.Builds:Survival.Crafts;int n=recipes.Length;if(n==0)return;
            Gradient(0,0,sw,sh,A(Ink,60),A(Ink,122),true);
            wheelType=g.Panel;wcount=n;wr=215;wx=sw/2;wy=sh/2-7;float inner=91;int index=0;
            if(selected.StartsWith("slot"))int.TryParse(selected.Substring(4),out index);index=Math.Max(0,Math.Min(n-1,index));
            for(int i=0;i<n;i++){float arc=360f/n,start=-90-arc/2+i*arc;bool hot=i==index,ok=Survival.CanMake(g.Player,recipes[i]);using(var gp=new GraphicsPath()){
                    gp.AddArc(wx-wr,wy-wr,wr*2,wr*2,start+1,arc-2);gp.AddArc(wx-inner,wy-inner,inner*2,inner*2,start+arc-1,-arc+2);gp.CloseFigure();
                    using(var b=new SolidBrush(hot?Color.FromArgb(243,83,77,53):Color.FromArgb(232,20,31,30)))pen.FillPath(b,gp);
                    using(var p=new Pen(hot?Gold:A(Brass,160),hot?2:1))pen.DrawPath(p,gp);}
                float a=(float)((i*arc-90)*Math.PI/180),r=153;float px=wx+(float)Math.Cos(a)*r, py=wy+(float)Math.Sin(a)*r;
                Icon(recipes[i].Id,px-23,py-33,46);Mid(recipes[i].Name,px,py+14,n>8?13:14,hot||ok?Ivory:Muted,true);
                if(!g.PadActive&&i<10){Dot(px-26,py-29,8,A(Ink,210));Mid(((i+1)%10).ToString(),px-26,py-36,11,hot?Gold:Muted,true,true);}}
            Dot(wx,wy,inner-3,A(Ink,234));Mark(wx,wy-32,13);Mid(build?"BUILD":"CRAFT",wx,wy-3,24,Ivory,true,true);
            Mid(recipes[index].Name,wx,wy+31,15,Gold,true);
            float bw=526,bx=wx-bw/2,by=wy+wr+15;Box(bx,by,bw,87,A(Ink,224));WheelCost(g.Player,recipes[index],build,wx,by+7);
            Mid(recipes[index].Info,wx,by+31,14,Ivory);
            string controls=g.PadActive
                ? (build?"L stick  Choose     A  Select     LT + A  Repeat placement":"L stick  Choose     A  Select     B  Close     R stick  Look")
                : (build?"Number or click  Select     "+K(g,"Rotate")+"  Rotate     "+K(g,"Sprint")+" + "+K(g,"Attack")+"  Repeat placement":"Click or press a number to craft    RMB  Look around");
            Mid(controls,wx,by+60,12,Muted,false,true);
            if(g.NoticeTime>0&&!string.IsNullOrEmpty(g.Notice))Mid(g.Notice,wx,wy-wr-45,16,Gold,true);
        }
        void WheelCost(Actor a,Recipe recipe,bool build,float cx,float y){
            if(build&&recipe.Id=="fire"&&a.Count("firekit")>0){Mid("Campfire kit ready",cx,y,15,Gold,true);return;}
            float total=0;
            var labels=new System.Collections.Generic.List<string>();
            var colors=new System.Collections.Generic.List<Color>();
            foreach(var need in recipe.Needs){
                int held=a.Count(need.Key);
                string text=Survival.Label(need.Key)+"  "+held+"/"+need.Value;
                labels.Add(text);colors.Add(held>=need.Value?Gold:Rust);total+=Width(text,15,true);
            }
            const float gap=22;float x=cx-(total+gap*(labels.Count-1))/2;
            for(int i=0;i<labels.Count;i++){T(labels[i],x,y,15,colors[i],true);x+=Width(labels[i],15,true)+gap;}
        }
        static float MapSpan {get{return Arena.Radius*2.05f;}}
        void EnsureMap(int arena){
            if(map!=null&&arena==mapArena)return;if(map!=null)map.Dispose();mapArena=arena;
            const int side=256;float step=MapSpan/side;map=new Bitmap(side,side,PixelFormat.Format32bppArgb);
            for(int v=0;v<side;v++)for(int u=0;u<side;u++){
                float x=(u+.5f-side*.5f)*step,z=(side*.5f-v-.5f)*step;
                if(x*x+z*z>Arena.Radius*Arena.Radius)continue;
                float h=Arena.Height(x,z),path=Arena.Path(x,z);int zone=Arena.ZoneIndex(x,z);
                Color ground=zone==1?Color.FromArgb(65,85,63):zone==2?Color.FromArgb(54,81,79):zone==3?Color.FromArgb(93,89,69):zone==4?Color.FromArgb(64,86,70):Color.FromArgb(104,100,81);
                if(arena==1&&zone>0)ground=zone==2?Color.FromArgb(81,111,85):Color.FromArgb(140,99,75);
                if(arena==2&&zone>0)ground=zone==1?Color.FromArgb(72,98,94):Color.FromArgb(118,145,151);
                float shade=(float)(h*1.2+(Math.Sin(u*.19+v*.08)+Math.Sin(v*.13))*2+path*23);
                if(Math.Abs(h%2.2f)<.09&&Math.Abs(h)>.1)shade+=13;
                float depth=Arena.Water(x,z);
                if(depth>.028f){ground=Color.FromArgb(78,144,153);shade=-Math.Min(17,depth*9);}
                map.SetPixel(u,v,Color.FromArgb((int)Clamp(ground.R+shade,0,255),(int)Clamp(ground.G+shade,0,255),(int)Clamp(ground.B+shade,0,255)));
            }
        }
        void PackMap(Game g,float x,float y,float size){
            EnsureMap(g.ArenaId);pen.DrawImage(map,new RectangleF(x,y,size,size));float cx=x+size/2,cy=y+size/2,meter=size/MapSpan;
            Ring(cx,cy,Arena.Radius*meter,A(Brass,200));if(g.StormActive&&g.StormRadius>.3f&&g.StormRadius<Arena.Radius)Ring(cx+g.StormX*meter,cy-g.StormZ*meter,meter*g.StormRadius,StormInk,1.8f);
            if((g.StormWarning||g.StormMoving)&&g.StormNextRadius>.4f){float nr=meter*g.StormNextRadius;using(var dash=new Pen(A(StormInk,205),1.4f)){dash.DashStyle=DashStyle.Dash;pen.DrawEllipse(dash,cx+g.StormNextX*meter-nr,cy-g.StormNextZ*meter-nr,2*nr,2*nr);}}
            Line(cx-5,cy,cx+5,cy,Gold);Line(cx,cy-5,cx,cy+5,Gold);Mid("N",cx,y-13,12,Gold,true,true);
            int id=g.ArenaId;Mid(id==1?"Junipers":id==2?"Saddle":"Groves",cx,cy-size*.31f,13,Ivory,true);Mid(id==1?"Mesas":id==2?"Cirque":"Terraces",cx,cy+size*.26f,13,Ivory,true);Mid(id==1?"Canyon":"Ridge",cx-size*.29f,cy-9,13,Ivory,true);Mid(id==1?"Oasis":"Basin",cx+size*.29f,cy-9,13,Ivory,true);
            float px=cx+g.Player.X*meter,py=cy-g.Player.Z*meter;
            Dot(px,py,5,Ink);Dot(px,py,3,Gold);Line(px,py,px+10*(float)Math.Sin(g.Player.Yaw),py-10*(float)Math.Cos(g.Player.Yaw),Gold,2);
        }
        static string PackAction(Actor a,string id) {
            if(Armor.IsArmor(id))return a.WornArmor==id?"Remove armor":"Wear armor";
            switch(id){case "knife":case "spear":case "sling":case "bow":case "hatchet":case "sword":case "crossbow":return "Equip";case "meal":return "Eat meal";case "waterskin":return "Drink";case "bandage":return "Apply bandage";case "firekit":return "Place fire";case "shield":case "bolts":case "meat":case "arrows":return "";default:return "View recipes";}
        }
        static string PackDetail(Actor a,string id) {
            if(Armor.IsArmor(id))return Armor.Detail(a,id);
            switch(id){
                case "knife":return "A quick cutting weapon for close quarters.";
                case "spear":return "A reach weapon. Recover thrown spears from the arena floor.";
                case "sword":return "A one-handed blade. Carry it with a shield.";
                case "shield":return "Raise it with Guard while wielding a spear or sword to intercept incoming hits.";
                case "crossbow":return "Fires long-range bolts. Keep it equipped to reload between shots.";
                case "bolts":return "Ammunition for a crossbow.";
                case "hatchet":return "Heavy strikes split timber structures.";
                case "sling":return "Uses loose stone as ammunition.";
                case "bow":return "Uses arrows. Hold aim for a steadier shot.";
                case "meal":return "Restores 38 food. Drop a portion to share it.";
                case "waterskin":return WaterVolume(a)+" water stored. Fill at a water source or transfer water at your rain barrel.";
                case "bandage":return "Restores up to 28 health.";
                case "firekit":return "Place on open ground, then light the fire.";
                case "arrows":return "Ammunition for a bow.";
                case "meat":
                    float progress=0;foreach(float value in a.FoodProgress)progress=Math.Max(progress,value);
                    return progress>0?"Cooking progress saved at "+(int)(progress*100)+"%. Finish it at a fire or stove.":"Cook at a lit campfire or arena stove.";
                case "stone":return "Sling ammunition and crafting material.";
                case "branch":return "Timber for structures, fuel and equipment.";
                case "fiber":return "Binding for tools, weapons and structures.";
                case "scrap":return "Salvaged metal for tools and gate hardware.";
                case "cloth":return "Fabric for a sling, bandage or shelter.";
                case "tinder":return "Dry kindling for a campfire kit.";
                default:return "A supply for crafting or building.";
            }
        }
        static string WaterVolume(Actor a){
            return Math.Floor(a.WaterCarried).ToString("0")+"/"+Math.Floor(Survival.WaterCapacity(a)).ToString("0");
        }
        void PackQuick(string id,string label,string value,string key,float x,float y,float w,bool available) {
            bool hot=available&&selected==id;
            Box(x,y,w,36,hot?Color.FromArgb(229,72,75,54):Color.FromArgb(216,31,44,41));
            Edge(x,y,w,36,hot?Gold:A(Brass,82));
            if(available)HitBox(id,x,y,w,36);
            T(key,x+10,y+10,12,available?Gold:Muted,true,true);T(label,x+34,y+7,16,available?Ivory:Muted,true);
            Right(value,x+w-10,y+9,13,available?Gold:Muted,false,true);
        }
        void Pack(Game g){
            float x=(sw-888)/2,y=(sh-524)/2;Box(0,0,sw,sh,A(Ink,75));Box(x,y,888,524,Color.FromArgb(240,17,27,27));Edge(x,y,888,524,A(Brass,150));
            T("Field pack",x+29,y+21,32,Ivory,true,false,true);
            PackQuick("quickmeal","Eat",g.Player.Count("meal")+" meals",g.PadActive?"X":"1",x+235,y+22,163,g.Player.Count("meal")>0&&g.Player.Hunger<99.5f);
            PackQuick("quickdrink","Drink",WaterVolume(g.Player),g.PadActive?"Y":"2",x+409,y+22,171,g.Player.WaterCarried>0&&g.Player.Hydration<99.5f);
            Right(g.PadActive?"A  Use      B  Close":K(g,"Pack")+" / ESC   Close",x+859,y+35,13,Muted,false,true);
            Line(x+29,y+79,x+859,y+79,A(Brass,122));float gx=x+28,gy=y+104;string[] items=Survival.PackItems(g.Player);int visible=12;
            packOffset=Math.Min(Math.Max(0,items.Length-visible),Math.Max(0,packOffset));if(Array.IndexOf(items,packId)<0)packId=items.Length>0?items[packOffset]:"";
            for(int i=0;i<visible;i++){int j=i+packOffset;float bx=gx+(i%4)*111,by=gy+(i/4)*82;bool has=j<items.Length;bool hot=has&&(packId==items[j]||selected=="pack"+i);
                Box(bx,by,103,74,hot?Color.FromArgb(225,60,65,51):Color.FromArgb(210,31,44,41));Edge(bx,by,103,74,hot?Gold:A(Brass,73));if(!has)continue;
                string id=items[j];HitBox("pack"+i,bx,by,103,74);if(g.PadActive&&selected=="pack"+i)Edge(bx+2,by+2,99,70,Ivory);Icon(id,bx+29,by+1,43);Right(id=="waterskin"?WaterVolume(g.Player):"x"+Survival.Count(g.Player,id),bx+96,by+4,11,id=="waterskin"?WaterBlue:Muted,true,true);
                if(Armor.IsArmor(id)){
                    float condition=Armor.Condition(g.Player,id);
                    Box(bx+10,by+65,83,3,A(Muted,64));Box(bx+10,by+65,83*condition,3,condition<.25f?Rust:Gold);
                    if(g.Player.WornArmor==id)T("WORN",bx+5,by+4,10,Gold,true,true);
                }
                string label=Survival.Label(id);float sz=Width(label,12,true)>98?10:12;Mid(label,bx+51.5f,by+49,sz,Ivory,true);}
            if(items.Length==0)T("Your pack is empty. Gather supplies with "+K(g,"Use")+".",gx,gy+267,17,Muted);
            if(items.Length>visible){HitBox("pageback",gx+240,gy+249,90,29);HitBox("pagenext",gx+343,gy+249,90,29);T(g.PadActive?"LB  Prev":"< Previous",gx+242,gy+251,13,Muted);T(g.PadActive?"RB  Next":"Next >",gx+365,gy+251,13,Muted);}
            if(packId!=""){T(Survival.Label(packId),gx,gy+264,21,Ivory,true);Para(PackDetail(g.Player,packId),gx,gy+298,445,42,14,Muted);
                string act=PackAction(g.Player,packId);if(act!="")Action("useitem",act,gx,gy+346,180,44);Action("dropitem",packId=="meal"?"Share meal":"Drop one",gx+(act!=""?196:0),gy+346,154,44);}
            Line(x+499,y+100,x+499,y+486,A(Brass,93));T(Arena.NameOf(g.ArenaId),x+529,y+101,19,Ivory,true);PackMap(g,x+557,y+160,257);
            Mid(g.Zone,x+685,y+442,16,Gold,true);TimeSpan ts=TimeSpan.FromSeconds(Math.Max(0,g.Time));Mid((g.IsNight?"Night ":"Day ")+g.DayNumber+"   /   "+((int)ts.TotalMinutes).ToString("00")+":"+ts.Seconds.ToString("00")+" elapsed",x+685,y+470,12,Muted,false,true);
        }
    }
}









