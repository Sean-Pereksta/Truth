using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net;
using System.Net.WebSockets;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using LastSignal;

class TestMobile {
    static readonly JavaScriptSerializer Json=new JavaScriptSerializer {MaxJsonLength=1048576};
    static readonly Encoding Utf8=new UTF8Encoding(false,true);
    static Game game;
    static OnlineSession room;
    static string origin,roomKey;
    static OnlineListener pipeListener;

    sealed class Message {
        public string Text;
        public Dictionary<string,object> Data;
    }
    sealed class ReplyHeaders {
        public int Status;
        public string Location="",ContentType="",ContentEncoding="";
    }

    static void Check(bool condition,string message) {
        if(!condition)throw new Exception(message);
    }
    static void Until(Func<bool> done,string pending,int seconds=18) {
        var watch=Stopwatch.StartNew();
        while(!done()) {
            Check(room.Phase!="error",room.Status);
            Check(watch.Elapsed.TotalSeconds<seconds,"Timed out: "+pending);
            room.Pump(1f/30);
            Thread.Sleep(18);
        }
    }
    static string PipeRequest(Stream pipe,string path,string browserOrigin,string headers="") {
        string request="GET "+path+" HTTP/1.1\r\nHost: "+new Uri(origin).Authority+"\r\n"+
            (browserOrigin==null?"":"Origin: "+browserOrigin+"\r\n")+headers+"\r\n";
        byte[] bytes=Encoding.ASCII.GetBytes(request);
        pipe.Write(bytes,0,bytes.Length);
        var reply=Task.Run(delegate {
            var output=new StringBuilder();
            while(output.Length<16384) {
                int value=pipe.ReadByte();
                if(value<0)throw new EndOfStreamException("Incomplete local HTTP response.");
                output.Append((char)value);
                if(value==10&&output.Length>=4&&output.ToString(output.Length-4,4)=="\r\n\r\n")
                    return output.ToString();
            }
            throw new IOException("Overlong local HTTP response.");
        });
        Check(reply.Wait(TimeSpan.FromSeconds(8)),"Local HTTP request timed out.");
        return reply.GetAwaiter().GetResult();
    }
    static ReplyHeaders Get(string path,string browserOrigin=null) {
        if(pipeListener!=null)using(var pipe=OnlinePipe.Open(pipeListener)) {
            string[] parts=PipeRequest(pipe,path,browserOrigin).Split(new[]{"\r\n"},StringSplitOptions.None);
            var values=new ReplyHeaders {Status=int.Parse(parts[0].Split(' ')[1])};
            values.Location=parts.Where(line=>line.StartsWith("Location: ",StringComparison.OrdinalIgnoreCase))
                .Select(line=>line.Substring(10)).FirstOrDefault()??"";
            values.ContentType=parts.Where(line=>line.StartsWith("Content-Type: ",StringComparison.OrdinalIgnoreCase))
                .Select(line=>line.Substring(14)).FirstOrDefault()??"";
            values.ContentEncoding=parts.Where(line=>line.StartsWith("Content-Encoding: ",StringComparison.OrdinalIgnoreCase))
                .Select(line=>line.Substring(18)).FirstOrDefault()??"";
            return values;
        }
        var request=(HttpWebRequest)WebRequest.Create(origin+path);
        request.Timeout=15000;
        request.AllowAutoRedirect=false;
        if(browserOrigin!=null)request.Headers["Origin"]=browserOrigin;
        HttpWebResponse response;
        try { response=(HttpWebResponse)request.GetResponse(); }
        catch(WebException error) {
            if(error.Response==null)throw;
            response=(HttpWebResponse)error.Response;
        }
        using(response) {
            return new ReplyHeaders {Status=(int)response.StatusCode,Location=response.Headers["Location"],
                ContentType=response.ContentType,ContentEncoding=response.ContentEncoding};
        }
    }
    static WebSocket Connect(bool compressed) {
        string path="/mobile/ws"+(compressed?"?gzip=1":"");
        if(pipeListener!=null) {
            Stream pipe=OnlinePipe.Open(pipeListener);
            try {
                const string headers="Connection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\n"+
                    "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n";
                string reply=PipeRequest(pipe,path,origin,headers);
                Check(reply.StartsWith("HTTP/1.1 101 ",StringComparison.Ordinal)&&
                    reply.IndexOf("s3pPLMBiTxaQ9kYGzzhZRbK+xOo=",StringComparison.Ordinal)>=0,
                    "Browser WebSocket upgrade failed: "+reply);
                return WebSocket.CreateClientWebSocket(pipe,null,32768,32768,TimeSpan.FromSeconds(18),false,
                    WebSocket.CreateClientBuffer(32768,32768));
            } catch { pipe.Dispose();throw; }
        }
        var socket=new ClientWebSocket();
        socket.Options.SetRequestHeader("Origin",origin);
        string url=(origin.StartsWith("https:",StringComparison.Ordinal)?"wss"+origin.Substring(5):"ws"+origin.Substring(4))+path;
        var connecting=socket.ConnectAsync(new Uri(url),CancellationToken.None);
        Until(()=>connecting.IsCompleted,"mobile connection");
        connecting.GetAwaiter().GetResult();
        return socket;
    }
    static void Send(WebSocket socket,byte[] bytes,WebSocketMessageType type) {
        var task=socket.SendAsync(new ArraySegment<byte>(bytes),type,true,CancellationToken.None);
        Until(()=>task.IsCompleted,"send guest message");
        task.GetAwaiter().GetResult();
    }
    static void Text(WebSocket socket,string text) {
        Send(socket,Utf8.GetBytes(text),WebSocketMessageType.Text);
    }
    static async Task<Message> Receive(WebSocket socket,bool compressed) {
        var buffer=new byte[16384];
        using(var content=new MemoryStream()) {
            WebSocketReceiveResult part;
            do {
                part=await socket.ReceiveAsync(new ArraySegment<byte>(buffer),CancellationToken.None);
                Check(part.MessageType!=WebSocketMessageType.Close,"Host closed the mobile connection.");
                content.Write(buffer,0,part.Count);
                Check(content.Length<=1048576,"Oversized mobile frame.");
            } while(!part.EndOfMessage);
            byte[] bytes=content.ToArray();
            if(part.MessageType==WebSocketMessageType.Text)return new Message {Text=Utf8.GetString(bytes)};
            Check(bytes.Length>2,"Truncated binary message.");
            Check((bytes[0]==0x1f&&bytes[1]==0x8b)==compressed,"Unexpected mobile compression.");
            if(!compressed)return new Message {Data=(Dictionary<string,object>)Json.DeserializeObject(Utf8.GetString(bytes))};
            using(var gzip=new GZipStream(new MemoryStream(bytes),CompressionMode.Decompress))
            using(var reader=new StreamReader(gzip,Utf8))
                return new Message {Data=(Dictionary<string,object>)Json.DeserializeObject(reader.ReadToEnd())};
        }
    }
    static Message ReadTo(WebSocket socket,bool compressed,Func<Message,bool> select,string pending) {
        var timer=Stopwatch.StartNew();
        while(timer.Elapsed.TotalSeconds<20) {
            var message=Receive(socket,compressed);
            Until(()=>message.IsCompleted,pending);
            Message next=message.GetAwaiter().GetResult();
            Check(next.Text==null||!next.Text.StartsWith("ERROR|",StringComparison.Ordinal),next.Text);
            if(select(next))return next;
        }
        throw new Exception("Timed out: "+pending);
    }
    static string Reply(WebSocket socket,bool compressed,string verb) {
        return ReadTo(socket,compressed,m=>m.Text!=null&&m.Text.StartsWith(verb+"|",StringComparison.Ordinal),verb).Text;
    }
    static Dictionary<string,object> State(WebSocket socket,bool compressed,string type) {
        return ReadTo(socket,compressed,m=>m.Data!=null&&(string)m.Data["type"]==type,type).Data;
    }
    static Dictionary<string,object> Field(Dictionary<string,object> data,string name) {
        return (Dictionary<string,object>)data[name];
    }
    static float Number(Dictionary<string,object> data,string name) { return Convert.ToSingle(data[name]); }
    static string Join(WebSocket socket,bool compressed,string name,string resume,int seat) {
        Text(socket,"JOIN|LS2|"+roomKey+"|"+name+"|"+resume);
        string[] reply=Reply(socket,compressed,"SEAT").Split('|');
        Check(reply.Length==3&&int.Parse(reply[1])==seat&&reply[2].Length==24,"Wrong mobile seat.");
        return reply[2];
    }
    static void Move(WebSocket socket,int round,int sequence,float yaw,float forward) {
        using(var data=new MemoryStream())using(var input=new BinaryWriter(data)) {
            input.Write((byte)1);
            input.Write(round);
            input.Write(sequence);
            input.Write(0f);
            input.Write(forward);
            input.Write(0f);
            input.Write(yaw);
            input.Write(0f);
            input.Write((byte)0);
            input.Write((byte)0);
            Send(socket,data.ToArray(),WebSocketMessageType.Binary);
        }
    }
    static void VerifyWorld(Dictionary<string,object> world,int round) {
        var terrain=Field(world,"terrain");
        int size=(int)Number(terrain,"size");
        Check(Number(world,"round")==round&&size>100,"Wrong terrain round or resolution.");
        foreach(string key in new[]{"heights","paths","waters","floodWaters"})
            Check(((object[])terrain[key]).Length==size*size,"Incomplete terrain "+key);
        Check(((object[])world["props"]).Length>100,"World is missing the base arena props.");
    }
    static void VerifyFrame(Dictionary<string,object> frame,int seat,string name) {
        var player=Field(frame,"player");
        Check(Number(player,"id")==seat&&(string)player["name"]==name,"Frame exposes another seat's perspective.");
        Check(player["shield"] is bool && player["shieldRaised"] is bool && player["crossbowLoaded"] is bool &&
            Number(player,"reload")>=0 && Number(player,"reload")<=1, "Incomplete mobile equipment state.");
        Check(Number(player,"shieldHealth")>=0&&Number(player,"shieldMaxHealth")==100,"Missing shield durability.");
        var bow=((object[])frame["craft"]).Cast<object[]>().First(row=>(string)row[0]=="bow");
        var bowDetails=(Dictionary<string,object>)bow[4];
        Check((string)bowDetails["category"]=="Weapons & Armor" && ((object[])bowDetails["needs"]).Length==3,
            "Mobile craft frame is missing grouped ingredients.");
        var blueprints=((object[])frame["build"]).Cast<object[]>().Where(row=>((string)row[0]).StartsWith("blueprint_",StringComparison.Ordinal));
        Check(blueprints.Count()==4,"Mobile build frame is missing fort blueprints.");
        Check(Number(frame,"alive")>0&&Number(frame,"alive")<=24&&frame.ContainsKey("propChanges")&&frame.ContainsKey("tracks")&&((object[])frame["craft"]).Length>0,
            "Frame is missing arena contestants, prop changes, or recipes.");
        foreach(object[] actor in (object[])frame["actors"])
            Check(actor.Length>=19&&Convert.ToSingle(actor[18])>=0&&Convert.ToSingle(actor[18])<=1,
                  "Frame is missing a visible contestant's hit reaction.");
    }
    static bool PropChanged(Message message,int index,bool felling) {
        if(message.Data==null||(string)message.Data["type"]!="frame")return false;
        foreach(object[] change in (object[])message.Data["propChanges"]) {
            if(Convert.ToInt32(change[0])!=index)continue;
            var record=change[1] as object[];
            return felling?record!=null&&Convert.ToSingle(record[11])>=0:record==null;
        }
        return false;
    }
    static void ManagedRound(bool usePipe) {
        game=new Game {ForcedSeed=73119};
        game.Menu();
        using(room=new OnlineSession(game)) {
            game.Online=room;
            typeof(OnlineSession).GetMethod("HostManaged",BindingFlags.Instance|BindingFlags.NonPublic).Invoke(room,null);
            var invite=new Uri(room.LocalInvite);
            origin=invite.GetLeftPart(UriPartial.Authority);
            roomKey=invite.Fragment.Substring(1);
            pipeListener=usePipe?(OnlineListener)typeof(OnlineSession).GetField("listener",BindingFlags.Instance|BindingFlags.NonPublic).GetValue(room):null;
            Check(room.HumanCount==0&&!room.CanStart,"An empty manager reserved a player seat.");
            using(var first=Connect(true))using(var second=Connect(true)) {
                Join(first,true,"First","",0);
                Join(second,true,"Second","",1);
                var guests=new List<WebSocket>();
                try {
                    for(int i=2;i<8;i++) {
                        var guest=Connect(true);guests.Add(guest);
                        Join(guest,true,"Guest"+i,"",i);
                    }
                    Check(room.HumanCount==8,"The manager did not accept eight real players.");
                    foreach(var guest in guests)Text(guest,"LEAVE");
                    Until(()=>room.HumanCount==2,"six players leave");
                } finally { foreach(var guest in guests)guest.Dispose(); }
                Text(second,"START");
                Text(second,"READY|1");
                ReadTo(second,true,m=>m.Text!=null&&m.Text.Contains("1,Ready,Second"),"non-captain ready");
                Check(room.Phase=="lobby","Another player started the captain's match.");
                Text(first,"START");
                int round=int.Parse(Reply(first,true,"ROUND").Split('|')[1]);
                VerifyFrame(State(first,true,"frame"),0,"First");
                VerifyFrame(State(second,true,"frame"),1,"Second");
                Check(game.HumanCount==2&&game.Actors.Count==24,"Wrong managed bot count.");
                Until(()=>game.Countdown<=0,"countdown");
                var actor=game.Actors[0];float x=actor.X,z=actor.Z;
                Move(first,round,1,actor.Yaw,1);
                Until(()=>Game.Distance(x,z,actor.X,actor.Z)>.4f,"remote input on seat zero");
                game.Winner=actor;
                Until(()=>room.Phase=="lobby"&&room.HumanCount==0,"arena reopens after results");
            }
            using(var departed=Connect(true))using(var next=Connect(true)) {
                Join(departed,true,"Departed","",0);
                Join(next,true,"Next","",1);
                Text(departed,"LEAVE");
                ReadTo(next,true,m=>m.Text!=null&&m.Text.Contains("1,Captain,Next"),"captain succession");
                Text(next,"START");Reply(next,true,"ROUND");
                VerifyFrame(State(next,true,"frame"),1,"Next");
                Check(game.HumanCount==1&&!game.IsOnlineHuman(game.Actors[0]),"Vacated captain slot did not become a bot.");
                Text(next,"LEAVE");
                Until(()=>room.Phase=="lobby"&&room.HumanCount==0,"abandoned round resets");
            }
        }
    }

    static int Main(string[] args) {
        try {
            if(args.Length>0&&args[0].StartsWith("managed-",StringComparison.Ordinal)) {
                ManagedRound(args[0]=="managed-pipe");Console.WriteLine("Managed eight-player arena and repeat rounds passed.");return 0;
            }
            bool publish=args.Length>0&&args[0]=="public";
            game=new Game {ForcedSeed=73119};
            game.Menu();
            using(room=new OnlineSession(game)) {
                game.Online=room;
                room.Host("Windows Host",publish);
                Until(()=>room.Code.StartsWith(publish?"https://":"http://",StringComparison.Ordinal),"host address",120);
                var invite=new Uri(room.Code);
                origin=invite.GetLeftPart(UriPartial.Authority);
                roomKey=invite.Fragment.Substring(1);
                if(args.Length>0&&args[0]=="pipe")
                    pipeListener=(OnlineListener)typeof(OnlineSession).GetField("listener",BindingFlags.Instance|BindingFlags.NonPublic).GetValue(room);
                var redirect=Get("/");
                Check(redirect.Status==302&&redirect.Location=="/mobile/","Public invite did not reach mobile.");
                var page=Get("/mobile/");
                Check(page.Status==200&&page.ContentType.StartsWith("text/html",StringComparison.Ordinal),"Mobile page unavailable.");
                Check(Get("/mobile/ws","https://unrelated.example").Status==403,"Cross-origin mobile connection was accepted.");
                Check(Get("/ws",origin).Status==403,"Browser origin entered native WebSocket.");
                Check(Get("/mobile/assets/Last%20Signal.exe").Status==404,"Mobile server exposed a file outside its allowlist.");
                foreach(string pack in new[]{"landmarks.bin.gz","survivors.bin.gz","field.bin.gz"}) {
                    ReplyHeaders response=Get("/mobile/assets/"+pack);
                    Check(response.Status==200&&response.ContentType=="application/octet-stream"&&(publish||response.ContentEncoding=="gzip"),
                          "Online browser art is missing or has the wrong encoding: "+pack);
                }

                string resume;
                int round,treeIndex;
                using(var first=Connect(true))using(var second=Connect(false)) {
                    resume=Join(first,true,"Phone One","",1);
                    Join(second,false,"Phone Two","",2);
                    Text(first,"READY|1");
                    Text(second,"READY|1");
                    Until(()=>room.CanStart&&room.HumanCount==3,"three ready seats");
                    room.StartMatch();
                    round=int.Parse(Reply(first,true,"ROUND").Split('|')[1]);
                    Check(Reply(second,false,"ROUND")=="ROUND|"+round,"The two mobile seats received different rounds.");
                    VerifyWorld(State(first,true,"world"),round);
                    VerifyWorld(State(second,false,"world"),round);
                    VerifyFrame(State(first,true,"frame"),1,"Phone One");
                    VerifyFrame(State(second,false,"frame"),2,"Phone Two");
                    Check(game.Actors.Count==24&&game.HumanCount==3,"Bots did not fill the arena.");
                    Until(()=>game.Countdown<=0,"arena countdown");
                    Actor actor=game.Actors[1];
                    float x=actor.X,z=actor.Z;
                    Prop tree=game.Props.Find(p=>Game.IsHarvestTree(p)&&!p.Removed&&Game.Distance(x,z,p.X,p.Z)<65);
                    Check(tree!=null,"No harvestable tree in the test seat's scene.");
                    treeIndex=game.Props.IndexOf(tree);
                    tree.Removed=true;tree.FelledAt=game.Clock;tree.FellDirection=.7f;
                    ReadTo(first,true,m=>PropChanged(m,treeIndex,true),"falling tree");
                    Move(first,round,1,actor.Yaw,1);
                    Until(()=>Game.Distance(x,z,actor.X,actor.Z)>.4f,"authoritative mobile movement");
                    Move(first,round,2,actor.Yaw,0);
                    ReadTo(first,true,m=>PropChanged(m,treeIndex,false),"removed tree");
                    first.Abort();
                }
                using(var reconnect=Connect(true)) {
                    Check(Join(reconnect,true,"Phone One",resume,1)==resume,"Reconnect assigned a new mobile seat.");
                    Check(Reply(reconnect,true,"ROUND")=="ROUND|"+round,"Reconnect lost the mobile round.");
                    VerifyWorld(State(reconnect,true,"world"),round);
                    VerifyFrame(State(reconnect,true,"frame"),1,"Phone One");
                    ReadTo(reconnect,true,m=>PropChanged(m,treeIndex,false),"removed tree after reconnect");
                }
            }
            Console.WriteLine("Mobile room passed: shared room, native inputs, plain/gzip frames, and reconnect.");
            return 0;
        } catch(Exception error) {
            Console.Error.WriteLine(error);
            return 1;
        }
    }
}
