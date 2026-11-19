using System;
using System.Reflection;
using LastSignal;

public static class ShieldChecks {
    static readonly BindingFlags PrivateMethods = BindingFlags.Instance | BindingFlags.NonPublic;
    static readonly MethodInfo Strike = typeof(Game).GetMethod("Strike", PrivateMethods);
    static readonly MethodInfo AdvanceShot = typeof(Game).GetMethod("AdvanceShot", PrivateMethods);
    const float Floor = 8;

    static void Check(bool state, string message) {
        if (!state) throw new InvalidOperationException(message);
    }

    static Game Duel(string weapon, out Actor enemy) {
        var defender = new Actor { Id = 0, Y = Floor, Weapon = weapon };
        defender.Add("shield", 1);
        enemy = new Actor { Id = 1, Y = Floor, Weapon = "spear", Z = 1.75f, Yaw = (float)Math.PI };
        var g = new Game { Mode = "match", Player = defender, CameraTarget = defender, AliveCount = 2 };
        g.Actors.Add(defender);
        g.Actors.Add(enemy);
        g.Press("Guard");
        Check(defender.Guard && !Game.ShieldRaised(defender), "Guard must raise the off-hand shield before contact.");
        defender.GuardTime = 1.4f;
        Check(Game.ShieldRaised(defender), "A held shield must remain active beyond the weapon parry window.");
        return g;
    }

    static void Melee(Game g, Actor enemy, float x, float z, float yaw, float pitch = -.17f) {
        enemy.X = x;
        enemy.Z = z;
        enemy.Yaw = yaw;
        g.Attack(enemy, false, pitch);
        Strike.Invoke(g, new object[] { enemy, pitch });
    }

    static bool Shoot(Game g, Actor enemy, string model, float x, float y, float z, float dx, float dz) {
        var shot = new Shot { Owner = enemy, Model = model, X = x, Y = Floor + y, Z = z,
            DX = dx * 75, DZ = dz * 75, Life = 2, Damage = 45 };
        return (bool)AdvanceShot.Invoke(g, new object[] { shot, .035f });
    }

    public static void Run() {
        Actor enemy;
        var front = Duel("spear", out enemy);
        float stamina = front.Player.Stamina;
        Melee(front, enemy, Game.ShieldRight, 1.75f, (float)Math.PI);
        Check(front.Player.Health == 100 && front.Player.Stamina < stamina, "The raised shield did not stop a spear on contact.");

        var cut = Duel("spear", out enemy);
        enemy.Weapon = "sword";
        stamina = cut.Player.Stamina;
        Melee(cut, enemy, 0, 1.75f, (float)Math.PI, -.483f);
        Check(cut.Player.Health == 100 && cut.Player.Stamina < stamina, "Melee aim assist bypassed a raised shield in front of the covered body.");

        var exposed = Duel("sword", out enemy);
        stamina = exposed.Player.Stamina;
        Melee(exposed, enemy, .32f, 1.75f, (float)Math.PI);
        Check(exposed.Player.Health < 100 && exposed.Player.Stamina == stamina, "The shield granted protection beyond the edge of the painted face.");

        var rear = Duel("spear", out enemy);
        Melee(rear, enemy, Game.ShieldRight, -1.75f, 0);
        Check(rear.Player.Health < 100, "A thrust from behind ignored the exposed body.");

        var bolts = Duel("sword", out enemy);
        stamina = bolts.Player.Stamina;
        Check(Shoot(bolts, enemy, "arrow", -.52f, Game.ShieldStandingHeight, 2, 0, -1), "An arrow that hit the shield outside the body passed through.");
        Check(Shoot(bolts, enemy, "bolt", Game.ShieldRight, Game.ShieldStandingHeight, 2, 0, -1), "A crossbow bolt passed through the shield.");
        Check(bolts.Player.Health == 100 && bolts.Player.Stamina < stamina, "Projectile contacts should cost stamina without damaging health.");
        Check(Shoot(bolts, enemy, "arrow", 0, 1.73f, 2, 0, -1) && bolts.Player.Health < 100, "A head shot above the shield was incorrectly blocked.");

        var turned = Duel("spear", out enemy);
        turned.Player.Yaw = (float)(Math.PI * .5);
        turned.Player.Crouch = true;
        Check(Shoot(turned, enemy, "bolt", 2, Game.ShieldCrouchedHeight, -Game.ShieldRight, -1, 0) &&
            turned.Player.Health == 100, "The shield did not rotate and crouch with its wielder.");
        turned.Release("Guard");
        Check(!Game.ShieldRaised(turned.Player) && Shoot(turned, enemy, "bolt", 2, Game.ShieldCrouchedHeight, 0, -1, 0) &&
            turned.Player.Health < 100, "Releasing guard left the shield active.");

        var tired = Duel("sword", out enemy);
        tired.Player.Stamina = 1;
        Check(Shoot(tired, enemy, "bolt", Game.ShieldRight, Game.ShieldStandingHeight, 2, 0, -1) &&
            !Game.ShieldRaised(tired.Player) && tired.Player.Health == 100, "A stamina break did not lower the shield after stopping the impact.");

        Console.WriteLine("Shield checks passed for sustained spear/sword guard, melee and projectile contacts, exposed body, rotation, crouch, release and stamina break.");
    }
}
