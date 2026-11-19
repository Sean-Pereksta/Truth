using System;
using System.Collections.Generic;
using System.Drawing;

namespace LastSignal {
    public partial class Config {
        // Canonical button IDs are shared by both Windows controller backends.
        public static readonly string[] PadActions={"Jump","Dodge","Use","Dismiss","Shove","Throw","Attack","Guard","Sprint","Crouch","Craft","Build","Pack","Cycle","Previous weapon","Next weapon"};
        static readonly string[] padDefaults={"A","B","X","Y","RB","LB","RT","LT","LS","RS","Up","Right","Down","Left","Back+LB","Back+RB"};
        public readonly Dictionary<string,string> PadMap=new Dictionary<string,string>();
        public string PadButton(string action){
            string button;if(PadMap.TryGetValue(action,out button))return button;
            if(PadPreset==1){if(action=="Jump")return "B";if(action=="Dodge")return "A";}
            int index=Array.IndexOf(PadActions,action);return index<0?"":padDefaults[index];
        }
        public bool SetPadBinding(string action,string button){
            bool switching=action=="Previous weapon"||action=="Next weapon";
            if(Array.IndexOf(PadActions,action)<0)return false;
            if(switching){
                if(!(button=="Back+LB"||button=="Back+RB"||button=="Back+X"||button=="Back+Y"||button=="Back+A"||button=="Back+B"||button=="Back+Up"||button=="Back+Down"))return false;
            }else if(button.StartsWith("Back+")||Array.IndexOf(padDefaults,button)<0)return false;
            string old=PadButton(action);if(old==button)return true;
            foreach(string other in PadActions){
                if(other!=action&&PadButton(other)==button){PadMap[other]=old;break;}
            }
            PadMap[action]=button;return true;
        }
        public void SetPadPreset(int value){PadPreset=value==1?1:0;PadMap.Clear();}
    }

    public sealed partial class Ui {
        string padBind="";
        public bool PadWaiting(Game g){return g.Panel=="padbinds"&&padBind!="";}
        public bool PadChordWaiting(Game g){return PadWaiting(g)&&(padBind=="Next weapon"||padBind=="Previous weapon");}
        static string PadReadable(string id){if(id.StartsWith("Back+"))return "View + "+PadReadable(id.Substring(5));
            switch(id){case "Up":return "D-pad up";case "Down":return "D-pad down";case "Left":return "D-pad left";case "Right":return "D-pad right";case "LS":return "LS click";case "RS":return "RS click";case "Back":return "View";default:return id;}
        }
        static string PadVerb(string action){
            switch(action){case "Use":return "Interact / harvest";case "Throw":return "Throw spear";case "Attack":return "Attack / draw";case "Guard":return "Guard / aim";case "Jump":return "Jump / vault";case "Cycle":return "Cycle target action";case "Dismiss":return "Dismiss prompt";case "Pack":return "Field pack";default:return action;}
        }
        void PadHelp(Game g,string copy){
            if(g.PadActive)Right(copy,sw-40,sh-37,13,Ivory,false,true);
        }
        void Controller(Game g){
            Backdrop();float x=sw*.065f,y=sh*.107f,w=467;
            string device=g.PadConnected?(string.IsNullOrEmpty(g.PadName)?"Connected controller":g.PadName):"Connect a controller to play";
            Header("Controller",device,x,y);float t=y+108;
            string preset=g.Settings.PadPreset==1?"Tactical":"Standard";if(g.Settings.PadMap.Count>0)preset="Custom";
            Field("padpreset","Button layout",preset,x,t,w);
            Field("padsens","Look sensitivity",g.Settings.PadSensitivity.ToString("0.0")+"x",x,t+51,w);
            Field("padinvert","Invert vertical look",g.Settings.PadInvert?"On":"Off",x,t+102,w);
            Action("padbinds","Gameplay buttons",x,t+167,w,44);
            T("Left stick moves. Right stick looks.",x,t+224,17,Ivory);
            T("Hold View + D-pad left / right to peek.",x,t+251,15,Muted);
            T(PadReadable(g.Settings.PadButton("Previous weapon"))+" / "+PadReadable(g.Settings.PadButton("Next weapon"))+" switch carried weapons.",x,t+274,14,Muted);
            T("Build with A, rotate with LB / RB, keep building with LT + A, or cancel with B.",x,t+296,14,Muted);
            T("Hold "+PadReadable(g.Settings.PadButton("Guard"))+" to raise a shield. Tap to parry with a weapon. Dodge with "+PadReadable(g.Settings.PadButton("Dodge"))+".",x,t+318,14,Muted);
            Action("back","Back",x,t+351,150,42);PadHelp(g,"D-pad  Navigate      A  Select      B  Back");
        }
        void PadBindings(Game g){
            Backdrop(true);float x=(sw-940)/2,y=(sh-536)/2;
            Header("Controller buttons",PadChordWaiting(g)?"Hold View and press a bumper, face button, or D-pad up/down. Menu cancels.":padBind!=""?"Press the replacement button. View cancels.":"Select a gameplay action to assign a button.",x,y);
            int rows=(Config.PadActions.Length+1)/2;float t=y+100;
            for(int i=0;i<Config.PadActions.Length;i++){
                string a=Config.PadActions[i],id="padkey"+a;float bx=x+(i/rows)*480,by=t+(i%rows)*43;bool hot=selected==id||padBind==a;
                HitBox(id,bx,by,445,40);Box(bx,by,445,40,hot?Color.FromArgb(232,60,65,47):A(Ink,212));if(hot)Box(bx,by,3,40,Gold);
                T(PadVerb(a),bx+13,by+9,16,Ivory);Right(padBind==a?"Press button":PadReadable(g.Settings.PadButton(a)),bx+427,by+9,15,Gold,true,true);
            }
            Action("back","Back",x,t+361,155,43);
            PadHelp(g,PadChordWaiting(g)?"Menu  Cancel chord assignment":padBind!=""?"View  Cancel assignment":"D-pad  Navigate      A  Rebind      B  Back");
        }
        public void PadWheel(Game g,float x,float y){
            if(!g.PadActive||(g.Panel!="build"&&g.Panel!="craft")||x*x+y*y<.12f)return;
            Observe(g);int n=g.Panel=="build"?Survival.Builds.Length:Survival.Crafts.Length;
            double phase=(Math.Atan2(x,y)+Math.PI*2+Math.PI/n)%(Math.PI*2);
            selected="slot"+Math.Min(n-1,(int)(phase*n/(2*Math.PI)));hoverMoved=false;
        }
        void FocusPackSlot(Game g){
            if(g.Panel!="pack"||!selected.StartsWith("pack"))return;int i;
            string[] items=Survival.PackItems(g.Player);
            if(int.TryParse(selected.Substring(4),out i)&&i>=0&&i+packOffset<items.Length)packId=items[i+packOffset];
        }
        void PadGrid(Game g,int dx,int dy){
            Hit current=hits.Find(h=>h.Nav&&h.Id==selected);
            if(current==null){Navigate(1);FocusPackSlot(g);return;}
            float cx=current.Rect.Left+current.Rect.Width/2,cy=current.Rect.Top+current.Rect.Height/2,lowest=float.MaxValue;Hit best=null;
            foreach(Hit h in hits){
                if(!h.Nav||h==current)continue;
                float x=h.Rect.Left+h.Rect.Width/2-cx,y=h.Rect.Top+h.Rect.Height/2-cy,fwd=x*dx+y*dy;
                if(fwd<=1)continue;
                float across=Math.Abs(x*dy-y*dx);
                float cost=fwd+1.9f*across+across*across/Math.Max(25,fwd);
                if(cost<lowest){lowest=cost;best=h;}
            }
            if(best!=null)selected=best.Id;FocusPackSlot(g);hoverMoved=false;
        }
        public bool Pad(Game g,string button){
            g.PadActive=true;Observe(g);hoverMoved=false;
            if(PadWaiting(g)){
                if(button=="Start"||button=="Back"&&!PadChordWaiting(g)){padBind="";return true;}
                if(g.Settings.SetPadBinding(padBind,button)){padBind="";Save(g.Settings);}return true;
            }
            if(bind!=""){if(button=="B"||button=="Back"||button=="Start")bind="";return true;}
            if(button=="Start"){
                if(g.Panel=="pause"){Close(g);return true;}
                if(g.Panel==""&&(g.Mode=="match"||g.Mode=="spectate")){g.InputUnfocus();g.Panel="pause";return true;}
            }
            if(g.Mode=="spectate"&&g.Panel==""){
                if(button=="LB"||button=="Left"){g.Spectate(-1);return true;}
                if(button=="RB"||button=="Right"||button=="A"){g.Spectate(1);return true;}
            }
            if(!Captures(g))return false;
            if(OnlinePad(g,button))return true;
            if(button=="B"||button=="Back"){
                if(g.Panel!="")Close(g);else if(g.Mode=="menu")selected="quit";return true;
            }
            if(button=="A"){ActivateSelected(g);return true;}
            if(g.Panel=="pack"){
                if(button=="X"||button=="Y"){Activate(g,button=="X"?"quickmeal":"quickdrink",1);return true;}
                if(button=="LB"||button=="RB"){Activate(g,button=="LB"?"pageback":"pagenext",1);FocusPackSlot(g);return true;}
            }
            int dx=button=="Right"?1:button=="Left"?-1:0,dy=button=="Down"?1:button=="Up"?-1:0;
            if(dx!=0||dy!=0){
                if(g.Panel=="craft"||g.Panel=="build"){StepWheel(g,dx+dy);return true;}
                if(dx!=0&&IsField(Base(selected))){Activate(g,Base(selected),dx);return true;}
                if(g.Panel=="pack"||g.Panel=="bindings"||g.Panel=="padbinds"){PadGrid(g,dx,dy);return true;}
                if(dy!=0)Navigate(dy);return true;
            }
            return true;
        }
    }
}


