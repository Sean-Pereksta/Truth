using System;
using LastSignal;

internal static class WorkbenchChecks {
    static void Require(bool ok,string message) {
        if(!ok)throw new Exception(message);
    }

    static Game ArenaGame() {
        var game=new Game {ForcedSeed=73119};
        game.Start(false);
        game.Countdown=0;
        return game;
    }

    static Prop WallInReach(Game game) {
        Actor actor=game.Player;
        actor.Add("branch",1); actor.Add("fiber",1);
        for(int x=42;x<110;x+=4)for(int z=-40;z<40;z+=4) {
            actor.X=x;actor.Z=z-2.4f;actor.Y=Arena.Ground(game,actor.X,actor.Z);actor.Yaw=0;
            game.Pitch=0;
            if(!Arena.CanStand(game,actor.X,actor.Y,actor.Z))continue;
            game.RefreshOnlineCamera(0);
            Prop wall=Survival.Build(game,actor,"wall",x,z,0);
            if(wall!=null)return wall;
        }
        throw new Exception("Could not place a timber test wall.");
    }

    static void TimberRepair() {
        Game game=ArenaGame();
        Prop wall=WallInReach(game);
        float before=wall.MaxHP*.28f;
        wall.HP=before;
        Actor actor=game.Player;
        actor.Add("branch",1);
        Require(Survival.BeginUse(game),"Aiming at a damaged wall should offer direct repair.");
        Survival.Tick(game,.8f);
        actor.Health-=5;
        Survival.Tick(game,.3f);
        Require(wall.HP==before&&actor.Count("branch")==1,"Interrupted repair spent wood or restored health.");
        Require(Survival.BeginUse(game),"Interrupted repair could not be retried.");
        Survival.Tick(game,1.1f);
        Require(wall.HP==before&&actor.Count("branch")==1,"Repair completed too early.");
        Survival.Tick(game,1f);
        Require(Math.Abs(wall.HP-(before+wall.MaxHP*.35f))<.02f&&actor.Count("branch")==0,
            "Direct repair did not spend one wood for a partial repair.");
        actor.Add("branch",1);
        Require(!Survival.BeginUse(game)&&actor.Count("branch")==1,"A second patch should not be usable on the same wall.");
    }

    static void GiveAmmoMaterials(Actor actor,int batches) {
        actor.Add("branch",batches); actor.Add("stone",batches); actor.Add("fiber",batches);
    }

    static void CraftInMenu() {
        Game game=ArenaGame();
        Recipe arrows=Survival.Find(Survival.Crafts,"arrows");
        Recipe bow=Survival.Find(Survival.Crafts,"bow");
        GiveAmmoMaterials(game.Player,3);
        game.Panel="craft";
        Require(!game.InputCraft(bow,3),"Batch crafting should be restricted to ammunition.");
        Require(game.InputCraft(arrows,3)&&game.Panel=="craft","Selecting a recipe closed the craft menu.");
        Require(!game.InputCraft(arrows,1),"An active craft could be replaced by another craft.");
        Survival.Tick(game,2f);
        Require(game.Player.Count("arrows")==15&&game.Player.Count("branch")==0&&game.Player.Count("stone")==0&&
            game.Player.Count("fiber")==0&&game.Panel=="craft","Ammo batch yield, debit or menu state differed.");
        game.Player.Add("firekit",1);
        Require(game.InputUseItem("firekit")&&game.BuildId=="fire"&&game.Player.Count("firekit")==1,
            "A campfire kit did not open a direct placement preview.");
    }

    static void HostedCraftSeats() {
        var game=new Game();
        game.StartOnlineRound(new[]{"Host","Guest"},73119,0,1,1,true);
        game.Countdown=0;
        GiveAmmoMaterials(game.Player,1);
        game.WithOnlineSeat(1,g=>GiveAmmoMaterials(g.Player,3));
        game.ApplyOnlineInput(0,new OnlinePlayerInput{Sequence=1,Actions={"craft:arrows"}});
        game.ApplyOnlineInput(1,new OnlinePlayerInput{Sequence=1,Actions={"craft:arrows:3"}});
        game.WithOnlineSeat(1,g=>Survival.Tick(g,.7f));
        Require(game.Actors[1].Count("arrows")==0,"A hosted three-batch craft used another seat's timer.");
        Survival.Tick(game,.7f);
        Require(game.Actors[0].Count("arrows")==5&&game.Actors[1].Count("arrows")==0,"Hosted crafting mixed two players' inventories.");
        game.WithOnlineSeat(1,g=>Survival.Tick(g,1.3f));
        Require(game.Actors[1].Count("arrows")==15&&game.Actors[1].Count("branch")==0&&game.Actors[0].Count("arrows")==5,
            "The hosted three-batch request did not commit to its own seat.");
    }

    internal static void Run() {
        TimberRepair();
        CraftInMenu();
        HostedCraftSeats();
        Console.WriteLine("Passed direct timber repair and repeat Craft checks in solo and hosted seats.");
    }
}
