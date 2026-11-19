using System;

namespace LastSignal {
    public partial class Game {
        public const float ShieldRight = -.24f, ShieldForward = .56f;
        public const float ShieldStandingHeight = 1.19f, ShieldCrouchedHeight = .80f;
        public const float ShieldHalfWidth = .41f, ShieldHalfHeight = .49f;
        const float ShieldTraceMargin = .87f;

        public static bool CarriesShield(Actor actor) {
            return actor != null && (actor.Weapon == "spear" || actor.Weapon == "sword") && actor.Count("shield") > 0;
        }

        public static bool ShieldRaised(Actor actor) {
            return actor != null && actor.Alive && actor.Guard && actor.GuardTime >= GuardStart && CarriesShield(actor);
        }

        static bool GuardPoseActive(Actor actor) {
            return actor.Guard && (CarriesShield(actor) || !actor.GuardSpent && actor.GuardTime <= BlockEnd);
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
            float stamina = timed ? 5 : 4 + damage * .26f;
            bool broken = defender.Stamina <= stamina;
            defender.Stamina = Math.Max(0, defender.Stamina - stamina);
            if (broken) {
                defender.Guard = false;
                defender.GuardRecovery = Math.Max(.65f, defender.GuardRecovery);
            }
            if (timed) defender.GuardSpent = true;
            damage = 0;
            EmitImpact(hit, 0, false, true, timed, false);
            if (defender == Player) ShieldNotice(broken, timed);
            else if (HostingOnlineRound && IsOnlineHuman(defender))
                WithOnlineSeat(defender.Id, g => g.ShieldNotice(broken, timed));
            return timed ? GuardOutcome.Parry : GuardOutcome.Deflect;
        }

        void ShieldNotice(bool broken, bool timed) {
            if (broken) guardHeld = false;
            Say(broken ? "Shield knocked down" : timed ? "Shield parry" : "Shield blocked");
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
