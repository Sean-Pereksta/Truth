using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading;
using LastSignal;

// Run with "socket" for the shipping listener and client, or "public" for the
// same authenticated sockets through the bundled Cloudflare Quick Tunnel.
class RoomJourney {
    const BindingFlags Hidden=BindingFlags.Instance|BindingFlags.NonPublic;
    static string folder,kind,pipe;
    static Game game;
    static OnlineSession session;
    static readonly List<Process> children=new List<Process>();
    static string FileAt(string key){return Path.Combine(folder,key);}
    static bool Seen(string key){return File.Exists(FileAt(key));}
    static void Mark(string key){File.WriteAllText(FileAt(key),"ok");}
    static void Check(bool ok,string message){if(!ok)throw new Exception(message);}
    static object Field(string name){return typeof(OnlineSession).GetField(name,Hidden).GetValue(session);}
    static object Pipe(string method,params object[] args){
        Type type=Assembly.GetExecutingAssembly().GetType("OnlinePipe",true);
        return type.GetMethod(method,args.Select(x=>x.GetType()).ToArray()).Invoke(null,args);
    }
    static OnlineSession Client(){
        if(kind!="pipe")return new OnlineSession(game);
        Func<string,OnlineTransport> dial=delegate(string unused){var c=new OnlineTransport();Pipe("Dial",c,pipe);return c;};
        return (OnlineSession)Activator.CreateInstance(typeof(OnlineSession),Hidden,null,new object[]{game,dial},null);
    }
    static void Step(){
        if(!session.Pump(1f/30))game.Tick(1f/30);
        Thread.Sleep(kind=="public"?25:16);
    }
    static void Until(Func<bool> yes,string message,int seconds){
        var timer=Stopwatch.StartNew();
        while(!yes()){
            if(session.Phase=="error")throw new Exception(message+" — "+session.Status);
            if(timer.Elapsed.TotalSeconds>seconds)throw new Exception(message+" (phase "+session.Phase+", "+session.Status+")");
            Step();
            foreach(var p in children)if(p.HasExited&&p.ExitCode!=0)throw new Exception("Client failed: "+p.ExitCode+" while "+message);
        }
    }
    static void Spawn(string role,string label){
        var p=new ProcessStartInfo(Assembly.GetExecutingAssembly().Location,
            role+" "+kind+" \""+folder+"\" "+pipe+" "+label);
        p.UseShellExecute=false;p.CreateNoWindow=true;
        children.Add(Process.Start(p));
    }
    static void Guest(string role,string label){
        string invite=File.ReadAllText(FileAt("invite"));
        if(role=="bad")invite=invite.Substring(0,invite.Length-1)+(invite.EndsWith("A")?"B":"A");
        if(role=="revoked")invite=File.ReadAllText(FileAt("revoked-invite"));
        session=Client();game.Online=session;
        using(session){
            session.Join(invite,label);
            if(role=="full"||role=="bad"||role=="late"||role=="revoked"){
                Until(()=>session.Phase=="error","denial for "+role,25);
                string phrase=role=="full"?"eight":role=="late"?"progress":"invalid";
                Check(session.Status.IndexOf(phrase,StringComparison.OrdinalIgnoreCase)>=0,"Wrong rejection: "+session.Status);
                Mark(role);return;
            }
            Until(()=>session.Phase=="lobby","join",30);session.ToggleReady();
            Until(()=>session.Phase=="playing"&&game.Player!=null&&game.Countdown<=0,"enter shared arena",75);
            int seat=session.SeatIndex;Check(game.Actors.Count==24&&game.Player.Name==label&&game.Player.Id==seat,"Incorrect player perspective");
            game.PadActive=true;game.PadMoveY=1;float x=game.Player.X,z=game.Player.Z;
            Until(()=>Game.Distance(x,z,game.Player.X,game.Player.Z)>.85f,"remote movement",20);
            game.PadMoveY=0;Mark(label+"-playing");
            if(label=="Guest2"){
                Until(()=>Seen("reconnect"),"reconnect signal",35);
                ((OnlineTransport)Field("client")).Close();
                Until(()=>session.Phase=="connecting","detect dropped socket",12);
                Until(()=>session.Phase=="playing"&&game.Player!=null,"reconnect",20);
                Check(session.SeatIndex==seat&&game.Player.Id==seat,"Reconnect changed contestant");Mark("resumed");
            }
            if(label=="Guest7"){
                Until(()=>Seen("depart"),"leave signal",50);session.Leave();return;
            }
            Until(()=>game.Winner!=null&&game.Mode=="results","shared winner",75);
            Check(game.Winner.Id==0&&game.Player.Placement>1,"Wrong winner or placement");Mark(label+"-result");
            Until(()=>session.Phase=="lobby","return to lobby",24);
            Check(!session.IsReady,"Ready check must reset for replay");Mark(label+"-lobby");
            Until(()=>Seen("finished"),"end of test",25);
        }
    }
    static void Host(){
        session=new OnlineSession(game);game.Online=session;game.ForcedSeed=73119;
        session.Host("Host",kind=="public");IDisposable pipeServer=null;
        try{
            if(kind=="pipe")pipeServer=(IDisposable)Pipe("Serve",(OnlineListener)Field("listener"),pipe);
            if(kind=="public")Until(()=>session.Code.StartsWith("https://"),"verified public Cloudflare endpoint",110);
            File.WriteAllText(FileAt("invite"),kind=="public"?session.Code:session.LocalInvite);
            Check(!session.IsListed,"Hosting must start as an invite-only lobby");
            if(kind!="public"){
                session.ListPublic(true);
                string publicKey=(string)Field("publicKey");
                Check(publicKey.Length==24&&!session.LocalInvite.EndsWith(publicKey),"Private invitation leaked into public listing");
                string previous=session.LocalInvite.Split('#')[0]+"#"+publicKey;
                File.WriteAllText(FileAt("revoked-invite"),previous);session.ListPublic(false);
                Spawn("revoked","Previous listing");Until(()=>Seen("revoked"),"revoked public listing",25);
            }
            Spawn("bad","Bad");Until(()=>Seen("bad"),"invite capability check",30);
            for(int i=1;i<=7;i++){
                Spawn("guest","Guest"+i);
                int count=1+i;
                Until(()=>session.HumanCount==count,"admit Guest"+i,25);
            }
            Until(()=>session.HumanCount==8&&session.CanStart,"eight ready players",45);
            Spawn("full","Ninth");Until(()=>Seen("full"),"ninth seat denial",30);
            session.StartMatch();Check(game.HumanCount==8&&game.Actors.Count==24,"Incorrect start roster");
            Until(()=>Enumerable.Range(1,7).All(i=>Seen("Guest"+i+"-playing")),"all clients receive their player and move",65);
            Spawn("late","Late");Until(()=>Seen("late"),"late admission",25);
            Mark("reconnect");Until(()=>Seen("resumed"),"guest reconnect",28);
            Check(game.HumanCount==8,"Reconnect lost a human seat");Mark("depart");
            Until(()=>game.HumanCount==7,"bot takeover",35);
            Check(game.Actors.Count==24,"Departure changed the size of the arena");
            var eliminate=typeof(Game).GetMethod("Eliminate",Hidden);
            foreach(var a in game.Actors.Skip(1).ToArray())if(a.Alive)eliminate.Invoke(game,new object[]{a,null," left the trial"});
            Until(()=>Enumerable.Range(1,6).All(i=>Seen("Guest"+i+"-result")),"same winner and independent placements",30);
            session.Replay();
            Until(()=>Enumerable.Range(1,6).All(i=>Seen("Guest"+i+"-lobby")),"shared replay lobby",25);
            Mark("finished");
            Until(()=>children.All(p=>p.HasExited),"client shutdown",25);
            Console.WriteLine(kind+" PASS: 8 Windows processes played the same 24-contestant arena with 16 AI, refused a ninth, resumed a lost seat, handed a departure to AI and agreed on the result and replay lobby.");
        }finally{
            if(pipeServer!=null)pipeServer.Dispose();session.Dispose();
            foreach(var p in children){if(!p.HasExited)p.Kill();p.Dispose();}
        }
    }
    public static int Main(string[] args){
        try{
            bool root=args.Length==2;string role=root?"host":args[0];kind=root?args[0]:args[1];
            folder=Path.GetFullPath(root?args[1]:args[2]);Directory.CreateDirectory(folder);
            pipe=root?"LastSignalRoom"+Guid.NewGuid().ToString("N"):args[3];
            game=new Game();game.Menu();
            if(root)Host();else Guest(role,args[4]);
            return 0;
        }catch(Exception e){
            Console.Error.WriteLine(e);if(folder!=null)File.WriteAllText(FileAt("failure-"+Process.GetCurrentProcess().Id+".txt"),e.ToString());return 1;
        }
    }
}
