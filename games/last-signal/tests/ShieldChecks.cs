using System;
using System.Reflection;
using LastSignal;

public static class ShieldChecks {
    static readonly BindingFlags PrivateMethods = BindingFlags.Instance | BindingFlags.NonPublic;
    static readonly MethodInfo Strike = typeof(Game).GetMethod("Strike", PrivateMethods);
    static readonly MethodInfo AdvanceShot = typeof(Game).GetMethod("AdvanceShot", PrivateMethods);
    static readonly MethodInfo FollowThrough = typeof(Game).GetMethod("PlayerFollowThrough", PrivateMethods);
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
        Check(Game.ShieldRaised(defender), "Holding guard did not immediately raise the shield.");
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

    static bool Shoot(Game g, Actor enemy, string model, float x, float y, float z, float dx, float dz, bool deflected = false) {
        var shot = new Shot { Owner = enemy, Model = model, X = x, Y = Floor + y, Z = z,
            DX = dx * 75, DZ = dz * 75, Life = 2, Damage = 45 };
        bool stopped = (bool)AdvanceShot.Invoke(g, new object[] { shot, .035f });
        if(!deflected)return stopped;
        return !stopped && shot.Damage==0 && shot.DX*dx+shot.DZ*dz<0;
    }

    public static void Run() {
        Actor enemy;
        var front = Duel("spear", out enemy);
        float stamina = front.Player.Stamina;
        Melee(front, enemy, Game.ShieldRight, 1.75f, (float)Math.PI);
        Check(front.Player.Health == 100 && front.Player.Stamina < stamina &&
            Game.ShieldDurability(front.Player) < Game.ShieldMaxDurability, "A shield contact did not apply wear and spare the body.");

        var cut = Duel("spear", out enemy);
        enemy.Weapon = "sword";
        stamina = cut.Player.Stamina;
        Melee(cut, enemy, 0, 1.75f, (float)Math.PI, -.483f);
        Check(cut.Player.Health == 100 && cut.Player.Stamina < stamina, "Melee aim assist bypassed a raised shield in front of the covered body.");

        var exposed = Duel("sword", out enemy);
        stamina = exposed.Player.Stamina;
        Melee(exposed, enemy, .32f, 1.75f, (float)Math.PI);
        Check(exposed.Player.Health < 100 && exposed.Player.Stamina == stamina &&
            Game.ShieldDurability(exposed.Player)==Game.ShieldMaxDurability, "An exposed body strike was intercepted or wore the shield.");

        var rear = Duel("spear", out enemy);
        Melee(rear, enemy, Game.ShieldRight, -1.75f, 0);
        Check(rear.Player.Health < 100, "A thrust from behind ignored the exposed body.");

        var bolts = Duel("sword", out enemy);
        stamina = bolts.Player.Stamina;
        Check(Shoot(bolts, enemy, "arrow", -.52f, Game.ShieldStandingHeight, 2, 0, -1, true), "An arrow that hit the shield outside the body passed through.");
        Check(Shoot(bolts, enemy, "bolt", Game.ShieldRight, Game.ShieldStandingHeight, 2, 0, -1, true), "A crossbow bolt did not deflect.");
        Check(bolts.Player.Health == 100 && bolts.Player.Stamina < stamina, "Projectile contacts should cost stamina without damaging health.");
        Check(Shoot(bolts, enemy, "arrow", 0, 1.73f, 2, 0, -1) && bolts.Player.Health < 100, "A head shot above the shield was incorrectly blocked.");

        var turned = Duel("spear", out enemy);
        turned.Player.Yaw = (float)(Math.PI * .5);
        turned.Player.Crouch = true;
        Check(Shoot(turned, enemy, "bolt", 2, Game.ShieldCrouchedHeight, -Game.ShieldRight, -1, 0, true) &&
            turned.Player.Health == 100, "The shield did not rotate and crouch with its wielder.");
        turned.Release("Guard");
        Check(!Game.ShieldRaised(turned.Player) && Shoot(turned, enemy, "bolt", 2, Game.ShieldCrouchedHeight, 0, -1, 0) &&
            turned.Player.Health < 100, "Releasing guard left the shield active.");

        var tired = Duel("sword", out enemy);
        tired.Player.Stamina = 1;
        Check(Shoot(tired, enemy, "bolt", Game.ShieldRight, Game.ShieldStandingHeight, 2, 0, -1, true) &&
            !Game.ShieldRaised(tired.Player) && tired.Player.Health == 100, "A stamina break did not lower the shield after stopping the impact.");
        tired.Player.Stamina=40;
        tired.Player.GuardRecovery=0;
        FollowThrough.Invoke(tired,null);
        Check(Game.ShieldRaised(tired.Player),"Recovering stamina did not restore held guard.");

        var breaking = Duel("sword", out enemy);
        for(int i=0;i<4;i++)
            Check(Shoot(breaking,enemy,"bolt",Game.ShieldRight,Game.ShieldStandingHeight,2,0,-1,true),
                "The shield did not protect the body on impact "+(i+1));
        Check(breaking.Player.Count("shield")==0 && Game.ShieldDurability(breaking.Player)==0 &&
            !Game.ShieldRaised(breaking.Player) && breaking.Player.Health==100,
            "A worn shield survived or the strike that broke it reached the wearer.");
        Check(Shoot(breaking,enemy,"bolt",0,Game.ShieldStandingHeight,2,0,-1) && breaking.Player.Health<100,
            "A broken shield kept intercepting attacks.");

        var hold = Duel("spear",out enemy);
        hold.Press("Attack");
        Check(hold.Charging && !Game.ShieldRaised(hold.Player),"A held shield prevented a permitted attack.");
        hold.Release("Attack");
        Check(hold.Player.Windup>0 && !Game.ShieldRaised(hold.Player),"The shield was active during an attack windup.");
        hold.Player.Windup=hold.Player.Swing=0;
        FollowThrough.Invoke(hold,null);
        Check(Game.ShieldRaised(hold.Player),"The held shield did not raise after attacking.");
        hold.Dodge(hold.Player,1,0);
        Check(!Game.ShieldRaised(hold.Player),"A shield stayed raised during a dodge.");
        hold.Player.DodgeTime=0;
        FollowThrough.Invoke(hold,null);
        Check(Game.ShieldRaised(hold.Player),"The held shield did not raise after a dodge.");

        var gear = Duel("spear",out enemy);
        Check(Shoot(gear,enemy,"bolt",Game.ShieldRight,Game.ShieldStandingHeight,2,0,-1,true),"Transfer fixture could not wear its shield.");
        float condition=Game.ShieldDurability(gear.Player);
        gear.Player.Add("shield",1);
        Check(Game.ShieldDurability(gear.Player)==condition,"Crafting a spare repaired the equipped shield.");
        Check(Survival.Drop(gear,"shield") && Game.ShieldDurability(gear.Player)==Game.ShieldMaxDurability,
            "Dropping the worn shield did not equip the spare.");
        Prop pack=gear.Props[gear.Props.Count-1];
        enemy.X=pack.X;enemy.Y=pack.Y;enemy.Z=pack.Z;
        Check(Survival.Take(gear,enemy,pack) && Math.Abs(Game.ShieldDurability(enemy)-condition)<.01f,
            "Dropping and picking up an existing shield lost its condition.");

        Recipe recipe=Survival.Find(Survival.Crafts,"shield");
        Check(recipe!=null && recipe.Needs.Count==2 && recipe.Needs["branch"]==3 && recipe.Needs["scrap"]==1,
            "The round shield no longer crafts from only three wood and one scrap.");

        var host=new Game();
        var replica=new Game();
        host.StartOnlineRound(new[]{"Host","Guest"},73119,0,1,1,true);
        Actor onlineDefender=host.Actors[1],attacker=host.Actors[0];
        onlineDefender.Weapon="sword";onlineDefender.Add("sword",1);onlineDefender.Add("shield",1);
        onlineDefender.Y=attacker.Y=Floor;onlineDefender.Yaw=0;onlineDefender.X=onlineDefender.Z=0;
        onlineDefender.Guard=true;onlineDefender.GuardTime=1;
        Check(Shoot(host,attacker,"bolt",Game.ShieldRight,Game.ShieldStandingHeight,2,0,-1,true),"The host did not simulate shield wear.");
        Check(OnlineSnapshot.Apply(replica,OnlineSnapshot.Capture(host),1) &&
            Game.ShieldDurability(replica.Player)==Game.ShieldDurability(onlineDefender) &&
            Game.ShieldRaised(replica.Player),"The online guest lost authoritative durability or shield stance.");

        Console.WriteLine("Shield checks passed for physical coverage, ricochets, breakage, held guard, crafting, transfers and an online snapshot.");
    }
}
