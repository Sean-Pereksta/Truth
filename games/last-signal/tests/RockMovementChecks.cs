using System;
using LastSignal;

static class RockMovementChecks {
    const float Frame = 1f / 30;

    static void Require(bool condition, string message) {
        if (!condition) throw new InvalidOperationException(message);
    }

    static Game Scene(string model, float width, float height) {
        var game = new Game { Mode = "match" };
        Arena.Register(game, new Prop { Model = model, W = width, H = height, D = width, Solid = true });
        game.Player = new Actor();
        game.Actors.Add(game.Player);
        return game;
    }

    static void CheckJumpIntoRock(string model) {
        var game = Scene(model, 1.8f, .9f);
        var player = game.Player;
        player.X = -1.26f;
        game.Press("Jump");
        Require(player.Vertical > 0, "Jump did not start for " + model);
        for (int frame = 0; frame < 30; frame++) {
            if (frame < 9) Arena.Move(game, player, .11f, .02f);
            Arena.StepVertical(game, player, Frame);
            Require(Arena.CanStand(game, player.X, player.Y, player.Z), "Jump embedded the player in " + model);
        }
        Require(player.X > -1.1f && player.Y > .25f, "Jump missed the sloped face of " + model);
        game.Press("Jump");
        Require(player.Vertical > 0, "Player could not jump from the face of " + model);
        for (int frame = 0; frame < 30; frame++) {
            Arena.Move(game, player, -.11f, 0);
            Arena.StepVertical(game, player, Frame);
        }
        Require(player.X < -1.35f && Math.Abs(player.Y - Arena.Height(player.X, player.Z)) < .01f,
            "Player could not leave " + model + " and return to the ground");
    }

    static void CheckExistingOverlap() {
        var game = Scene("boulder", 2.2f, 2.4f);
        var player = game.Player;
        player.X = .4f;
        Require(!Arena.CanStand(game, player.X, player.Y, player.Z), "Player must begin inside the boulder");
        Arena.Move(game, player, -.06f, 0);
        Require(Math.Abs(player.X - .4f) < .001f, "Player moved deeper into the boulder");
        for (int frame = 0; frame < 24; frame++) Arena.Move(game, player, .06f, 0);
        Require(player.X > 1.4f && Arena.CanStand(game, player.X, player.Y, player.Z),
            "Player could not walk out of an existing boulder overlap");
    }

    static void CheckAdjacentRocks(bool tallerFirst) {
        var game = new Game { Mode = "match" };
        var lower = new Prop { Model = "rock", X = -.38f, W = 1.8f, H = .67f, D = 1.8f, Solid = true };
        var taller = new Prop { Model = "snow_boulder", X = .38f, W = 1.8f, H = .92f, D = 1.8f, Solid = true };
        Arena.Register(game, tallerFirst ? taller : lower);
        Arena.Register(game, tallerFirst ? lower : taller);
        var player = new Actor { Z = 1.26f };
        game.Player = player;
        game.Actors.Add(player);

        game.Press("Jump");
        for (int frame = 0; frame < 30; frame++) {
            if (frame < 9) Arena.Move(game, player, 0, -.064f);
            Arena.StepVertical(game, player, Frame);
            Require(Arena.CanStand(game, player.X, player.Y, player.Z), "Jump embedded the player between two stones");
        }
        Require(player.Y > .55f && player.Z < .9f, "Landing missed the taller of the overlapping stones");
        for (int frame = 0; frame < 23; frame++) {
            Arena.Move(game, player, 0, .11f);
            Arena.StepVertical(game, player, Frame);
        }
        Require(player.Z > 1.3f && player.Y < .01f, "Player could not walk away from two overlapping stones");
    }

    static void CheckJumpOverLowRock() {
        var game = Scene("rock", .6f, .4f);
        var player = game.Player;
        player.X = -1.4f;
        game.Press("Jump");
        for (int frame = 0; frame < 28; frame++) {
            Arena.Move(game, player, .18f, 0);
            Arena.StepVertical(game, player, Frame);
        }
        Require(player.X > 1.4f && Math.Abs(player.Y - Arena.Height(player.X, player.Z)) < .01f,
            "Low rock prevented a clear jump over it");
    }

    static void CheckHostedJump() {
        var game = new Game();
        game.StartOnlineRound(new[] { "Host", "Guest" }, 73119, 0, 1, 1, false);
        game.Countdown = 0;
        foreach (Prop prop in game.Props) prop.Removed = true;
        foreach (Actor actor in game.Actors) if (actor.Id > 1) actor.Alive = false;
        game.AliveCount = 2;
        Arena.Register(game, new Prop { Model = "rock", W = 1.8f, H = .9f, D = 1.8f, Solid = true });
        Actor guest = game.Actors[1];
        guest.X = -1.26f;
        guest.Y = guest.Z = 0;
        float yaw = (float)(Math.PI / 2);

        game.ApplyOnlineInput(1, new OnlinePlayerInput { Sequence = 1, Forward = .79f, Yaw = yaw, Actions = { "+Jump" } });
        Require(guest.Vertical > 0 && game.Player.Vertical == 0, "Hosted jump was not applied to the guest seat");
        for (int frame = 0; frame < 30; frame++) {
            if (frame == 9) game.ApplyOnlineInput(1, new OnlinePlayerInput { Sequence = 2, Yaw = yaw });
            game.Tick(Frame);
            Require(Arena.CanStand(game, guest.X, guest.Y, guest.Z), "Host embedded the guest in a rock");
        }
        Require(guest.X > -1.1f && guest.Y > .25f, "Hosted jump missed the rock face");
        game.ApplyOnlineInput(1, new OnlinePlayerInput { Sequence = 3, Forward = -.79f, Yaw = yaw });
        for (int frame = 0; frame < 30; frame++) game.Tick(Frame);
        Require(guest.X < -1.35f && guest.Y < .01f, "Host could not move the guest away from the rock");
    }

    static int Main() {
        try {
            Arena.Select(0);
            foreach (string model in new[] { "rock", "boulder", "mesa_rock", "sand_hoodoo", "snow_boulder", "ice_teeth" })
                CheckJumpIntoRock(model);
            CheckAdjacentRocks(false);
            CheckAdjacentRocks(true);
            CheckExistingOverlap();
            CheckJumpOverLowRock();
            CheckHostedJump();
            Console.WriteLine("Passed native rock landing, jump clearance and overlap recovery checks.");
            return 0;
        } catch (Exception error) {
            Console.Error.WriteLine(error);
            return 1;
        }
    }
}
