using System;
using System.Collections.Generic;

namespace LastSignal {
    public partial class Game {
        public const float ShieldRight = -.24f, ShieldForward = .56f;
        public const float ShieldStandingHeight = 1.19f, ShieldCrouchedHeight = .80f;
        public const float ShieldHalfWidth = .41f, ShieldHalfHeight = .49f;
        public const float ShieldMaxDurability=100f;
        const float ShieldTraceMargin = .87f;

        public static float ShieldDurability(Actor actor) {
            return actor==null || actor.Count("shield")==0 ? 0f :
                Math.Max(0f,Math.Min(ShieldMaxDurability,ShieldMaxDurability-actor.ShieldWear));
        }

        public static bool CarriesShield(Actor actor) {
            return actor!=null && (actor.Weapon=="spear" || actor.Weapon=="sword") && ShieldDurability(actor)>0;
        }

        public static bool ShieldRaised(Actor actor) {
            return actor!=null && actor.Alive && actor.Guard && CarriesShield(actor);
        }

        static bool GuardPoseActive(Actor actor) {
            return actor.Guard && (CarriesShield(actor) || !actor.GuardSpent && actor.GuardTime <= BlockEnd);
        }

        static void AddShield(Actor actor,float wear) {
            int count=actor.Count("shield");
            if(count==0)actor.ShieldWear=wear;
            else {
                if(actor.SpareShieldWear==null)actor.SpareShieldWear=new List<float>();
                actor.SpareShieldWear.Add(wear);
            }
            actor.Bag["shield"]=count+1;
        }

        static float RemoveShield(Actor actor) {
            int count=actor.Count("shield");
            if(count==0)return 0;
            float wear=actor.ShieldWear;
            actor.ShieldWear=0;
            if(count==1) {
                if(actor.Weapon=="sword" || actor.Weapon=="spear")actor.Guard=false;
                actor.Bag.Remove("shield");
            } else {
                actor.Bag["shield"]=count-1;
                if(actor.SpareShieldWear!=null && actor.SpareShieldWear.Count>0) {
                    actor.ShieldWear=actor.SpareShieldWear[0];
                    actor.SpareShieldWear.RemoveAt(0);
                }
            }
            return wear;
        }

        internal static void AdjustShields(Actor actor,int amount) {
            for(int i=0;i<amount;i++)AddShield(actor,0);
            for(int i=0;i>amount && actor.Count("shield")>0;i--)RemoveShield(actor);
        }

        internal static void PackShields(Actor actor,Prop pack,int count) {
            if(count<=0 || actor.Count("shield")==0)return;
            pack.PackedShieldWear=new List<float>();
            for(int i=0;i<count && actor.Count("shield")>0;i++)pack.PackedShieldWear.Add(RemoveShield(actor));
        }

        internal static void CollectShields(Actor actor,Prop pack,int count) {
            int preserved=pack.PackedShieldWear==null?0:Math.Min(count,pack.PackedShieldWear.Count);
            for(int i=0;i<preserved;i++)AddShield(actor,pack.PackedShieldWear[i]);
            for(int i=preserved;i<count;i++)AddShield(actor,0);
            pack.PackedShieldWear=null;
        }

        // A ray must enter the face of the raised shield and cross its visible
        // outline. The front surface never intercepts a strike from behind.
        static float ShieldContact(Actor actor, float x, float y, float z, float dx, float dy, float dz) {
            float sin = (float)Math.Sin(actor.Yaw), cos = (float)Math.Cos(actor.Yaw);
            float forward = sin * dx + cos * dz;
            if (forward >= -.0001f) return float.MaxValue;
            float fromActorX = x - actor.X, fromActorZ = z - actor.Z;
            float travel = (ShieldForward - (sin * fromActorX + cos * fromActorZ)) / forward;
            if (travel < 0) return float.MaxValue;
            float right = (cos * (fromActorX + dx * travel) - sin * (fromActorZ + dz * travel) - ShieldRight) / ShieldHalfWidth;
            float height = actor.Crouch ? ShieldCrouchedHeight : ShieldStandingHeight;
            float up = (y - actor.Y + dy * travel - height) / ShieldHalfHeight;
            return right * right + up * up <= 1 ? travel : float.MaxValue;
        }

        GuardOutcome BlockShield(Actor defender, ImpactSite hit, bool ranged, ref float damage) {
            bool timed = !ranged && !defender.GuardSpent && defender.GuardTime <= ParryEnd;
            float stamina=4f+damage*(timed?.12f:.19f);
            bool exhausted=defender.Stamina<=stamina;
            defender.Stamina = Math.Max(0, defender.Stamina - stamina);
            defender.ShieldWear+=Math.Max(5f,damage*(timed?.51f:.69f));
            bool broken=defender.ShieldWear>=ShieldMaxDurability;
            if(broken)RemoveShield(defender);
            if (broken || exhausted) {
                defender.Guard = false;
                defender.GuardRecovery = Math.Max(broken?.55f:.38f, defender.GuardRecovery);
            }
            if (timed) defender.GuardSpent = true;
            damage = 0;
            EmitImpact(hit, 0, false, true, timed, false);
            if(broken)HitEffect("wood",hit.X,hit.Y,hit.Z,9);
            if (defender == Player) ShieldNotice(broken, exhausted, timed);
            else if (HostingOnlineRound && IsOnlineHuman(defender))
                WithOnlineSeat(defender.Id, g => g.ShieldNotice(broken, exhausted, timed));
            return timed ? GuardOutcome.Parry : GuardOutcome.Deflect;
        }

        void ShieldNotice(bool broken,bool exhausted,bool timed) {
            if(broken&&Player.Count("shield")==0)guardHeld=false;
            Say(broken?"Shield broke":exhausted?"Shield knocked down":timed?"Shield parry":"Shield blocked");
        }

        GuardOutcome GuardWildStrike(Actor defender, Animal attacker, ImpactSite hit, float yaw, float pitch, ref float damage) {
            if (!CarriesShield(defender)) return Defend(defender, hit, yaw, pitch, false, ref damage);
            if (!ShieldRaised(defender)) return GuardOutcome.Miss;
            float y = attacker.Y + Wildlife.Height(attacker);
            float dx = hit.X - attacker.X, dy = hit.Y - y, dz = hit.Z - attacker.Z;
            float travel = ShieldContact(defender, attacker.X, y, attacker.Z, dx, dy, dz);
            if (travel > 1) return GuardOutcome.Miss;
            ImpactSite contact = new ImpactSite(attacker.X + dx * travel, y + dy * travel, attacker.Z + dz * travel,
                hit.DX, hit.DY, hit.DZ, hit.Implement);
            return BlockShield(defender, contact, false, ref damage);
        }
    }
}
