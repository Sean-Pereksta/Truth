using System;
using System.Diagnostics;
using System.Threading;
using System.Web.Script.Serialization;

namespace LastSignal {
    internal static class ManagedArena {
        // The launcher owns both pipes. Nothing on the network can request this bootstrap secret.
        internal static int Run() {
            try {
                var game = new Game();
                game.Menu();
                using (var session = new OnlineSession(game))
                using (var stop = new ManualResetEvent(false)) {
                    game.Online = session;
                    session.HostManaged();
                    var json = new JavaScriptSerializer();
                    var invite = new Uri(session.LocalInvite);
                    Console.Out.WriteLine(json.Serialize(new { type = "ready", port = invite.Port, key = invite.Fragment.Substring(1) }));
                    Console.Out.Flush();
                    var control = new Thread(delegate() {
                        try { while (true) { string line = Console.In.ReadLine(); if (line == null || line == "stop") break; } }
                        catch (System.IO.IOException) { }
                        try { stop.Set(); } catch (ObjectDisposedException) { }
                    });
                    control.IsBackground = true;
                    control.Start();
                    var clock = Stopwatch.StartNew();
                    double previous = clock.Elapsed.TotalSeconds, accumulated = 0;
                    string previousPhase = null;
                    int previousPlayers = -1;
                    while (!stop.WaitOne(8)) {
                        double now = clock.Elapsed.TotalSeconds;
                        accumulated += Math.Min(.25, now - previous);
                        previous = now;
                        while (accumulated >= 1d / 30) {
                            session.Pump(1f / 30);
                            accumulated -= 1d / 30;
                        }
                        string phase = session.Phase == "lobby" ? "waiting" : game.Winner == null ? "playing" : "finished";
                        if (previousPhase != phase || previousPlayers != session.HumanCount) {
                            Console.Out.WriteLine(json.Serialize(new { type = "status", phase, players = session.HumanCount }));
                            Console.Out.Flush();
                            previousPhase = phase;
                            previousPlayers = session.HumanCount;
                        }
                    }
                }
                return 0;
            } catch (Exception ex) {
                Console.Error.WriteLine("Last Signal server failed: " + ex.Message);
                return 1;
            }
        }
    }
}
