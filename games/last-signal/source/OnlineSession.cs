using System;
using System.Collections.Generic;

namespace LastSignal {
    // The local host is the only authority for inventory, combat, AI and match time.
    // Clients share one arena and submit the same input protocol from Windows or a browser.
    public sealed class OnlineSession : IDisposable {
        sealed class Seat {
            public string Name,Resume;
            public int Peer=-1,LastSequence=-1;
            public int MobileEncoding,WorldRound;
            public bool Ready;
            public float LostAt,ReceivedAt,Credit=75;
        }
        readonly Game game;
        readonly Seat[] seats=new Seat[8];
        readonly Dictionary<int,float> handshakes=new Dictionary<int,float>();
        readonly Dictionary<int,float> rejected=new Dictionary<int,float>();
        readonly List<string> commands=new List<string>();
        readonly MobileFrames mobileFrames=new MobileFrames();
        OnlineListener listener;
        OnlineTransport client;
        readonly Func<string,OnlineTransport> dial;
        OnlineTunnel tunnel;
        string key="",publicKey="",username="",resume="",url="",localOrigin="";
        bool liveFrame,localOnly,retrying;
        float now,deadline,retryAt,frameElapsed,inputElapsed,lastFrameAt,joinStarted;
        int sequence,round,seatIndex=-1;
        public string Phase{get;private set;}
        public string Code{get;private set;}
        public string Endpoint{get;private set;}
        public string Status{get;private set;}
        public bool IsHost{get;private set;}
        public bool IsReady{get;private set;}
        public bool CanStart{get;private set;}
        public int HumanCount{get;private set;}
        public string[] Roster{get;private set;}
        public int SeatIndex{get{return seatIndex;}}
        public readonly OnlineDirectory Directory=new OnlineDirectory();
        public bool IsListed{get;private set;}
        public string ListingStatus{get{return IsListed && (tunnel==null||string.IsNullOrEmpty(tunnel.PublicOrigin))?"Waiting for the public tunnel.":Directory.HostStatus;}}
        public string LocalInvite{get{return localOrigin.Length==0?"":localOrigin+"/#"+key;}}
        public OnlineSession(Game g):this(g,ConnectWebSocket){}
        internal OnlineSession(Game g,Func<string,OnlineTransport> dialer){game=g;dial=dialer;Phase="idle";Status=Code=Endpoint="";Roster=new string[0];}
        static OnlineTransport ConnectWebSocket(string url){
            var connection=new OnlineTransport();
            try{connection.Connect(url);return connection;}catch{connection.Dispose();throw;}
        }

        public void Host(string name){Host(name,true);}
        public void Host(string name,bool publish){
            Shutdown();username=OnlineWire.Name(name);localOnly=!publish;
            try{
                listener=new OnlineListener();
                int port=listener.Start(0);localOrigin="http://127.0.0.1:"+port;
                key=OnlineWire.Token();IsHost=true;seatIndex=0;
                seats[0]=new Seat{Name=username,Ready=true};IsReady=true;
                if(publish){tunnel=new OnlineTunnel();tunnel.Start(port,listener.InstanceId);}
                EnterLobby();RefreshHost();HostAddress();
            }catch(Exception ex){Fail("Could not open the host. "+ex.Message);}
        }
        public void Join(string invite,string name){
            string remote,room;
            if(!OnlineWire.Invite(invite,out remote,out room)){Status="Paste the complete invite, including the room key after #.";return;}
            Shutdown();username=OnlineWire.Name(name);Code=invite.Trim();url=remote;key=room;
            Endpoint=new Uri(remote).Authority;Phase="connecting";game.Panel="onlineLobby";
            Status="Connecting to host…";deadline=now+18;Connect();
        }
        void Connect(){
            if(client!=null)client.Dispose();
            joinStarted=now;
            try{client=dial(url);}catch(Exception e){Fail("Could not connect. "+e.GetBaseException().Message);}
        }
        void HostAddress(){
            if(!IsHost)return;
            string origin=tunnel==null?"":tunnel.PublicOrigin;
            if(!string.IsNullOrEmpty(origin)){
                Endpoint=origin.TrimEnd('/');Code=Endpoint+"/#"+key;
                Status=Phase=="lobby"?"Invite friends, then start when everyone is ready.":"Hosting online";
            }else{
                Endpoint=localOrigin;
                Code=localOnly||tunnel!=null&&tunnel.Failed?LocalInvite:"";
                Status=localOnly?"Local room on this PC":tunnel==null?"Opening tunnel…":
                    tunnel.Failed?"Public tunnel unavailable. The local invite works on this PC. "+tunnel.Status:tunnel.Status;
            }
            if(IsListed&&Phase=="lobby"&&!string.IsNullOrEmpty(origin)&&HumanCount<8){
                if(publicKey.Length==0)publicKey=OnlineWire.Token();
                Directory.Update(origin,publicKey,username,HumanCount,Arena.NameOf(game.Settings.ArenaId));
            }else Directory.Unlist();
        }
        public void ListPublic(bool listed){
            if(!IsHost||Phase!="lobby")return;
            IsListed=listed;publicKey=listed?OnlineWire.Token():"";
            HostAddress();
        }
        void EnterLobby(){
            if(game.Mode!="menu")game.Menu();game.Panel="onlineLobby";Phase="lobby";liveFrame=false;
            commands.Clear();inputElapsed=frameElapsed=0;
        }
        public void ToggleReady(){
            if(Phase=="lobby"&&!IsHost&&client!=null)client.SendText("READY|"+(IsReady?"0":"1"));
        }
        public void StartMatch(){
            if(!IsHost||!CanStart||Phase!="lobby")return;
            string[] names=new string[8];
            for(int i=0;i<8;i++)if(seats[i]!=null){names[i]=seats[i].Name;seats[i].LastSequence=-1;seats[i].WorldRound=0;}
            round++;int seed=game.ForcedSeed!=0?game.ForcedSeed:((Guid.NewGuid().GetHashCode()&0x3fffffff)+1);
            game.StartOnlineRound(names,seed,game.Settings.ArenaId,game.Settings.Difficulty,game.Settings.Hunger,game.Settings.Events);
            mobileFrames.Clear();
            Phase="playing";publicKey="";Directory.Unlist();game.Panel="";CanStart=false;frameElapsed=0;
            ToAll("ROUND|"+round);BroadcastFrame();
        }
        public void Replay(){
            if(!IsHost||Phase!="playing"||game.Winner==null)return;
            for(int s=1;s<8;s++)if(seats[s]!=null){if(seats[s].Peer<0)seats[s]=null;else seats[s].Ready=false;}
            mobileFrames.Clear();
            EnterLobby();RefreshHost();HostAddress();
        }
        public void Command(string verb,string arg){
            if(IsHost||Phase!="playing"||!liveFrame||commands.Count>=24||string.IsNullOrEmpty(verb))return;
            string action=String.IsNullOrEmpty(arg)?verb:verb+":"+arg;
            if(action.Length>0&&action.Length<=60)commands.Add(action);
        }
        public bool Pump(float dt){
            now+=dt;
            if(listener!=null){
                HostAddress();OnlinePeerPacket p;
                for(int n=0;n<512&&listener.TryRead(out p);n++)HostMessage(p);
                Expire();
                if(Phase=="playing"){
                    game.Tick(dt);frameElapsed+=dt;
                    if(frameElapsed>=1f/12){frameElapsed-=1f/12;BroadcastFrame();}
                    return true;
                }
                return false;
            }
            if(client==null)return false;
            OnlinePacket msg;byte[] latest=null;
            for(int n=0;n<160&&client!=null&&client.TryRead(out msg);n++){
                if(msg.Kind==OnlinePacketKind.Binary){if(Phase=="playing")latest=msg.Data;}
                else {if(msg.Kind==OnlinePacketKind.Text&&msg.Text.StartsWith("LOBBY|",StringComparison.Ordinal))latest=null;ClientMessage(msg);}
            }
            if(client==null)return false;
            if(latest!=null&&Phase=="playing"&&OnlineSnapshot.Apply(game,latest,seatIndex)){
                if(!liveFrame&&game.Panel=="onlineLobby")game.Panel="";
                lastFrameAt=now;liveFrame=true;
            }
            if(retrying||Phase=="connecting"){
                if(now>deadline){Fail("Connection lost. Ask the host for the current invite.");return false;}
                if(retrying&&now>=retryAt){retryAt=now+3;Connect();}
                return true;
            }
            if(Phase=="playing"){
                if(!liveFrame&&now-joinStarted>18||liveFrame&&now-lastFrameAt>12){Reconnect();return true;}
                if(liveFrame){
                    OnlineSnapshot.Present(game,dt);
                    inputElapsed+=dt;
                    if(inputElapsed>=1f/30-.00001f||commands.Count>0){
                        inputElapsed=0;var sample=game.SampleOnlineInput();sample.Sequence=++sequence;
                        sample.Actions.AddRange(commands);
                        if(client.SendBinary(OnlineWire.Input(round,sample)))commands.Clear();
                    }
                }
                return true;
            }
            return false;
        }
        void HostMessage(OnlinePeerPacket m){
            int peer=m.Peer;
            if(m.Kind==OnlinePacketKind.Open){handshakes[peer]=now+8;return;}
            if(m.Kind==OnlinePacketKind.Closed){DropPeer(peer,false);return;}
            if(rejected.ContainsKey(peer))return;
            int id=FindPeer(peer);
            if(id<0){
                if(!handshakes.ContainsKey(peer))return;
                if(m.Kind!=OnlinePacketKind.Text||m.Text==null||m.Text.Length>220){Deny(peer,"Invalid join request.");return;}
                string[] h=m.Text.Split('|');
                if(h.Length!=5||h[0]!="JOIN"||h[1]!=OnlineWire.Version){Deny(peer,"Install the same version of Last Signal as the host.");return;}
                bool returning=false;
                if(h[4].Length==24)for(int i=1;i<8;i++)if(seats[i]!=null&&seats[i].Resume==h[4]){returning=true;break;}
                bool listed=Phase=="lobby"&&IsListed&&publicKey.Length==24&&h[2]==publicKey;
                if(h[2]!=key&&!listed&&!returning){Deny(peer,"The room invite is invalid or expired.");return;}
                int open=-1;
                if(h[4].Length>0){
                    for(int i=1;i<8;i++)if(seats[i]!=null&&seats[i].Resume==h[4]){open=i;break;}
                    if(open<0){Deny(peer,"Your seat expired. Join again in the next lobby.");return;}
                    int old=seats[open].Peer;if(old>=0){seats[open].Peer=-1;listener.Disconnect(old);}
                }else{
                    if(Phase!="lobby"){Deny(peer,"Round in progress. Join when the host returns to the lobby.");return;}
                    for(int i=1;i<8;i++)if(seats[i]==null){open=i;break;}
                    if(open<0){Deny(peer,"All eight contestant seats are taken.");return;}
                    seats[open]=new Seat{Name=OnlineWire.Name(h[3]),Resume=OnlineWire.Token()};
                }
                handshakes.Remove(peer);
                Seat s=seats[open];s.Peer=peer;s.LastSequence=-1;s.ReceivedAt=now;s.Credit=75;
                s.MobileEncoding=listener.MobileEncoding(peer);s.WorldRound=0;
                listener.SendText(peer,"SEAT|"+open+"|"+s.Resume);
                if(Phase=="playing"){game.SetOnlineSeatConnected(open,true);listener.SendText(peer,"ROUND|"+round);}
                RefreshHost();
                if(Phase=="playing"){
                    if(s.MobileEncoding>0)SendMobileFrame(open,s);
                    else listener.SendBinary(peer,OnlineSnapshot.Capture(game));
                }
                return;
            }
            Seat seat=seats[id];
            seat.Credit=Math.Min(90,seat.Credit+Math.Max(0,now-seat.ReceivedAt)*60);
            seat.ReceivedAt=now;if(--seat.Credit<0){Deny(peer,"Input rate exceeded.");return;}
            if(m.Kind==OnlinePacketKind.Text){
                if(m.Text=="LEAVE"){DropPeer(peer,true);listener.Disconnect(peer);}
                else if(Phase=="lobby"&&(m.Text=="READY|0"||m.Text=="READY|1")){seat.Ready=m.Text=="READY|1";RefreshHost();}
                return;
            }
            if(Phase!="playing"||m.Kind!=OnlinePacketKind.Binary)return;
            OnlinePlayerInput input;
            if(!OnlineWire.ReadInput(m.Data,round,out input)||input.Sequence<=seat.LastSequence)return;
            seat.LastSequence=input.Sequence;game.ApplyOnlineInput(id,input);
        }
        void DropPeer(int peer,bool voluntary){
            handshakes.Remove(peer);rejected.Remove(peer);
            int i=FindPeer(peer);if(i<0)return;
            var seat=seats[i];seat.Peer=-1;seat.LostAt=now;
            if(voluntary){if(Phase=="playing")game.ReleaseOnlineSeat(i);seats[i]=null;}
            else{if(Phase=="playing")game.SetOnlineSeatConnected(i,false);else seat.Ready=false;}
            RefreshHost();
        }
        void Expire(){
            var close=new List<int>();
            foreach(var entry in handshakes)if(now>entry.Value)close.Add(entry.Key);
            foreach(var entry in rejected)if(now>entry.Value)close.Add(entry.Key);
            foreach(int peer in close){handshakes.Remove(peer);rejected.Remove(peer);listener.Disconnect(peer);}
            for(int i=1;i<8;i++)if(seats[i]!=null&&seats[i].Peer<0&&now-seats[i].LostAt>16){
                if(Phase=="playing")game.ReleaseOnlineSeat(i);seats[i]=null;RefreshHost();
            }
        }
        int FindPeer(int peer){for(int i=1;i<seats.Length;i++)if(seats[i]!=null&&seats[i].Peer==peer)return i;return -1;}
        void Deny(int peer,string why){listener.SendText(peer,"ERROR|"+why);handshakes.Remove(peer);rejected[peer]=now+.3f;}
        void RefreshHost(){
            var labels=new List<string>();var parts=new List<string>();CanStart=Phase=="lobby";
            for(int i=0;i<8;i++)if(seats[i]!=null){
                Seat s=seats[i];if(!s.Ready||(i>0&&s.Peer<0))CanStart=false;
                string suffix=i==0?"Host":s.Peer<0?"Reconnecting":s.Ready?"Ready":"In lobby";
                labels.Add(s.Name+"  ·  "+suffix);parts.Add(i+","+suffix+","+s.Name);
            }
            Roster=labels.ToArray();HumanCount=Roster.Length;
            ToAll((Phase=="lobby"?"LOBBY|":"ROSTER|")+string.Join("|",parts.ToArray()));
        }
        void ToAll(string text){
            for(int i=1;i<8;i++)if(seats[i]!=null&&seats[i].Peer>=0)listener.SendText(seats[i].Peer,text);
        }
        void BroadcastFrame(){
            byte[] frame=null;
            for(int i=1;i<8;i++)if(seats[i]!=null&&seats[i].Peer>=0){
                if(seats[i].MobileEncoding>0){SendMobileFrame(i,seats[i]);continue;}
                if(frame==null)frame=OnlineSnapshot.Capture(game);
                listener.SendLatestBinary(seats[i].Peer,frame);
            }
        }
        void SendMobileFrame(int id,Seat seat){
            bool gzip=seat.MobileEncoding==2;
            if(seat.WorldRound!=round){
                if(!listener.SendBinary(seat.Peer,mobileFrames.World(game,round,gzip)))return;
                seat.WorldRound=round;
            }
            byte[] frame=mobileFrames.Frame(game,id,round,gzip);
            if(frame!=null)listener.SendLatestBinary(seat.Peer,frame);
        }
        void ClientMessage(OnlinePacket m){
            if(m.Kind==OnlinePacketKind.Open){client.SendText("JOIN|"+OnlineWire.Version+"|"+key+"|"+username+"|"+resume);return;}
            if(m.Kind==OnlinePacketKind.Closed){
                if(resume.Length==0){Fail("Could not join. "+m.Text);return;}
                if(!retrying)Reconnect();return;
            }
            if(m.Kind!=OnlinePacketKind.Text||m.Text==null||m.Text.Length>2000)return;
            string[] v=m.Text.Split('|');
            if(v.Length==2&&v[0]=="ERROR"){Fail(v[1]);return;}
            if(v.Length==3&&v[0]=="SEAT"){
                int i;if(!int.TryParse(v[1],out i)||i<1||i>7||v[2].Length!=24){Fail("Unexpected seat from host.");return;}
                seatIndex=i;resume=v[2];retrying=false;sequence=0;return;
            }
            if(seatIndex<1)return;
            if(v.Length==2&&v[0]=="ROUND"){
                if(!int.TryParse(v[1],out round)){Fail("Unexpected round from host.");return;}
                Phase="playing";liveFrame=false;commands.Clear();game.Panel="onlineLobby";Status="Entering arena…";joinStarted=now;return;
            }
            if(v.Length<2||v.Length>9||(v[0]!="LOBBY"&&v[0]!="ROSTER"))return;
            if(v[0]=="LOBBY"&&Phase!="lobby")EnterLobby();
            var list=new List<string>();
            for(int i=1;i<v.Length;i++){
                string[] p=v[i].Split(',');int s;if(p.Length!=3||!int.TryParse(p[0],out s)||s<0||s>7)continue;
                list.Add(p[2]+"  ·  "+p[1]);if(s==seatIndex)IsReady=p[1]=="Ready";
            }
            Roster=list.ToArray();HumanCount=Roster.Length;Status=IsReady?"Ready. Waiting for the host.":"Mark yourself ready to join the round.";
        }
        void Reconnect(){
            retrying=true;deadline=now+15;retryAt=now;commands.Clear();liveFrame=false;
            Status="Reconnecting to your seat…";Phase="connecting";game.Panel="onlineLobby";game.Unfocus();
        }
        void Fail(string reason){Shutdown();game.Menu();game.Panel="multiplayer";Phase="error";Status=reason;}
        public void Leave(){if(client!=null)client.SendText("LEAVE");Shutdown();game.Menu();}
        void Shutdown(){
            IsListed=false;publicKey="";Directory.Unlist();
            mobileFrames.Clear();
            if(listener!=null){ToAll("ERROR|The host closed this room.");listener.Dispose();listener=null;}
            if(client!=null){client.Dispose();client=null;}
            if(tunnel!=null){tunnel.Dispose();tunnel=null;}
            Array.Clear(seats,0,seats.Length);handshakes.Clear();rejected.Clear();commands.Clear();
            IsHost=IsReady=CanStart=retrying=liveFrame=false;seatIndex=-1;HumanCount=0;
            round=sequence=0;Code=Endpoint=Status=localOrigin=resume=key=url="";Phase="idle";Roster=new string[0];
        }
        public void Dispose(){Shutdown();Directory.Dispose();}
    }
}
