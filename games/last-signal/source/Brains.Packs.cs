using System;
using System.Collections.Generic;

namespace LastSignal
{
    public static partial class Brains
    {
        enum Clue { None, Contestant, Arrows, Fire }
        sealed class Pack
        {
            public int Number;
            public bool Active=true;
            public Place Rendezvous;
            public List<Actor> Members=new List<Actor>(4);
        }
        static readonly List<Pack> careers=new List<Pack>(2);

        static void MakePacks(Game g)
        {
            careers.Clear();
            offers.Clear();
            nextRecruit=.12f;
            closedPacts=false;
        }
        static bool Endgame(Game g)
        {
            return g.AliveCount<=Math.Max(2,Math.Min(5,(g.Actors.Count+2)/5)) || g.SafeRadius<24f;
        }
        static int Living(Pack p)
        {
            int live=0;
            foreach(Actor a in p.Members)if(a.Alive)live++;
            return live;
        }
        static bool Breaking(Game g,Pack p)
        {
            return Endgame(g) || Living(p)<2 || Living(p)>=g.AliveCount;
        }
        static void UpdatePacks(Game g)
        {
            if(g.Level<2 || minds.Count<3 || closedPacts)return;
            bool finish=Endgame(g);
            foreach(Pack p in careers)
            {
                if(!p.Active || !Breaking(g,p))continue;
                p.Active=false;
                foreach(Actor a in p.Members)
                {
                    Mind m=minds[a];
                    m.Alliance=null;m.BriefUntil=m.ImpactUntil=0;m.AnchorTime=-100;m.Replan=0;
                    m.RecruitAfter=g.Time+11;
                }
            }
            if(finish){offers.Clear();closedPacts=true;return;}
            if(g.Time<nextRecruit)return;
            nextRecruit=g.Time+.30f;
            UpdateCourtesies(g);
        }
        public static int PackNumber(Game g,Actor a)
        {
            if(g.OnlinePresentationPacks!=null&&a!=null&&a.Id>=0&&a.Id<g.OnlinePresentationPacks.Length)
                return g.OnlinePresentationPacks[a.Id];
            Mind m;if(g!=current||a==null||!a.Alive||!minds.TryGetValue(a,out m)||m.Alliance==null)return 0;
            Pack p=m.Alliance;
            return p.Active && !Breaking(g,p)?p.Number:0;
        }
        public static bool Allied(Game g,Actor a,Actor b)
        {
            if(g!=current || g.Level<2 || a==null || b==null || a==b || g.PlayerDriven(a) || g.PlayerDriven(b) || !a.Alive || !b.Alive)return false;
            Mind ma,mb;
            return minds.TryGetValue(a,out ma) && minds.TryGetValue(b,out mb) && ma.Alliance!=null &&
                ma.Alliance==mb.Alliance && ma.Alliance.Active && !Breaking(g,ma.Alliance);
        }
        static bool FriendlyNoise(Game g,Actor a,int source)
        {
            Mind m=minds[a];
            if(m.Alliance==null||!m.Alliance.Active)return false;
            foreach(Actor b in m.Alliance.Members)if(b.Id==source)return Allied(g,a,b);
            return false;
        }

        static void Report(Game g,Actor a,Mind m,Place point,Clue kind)
        {
            if(m.Alliance==null || !m.Alliance.Active)return;
            foreach(Actor b in m.Alliance.Members)
            {
                if(!Allied(g,a,b))continue;
                float d=Dist(a.X,a.Z,b.X,b.Z);
                if(d>(g.Rain?21f:29f) || !Arena.Clear(g,a.X,Eye(a)-.09f,a.Z,b.X,Eye(b)-.09f,b.Z))continue;
                Mind ally=minds[b];
                ally.AllyAnchor=new Place(a.X,a.Z);ally.AnchorTime=g.Time;
                if(ally.HasObservation || (kind!=Clue.Contestant && ally.Briefing==Clue.Contestant && ally.BriefUntil>g.Time))continue;
                if(kind==ally.Briefing && g.Time-ally.BriefedAt<1.35f && Dist(ally.PackGoal.X,ally.PackGoal.Z,point.X,point.Z)<2.5f)continue;
                ally.Briefing=kind;ally.BriefedAt=g.Time;ally.PackGoal=point;
                ally.BriefUntil=g.Time+(kind==Clue.Fire?15f:9f);
                ally.Replan=Math.Min(ally.Replan,.22f);
            }
        }

        // A report is an immutable location. The receiving contestant must see a
        // rival with its own eyes before it may aim or strike.
        static bool FollowReport(Game g,Actor a,Mind m)
        {
            if(m.Alliance==null || !m.Alliance.Active || m.BriefUntil<=g.Time || a.Hunger<21 ||
               a.Hydration<25 || g.StormMargin(m.PackGoal.X,m.PackGoal.Z)<-1)return false;
            if(m.HasObservation || m.SeenAt>m.BriefedAt && m.LostSight>0)return false;
            float bearing=Heading(m.PackGoal.X-a.X,m.PackGoal.Z-a.Z);
            float offset=m.Station==0?0:m.Station%2==0?1.26f:-1.26f;
            float radius=m.Station==0?2.0f:m.Station==3?6.4f:4.8f;
            Place to=Offset(m.PackGoal,bearing+(float)Math.PI+offset,radius);
            if(!Arena.CanStand(g,to.X,Arena.Ground(g,to.X,to.Z),to.Z))to=m.PackGoal;
            m.Job=Aim.Search;m.Goal=to;m.Pause=0;
            if(Dist(a.X,a.Z,to.X,to.Z)<1.35f)
            {
                m.Job=Aim.Wait;m.Pause=1.1f;m.NextScanPose=1.8f;
                m.Steering=Heading(m.PackGoal.X-a.X,m.PackGoal.Z-a.Z)+(float)Math.Sin(g.Time*1.1f+m.Station)*.47f;
            }
            return true;
        }

        static bool Regroup(Game g,Actor a,Mind m)
        {
            if(m.Alliance==null || !m.Alliance.Active || m.Opening || m.HasObservation ||
               a.Hunger<44 || a.Hydration<48 || a.Count("meat")>0 || m.Job==Aim.Camp)return false;
            Actor leader=null;
            foreach(Actor b in m.Alliance.Members)
            {
                if(!b.Alive)continue;
                if(leader==null)leader=b;
                if(b==a || Dist(a.X,a.Z,b.X,b.Z)>24 ||
                   !Arena.Clear(g,a.X,Eye(a),a.Z,b.X,Eye(b),b.Z))continue;
                if(b==leader || g.Time-m.AnchorTime>3.5f)
                {m.AllyAnchor=new Place(b.X,b.Z);m.AnchorTime=g.Time;}
            }
            if((a==leader && g.Time-m.AnchorTime<11f) || a.Weapon=="fists" && m.Age<38)return false;
            Place anchor=g.Time-m.AnchorTime<12f?m.AllyAnchor:m.Alliance.Rendezvous;
            float ang=m.Alliance.Number*.8f+m.Station*2.2f;
            Place to=Offset(anchor,ang,4.0f+m.Station*.75f);
            float distance=Dist(a.X,a.Z,to.X,to.Z);
            if(distance<11 || g.StormMargin(to.X,to.Z)<2 || !Arena.CanStand(g,to.X,Arena.Ground(g,to.X,to.Z),to.Z))return false;
            m.Goal=to;m.Job=Aim.Travel;m.Watch=3f;return true;
        }

        static bool PackFootwork(Game g,Actor a,Mind m,float dx,float dz,float d,bool ranged,ref float forward,ref float side)
        {
            if(m.Alliance==null||!m.Alliance.Active||!m.CanRead)return false;
            bool blocked=false;Actor near=null;float smallest=24f;
            foreach(Actor b in m.Alliance.Members)
            {
                if(!Allied(g,a,b))continue;
                float ax=b.X-a.X,az=b.Z-a.Z,dist=Dist(0,0,ax,az);
                if(dist>24 || !Arena.Clear(g,a.X,Eye(a),a.Z,b.X,Eye(b),b.Z))continue;
                float along=ax*dx+az*dz,lateral=ax*dz-az*dx;
                if(along>0 && along<d && Math.Abs(lateral)<(ranged?.85f:.62f))blocked=true;
                if(dist<smallest){smallest=dist;near=b;}
            }
            if(near==null)return false;
            if(blocked){side=m.Station%2==0?.92f:-.92f;forward=Math.Min(.2f,forward);}
            if(m.Station>0 && d>(ranged?6f:2.6f) && !blocked)
            {
                float theta=Heading(near.X-m.LastSeen.X,near.Z-m.LastSeen.Z)+(m.Station%2==0?1:-1)*(m.Station==3?1.8f:1.08f);
                Place wing=Offset(m.LastSeen,theta,ranged?8f:2.15f);
                if(Arena.CanStand(g,wing.X,Arena.Ground(g,wing.X,wing.Z),wing.Z) && g.StormMargin(wing.X,wing.Z)>=0)
                {
                    float wx=wing.X-a.X,wz=wing.Z-a.Z,n=Dist(0,0,wx,wz);
                    if(n>1){forward=(wx*dx+wz*dz)/n;side=(-wx*dz+wz*dx)/n;}
                }
            }
            if(smallest<1.3f)
            {
                float cross=(a.X-near.X)*-dz+(a.Z-near.Z)*dx;
                side=cross>=0?1:-1;
            }
            return blocked;
        }

        public static void AlertShot(Game g,Actor target,Actor shooter,float impactDX,float impactDZ)
        {
            Mind m;
            if(g!=current || target==null || !target.Alive || !minds.TryGetValue(target,out m) || shooter==null || Allied(g,target,shooter))return;
            float length=Dist(0,0,impactDX,impactDZ);
            float incoming=length>.001f?Heading(-impactDX,-impactDZ):target.Yaw;
            target.Yaw=incoming;
            bool inBearing=Dist(target.X,target.Z,shooter.X,shooter.Z)<3.2f ||
                           Math.Abs(Angle(Heading(shooter.X-target.X,shooter.Z-target.Z)-incoming))<1.28f;
            if(inBearing && shooter.Alive && Perception.SeeImpactSource(g,target.X,Eye(target),target.Z,shooter))
            {
                m.Enemy=shooter;m.HasObservation=true;m.SeenAt=g.Time;m.LastSeen=new Place(shooter.X,shooter.Z);
                m.FocusTarget=shooter;m.FocusUntil=g.Time+2.2f;
                m.LostSight=10;m.HeardEnemy=false;m.SearchLeg=0;m.Scan=.15f;
                m.Job=Aim.Combat;m.ReadTime=0;m.Replan=0;m.ImpactUntil=g.Time+1.2f;m.ImpactClue=m.LastSeen;
                Report(g,target,m,m.LastSeen,Clue.Contestant);
                return;
            }
            // A concealed archer leaves an incoming bearing. The clue lies a few
            // metres from the victim and does not use shooter position or identity.
            m.ImpactClue=Constrain(Offset(new Place(target.X,target.Z),incoming+m.Between(-.42f,.42f),m.Between(4,8)),Arena.Radius-2);
            m.ImpactUntil=g.Time+4.5f;m.Heard=m.ImpactClue;m.HeardFor=4.5f;m.HeardEnemy=false;
            m.HasObservation=false;m.Job=Aim.Search;m.Goal=m.ImpactClue;m.Pause=0;m.Replan=0;m.Scan=.2f;
            Report(g,target,m,m.ImpactClue,Clue.Arrows);
        }

        static Place SearchExit(Game g,Actor a,Mind m)
        {
            float dx=m.ReadVX,dz=m.ReadVZ;
            if(Dist(0,0,dx,dz)<.8f){dx=m.LastSeen.X-a.X;dz=m.LastSeen.Z-a.Z;}
            float dir=Heading(dx,dz);
            Place best=m.LastSeen;float high=-999;
            for(int i=0;i<6;i++)
            {
                float off=i==0?0:m.Between(-1.9f,1.9f);
                Place p=Constrain(Offset(m.LastSeen,dir+off,m.Between(3,8)),Math.Max(1,g.SafeRadius-2));
                if(!Arena.CanStand(g,p.X,Arena.Ground(g,p.X,p.Z),p.Z))continue;
                float score=Cos(off)*1.35f+Arena.Cover(g,p.X,p.Z)*1.8f+Arena.Path(p.X,p.Z)*.7f-
                            Arena.WetDepth(g,p.X,p.Z)*.8f+m.Between(0,.85f);
                if(score>high){best=p;high=score;}
            }
            return best;
        }
    }
}
