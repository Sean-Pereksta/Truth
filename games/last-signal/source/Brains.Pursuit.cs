using System;
using System.Collections.Generic;

namespace LastSignal {
    public static partial class Brains {
        sealed class Tracker {
            public float ReadAt=-100f,NextCheck,ChaseUntil,Confidence;
            public Actor Trail;public Place Waypoint;
        }
        static readonly Dictionary<Actor,Tracker> trackers=new Dictionary<Actor,Tracker>();
        public static bool ActiveHunter(Actor a) {
            Mind m;Tracker t;
            return a!=null && a.Alive && current!=null && minds.TryGetValue(a,out m) &&
                trackers.TryGetValue(a,out t) && m.Job==Aim.Search && current.Time<t.ChaseUntil &&
                Dist(m.Goal.X,m.Goal.Z,t.Waypoint.X,t.Waypoint.Z)<.5f;
        }
        static void ResetHunters(Game g){
            trackers.Clear();g.ResetTracks();
        }
        static void TickHunterEvidence(Game g,float dt){g.RecordTracks(dt);}
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
        static bool TryPlanTrail(Game g,Actor a,Mind m,out Place goal,out float score) {
            goal=new Place();score=0;
            if(m.Opening || g.SafeRadius<14 || !PursuitReady(a))return false;
            Tracker t;
            if(!trackers.TryGetValue(a,out t))trackers.Add(a,t=new Tracker());
            if(g.Time>=t.NextCheck) {
                t.NextCheck=g.Time+m.Between(.85f,1.4f);
                Footprint print;
                if(ReadFootprint(g,a,t,out print)) {
                    t.ReadAt=print.Time;t.Trail=print.Maker;t.ChaseUntil=g.Time+8f;
                    t.Confidence=Math.Max(0,12f-(g.Time-print.Time)*.44f);
                    // Search ahead of this physical print. The maker's live position is irrelevant.
                    t.Waypoint=Constrain(new Place(print.X+2.9f*Sin(print.Yaw),print.Z+2.9f*Cos(print.Yaw)),g.SafeRadius-3f);
                }
            }
            if(g.Time>=t.ChaseUntil || Dist(a.X,a.Z,t.Waypoint.X,t.Waypoint.Z)<1.7f)return false;
            int competing=0;
            foreach(var pair in trackers) {
                if(pair.Key==a || pair.Value.Trail!=t.Trail || !ActiveHunter(pair.Key))continue;
                if(Dist(t.Waypoint.X,t.Waypoint.Z,pair.Value.Waypoint.X,pair.Value.Waypoint.Z)<14f)competing++;
            }
            goal=t.Waypoint;
            score=53f+t.Confidence-TravelCost(g,a,goal)*.30f-competing*7f;
            return true;
        }
    }
}
