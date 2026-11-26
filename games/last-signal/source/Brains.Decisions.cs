using System;
using System.Collections.Generic;

namespace LastSignal {
    public static partial class Brains {
        struct Decision {
            public Aim Job;
            public Place Goal;
            public float Score;
            public Prop Prop;
            public Animal Animal;
        }

        static readonly List<Place> patrolLandmarks=new List<Place>();

        static void ResetPatrolLandmarks(Game g) {
            patrolLandmarks.Clear();
            for(int district=1;district<=4;district++) {
                float x,z;
                Arena.HuntingGround(district,out x,out z);
                patrolLandmarks.Add(new Place(x,z));
                patrolLandmarks.Add(new Place(x*.53f,z*.53f));
            }
            foreach(Prop p in g.Props)
                if(p.Kind=="water" || p.Model=="watchtower" || p.Model=="aqueduct" || p.Model=="signal_lodge" || p.Model=="sand_arch")
                    patrolLandmarks.Add(new Place(p.X,p.Z));
        }

        static void Consider(Game g,Mind m,ref Decision best,Aim job,Place goal,float score,Prop prop=null,Animal animal=null) {
            if(m.Job==job && g.Time<m.CommitUntil && Dist(m.Goal.X,m.Goal.Z,goal.X,goal.Z)<5f)score+=5;
            if(score<=best.Score)return;
            best=new Decision{Job=job,Goal=goal,Score=score,Prop=prop,Animal=animal};
        }

        static float StormTime(Game g,Place point) {
            float radius=Dist(0,0,point.X,point.Z)+1.2f;
            if(radius>=g.SafeRadius)return 0;
            if(!(g.StormWarning || g.StormMoving) || radius<=g.StormNextRadius)return 10000f;
            if(g.StormWarning)return g.StormSecondsRemaining;
            return g.StormSecondsRemaining*(g.SafeRadius-radius)/Math.Max(1,g.SafeRadius-g.StormNextRadius);
        }

        static float TravelCost(Game g,Actor a,Place goal) {
            float distance=Dist(a.X,a.Z,goal.X,goal.Z);
            float dy=Math.Abs(Arena.Height(goal.X,goal.Z)-Arena.Height(a.X,a.Z));
            float wet=Arena.WetDepth(g,(a.X+goal.X)*.5f,(a.Z+goal.Z)*.5f);
            return distance*(1f+Math.Min(.52f,wet*.33f))+dy*.75f;
        }

        static bool ReachesInTime(Game g,Actor a,Place goal,float work) {
            return StormTime(g,goal)>work+TravelCost(g,a,goal)/Math.Max(.8f,2.4f*g.Mobility(a));
        }

        static bool NeedsRotation(Game g,Actor a) {
            Place here=new Place(a.X,a.Z);
            if(g.StormMargin(a.X,a.Z)<1.2f && g.SafeRadius<Arena.Radius-1f)return true;
            float exit=Dist(0,0,a.X,a.Z)-g.StormNextRadius;
            return exit>0 && StormTime(g,here)<7f+(exit+4f)/Math.Max(.8f,2.6f*g.Mobility(a));
        }

        static Place RotationGoal(Game g,Actor a,Mind m) {
            float radius=Math.Max(.5f,Math.Min(g.SafeRadius-4f,g.StormNextRadius-3f));
            Place best=Constrain(new Place(a.X,a.Z),radius);
            float direction=Heading(a.X,a.Z),bestScore=-1000f;
            for(int i=0;i<7;i++) {
                float turn=i==0?0:((i+1)/2)*.13f*(i%2==0?m.Side:-m.Side);
                Place p=Offset(new Place(0,0),direction+turn,radius);
                if(!Arena.CanStand(g,p.X,Arena.Ground(g,p.X,p.Z),p.Z))continue;
                float score=-TravelCost(g,a,p)+Arena.Cover(g,p.X,p.Z)*5f-Arena.WetDepth(g,p.X,p.Z)*5f;
                if(score>bestScore){best=p;bestScore=score;}
            }
            return best;
        }

        static void RememberRoute(Mind m,Place point) {
            m.RouteHistory[m.RouteCursor]=point;
            m.RouteCursor=(m.RouteCursor+1)%m.RouteHistory.Length;
            m.RouteCount=Math.Min(m.RouteCount+1,m.RouteHistory.Length);
        }

        static float RouteScore(Game g,Actor a,Mind m,Place goal,float attraction) {
            float d=Dist(a.X,a.Z,goal.X,goal.Z);
            if(d<Math.Min(12f,g.SafeRadius*.30f) || !ReachesInTime(g,a,goal,8f) ||
               !Arena.CanStand(g,goal.X,Arena.Ground(g,goal.X,goal.Z),goal.Z))return -1000;
            float novelty=0;
            for(int i=0;i<m.RouteCount;i++)
                novelty=Math.Max(novelty,Math.Max(0,19f-Dist(m.RouteHistory[i].X,m.RouteHistory[i].Z,goal.X,goal.Z)));
            float cover=Arena.Cover(g,goal.X,goal.Z),path=Arena.Path(goal.X,goal.Z);
            return 43f+attraction-novelty*.68f-TravelCost(g,a,goal)*.26f+
                cover*(3f+6f*m.Caution)+path*(3f+3f*m.Curiosity)-Arena.WetDepth(g,goal.X,goal.Z)*7f;
        }

        static void OfferPatrol(Game g,Actor a,Mind m,ref Decision best) {
            float radius=Math.Max(.5f,Math.Min(Arena.Radius-4f,g.SafeRadius-2.5f));
            if(m.RouteUntil>g.Time && Dist(a.X,a.Z,m.RouteGoal.X,m.RouteGoal.Z)>1.8f &&
               RouteScore(g,a,m,m.RouteGoal,0)>-1000) {
                Consider(g,m,ref best,Aim.Travel,m.RouteGoal,m.RouteValue);
                return;
            }
            if(m.RouteUntil>0)RememberRoute(m,m.RouteGoal);
            Place here=new Place(a.X,a.Z),goal=RotationGoal(g,a,m);
            float score=31f;
            if(m.Expedition) {
                float homeRange=Dist(a.X,a.Z,m.Home.X,m.Home.Z);
                if(homeRange<11 || !ReachesInTime(g,a,m.Home,9))m.Expedition=false;
                else {goal=m.Home;score=39f;}
            }
            foreach(Place landmark in patrolLandmarks) {
                float range=Dist(a.X,a.Z,landmark.X,landmark.Z);
                if(range<14 || range>76)continue;
                Place candidate=Constrain(landmark,radius);
                float value=RouteScore(g,a,m,candidate,6f+m.Curiosity*4f);
                if(value>score){score=value;goal=candidate;}
            }
            float direction=Heading(a.X,a.Z)+m.Between(-.45f,.45f);
            for(int i=0;i<8;i++) {
                Place candidate=Constrain(Offset(here,direction+i*Tau/8,m.Between(16f,39f)),radius);
                float value=RouteScore(g,a,m,candidate,m.Between(0f,4f));
                if(value>score){score=value;goal=candidate;}
            }
            m.RouteGoal=goal;
            m.RouteValue=score;
            m.RouteUntil=g.Time+Math.Max(6f,TravelCost(g,a,goal)*.57f+5f);
            Consider(g,m,ref best,Aim.Travel,goal,score);
        }

        static bool PursuitReady(Actor a) {
            return CombatReady(a) && a.Health>=37f && a.Stamina>=27f && a.Hunger>=25f && a.Hydration>=29f;
        }

        static void OfferEncounter(Game g,Actor a,Mind m,ref Decision best) {
            Place here=new Place(a.X,a.Z),seen=m.LastSeen;
            float d=Dist(a.X,a.Z,seen.X,seen.Z);
            bool armed=CombatReady(a),supported=m.Alliance!=null && m.Alliance.Active && g.Time-m.AnchorTime<8f;
            bool exposed=m.ExposedTarget==m.Enemy && g.Time<m.ExposedUntil;
            bool crowded=m.ExtraThreatUntil>g.Time && !supported;
            bool forced=g.AliveCount<=2 && g.SafeRadius<12f;
            bool canLeave=!forced && g.SafeRadius>5f;
            bool threatened=d<(m.SeenRanged?26f:8f);
            bool opponentLeaving=m.ReadTarget==m.Enemy && m.CanRead &&
                (m.ReadVX*(seen.X-a.X)+m.ReadVZ*(seen.Z-a.Z))/Math.Max(1,d)>1.7f;
            float readiness=.33f*(a.Health-63f)+.20f*(a.Stamina-42f)+
                .11f*(a.Hunger-52f)+.15f*(a.Hydration-50f);
            float weaponAdvantage=armed ? 4f+(RankWeapon(a.Weapon)-m.SeenWeaponRank)*3f : -17f-m.SeenWeaponRank*2.5f;
            float distancePenalty=Math.Max(0,d-(Ranged(a)?20f:7f))*(Ranged(a)?.35f:.65f);
            float fight=62f+readiness+weaponAdvantage+(m.Boldness-.5f)*9f+g.Level*2f+
                (exposed?17f:0)+(supported?9f:0)+(opponentLeaving&&armed?6f:0)-distancePenalty;
            if(crowded)fight-=exposed?9f:23f;
            if(m.SawDuelUntil>g.Time && !exposed && d>5 && a.Hurt<=.02f)fight-=14f;
            if(m.Age<47 && Inside(a.X,a.Z,38f) && d>4f)fight-=crowded?17f:7f;
            if(d<4f || forced)fight+=20f;
            if(!canLeave || ReachesInTime(g,a,seen,5f) || d<4f)
                Consider(g,m,ref best,Aim.Combat,seen,fight);
            if(canLeave && (threatened || g.Time<m.WithdrawUntil || fight<55f)) {
                float withdraw=52f-readiness*.68f-weaponAdvantage*.6f+(m.Caution-.5f)*9f+
                    (crowded?15f:0)+(threatened?5f:0)+(a.Hurt>.02f?8f:0)-(exposed?12f:0);
                if(a.Health<26f)withdraw+=24f;
                if(g.Time<m.WithdrawUntil)withdraw+=12f;
                if(withdraw+5f>best.Score) {
                    Place exit;
                    if(m.Job==Aim.Evade && m.Danger>0 && Dist(a.X,a.Z,m.Goal.X,m.Goal.Z)>2.3f &&
                       ReachesInTime(g,a,m.Goal,2f))exit=m.Goal;
                    else if(!TryFortRefuge(g,a,m,seen,out exit) || !ReachesInTime(g,a,exit,4f))exit=Covered(g,a,m,seen,true);
                    if(Dist(a.X,a.Z,exit.X,exit.Z)>1.3f)Consider(g,m,ref best,Aim.Evade,exit,withdraw);
                }
            }
            if(m.SawDuelUntil>g.Time && !exposed && d>6f && a.Hurt<=.02f && g.Time>=m.ReconsiderAt)
                Consider(g,m,ref best,Aim.Wait,here,55f+(m.Caution-.5f)*8f+(crowded?4f:0));
            if(m.HoldBackUntil>g.Time && !exposed && d>6f && a.Hurt<=.02f)
                Consider(g,m,ref best,Aim.Wait,here,62f);
        }

        static void OfferClues(Game g,Actor a,Mind m,ref Decision best) {
            if(!PursuitReady(a) || m.HasObservation || g.Time<m.WithdrawUntil)return;
            float readiness=(a.Health-63f)*.13f+(a.Stamina-45f)*.09f;
            float curiosity=(m.Curiosity-.5f)*10f;
            Place lead;
            if(m.LostSight>0 && m.Enemy!=null && m.SearchLeg<3 && g.Time-m.SeenAt<11f) {
                lead=m.LastSeen;
                if(m.Job==Aim.Search && Dist(m.Goal.X,m.Goal.Z,lead.X,lead.Z)<9f) {
                    lead=m.Goal;
                    if(Dist(a.X,a.Z,lead.X,lead.Z)<1.8f)lead=SearchExit(g,a,m);
                }
                if(ReachesInTime(g,a,lead,4))Consider(g,m,ref best,Aim.Search,lead,61f+readiness+curiosity-TravelCost(g,a,lead)*.36f);
            }
            if(m.HeardFor>0 && (!m.HasObservation && m.HeardEnemy || m.ImpactUntil>g.Time)) {
                lead=m.Heard;
                if(Dist(a.X,a.Z,lead.X,lead.Z)>1.6f && ReachesInTime(g,a,lead,4))
                    Consider(g,m,ref best,Aim.Search,lead,56f+readiness+curiosity-TravelCost(g,a,lead)*.34f);
            }
            float trailScore;
            if(TryPlanTrail(g,a,m,out lead,out trailScore) && ReachesInTime(g,a,lead,5))
                Consider(g,m,ref best,Aim.Search,lead,trailScore+readiness+curiosity);
            Place smoke;
            if(NoticeSmoke(g,a,m,out smoke) && ReachesInTime(g,a,smoke,7))
                Consider(g,m,ref best,Aim.Search,smoke,51f+readiness+curiosity-TravelCost(g,a,smoke)*.20f);
        }

        static void OfferSupplies(Game g,Actor a,Mind m,ref Decision best) {
            Place here=new Place(a.X,a.Z),where;
            Prop water;
            float waterBy;
            if(TryPlanWater(g,a,m,out where,out water,out waterBy) && ReachesInTime(g,a,where,4f)) {
                float urgency=50f+(56f-a.Hydration)*.88f-TravelCost(g,a,where)*.13f;
                Consider(g,m,ref best,Aim.Water,where,urgency,water);
                if(best.Job==Aim.Water)m.CandidateWaterDeadline=waterBy;
            }

            Prop item=null;
            if(m.RecoverUntil>g.Time && a.Count("spear")==0)item=FindSpentSpear(g,a,m);
            if(item==null && m.Job==Aim.Loot && m.Item!=null && !m.Item.Removed &&
               Dist(a.X,a.Z,m.Item.X,m.Item.Z)<30f)item=m.Item;
            if(item==null)item=FindLoot(g,a,m,m.Expedition?15f:23f);
            if(item!=null) {
                Place pos=new Place(item.X,item.Z);
                if(ReachesInTime(g,a,pos,3f)) {
                    bool gear=RankWeapon(item.Item)>RankWeapon(a.Weapon);
                    float need=!CombatReady(a)?(gear||item.Kind=="pack"?22f:9f):gear?11f:0;
                    if(item.Item=="meal")need+=Math.Max(0,66f-a.Hunger)*.65f;
                    if(item.Item=="bandage" && a.Health<70)need+=(70f-a.Health)*.33f;
                    Consider(g,m,ref best,Aim.Loot,pos,51f+need-TravelCost(g,a,pos)*.45f,item);
                }
            }

            bool carryingMeat=a.Count("meat")>0;
            bool canCook=CanCookAt(g,a,m,m.Fire),salvage=CanRecoverCampMeat(g,a,m,m.Fire);
            if(carryingMeat || salvage || (canCook && m.Fire.HasMeat)) {
                Prop fire=null;
                if((canCook || salvage) && ReachesInTime(g,a,new Place(m.Fire.X,m.Fire.Z),16))fire=m.Fire;
                else if(carryingMeat)fire=FindFire(g,a,m);
                if(fire!=null || a.Count("firekit")>0 && g.Time>=m.NewFireAfter) {
                    Place site=fire==null?here:new Place(fire.X,fire.Z);
                    if(ReachesInTime(g,a,site,16f))
                        Consider(g,m,ref best,Aim.Camp,site,58f+(65f-a.Hunger)*.53f+(m.Job==Aim.Camp?7f:0)-
                            TravelCost(g,a,site)*.17f,fire);
                }
            }

            if(CombatReady(a) && a.Count("meat")<2 && a.Count("meal")<2 && a.Hunger<89f &&
               a.Stamina>=22f && a.Health>=28f && a.Hydration>=23f) {
                Animal prey=FindPrey(g,a);
                if(prey!=null) {
                    Place pos=new Place(prey.X,prey.Z);
                    if(ReachesInTime(g,a,pos,10f))
                        Consider(g,m,ref best,Aim.Stalk,pos,57f+(66f-a.Hunger)*.49f+
                            (m.HuntInterest-.5f)*9f+(prey.Alive?0:14f)-TravelCost(g,a,pos)*.35f,null,prey);
                }
                else if(m.Job==Aim.Stalk && m.Animal!=null && !m.Animal.Harvested &&
                        g.Time-m.PreySeenAt<3.4f && ReachesInTime(g,a,m.PreySeen,3))
                    Consider(g,m,ref best,Aim.Stalk,m.PreySeen,58f+(65f-a.Hunger)*.42f,null,m.Animal);
            }

            if(!m.HasObservation && m.HeardFor<=0 && a.Hurt<=.02f && ReachesInTime(g,a,here,7f) &&
               (a.Count("bandage")>0 && a.Health<72 || a.Stamina<(m.Job==Aim.Recover?48:24) && a.Hunger>22 && a.Hydration>25)) {
                Place cover=here;
                if(m.Job==Aim.Recover && ReachesInTime(g,a,m.Goal,7f))cover=m.Goal;
                else if(Arena.Cover(g,a.X,a.Z)<.38f && m.LostSight>0)cover=Covered(g,a,m,m.LastSeen,true);
                float benefit=(a.Count("bandage")>0?67f-a.Health:0)*.54f+Math.Max(0,30f-a.Stamina)*.6f;
                Consider(g,m,ref best,Aim.Recover,cover,59f+benefit);
            }
        }

        static void ApplyDecision(Game g,Actor a,Mind m,Decision choice) {
            if(choice.Job==Aim.Search && m.Job==Aim.Search && m.LostSight>0 &&
               Dist(a.X,a.Z,m.Goal.X,m.Goal.Z)<1.8f && Dist(m.Goal.X,m.Goal.Z,choice.Goal.X,choice.Goal.Z)>1.8f)
                m.SearchLeg++;
            bool changed=m.Job!=choice.Job || Dist(m.Goal.X,m.Goal.Z,choice.Goal.X,choice.Goal.Z)>5f;
            if(changed)m.CommitUntil=g.Time+m.Between(3.5f,6.5f);
            m.Job=choice.Job;m.Goal=choice.Goal;
            if(m.Job==Aim.Combat) {
                m.Pause=0;
            } else if(m.Job==Aim.Evade) {
                if(changed || m.Danger<=0)m.Danger=m.Between(2.0f,3.1f);
                if(changed)m.WithdrawUntil=g.Time+m.Between(2.7f,4.1f);
                m.Pause=0;m.RunFor=1.65f;
            } else if(m.Job==Aim.Wait) {
                if(g.Time>=m.ReconsiderAt) {
                    m.HoldBackUntil=g.Time+m.Between(1.5f,2.7f);
                    m.ReconsiderAt=m.HoldBackUntil+m.Between(6f,9f);
                }
                m.Pause=.65f;m.NextScanPose=1.25f;m.Replan=.40f;
                m.Steering=Heading(m.LastSeen.X-a.X,m.LastSeen.Z-a.Z);
            } else if(m.Job==Aim.Loot) {
                m.Item=choice.Prop;m.Pause=0;
            } else if(m.Job==Aim.Stalk) {
                if(m.Animal!=choice.Animal){m.PreySeenAt=g.Time;m.PreySeen=choice.Goal;}
                m.Animal=choice.Animal;m.Pause=0;
            } else if(m.Job==Aim.Camp) {
                if(changed)m.CampProgressFire=null;
                m.Fire=choice.Prop;m.Pause=0;
            } else if(m.Job==Aim.Water) {
                m.WaterSource=choice.Prop;m.WaterDeadline=m.CandidateWaterDeadline;m.Pause=0;
            } else if(m.Job==Aim.Search) {
                if(changed)m.Pause=0;
            } else {
                m.Pause=0;
            }
        }

        static void Plan(Game g,Actor a,Mind m) {
            m.Replan=m.Between(.82f,1.37f);
            Place here=new Place(a.X,a.Z);
            if(NeedsRotation(g,a)) {
                m.Job=Aim.Travel;m.Goal=RotationGoal(g,a,m);m.RunFor=1.7f;
                return;
            }
            if(m.Enemy!=null && (!m.Enemy.Alive || Allied(g,a,m.Enemy))) {
                m.Enemy=null;m.HasObservation=false;m.LostSight=0;
            }
            if(m.Opening && m.RushArmed && Inside(a.X,a.Z,28f) && m.ExtraThreatUntil>g.Time &&
               a.Health<55f+16f*m.Caution) {
                m.Opening=false;
                m.OpeningExitUntil=g.Time+m.Between(4.8f,7.2f);
            }
            if(g.Time<m.OpeningExitUntil && Inside(a.X,a.Z,43f)) {
                m.Job=Aim.Evade;m.Goal=m.Home;m.RunFor=1.7f;
                return;
            }
            if(a.Health<34f || a.Hydration<18f || a.Hunger<14f ||
               m.Opening && a.Health<58f && m.ExtraThreatUntil>g.Time)m.Opening=false;
            if(m.ImpactUntil<=g.Time && !(m.RushArmed && m.ExtraThreatUntil>g.Time) && OpeningPlan(g,a,m))return;

            var best=new Decision{Score=-1000f};
            if(m.HasObservation && m.Enemy!=null) {
                if(!CombatReady(a) && a.Windup<=0)Arm(a);
                OfferEncounter(g,a,m,ref best);
                if(Dist(a.X,a.Z,m.LastSeen.X,m.LastSeen.Z)<(m.SeenRanged?18f:6f) && best.Score>-1000f) {
                    ApplyDecision(g,a,m,best);return;
                }
            }
            if(!m.HasObservation && m.CoverUntil>g.Time && ReachesInTime(g,a,m.TacticalCover,2f))
                Consider(g,m,ref best,Aim.Evade,m.TacticalCover,81f);
            if(!m.HasObservation && m.Job==Aim.Evade && m.WithdrawUntil>g.Time &&
               Dist(a.X,a.Z,m.Goal.X,m.Goal.Z)>1.3f && ReachesInTime(g,a,m.Goal,2f))
                Consider(g,m,ref best,Aim.Evade,m.Goal,72f);

            Animal predator;
            if(Wildlife.ThreatTo(g,a,out predator)) {
                Place danger=new Place(predator.X,predator.Z);
                if(PursuitReady(a) && a.Health+12f*m.Boldness>57f && !m.HasObservation)
                    Consider(g,m,ref best,Aim.Stalk,danger,75f,null,predator);
                else
                    Consider(g,m,ref best,Aim.Evade,Covered(g,a,m,danger,true),84f);
            }

            OfferSupplies(g,a,m,ref best);
            OfferClues(g,a,m,ref best);
            if(!m.HasObservation && m.HeardFor<=0 && m.WithdrawUntil<=g.Time) {
                Place fort;
                float construction;
                if(TryPlanFort(g,a,m,out fort,out construction) && ReachesInTime(g,a,fort,12f))
                    Consider(g,m,ref best,Aim.Build,fort,construction);
            }
            OfferPatrol(g,a,m,ref best);

            if(best.Score<56f && !m.HasObservation && m.WithdrawUntil<=g.Time &&
               (FollowReport(g,a,m) || Regroup(g,a,m)))return;
            ApplyDecision(g,a,m,best);
        }

        static void Recover(Game g,Actor a,Mind m,float dt) {
            if(Dist(a.X,a.Z,m.Goal.X,m.Goal.Z)>1.5f) {
                Go(g,a,m,m.Goal.X-a.X,m.Goal.Z-a.Z,2.7f,dt,true);
                return;
            }
            a.Speed=0;a.Crouch=true;
            if(m.Action>0)return;
            if(a.Count("bandage")>0 && a.Health<72f) {
                a.Add("bandage",-1);a.Health=Math.Min(100,a.Health+28);
                m.Action=1.3f;m.Replan=0;
            } else if(a.Stamina>48f) {
                m.Replan=0;m.Job=Aim.Forage;
            }
        }
    }
}
