using System;
using System.Collections.Generic;

namespace LastSignal {
    public partial class Game {
        internal readonly HashSet<Prop> PatchedTimber=new HashSet<Prop>();
        internal float RepairStartHealth;
    }

    public static partial class Survival {
        static bool RepairableTimber(Prop p) {
            return p!=null && !p.Removed && p.Kind=="structure" && p.MaxHP>0 &&
                (p.Model=="wall" || p.Model=="barricade" || p.Model=="ramp" || p.Model=="floor");
        }

        static Prop AimedTimber(Game g,InteractionRay ray) {
            float distance;
            Prop p=Arena.RayProp(g,ray.X,ray.Y,ray.Z,ray.DX,ray.DY,ray.DZ,Reach+.35f,out distance);
            return RepairableTimber(p)&&p.HP<p.MaxHP&&InReach(g.Player,p.X,p.Z,.35f)?p:null;
        }

        static string RepairProblem(Game g,Prop p) {
            if(!RepairableTimber(p) || p.HP>=p.MaxHP)return "No repair needed";
            if(g.PatchedTimber.Contains(p))return "Already patched";
            if(g.Player.Count("branch")<1)return "Need 1 wood";
            return "";
        }

        internal static object RepairStatus(Game g) {
            if(g.BuildId!="" || g.Player==null || !g.Player.Alive)return null;
            bool active=g.ActionId=="repair";
            Prop prop=active?g.UseProp:g.FocusProp;
            if(!RepairableTimber(prop) || prop.HP>=prop.MaxHP)return null;
            string reason=RepairProblem(g,prop);
            return new {enabled=reason.Length==0&&!active,reason,target=Label(prop.Model),woodNeeded=1,active};
        }

        static bool CanContinueRepair(Game g,Actor a,Prop p) {
            return a.Health>=g.RepairStartHealth && RepairProblem(g,p).Length==0 &&
                AimedTimber(g,new InteractionRay(g))==p;
        }

        static bool Patch(Game g,Actor a,Prop p) {
            if(!CanContinueRepair(g,a,p) || !g.PatchedTimber.Add(p))return false;
            a.Add("branch",-1);
            p.HP=Math.Min(p.MaxHP,p.HP+p.MaxHP*.35f);
            g.SoundAt(a,16,"build");
            g.Cue("wood",p.X,p.Z,16);
            return true;
        }
    }
}
