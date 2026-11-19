using System;
using System.Linq;
using LastSignal;

public static class CrossbowChecks {
    static void Check(bool ok,string message) {
        if(!ok)throw new Exception(message);
    }
    static void Step(Game game,float seconds) {
        while(seconds>.0001f) {
            float step=Math.Min(.025f,seconds);
            game.Tick(step);
            seconds-=step;
        }
    }
    public static void Run() {
        var game=new Game {ForcedSeed=11421};
        game.Settings.Bots=1;
        game.Start(true);
        game.Countdown=0;
        Actor player=game.Player;
        player.X=20;player.Z=-65;player.Y=Arena.Height(player.X,player.Z);
        player.Add("crossbow",1);
        player.Add("sword",1);
        player.Add("bolts",2);

        game.Press("Weapon 7");
        Check(player.Weapon=="crossbow"&&!player.CrossbowLoaded,"A fresh crossbow must start unloaded.");
        Step(game,1.25f);
        Check(!player.CrossbowLoaded&&player.CrossbowReload>1.2f,"First equip did not start a timed reload.");
        game.Press("Weapon 6");
        Step(game,.25f);
        Check(player.Weapon=="sword"&&player.CrossbowReload==0,"Stowing a partly loaded crossbow did not cancel reload.");

        game.Press("Weapon 7");
        game.Press("Attack");
        Step(game,Actor.CrossbowReloadTime-.15f);
        Check(!player.CrossbowLoaded&&player.Count("bolts")==2&&game.Shots.Count==0,"Reload completed early or spent a bolt.");
        Step(game,.3f);
        Check(player.CrossbowLoaded&&player.Count("bolts")==2&&game.Shots.Count==0,"Reload must not queue a shot from an early attack.");

        game.Press("Weapon 6");
        Step(game,.25f);
        game.Press("Weapon 7");
        Step(game,.25f);
        Check(player.CrossbowLoaded,"Swapping a fully loaded crossbow lost its chambered bolt.");

        player.X=20;player.Z=-65;player.Y=47;player.Yaw=(float)Math.PI/2;
        float startX=player.X,startZ=player.Z;
        game.Press("Attack");
        Step(game,.12f);
        Shot bolt=game.Shots.Single(s=>s.Owner==player&&s.Model=="bolt");
        Check(!player.CrossbowLoaded&&player.Count("bolts")==1&&player.CrossbowReload>0,"A fired bolt did not consume exactly one round and restart reload.");
        Step(game,.65f);
        Check(Game.Distance(startX,startZ,bolt.X,bolt.Z)>47,"Crossbow bolt did not reach long range.");
        Step(game,2.7f);
        Prop spent=game.Props.Single(p=>p.Item=="bolts"&&p.Model=="bolt"&&p.Owner==player.Id);
        player.X=spent.X;player.Z=spent.Z;player.Y=spent.Y;player.Vertical=0;
        Check(Survival.Take(game,player,spent)&&player.Count("bolts")==2,"A landed bolt was not recoverable.");

        Step(game,1f);
        Check(player.CrossbowLoaded,"The next bolt did not finish loading.");
        player.Add("bolts",-2);
        Check(!player.CrossbowLoaded&&player.CrossbowReload==0,"Removing the last bolt left a free shot.");
        player.Add("bolts",1);
        Step(game,1f);
        player.Add("crossbow",-1);
        Check(!player.CrossbowLoaded&&player.CrossbowReload==0&&player.Count("bolts")==1,"Dropping the crossbow left stale reload state or lost ammo.");
    }
}
