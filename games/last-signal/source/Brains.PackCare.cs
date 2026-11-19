using System;

namespace LastSignal
{
    public static partial class Brains
    {
        // Partners ask for simple supplies when they can meet. The giver keeps
        // their held weapon, their last necessary meal, and a reserve of water.
        static string PackNeed(Actor donor,Actor partner)
        {
            if(partner.Health<=68 && donor.Count("bandage")>0 && donor.Health>54)return "bandage";
            if(partner.Hunger<62 && donor.Count("meal")>(donor.Hunger<58?1:0))return "meal";
            if(partner.Hydration<57 && donor.WaterCarried>15 && donor.Hydration>58)return "water";
            if(partner.Weapon=="fists" && donor.Weapon!="fists")
            {
                foreach(string weapon in loanWeapons)
                    if(donor.Count(weapon)>(donor.Weapon==weapon?1:0))return weapon;
            }
            if(partner.Count("bow")>0 && partner.Count("arrows")<2 && donor.Count("arrows")>=4)return "arrows";
            if(String.IsNullOrEmpty(partner.WornArmor))
            {
                foreach(string armor in loanArmor)
                    if(donor.Count(armor)>(donor.WornArmor==armor?1:0))return armor;
            }
            return "";
        }
        static readonly string[] loanWeapons={"spear","hatchet","knife"};
        static readonly string[] loanArmor={"scrap_cuirass","woven_vest"};
        static void EndCare(Game g,Mind m,float recovery)
        {
            m.CarePartner=null;m.CareReady=m.CareUntil=0;m.CareAfter=g.Time+recovery;m.Replan=0;
        }
        static void HandOver(Game g,Actor a,Actor b,string item)
        {
            if(item=="water")a.WaterCarried-=g.Sip(b,Math.Min(20,a.WaterCarried-8));
            else if(item=="bandage"){a.Add(item,-1);b.Health=Math.Min(100,b.Health+28);}
            else if(item=="woven_vest"||item=="scrap_cuirass")Armor.Give(a,b,item);
            else
            {
                int amount=item=="arrows"?Math.Min(4,a.Count(item)-2):1;
                a.Add(item,-amount);b.Add(item,amount);
                if(item=="meal")Survival.Eat(g,b);
                else if(b.NextAttack<=0 && b.Swing<=0 && b.Windup<=0)Arm(b);
            }
            LocalFeed(g,a,b,item=="bandage"?a.Name+" bandaged "+b.Name:
                a.Name+" shared "+Survival.Label(item).ToLowerInvariant()+" with "+b.Name);
        }
        static bool BusyHelping(Game g,Actor a,Mind m)
        {
            return !a.Alive||m.HasObservation||a.Hurt>0||a.Windup>0||a.Swing>0||m.ImpactUntil>g.Time||
                a.Hunger<20||a.Hydration<20||g.StormMargin(a.X,a.Z)<2;
        }
        static bool TickPackCare(Game g,Actor a,Mind m,float dt)
        {
            if(m.Alliance==null||!m.Alliance.Active)return false;
            if(BusyHelping(g,a,m))
            {
                if(m.CarePartner!=null)EndCare(g,m,3);
                return false;
            }
            if(m.CarePartner==null)
            {
                // Wait for the member who signalled instead of walking away mid handoff.
                foreach(Actor b in m.Alliance.Members)
                {
                    Mind mb=minds[b];
                    if(mb.CarePartner!=a||!b.Alive||mb.CareUntil<=g.Time||BusyHelping(g,b,mb))continue;
                    if(!Perception.SeeActor(g,a,b) && (Dist(a.X,a.Z,b.X,b.Z)>6f ||
                       !Arena.Clear(g,a.X,Eye(a),a.Z,b.X,Eye(b),b.Z)))continue;
                    a.Yaw=ApproachAngle(a.Yaw,Heading(b.X-a.X,b.Z-a.Z),dt*4);
                    a.Speed=0;a.Sprint=a.Aiming=false;Guard(a,false);a.State="waiting for supplies";return true;
                }
                if(m.CareAfter>g.Time)return false;
                m.CareAfter=g.Time+.45f;
                Actor best=null;float nearest=8.5f;
                foreach(Actor b in m.Alliance.Members)
                {
                    if(b==a||BusyHelping(g,b,minds[b])||minds[b].CarePartner!=null)continue;
                    float d=Dist(a.X,a.Z,b.X,b.Z);
                    if(d>=nearest||PackNeed(a,b)==""||!Perception.SeeActor(g,a,b))continue;
                    nearest=d;best=b;
                }
                if(best==null)
                {
                    PackCampWatch(g,a,m);
                    return false;
                }
                m.CarePartner=best;m.CareUntil=g.Time+6;
            }
            Actor partner=m.CarePartner;
            string item=PackNeed(a,partner);
            if(g.Time>=m.CareUntil||BusyHelping(g,partner,minds[partner])||item==""||
               !Allied(g,a,partner)||!Perception.SeeActor(g,a,partner))
            {EndCare(g,m,3);return false;}
            a.Crouch=a.Sprint=a.Aiming=false;Guard(a,false);a.State="offering supplies";
            float dx=partner.X-a.X,dz=partner.Z-a.Z;
            if(Dist(0,0,dx,dz)>1.9f){m.CareReady=0;Go(g,a,m,dx,dz,2.6f,dt,true);return true;}
            a.Speed=0;a.Yaw=ApproachAngle(a.Yaw,Heading(dx,dz),dt*4);
            m.CareReady+=dt;
            if(m.CareReady>=.62f)
            {
                HandOver(g,a,partner,item);EndCare(g,m,10);
            }
            return true;
        }
        static void PackCampWatch(Game g,Actor a,Mind m)
        {
            if(m.NextWatch>g.Time || !CombatReady(a) || m.Opening || m.Job==Aim.Camp || m.Job==Aim.Water ||
               m.Enemy!=null && m.LostSight>0 || a.Hunger<49 || a.Hydration<51 || a.Count("meat")>0)return;
            foreach(Actor ally in m.Alliance.Members)
            {
                if(ally==a || !ally.Alive)continue;
                Mind other=minds[ally];
                if(other.Job!=Aim.Camp&&other.Job!=Aim.Water)continue;
                float dx=a.X-ally.X,dz=a.Z-ally.Z,d=Dist(0,0,dx,dz);
                if(d>13f||!Perception.SeeActor(g,a,ally))continue;
                m.Job=Aim.Wait;m.Goal=new Place(a.X,a.Z);m.Pause=4.2f;
                m.Steering=d>.7f?Heading(dx,dz):a.Yaw;
                m.NextScanPose=2.1f;m.LookoutUntil=g.Time+m.Pause;m.NextWatch=g.Time+15f;
                m.Replan=.55f;
                return;
            }
        }
    }
}
