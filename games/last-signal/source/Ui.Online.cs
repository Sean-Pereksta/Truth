using System;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace LastSignal {
    public partial class Config {
        public string OnlineName="";
    }

    public sealed partial class Ui {
        string invite="", editValue="", editReturn="", leaveReturn="", onlineNote="";
        bool editFresh, editSymbols, editUpper;
        readonly string[] letterKeys={"abcdefghij","klmnopqrst","uvwxyz0123","456789-._/"};
        readonly string[] symbolKeys={":/?#[]@!$&","'()*+,;=%~","0123456789","abcdefghij"};

        static string PlayerName(string value) {
            var clean=new StringBuilder();
            foreach(char c in value??""){
                if(clean.Length==18)break;
                if(c>='a'&&c<='z'||c>='A'&&c<='Z'||c>='0'&&c<='9'||c==' '||c=='-'||c=='_')clean.Append(c);
            }
            return clean.ToString().Trim();
        }
        public static string OnlinePlayerName(Game g) {
            if(string.IsNullOrEmpty(g.Settings.OnlineName)){
                g.Settings.OnlineName="Rook-"+Guid.NewGuid().ToString("N").Substring(0,4).ToUpperInvariant();
                Save(g.Settings);
            }
            return g.Settings.OnlineName;
        }
        bool Editing(Game g){return g.Panel=="onlineInvite"||g.Panel=="onlineName";}
        string OnlineSelection(Game g,string previous) {
            switch(g.Panel){
                case "multiplayer":return "onlineHost";
                case "onlineBrowse":return "onlineRefresh";
                case "onlineJoin":return invite.Length==0?"onlineEditInvite":"onlineConnect";
                case "onlineInvite":return "onlinePaste";
                case "onlineName":return "char0";
                case "onlineLobby":return g.Online!=null&&g.Online.Phase=="lobby"?(g.Online.IsHost?(g.Online.CanStart?"onlineStart":"onlineCopy"):"onlineReady"):"onlineLeave";
                case "onlineRules":return "arena";
                case "onlineExit":return "onlineStay";
            }
            if(g.NetworkMatch&&g.Mode=="results"&&!g.Online.IsHost)return "leave";
            return previous;
        }
        bool PaintOnline(Game g) {
            switch(g.Panel){
                case "multiplayer":OnlineHome(g);return true;
                case "onlineJoin":OnlineJoin(g);return true;
                case "onlineBrowse":OnlineBrowse(g);return true;
                case "onlineInvite":case "onlineName":OnlineEditor(g);return true;
                case "onlineLobby":OnlineLobby(g);return true;
                case "onlineRules":OnlineRules(g);return true;
                case "onlineExit":OnlineExit(g);return true;
                default:return false;
            }
        }
        void OnlineHome(Game g) {
            Backdrop();float x=sw*.07f,y=sh*.14f;
            Header("Multiplayer","Up to 8 players. Bots fill the remaining platforms in a 24-contestant arena.",x,y);
            Action("onlineHost","Host a match",x,y+115,403,51,true);
            Action("onlineJoinMenu","Join with an invite",x,y+177,403,46);
            Action("onlineFind","Public lobbies",x,y+233,403,46);
            Action("onlineEditName","Player name     "+OnlinePlayerName(g),x,y+301,403,44);
            Action("back","Back",x,y+363,155,42);
            string note=onlineNote;
            if(note==""&&g.Online!=null&&g.Online.Phase=="error")note=g.Online.Status;
            Para(note,x,y+425,650,73,16,Gold);PadHelp(g,"D-pad  Navigate      A  Select      B  Back");
        }
        void OnlineJoin(Game g) {
            Backdrop();float x=sw*.07f,y=sh*.15f;
            Header("Join a match","Enter the invite link shared by the host.",x,y);
            LinkField("onlineEditInvite",invite,x,y+112,670);
            Action("onlineConnect","Join match",x,y+190,254,48,true);
            Action("onlinePaste","Paste invite",x+268,y+190,207,48);
            Action("back","Back",x,y+263,155,42);
            Para(onlineNote,x,y+332,660,75,16,Gold);
            PadHelp(g,"D-pad  Navigate      A  Select      Y  Paste      B  Back");
        }
        void LinkField(string action,string value,float x,float y,float w) {
            bool hot=selected==action;HitBox(action,x,y,w,55);Box(x,y,w,55,A(Ink,230));Edge(x,y,w,55,hot?Gold:Brass);
            string text=string.IsNullOrEmpty(value)?"Enter invite link":Ellipsis(value,w-38,16);
            T(text,x+16,y+17,16,value==""?Muted:Ivory,false,true);
        }
        string Ellipsis(string value,float width,float size){
            if(Width(value,size,false,true)<=width)return value;
            int lo=0,hi=value.Length;while(lo<hi){int mid=(hi+lo+1)/2;if(Width(value.Substring(0,mid)+"…",size,false,true)<=width)lo=mid;else hi=mid-1;}
            return value.Substring(0,lo)+"…";
        }
        void OnlineLobby(Game g) {
            Backdrop(true);float x=sw*.065f,y=sh*.105f;
            OnlineSession s=g.Online;
            if(s==null){Header("Multiplayer","Room connection unavailable.",x,y);Action("onlineLeave","Back",x,y+118,180,44);return;}
            bool lobby=s.Phase=="lobby";
            Header(lobby?"Match lobby":"Connecting",lobby?"Players share one arena. The host starts the round.":s.Status,x,y);
            if(!lobby){
                if(s.Phase=="error")Para(s.Status,x,y+102,760,90,17,Gold);
                Action("onlineLeave",s.Phase=="error"?"Back":"Cancel",x,y+205,180,44);return;
            }
            float row=y+105,w=478;
            T("CONTESTANTS",x,row,13,Gold,true,true);
            int humans=Math.Max(1,Math.Min(8,s.HumanCount));
            string[] roster=s.Roster??new string[0];
            for(int i=0;i<roster.Length&&i<8;i++){
                float lineY=row+30+i*33;Box(x,lineY,w,30,i%2==0?A(Muted,15):A(Ink,66));
                T(Ellipsis(roster[i]??"",w-24,16),x+10,lineY+4,16,Ivory);
            }
            T(humans+" / 8 players      "+(24-humans)+" bots",x,row+315,16,Muted,true,true);
            float side=x+537;
            string link=s.Code??"";
            if(link!=""){
                T("INVITE LINK",side,row,13,Gold,true,true);
                Para(link,side,row+26,485,69,16,Ivory);
                Action("onlineCopy","Copy invite link",side,row+100,370,43);
            }else Para(s.Status,side,row,475,82,16,Muted);
            if(s.IsHost){
                if(s.CanStart)Action("onlineStart","Start match",side,row+168,370,48,true);
                else {Box(side,row+168,370,48,A(Muted,23));T("Waiting for players to ready up",side+14,row+182,17,Muted);}
                Action("onlineRules","Match settings",side,row+226,370,43);
                Action("onlineList",s.IsListed?"Public listing    On":"Public listing    Off",side,row+278,370,43);
                T(Arena.NameOf(g.Settings.ArenaId)+"   /   "+Diff(g.Settings.Difficulty),x,row+343,15,Muted);
            }else Action("onlineReady",s.IsReady?"Ready  ·  Change to not ready":"Ready up",side,row+168,370,48,true);
            Action("onlineLeave",s.IsHost?"Close room":"Leave room",x,row+371,222,43);
            string detail=onlineNote;
            if(detail=="")detail=s.IsHost&&s.IsListed?s.ListingStatus:(link!=""?s.Status:"");
            Para(detail,side,row+343,490,85,15,Gold);
            PadHelp(g,"D-pad  Navigate      A  Select      B  Back");
        }
        void OnlineRules(Game g) {
            Backdrop();float x=sw*.07f,y=sh*.130f;
            Header("Match settings","These settings apply to the next round.",x,y);
            Field("arena","Arena map",Arena.NameOf(g.Settings.ArenaId),x,y+107,485);
            Field("difficulty","Opponent skill",Diff(g.Settings.Difficulty),x,y+160,485);
            Field("hunger","Hunger pressure",Hunger(g.Settings.Hunger),x,y+213,485);
            Field("events","Arena events",g.Settings.Events?"On":"Off",x,y+266,485);
            Action("back","Back to lobby",x,y+335,230,44);
            PadHelp(g,"Left / right  Adjust      A  Select      B  Back");
        }
        void OnlineExit(Game g) {
            Backdrop(true);float x=sw*.14f,y=sh*.25f;
            Header("Close this room?","All connected players will leave the session.",x,y);
            Action("onlineStay","Keep playing",x,y+118,277,48,true);
            Action("onlineEnd","Close room",x,y+178,277,44);
            PadHelp(g,"D-pad  Navigate      A  Select      B  Back");
        }
        void ConfirmLeave(Game g) {
            if(g.Online!=null&&g.Online.IsHost&&g.Online.HumanCount>1&&g.Online.Phase!="error"){
                leaveReturn=g.Panel;g.Panel="onlineExit";return;
            }
            LeaveOnline(g);
        }
        void LeaveOnline(Game g) {
            if(g.Online!=null)g.Online.Leave();else g.Menu();
            g.Panel="multiplayer";onlineNote="";
        }
        bool CloseOnline(Game g) {
            switch(g.Panel){
                case "onlineInvite":case "onlineName":g.Panel=editReturn;return true;
                case "onlineExit":g.Panel=leaveReturn;return true;
                case "onlineRules":g.Panel="onlineLobby";return true;
                case "onlineLobby":ConfirmLeave(g);return true;
                case "onlineJoin":case "onlineBrowse":onlineNote="";g.Panel="multiplayer";return true;
                case "multiplayer":onlineNote="";g.Panel="";return true;
            }
            return false;
        }
        bool ActivateOnline(Game g,string id) {
            if(id=="multiplayer"){g.Panel="multiplayer";onlineNote="";OnlinePlayerName(g);return true;}
            if(!id.StartsWith("online",StringComparison.Ordinal)&&!(Editing(g)&&id.StartsWith("char")))return false;
            if(RoomAction(g,id))return true;
            switch(id){
                case "onlineHost":case "onlineConnect":
                    if(g.Online==null){onlineNote="The network connection is unavailable.";return true;}
                    if(id=="onlineConnect"&&invite.Trim()==""){onlineNote="Enter or paste the host’s invite link.";return true;}
                    onlineNote="";g.Panel="onlineLobby";
                    if(id=="onlineHost")g.Online.Host(OnlinePlayerName(g));
                    else{
                        string endpoint,roomKey;
                        if(!OnlineWire.Invite(invite,out endpoint,out roomKey)){
                            g.Panel="onlineJoin";onlineNote="Paste the complete invite link, including the room key after #.";return true;
                        }
                        g.Online.Join(invite.Trim(),OnlinePlayerName(g));
                    }
                    return true;
                case "onlineJoinMenu":onlineNote="";g.Panel="onlineJoin";return true;
                case "onlineEditInvite":case "onlineEditName":
                    editReturn=g.Panel;editValue=id=="onlineEditInvite"?invite:OnlinePlayerName(g);editFresh=true;editSymbols=editUpper=false;
                    g.Panel=id=="onlineEditInvite"?"onlineInvite":"onlineName";onlineNote="";return true;
                case "onlineLeave":ConfirmLeave(g);return true;
                case "onlineStay":g.Panel=leaveReturn;return true;
                case "onlineEnd":LeaveOnline(g);return true;
                case "onlineReady":onlineNote="";if(g.Online!=null)g.Online.ToggleReady();return true;
                case "onlineStart":if(g.Online!=null&&g.Online.IsHost&&g.Online.CanStart){onlineNote="";g.Online.StartMatch();}return true;
                case "onlineRules":if(g.Online!=null&&g.Online.IsHost)g.Panel="onlineRules";return true;
                case "onlineCopy":
                    if(g.Online!=null&&!string.IsNullOrEmpty(g.Online.Code)){
                        try{Clipboard.SetText(g.Online.Code);onlineNote="Invite copied.";}
                        catch(ExternalException){onlineNote="Clipboard unavailable. Share the link shown above.";}
                        catch(ThreadStateException){onlineNote="Clipboard unavailable. Share the link shown above.";}
                    }return true;
                case "onlinePaste":Paste(g);return true;
                case "onlineShift":editUpper=!editUpper;return true;
                case "onlineSymbols":editSymbols=!editSymbols;return true;
                case "onlineErase":Erase();return true;
                case "onlineSpace":Type(g," ");return true;
                case "onlineDone":
                    if(g.Panel=="onlineName"){string name=PlayerName(editValue);if(name==""){onlineNote="Enter a player name.";return true;}g.Settings.OnlineName=name;Save(g.Settings);}
                    else invite=editValue.Trim();
                    onlineNote="";g.Panel=editReturn;return true;
            }
            if(Editing(g)&&id.StartsWith("char")){
                int index;if(int.TryParse(id.Substring(4),out index)&&index>=0&&index<40)Type(g,EditChar(index).ToString());
                return true;
            }
            return false;
        }
        char EditChar(int index){char c=(editSymbols?symbolKeys:letterKeys)[index/10][index%10];return editUpper?char.ToUpperInvariant(c):c;}
        void OnlineEditor(Game g) {
            Backdrop(true);float x=(sw-806)/2,y=(sh-560)/2;bool name=g.Panel=="onlineName";
            Header(name?"Player name":"Invite link",name?"Shown to the other contestants in the lobby.":"Paste the full link, or enter it below.",x,y);
            Box(x,y+89,805,52,A(Ink,234));Edge(x,y+89,805,52,Brass);
            string text=editValue;
            if(text.Length>82)text="…"+text.Substring(text.Length-82);
            T(Ellipsis(text,773,17)+(editFresh?"":"|"),x+15,y+104,17,Ivory,false,true);
            for(int i=0;i<40;i++){
                float bx=x+(i%10)*69,by=y+166+(i/10)*51;
                EditorKey("char"+i,EditChar(i).ToString(),bx,by,62);
            }
            EditorKey("onlineShift",editUpper?"A → a":"a → A",x,y+374,102);
            EditorKey("onlineSymbols",editSymbols?"ABC":": / ?",x+110,y+374,102);
            EditorKey("onlineErase","Delete",x+220,y+374,121);
            EditorKey("onlineSpace","Space",x+350,y+374,125);
            EditorKey("onlinePaste","Paste",x+484,y+374,102);
            Action("onlineDone","Done",x,y+452,225,46,true);Action("back","Cancel",x+237,y+452,175,46);
            Para(onlineNote,x,y+511,790,42,14,Gold);
            PadHelp(g,"D-pad  Navigate      A  Type      X  Delete      Y  Paste      Menu  Done");
        }
        void EditorKey(string id,string label,float x,float y,float w) {
            bool hot=selected==id;HitBox(id,x,y,w,43);Box(x,y,w,43,hot?Gold:A(Ink,233));Edge(x,y,w,43,hot?Gold:Brass);
            Mid(label,x+w/2,y+10,17,hot?Ink:Ivory,true,true);
        }
        void Erase() {if(editFresh)editValue="";else if(editValue.Length>0)editValue=editValue.Substring(0,editValue.Length-1);editFresh=false;}
        void Type(Game g,string text) {
            if(editFresh){editValue="";editFresh=false;}
            bool name=g.Panel=="onlineName";int max=name?18:2048;
            foreach(char c in text){
                if(editValue.Length>=max)break;
                if(name&&!(c==' '||PlayerName(c.ToString()).Length>0))continue;
                if(!name&&(c<=32||c>=127))continue;
                editValue+=c;
            }
            onlineNote="";
        }
        void Paste(Game g) {
            try{
                string value=Clipboard.ContainsText()?Clipboard.GetText().Trim():"";
                if(value==""){onlineNote="The clipboard is empty.";return;}
                if(!Editing(g)){
                    invite=value.Length>2048?value.Substring(0,2048):value;
                    onlineNote="";selected="onlineConnect";return;
                }
                editFresh=true;Type(g,value);
            }catch(ExternalException){onlineNote="Clipboard unavailable. Enter the invite link.";}
            catch(ThreadStateException){onlineNote="Clipboard unavailable. Enter the invite link.";}
        }
        bool OnlinePad(Game g,string button) {
            if(g.Panel=="onlineBrowse"&&button=="Y"){RoomAction(g,"onlineRefresh");return true;}
            if(!Editing(g)){if(g.Panel=="onlineJoin"&&button=="Y"){Paste(g);return true;}return false;}
            if(button=="X"){Erase();return true;}if(button=="Y"){Paste(g);return true;}
            if(button=="Start"){ActivateOnline(g,"onlineDone");return true;}
            if(button=="Left"||button=="Right"||button=="Up"||button=="Down"){
                PadGrid(g,button=="Left"?-1:button=="Right"?1:0,button=="Up"?-1:button=="Down"?1:0);return true;
            }
            return false;
        }
        bool OnlineKey(Game g,Keys key) {
            if(!Editing(g)&&g.Panel!="onlineJoin")return false;
            if(key==Keys.V&&(Control.ModifierKeys&Keys.Control)!=0){Paste(g);return true;}
            if(!Editing(g))return false;
            if(key==Keys.Back){Erase();return true;}
            if(key==Keys.Return){ActivateOnline(g,"onlineDone");return true;}
            if(key==Keys.Escape||key==Keys.Tab)return false;
            if(key==Keys.Left||key==Keys.Up||key==Keys.Right||key==Keys.Down){PadGrid(g,key==Keys.Left?-1:key==Keys.Right?1:0,key==Keys.Up?-1:key==Keys.Down?1:0);return true;}
            string value=TypedKey(key);if(value!="")Type(g,value);return true;
        }
        [DllImport("user32.dll")]static extern bool GetKeyboardState(byte[] state);
        [DllImport("user32.dll")]static extern uint MapVirtualKey(uint key,uint type);
        [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern int ToUnicode(uint key,uint scan,byte[] state,StringBuilder result,int length,uint flags);
        static string TypedKey(Keys key) {
            var state=new byte[256];if(!GetKeyboardState(state))return "";
            if((state[(int)Keys.ControlKey]&128)!=0||(state[(int)Keys.Menu]&128)!=0)return "";
            var chars=new StringBuilder(5);int length=ToUnicode((uint)key,MapVirtualKey((uint)key,0),state,chars,5,0);
            return length>0?chars.ToString(0,length):"";
        }
    }
}
