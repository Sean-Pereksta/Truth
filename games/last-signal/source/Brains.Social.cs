using System;
using System.Collections.Generic;

namespace LastSignal
{
    public static partial class Brains
    {
        sealed class Offer
        {
            public Actor Caller, Listener;
            public Place CallSite, AnswerSite;
            public float Reply, Expires;
        }
        static readonly List<Offer> offers=new List<Offer>(2);
        static float nextRecruit;
        static bool closedPacts;
        static int Capacity(Game g) { return minds.Count<8?2:g.Level>=3 && minds.Count>=13?4:3; }
        static int Tables(Game g) { return g.Level>=3 && minds.Count>=15?2:1; }
        static Offer Pending(Actor a)
        {
            for(int i=0;i<offers.Count;i++)if(offers[i].Caller==a||offers[i].Listener==a)return offers[i];
            return null;
        }
        static bool OfferPartners(Actor a,Actor b)
        {
            Offer o=Pending(a);
            return o!=null && (o.Caller==b||o.Listener==b);
        }
        public static void Hostility(Game g,Actor target,Actor source)
        {
            Mind m;
            if(g!=current||g.Level<2||target==source||!minds.TryGetValue(target,out m))return;
            m.RecruitAfter=Math.Max(m.RecruitAfter,g.Time+8);
            Offer o=Pending(target);if(o!=null)CancelOffer(g,o);
            if(source!=null && Perception.SeeActor(g,target,source)){m.Grudge=source;m.GrudgeUntil=g.Time+80;}
        }
        static void CancelOffer(Game g,Offer o)
        {
            offers.Remove(o);
            foreach(Actor a in new[]{o.Caller,o.Listener})
            {
                Mind m=minds[a];m.RecruitAfter=Math.Max(m.RecruitAfter,g.Time+3);m.Scan=m.Replan=0;
            }
        }
        static bool Calm(Game g,Actor a,Actor other)
        {
            if(!a.Alive||a.Hurt>.02f||a.Windup>0||a.Swing>0||a.Hunger<14||a.Hydration<15||g.StormMargin(a.X,a.Z)<1)return false;
            Mind m=minds[a];
            if(m.ImpactUntil>g.Time || (m.Grudge==other && m.GrudgeUntil>g.Time))return false;
            return !m.HasObservation||m.Enemy==other||m.Enemy==null||
                Dist(a.X,a.Z,m.LastSeen.X,m.LastSeen.Z)>(m.Job==Aim.Combat?12f:4.4f);
        }
        static bool SignalReaches(Game g,Actor a,Actor b)
        {
            return Dist(a.X,a.Z,b.X,b.Z)<(g.Rain?10f:15f) &&
                Arena.Clear(g,a.X,Eye(a),a.Z,b.X,Eye(b),b.Z);
        }
        static bool TickOffer(Game g,Actor a,Mind m,float dt)
        {
            Offer o=Pending(a);
            if(o==null)return false;
            // Each contestant turns to the point where the signal was made.
            Place p=o.Caller==a?o.AnswerSite:o.CallSite;
            a.Yaw=ApproachAngle(a.Yaw,Heading(p.X-a.X,p.Z-a.Z),dt*5.7f);
            a.Crouch=a.Sprint=a.Aiming=false;Guard(a,false);a.Speed=0;
            a.State=o.Caller==a?"offering a truce":"considering a truce";
            return true;
        }
        static void LocalFeed(Game g,Actor speaker,Actor partner,string text)
        {
            Actor eye=g.CameraTarget;
            if(eye==null || g.FeedTime>0 || Dist(eye.X,eye.Z,speaker.X,speaker.Z)>21f)return;
            if((eye==speaker||Perception.SeeActor(g,eye,speaker)) &&
               (eye==partner||Perception.SeeActor(g,eye,partner))){g.KillFeed=text;g.FeedTime=2.8f;}
        }
        static void Join(Game g,Pack p,Actor a)
        {
            Mind m=minds[a];p.Members.Add(a);m.Alliance=p;
            m.Station=0;
            while(p.Members.Exists(b=>b!=a && b.Alive && minds[b].Station==m.Station))m.Station++;
            m.Expedition=false;m.Home=p.Rendezvous;
            m.AnchorTime=g.Time;m.CareAfter=g.Time;
            trackers.Remove(a);m.Replan=m.Scan=0;
        }
        static bool WantsAlliance(Offer o)
        {
            Mind m=minds[o.Listener];
            Actor listener=o.Listener;
            bool supplied=CombatReady(listener) && listener.Health>70 && listener.Hunger>54 && listener.Hydration>54;
            return !supplied || CombatReady(o.Caller) || m.Dice.NextDouble()>.26f+.36f*m.Boldness;
        }
        static bool Confirm(Game g,Offer o)
        {
            Actor a=o.Caller,b=o.Listener;Mind ma=minds[a],mb=minds[b];
            Pack p=ma.Alliance;
            if(mb.Alliance!=null||(p!=null&&(!p.Active||Living(p)>=Capacity(g))))return false;
            if(!WantsAlliance(o))
            {
                mb.RecruitAfter=g.Time+27;
                LocalFeed(g,b,a,b.Name+" declined "+a.Name+"'s truce");
                return false;
            }
            if(p==null)
            {
                int number=1;
                while(careers.Exists(group=>group.Active&&group.Number==number))number++;
                if(number>Tables(g))return false;
                p=new Pack{Number=number,Rendezvous=ma.Home};
                careers.RemoveAll(group=>!group.Active && group.Number==number);
                careers.Add(p);Join(g,p,a);
            }
            Join(g,p,b);
            ma.AllyAnchor=new Place(b.X,b.Z);mb.AllyAnchor=new Place(a.X,a.Z);ma.AnchorTime=g.Time;
            foreach(Actor member in p.Members)
            {
                Mind m=minds[member];
                if(m.Enemy!=null && p.Members.Contains(m.Enemy)){m.Enemy=null;m.HasObservation=false;m.LostSight=0;m.ReadTarget=null;}
                if(m.FocusTarget!=null && p.Members.Contains(m.FocusTarget))m.FocusTarget=null;
                m.Scan=m.Replan=0;
            }
            g.TruceSignal(b,true);
            LocalFeed(g,b,a,b.Name+(Living(p)==2?" formed a pact with ":" joined ")+a.Name+(Living(p)==2?"":"'s pack"));
            return true;
        }
        static void NewOffer(Game g,Actor a,Actor b)
        {
            var offer=new Offer{Caller=a,Listener=b,CallSite=new Place(a.X,a.Z),AnswerSite=new Place(b.X,b.Z),
                Reply=g.Time+.78f,Expires=g.Time+2.1f};
            offers.Add(offer);
            g.TruceSignal(a,false);
        }
        static void UpdateCourtesies(Game g)
        {
            for(int i=offers.Count-1;i>=0;i--)
            {
                Offer o=offers[i];Actor a=o.Caller,b=o.Listener;
                if(!Calm(g,a,b)||!Calm(g,b,a)||!SignalReaches(g,a,b)||g.Time>o.Expires){CancelOffer(g,o);continue;}
                if(g.Time<o.Reply||!Perception.SeeActor(g,a,b)||!Perception.SeeActor(g,b,a))continue;
                Confirm(g,o);CancelOffer(g,o);
            }
            int liveGroups=0,pendingGroups=0;
            foreach(Pack p in careers)if(p.Active)liveGroups++;
            foreach(Offer o in offers)if(minds[o.Caller].Alliance==null)pendingGroups++;
            int limit=Tables(g),seats=Capacity(g);
            foreach(Actor a in g.Actors)
            {
                if(g.PlayerDriven(a)||!a.Alive||Pending(a)!=null)continue;
                Mind m=minds[a];
                if(m.RecruitAfter>g.Time||m.NextInvite>g.Time||m.Job==Aim.Build||m.Job==Aim.Recover||ActiveHunter(a))continue;
                Pack p=m.Alliance;
                if(p==null && liveGroups+pendingGroups>=limit)continue;
                if(p!=null && (!p.Active || Living(p)>=seats || offers.Exists(o=>minds[o.Caller].Alliance==p)))continue;
                Actor best=null;float bestScore=-1000;
                foreach(Actor b in g.Actors)
                {
                    if(a==b||g.PlayerDriven(b)||!b.Alive||Pending(b)!=null)continue;
                    Mind mb=minds[b];
                    if(mb.Alliance!=null||mb.RecruitAfter>g.Time||ActiveHunter(b)||!Calm(g,a,b)||!Calm(g,b,a))continue;
                    float d=Dist(a.X,a.Z,b.X,b.Z);
                    if(d>15||!Perception.SeeActor(g,a,b)||!SignalReaches(g,a,b))continue;
                    float score=15f-d+(CombatReady(b)?2:0)+Math.Abs(mb.Caution-m.Caution);
                    if(score>bestScore){best=b;bestScore=score;}
                }
                if(best==null){m.NextInvite=g.Time+1.3f;continue;}
                NewOffer(g,a,best);
                if(p==null)pendingGroups++;
            }
        }
    }
}
