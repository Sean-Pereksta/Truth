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
    public static int Main() {
        try {
            Require(Survival.Find(Survival.Crafts, "crossbow") == null, "Crossbows should only be found as rare loot");
            for (int map = 0; map < 3; map++) {
                CheckMap(map, false);
                CheckMap(map, true);
            }
            ShieldChecks.Run();
            CrossbowChecks.Run();
            Console.WriteLine("Passed sword, shield, rare loot and crossbow checks.");
            return 0;
        } catch (Exception error) {
            Console.Error.WriteLine(error);
            return 1;
        }
    }
}
