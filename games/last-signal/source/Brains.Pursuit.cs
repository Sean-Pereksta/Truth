using System;
using System.Collections.Generic;

namespace LastSignal {
    public struct Footprint {
        public Actor Maker;public float X,Y,Z,Yaw,Time,Life;public bool Left;
    }
    public partial class Game {
        public readonly Footprint[] Tracks=new Footprint[420];
    }
    public static partial class Brains {
        sealed class Tracker {
            public int Circuit,Leg;public float Changed,PatrolUntil,RestUntil,ReadAt,ChaseUntil,WatchUntil;
            public Actor Trail;public Place Waypoint;
        }
        static readonly Dictionary<Actor,Tracker> trackers=new Dictionary<Actor,Tracker>();
        static readonly Place[] previousStep=new Place[24];
        static readonly bool[] leftBoot=new bool[24];
        static float trackClock,nextSelection;
        static int writeTrack;
        public static bool ActiveHunter(Actor a){return a!=null&&a.Alive&&trackers.ContainsKey(a);}
        static void ResetHunters(Game g){
            trackers.Clear();writeTrack=0;trackClock=0;nextSelection=7;
            Array.Clear(g.Tracks,0,g.Tracks.Length);Array.Clear(leftBoot,0,leftBoot.Length);
            foreach(Actor a in g.Actors)if(a.Id>=0&&a.Id<24)previousStep[a.Id]=new Place(a.X,a.Z);
        }
        static void SelectTrackers(Game g){
            foreach(Actor a in g.Actors)if(!a.Alive||a.Health<38||a.Hunger<24||a.Hydration<25||!CombatReady(a))trackers.Remove(a);
            int living=trackers.Count;
            int need=g.Actors.Count<4?0:g.Actors.Count<12||g.Level==0?1:2;
            while(living<need){
                Actor best=null;float top=-10000;
                bool north=false;foreach(var pair in trackers)if(pair.Key.Alive&&pair.Value.Circuit==4)north=true;
                int circuit=!north?4:1+(int)((uint)(g.Seed/7)%3);
                Place entry=PatrolStop(g,circuit,0);
                foreach(Actor b in g.Actors){
                    Mind m;if(g.PlayerDriven(b)||!b.Alive||trackers.ContainsKey(b)||!minds.TryGetValue(b,out m)||m.Alliance!=null&&m.Alliance.Active)continue;
                    if(b.Health<42||b.Hunger<33||b.Hydration<35||m.Style==Style.Shadow||!CombatReady(b))continue;
                    float score=(m.Style==Style.Raider?14:m.Style==Style.Scout?11:m.Style==Style.Hunter?7:-4)
                        +b.Health*.08f+((g.Seed%47+19*b.Id)%23)*.20f-.39f*Dist(b.X,b.Z,entry.X,entry.Z);
                    if(score>top){top=score;best=b;}
                }
                if(best==null)break;
                // Their first circuit follows a public escape lane. Neither the route
                // nor recruitment queries a hidden contestant's coordinates.
                trackers[best]=new Tracker{Circuit=circuit,Changed=-100,ReadAt=-100,RestUntil=17+living*7};
                living++;
            }
        }
        static void TickHunterEvidence(Game g,float dt){
            if(g.Time>=nextSelection){SelectTrackers(g);nextSelection=g.Time+14;}
            trackClock-=dt;if(trackClock>0)return;trackClock=.45f;
            foreach(Actor a in g.Actors){
                if(!a.Alive||a.Id<0||a.Id>=24)continue;
                Place old=previousStep[a.Id];float dx=a.X-old.X,dz=a.Z-old.Z;
                if(dx*dx+dz*dz<(a.Sprint?3:2.25f)*(a.Sprint?3:2.25f))continue;
                previousStep[a.Id]=new Place(a.X,a.Z);
                if(Inside(a.X,a.Z,22)||a.Crouch||a.Speed<.2f||a.Y>Arena.Ground(g,a.X,a.Z)+.32f||Arena.WetDepth(g,a.X,a.Z)>.055f)continue;
                float cover=Arena.Cover(g,a.X,a.Z);
                if(cover>.70f || Arena.Path(a.X,a.Z)>.86f&&!a.Sprint)continue;
                float yaw=Heading(dx,dz),side=(leftBoot[a.Id]=!leftBoot[a.Id])?.09f:-.09f;
                float x=a.X+Cos(yaw)*side,z=a.Z-Sin(yaw)*side,y=Arena.Height(x,z);
                if(Math.Abs(Arena.GroundBelow(g,x,z,a.Y+.09f)-y)>.10f)continue;
                g.Tracks[writeTrack]=new Footprint{Maker=a,X=x,Y=y+.026f,Z=z,Yaw=yaw,Time=g.Time,
                    Life=(a.Sprint?67:40)*(g.Rain?.47f:1),Left=leftBoot[a.Id]};
                writeTrack=(writeTrack+1)%g.Tracks.Length;
            }
        }
        static bool ReadFootprint(Game g,Actor a,Tracker t,out Footprint best){
            best=new Footprint();float bestScore=-999;
            float range=5.5f+9.5f*g.Daylight;
            foreach(Footprint p in g.Tracks){
                if(p.Maker==null||p.Maker==a||Allied(g,a,p.Maker)||p.Time<=t.ReadAt||p.Time+p.Life<=g.Time)continue;
                float dx=p.X-a.X,dz=p.Z-a.Z,ds=dx*dx+dz*dz;
                if(ds>range*range||ds>9&&dx*Sin(a.Yaw)+dz*Cos(a.Yaw)<0)continue;
                float score=(p.Maker==t.Trail&&g.Time<t.ChaseUntil?7:0)-.55f*(float)Math.Sqrt(ds)-.16f*(g.Time-p.Time);
                if(score<=bestScore||!Arena.Clear(g,a.X,Eye(a),a.Z,p.X,p.Y+.075f,p.Z))continue;
                best=p;bestScore=score;
            }
            return best.Maker!=null;
        }
        static Place PatrolStop(Game g,int sector,int leg){
            float hx,hz;Arena.HuntingGround(sector,out hx,out hz);
            if(leg%3==2){
                Prop nearest=null;float least=100000;
                foreach(Prop p in g.Props)if(!p.Removed&&p.Kind=="water"){
                    float dx=p.X-hx,dz=p.Z-hz,ds=dx*dx+dz*dz;
                    if(ds<least){least=ds;nearest=p;}
                }
                if(nearest!=null)return Constrain(new Place(nearest.X,nearest.Z),Math.Max(6,g.SafeRadius-8));
            }
            float scale=leg%3==0?.27f:leg%3==1?.55f:.88f;
            return Constrain(new Place(hx*scale,hz*scale),Math.Max(6,g.SafeRadius-8));
        }
        static bool TryHuntTrail(Game g,Actor a,Mind m){
            Tracker t;
            if(!trackers.TryGetValue(a,out t)||m.Opening||!CombatReady(a)||a.Health<38||a.Hunger<33||a.Hydration<35||g.SafeRadius<22)return false;
            if(t.RestUntil>g.Time)return false;
            Footprint print;
            if(ReadFootprint(g,a,t,out print)){
                t.ReadAt=print.Time;t.Trail=print.Maker;t.ChaseUntil=g.Time+11;
                // Inspect where the print points, even if its maker has doubled back, stopped, or died.
                t.Waypoint=Constrain(new Place(print.X+2.6f*Sin(print.Yaw),print.Z+2.6f*Cos(print.Yaw)),Math.Max(6,g.SafeRadius-6));
                m.Goal=t.Waypoint;m.Job=Aim.Search;m.RunFor=1.1f;m.Pause=0;return true;
            }
            if(t.ChaseUntil>g.Time){
                m.Goal=t.Waypoint;m.Job=Aim.Search;
                m.Pause=Dist(a.X,a.Z,m.Goal.X,m.Goal.Z)<2?.65f:0;return true;
            }
            t.Trail=null;
            if(t.PatrolUntil>0&&g.Time>t.PatrolUntil){t.PatrolUntil=0;t.RestUntil=g.Time+32;t.Changed=-100;return false;}
            if(t.PatrolUntil<=0)t.PatrolUntil=g.Time+85;
            bool arrived=t.Changed>=0&&Dist(a.X,a.Z,t.Waypoint.X,t.Waypoint.Z)<3;
            if(arrived&&t.WatchUntil==0)t.WatchUntil=g.Time+3.2f;
            if(arrived&&g.Time<t.WatchUntil){
                m.Job=Aim.Search;m.Goal=t.Waypoint;m.Pause=.68f;m.NextScanPose=Math.Min(m.NextScanPose,.85f);return true;
            }
            if(t.Changed<0||g.Time-t.Changed>32||arrived){
                if(t.Changed>=0){t.Leg++;if(t.Leg%3==0)t.Circuit=t.Circuit%4+1;}
                t.WatchUntil=0;
                t.Waypoint=PatrolStop(g,t.Circuit,t.Leg);t.Changed=g.Time;
            }
            m.Goal=t.Waypoint;m.Pause=0;m.Job=Aim.Travel;return true;
        }
    }
}
