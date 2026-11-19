using System;
using System.Diagnostics;
using System.Globalization;
using System.Linq;
using System.Reflection;
using System.Threading;
using LastSignal;

// The fixture places both contestants beside a generated tree and supplies a
// hatchet to each pack. All harvesting, equipping, damage and rewards then pass
// through native host/guest controls and the session's real WebSocket messages.
class NetworkHarvest {
    struct Approach {public float X,Y,Z,Yaw,Pitch;}
    sealed class Site {public int Index;public Approach Host,Guest;}
    class Hands {
        float releaseAt=-1,againAt;
        public void Update(Game g){
            if(releaseAt>=0&&g.Clock>=releaseAt){g.InputRelease("Attack");releaseAt=-1;}
        }
        public bool Try(Game g,Approach aim,bool heavy){
            if(releaseAt>=0||g.Clock<againAt||g.Player.NextAttack>.02f||g.Player.Stamina<27)return false;
            Look(g,aim);g.InputPress("Attack");releaseAt=g.Clock+(heavy?.47f:.10f);againAt=releaseAt+(heavy?1.18f:1.03f);return true;
        }
    }
    static bool ApproachAt(Game g,Prop p,int side,out Approach v){
        v=new Approach();
        for(int i=0;i<10;i++){
            float direction=(side+i*.06f)*(float)Math.PI/2,r=Math.Max(p.W,p.D)*.55f+.85f;
            float x=p.X+(float)Math.Sin(direction)*r,z=p.Z+(float)Math.Cos(direction)*r;
            float y=Arena.Ground(g,x,z);
            if(!Arena.CanStand(g,x,y+.02f,z))continue;
            float yaw=(float)Math.Atan2(p.X-x,p.Z-z),pitch=(float)Math.Atan2(p.Y+Math.Min(1.25f,p.H*.57f)-y-1.58f,r),cp=(float)Math.Cos(pitch),distance;
            if(Arena.RayProp(g,x,y+1.58f,z,(float)Math.Sin(yaw)*cp,(float)Math.Sin(pitch),(float)Math.Cos(yaw)*cp,1.4f,out distance)!=p)continue;
            v=new Approach{X=x,Y=y,Z=z,Yaw=yaw,Pitch=pitch};return true;
        }
        return false;
    }
    static Site Find(Game g,bool tree){
        foreach(Prop p in g.Props.OrderBy(n=>Math.Abs(Game.Distance(0,0,n.X,n.Z)-67))){
            if(p.H<1.2f || p.Removed || !(tree?Game.IsHarvestTree(p):Game.IsHarvestRock(p)))continue;
            var s=new Site{Index=g.Props.IndexOf(p)};
            if(ApproachAt(g,p,0,out s.Host)&&ApproachAt(g,p,1,out s.Guest))return s;
        }
        throw new Exception("No real "+(tree?"tree":"rock")+" accessible.");
    }
    static void Move(Actor a,Approach v){a.X=v.X;a.Y=v.Y;a.Z=v.Z;a.Yaw=v.Yaw;a.Vertical=0;}
    static void Look(Game g,Approach v){g.Player.Yaw=v.Yaw;g.Pitch=v.Pitch;g.RefreshOnlineCamera(0);}
    static readonly BindingFlags member=BindingFlags.Instance|BindingFlags.NonPublic;
    static bool Near(Actor a,Approach v){return Game.Distance(a.X,a.Z,v.X,v.Z)<.45f;}
    static void Assert(bool result,string message){if(!result)throw new Exception(message);}
    static int Play(bool guest,string mode,int arena,string pipe,string invite){
        var g=new Game{ForcedSeed=7218};g.Settings.ArenaId=arena;g.Settings.Difficulty=1;g.Menu();
        IDisposable server=null;Process child=null;
        try {
            if(guest){
                Func<string,OnlineTransport> dial=delegate(string url){var c=new OnlineTransport();OnlinePipe.Dial(c,pipe);return c;};
                g.Online=mode=="tcp"?new OnlineSession(g):(OnlineSession)typeof(OnlineSession).GetConstructor(member,null,new[]{typeof(Game),typeof(Func<string,OnlineTransport>)},null).Invoke(new object[]{g,dial});
                g.Online.Join(invite,"Guest");
            }else{
                g.Online=new OnlineSession(g);g.Online.Host("Host",false);
                Assert(g.Online.IsHost,g.Online.Status);
                if(mode=="pipe"){
                    var listener=(OnlineListener)typeof(OnlineSession).GetField("listener",member).GetValue(g.Online);
                    server=OnlinePipe.Serve(listener,pipe);
                }
                var p=new ProcessStartInfo(Assembly.GetExecutingAssembly().Location,
                    "guest "+mode+" "+arena+" "+pipe+" "+g.Online.LocalInvite){
                    UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
                child=new Process{StartInfo=p};
                child.OutputDataReceived+=(s,e)=>{if(e.Data!=null)Console.WriteLine(e.Data);};
                child.ErrorDataReceived+=(s,e)=>{if(e.Data!=null)Console.Error.WriteLine(e.Data);};
                child.Start();child.BeginOutputReadLine();child.BeginErrorReadLine();
            }
            Site tree=null,rock=null;Hands hands=new Hands();bool ready=false,moved=false,movedRock=false,checkedTree=false,scooped=false;
            float finalAt=-1,emptyAt=-1;var timer=Stopwatch.StartNew();float elapsed=0;
            while(timer.Elapsed.TotalSeconds<74){
                float total=(float)timer.Elapsed.TotalSeconds,dt=Math.Min(.065f,Math.Max(.001f,(total-elapsed)*1.6f));elapsed=total;
                var s=g.Online;s.Pump(dt);
                if(s.Phase=="error")throw new Exception(s.Status);
                if(s.Phase=="lobby"){
                    if(guest&&!ready){s.ToggleReady();ready=true;}
                    if(!guest&&s.HumanCount==2&&s.CanStart)s.StartMatch();
                }
                if(!guest&&child.HasExited){child.WaitForExit();Assert(child.ExitCode==0&&scooped,"Guest or host did not see depleted rock and full payouts.");return 0;}
                if(s.Phase=="playing"&&g.Player!=null&&g.Actors.Count==24){
                    if(tree==null){tree=Find(g,true);rock=Find(g,false);}
                    Prop trunk=g.Props[tree.Index],face=g.Props[rock.Index];
                    Actor host=g.Actors[0],other=g.Actors[1];hands.Update(g);
                    if(g.Countdown<=0){
                        var t=guest?tree.Guest:tree.Host;var r=guest?rock.Guest:rock.Host;
                        if(!guest&&!moved){
                            host.Add("hatchet",1);other.Add("hatchet",1);
                            Move(host,tree.Host);Move(other,tree.Guest);moved=true;
                        }
                        if(Near(g.Player,t)&&!trunk.Removed){
                            Look(g,t);
                            if(g.Player.Count("fiber")==0&&(guest||other.Count("fiber")>0))hands.Try(g,t,false);
                            else if(host.Count("fiber")>0 && other.Count("fiber")>0){
                                if(g.Player.Weapon=="fists")g.InputPress("Weapon 4");
                                if(g.Player.Weapon=="hatchet" && (guest?trunk.HP<=60:host.Count("branch")==0))hands.Try(g,t,true);
                            }
                        }
                        if(trunk.Removed&&!checkedTree){
                            Assert(!trunk.Solid&&!trunk.Opaque&&trunk.FelledAt>=0,"Felling state was lost.");
                            Assert(Arena.Clear(g,trunk.X-1.5f,trunk.Y+1.13f,trunk.Z,trunk.X+1.5f,trunk.Y+1.13f,trunk.Z),"The fallen trunk still blocks sight.");
                            Assert(host.Count("branch")==2&&other.Count("branch")==3&&host.Count("fiber")==2&&other.Count("fiber")==3,"Replicated wood/fiber split was incorrect.");
                            Console.WriteLine((guest?"Guest":"Host")+" saw the same felled "+trunk.Model+" and 2/3 wood, 2/3 fiber in the correct packs.");
                            checkedTree=true;finalAt=g.Clock;
                        }
                        if(!guest&&checkedTree&&!movedRock&&g.Clock>finalAt+.8f){Move(host,rock.Host);Move(other,rock.Guest);movedRock=true;}
                        if(checkedTree&&Near(g.Player,r)&&!scooped){
                            Look(g,r);
                            if(face.HP>0 && (guest?face.HP<=50:host.Count("stone")<4))hands.Try(g,r,true);
                            if(face.HP==0){
                                Assert(face.Solid&&!face.Removed&&host.Count("stone")==4&&other.Count("stone")==4,"Incorrect stone payouts or rock collision.");
                                Console.WriteLine((guest?"Guest":"Host")+" confirmed depleted "+face.Model+" with 4 stone each.");
                                scooped=true;
                            }
                        }
                        if(guest&&scooped){
                            if(emptyAt<0&&hands.Try(g,r,false))emptyAt=g.Clock;
                            if(emptyAt>=0 && g.Clock>emptyAt+1.2f){
                                Assert(face.HP==0&&other.Count("stone")==4,"Depleted face paid a guest twice.");
                                return 0;
                            }
                        }
                    }
                }
                Thread.Sleep(7);
            }
            throw new Exception("Timed out "+(guest?"guest ":"host ")+g.Online.Phase+" "+g.Online.Status+" at "+g.Time+" inventory "+
                (g.Player==null?"-":String.Join(", ",g.Player.Bag.Select(k=>k.Key+"="+k.Value))));
        }finally{
            if(g.Online!=null)g.Online.Dispose();if(server!=null)server.Dispose();
            if(child!=null){
                if(!child.HasExited){child.WaitForExit(500);if(!child.HasExited)child.Kill();}
                child.Dispose();
            }
        }
    }
    static int Main(string[] args){
        try{
            bool guest=args.Length>0&&args[0]=="guest";string mode=guest?args[1]:(args.Length==0?"tcp":args[0]);
            int arena=guest?int.Parse(args[2]):(args.Length>1?int.Parse(args[1]):1);
            if(mode!="tcp"&&mode!="pipe")throw new Exception("Use tcp or pipe.");
            return Play(guest,mode,arena,guest?args[3]:"lastsignal-harvest-"+Guid.NewGuid().ToString("N"),guest?args[4]:null);
        }catch(Exception ex){Console.Error.WriteLine(ex);return 1;}
    }
}
