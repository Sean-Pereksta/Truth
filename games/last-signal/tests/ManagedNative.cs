using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using LastSignal;

class ManagedNativeChecks {
    const string Root="https://firestore.googleapis.com/v1/projects/bible-game-246c0/databases/(default)/documents/managedGameDirectories/lastsignal";
    const string Public="https://arena-public.trycloudflare.com", Private="https://arena-private.trycloudflare.com";
    static readonly CancellationToken None=CancellationToken.None;
    static object Json(object value){var json=new JavaScriptSerializer();return json.DeserializeObject(json.Serialize(value));}
    static void Check(bool ok,string detail){if(!ok)throw new Exception(detail);}
    static object Doc(string code,string origin,string visibility,string phase="waiting",int players=0,int expiry=60){
        return Json(new{name=Root.Substring("https://firestore.googleapis.com/v1/".Length)+"/lobbies/"+code,fields=new{
            name=new{stringValue="Arena "+code},origin=new{stringValue=origin},joinUrl=new{stringValue=origin+"/__catnmice/join"},
            visibility=new{stringValue=visibility},hostId=new{stringValue=code},phase=new{stringValue=phase},
            players=new{integerValue=players.ToString()},capacity=new{integerValue="8"},queued=new{integerValue="0"},
            updatedAt=new{timestampValue=DateTime.UtcNow.AddSeconds(-2).ToString("o")},expiresAt=new{timestampValue=DateTime.UtcNow.AddSeconds(expiry).ToString("o")}
        }});
    }
    static object Row(object doc){return Json(new{document=doc});}
    static object Status(string code,string visibility,int players=0,string hostPhase="waiting"){
        return Json(new{game="lastsignal",hostId=code,visibility,phase=hostPhase,players,capacity=8,queued=0,joinable=players<8&&hostPhase=="waiting"});
    }
    static void Until(Func<bool> done,Action pump,string detail){
        var timer=Stopwatch.StartNew();
        while(!done()){Check(timer.Elapsed.TotalSeconds<15,detail);pump();Thread.Sleep(8);}
    }

    static void WireGateway(){
        // Verify .NET's real cookie jar captures the access reply before requesting /join.
        var tcp=new TcpListener(IPAddress.Loopback,0);tcp.Start();
        string origin="http://127.0.0.1:"+((IPEndPoint)tcp.LocalEndpoint).Port;
        var worker=Task.Run(()=>{
            foreach(string route in new[]{"/__catnmice/access","/__catnmice/join"}){
                using(var client=tcp.AcceptTcpClient())using(var stream=client.GetStream()){
                    stream.ReadTimeout=5000;
                    using(var reader=new StreamReader(stream,Encoding.ASCII,false,4096,true)){
                        string line=reader.ReadLine(),cookie="";Check(line.Split(' ')[1]==route,"Wrong gateway path.");
                        int length=0;
                        while(!String.IsNullOrEmpty(line=reader.ReadLine())){
                            if(line.StartsWith("Content-Length:",StringComparison.OrdinalIgnoreCase))length=int.Parse(line.Split(':')[1]);
                            if(line.StartsWith("Cookie:",StringComparison.OrdinalIgnoreCase))cookie=line.Substring(7).Trim();
                        }
                        string headers;
                        if(route.EndsWith("/access")){
                            char[] body=new char[length];reader.ReadBlock(body,0,body.Length);
                            Check(new string(body)=="{\"code\":\"0031\"}","Private code payload changed.");
                            headers="204 No Content\r\nSet-Cookie: testgateway=receipt; HttpOnly; Path=/";
                        }else{
                            Check(cookie=="testgateway=receipt","Gateway cookie missing from /join.");
                            headers="302 Found\r\nLocation: /mobile/#012345678901234567890123";
                        }
                        byte[] reply=Encoding.ASCII.GetBytes("HTTP/1.1 "+headers+"\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
                        stream.Write(reply,0,reply.Length);
                    }
                }
            }
        });
        try{
            var jar=new CookieContainer();
            string redirect=ManagedDirectory.Gateway(origin,"0031",jar);
            worker.GetAwaiter().GetResult();
            Check(redirect.StartsWith("/mobile/#")&&jar.GetCookieHeader(new Uri(origin))=="testgateway=receipt","Access reply or cookie missing.");
        } finally{tcp.Stop();}
    }

    static void Run(){
        var authority=new Game{ForcedSeed=14};authority.Menu();
        using(var host=new OnlineSession(authority)){
            authority.Online=host;host.HostManaged();
            var listener=(OnlineListener)typeof(OnlineSession).GetField("listener",BindingFlags.NonPublic|BindingFlags.Instance).GetValue(host);
            string key=new Uri(host.LocalInvite).Fragment;
            object good=Doc("0020",Public,"public",players:1),code=Doc("0031",Private,"code");
            string malformed="https://arena-bad.trycloudflare.com",full="https://arena-full.trycloudflare.com",offline="https://arena-gone.trycloudflare.com";
            bool refuseFirst=false;
            var directory=new ManagedDirectory((url,method,body,token)=>{
                if(url==Root+":runQuery")return new object[]{Row(Doc("0001",malformed,"public")),Row(Doc("0002",offline,"public")),
                    Row(Doc("0003",full,"public")),Row(code),Row(good),Row(Doc("1000",Public,"public",expiry:-1)),Row(new{invalid=true})};
                if(url==Root+"/lobbies/0031")return code;
                if(url==malformed+"/__catnmice/status")throw new ArgumentException("Invalid JSON.");
                if(url==offline+"/__catnmice/status")throw new WebException("Offline.");
                if(url==full+"/__catnmice/status")return Status("0003","public",8);
                if(url==Public+"/__catnmice/status")return Status("0020","public",1);
                if(url==Private+"/__catnmice/status")return Status("0031","code");
                throw new Exception("Unexpected native directory request "+url);
            },(origin,pin,jar)=>{
                if(origin==Private){
                    Check(pin=="0031","Lost leading zeroes in private admission.");
                    jar.Add(new Uri(origin),new Cookie("gateway","admitted","/"){Secure=true,HttpOnly=true});
                }else{
                    Check(origin==Public&&pin==null,"Unexpected private code or a probe bypass.");
                }
                return refuseFirst?"https://other.example/mobile/"+key:"/mobile/?managed=1"+key;
            });
            Check(directory.List(None).Length==4,"Browse included a private, stale or malformed listing.");
            var publicTicket=directory.Live(None);var privateTicket=directory.Join(null,"0031",None);
            Check(publicTicket.Invite==Public+"/"+key&&privateTicket.Invite==Private+"/"+key,"Wrong verified native game invite.");
            var chosen=directory.List(None).Single(r=>r.ServerCode=="0020");
            Check(directory.Join(chosen,null,None).Invite==publicTicket.Invite,"Specific public join failed.");
            bool rejected=false;refuseFirst=true;
            try{directory.Join(chosen,null,None);}catch(IOException){rejected=true;}
            Check(rejected,"Accepted an off-host gateway redirect.");refuseFirst=false;
            using(var canceled=new CancellationTokenSource()){
                canceled.Cancel();try{directory.Live(canceled.Token);throw new Exception("Ignored canceled selection.");}catch(OperationCanceledException){}
            }
            Func<ManagedAdmission,Game,OnlineSession> client=(ticket,game)=>new OnlineSession(game,(ws,jar)=>{
                var parsed=new Uri(ws);
                string site="https://"+parsed.Host;
                Check(parsed.AbsolutePath=="/ws"&&parsed.Scheme=="wss","Wrong native WebSocket endpoint.");
                Check(Object.ReferenceEquals(jar,ticket.Access),"WebSocket lost its gateway session.");
                string expected=site==Private?"gateway=admitted":"";
                Check(jar.GetCookieHeader(new Uri(site))==expected,"Incorrect private or public WS access.");
                var transport=new OnlineTransport();transport.Attach(OnlinePipe.Upgrade(listener));return transport;
            });
            Game g1=new Game(),g2=new Game();g1.Menu();g2.Menu();
            using(var captain=client(privateTicket,g1))using(var guest=client(publicTicket,g2)){
                g1.Online=captain;g2.Online=guest;
                Action pump=()=>{host.Pump(1f/30);captain.Pump(1f/30);guest.Pump(1f/30);};
                captain.Join(privateTicket.Invite,"Captain Name",privateTicket.Access);
                Until(()=>captain.IsCaptain,pump,"Native seat zero never received captain permission.");
                guest.Join(publicTicket.Invite,"Guest Name",publicTicket.Access);
                Until(()=>guest.Phase=="lobby"&&captain.HumanCount==2,pump,"Native public guest did not reach the same room.");
                Check(captain.SeatIndex==0&&!guest.IsCaptain&&guest.SeatIndex==1,"Wrong native captain or seat.");
                guest.StartMatch();guest.ToggleReady();
                Until(()=>guest.IsReady,pump,"Ordinary member started match or failed to ready.");
                captain.StartMatch();
                Until(()=>captain.Phase=="playing"&&guest.Phase=="playing"&&g1.Player!=null&&g2.Player!=null,pump,"Native captain did not start shared gameplay.");
                Check(g1.Player.Name=="Captain Name"&&g2.Player.Name=="Guest Name"&&g1.Actors.Count==24,"Incorrect native arena view.");
                captain.Leave();guest.Leave();
                Until(()=>host.Phase=="lobby",pump,"Arena failed to reopen.");
            }
        }
    }
    static int Main(string[] args){try{Run();if(args.Contains("socket"))WireGateway();Console.WriteLine("Native managed browsing, failover, private and public admission, and both player views passed.");return 0;}catch(Exception ex){Console.Error.WriteLine(ex);return 1;}}
}
