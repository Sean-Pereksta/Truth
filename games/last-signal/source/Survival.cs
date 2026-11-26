using System;
using System.Collections.Generic;

namespace LastSignal
{
    public sealed class Recipe
    {
        public readonly string Id, Name, Info, CostText;
        public readonly int Yield;
        public readonly Dictionary<string,int> Needs = new Dictionary<string,int>();

        public Recipe(string id, string name, string info, int yield, params object[] materials)
        {
            Id = id;
            Name = name;
            Info = info;
            Yield = yield;
            List<string> labels = new List<string>();
            for (int k=0; k<materials.Length; k+=2)
            {
                string item = (string)materials[k];
                int count = (int)materials[k+1];
                Needs.Add(item, count);
                labels.Add(count + " " + Survival.Label(item).ToLowerInvariant());
            }
            CostText = String.Join("  /  ", labels.ToArray());
        }
    }

    public partial class Game
    {
        public Prop Ghost;
        public bool GhostFits,BuildJoined;
        public string BuildId = "", BuildProblem = "";
        internal float BuildAngle;
        internal bool BuildTurned;
        internal Prop UseProp, FocusProp;
        internal Animal UseAnimal, FocusAnimal;
        internal string ActionId = "", ActionArgument = "";
        internal float ActionElapsed, ActionTotal;
        internal int FocusChoice;
        internal List<string> FocusOptions = new List<string>();
        internal List<Prop> FocusNearby = new List<Prop>(32), CookingSites = new List<Prop>(16);
        internal int IndexedCookingProps;
        internal bool FocusShore;
        internal List<Prop> RainBarrels = new List<Prop>(8);
    }

    public static partial class Survival
    {
        internal const string ShelterFrameLabel="Unfinished shelter frame";
        internal static bool IsShelterFrame(Prop p) {
            return p!=null && p.Model=="barricade" && p.Label==ShelterFrameLabel;
        }
        public static readonly Recipe[] Crafts = {
            new Recipe("sling","Sling","Hold Attack, then release a stone. Aim steadies the shot.",1,"fiber",2,"cloth",1),
            new Recipe("spear","Spear","Attack to thrust. Hold Throw and release. Recover with Use.",1,"branch",2,"stone",1,"fiber",1),
            new Recipe("arrows","Arrows ×5","A bundle for your bow. Recover landed arrows with Use.",5,"branch",1,"stone",1,"fiber",1),
            new Recipe("hatchet","Hatchet","Heavy swings can open wooden cover.",1,"branch",1,"scrap",2,"fiber",1),
            new Recipe("bandage","Bandage","Use from your pack to restore 28 health.",1,"cloth",1,"fiber",1),
            new Recipe("fire","Campfire kit","Set the kit on open ground, then light it.",1,"branch",2,"stone",2,"tinder",1),
            new Recipe("waterskin","Waterskin","Holds 42 water. Fill at springs or along a stream bank.",1,"cloth",2,"fiber",1),
            new Recipe("bow","Field bow","Hold Attack to draw. Aim to steady. Release to loose.",1,"branch",3,"fiber",3,"cloth",1),
            new Recipe(Armor.Woven,"Woven vest","Padded torso armor. Absorbs 24% of damage to the vest.",1,"cloth",2,"fiber",2),
            new Recipe(Armor.Scrap,"Scrap cuirass","Plated torso armor. Absorbs 40% of damage to the cuirass.",1,"scrap",3,"cloth",1,"fiber",2),
            new Recipe("shield","Round shield","Carried with a spear or sword. Hold Guard to cover the space in front of you.",1,"branch",3,"scrap",1,"fiber",2),
            new Recipe("sword","Arena sword","A one-handed blade for close combat. Pairs with a shield.",1,"scrap",4,"branch",1,"cloth",1),
            new Recipe("bolts","Bolts x3","Ammunition for the arena crossbow.",3,"scrap",1,"branch",1)
        };

        public static readonly Recipe[] Builds = {
            new Recipe("barricade","Low barricade","Waist-high cover. Crouch to break sight.",1,"branch",2,"fiber",1),
            new Recipe("wall","Timber wall","Join walls at their ends or start another story on a floor edge.",1,"branch",1,"fiber",1),
            new Recipe("gate","Hinged gate","Fits between walls. Close it and choose Bar gate to secure it.",1,"branch",3,"fiber",1,"scrap",1),
            new Recipe("lean_to","Lean-to","A shelter for a camp on the arena floor.",1,"branch",3,"fiber",2,"cloth",1),
            new Recipe("ramp","Timber ramp","Align the high end with a landing to walk up one story.",1,"branch",1,"fiber",1),
            new Recipe("fire","Campfire","Cook game here. Smoke and light reveal its position.",1,"branch",2,"stone",2,"tinder",1),
            new Recipe("rain_barrel","Rain barrel","Stores 160 water. Collects rain or accepts water from a skin.",1,"branch",4,"fiber",2,"cloth",1),
            new Recipe("floor","Floor / ceiling","Aim at a wall top to build above it, or a floor edge to extend it.",1,"branch",1,"fiber",1)
        };

        private const float Reach = 3.25f;
        private const float CookSeconds = 18f;

        public static string Label(string item)
        {
            switch (item)
            {
                case "lean_to": return "Lean-to";
                case "meat": return "Game meat";
                case "meal": return "Cooked meal";
                case "branch": return "Wood";
                case "firekit": return "Campfire kit";
                case "fire": return "Campfire";
                case "fiber": return "Fiber";
                case "stone": return "Stone";
                case "arrows": return "Arrows";
                case "barricade": return "Low barricade";
                case "pack": return "Dropped pack";
                case "stove": return "Arena stove";
                case "rain_barrel": return "Rain barrel";
                case "waterskin": return "Waterskin";
                case "wall": return "Timber wall";
                case "ramp": return "Timber ramp";
                case "floor": return "Floor / ceiling";
            }
            if (String.IsNullOrEmpty(item)) return "";
            return Char.ToUpperInvariant(item[0]) + item.Substring(1).Replace('_',' ');
        }
        public static int Count(Actor a, string item) { return a == null ? 0 : a.Count(item); }
        public static Recipe Find(Recipe[] table,string id)
        {
            for (int i=0;i<table.Length;i++) if (table[i].Id==id) return table[i];
            return null;
        }
        public static bool CanMake(Actor a, Recipe r)
        {
            if (a==null || !a.Alive || r==null) return false;
            if (r.Id=="fire" && a.Count("firekit")>0 && Object.ReferenceEquals(r,Builds[5])) return true;
            foreach (KeyValuePair<string,int> part in r.Needs)
                if (a.Count(part.Key)<part.Value) return false;
            return true;
        }
        private static void Pay(Actor a,Recipe r)
        {
            foreach (KeyValuePair<string,int> part in r.Needs) a.Add(part.Key,-part.Value);
        }
        private static string Missing(Actor a,Recipe r)
        {
            List<string> missing=new List<string>();
            foreach (KeyValuePair<string,int> part in r.Needs)
            {
                int remain=part.Value-Count(a,part.Key);
                if (remain>0) missing.Add(remain+" "+Label(part.Key).ToLowerInvariant());
            }
            return "Need " + String.Join(" + ",missing.ToArray());
        }
        private static bool InReach(Actor a, float x,float z,float extra)
        {
            return a!=null && a.Alive && Game.Distance(a.X,a.Z,x,z)<=Reach+extra;
        }
        private static bool Weapon(string id)
        {
            return id=="sling" || id=="spear" || id=="hatchet" || id=="knife" || id=="bow" || id=="fists" || id=="sword" || id=="crossbow";
        }
        public static void EquipActor(Actor a,string id)
        {
            if (a==null || !Weapon(id) || (id!="fists" && a.Count(id)<=0))return;
            if(a.Weapon=="crossbow" && id!=a.Weapon)a.CrossbowReload=0;
            if(a.Weapon!=id && a.PickupSource!=null && a.LiftedWeapon==id)a.LiftWeapon(a.PickupSource,id);
            a.Weapon=id;
        }
        public static bool Equip(Game g,string id)
        {
            if (g.Player==null || !g.Player.Alive || !Weapon(id) || (id!="fists" && g.Player.Count(id)<1)) return false;
            return g.RequestWeapon(id);
        }
        public static bool Craft(Game g, Actor a,string id)
        {
            Recipe r=Find(Crafts,id);
            if (!CanMake(a,r)) return false;
            Pay(a,r);
            a.Add(id=="fire"?"firekit":id,r.Yield);
            if (Weapon(id) && (a==g.Player || a.Weapon=="fists")) EquipActor(a,id);
            return true;
        }
        public static Prop Build(Game g,Actor a,string id,float x,float z,float yaw)
        {
            return Build(g,a,Arena.BuildPreview(g,id,x,z,yaw));
        }
        internal static Prop Build(Game g,Actor a,Prop preview)
        {
            if(preview==null)return null;
            string id=preview.Model;Recipe r=Find(Builds,id);
            if(!CanMake(a,r)||!InReach(a,preview.X,preview.Z,3.1f)||!Arena.FortVisible(g,a,preview))return null;
            Prop p=Arena.AddBuilt(g,preview,a);
            if (p==null) return null;
            if (id=="fire" && a.Count("firekit")>0) a.Add("firekit",-1);
            else Pay(a,r);
            if (id=="fire") { p.Fuel=55f; p.Lit=false; }
            g.SoundAt(a,14,"build");
            g.Cue("wood",p.X,p.Z,14);
            return p;
        }
        public static bool Eat(Game g,Actor a)
        {
            if (a==null || !a.Alive || a.Count("meal")<1 || a.Hunger>=99.5f) return false;
            a.Add("meal",-1); a.Hunger=Math.Min(100,a.Hunger+38);
            return true;
        }
        public static bool Harvest(Game g,Actor a,Animal animal)
        {
            if (animal==null || animal.Alive || animal.Harvested || !InReach(a,animal.X,animal.Z,.25f) || Math.Abs(a.Y-animal.Y)>2.8f) return false;
            if (!Visible(g,a,animal.X,animal.Y+.22f,animal.Z,null)) return false;
            animal.Harvested=true;
            int n=Wildlife.Yield(animal);
            a.Add("meat",n); g.SoundAt(a,5);
            if (a==g.Player) g.Say("Harvested " + n + (n==1?" portion":" portions") + " of game meat");
            return true;
        }
        public static bool Take(Game g,Actor a,Prop p)
        {
            if (p==null || p.Removed || p.Kind=="remnant" || !InReach(a,p.X,p.Z,.3f) || Math.Abs(a.Y-p.Y)>3f) return false;
            if (!Visible(g,a,p.X,p.Y+.28f,p.Z,p)) return false;
            if (p.Kind=="pack" || p.Model=="pack" && p.Item=="")
            {
                int total=0;bool gear=false;string prior=a.Weapon;
                foreach (KeyValuePair<string,int> it in p.Bag)
                {
                    if (it.Value<=0) continue;
                    total+=it.Value;
                    if(Armor.IsArmor(it.Key))Armor.Collect(a,p,it.Key,it.Value);
                    else a.Add(it.Key,it.Value);
                    if (Weapon(it.Key)){
                        gear=true;
                        if (a.Weapon=="fists") EquipActor(a,it.Key);
                    }
                }
                a.FoodProgress.AddRange(p.FoodProgress);
                int skins; p.Bag.TryGetValue("waterskin",out skins);
                LoadCarriedWater(a,p,skins);
                p.FoodProgress.Clear(); p.Bag.Clear(); p.Removed=true;
                if(total>0) Arena.Register(g,new Prop{Model="pack",Kind="remnant",Label="Emptied pack",
                    X=p.X,Y=p.Y,Z=p.Z,Yaw=p.Yaw+.47f,Scale=p.Scale,W=.62f,H=.12f,D=.48f});
                if(a.Weapon!=prior)a.LiftWeapon(p,a.Weapon);
                if(gear) g.Cue(a==g.Player?"focus_equip":"equip",a.X,a.Z,9);
                if (a==g.Player) g.Say(total==0?"The pack was empty":"Recovered supplies from the pack");
                return true;
            }
            if (p.Kind!="pickup" || String.IsNullOrEmpty(p.Item)) return false;
            if(Armor.IsArmor(p.Item)) Armor.Collect(a,p,p.Item,Math.Max(1,p.Amount));
            else a.Add(p.Item,Math.Max(1,p.Amount));
              string suppliedAmmo=p.Item=="bow"?"arrows":p.Item=="crossbow"?"bolts":p.Item=="sling"?"stone":null;
              int rounds=0;
              if(suppliedAmmo!=null && p.Bag.TryGetValue(suppliedAmmo,out rounds) && rounds>0){
                  a.Add(suppliedAmmo,rounds);
                  p.Bag.Remove(suppliedAmmo);
              }
            if (p.Item=="meat") a.FoodProgress.AddRange(p.FoodProgress);
            if (p.Item=="waterskin") LoadCarriedWater(a,p,p.Amount);
            if (Weapon(p.Item)){
                if(a.Weapon!=p.Item){a.PickupSource=p;a.LiftedWeapon=p.Item;a.PickupLift=0;}
                if(a.Weapon=="fists") EquipActor(a,p.Item);
                g.Cue(a==g.Player?"focus_equip":"equip",a.X,a.Z,9);
            }
            p.Removed=true;
              if (a==g.Player) g.Say("+" + Math.Max(1,p.Amount) + " " + Label(p.Item)
                  + (rounds>0?"  +"+rounds+" "+Label(suppliedAmmo):""));
            return true;
        }
        private static float RemoveMeat(Actor a)
        {
            a.Add("meat",-1);
            if (a.FoodProgress.Count==0) return 0;
            int i=0;
            for (int k=1;k<a.FoodProgress.Count;k++)
                if (a.FoodProgress[k]>a.FoodProgress[i]) i=k;
            float progress=a.FoodProgress[i];
            a.FoodProgress.RemoveAt(i);
            return Math.Min(.999f,Math.Max(0,progress));
        }
        private static bool Fire(Prop p) { return p!=null && (p.Kind=="fire" || p.Kind=="stove"); }
        private static bool Stove(Prop p) { return p.Kind=="stove"; }
        public static bool Tend(Game g,Actor a,Prop p,string action)
        {
            if (!Fire(p) || p.Removed || !InReach(a,p.X,p.Z,.25f) || Math.Abs(p.Y-a.Y)>3f) return false;
            if(!Visible(g,a,p.X,p.Y+.55f,p.Z,p)) return false;
            switch (action)
            {
                case "light":
                    if (Stove(p) || p.Lit || p.Fuel<=.01f) return false;
                    p.Lit=true; g.SoundAt(a,8); break;
                case "fuel":
                    if (Stove(p) || a.Count("branch")<1 || p.Fuel>245) return false;
                    a.Add("branch",-1); p.Fuel+=55; break;
                case "cook":
                    if (p.HasMeat || (!p.Lit && !Stove(p)) || a.Count("meat")<1) return false;
                    p.Cook=RemoveMeat(a); p.HasMeat=true; break;
                case "take":
                    if (!p.HasMeat) return false;
                    if (p.Cook>=1) a.Add("meal",1);
                    else { a.Add("meat",1); if(p.Cook>0) a.FoodProgress.Add(p.Cook); }
                    p.HasMeat=false; p.Cook=0; break;
                case "extinguish":
                    if (Stove(p) || !p.Lit) return false;
                    p.Lit=false; g.SoundAt(a,5); break;
                default: return false;
            }
            return true;
        }
        public static string[] PackItems(Actor a)
        {
            List<string> items=new List<string>();
            if (a!=null) foreach(KeyValuePair<string,int> entry in a.Bag) if(entry.Value>0) items.Add(entry.Key);
            items.Sort(StringComparer.Ordinal);
            return items.ToArray();
        }
        public static bool UsePack(Game g,string id)
        {
            Actor a=g.Player;
            if (a==null || !a.Alive || a.Count(id)<1) return false;
            if (Weapon(id)) return Equip(g,id);
            if (Armor.IsArmor(id)) return Armor.Toggle(g,a,id);
            if (id=="firekit") return ChooseBuild(g,"fire");
            if (id=="waterskin") return SipSkin(g,a);
            if (id=="meal")
            {
                if (!Eat(g,a)) { g.Say("You are full"); return false; }
                g.Say("Ate a cooked meal  +38 food"); return true;
            }
            if(id=="bandage")
            {
                if (a.Health>=99.5f) { g.Say("Health is full"); return false; }
                a.Health=Math.Min(100,a.Health+28); a.Add("bandage",-1);
                g.Say("Applied bandage  +28 health"); return true;
            }
            if (id=="meat") g.Say("Cook game meat on a lit fire or an arena stove");
            else if (id=="arrows") g.Say("Equip a bow to use arrows");
            else if (id=="bolts") g.Say("Equip a crossbow to load bolts");
            else if (id=="shield") g.Say("Equip a spear or sword, then hold "+g.InputLabel("Guard")+" to raise your shield");
            else if (id=="stone") g.Say("Sling ammunition and crafting material");
            else g.Say("Use this material in the craft or build wheel");
            return false;
        }
        public static bool Drop(Game g,string id)
        {
            Actor a=g.Player;
            if(a==null || !a.Alive || a.Count(id)<1) return false;
            float x=a.X+(float)Math.Sin(a.Yaw)*1.1f, z=a.Z+(float)Math.Cos(a.Yaw)*1.1f;
            float floor=Arena.GroundBelow(g,x,z,a.Y+.44f);
            if (!Arena.Clear(g,a.X,a.Y+.9f,a.Z,x,floor+.25f,z) || Math.Abs(floor-a.Y)>1.4f)
            { x=a.X; z=a.Z; floor=a.Y; }
            Prop p=new Prop { Kind="pack", Model="pack", Label=id=="meal"?"Shared meal":"Dropped supplies",
                X=x,Z=z,Y=floor,Yaw=a.Yaw,Owner=a.Id,W=.6f,H=.45f,D=.45f };
            p.Bag[id]=1;
            if(id=="waterskin") {p.Water=Math.Min(SkinVolume,Math.Max(0,a.WaterCarried));a.WaterCarried-=p.Water;}
            if (id=="meat")
            {
                float progress=RemoveMeat(a);
                if (progress>0) p.FoodProgress.Add(progress);
            }
            else if(Armor.IsArmor(id)) Armor.PackOne(a,p,id);
            else a.Add(id,-1);
            if(a.Weapon==id && a.Count(id)==0) a.Weapon="fists";
            Arena.Register(g,p);
            g.Say("Dropped " + Label(id).ToLowerInvariant() + " for any survivor");
            return true;
        }
        public static void Restart(Game g)
        {
            Cancel(g); g.FocusProp=null; g.FocusAnimal=null; g.FocusChoice=0;
            g.FocusOptions.Clear(); g.CookingSites.Clear(); g.RainBarrels.Clear(); g.IndexedCookingProps=0; g.FocusShore=false; g.Hint="";
        }
        public static void Cancel(Game g)
        {
            StopAction(g);
            g.BuildId=""; g.BuildProblem=""; g.BuildTurned=false; g.Ghost=null; g.GhostFits=g.BuildJoined=false;
        }
        private static void StopAction(Game g)
        {
            g.ActionId=""; g.ActionArgument=""; g.ActionElapsed=0; g.ActionTotal=0;
            g.UseProp=null; g.UseAnimal=null; g.UseProgress=0;
        }
        public static bool ChooseCraft(Game g,string id)
        {
            Recipe r=Find(Crafts,id);
            if (r==null || g.Player==null || !g.Player.Alive) return false;
            if(!CanMake(g.Player,r)) { g.Say(Missing(g.Player,r)); return false; }
            Cancel(g); g.ActionId="craft"; g.ActionArgument=id; g.ActionTotal=.65f; g.Panel="";
            return true;
        }
        public static bool ChooseBuild(Game g,string id)
        {
            Recipe r=Find(Builds,id);
            if(r==null || g.Player==null || !g.Player.Alive) return false;
            if(!CanMake(g.Player,r)) { g.Say(Missing(g.Player,r)); return false; }
            Cancel(g); g.BuildId=id; g.BuildAngle=0; g.BuildTurned=false; g.Panel="";
            Preview(g);
            return true;
        }
        public static bool Rotate(Game g,int steps)
        {
            if(String.IsNullOrEmpty(g.BuildId)) return false;
            // Keep the orientation relative to sight until the user starts rotating.
            if(!g.BuildTurned) g.BuildAngle=g.Player.Yaw;
            float step=g.Ghost!=null&&g.Ghost.Fort!=null&&g.BuildJoined?(float)Math.PI/2f:(float)Math.PI/12f;
            if(g.BuildJoined&&g.Ghost!=null)g.BuildAngle=g.Ghost.Yaw;
            g.BuildTurned=true; g.BuildAngle+=steps*step;
            Preview(g);
            return true;
        }
        private static void Preview(Game g)
        {
            Actor a=g.Player;
            if(a==null || !a.Alive || String.IsNullOrEmpty(g.BuildId)) { g.Ghost=null; g.GhostFits=g.BuildJoined=false; return; }
            // Looking down pulls the piece in. A horizontal gaze places it a short step away.
            float reach=Math.Max(1.7f,Math.Min(3.9f,3.45f+g.Pitch*1.65f));
            float dx=(float)Math.Sin(a.Yaw), dz=(float)Math.Cos(a.Yaw);
            float x=a.X+reach*dx, z=a.Z+reach*dz;
            float yaw=g.BuildTurned?g.BuildAngle:a.Yaw;
            Prop p=Arena.PlayerFortPreview(g,a,g.BuildId,x,z,yaw,g.BuildTurned,out g.BuildJoined);
            g.Ghost=p;
            bool supported=p!=null&&Arena.HasFortSupport(g,p);
            g.GhostFits=supported && CanMake(a,Find(Builds,g.BuildId)) && Arena.BuildFits(g,p) && Arena.FortVisible(g,a,p);
            g.BuildProblem=g.GhostFits?"":!supported?"Needs a grounded support":"Needs clear space within reach";
            if(p!=null) { g.UseX=p.X; g.UseY=p.Y+.8f; g.UseZ=p.Z; }
        }
        public static bool Place(Game g){ return Place(g,!g.PadActive&&g.Down("Sprint")); }
        public static bool Place(Game g,bool repeat)
        {
            if(String.IsNullOrEmpty(g.BuildId) || g.Player==null || !g.Player.Alive) return false;
            Preview(g);
            if(!g.GhostFits) { g.Say(g.BuildProblem); return false; }
            Prop p=Build(g,g.Player,g.Ghost);
            if(p==null) {g.Say("That space is occupied"); return false;}
            g.Say(Label(g.BuildId)+" placed");
            if(repeat&&CanMake(g.Player,Find(Builds,g.BuildId)))Preview(g);
            else Cancel(g);
            return true;
        }
        private static bool Gate(Prop p)
        {
            return p!=null && (p.Kind=="gate" || (p.Kind=="structure" && p.Model=="gate"));
        }
        private static float UseAnchor(Prop p)
        {
            if(Gate(p)) return 1.05f;
            if(Barrel(p)) return .93f;
            if(p.Kind=="water") return .45f;
            if(p.Kind=="pickup")
            {
                if(p.Item=="spear")return .09f;
                if(p.Item=="knife"||p.Item=="hatchet"||p.Item=="sling")return .14f;
            }
            switch(p.Kind)
            {
                case "stove": return .85f;
                case "fire": return .5f;
                case "pack": return .26f;
                default: return .16f;
            }
        }
        private static bool Eligible(Prop p)
        {
            return !p.Removed && (p.Kind=="pickup" || p.Kind=="pack" || p.Kind=="remnant" || IsShelterFrame(p) || Fire(p) || Gate(p) || WaterSource(p));
        }
        struct InteractionRay
        {
            public float X,Y,Z,DX,DY,DZ;
            public InteractionRay(Game g)
            {
                Actor a=g.Player;bool camera=g.CameraTarget==a;
                X=camera?g.CamX:a.X;Y=camera?g.CamY:a.Y+(a.Crouch?1.03f:1.58f);Z=camera?g.CamZ:a.Z;
                float altitude=(float)Math.Cos(g.Pitch);
                DX=(float)Math.Sin(a.Yaw)*altitude;DY=(float)Math.Sin(g.Pitch);DZ=(float)Math.Cos(a.Yaw)*altitude;
            }
        }
        // Ground equipment is rotated onto its side in the world. Aiming at the visible
        // shaft or bow limb should select the same item as aiming at its grip.
        private static bool GearExtent(string id,out float min,out float max)
        {
            switch(id)
            {
                case "spear":min=-.74f;max=1.32f;return true;
                case "bow":min=-.64f;max=.70f;return true;
                case "sword":min=-.18f;max=.94f;return true;
                case "crossbow":min=-.42f;max=.58f;return true;
                case "shield":min=-.35f;max=.35f;return true;
                case "hatchet":min=-.18f;max=.31f;return true;
                case "knife":min=-.08f;max=.39f;return true;
                case "sling":min=-.035f;max=.49f;return true;
                default:min=max=0;return false;
            }
        }
        private static float SelectScore(Actor a,InteractionRay ray,float x,float y,float z,float extra,Prop item)
        {
            float dx=x-a.X,dz=z-a.Z,dist=(float)Math.Sqrt(dx*dx+dz*dz);
            if(dist>Reach+extra || Math.Abs(y-a.Y)>3.2f) return -100;
            float facing=dist<.08f?1:(dx*(float)Math.Sin(a.Yaw)+dz*(float)Math.Cos(a.Yaw))/dist;
            if(facing<(dist<.8f?-.1f:.57f)) return -100;
            float vx=x-ray.X,vy=y-ray.Y,vz=z-ray.Z;
            float along=vx*ray.DX+vy*ray.DY+vz*ray.DZ,min,max;
            if(item!=null&&item.Kind=="pickup"&&GearExtent(item.Item,out min,out max))
            {
                float sx=.99756f*(float)Math.Sin(item.Yaw),sz=.99756f*(float)Math.Cos(item.Yaw),sy=.06976f;
                float parallel=sx*ray.DX+sy*ray.DY+sz*ray.DZ,proj=sx*vx+sy*vy+sz*vz;
                float t=(parallel*along-proj)/Math.Max(.0001f,1-parallel*parallel);
                t=Math.Max(min*item.Scale,Math.Min(max*item.Scale,t));
                vx+=sx*t;vy+=sy*t;vz+=sz*t;along=vx*ray.DX+vy*ray.DY+vz*ray.DZ;
            }
            if(along>.025f)
            {
                float missSq=Math.Max(0,vx*vx+vy*vy+vz*vz-along*along),angularSq=missSq/(along*along);
                if(angularSq<.0529f)return 14f-30f*(float)Math.Sqrt(angularSq)-.012f*along;
            }
            // Facing a nearby item still works when the crosshair rests above all close targets.
            return facing*3.4f-dist*.37f;
        }
        private static bool Visible(Game g,Actor a,float x,float y,float z,Prop target)
        {
            float fromY=a.Y+(a.Crouch?1.03f:1.57f);
            float dx=x-a.X,dy=y-fromY,dz=z-a.Z;
            float dist=(float)Math.Sqrt(dx*dx+dy*dy+dz*dz);
            if(dist<.07f) return true;
            float limit=dist-.04f, hitDistance;
            Prop first=Arena.RayProp(g,a.X,fromY,a.Z,dx/dist,dy/dist,dz/dist,limit,out hitDistance);
            return hitDistance>=limit || (target!=null && first==target);
        }
        private static void Focus(Game g)
        {
            Actor a=g.Player; Prop target=null; Animal animal=null; float best=-99;
            InteractionRay ray=new InteractionRay(g);
            Arena.Near(g,a.X,a.Z,Reach+1,g.FocusNearby);
            for(int i=0;i<g.FocusNearby.Count;i++)
            {
                Prop p=g.FocusNearby[i];
                if(!Eligible(p)) continue;
                float extra=Gate(p)?.7f:0;
                float y=p.Y+UseAnchor(p);
                float score=SelectScore(a,ray,p.X,y,p.Z,extra,p);
                if(score<=best) continue;
                if(!Visible(g,a,p.X,y,p.Z,p)) continue;
                best=score; target=p; animal=null;
            }
            for(int i=0;i<g.Animals.Count;i++)
            {
                Animal v=g.Animals[i];
                if(v.Alive || v.Harvested) continue;
                float score=SelectScore(a,ray,v.X,v.Y+.22f,v.Z,.25f,null);
                if (score>best && Visible(g,a,v.X,v.Y+.25f,v.Z,null)) { best=score; target=null; animal=v; }
            }
            float waterX=0,waterZ=0;
            bool shore=target==null && animal==null && Math.Abs(a.Y-Arena.Ground(g,a.X,a.Z))<1.9f &&
                Arena.Shore(g,a.X,a.Z,out waterX,out waterZ);
            if(target!=g.FocusProp || animal!=g.FocusAnimal || shore!=g.FocusShore) g.FocusChoice=0;
            g.FocusShore=shore;
            g.FocusProp=target; g.FocusAnimal=animal; g.FocusOptions.Clear();
            if(target!=null)
            {
                g.UseX=target.X; g.UseY=target.Y+UseAnchor(target); g.UseZ=target.Z;
                if(Fire(target))
                {
                    if(target.HasMeat && target.Cook>=1) g.FocusOptions.Add("take");
                    if(!target.Lit && !Stove(target) && target.Fuel>0) g.FocusOptions.Add("light");
                    if(!target.HasMeat && (target.Lit || Stove(target)) && a.Count("meat")>0) g.FocusOptions.Add("cook");
                    if(target.HasMeat && target.Cook<1) g.FocusOptions.Add("take");
                    if(!Stove(target) && a.Count("branch")>0 && target.Fuel<=245) g.FocusOptions.Add("fuel");
                    if(!Stove(target) && target.Lit) g.FocusOptions.Add("extinguish");
                }
                else if(WaterSource(target)) WaterChoices(g,target);
                else if(Gate(target))
                {
                    if(!target.Latched)g.FocusOptions.Add("gate");
                    if(!target.Open&&Arena.TendsGate(g,a,target))g.FocusOptions.Add("latch");
                }
                else if(target.Kind!="remnant" && !IsShelterFrame(target)) g.FocusOptions.Add("pick");
            }
            else if(animal!=null)
            {
                g.UseX=animal.X; g.UseY=animal.Y+.42f; g.UseZ=animal.Z;
                g.FocusOptions.Add("harvest");
            }
            else if(shore)
            {
                g.UseX=waterX;g.UseZ=waterZ;g.UseY=Arena.Surface(waterX,waterZ,g.Flood)+.12f;
                WaterChoices(g,null);
            }
            if(g.FocusChoice>=g.FocusOptions.Count) g.FocusChoice=0;
        }
        private static string ActionLabel(Game g,string action,Prop p,Animal a)
        {
            if(action=="pick" && p!=null && p.Kind=="pickup" && p.Bag.Count>0 && !String.IsNullOrEmpty(p.Label))
                return "Pick up "+p.Label.ToLowerInvariant();
            switch(action)
            {
                case "light": return "Light fire";
                case "drink": return "Drink water";
                case "fill": return "Fill waterskin";
                case "pour": return "Pour water into barrel";
                case "fuel": return "Add wood";
                case "cook": return g.Player.FoodProgress.Count>0?"Resume cooking":"Cook game meat";
                case "extinguish": return "Put out fire";
                case "take": return p!=null && p.Cook>=1?"Take cooked meal":"Recover unfinished meat";
                case "gate": return p!=null && p.Open?"Close gate":"Open gate";
                case "latch": return p!=null && p.Latched?"Unbar gate":"Bar gate";
                case "pick": return p!=null && p.Kind=="pack"?"Loot " + (String.IsNullOrEmpty(p.Label)?"pack":p.Label.ToLowerInvariant()):
                    "Pick up " + (p==null ? "item" : Label(p.Item).ToLowerInvariant() + (p.Amount>1?" ×"+p.Amount:""));
                case "harvest": return "Harvest " + (a==null?"game":Wildlife.Name(a));
                case "craft": return "Craft " + Label(g.ActionArgument).ToLowerInvariant();
            }
            return "";
        }
        public static string Prompt(Game g)
        {
            if(g.Player==null || !g.Player.Alive) return "";
            if(!String.IsNullOrEmpty(g.BuildId))
            {
                string site=Label(g.BuildId);
                if(!g.GhostFits)site=String.IsNullOrEmpty(g.BuildProblem)?"Find a clear site":g.BuildProblem;
                else if(g.Ghost!=null&&g.Ghost.FortLevel>0)site+="  /  Level "+(g.Ghost.FortLevel+1);
                else if(g.BuildJoined)site+="  /  Ground joint";
                string place=g.GhostFits?"   ["+g.InputLabel("Place")+"] Place":"";
                return site+place+"   ["+g.InputLabel("Rotate")+"] Rotate   ["+g.InputLabel("Cancel")+"] Cancel";
            }
            if(!String.IsNullOrEmpty(g.ActionId)) return ActionLabel(g,g.ActionId,g.UseProp,g.UseAnimal);
            int count=g.FocusOptions.Count;
            Prop p=g.FocusProp;
            if(p!=null && p.Kind=="remnant") return "Emptied pack";
            if(IsShelterFrame(p))return ShelterFrameLabel;
            string status="";
            if(WaterSource(p) || g.FocusShore)
            {
                status=Barrel(p)?"Barrel "+Units(p.Water)+" / 160":g.FocusShore?Arena.WaterName(g.UseX,g.UseZ)+" bank":"Freshwater spring";
                if(count==0 && Barrel(p)) return status+"   |   Collects rain or fill from a waterskin";
            }
            if(Fire(p))
            {
                if(p.HasMeat) status=p.Cook>=1?"Ready":(p.Lit || Stove(p)?"Cooking ":"Paused ")+(int)(p.Cook*100)+"%";
                if(!Stove(p)) status+=(status.Length>0?"   ":"")+(p.Lit?"Burning ":"Cold ")+(int)Math.Ceiling(p.Fuel)+"s fuel";
                if(count==0)
                {
                    if(Stove(p)) return "Arena stove   ·   Bring game meat to cook";
                    if(p.Fuel<=0) return "Cold campfire   ·   Bring wood to refuel";
                }
            }
            if(count==0) return Gate(p)&&p.Latched?"Barred gate": "";
            string action=ActionLabel(g,g.FocusOptions[g.FocusChoice],p,g.FocusAnimal);
            return (status.Length==0?"":status+"   ·   ")+"["+g.InputLabel("Use")+"] "+action+
                (count>1?"    ["+g.InputLabel("Cycle")+"] Next action":"");
        }
        public static float Timing(Game g) { return g.UseProgress; }
        public static bool CycleUse(Game g,int step)
        {
            if(g.Player==null || !g.Player.Alive || g.ActionId!="") return false;
            Focus(g); int n=g.FocusOptions.Count;
            if(n<2) return false;
            g.FocusChoice=((g.FocusChoice+step)%n+n)%n; g.Hint=Prompt(g); return true;
        }
        public static bool BeginUse(Game g)
        {
            if(g.Player==null || !g.Player.Alive || g.ActionId!="") return false;
            if(!String.IsNullOrEmpty(g.BuildId)) return Place(g);
            Focus(g); if(g.FocusOptions.Count==0) return false;
            g.ActionId=g.FocusOptions[g.FocusChoice]; g.UseProp=g.FocusProp; g.UseAnimal=g.FocusAnimal;
            switch(g.ActionId)
            {
                case "harvest": g.ActionTotal=1.15f; break;
                case "light": g.ActionTotal=.85f; break;
                case "fuel": case "cook": g.ActionTotal=.48f; break;
                case "drink": g.ActionTotal=.5f;break;
                case "fill":case "pour":g.ActionTotal=.7f;break;
                case "pick": g.ActionTotal=g.UseProp.Kind=="pack"?.53f:.20f; break;
                default: g.ActionTotal=.30f; break;
            }
            g.ActionElapsed=0; g.UseProgress=.01f; g.Hint=Prompt(g); return true;
        }
        private static void CompleteAction(Game g)
        {
            string action=g.ActionId; string argument=g.ActionArgument;
            Prop p=g.UseProp; Animal a=g.UseAnimal; Actor player=g.Player;
            StopAction(g); g.FocusChoice=0;
            if(action=="craft")
            {
                if(Craft(g,player,argument))
                {
                    string result=argument=="fire"?"campfire kit":Label(argument).ToLowerInvariant();
                    g.Say("Crafted "+result+(Armor.IsArmor(argument) && player.WornArmor==argument?"  /  Equipped":""));
                    if(argument=="fire") ChooseBuild(g,"fire");
                }
                return;
            }
            if(action=="harvest") { Harvest(g,player,a); return; }
            if(action=="drink") {Drink(g,player,p);return;}
            if(action=="fill") {Fill(g,player,p);return;}
            if(action=="pour") {Pour(g,player,p);return;}
            if(p==null || p.Removed) return;
            if(action=="pick") { Take(g,player,p); return; }
            if(action=="gate"||action=="latch")
            {
                if(!Visible(g,player,p.X,p.Y+1,p.Z,p))return;
                if(action=="latch"){if(Arena.LatchGate(g,player,p))g.Say(p.Latched?"Gate barred":"Gate unbarred");}
                else {bool open=p.Open;Arena.ToggleGate(g,p);if(p.Open==open)g.Say(p.Latched?"Gate barred":"Doorway occupied");}
                g.SoundAt(player,7);return;
            }
            float oldCook=p.Cook;
            if(Tend(g,player,p,action))
            {
                string message=action=="cook"?"Meat on the fire":action=="take"?(oldCook>=1?"Cooked meal added to pack":"Saved cooking progress in pack"):
                    action=="extinguish"?"Fire extinguished":action=="fuel"?"Added wood to fire":"Fire lit";
                g.Say(message);
            }
        }
        private static void TickFires(Game g,float dt)
        {
            while(g.IndexedCookingProps<g.Props.Count)
            {
                Prop added=g.Props[g.IndexedCookingProps++]; if(Fire(added)) g.CookingSites.Add(added);
                else if(Barrel(added))g.RainBarrels.Add(added);
            }
            for(int i=g.RainBarrels.Count-1;i>=0;i--)
            {
                Prop barrel=g.RainBarrels[i];
                if(barrel.Removed){g.RainBarrels.RemoveAt(i);continue;}
                if(g.Rain && barrel.Water<BarrelVolume && CatchesRain(g,barrel))barrel.Water=Math.Min(BarrelVolume,barrel.Water+dt*RainRate);
            }
            for(int i=g.CookingSites.Count-1;i>=0;i--)
            {
                Prop p=g.CookingSites[i];
                if(p.Removed) {g.CookingSites.RemoveAt(i); continue;}
                if(Stove(p)) p.Lit=true;
                if(!p.Lit) continue;
                float burn=Stove(p)?dt:Math.Min(dt,p.Fuel);
                if(!Stove(p)) { p.Fuel=Math.Max(0,p.Fuel-burn); if(p.Fuel<=0) p.Lit=false; }
                if(p.HasMeat) p.Cook=Math.Min(1,p.Cook+burn/CookSeconds);
                p.Anim+=burn;
            }
        }
        public static void Tick(Game g,float dt)
        {
            TickFires(g,dt);
            TickInteraction(g,dt);
        }
        internal static void TickInteraction(Game g,float dt)
        {
            Actor a=g.Player;
            if(a==null || !a.Alive) {Cancel(g);g.Hint="";return;}
            if(g.BuildId!="") { Preview(g);g.Hint=Prompt(g);return; }
            if(g.ActionId=="")
            {
                Focus(g); g.Hint=Prompt(g); return;
            }
            Prop p=g.UseProp; Animal animal=g.UseAnimal;
            if(p!=null && (p.Removed || !InReach(a,p.X,p.Z,Gate(p)?.8f:.35f)) ||
                animal!=null && (animal.Harvested || !InReach(a,animal.X,animal.Z,.35f)))
            { StopAction(g); Focus(g); g.Hint=Prompt(g); return; }
            if(p!=null) {g.UseX=p.X;g.UseY=p.Y+UseAnchor(p);g.UseZ=p.Z;}
            else if(animal!=null) {g.UseX=animal.X;g.UseY=animal.Y+.42f;g.UseZ=animal.Z;}
            else if(g.ActionId=="craft") {g.UseX=a.X+(float)Math.Sin(a.Yaw)*1.5f;g.UseY=a.Y+1.25f;g.UseZ=a.Z+(float)Math.Cos(a.Yaw)*1.5f;}
            g.ActionElapsed+=dt;
            g.UseProgress=Math.Min(1,Math.Max(.01f,g.ActionElapsed/Math.Max(.01f,g.ActionTotal)));
            if(g.ActionElapsed>=g.ActionTotal) { CompleteAction(g); if(g.BuildId=="") Focus(g); }
            g.Hint=Prompt(g);
        }
    }
}
