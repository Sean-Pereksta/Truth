using System;
using System.Linq;
using LastSignal;

public static class ArmoryChecks {
    static void Require(bool ok, string message) {
        if (!ok) throw new Exception(message);
    }
    static void CheckMap(int map, bool rareRound) {
        int seed = 1;
        while ((new Random(seed ^ (map * 1009) ^ 0x43bc27).Next(3) == 0) != rareRound) seed++;
        var game = new Game { ForcedSeed = seed };
        game.Settings.ArenaId = map;
        game.Settings.Bots = 1;
        game.Start(true);
        Require(game.Props.Any(p => p.Item == "sword") && game.Props.Any(p => p.Item == "shield"),
            "Missing sword or shield in arena " + map);
        var crossbows = game.Props.Where(p => p.Item == "crossbow").ToArray();
        Require(crossbows.Length == (rareRound ? 1 : 0), "Incorrect rare crossbow count in arena " + map);
        if (!rareRound) return;
        var cache = crossbows[0];
        var actor = game.Player;
        actor.X = cache.X;
        actor.Y = cache.Y;
        actor.Z = cache.Z;
        Require(Survival.Take(game, actor, cache), "Crossbow could not be picked up");
        Require(actor.Weapon == "crossbow" && actor.Count("bolts") == 4 && cache.Removed,
            "Crossbow and its bundled bolts were not transferred together");
        Require(!Survival.Take(game, actor, cache), "A second pickup duplicated the crossbow");
    }
    static void CheckBuildingCosts() {
        foreach (string id in new[] { "wall", "ramp", "floor" }) {
            Recipe recipe = Survival.Find(Survival.Builds, id);
            Require(recipe != null && recipe.Yield == 1 && recipe.Needs.Count == 2 &&
                recipe.Needs["branch"] == 1 && recipe.Needs["fiber"] == 1,
                "Incorrect building recipe: " + id);
            Require(recipe.CostText == "1 wood  /  1 fiber", "Incorrect displayed building cost: " + id);
            var actor = new Actor();
            Require(!Survival.CanMake(actor, recipe), "Empty inventory can build " + id);
            actor.Add("branch", 1);
            Require(!Survival.CanMake(actor, recipe), "Missing fiber accepted for " + id);
            actor.Add("branch", -1);
            actor.Add("fiber", 1);
            Require(!Survival.CanMake(actor, recipe), "Missing wood accepted for " + id);
            actor.Add("branch", 1);
            Require(Survival.CanMake(actor, recipe), "Exact building materials rejected for " + id);
        }
    }
    public static int Main() {
        try {
            Require(Survival.Find(Survival.Crafts, "crossbow") == null, "Crossbows should only be found as rare loot");
            for (int map = 0; map < 3; map++) {
                CheckMap(map, false);
                CheckMap(map, true);
            }
            CheckBuildingCosts();
            ShieldChecks.Run();
            CrossbowChecks.Run();
            Console.WriteLine("Passed sword, shield, rare loot, crossbow and building cost checks.");
            return 0;
        } catch (Exception error) {
            Console.Error.WriteLine(error);
            return 1;
        }
    }
}
