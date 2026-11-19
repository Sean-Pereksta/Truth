using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Windows.Forms;

namespace LastSignal {
    static class Checks {
        static void Expect(bool ok,string name){if(!ok)throw new InvalidOperationException("Check failed: "+name);}
        public static int Run(string[] args){
            if(args.Length<2)return 2;
            string folder=Path.GetFullPath(args[1]);Directory.CreateDirectory(folder);
            int seed=args.Length>2?int.Parse(args[2]):54921;
            var g=new Game {ForcedSeed=seed};g.Menu();
            using(var ui=new Ui()){
                ui.Paint(g,960,540);if(args[0]=="--capture")return Capture(g,ui,folder);
                ui.Key(g,Keys.Return);
                Expect(g.Mode=="match"&&g.Actors.Count==24&&g.Animals.Count>=12,"standard menu start");
                if(args[0]=="--check")NeedsCheck(g,folder);
                Stopwatch watch=Stopwatch.StartNew();
                using(var log=new StreamWriter(Path.Combine(folder,"match-"+seed+".txt"))){
                    log.AutoFlush=true;log.WriteLine("Seed "+seed+" | "+g.Actors.Count+" contestants | "+g.Props.Count+" arena objects | "+g.Animals.Count+" wildlife");
                    int count=g.AliveCount;bool watched=false;
                    for(int f=0;f<64000&&g.Mode!="results";f++){
                        g.Tick(1f/30);
                        if(count!=g.AliveCount){count=g.AliveCount;log.WriteLine(g.Time.ToString("0.0")+" s  |  "+count+" alive  |  "+g.KillFeed);}
                        if(g.Mode=="dead"&&!watched){ui.Paint(g,960,540);ui.Key(g,Keys.Return);Expect(g.Mode=="spectate","spectate from elimination");watched=true;}
                    }
                    Expect(g.Winner!=null&&g.Mode=="results"&&g.AliveCount==1,"declared winner");
                    log.WriteLine("Winner "+g.Winner.Name+" | placement "+g.Player.Placement+" | elapsed "+g.Time.ToString("0.0")+" s | spectate "+watched);
                    ui.Paint(g,960,540);ui.Key(g,Keys.Return);Expect(g.Mode=="match"&&g.Actors.Count==24&&g.AliveCount==24&&g.Time==0,"play again from results");
                    log.WriteLine("Replay passed. Test wall time "+watch.Elapsed.TotalSeconds.ToString("0.00")+" s.");
                }
            }return 0;
        }
        static void NeedsCheck(Game g,string folder){
            var food=new Actor();var water=new Actor();var supplied=new Actor();
            float foodDeath=0,waterDeath=0,tenFood=0,tenWater=0,worst=0;
            for(int tick=0;tick<7200;tick++){
                float t=tick*.33f;
                if(tick%220==0){g.Sip(food,100);g.Sip(supplied,100);supplied.Hunger=90;water.Hunger=90;}
                if(food.Health>0){g.AdvanceNeeds(food,.33f);if(food.Health<=0)foodDeath=t;}
                if(water.Health>0){g.AdvanceNeeds(water,.33f);if(water.Health<=0)waterDeath=t;}
                g.AdvanceNeeds(supplied,.33f);
                if(tick==1818){tenFood=food.Hunger;tenWater=water.Hydration;}
                worst=Math.Max(worst,water.NeedStrain);
            }
            Expect(tenFood>50&&tenWater>45,"healthy supplies at ten minutes");
            Expect(foodDeath>1500&&foodDeath<2050&&waterDeath>1200&&waterDeath<1700&&supplied.Health==100,"food and water independently required for survival");
            Expect(worst>.78f&&g.Mobility(water)<.75f&&g.VisibilityFactor(water)<.83f,"sustained depletion affects movement and visibility");
            var recovering=new Actor{NeedStrain=.9f,Hunger=80,Hydration=80};g.AdvanceNeeds(recovering,.1f);
            Expect(recovering.NeedStrain>.8f,"recovery occurs gradually");for(int i=0;i<1000;i++)g.AdvanceNeeds(recovering,.05f);
            Expect(recovering.NeedStrain<.01f,"recovery after replacing supplies");
            File.WriteAllText(Path.Combine(folder,"needs.txt"),String.Format("At ten minutes, rest food {0:F1}, water {1:F1}. Food-only deprivation lethal at {2:F1}s. Water-only deprivation lethal at {3:F1}s. Supplied control health {4:F0}. Gradual strain + recovery passed.",tenFood,tenWater,foodDeath,waterDeath,supplied.Health));
        }
        static int Capture(Game g,Ui ui,string folder){
            using(var w=new ArenaWindow(g,ui)){
                // Render to a real native drawable without activating a play window.
                w.StartPosition=FormStartPosition.Manual;w.Location=new Point(-32000,-32000);w.ClientSize=new Size(1120,630);w.ShowInTaskbar=false;
                IntPtr handle=w.Handle;
                using(var r=new Renderer(handle)){
                    Action<string> frame=name=>{r.Draw(g,1120,630);r.Overlay(ui.Paint(g,1120,630));r.Capture(Path.Combine(folder,name+".png"));r.Present();};
                    frame("title");ui.Key(g,Keys.Return);Expect(g.Actors.Count==24,"24 contestants on normal launch");frame("ring");
                    for(int i=0;i<200;i++)g.Tick(1f/30);frame("opening");
                    var watch=Stopwatch.StartNew();
                    for(int i=0;i<60;i++){g.Tick(1f/30);r.Draw(g,1120,630);r.Overlay(ui.Paint(g,1120,630));r.Present();}
                    watch.Stop();
                    g.Panel="craft";frame("craft");g.Panel="";g.Panel="pack";frame("pack");g.Panel="";
                    g.Menu();g.Panel="custom";frame("custom");
                    File.WriteAllText(Path.Combine(folder,"render.txt"),r.Driver+" | native WGL launch, title, 24-contestant match, craft, pack and custom screens rendered. 60-frame render check "+watch.Elapsed.TotalSeconds.ToString("F3")+" seconds at 1120x630.");
                }
            }return 0;
        }
    }
}
