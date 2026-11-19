using System;
using System.Collections.Generic;
using System.Windows.Forms;

namespace LastSignal {
    public sealed partial class Ui {
        public bool Looking { get; private set; }
        public void EndLook(){Looking=false;}
        public bool Click(Game g,int x,int y,MouseButtons button){
            MouseMove(x,y);Observe(g);
            if(bind!=""){Keys key=button==MouseButtons.Left?Keys.LButton:button==MouseButtons.Right?Keys.RButton:button==MouseButtons.Middle?Keys.MButton:button==MouseButtons.XButton1?Keys.XButton1:Keys.XButton2;ChangeBinding(g,key);return true;}
            if(PadWaiting(g)){if(button==MouseButtons.Right)padBind="";return true;}if(!Captures(g))return false;if(button==MouseButtons.Right&&(g.Panel=="craft"||g.Panel=="build")){Looking=true;return true;}if(button==MouseButtons.Right&&g.Panel=="pack"){Close(g);return true;}
            if(button!=MouseButtons.Left)return true;string id=At(x*fx,y*fy);if(id!=""){selected=id;Activate(g,id,1);}hoverMoved=false;return true;
        }
        public bool Scroll(Game g,int delta){
            if(!Captures(g))return false;int d=delta>0?-1:1;
            if(g.Panel=="pack"){packOffset=Math.Max(0,Math.Min(Math.Max(0,Survival.PackItems(g.Player).Length-12),packOffset+4*d));}
            else if(g.Panel=="craft"||g.Panel=="build")StepWheel(g,d);
            else Navigate(d);return true;
        }
        static void AssignKey(Config c,string action,Keys key){
            Keys previous=c.KeysMap[action];string duplicate=null;
            foreach(var kv in c.KeysMap)if(kv.Key!=action&&kv.Value==key){duplicate=kv.Key;break;}
            if(duplicate!=null)c.KeysMap[duplicate]=previous;c.KeysMap[action]=key;
        }
        void ChangeBinding(Game g,Keys key){
            if(key==Keys.Escape){bind="";return;}if(key==Keys.None)return;
            AssignKey(g.Settings,bind,key);bind="";Save(g.Settings);
        }
        public bool Key(Game g,Keys key){
            Observe(g);key=key&Keys.KeyCode;if(PadWaiting(g)){if(key==Keys.Escape)padBind="";return true;}
            if(bind!=""){ChangeBinding(g,key);return true;}
            if(OnlineKey(g,key))return true;
            if(key==Keys.Escape){
                if(g.Panel!="")Close(g);else if(g.Mode=="match"&&g.BuildId!="")g.InputCancel();else if(g.Mode=="match"||g.Mode=="spectate"){g.InputUnfocus();g.Panel="pause";}else if(g.Mode=="menu")selected="quit";return true;
            }
            if(g.Panel==""&&g.Mode=="spectate"&&(key==Keys.Left||key==Keys.Right||key==Keys.Return)){g.Spectate(key==Keys.Left?-1:1);return true;}
            if(!Captures(g))return false;
            if(g.Panel=="craft"||g.Panel=="build"){
                string a=g.Panel=="craft"?"Craft":"Build";
                if(key==g.Settings.KeysMap[a]){g.Panel="";return true;}
                if(key==g.Settings.KeysMap["Dismiss"]){g.Dismissed=true;return true;}
                if(key==Keys.D0||key==Keys.NumPad0){Activate(g,"slot9",1);return true;}
                if(key>=Keys.D1&&key<=Keys.D9){Activate(g,"slot"+((int)key-(int)Keys.D1),1);return true;}
                if(key>=Keys.NumPad1&&key<=Keys.NumPad9){Activate(g,"slot"+((int)key-(int)Keys.NumPad1),1);return true;}
                if(key==Keys.Left||key==Keys.Up){StepWheel(g,-1);return true;}if(key==Keys.Right||key==Keys.Down){StepWheel(g,1);return true;}
            }
            if(g.Panel=="pack"&&key==g.Settings.KeysMap["Pack"]){Close(g);return true;}
            if(g.Panel=="pack"&&(key==Keys.D1||key==Keys.NumPad1||key==Keys.D2||key==Keys.NumPad2)){Activate(g,key==Keys.D1||key==Keys.NumPad1?"quickmeal":"quickdrink",1);return true;}
            if(g.Panel=="pack"&&(key==Keys.Up||key==Keys.Down||key==Keys.Left||key==Keys.Right)){
                PadGrid(g,key==Keys.Right?1:key==Keys.Left?-1:0,key==Keys.Down?1:key==Keys.Up?-1:0);return true;
            }
            if(key==Keys.Return||key==Keys.Space){ActivateSelected(g);return true;}
            if(key==Keys.Up||key==Keys.Down){Navigate(key==Keys.Up?-1:1);return true;}
            if(key==Keys.Left||key==Keys.Right){int d=key==Keys.Left?-1:1;if(IsField(Base(selected)))Activate(g,Base(selected),d);else if(g.Panel=="bindings"||g.Panel=="pack")Navigate(d);return true;}
            if(key==Keys.Tab){Navigate((Control.ModifierKeys&Keys.Shift)!=0?-1:1);return true;}
            return true;
        }
        void StepWheel(Game g,int d){
            int n=g.Panel=="craft"?Survival.Crafts.Length:Survival.Builds.Length;if(n==0)return;
            int i=0;if(selected.StartsWith("slot"))int.TryParse(selected.Substring(4),out i);selected="slot"+((i+d+n)%n);hoverMoved=false;
        }
        void Navigate(int d){
            var choices=new List<string>();foreach(Hit h in hits)if(h.Nav&&!choices.Contains(h.Id))choices.Add(h.Id);if(choices.Count==0)return;
            int i=choices.IndexOf(Base(selected));if(i<0)i=d>0?-1:0;selected=choices[(i+d+choices.Count)%choices.Count];hoverMoved=false;
        }
        static string Base(string s){if(s.EndsWith("+")||s.EndsWith("-"))return s.Substring(0,s.Length-1);return s;}
        static bool IsField(string k){return k=="arena"||k=="bots"||k=="difficulty"||k=="hunger"||k=="events"||k=="fov"||k=="sensitivity"||k=="bob"||k=="padpreset"||k=="padsens"||k=="padinvert";}
        void ActivateSelected(Game g){
            if(g.Panel=="pack"&&selected.StartsWith("pack")){
                FocusPackSlot(g);
                if(packId!=""&&PackAction(g.Player,packId)!=""){Activate(g,"useitem",1);return;}
            }
            Activate(g,selected,1);
        }
        void Close(Game g){
            if(CloseOnline(g))return;
            if(g.Panel=="padbinds"){g.Panel="controller";return;}
            if(g.Panel=="bindings"||g.Panel=="controller"){g.Panel="settings";return;}
            if(g.Panel=="settings"){g.Panel=backPanel;Save(g.Settings);return;}
            g.Panel="";
        }
        void Activate(Game g,string id,int step){
            if(string.IsNullOrEmpty(id))return;
            if(id.EndsWith("-"))step=-1;string k=Base(id);
            if(ActivateOnline(g,k))return;
            if(IsField(k)){
                Config c=g.Settings;
                if(k=="arena")c.ArenaId=(c.ArenaId+step+3)%3;
                if(k=="bots")c.Bots=(int)Clamp(c.Bots+step,1,23);
                if(k=="difficulty")c.Difficulty=(c.Difficulty+step+4)%4;
                if(k=="hunger")c.Hunger=(c.Hunger+step+3)%3;
                if(k=="events")c.Events=!c.Events;
                if(k=="padsens")c.PadSensitivity=(float)Math.Round(Clamp(c.PadSensitivity+step*.1f,.25f,3f),2);
                if(k=="padinvert")c.PadInvert=!c.PadInvert;
                if(k=="padpreset")c.SetPadPreset(c.PadMap.Count>0?c.PadPreset:1-c.PadPreset);
                if(k=="fov")c.Fov=Clamp(c.Fov+step*2,55,105);
                if(k=="sensitivity")c.Sensitivity=(float)Math.Round(Clamp(c.Sensitivity+step*.1f,.2f,3),1);
                if(k=="bob")c.Bob=(float)Math.Round(Clamp(c.Bob+step*.1f,0,1),1);
                Save(c);selected=k;return;
            }
            if(k=="play"){g.Start(false);return;}if(k=="startcustom"){g.Start(true);return;}
            if(k=="custom"){g.Panel="custom";return;}if(k=="settings"){backPanel=g.Panel;g.Panel="settings";return;}
            if(k=="controller"||k=="padbinds"){g.Panel=k;return;}if(k.StartsWith("padkey")&&g.Panel=="padbinds"){padBind=k.Substring(6);return;}
            if(k=="bindings"){g.Panel="bindings";return;}if(k.StartsWith("key")&&g.Panel=="bindings"){bind=k.Substring(3);return;}
            if(k=="back"||k=="resume"){Close(g);return;}if(k=="leave"){if(g.NetworkMatch)ConfirmLeave(g);else g.Menu();return;}if(k=="quit"){g.Quit=true;return;}
            if(k=="replay"){if(g.NetworkMatch){if(g.Mode=="results"&&g.Online.IsHost)g.Online.Replay();}else g.Replay();return;}if(k=="spectate"){g.Spectate(1);return;}
            if(k.StartsWith("slot")&&(g.Panel=="craft"||g.Panel=="build")){
                int n;if(!int.TryParse(k.Substring(4),out n)||n<0)return;bool build=g.Panel=="build";var recipes=build?Survival.Builds:Survival.Crafts;if(n>=recipes.Length)return;
                selected=k;hoverMoved=false;
                if(g.InputRecipe(recipes[n],build))g.Panel="";return;
            }
            if(g.Panel=="pack"){
                if(k=="quickmeal"||k=="quickdrink"){string idToUse=k=="quickmeal"?"meal":"waterskin";if(g.InputUseItem(idToUse))g.Panel="";return;}
                string[] items=Survival.PackItems(g.Player);
                if(k=="pagenext"||k=="pageback"){packOffset=Math.Max(0,Math.Min(Math.Max(0,items.Length-12),packOffset+(k=="pagenext"?12:-12)));return;}
                if(k.StartsWith("pack")){int n;if(int.TryParse(k.Substring(4),out n)&&n>=0&&n+packOffset<items.Length)packId=items[n+packOffset];return;}
                if(packId==""||Array.IndexOf(items,packId)<0)return;
                if(k=="useitem"){if(PackAction(g.Player,packId)=="View recipes"){g.Panel="craft";Observe(g);for(int i=0;i<Survival.Crafts.Length;i++)if(Survival.Crafts[i].Needs.ContainsKey(packId)){selected="slot"+i;break;}}else if(g.InputUseItem(packId)&&!Armor.IsArmor(packId))g.Panel="";return;}if(k=="dropitem"){g.InputDrop(packId);return;}
            }
        }
    }
}







