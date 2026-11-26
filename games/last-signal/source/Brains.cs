using System;
using System.Collections.Generic;

namespace LastSignal
{
    // Histories stay with the individual contestant. Losing sight never grants fresh
    // coordinates: only a new observation or a fresh, imprecise sound can do that.
    public static partial class Brains
    {
        enum Style { Raider, Hunter, Builder, Shadow, Scout }
        enum Aim { Travel, Loot, Stalk, Evade, Search, Wait, Combat, Camp, Forage, Water, Build, Recover }

        struct Place
        {
            public float X, Z;
            public Place(float x, float z) { X=x; Z=z; }
        }

        sealed class Mind
        {
            public readonly Random Dice;
            public readonly Style Style;
            public readonly float Boldness, Caution, Curiosity, HuntInterest, BuildInterest;
            public readonly Place[] RouteHistory=new Place[6];
            public readonly Prop[] FailedLoot=new Prop[4];
            public readonly float[] LootRetryAt=new float[4];
            public Place RouteGoal, PreySeen, SmokeLead;
            public float RouteUntil, RouteValue, CommitUntil, WithdrawUntil, PreySeenAt, CandidateWaterDeadline, LastHealth=100f;
            public float SmokeLeadUntil, OpeningExitUntil;
            public int RouteCount, RouteCursor, SeenWeaponRank, FailedLootCursor;
            public bool SeenRanged;
            public BotFort Fort, FortCandidate;
            public float NextFortCheck, FortWork, FortPauseUntil;
            public int FortsStarted;
            public Aim Job;
            public Place Goal, LastSeen, Heard, Home, LastPosition;
            public float Think, Scan, Pause, Replan, LostSight, HeardFor, Watch, Steering;
            public float HitCooldown, GuardFor, RunFor, Stuck, Action, Danger, Age;
            public float Drift;
            public int Side, SearchLeg, Harvests;
            public bool Expedition, Rush, RushArmed, Vault, GrabAndLeave, WatchOpening;
            public Place RimPost;
            public float ExtraThreatUntil, ExposedUntil, SawDuelUntil, HoldBackUntil, ReconsiderAt;
            public Actor ExposedTarget;
            public int VisibleRivals;
            public int VaultLane;
            public float VaultUntil;
            public Prop Claim, AvoidPrize;
            public float ClaimExpires, ContestUntil, PatrolTime, ReachedStand;
            public int FlankPoint;
            public Place ThrowSite;
            public float RecoverUntil;
            public bool HasObservation, HeardEnemy, Opening;
            public Actor Enemy; public Animal Animal;
            public Actor ReadTarget;
            public Place EyeFix, TacticalCover;
            public float FixTime, ReadTime, ReadVX, ReadVZ, ReplyAt, CounterUntil, CoverUntil, CoverCheck, GuardSeenAt, FlankUntil, GuardHabit, PassAfter;
            public bool SawMotion, AnswerMotion, LargeWind, WasGuard, ReadGuard, ReadRanged, ReadSwing, ReadMotion, CanRead;

            public Prop Item, Fire, WaterSource, Barrel;
            public Prop CampProgressFire, DeferredFire;
            public float CampProgress, CampProgressAt, FireRetryAt, NewFireAfter;
            public Prop WorkTree;
            public float NextWorkCheck, WorkEnds;
            public float WaterDeadline, WaterRecheck;
            public int Drinks;
             public float SmokeTime; public float GuardDelay, NextScanPose, NavAngle, NavTime, SeenAt=-200, LastNoiseAt=-200; public readonly List<Prop> Nearby=new List<Prop>(80);
            public Mind(int seed, int index)
            {
                Dice=new Random(seed);
                Style=(Style)(index % 5);
                var temperament=new Random(unchecked(seed*29+81749));
                Boldness=(float)temperament.NextDouble();
                Caution=(float)temperament.NextDouble();
                Curiosity=(float)temperament.NextDouble();
                HuntInterest=(float)temperament.NextDouble();
                BuildInterest=(float)temperament.NextDouble();
                Side=Dice.Next(2)==0 ? -1 : 1;
                Think=(float)Dice.NextDouble()*.23f;
                Scan=0;
                Opening=true;


            }
            public float Between(float a, float b) { return a+(b-a)*(float)Dice.NextDouble(); }
            public Pack Alliance;
            public Actor Grudge, CarePartner;
            public float GrudgeUntil, RecruitAfter, NextInvite, CareAfter, CareUntil, CareReady, NextWatch, LookoutUntil;
            public int Station;
            public Clue Briefing;
            public float BriefedAt=-1000, BriefUntil, AnchorTime=-1000;
            public Place AllyAnchor, PackGoal;
            public float ImpactUntil;
            public Place ImpactClue;
            public Actor FocusTarget;
            public float FocusUntil;
            public float PursuitRunUntil, BreathUntil, RunnerSince;
            public float VaultCheck;
            public float SeenFeet, NextRampCheck, RampUntil;
            public Prop ApproachRamp;
            public bool OnApproachRamp;
            public bool VaultWaypoint;
            public Place VaultPoint, VaultDestination;
        }

        const float Tau=(float)Math.PI*2f;
        static float Dist(float x, float z, float a, float b)
        {
            float dx=a-x, dz=b-z;return (float)Math.Sqrt(dx*dx+dz*dz);
        }
        static float Heading(float dx, float dz) { return (float)Math.Atan2(dx,dz); }
        static float Sin(float a) { return (float)Math.Sin(a); }
        static float Cos(float a) { return (float)Math.Cos(a); }
        static float Angle(float a)
        {
            if(a>(float)Math.PI) a-=Tau;
            if(a<-(float)Math.PI) a+=Tau;
            return a;
        }
        static float ApproachAngle(float a,float b,float speed)
        {
            float d=Angle(b-a); return Angle(a+Math.Max(-speed,Math.Min(speed,d)));
        }
        static Place Offset(Place p,float angle,float radius)
        {
            return new Place(p.X+Sin(angle)*radius,p.Z+Cos(angle)*radius);
        }


        sealed class CreatureMind
        {
            public Place Home, Destination;
            public float Think, Idle, Flight, Chirp, BaseYaw, VX, VZ;
            public float SeenNoise=-200;
            public readonly Random Dice;
            public CreatureMind(int seed) { Dice=new Random(seed); }
            public float Between(float a,float b) { return a+(b-a)*(float)Dice.NextDouble(); }
        }

        static Dictionary<Actor,Mind> minds=new Dictionary<Actor,Mind>();
        static Dictionary<Animal,CreatureMind> wildlife=new Dictionary<Animal,CreatureMind>();
        static Game current;
        static float animalClock;
        static readonly List<Prop> prizes=new List<Prop>();

        // A departing survivor keeps their body, gear and injuries. A new mind
        // begins with only that location as evidence, without resetting other bots.
        internal static void InheritContestant(Game g,Actor a)
        {
            if(current!=g || minds.ContainsKey(a))return;
            Mind m=new Mind(unchecked(g.Seed*3037+a.Id*8231+773),a.Id+(int)((uint)g.Seed%5));
            a.Style=m.Style.ToString().ToLowerInvariant();
            m.Home=m.LastPosition=new Place(a.X,a.Z);
            m.Goal=Constrain(Offset(m.Home,a.Yaw,m.Between(9,21)),Math.Max(7,g.SafeRadius-4));
            m.Job=Aim.Travel; m.Opening=false;m.Expedition=true;
            minds.Add(a,m);
        }

        public static void Reset(Game g)
        {
            current=g; minds.Clear(); wildlife.Clear(); animalClock=0;
            foreach(Actor a in g.Actors)
            {
                if(g.PlayerDriven(a)) continue;
                Mind m=new Mind(unchecked(g.Seed*3037+a.Id*8231+773), a.Id+(int)((uint)g.Seed%5));
                minds.Add(a,m);
                a.Style=m.Style.ToString().ToLowerInvariant();
                float outward=Heading(a.X,a.Z)+m.Between(-.38f,.38f);
                m.Home=Offset(new Place(0,0),outward,m.Between(47f,95f));
                if(m.Curiosity+.30f*m.HuntInterest>.33f && (a.Id+g.Seed%3)%3!=0)
                {
                    float hx,hz;
                    Arena.HuntingGround(Arena.ZoneIndex(Sin(outward)*60,Cos(outward)*60),out hx,out hz);
                    m.Home=Constrain(Offset(new Place(hx,hz),outward,13f*Sin(a.Id*4.72f+g.Seed%41)),Arena.Radius-12);
                    m.Expedition=true;
                }
                m.LastPosition=new Place(a.X,a.Z);
                m.Goal=m.Home; m.Job=Aim.Travel;
            }
            AssignOpening(g);
            MakePacks(g);
            ResetPatrolLandmarks(g);
            int i=0;
            foreach(Animal v in g.Animals)
            {
                var m=new CreatureMind(unchecked(g.Seed*967+6343*(i++)+417));
                m.Home=new Place(v.X,v.Z);m.Destination=m.Home;
                m.Think=m.Between(0,.75f);m.Idle=m.Between(2f,7f);
                m.Chirp=m.Between(6f,13f);wildlife.Add(v,m);
            }
            ResetHunters(g);
        }


        static void AssignOpening(Game g)
        {
            prizes.Clear();
            bool horn=false;
            foreach(Prop p in g.Props)
            {
                if(p.Model=="cornucopia")horn=true;
                if((p.Kind=="pickup" || p.Kind=="pack") && Inside(p.X,p.Z,Arena.OpeningSupplyRadius))prizes.Add(p);
            }
            var candidates=new List<Actor>();
            foreach(Actor a in g.Actors)
            {
                if(g.PlayerDriven(a))continue;
                Mind m=minds[a];
                m.Opening=horn && prizes.Count>0 && Inside(a.X,a.Z,20f) && !Inside(a.X,a.Z,15f);
                if(m.Opening)candidates.Add(a);
            }
            candidates.Sort(delegate(Actor a,Actor b)
            {
                int score=OpeningPriority(b,minds[b],g.Seed).CompareTo(OpeningPriority(a,minds[a],g.Seed));
                return score!=0?score:a.Id.CompareTo(b.Id);
            });
            int count=(int)Math.Round(candidates.Count*.52f,MidpointRounding.AwayFromZero);
            count=Math.Min(candidates.Count,Math.Max(1,count));

            // Some contestants deliberately pass the outside racks to reach the
            // stocked vault. Choose entrants from distinct approaches to its mouth.
            int vaultCount=candidates.Count>=15?4:candidates.Count>=9?3:candidates.Count>=5?2:0;
            int selected=0;
            for(int i=0;i<Math.Min(count,vaultCount);i++)
            {
                int side=((i+(g.Seed&1))%2==0)?-1:1;
                bool flank=i>=2;
                Actor best=null;float high=-9999;
                foreach(Actor a in candidates)
                {
                    Mind m=minds[a];if(m.Rush)continue;
                    float x=side*(flank?14f:5f),z=flank?9.5f:16;
                    float score=OpeningPriority(a,m,g.Seed)*.12f-Dist(a.X,a.Z,x,z);
                    if(score>high){best=a;high=score;}
                }
                if(best!=null){Mind m=minds[best];m.Rush=m.Vault=true;m.VaultLane=side;selected++;}
            }
            foreach(Actor a in candidates)
            {
                if(selected>=count)break;
                if(!minds[a].Rush){minds[a].Rush=true;selected++;}
            }
            foreach(Actor a in candidates)
            {
                Mind m=minds[a];
                m.GrabAndLeave=m.Rush && !m.Vault && m.Caution+.26f*m.Curiosity+m.Between(-.16f,.16f)>.61f;
                m.WatchOpening=!m.Rush && m.Curiosity+m.Between(-.20f,.20f)>.51f;
                if(!m.WatchOpening)continue;
                Place post=Offset(new Place(0,0),Heading(a.X,a.Z)+m.Side*.11f,m.Between(21,25));
                m.RimPost=Arena.CanStand(g,post.X,Arena.Ground(g,post.X,post.Z),post.Z)?post:new Place(a.X,a.Z);
            }
        }

        static int OpeningPriority(Actor a,Mind m,int seed)
        {
            int baseScore=(int)(18+58*m.Boldness-19*m.Caution+15*m.Curiosity);
            uint h=unchecked((uint)seed*2654435761u+(uint)a.Id*2246822519u);
            h^=h>>15;h*=3266489917u;h^=h>>16;
            return baseScore+(int)(h%35u);
        }

        static bool CombatReady(Actor a)
        {
            return a.Weapon!="fists" && (!Ranged(a) || HasRanged(a,a.Weapon));
        }
        static bool Claimed(Game g,Actor a,Prop p)
        {
            foreach(var pair in minds)
                if(pair.Key!=a && pair.Key.Alive && pair.Value.Opening && pair.Value.Claim==p && pair.Value.ClaimExpires>g.Time)return true;
            return false;
        }
        static bool PrizeVisible(Game g,Actor a,Prop p)
        {
            return Arena.Clear(g,a.X,Eye(a),a.Z,p.X,p.Y+.36f,p.Z);
        }
        static bool Interior(Prop p)
        {
            return p.Z<.60f && p.Z>-10 && Math.Abs(p.X)<5.4f;
        }
        static Prop ChoosePrize(Game g,Actor a,Mind m)
        {
            Prop best=null;float bestScore=-10000;
            foreach(Prop p in prizes)
            {
                if(p.Removed || p==m.AvoidPrize || Claimed(g,a,p))continue;
                if(m.GrabAndLeave)
                {
                    if(Interior(p) || !PrizeVisible(g,a,p))continue;
                    float value=(p.Kind=="pack"?13f:RankWeapon(p.Item)>0?2f:0f)-Dist(a.X,a.Z,p.X,p.Z);
                    if(value>bestScore){best=p;bestScore=value;}
                    continue;
                }
                int rank=RankWeapon(p.Item);
                bool ammo=(p.Item=="arrows" && a.Count("bow")>0 && a.Count("arrows")==0) ||
                          (p.Item=="bolts" && a.Count("crossbow")>0 && a.Count("bolts")==0) ||
                          (p.Item=="stone" && a.Count("sling")>0 && a.Count("stone")==0);
                if(rank==0 && !ammo)continue;
                float score=ammo?34f:21f;
                string projectile=Game.RangedProjectile(p.Item);
                if(projectile.Length>0)
                {
                    string round=Game.ShotAmmo(projectile);
                    int packed=0;p.Bag.TryGetValue(round,out packed);
                    if(a.Count(round)+packed<=0)
                    {
                        bool pair=false;
                        foreach(Prop q in prizes)
                            if(!q.Removed && q.Item==round && Dist(q.X,q.Z,p.X,p.Z)<7 && !Claimed(g,a,q)){pair=true;break;}
                        if(!pair)continue;
                        score-=8;
                    }
                    score+=4f*m.HuntInterest;
                }
                else if(p.Item=="spear" || p.Item=="hatchet" || p.Item=="sword")score+=1.7f+1.8f*m.Boldness;
                if(m.Vault && Interior(p))
                {
                    score+=95f;
                    bool sameSide=p.X*m.VaultLane>.10f;
                    if(sameSide)score+=3.5f;
                    if(p.Item=="spear" || p.Item=="hatchet" || p.Item=="bow" || p.Item=="sword" || p.Item=="crossbow")score+=3f;
                }
                float d=Dist(a.X,a.Z,p.X,p.Z);
                bool seen=PrizeVisible(g,a,p);
                score-=d*(seen?1f:1.25f);
                if(!seen)score-=Interior(p)?5f:3f;
                if(Math.Abs(a.X)<14 && a.Z>-8 && Inside(p.X,p.Z,9))score+=6.8f*m.Boldness;
                if(score>bestScore){best=p;bestScore=score;}
            }
            return best;
        }

        static void ApproachPrize(Game g,Actor a,Mind m,Prop p)
        {
            m.Item=p;m.Job=Aim.Loot;m.Goal=new Place(p.X,p.Z);m.RunFor=1.2f;
            if(m.Vault && Interior(p))
            {
                float side=m.VaultLane;
                if(a.Z<2.4f && (Math.Abs(a.X)>5.1f || a.Z< -12f))
                {
                    m.Goal=a.Z< -7.8f && Math.Abs(a.X)<8.2f?new Place(side*9.3f,-6.9f):new Place(side*7.45f,3.35f);
                    m.Job=Aim.Travel;return;
                }
                if(a.Z>=2.4f && (Math.Abs(a.X)>3.5f || a.Z>8))
                {
                    m.Goal=new Place(side*1.90f,2.75f);m.Job=Aim.Travel;return;
                }
            }
            if(PrizeVisible(g,a,p)){m.FlankPoint=0;return;}
            // A rear or flank platform cannot cut through the bronze shell. Round
            // the wider flank, enter through the lip, then approach the physical item.
            if(!Interior(p))return;
            if(a.Z<1.6f && (Math.Abs(a.X)>5 || a.Z<-9.2f))
            {
                if(m.FlankPoint==0)m.FlankPoint=a.X<0?-1:a.X>0?1:m.Side;
                float side=m.FlankPoint;
                m.Goal=a.Z<-7.8f && Math.Abs(a.X)<8.1f?new Place(side*9.3f,-6.9f):new Place(side*7.75f,3.2f);
                m.Job=Aim.Travel;return;
            }
            if(a.Z<-.3f && Math.Abs(a.X)>3.5f)
            {m.Goal=new Place((a.X<0?-1:1)*5.4f,3.1f);m.Job=Aim.Travel;return;}
            if(a.Z>0 && Math.Abs(a.X)>3.7f)
            {m.Goal=new Place((a.X<0?-1:1)*2.2f,3.3f);m.Job=Aim.Travel;}
        }

        static bool OpeningPlan(Game g,Actor a,Mind m)
        {
            if(!m.Opening)return false;
            float radius=Dist(0,0,a.X,a.Z);
            if(m.WatchOpening)
            {
                float nearest=m.HasObservation?Dist(a.X,a.Z,m.LastSeen.X,m.LastSeen.Z):100f;
                if(nearest<6f || a.Hurt>.03f || m.Age>16f)m.WatchOpening=false;
                else if(m.Age>5f && (m.ExposedUntil>g.Time || (m.Age>10f && m.VisibleRivals<=1)))
                {
                    m.WatchOpening=false;m.Rush=true;m.GrabAndLeave=true;
                }
                else
                {
                    if(Dist(a.X,a.Z,m.RimPost.X,m.RimPost.Z)>1.6f)
                    {m.Job=Aim.Travel;m.Goal=m.RimPost;return true;}
                    m.Job=Aim.Wait;m.Pause=.8f;m.NextScanPose=1.2f;m.Replan=.42f;
                    Place focus=m.HasObservation?m.LastSeen:new Place(0,0);
                    m.Steering=Heading(focus.X-a.X,focus.Z-a.Z);return true;
                }
            }
            if(!m.Rush)
            {
                if(radius<44 && (m.Age<23 || g.Time<m.ContestUntil))
                {
                    m.Goal=m.Home;m.Job=Aim.Travel;m.RunFor=radius<32f?1.15f:.3f;return true;
                }
                m.Opening=false;return false;
            }
            if(!CombatReady(a) || m.GrabAndLeave)
            {
                if(m.Age>34 || a.Health<26)
                {
                    m.Opening=false;m.Claim=null;m.Goal=m.Home;m.Job=Aim.Travel;m.RunFor=2.2f;return true;
                }
                if(m.Claim!=null && m.ClaimExpires<=g.Time && !m.Claim.Removed)m.AvoidPrize=m.Claim;
                if(m.Claim==null || m.Claim.Removed || m.ClaimExpires<=g.Time)
                {
                    m.Claim=ChoosePrize(g,a,m);m.FlankPoint=0;m.ReachedStand=0;
                    if(m.Claim!=null)m.ClaimExpires=g.Time+5.2f+Dist(a.X,a.Z,m.Claim.X,m.Claim.Z)*.63f;
                }
                if(m.Claim!=null)
                {
                    ApproachPrize(g,a,m,m.Claim);m.Replan=.25f;
                    return true;
                }
                // A player or faster rival may have taken the final usable prize.
                // Quit the circle when the remaining supplies cannot arm this contestant.
                m.Opening=false;m.Goal=m.Home;m.Job=Aim.Travel;m.RunFor=1.5f;return true;
            }

            m.Claim=null;
            if(!m.RushArmed)
            {
                m.RushArmed=true;m.ContestUntil=g.Time+m.Between(10f,16f+13f*m.Boldness);
                m.PatrolTime=0;
                if(m.Vault)m.VaultUntil=g.Time+12.5f;
            }
            if(a.Health<28 || g.Time>m.ContestUntil || radius>26f)
            {
                m.Opening=false;
                if(radius>35f || m.Age>52f)return false;
                m.OpeningExitUntil=g.Time+m.Between(3.8f,6.2f);
                m.Goal=m.Home;m.Job=Aim.Evade;m.RunFor=1.8f;return true;
            }
            bool vaultWatch=m.Vault && g.Time<m.VaultUntil;
            if(m.HasObservation && m.Enemy!=null && m.Enemy.Alive && Inside(m.LastSeen.X,m.LastSeen.Z,23f) &&
               (!vaultWatch || (m.LastSeen.Z<2.3f && Math.Abs(m.LastSeen.X)<6.4f) || Dist(a.X,a.Z,m.LastSeen.X,m.LastSeen.Z)<3f || a.Hurt>.20f))
            {
                m.Job=Aim.Combat;m.Goal=m.LastSeen;m.Pause=0;return true;
            }
            if(vaultWatch)
            {
                // Stand guard inside the vault, looking across the other weapon
                // racks and then out through the opening. Sight still gates combat.
                if(a.Z>-.65f || Math.Abs(a.X)>4.2f)
                {
                    m.Goal=new Place(m.VaultLane*1.1f,-3.05f);m.Job=Aim.Travel;m.Replan=.30f;return true;
                }
                m.Job=Aim.Wait;m.Pause=1.2f;m.Replan=.35f;
                if(m.PatrolTime<=g.Time)
                {
                    bool mouth=m.Dice.Next(3)==0;
                    float wx=mouth?0:(a.X<0?1.85f:-1.85f);
                    float wz=mouth?1.5f:(a.Z< -5?-3.4f:-6.4f);
                    m.Steering=Heading(wx-a.X,wz-a.Z);
                    m.PatrolTime=g.Time+m.Between(.72f,1.6f);
                }
                m.NextScanPose=2f;return true;
            }
            // No fresh sight: face evidence of a nearby fight or scan the mouth.
            if(m.HeardFor>0 && Inside(m.Heard.X,m.Heard.Z,19f))
            {m.Goal=m.Heard;m.Job=Aim.Search;m.HeardEnemy=false;m.Pause=0;return true;}
            if(m.LostSight>0 && Inside(m.LastSeen.X,m.LastSeen.Z,19f))
            {m.Job=Aim.Search;m.Goal=m.LastSeen;m.Pause=0;return true;}
            if(m.PatrolTime<=g.Time || m.Job!=Aim.Search || Dist(a.X,a.Z,m.Goal.X,m.Goal.Z)<1.4f)
            {
                float side=a.X<0?-1:1;
                m.Goal=a.Z<-1 && Math.Abs(a.X)>5?new Place(side*8.4f,3.5f):
                    new Place(m.Between(-6,6),m.Between(2.8f,9.2f));
                m.PatrolTime=g.Time+m.Between(2.0f,4.1f);
            }
            m.Job=Aim.Search;m.Pause=0;return true;
        }

        static bool Inside(float x,float z,float radius) { return x*x+z*z <= radius*radius; }
        static Place Constrain(Place p,float radius)
        {
            float r=Dist(0,0,p.X,p.Z);
            if(r>radius && r>.01f) return new Place(p.X*radius/r,p.Z*radius/r);
            return p;
        }
        static float Eye(Actor a) { return a.Y+(a.Crouch?1.04f:1.58f); }
        static string[] labels={"moving","scavenging","tracking game","withdrawing","searching","hidden","engaged","tending camp","foraging","seeking water","building a fort","recovering"};
        static bool Defensive(Mind m) { return m.Caution>.64f; }
        static bool Visible(Game g,Actor a, Actor b,float distance)
        {
            Mind m;
            if(minds.TryGetValue(a,out m) && m.FocusTarget==b && g.Time<m.FocusUntil &&
               (distance<3.2f || Math.Abs(Angle(Heading(b.X-a.X,b.Z-a.Z)-a.Yaw))<1.28f) &&
               Perception.SeeImpactSource(g,a.X,Eye(a),a.Z,b))return true;
            return Perception.SeeActor(g,a,b);
        }

        static void Observe(Game g, Actor a, Mind m)
        {
            Actor best=null,other=null;float bestScore=-100f,secondScore=-100f;
            m.VisibleRivals=0;
            foreach(Actor b in g.Actors)
            {
                if(b==a || !b.Alive || Allied(g,a,b) || OfferPartners(a,b))continue;
                float d=Dist(a.X,a.Z,b.X,b.Z);
                if(d>(m.FocusTarget==b?78f:65f) || !Visible(g,a,b,d))continue;
                m.VisibleRivals++;
                bool exposed=b.Hurt>.04f || b.CrossbowReload>.12f;
                float score=40f-d+(m.Enemy==b?4f:0f);
                if(exposed && CombatReady(a))score+=7f+3f*m.Boldness;
                if(CombatReady(a))score+=Math.Max(0,RankWeapon(a.Weapon)-RankWeapon(b.Weapon))*.85f;
                if(d<4f && (b.Swing>0 || b.Windup>0))score+=7f;
                if(m.Opening && m.Rush && m.RushArmed && Inside(b.X,b.Z,21f))score+=8f;
                if(m.Vault && g.Time<m.VaultUntil && b.Z<2.3f && Math.Abs(b.X)<6.4f)score+=12f;
                if(score>bestScore){other=best;secondScore=bestScore;best=b;bestScore=score;}
                else if(score>secondScore){other=b;secondScore=score;}
            }
            if(best!=null)
            {
                if(best.Hurt>.04f || best.CrossbowReload>.12f)
                {m.ExposedTarget=best;m.ExposedUntil=g.Time+2.1f;}
                if(other!=null && Dist(a.X,a.Z,other.X,other.Z)<28f)
                {
                    m.ExtraThreatUntil=g.Time+3f;
                    if(AttackingRival(best,other) || AttackingRival(other,best))
                        m.SawDuelUntil=g.Time+2.8f;
                }
                m.Enemy=best;m.HasObservation=true;m.SeenAt=g.Time;
                m.SeenWeaponRank=RankWeapon(best.Weapon);m.SeenRanged=Ranged(best);
                m.LastSeen=new Place(best.X,best.Z);m.SeenFeet=best.Y;m.LostSight=m.Between(8f,15f);
                if(m.FocusTarget==best && g.Time<m.FocusUntil)m.FocusUntil=g.Time+2.2f;
                m.HeardEnemy=false;m.SearchLeg=0;
                Report(g,a,m,m.LastSeen,Clue.Contestant);
            }
            else
            {
                if(m.HasObservation && m.Job==Aim.Combat)
                {
                    m.Job=Aim.Search;m.Goal=m.LastSeen;m.Replan=0;
                }
                m.HasObservation=false;
            }
            Noise pick=null;float bestStrength=0,newest=m.LastNoiseAt;
            for(int i=g.Noises.Count-1;i>=0;i--)
            {
                Noise n=g.Noises[i];
                if(n.Time<=m.LastNoiseAt || g.Time-n.Time>2f) break;
                newest=Math.Max(newest,n.Time);
                if(n.Source==a.Id || FriendlyNoise(g,a,n.Source))continue;
                float d=Dist(a.X,a.Z,n.X,n.Z);
                float range=Perception.HearingRange(g,a,n);
                float strength=range/(d+2f);
                if(d>=range)continue;
                if(best!=null && n.Source>=0 && n.Source!=best.Id && d<16f && n.Range>=12f && Dist(n.X,n.Z,best.X,best.Z)>3f)
                    m.ExtraThreatUntil=g.Time+2.6f;
                if(strength>bestStrength){pick=n;bestStrength=strength;}
            }
            m.LastNoiseAt=newest;
            if(pick!=null)
            {
                if(best==null)
                {
                    float spread=Math.Min(5.2f,.8f+Dist(a.X,a.Z,pick.X,pick.Z)*.11f);
                    m.Heard=Offset(new Place(pick.X,pick.Z),m.Between(0,Tau),m.Between(0,spread));
                    m.HeardFor=m.Between(3f,6f);m.HeardEnemy=true;
                    if(m.LostSight>0 && pick.Time>m.SeenAt && Dist(m.Heard.X,m.Heard.Z,m.LastSeen.X,m.LastSeen.Z)<16f)
                    {
                        // The fresh sound displaces an older visual fix only as a search lead.
                        m.Goal=m.Heard;m.LostSight=0;m.Replan=0;
                    }
                }
            }
        }

        static bool AttackingRival(Actor actor,Actor rival)
        {
            if(actor.Swing<=0 && actor.Windup<=0 && !actor.Aiming)return false;
            float dx=rival.X-actor.X,dz=rival.Z-actor.Z;
            if(dx*dx+dz*dz>(Ranged(actor)?42f*42f:5f*5f))return false;
            return Math.Abs(Angle(Heading(dx,dz)-actor.Yaw))<(Ranged(actor)?.38f:.95f);
        }

        // Pick a nearby detour, favouring foliage, sight-breaking rocks and the
        // dry rim of the basin. The threat location is the most recent observation.
        static Place Covered(Game g,Actor a,Mind m,Place threat,bool escape)
        {
            float direct=escape?Heading(a.X-threat.X,a.Z-threat.Z):Heading(m.Home.X-a.X,m.Home.Z-a.Z);
            Place best=new Place(a.X,a.Z);float score=-1000f;
            for(int i=0;i<18;i++)
            {
                float angle=direct+m.Between(-1.55f,1.55f);
                Place p=Offset(new Place(a.X,a.Z),angle,m.Between(6f,escape?22f:18f));
                p=Constrain(p,Math.Max(1f,Math.Min(g.SafeRadius-1.5f,Arena.Radius-4)));
                float h=Arena.Ground(g,p.X,p.Z);
                if(!Arena.CanStand(g,p.X,h,p.Z))continue;
                float hollow=Arena.Cover(g,p.X,p.Z);
                bool shadow=escape && !Arena.Clear(g,threat.X,Arena.Height(threat.X,threat.Z)+1.55f,threat.Z,p.X,h+.95f,p.Z);
                float s=hollow*9f+(shadow?13f:0f)+2f*Cos(angle-direct)-Arena.Path(p.X,p.Z)*3f-Arena.WetDepth(g,p.X,p.Z)*2.4f;
                if(escape) s+=.22f*Dist(p.X,p.Z,threat.X,threat.Z);
                if(s>score){score=s;best=p;}
            }
            return best;
        }


        // Visible smoke is evidence of a campsite, even when the camper is already
        // gone. The observer gets a place to inspect, never an occupant to track.
        static bool NoticeSmoke(Game g, Actor a, Mind m,out Place smoke)
        {
            smoke=new Place();
            if(g.Time<m.SmokeTime) {
                if(g.Time>=m.SmokeLeadUntil || Dist(a.X,a.Z,m.SmokeLead.X,m.SmokeLead.Z)<2f)return false;
                smoke=m.SmokeLead;return true;
            }
            m.SmokeTime=g.Time+(g.IsNight?m.Between(1.8f,3.6f):m.Between(3f,7f));
            foreach(Prop p in g.CookingSites)
            {
                if(!p.Lit || p.Removed || p.Kind=="stove" || p.Owner==a.Id || FriendlyNoise(g,a,p.Owner))continue;
                float dist=Dist(a.X,a.Z,p.X,p.Z);
                if(dist<4.5f || g.StormMargin(p.X,p.Z)<0)continue;
                if(Math.Abs(Angle(Heading(p.X-a.X,p.Z-a.Z)-a.Yaw))>1.18f)continue;
                FireCue cue;
                if(!Perception.FireVisible(g,a.X,Eye(a),a.Z,p,out cue))continue;
                smoke=m.SmokeLead=new Place(p.X,p.Z);
                m.SmokeLeadUntil=g.Time+Math.Min(20f,6f+dist*.55f);
                Report(g,a,m,smoke,Clue.Fire);
                m.SmokeTime=g.Time+m.Between(20,35);return true;
            }
            return false;
        }
        static bool CanCookAt(Game g,Actor a,Mind m,Prop p)
        {
            return p!=null && !p.Removed && (p!=m.DeferredFire || g.Time>=m.FireRetryAt) &&
                (p.Kind=="stove" || (p.HasMeat && p.Cook>=1f) || p.Fuel>.01f || a.Count("branch")>0);
        }
        static bool CanRecoverCampMeat(Game g,Actor a,Mind m,Prop p)
        {
            return p!=null && !p.Removed && (p!=m.DeferredFire || g.Time>=m.FireRetryAt) &&
                p.Owner==a.Id && p.HasMeat && Dist(a.X,a.Z,p.X,p.Z)<=2.35f;
        }
        static Prop FindFire(Game g,Actor a,Mind m)
        {
            Arena.Near(g,a.X,a.Z,45f,m.Nearby);
            Prop best=null;float bestD=45f;
            foreach(Prop p in m.Nearby)
            {
                if(!(p.Kind=="fire" || p.Kind=="stove" || p.Model=="campfire" || p.Model=="stove") ||
                   !CanCookAt(g,a,m,p))continue;
                float d=Dist(a.X,a.Z,p.X,p.Z);
                if(d<bestD && ReachesInTime(g,a,new Place(p.X,p.Z),18) &&
                   Arena.Clear(g,a.X,Eye(a),a.Z,p.X,p.Y+.45f,p.Z)){best=p;bestD=d;}
            }
            return best;
        }
        static int RankWeapon(string id)
        {
            switch(id){case "crossbow":return 9;case "bow":return 8;case "sword":return 7;case "spear":return 6;case "hatchet":return 5;case "knife":return 4;case "sling":return 3;default:return 0;}
        }
        static bool HasRanged(Actor a,string weapon)
        {
            string projectile=Game.RangedProjectile(weapon);
            return projectile.Length>0&&a.Count(weapon)>0&&a.Count(Game.ShotAmmo(projectile))>0;
        }
        static string BestMelee(Actor a)
        {
            if(a.Count("sword")>0)return "sword";
            if(a.Count("spear")>0)return "spear";
            if(a.Count("hatchet")>0)return "hatchet";
            return a.Count("knife")>0?"knife":"fists";
        }
        static void Arm(Actor a)
        {
            if(HasRanged(a,"crossbow"))Survival.EquipActor(a,"crossbow");
            else if(HasRanged(a,"bow"))Survival.EquipActor(a,"bow");
            else {
                string melee=BestMelee(a);
                Survival.EquipActor(a,melee=="fists"&&HasRanged(a,"sling")?"sling":melee);
            }
        }
        static bool Ranged(Actor a) { return Game.Ranged(a); }
        static void Prepare(Game g,Actor a,Mind m)
        {
            if(a.Hunger<78f) Survival.Eat(g,a);
            if(a.Hydration<68f && a.WaterCarried>=4f && Survival.SipSkin(g,a))m.Drinks++;
            if(a.Count("spear")==0 && g.Time>m.RecoverUntil && (RankWeapon(a.Weapon)<3 || a.Count("sling")>0))
                Survival.Craft(g,a,"spear");
            if(a.Count("sling")==0 && (RankWeapon(a.Weapon)<3 || a.Count("stone")>5))
                Survival.Craft(g,a,"sling");
            if(a.Count("bow")==0 && a.Count("crossbow")==0 &&
               (a.Count("arrows")>1 || m.HuntInterest>.65f && a.Count("spear")>0))
                Survival.Craft(g,a,"bow");
            if(a.Count("bow")>0 && a.Count("arrows")<2) Survival.Craft(g,a,"arrows");
            if(a.Count("firekit")==0 && a.Count("meat")>0 &&
               (!CanCookAt(g,a,m,m.Fire) || !ReachesInTime(g,a,new Place(m.Fire.X,m.Fire.Z),18f)))
                Survival.Craft(g,a,"fire");
            if(a.Count("waterskin")==0 && (a.Weapon!="fists" || a.Hydration<40f))
                Survival.Craft(g,a,"waterskin");
            Arm(a);
            if(!m.HasObservation && m.Job!=Aim.Combat)Armor.Outfit(g,a);
        }

        static bool RetryLoot(Game g,Mind m,Prop p)
        {
            for(int i=0;i<m.FailedLoot.Length;i++)
                if(m.FailedLoot[i]==p && g.Time<m.LootRetryAt[i])return false;
            return true;
        }
        static void DeferLoot(Game g,Mind m,Prop p,float retry)
        {
            int i=m.FailedLootCursor;
            m.FailedLoot[i]=p;m.LootRetryAt[i]=g.Time+retry;
            m.FailedLootCursor=(i+1)%m.FailedLoot.Length;
        }
        static Prop FindLoot(Game g,Actor a,Mind m,float radius)
        {
            Arena.Near(g,a.X,a.Z,radius,m.Nearby);
            Prop best=null;float bestScore=-1000f;
            foreach(Prop p in m.Nearby)
            {
                if(p.Removed || !(p.Kind=="pickup"||p.Kind=="pack") || !RetryLoot(g,m,p))continue;
                if(!Inside(p.X,p.Z,g.SafeRadius-1f))continue;
                float d=Dist(a.X,a.Z,p.X,p.Z);
                if(d>radius)continue;
                int cnt=a.Count(p.Item);
                float quality=0;
                switch(p.Item)
                {
                    case "meal":quality=a.Hunger<80?36:16;break;
                    case "stone":quality=cnt<4?19:cnt<9?9:0;break;
                    case "fiber":quality=cnt<3?20:cnt<(m.BuildInterest>=.82f?10:m.BuildInterest>=.64f?6:4)?16:0;break;
                    case "branch":quality=cnt<4?21:cnt<(m.BuildInterest>=.82f?12:m.BuildInterest>=.64f?7:4)||cnt<7&&a.Count("meat")>0?17:0;break;
                    case "tinder":quality=cnt<2?18:0;break;
                    case "cloth":quality=cnt<2?17:cnt<4?7:0;break;
                    case "scrap":quality=cnt<(m.BuildInterest>=.82f?4:3)?13:0;break;
                    case "arrows":quality=a.Count("bow")>0 && cnt<12?26:cnt<4?8:0;break;
                    case "bolts":quality=a.Count("crossbow")>0 && cnt<8?29:cnt<3?8:0;break;
                    case "shield":quality=cnt==0&&(a.Count("sword")+a.Count("spear")>0)?28:0;break;
                    case "bandage":quality=cnt<2?20:0;break;
                    default: int rank=RankWeapon(p.Item);quality=rank>RankWeapon(a.Weapon)?25+rank*2:0;break;
                }
                if(p.Kind=="pack") quality=32;
                if(quality<=0) continue;
                float score=quality-d*1.1f;
                if(Defensive(m))score+=3f*Arena.Cover(g,p.X,p.Z);
                if(score<=bestScore || d>2.4f && !Arena.Clear(g,a.X,Eye(a),a.Z,p.X,p.Y+.25f,p.Z))continue;
                best=p;bestScore=score;
            }
            return best;
        }

        static Animal FindPrey(Game g,Actor a)
        {
            Animal best=null;float score=-1000;
            foreach(Animal v in g.Animals)
            {
                if(v.Harvested || (v.Alive && Wildlife.Predator(v)) || !Inside(v.X,v.Z,g.SafeRadius-1))continue;
                float d=Dist(a.X,a.Z,v.X,v.Z);
                float sight=(Wildlife.Large(v)?33f:Wildlife.Small(v)?23f:27f)*g.VisibilityFactor(a);
                if(v.State=="flee")sight+=3;
                float attention=Math.Abs(Angle(Heading(v.X-a.X,v.Z-a.Z)-a.Yaw));
                if(d>sight || (d>10 && attention>1.6f) || !Arena.Clear(g,a.X,Eye(a),a.Z,v.X,v.Y+Wildlife.Height(v),v.Z))continue;
                float s=(v.Alive?15f:50f)-d;
                if(s>score){score=s;best=v;}
            }
            return best;
        }



        static Prop FindSpentSpear(Game g,Actor a,Mind m)
        {
            Arena.Near(g,a.X,a.Z,26f,m.Nearby);
            Prop best=null;float nearest=999;
            foreach(Prop p in m.Nearby)
            {
                if(p.Removed || p.Kind!="pickup" || p.Item!="spear" || !RetryLoot(g,m,p) || !Inside(p.X,p.Z,g.SafeRadius-1))continue;
                float d=Dist(m.ThrowSite.X,m.ThrowSite.Z,p.X,p.Z);
                if(d>13 || d>=nearest || !Arena.Clear(g,a.X,Eye(a),a.Z,p.X,p.Y+.28f,p.Z))continue;
                nearest=d;best=p;
            }
            return best;
        }

        static float AimPitch(float distance,float height,float velocity,float gravity)
        {
            // Low ballistic arc through the predicted impact point.
            float v2=velocity*velocity;
            float determinant=v2*v2-gravity*(gravity*distance*distance+2*height*v2);
            if(determinant<=0 || distance<.1f)return (float)Math.Atan2(height,distance);
            return (float)Math.Atan((v2-Math.Sqrt(determinant))/(gravity*distance));
        }

        static bool SuitableWater(Prop p)
        {
            return p!=null && !p.Removed && (p.Model=="rain_barrel" ? p.Water>=4f : p.Kind=="water");
        }

        static bool DrinkAt(Game g,Actor a,Mind m,Prop source)
        {
            float h=a.Hydration;
            if(a.Hydration<98f) Survival.Drink(g,a,source);
            if(a.Hydration>h+.1f)m.Drinks++;
            bool filled=false;
            if(a.Count("waterskin")>0 && a.WaterCarried<41f*a.Count("waterskin"))
                filled=Survival.Fill(g,a,source);
            return filled || a.Hydration>h+.1f;
        }


        static void ConsiderBank(Game g,Actor a,float x,float z,ref float nearest,ref Prop best,ref Place where)
        {
            float d=Dist(a.X,a.Z,x,z),wx,wz;
            if(d>=nearest || !Inside(x,z,Math.Max(1,g.SafeRadius-1)) || Arena.WetDepth(g,x,z)>.24f ||
               !Arena.CanStand(g,x,Arena.Ground(g,x,z),z) || !Arena.Shore(g,x,z,out wx,out wz))return;
            nearest=d;best=null;where=new Place(x,z);
        }
        static bool TryPlanWater(Game g,Actor a,Mind m,out Place where,out Prop source,out float deadline)
        {
            where=new Place();source=null;deadline=0f;
            if(m.Opening || a.Hydration>72f)return false;
            if(m.Job==Aim.Water && m.WaterDeadline>g.Time &&
               (m.WaterSource==null || SuitableWater(m.WaterSource)) &&
               Inside(m.Goal.X,m.Goal.Z,Math.Max(2,g.SafeRadius-1)))
            {where=m.Goal;source=m.WaterSource;deadline=m.WaterDeadline;return true;}
            if(m.WaterRecheck>g.Time || m.HasObservation)return false;
            if(a.WaterCarried>=4f && a.Hydration<68f && Survival.SipSkin(g,a))
            {
                m.Drinks++;m.WaterRecheck=g.Time+3f;
                if(a.Hydration>60f)return false;
            }
            if(Survival.HasShore(g,a) && DrinkAt(g,a,m,null))
            {
                m.WaterRecheck=g.Time+2f;return false;
            }
            bool failed=m.Job==Aim.Water && m.WaterDeadline<=g.Time;
            Prop failedSource=failed?m.WaterSource:null;

            // Springs are fixed arena landmarks. A detected or personally built
            // barrel can shorten a journey, but a distant unseen camp is private.
            Prop best=null;
            float nearest=999f;
            foreach(Prop p in g.Props)
            {
                if(!SuitableWater(p) || !Inside(p.X,p.Z,Math.Max(1,g.SafeRadius-1)))continue;
                float d=Dist(a.X,a.Z,p.X,p.Z);
                if(p.Model=="rain_barrel" && p!=m.Barrel &&
                   (d>20 || !Arena.Clear(g,a.X,Eye(a),a.Z,p.X,p.Y+p.H+.06f,p.Z)))continue;
                if(p==failedSource)d+=30f;
                if(p==m.Barrel)d-=2f;
                if(d<nearest){nearest=d;best=p;where=new Place(p.X,p.Z);}
            }

            int district=Arena.ZoneIndex(a.X,a.Z);
            if(!failed || m.WaterSource!=null)
            {
                if(district==2 && a.X>31)
                {
                    for(int k=0;k<8;k++)
                    {
                        float x=k==0?57f:k==1?77f:Math.Max(40,Math.Min(Arena.Radius-12,a.X+((k-2)/2-1)*7f));
                        float z=k==0?-20f:k==1?-18f:3+Sin(x*.058f)*9+(k%2==0?-9f:9f);
                        ConsiderBank(g,a,x,z,ref nearest,ref best,ref where);
                    }
                }
                else if(district!=0 && !Inside(a.X,a.Z,82f))
                {
                    float lateral=district==1?a.Z:a.X;
                    for(int k=0;k<3;k++)
                    {
                        float cx,cz,level;
                        Arena.StreamPoint(district,lateral+(k-1)*12,out cx,out level,out cz);
                        for(int side=-1;side<=1;side+=2)
                        {
                            float x=cx+(district==1?side*4.3f:0),z=cz+(district==1?0:side*4.3f);
                            ConsiderBank(g,a,x,z,ref nearest,ref best,ref where);
                        }
                    }
                }
            }
            if(nearest==999f){m.WaterRecheck=g.Time+8f;return false;}
            // When secure, fill gradually on the same trip. Before thirst becomes
            // urgent, walk past a nearby source or use a personal camp reservoir.
            if(a.Hydration>55 && nearest>10 && m.Job!=Aim.Water)
            {m.WaterRecheck=g.Time+4f;return false;}
            source=best;
            deadline=g.Time+Math.Max(12,nearest*1.1f+12);
            return true;
        }

        static void Water(Game g,Actor a,Mind m,float dt)
        {
            bool bank=m.WaterSource==null;
            bool close=bank?Survival.HasShore(g,a):Dist(a.X,a.Z,m.WaterSource.X,m.WaterSource.Z)<2.35f;
            if(close && m.Action<=0 && DrinkAt(g,a,m,m.WaterSource))
            {
                a.Speed=0;a.Crouch=true;m.Action=1.4f;
                if(a.Hydration>68f)
                {m.WaterRecheck=g.Time+8f;m.Job=Aim.Forage;m.Replan=0;}
                return;
            }
            a.Crouch=Defensive(m) && a.Hydration>35 && Arena.Cover(g,a.X,a.Z)>.5f;
            if(close){a.Speed=0;return;}
            Go(g,a,m,m.Goal.X-a.X,m.Goal.Z-a.Z,a.Crouch?1.65f:2.9f,dt,true);
        }

        static void Guard(Actor a,bool raised)
        {
            Game.SetGuard(a,raised);
        }
        static void Go(Game g,Actor a,Mind m,float dx,float dz,float speed,float dt,bool look)
        {
            if(Game.DodgeMoving(a)){a.Sprint=false;return;}
            if(look && (m.Job==Aim.Travel || m.Job==Aim.Search || m.Job==Aim.Evade) &&
               Math.Abs(a.X)<10 && a.Z>=-16 && a.Z<=5.25f)
            {
                float tx=a.X+dx,tz=a.Z+dz;
                if(g.Time>=m.VaultCheck || Dist(tx,tz,m.VaultDestination.X,m.VaultDestination.Z)>1.4f ||
                    (m.VaultWaypoint && Dist(a.X,a.Z,m.VaultPoint.X,m.VaultPoint.Z)<.65f))
                {
                    float waypointX,waypointZ;
                    m.VaultWaypoint=Arena.VaultExit(g,a.X,a.Z,tx,tz,out waypointX,out waypointZ);
                    m.VaultPoint=new Place(waypointX,waypointZ);m.VaultDestination=new Place(tx,tz);
                    m.VaultCheck=g.Time+.40f;
                    if(m.VaultWaypoint)m.NavTime=0;
                }
                if(m.VaultWaypoint){dx=m.VaultPoint.X-a.X;dz=m.VaultPoint.Z-a.Z;}
            }
            float magnitude=Dist(0,0,dx,dz);
            if(magnitude<.12f || speed<.01f){a.Speed=0;return;}
            speed*=g.Mobility(a);
            if(Arena.WetDepth(g,a.X,a.Z)>.08f)speed*=g.Flood?.63f:.82f;
            float dir=Heading(dx,dz);
            if(m.NavTime>0 && look)dir=m.NavAngle;
            float distance=Math.Min(magnitude,speed*dt);
            float ox=a.X,oz=a.Z;
            float desiredX=Sin(dir)*distance,desiredZ=Cos(dir)*distance;
            Arena.Move(g,a,desiredX,desiredZ);
            float moved=Dist(ox,oz,a.X,a.Z);
            bool hit=moved<distance*.58f;
            if(hit)
            {
                if(UseCampEntrance(g,a,m,dir,dt))return;
                float probe=Math.Max(.92f,distance+0.6f);
                float best=-100;float bestDir=dir;
                for(int j=0;j<10;j++)
                {
                    int k=j/2;
                    float turn=(.42f+k*.37f)*(j%2==0?m.Side:-m.Side);
                    float theta=dir+turn;
                    float x=ox+Sin(theta)*probe,z=oz+Cos(theta)*probe;
                    float foot=Arena.GroundBelow(g,x,z,a.Y+.44f);
                    if(!Arena.CanStand(g,x,foot,z))continue;
                    float s=2f*Cos(theta-Heading(dx,dz))+.16f*(j%2==0?1:0);
                    if(a.Crouch)s+=Arena.Cover(g,x,z)*.3f;
                    s-=Arena.WetDepth(g,x,z)*.16f;
                    if(s>best){best=s;bestDir=theta;}
                }
                if(best>-90)
                {
                    dir=bestDir;
                    Arena.Move(g,a,Sin(dir)*Math.Max(0,distance-moved),Cos(dir)*Math.Max(0,distance-moved));
                    if(look){m.NavAngle=dir;m.NavTime=m.Between(.45f,1.15f);}
                }
                m.Stuck+=dt;
                if(m.Stuck>2.6f)
                {
                    m.Side=-m.Side;m.NavAngle=dir+m.Side*1.68f;m.NavTime=1.2f;
                    if(m.Stuck>6.5f)
                    {
                        m.Item=null;m.Animal=null;m.Stuck=0;m.Replan=0;
                        RememberRoute(m,m.Goal);m.RouteUntil=0;
                        m.Goal=Constrain(Offset(new Place(a.X,a.Z),m.NavAngle,7f),Math.Max(2,g.SafeRadius-1));
                        m.Job=Aim.Travel;m.Watch=3f;
                    }
                }
            }
            else m.Stuck=Math.Max(0,m.Stuck-dt*2);
            if(look)a.Yaw=ApproachAngle(a.Yaw,dir,dt*(a.Crouch?3.2f:5.8f));
            float movedDist=Dist(ox,oz,a.X,a.Z);
            a.Speed=movedDist/Math.Max(.001f,dt);
            a.Anim+=movedDist*(a.Crouch?2.9f:2.1f);
            m.Drift+=movedDist;
            if(m.Drift>(a.Crouch?2.8f:2.5f))
            {
                m.Drift=0;
                float water=Arena.WetDepth(g,a.X,a.Z,a.Y);
                float reach=water>.09f?(a.Sprint?19f:13f):(a.Crouch?2.2f:(a.Sprint?17f:8f));
                g.SoundAt(a,reach);g.Cue(g.StrideSound(a,water>.09f),a.X,a.Z,reach);
            }
        }


        // Difficulty changes observation, reaction and decision quality. The actions
        // below spend the same stamina and obey the same recovery as player actions.
        sealed class FighterSkill
        {
            public readonly float Read, React, Recall, AimError, Hesitation, Lead, Reserve;
            public FighterSkill(float read,float react,float recall,float error,float pause,float lead,float reserve)
            { Read=read;React=react;Recall=recall;AimError=error;Hesitation=pause;Lead=lead;Reserve=reserve; }
        }
        static readonly FighterSkill[] skills={
            new FighterSkill(.215f,.30f,.45f,.135f,.53f,.14f,7),
            new FighterSkill(.145f,.24f,.60f,.092f,.29f,.39f,10),
            new FighterSkill(.088f,.16f,.82f,.049f,.14f,.75f,16),
            new FighterSkill(.065f,.112f,.93f,.032f,.08f,.93f,19)
        };
        static float Reach(string weapon)
        {
            switch(weapon){case "spear":return 3.18f;case "sword":return 2.48f;case "hatchet":return 2.12f;case "knife":return 1.80f;default:return 1.58f;}
        }
        static void ReadFighter(Game g,Actor a,Actor b,Mind m,FighterSkill skill)
        {
            bool fresh=m.ReadTarget!=b;
            if(fresh)
            {
                m.ReadTarget=b;m.FixTime=-100;m.ReadVX=m.ReadVZ=0;m.SawMotion=false;m.CounterUntil=0;
                m.GuardFor=0;m.CoverUntil=0;m.WasGuard=false;m.GuardHabit=0;m.FlankUntil=0;
            }
            if(!fresh && g.Time<m.ReadTime)return;
            m.ReadTime=g.Time+skill.Read*m.Between(.82f,1.16f);
            float d=Dist(a.X,a.Z,b.X,b.Z);
            m.CanRead=Visible(g,a,b,d);
            if(!m.CanRead){m.ReadMotion=false;m.ReadSwing=false;m.SawMotion=false;return;}

            Place fix=new Place(b.X,b.Z);
            float age=g.Time-m.FixTime;
            if(age>.01f && age<.55f)
            {
                float vx=(fix.X-m.EyeFix.X)/age,vz=(fix.Z-m.EyeFix.Z)/age;
                if(vx*vx+vz*vz<55){m.ReadVX=.28f*m.ReadVX+.72f*vx;m.ReadVZ=.28f*m.ReadVZ+.72f*vz;}
                else {m.ReadVX=0;m.ReadVZ=0;}
            }
            else {m.ReadVX=m.ReadVZ=0;}
            m.FixTime=g.Time;m.EyeFix=fix;m.LastSeen=fix;m.SeenAt=g.Time;
            m.ReadGuard=b.Guard;
            if(b.Guard && !m.WasGuard)
            {
                m.GuardSeenAt=g.Time;m.GuardHabit=Math.Min(3,m.GuardHabit+.82f);
                if(g.Level==3 && m.GuardHabit>.65f && a.Stamina>20)m.FlankUntil=g.Time+1.55f;
            }
            // Only visible charge and swing poses reveal intent. A held charge can
            // bait an early guard; no input release or future action is inspected.
            bool posing=b.Windup>0 || (g.PlayerCharging(b) && b.DrawPower>.14f);
            m.ReadRanged=Ranged(b) || b.Throwing;
            m.ReadMotion=posing;
            m.ReadSwing=b.Swing>.025f;
            if(posing && !m.SawMotion)
            {
                m.AnswerMotion=m.Dice.NextDouble()<skill.Recall;
                m.LargeWind=b.Heavy || b.DrawPower>.43f;
                m.ReplyAt=g.Time+skill.React*m.Between(.87f,1.24f);
            }
            if(posing && b.Heavy)m.LargeWind=true;
            if(!posing && m.SawMotion && m.ReadSwing && a.Hurt<.06f)
                m.CounterUntil=g.Time+(m.LargeWind?.63f:.29f)*(.68f+g.Level*.10f);
            if(m.WasGuard && !b.Guard)
            {
                if(b.Hurt>.10f)m.CounterUntil=g.Time+.56f;
                else if(g.Level==3 && m.GuardHabit>1.4f)m.CounterUntil=Math.Max(m.CounterUntil,g.Time+.26f);
            }
            m.WasGuard=b.Guard;m.SawMotion=posing;
        }

        static bool ChangedCover(Game g,Actor a,Mind m)
        {
            if(g.Time<m.CoverCheck)return false;
            m.CoverCheck=g.Time+m.Between(1.4f,3.0f);
            float front=Heading(m.LastSeen.X-a.X,m.LastSeen.Z-a.Z);
            float score=999;bool found=false;
            for(int k=0;k<14;k++)
            {
                float angle=front+(k%2==0?1:-1)*m.Between(.50f,2.28f);
                Place point=Offset(new Place(a.X,a.Z),angle,m.Between(2.1f,7.5f));
                float floor=Arena.Ground(g,point.X,point.Z);
                if(!Inside(point.X,point.Z,g.SafeRadius-1) || !Arena.CanStand(g,point.X,floor,point.Z))continue;
                if(Arena.Clear(g,m.LastSeen.X,Arena.Ground(g,m.LastSeen.X,m.LastSeen.Z)+1.48f,m.LastSeen.Z,point.X,floor+.91f,point.Z))continue;
                float cost=Dist(a.X,a.Z,point.X,point.Z)+Arena.WetDepth(g,point.X,point.Z)*2f;
                if(cost<score){score=cost;m.TacticalCover=point;found=true;}
            }
            if(found)m.CoverUntil=g.Time+m.Between(1.7f,2.7f);
            return found;
        }

        static void Duel(Game g,Actor a,Mind m,float dt)
        {
            Actor b=m.Enemy;
            if(b==null || !b.Alive || !m.HasObservation){Guard(a,false);m.Replan=0;return;}
            int level=Math.Max(0,Math.Min(3,g.Level));
            FighterSkill skill=skills[level];
            ReadFighter(g,a,b,m,skill);
            float d=Dist(a.X,a.Z,m.LastSeen.X,m.LastSeen.Z);
            float dx=(m.LastSeen.X-a.X)/Math.Max(.04f,d),dz=(m.LastSeen.Z-a.Z)/Math.Max(.04f,d);
            float peekX=0,peekY=0,peekZ=0;
            bool leaning=m.CanRead && g.LeanEye(b,out peekX,out peekY,out peekZ) && Dist(b.X,b.Z,peekX,peekZ)>.065f
                && !Arena.Clear(g,a.X,Eye(a),a.Z,b.X,b.Y+1.13f,b.Z) && Arena.Clear(g,a.X,Eye(a),a.Z,peekX,peekY-.08f,peekZ);
            if(a.Windup<=0 && a.Swing<=0 && a.NextAttack<=.22f)
            {
                if(Ranged(a)&&!HasRanged(a,a.Weapon))Arm(a);
                string melee=BestMelee(a);
                if(Ranged(a)&&d<3.3f&&melee!="fists")Survival.EquipActor(a,melee);
                else if(d>9f&&!Ranged(a)) {
                    if(HasRanged(a,"crossbow"))Survival.EquipActor(a,"crossbow");
                    else if(level>=2&&HasRanged(a,"bow"))Survival.EquipActor(a,"bow");
                }
            }
            bool ranged=Ranged(a),bow=a.Weapon=="bow",crossbow=a.Weapon=="crossbow";
            float reach=Reach(a.Weapon), enemyReach=Reach(b.Weapon);
            float h=leaning?peekY-.08f:b.Y+(b.Crouch?.77f:1.05f);
            float power=Math.Max(.33f,Math.Min(.96f,.34f+d*.024f+(level<2?0:.05f)));
            string projectile=Game.RangedProjectile(a.Weapon);
            float velocity=Game.ShotSpeed(projectile,power);
            float lead=ranged?(d/velocity+Game.ShotWindup(projectile,power,false))*skill.Lead:(a.Windup>0?a.Windup:a.Weapon=="knife"?.16f:.23f)*skill.Lead;
            // The lead is estimated from sequential visual fixes. It remains fallible
            // against a direction change after release or a movement behind a corner.
            float tx=leaning?peekX:m.LastSeen.X+lead*m.ReadVX;
            float tz=leaning?peekZ:m.LastSeen.Z+lead*m.ReadVZ;
            float ideal=Heading(tx-a.X,tz-a.Z);
            if(!a.Throwing && (a.Windup<=0 || !ranged))a.Yaw=ApproachAngle(a.Yaw,ideal,dt*(3.7f+level*1.0f));
            a.Crouch=false;
            if(a.Hurt>.03f && level==3 && m.GuardHabit>1f)m.FlankUntil=Math.Max(m.FlankUntil,g.Time+.60f);
            bool flanking=level==3 && m.CanRead && !ranged && m.FlankUntil>g.Time;
            bool backOpen=m.CanRead && Math.Abs(Angle(Heading(a.X-b.X,a.Z-b.Z)-b.Yaw))>1.13f;
            bool counter=level>=1 && m.CounterUntil>g.Time && m.CanRead;
            bool react=m.CanRead && m.ReadMotion && m.AnswerMotion && g.Time>=m.ReplyAt;
            bool impending=react && (m.ReadRanged || d<enemyReach+1.00f);
            if(impending && a.Windup<=0 && a.Swing<=.02f && a.Stamina>6)
            {
                bool releasedPose=b.Windup>0;
                float guardLead=level>=2?.15f+(3-level)*.03f:.40f;
                if(level==0 || !releasedPose || b.Windup<=guardLead ||
                    (level>=2 && m.ReadRanged && d>7 && a.Stamina>34))
                {
                    bool lateral=(m.ReadRanged&&!Game.CarriesShield(a)) || ranged || (m.LargeWind && a.Stamina>50 && m.Dice.NextDouble()<.21);
                    if(level>=1 && lateral && a.Stamina>skill.Reserve+20 && a.DodgeTime<=0)
                    {
                        g.Dodge(a,-dz*m.Side,dx*m.Side);m.Side=-m.Side;
                    }
                    else if(!ranged)m.GuardFor=Math.Max(m.GuardFor,releasedPose?.25f:.32f);
                    m.AnswerMotion=false;
                }
            }
            if(m.GuardDelay<=0)
            {
                m.GuardDelay=m.Between(.38f,.88f);
                if(m.Dice.NextDouble()<.32)m.Side=-m.Side;
                if(m.ReadRanged && m.CanRead && d>5 && (react || a.Stamina<33 || (level<=1&&a.Hurt>.05f)))ChangedCover(g,a,m);
            }
            if(m.CanRead)a.GuardPitch=(float)Math.Atan2(h-Eye(a),Math.Max(.15f,d));
            Guard(a,m.GuardFor>0 && !ranged && a.Windup<=0 && a.Swing<=0);
            a.Aiming=ranged;
            bool tired=a.Stamina<skill.Reserve+7 && !counter;
            float near=ranged?(crossbow?23f:bow?15.5f:11.5f):reach*(level==0?.60f:level==1?.80f:.90f);
            if(ranged && m.Vault && g.Time<m.VaultUntil)near=5.1f;
            if(!ranged && tired)near=enemyReach+1.35f;
            if(level>=2 && !ranged && react && m.LargeWind && !a.Guard)near=enemyReach+.8f;
            if(flanking && !tired)near=Math.Min(near,.68f);
            float advance=Math.Max(-1f,Math.Min(1f,(d-near)/(ranged?3.2f:.55f)));
            float side=(ranged?.61f:level==0?.15f:level==1?.33f:.56f)*m.Side;
            if(flanking && !tired)
            {
                float bx=(float)Math.Cos(b.Yaw),bz=-(float)Math.Sin(b.Yaw);
                float outward=(a.X-b.X)*bx+(a.Z-b.Z)*bz;
                float pass=outward>=0?1:-1;
                float x=b.X+pass*bx*.57f-(float)Math.Sin(b.Yaw)*.86f-a.X;
                float z=b.Z+pass*bz*.57f-(float)Math.Cos(b.Yaw)*.86f-a.Z;
                advance=dx*x+dz*z;side=-dz*x+dx*z;
            }
            if(!ranged && d>reach+2.2f)side=0;
            if(level>=2 && !ranged && m.ReadGuard && d<2.7f)side*=1.38f;
            if(a.Windup>0 && !ranged && level>=2 && d>reach*.80f)advance=Math.Max(.25f,advance);

            bool laneBlocked=PackFootwork(g,a,m,dx,dz,d,ranged,ref advance,ref side);
            bool bearing=Math.Abs(Angle(a.Yaw-ideal))<(ranged?.13f:.46f);
            bool guardOpen=m.ReadGuard && g.Time-m.GuardSeenAt>(level==3?.095f:.20f) && m.CanRead;
            bool canCommit=!laneBlocked && a.Windup<=0 && a.Swing<=0 && a.NextAttack<=0 && a.DodgeTime<=.12f && !a.Guard && bearing && m.CanRead && (!crossbow||a.CrossbowLoaded);
            float away=dx*m.ReadVX+dz*m.ReadVZ;
            bool castLane=m.CanRead && !m.Opening && !laneBlocked && a.Weapon=="spear" &&
                d>7 && d<16 && away>2.3f && a.Health>40 &&
                (a.Count("spear")>1 || a.Count("knife")+a.Count("hatchet")+a.Count("sling")+a.Count("bow")+a.Count("sword")+a.Count("crossbow")>0 ||
                 (a.Stamina>50 && d<11+4f*m.Boldness));
            if(!castLane)m.RunnerSince=0;
            else if(m.RunnerSince==0)m.RunnerSince=g.Time;
            if(canCommit && castLane && g.Time-m.RunnerSince>.85f && a.Stamina>skill.Reserve+28 && m.RecoverUntil<g.Time)
            {
                float castPower=.68f+.016f*d,castSpeed=Game.ShotSpeed("spear",castPower);
                float time=(.25f+.38f*castPower+d/Math.Max(10f,castSpeed-away))*(.70f+.28f*skill.Lead);
                float wx=m.LastSeen.X+m.ReadVX*time,wz=m.LastSeen.Z+m.ReadVZ*time;
                float dist=Dist(a.X,a.Z,wx,wz),yaw=Heading(wx-a.X,wz-a.Z);
                a.Yaw=yaw+m.Between(-1,1)*skill.AimError*.36f;
                float castPitch=AimPitch(dist,h-Eye(a),castSpeed,Game.ShotGravity("spear"));
                g.ThrowSpear(a,castPitch,castPower);
                if(a.Throwing){m.ThrowSite=new Place(wx,wz);m.RecoverUntil=g.Time+18f;m.HitCooldown=1f;}
            }
            else if(flanking && !backOpen && m.ReadGuard && d<1.58f && a.Stamina>47f && g.Time>m.PassAfter &&
               a.Windup<=0 && a.DodgeTime<=0 && (a.Weapon=="knife" || m.GuardHabit>1.5f))
            {
                // Step across a planted guard, then turn for the exposed side.
                g.Dodge(a,dx-dz*.29f*m.Side,dz+dx*.29f*m.Side);
                m.PassAfter=g.Time+2.2f;m.FlankUntil=g.Time+.72f;canCommit=false;
            }
            if(canCommit && !ranged && guardOpen && !backOpen && d<1.78f && level>=1 && a.Stamina>=20+skill.Reserve*.45f &&
                (level>=2 || m.Dice.NextDouble()<dt*1.9))
            {
                g.Shove(a);m.CounterUntil=g.Time+.91f;m.HitCooldown=.08f;
            }
            else if(canCommit && (counter || m.HitCooldown<=0) && !tired && (!impending || counter || level==0))
            {
                float tolerance=level==0?.20f:.05f;
                bool inRange=ranged?d<(crossbow?48f:bow?30f:22f):d<reach+tolerance;
                // A guarded opponent can hold the block. Get off its front or close
                // enough to shove instead of feeding repeated light hits into it.
                if(inRange && !(level>=2 && guardOpen && !backOpen && !ranged && g.Time-m.GuardSeenAt<.9f))
                {
                    bool heavy=!ranged && a.Stamina>30+skill.Reserve && (level!=3 || backOpen || m.GuardHabit<1f || guardOpen) &&
                        (counter && m.LargeWind || m.Dice.NextDouble()<(level==0?.49:level==1?.29:guardOpen?.56:.15));
                    float error=m.Between(-1,1)*skill.AimError;
                    a.Yaw=ideal+error;
                    float aimDistance=Dist(a.X,a.Z,tx,tz);
                    if(ranged)g.DrawShot(a,AimPitch(aimDistance,h-Eye(a),velocity,Game.ShotGravity(projectile)),power);
                    else g.Attack(a,heavy,(float)Math.Atan2(h-Eye(a),Math.Max(.5f,aimDistance)));
                    m.HitCooldown=skill.Hesitation*m.Between(.7f,1.6f)+(level==0?.43f:0);
                    m.CounterUntil=0;
                }
            }
            if(a.Throwing && a.Windup>0){a.Aiming=true;a.Sprint=false;a.Speed=0;return;}
            if(g.Time<m.CoverUntil && d>5 && a.Windup<=0)
            {
                a.Crouch=Dist(a.X,a.Z,m.TacticalCover.X,m.TacticalCover.Z)<1.2f;
                Go(g,a,m,m.TacticalCover.X-a.X,m.TacticalCover.Z-a.Z,a.Crouch?1.45f:3.65f,dt,false);return;
            }
            float speed=a.Guard?1.27f:(ranged?2.5f:3.35f);
            if(crossbow&&a.CrossbowReload>0)speed*=.72f;
            if(flanking && !tired)speed=4.05f;
            if(a.Windup>0 || a.Swing>0)speed*=level==3 && !ranged?(flanking?1f:.82f):.42f;
            a.Sprint=false;
            if(d>10 && !ranged && a.Stamina>skill.Reserve+30)speed=4.25f;
            bool pursuit=m.CanRead && !m.Opening && !ranged && !a.Guard && !laneBlocked &&
                d>reach*.64f && away>1.05f && PursuitReady(a) && ReachesInTime(g,a,m.LastSeen,4f);
            if(pursuit)
            {
                // Run toward a short visual intercept. The runner's next input
                // is unknown and a turn or break in sight defeats this prediction.
                float horizon=Math.Min(1.25f,Math.Max(.18f,(d-reach)*.12f))*(.68f+.09f*level);
                float wx=m.LastSeen.X+m.ReadVX*horizon-a.X,wz=m.LastSeen.Z+m.ReadVZ*horizon-a.Z;
                float n=Math.Max(.01f,Dist(0,0,wx,wz));
                advance=(wx*dx+wz*dz)/n;side=(-wx*dz+wz*dx)/n;
                if(g.Time>=m.BreathUntil && g.Time>=m.PursuitRunUntil && a.Stamina>skill.Reserve+32)
                {
                    m.PursuitRunUntil=g.Time+m.Between(4.6f,6.4f);
                    m.BreathUntil=m.PursuitRunUntil+m.Between(1.6f,2.7f);
                }
                a.Sprint=g.Time<m.PursuitRunUntil && a.Stamina>skill.Reserve+12;
                if(!a.Sprint && g.Time<m.PursuitRunUntil)
                {m.PursuitRunUntil=g.Time;m.BreathUntil=g.Time+2.5f;}
                speed=a.Sprint?6.6f:4.25f;
                if(a.Sprint)a.Stamina=Math.Max(0,a.Stamina-11*dt);
            }
            speed*=Math.Min(1,Dist(0,0,advance,side));
            float forwardX=dx*advance-dz*side,forwardZ=dz*advance+dx*side;
            if(ranged && WouldLeaveFiringDeck(g,a,forwardX,forwardZ)){a.Speed=0;return;}
            Go(g,a,m,forwardX,forwardZ,speed,dt,false);
        }

        static void Hunt(Game g,Actor a,Mind m,float dt)
        {
            Animal v=m.Animal;
            if(v==null||v.Harvested){m.Replan=0;return;}
            if(!v.Alive && Dist(a.X,a.Z,v.X,v.Z)<2.45f)
            {
                if(Survival.Harvest(g,a,v)){m.Harvests++;m.Animal=null;m.Job=Aim.Forage;}
                m.Replan=0;return;
            }
            if(!Arena.Clear(g,a.X,Eye(a),a.Z,v.X,v.Y+(v.Alive?Wildlife.Height(v):.24f),v.Z))
            {
                if(g.Time-m.PreySeenAt>3.4f || Dist(a.X,a.Z,m.PreySeen.X,m.PreySeen.Z)<1.25f)
                {m.Animal=null;m.Job=Aim.Forage;m.Replan=0;return;}
                Go(g,a,m,m.PreySeen.X-a.X,m.PreySeen.Z-a.Z,2.2f,dt,true);return;
            }
            m.PreySeen=new Place(v.X,v.Z);m.PreySeenAt=g.Time;
            float dx=v.X-a.X,dz=v.Z-a.Z,d=Dist(0,0,dx,dz);

            if(v.Alive && a.Windup<=0)
            {
                if(HasRanged(a,"crossbow")&&(d>=6||BestMelee(a)=="fists"))Survival.EquipActor(a,"crossbow");
                else if(HasRanged(a,"bow"))Survival.EquipActor(a,"bow");
                else if(a.Count("spear")>0 && (d<6 || (d<=16 && (a.Count("spear")>1 || a.Count("stone")<2 || a.Count("sling")==0))))
                    Survival.EquipActor(a,"spear");
                else if(d<6&&BestMelee(a)!="fists")Survival.EquipActor(a,BestMelee(a));
                else if(a.Count("sling")>0 && a.Count("stone")>0)Survival.EquipActor(a,"sling");
                else Arm(a);
            }
            bool throwing=v.Alive && a.Weapon=="spear" && d>=6 && d<=16 && a.Count("spear")>0;
            bool ranged=v.Alive && (Ranged(a)||throwing);
            bool crossbow=a.Weapon=="crossbow";
            a.Crouch=v.Alive && d<24 && (ranged || v.Alert<=0);
            a.Aiming=ranged && d<28;
            float reach=throwing?16:crossbow?43:a.Weapon=="bow"?28:a.Weapon=="sling"?19:Reach(a.Weapon)-.15f;
            float yaw=Heading(dx,dz);
            if(v.Alive && d<reach && Arena.Clear(g,a.X,Eye(a),a.Z,v.X,v.Y+Wildlife.Height(v),v.Z))
            {
                float body=Wildlife.Height(v);
                float power=Math.Min(.97f,Math.Max(.35f,(throwing?.46f:.32f)+d*.023f+(Wildlife.Large(v)||Wildlife.Predator(v)?.12f:0)));
                string projectile=throwing?"spear":Game.RangedProjectile(a.Weapon);
                float velocity=Game.ShotSpeed(projectile,power);
                float gravity=Game.ShotGravity(projectile);
                float wind=Game.ShotWindup(projectile,power,false);
                float tx=v.X,tz=v.Z;
                CreatureMind observation;
                if(ranged && wildlife.TryGetValue(v,out observation))
                {
                    float horizon=wind+d/velocity;
                    tx+=observation.VX*horizon;tz+=observation.VZ*horizon;
                }
                float flight=Dist(a.X,a.Z,tx,tz);
                yaw=Heading(tx-a.X,tz-a.Z);
                if(a.Windup<=0)a.Yaw=ApproachAngle(a.Yaw,yaw,dt*5f);
                if(Math.Abs(Angle(a.Yaw-yaw))<.13f && a.NextAttack<=0 && a.Windup<=0 && a.Swing<=0 && m.HitCooldown<=0 && (!crossbow||a.CrossbowLoaded))
                {
                    float h=Arena.Height(tx,tz)+body-Eye(a);
                    float pitch=ranged?AimPitch(flight,h,velocity,gravity):(float)Math.Atan2(h,Math.Max(.4f,d));
                    a.Yaw=yaw+m.Between(-.012f,.012f)*(1.1f-.17f*g.Level);
                    if(throwing)
                    {
                        g.ThrowSpear(a,pitch,power);
                        if(a.Windup>0){m.ThrowSite=new Place(tx,tz);m.RecoverUntil=g.Time+16f;}
                    }
                    else if(ranged)g.DrawShot(a,pitch,power);
                    else g.Attack(a,false,pitch);
                    m.HitCooldown=m.Between(.88f,1.7f);
                }
                a.Speed=0;
                return;
            }
            a.Sprint=v.Alive && v.Alert>0 && d>6 && !ranged && a.Stamina>35;
            Go(g,a,m,dx,dz,(a.Sprint?4.6f:a.Crouch?1.62f:2.8f)*(crossbow&&a.CrossbowReload>0?.72f:1),dt,true);
        }
        static void LeaveCamp(Game g,Actor a,Mind m,Prop p)
        {
            if(CanRecoverCampMeat(g,a,m,p))Survival.Tend(g,a,p,"take");
            m.DeferredFire=p;m.FireRetryAt=g.Time+25f;
            m.Fire=m.CampProgressFire=null;m.Job=Aim.Forage;m.Replan=0;
        }

        static void Camp(Game g,Actor a,Mind m,float dt)
        {
            if(m.Fire==null)
            {
                float yaw=a.Yaw;
                for(int i=0;i<7 && m.Fire==null;i++)
                {
                    float theta=yaw+i*.9f;
                    m.Fire=Survival.Build(g,a,"fire",a.X+Sin(theta)*1.7f,a.Z+Cos(theta)*1.7f,theta);
                }
                if(m.Fire==null){m.NewFireAfter=g.Time+14f;m.Job=Aim.Forage;m.Replan=0;return;}
            }
            Prop p=m.Fire;
            if(!CanCookAt(g,a,m,p)){LeaveCamp(g,a,m,p);return;}
            float d=Dist(a.X,a.Z,p.X,p.Z);
            if(d>2.35f){Go(g,a,m,p.X-a.X,p.Z-a.Z,2.9f,dt,true);return;}
            if(m.CampProgressFire!=p || p.Cook>m.CampProgress+.01f) {
                m.CampProgressFire=p;m.CampProgress=p.Cook;m.CampProgressAt=g.Time;
            }
            if(g.Time-m.CampProgressAt>11f){LeaveCamp(g,a,m,p);return;}
            a.Crouch=true;a.Speed=0;
            a.Yaw=ApproachAngle(a.Yaw,Heading(p.X-a.X,p.Z-a.Z),2f*dt);
            if(m.Action>0)return;
            m.Action=m.Between(.85f,1.55f);

            if(m.Barrel!=null && m.Barrel.Removed)m.Barrel=null;
            if(m.Barrel==null && g.Rain && a.Hydration<70f)
            {
                for(int k=0;k<4 && m.Barrel==null;k++)
                {
                    float dir=a.Yaw+1.57f*(k+1);
                    m.Barrel=Survival.Build(g,a,"rain_barrel",a.X+Sin(dir)*1.8f,a.Z+Cos(dir)*1.8f,dir);
                }
            }
            if(m.Barrel!=null && Dist(a.X,a.Z,m.Barrel.X,m.Barrel.Z)<2.65f)
            {
                if(a.Hydration<76f && m.Barrel.Water>4f)DrinkAt(g,a,m,m.Barrel);
                else if(a.WaterCarried>=32 && a.Hydration>=82 && m.Barrel.Water<16)
                    Survival.Pour(g,a,m.Barrel);
            }
            if(p.HasMeat && p.Cook>=1f) {
                if(Survival.Tend(g,a,p,"take")) {
                    Survival.Eat(g,a);m.CampProgress=0;m.CampProgressAt=g.Time;m.Replan=0;
                }
                return;
            }
            if(p.Fuel<15 && a.Count("branch")>0)Survival.Tend(g,a,p,"fuel");
            if(!p.Lit)Survival.Tend(g,a,p,"light");
            if(!p.HasMeat && a.Count("meat")>0) {
                if(Survival.Tend(g,a,p,"cook")){m.CampProgress=p.Cook;m.CampProgressAt=g.Time;}
                return;
            }
            if(!p.HasMeat){m.Job=Aim.Wait;m.Pause=m.Between(2,6);m.Replan=0;}
        }

        static void TickActor(Game g,Actor a,Mind m,float dt)
        {
            m.Age+=dt;m.Scan-=dt;m.Replan-=dt;m.NavTime-=dt;m.HitCooldown-=dt;
            m.GuardFor-=dt;m.GuardDelay-=dt;m.LostSight-=dt;m.HeardFor-=dt;m.Action-=dt;
            m.Pause-=dt;m.Danger-=dt;m.Watch-=dt;m.RunFor-=dt;m.Think-=dt;m.NextScanPose-=dt;
            if(a.Health<m.LastHealth-1.5f)m.Replan=0;
            m.LastHealth=a.Health;
            if(TickOffer(g,a,m,dt))return;
            if(m.Scan<=0)
            {
                m.Scan=m.Between(.36f,.66f)*(1.12f-.13f*g.Level);
                bool had=m.HasObservation;Actor previous=m.Enemy;
                Observe(g,a,m);
                if(m.HasObservation!=had || (m.HasObservation && (previous!=m.Enemy || g.Time<m.ExposedUntil)))m.Replan=0;
            }
            if(m.Think<=0)
            {
                m.Think=m.Between(2.3f,4.7f);
                if(m.Job!=Aim.Combat && m.Job!=Aim.Stalk)Prepare(g,a,m);
            }
            if(TickPackCare(g,a,m,dt))return;
            if(m.Replan<=0) Plan(g,a,m);
            a.State=m.Job==Aim.Wait && m.LookoutUntil>g.Time?"keeping watch":labels[(int)m.Job];a.Sprint=false;a.Aiming=false;
            if(WorkOnFort(g,a,m,dt))return;
            if(ClimbObservedFort(g,a,m,dt))return;
            if(m.Job==Aim.Combat){Duel(g,a,m,dt);return;}
            Guard(a,false);
            if(m.Job==Aim.Recover){Recover(g,a,m,dt);return;}
            if(m.Job==Aim.Stalk){Hunt(g,a,m,dt);return;}
            if(m.Job==Aim.Camp){Camp(g,a,m,dt);return;}
            if(m.Job==Aim.Water){Water(g,a,m,dt);return;}
            a.Crouch=m.Job==Aim.Wait || (Defensive(m) && !m.Opening && m.RunFor<=0 && Arena.Cover(g,a.X,a.Z)>.3f);
            if(Fieldwork(g,a,m,dt))return;
            if(m.Job==Aim.Wait || (m.Job==Aim.Search && m.Pause>0))
            {
                a.Speed=0;
                if(m.NextScanPose<=0){m.Steering=a.Yaw+m.Between(-1.8f,1.8f);m.NextScanPose=m.Between(1.3f,3.5f);}
                a.Yaw=ApproachAngle(a.Yaw,m.Steering,dt*1.2f);return;
            }
            if(m.Job==Aim.Loot && (m.Item==null || m.Item.Removed))
            {m.Replan=0;m.Job=Aim.Forage;m.Item=null;return;}
            float d=Dist(a.X,a.Z,m.Goal.X,m.Goal.Z);
            float grab=2.3f;
            if(m.Job==Aim.Loot && m.Opening && m.Rush && m.Item!=null && m.Item.Y>Arena.Height(m.Item.X,m.Item.Z)+.36f)
            {
                // Approach the stand closely enough for a visible reach. A blocked
                // table end can still be reached from its nearest navigable side.
                if(d<2.25f && m.ReachedStand==0)m.ReachedStand=g.Time;
                grab=m.ReachedStand>0 && g.Time-m.ReachedStand>.70f?1.85f:1.30f;
            }
            if(m.Job==Aim.Loot && d<grab)
            {
                if(Survival.Take(g,a,m.Item))
                {
                    Prepare(g,a,m);
                    if(m.Opening && m.GrabAndLeave)
                    {
                        m.GrabAndLeave=false;m.Rush=false;m.Claim=null;
                        m.Expedition=true;m.Goal=m.Home;m.RunFor=2.6f;m.ContestUntil=g.Time+8f;
                    }
                }
                else if(m.Opening && m.Rush && m.Claim==m.Item)
                {
                    // An item on a stand can be in radius but occluded by its rim.
                    // Step to a different side, then recheck the normal pickup ray.
                    float angle=Heading(a.X-m.Item.X,a.Z-m.Item.Z)+m.Side*.9f;
                    Place edge=Offset(new Place(m.Item.X,m.Item.Z),angle,1.48f);
                    Go(g,a,m,edge.X-a.X,edge.Z-a.Z,2.8f,dt,true);
                    m.Replan=.12f;return;
                }
                else DeferLoot(g,m,m.Item,m.Between(18f,28f));
                m.Item=null;m.Replan=0;m.Job=Aim.Forage;a.Speed=0;return;
            }
            if(d<1.25f){a.Speed=0;m.Replan=0;return;}
            a.Sprint=((m.RunFor>0) || (m.Opening && m.Rush && !m.RushArmed)) && a.Stamina>28;
            if(a.Sprint)a.Stamina=Math.Max(0,a.Stamina-9.5f*dt);
            float speed=a.Sprint?4.65f:(a.Crouch?1.48f:2.7f);
            if(m.Job==Aim.Search)speed*=.79f;
            if(a.Hunger<11)speed*=.83f;
            Go(g,a,m,m.Goal.X-a.X,m.Goal.Z-a.Z,speed,dt,true);
        }
        static bool Habitat(Game g,Animal v,float x,float z)
        {
            if(!Inside(x,z,Arena.Radius-4) || !Arena.CanStand(g,x,Arena.Ground(g,x,z),z))return false;
            return Arena.WetDepth(g,x,z)<(v.Model=="hen" && !g.Flood?.75f:.35f);
        }
        static Place Forage(Game g,Animal v,CreatureMind m,Place threat,bool fleeing)
        {
            Place origin=new Place(v.X,v.Z);
            Place best=origin;float bestScore=-999f;
            float direct=fleeing?Heading(v.X-threat.X,v.Z-threat.Z):m.Between(0,Tau);
            if(!fleeing && Dist(v.X,v.Z,m.Home.X,m.Home.Z)>22)
                direct=Heading(m.Home.X-v.X,m.Home.Z-v.Z);
            for(int i=0;i<13;i++)
            {
                float dir=direct+m.Between(-1.6f,1.6f);
                float distance=fleeing?m.Between(7,16):m.Between(2.4f,6.8f);
                Place p=Constrain(Offset(origin,dir,distance),Arena.Radius-4);
                if(!Habitat(g,v,p.X,p.Z))continue;
                float route=0;
                for(int k=1;k<=3;k++)
                {
                    float x=origin.X+(p.X-origin.X)*.25f*k,z=origin.Z+(p.Z-origin.Z)*.25f*k;
                    if(!Habitat(g,v,x,z))route-=5f;
                }
                float affinity=Wildlife.Small(v) ? Arena.Cover(g,p.X,p.Z)*.95f : v.Model=="hen" ? -Math.Abs(Arena.WetDepth(g,p.X,p.Z)-.12f) : Arena.Path(p.X,p.Z)*.45f;
                float s=Cos(dir-direct)*3f+route+affinity+m.Between(0,.95f);
                if(s>bestScore){bestScore=s;best=p;}
            }
            return best;
        }
        static void AnimalThink(Game g,Animal v,CreatureMind m)
        {
            float sense=Wildlife.Large(v)?12f:Wildlife.Small(v)?9.6f:8.4f;
            Actor closest=null;float best=999;
            foreach(Actor a in g.Actors)
            {
                if(!a.Alive)continue;
                float d=Dist(a.X,a.Z,v.X,v.Z);
                float r=sense*(a.Crouch?.43f:(a.Sprint?1.25f:1f));
                if(d>=r || d>best || !Arena.Clear(g,v.X,v.Y+Wildlife.Height(v)*1.12f,v.Z,a.X,Eye(a),a.Z))continue;
                best=d;closest=a;
            }
            bool threatened=closest!=null;
            Place threat=closest!=null?new Place(closest.X,closest.Z):m.Home;
            for(int i=g.Noises.Count-1;i>=0;i--)
            {
                Noise n=g.Noises[i];
                if(n.Time<=m.SeenNoise || g.Time-n.Time>1.5f)break;
                if(n.Range<12||Dist(v.X,v.Z,n.X,n.Z)>n.Range*.63f) continue;
                m.SeenNoise=n.Time;threatened=true;threat=new Place(n.X,n.Z);break;
            }
            if(g.Flood && Arena.ZoneIndex(v.X,v.Z)==2 && Arena.WetDepth(g,v.X,v.Z)>.06f)
            {threatened=true;threat=new Place(v.X,v.Z+(v.Z>0?-4:4));}
            if(v.Alert>2f)
            {
                threatened=true;
                if(closest==null && g.Noises.Count>0)
                {
                    Noise shot=g.Noises[g.Noises.Count-1];
                    threat=new Place(shot.X,shot.Z);
                }
            }
            if(threatened)
            {
                if(m.Flight<=0)
                {
                    m.Idle=m.Between(.52f,1.0f); // freeze and signal before bolting
                    g.Cue(Wildlife.Bird(v)?"hen":Wildlife.Large(v)?"grazer":"rustle",v.X,v.Z,Wildlife.Large(v)?17f:11f);
                    m.BaseYaw=Heading(threat.X-v.X,threat.Z-v.Z);
                }
                v.Alert=1f;m.Flight=m.Between(2.4f,4.8f);
                m.Destination=Forage(g,v,m,threat,true);
            }
            else if(m.Flight<=0 && m.Idle<=0 && Dist(v.X,v.Z,m.Destination.X,m.Destination.Z)<.65f)
            {
                m.Destination=Forage(g,v,m,m.Home,false);
                m.Idle=m.Between(2.5f,8f);
            }
        }
        static void TickWildlife(Game g,float dt)
        {
            foreach(Animal v in g.Animals)
            {
                CreatureMind m;
                if(!wildlife.TryGetValue(v,out m))continue;
                if(Wildlife.Predator(v)){
                    float oldX=v.X,oldZ=v.Z;Wildlife.StepPredator(g,v,dt);
                    m.VX=(v.X-oldX)/dt;m.VZ=(v.Z-oldZ)/dt;continue;
                }
                if(!v.Alive)
                {
                    if(!v.Harvested)continue;
                    m.Chirp-=dt;
                    if(m.Chirp>0)continue;
                    bool observed=false;
                    foreach(Actor a in g.Actors)
                        if(a.Alive && Dist(a.X,a.Z,m.Home.X,m.Home.Z)<33f){observed=true;break;}
                    if(observed){m.Chirp=18f;continue;}
                    m.Chirp=m.Between(170,250);
                    if(!Inside(m.Home.X,m.Home.Z,g.SafeRadius-3))continue;
                    v.Alive=true;v.Harvested=false;v.HP=Wildlife.MaxHealth(v);
                    v.X=m.Home.X;v.Z=m.Home.Z;v.Y=Arena.Ground(g,v.X,v.Z);v.Alert=0;
                    m.Destination=m.Home;m.Idle=4;m.Flight=0;v.State="idle";
                    continue;
                }
                // A future litter/flock comes back only after the harvested animal
                // has been out of view for several minutes.
                m.Chirp=190f+Math.Abs(m.Home.X)*.53f;
                m.Think-=dt;m.Idle-=dt;m.Flight-=dt;
                if(m.Think<=0){m.Think=m.Between(.36f,.79f);AnimalThink(g,v,m);}
                bool fleeing=m.Flight>0;
                if(!fleeing)v.Alert=Math.Max(0,v.Alert-dt*2.2f);
                m.VX=0;m.VZ=0;
                float distance=Dist(v.X,v.Z,m.Destination.X,m.Destination.Z);
                if(m.Idle>0 || distance<.32f)
                {
                    v.State=fleeing?"alert":"idle";
                    if(fleeing)v.Yaw=ApproachAngle(v.Yaw,m.BaseYaw,dt*6f);
                    v.Anim+=dt*(fleeing?2.6f:.88f);continue;
                }
                float dir=Heading(m.Destination.X-v.X,m.Destination.Z-v.Z);
                float speed=fleeing?Wildlife.FlightSpeed(v):(Wildlife.Large(v)?.94f:.7f);
                v.Yaw=ApproachAngle(v.Yaw,dir,dt*(fleeing?7.7f:3.2f));
                float step=Math.Min(speed*dt,distance);
                float x=v.X+Sin(v.Yaw)*step,z=v.Z+Cos(v.Yaw)*step;
                if(Habitat(g,v,x,z)){m.VX=(x-v.X)/dt;m.VZ=(z-v.Z)/dt;v.X=x;v.Z=z;v.Y=Arena.Ground(g,x,z);}
                else {m.Destination=Forage(g,v,m,new Place(v.X-Sin(dir)*2,v.Z-Cos(dir)*2),fleeing);m.Think=.25f;}
                v.State=fleeing?"flee":"walk";v.Anim+=step*(Wildlife.Small(v)?4.3f:2.5f);
            }
        }

        public static void Step(Game g,float dt)
        {
            if(current!=g || minds.Count!=(g.Actors.Count-g.HumanCount))Reset(g);
            if(dt<=0 || g.Countdown>0)return;
            TickHunterEvidence(g,dt);
            UpdatePacks(g);
            foreach(Actor a in g.Actors)
            {
                if(g.PlayerDriven(a) || !a.Alive)continue;
                Mind m;if(minds.TryGetValue(a,out m))TickActor(g,a,m,dt);
            }
            animalClock+=dt;
            // The animation advances between senses, independent of rendering rate.
            if(animalClock>=.048f){TickWildlife(g,animalClock);animalClock=0;}
        }
    }
}





















