using System;

namespace LastSignal
{
    public static partial class Survival
    {
        public const float SkinVolume=42f, BarrelVolume=160f;
        // Each rain cycle can replenish nearly a full barrel.
        private const float RainRate=1.35f;

        public static float WaterCapacity(Actor a)
        {
            return a==null?0:a.Count("waterskin")*SkinVolume;
        }
        private static bool Barrel(Prop p)
        {
            return p!=null && p.Model=="rain_barrel";
        }
        private static bool WaterSource(Prop p)
        {
            return p!=null && (p.Kind=="water" || Barrel(p));
        }
        public static bool HasShore(Game g,Actor a)
        {
            float waterX,waterZ;
            return a!=null && a.Alive && Arena.Shore(g,a.X,a.Z,out waterX,out waterZ) &&
                Math.Abs(a.Y-Arena.Ground(g,a.X,a.Z))<1.9f;
        }
        private static bool AtWater(Game g,Actor a,Prop p)
        {
            if(a==null || !a.Alive) return false;
            if(p==null)return HasShore(g,a);
            return !p.Removed && WaterSource(p) && InReach(a,p.X,p.Z,0) &&
                Math.Abs(a.Y-p.Y)<2.8f && Visible(g,a,p.X,p.Y+UseAnchor(p),p.Z,p);
        }
        private static float Available(Prop p)
        {
            return Barrel(p)?Math.Max(0,p.Water):float.MaxValue;
        }
        private static void DebitSource(Prop p,float used)
        {
            if(Barrel(p)) p.Water=Math.Max(0,p.Water-used);
        }
        public static bool Drink(Game g,Actor a,Prop p)
        {
            if(!AtWater(g,a,p))return false;
            float used=g.Sip(a,Available(p));
            if(used<=0) {if(a==g.Player)g.Say(Available(p)<=0?"The rain barrel is empty":"Hydration is full"); return false;}
            DebitSource(p,used);
            if(a==g.Player)g.Say("Drank water  +"+Units(used)+" hydration");
            return true;
        }
        public static bool Fill(Game g,Actor a,Prop p)
        {
            if(!AtWater(g,a,p))return false;
            float room=Math.Max(0,WaterCapacity(a)-a.WaterCarried);
            float moved=Math.Min(room,Available(p));
            if(moved<=.001f) return false;
            a.WaterCarried+=moved;DebitSource(p,moved);
            if(a==g.Player)g.Say("Waterskins hold "+Units(a.WaterCarried)+" / "+Units(WaterCapacity(a)));
            return true;
        }
        public static bool Pour(Game g,Actor a,Prop p)
        {
            if(!Barrel(p) || !AtWater(g,a,p))return false;
            float moved=Math.Min(Math.Max(0,a.WaterCarried),Math.Max(0,BarrelVolume-p.Water));
            if(moved<=.001f) return false;
            p.Water+=moved;a.WaterCarried=Math.Max(0,a.WaterCarried-moved);
            if(a==g.Player)g.Say("Stored "+Units(moved)+" water in barrel");
            return true;
        }
        public static bool SipSkin(Game g,Actor a)
        {
            if(a==null || !a.Alive || a.Count("waterskin")==0)return false;
            if(a.WaterCarried<=.001f){if(a==g.Player)g.Say("Empty waterskin. Fill at a spring, stream bank or rain barrel.");return false;}
            float used=g.Sip(a,a.WaterCarried);
            if(used<=0){if(a==g.Player)g.Say("Hydration is full");return false;}
            a.WaterCarried=Math.Max(0,a.WaterCarried-used);
            if(a==g.Player)g.Say("Drank from waterskin  /  "+Units(a.WaterCarried)+" left");
            return true;
        }
        internal static bool CatchesRain(Game g,Prop barrel)
        {
            float clear;
            Arena.RayProp(g,barrel.X,barrel.Y+barrel.H+.06f,barrel.Z,0,1,0,18f,out clear);
            return clear>=18f;
        }
        private static void LoadCarriedWater(Actor a,Prop container,int skins)
        {
            float load=Math.Min(Math.Max(0,container.Water),Math.Max(0,skins)*SkinVolume);
            a.WaterCarried=Math.Min(WaterCapacity(a),Math.Max(0,a.WaterCarried)+load);
            container.Water=0;
        }
        public static void TransferWaterOnDeath(Actor a,Prop pack)
        {
            pack.Water=Math.Min(Math.Max(0,a.WaterCarried),WaterCapacity(a));
            a.WaterCarried=0;
        }
        private static string Units(float amount)
        {
            return ((int)Math.Round(Math.Max(0,amount))).ToString();
        }
        private static void WaterChoices(Game g,Prop p)
        {
            Actor a=g.Player;
            bool wet=Available(p)>.001f;
            bool fill=wet && a.WaterCarried+.001f<WaterCapacity(a);
            if(wet && (!fill || a.Hydration<99f))g.FocusOptions.Add("drink");
            if(fill)g.FocusOptions.Add("fill");
            if(Barrel(p) && a.WaterCarried>.001f && p.Water<BarrelVolume-.001f)g.FocusOptions.Add("pour");
            if(wet && fill && a.Hydration>=99f)g.FocusOptions.Add("drink");
        }
    }
}
