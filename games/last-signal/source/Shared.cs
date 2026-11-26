using System;
using System.Collections.Generic;
using System.Windows.Forms;

namespace LastSignal {
    public class Actor {
        public int Id, Kills, Placement, TeamColor;
        public string Name="", Style="hunter", Weapon="fists", State="idle";
        public float X,Y,Z,Yaw,Health=100,Stamina=100,Hunger=90,Speed, GuardTime, DodgeTime, Swing, Windup, Hurt, NextAttack, Anim, Vertical;
        internal float ShieldWear;
        internal List<float> SpareShieldWear;
        public float Hydration=92,WaterCarried,NeedStrain,EmptyFoodTime,EmptyWaterTime;
        public float DrawPower,ProjectilePower,WindupSpan,ActionPitch;
        public const float CrossbowReloadTime=4f;
        public bool CrossbowLoaded;
        public float CrossbowReload;
        public bool Throwing,LastThrow,SpearThrust;
        public float SwingSpan=.36f,AttackCharge,GuardBlend;
        public float GuardRecovery,GuardPitch,DodgeDX,DodgeDZ;
        public bool GuardSpent;
        public int MeleeSide=1;
        public bool MeleeStroke,ShoveStroke;
        public float FellAt,FallYaw,FallSlope;
        internal float TruceGestureAt=-10;
        internal bool TruceAccepted;
        public const float PickupDuration=.38f;
        public float PickupLift;
        public Prop PickupSource;
        public string LiftedWeapon="";
        public void LiftWeapon(Prop source,string weapon) {
            PickupSource=source;LiftedWeapon=weapon;PickupLift=PickupDuration;
        }
        public float HitDirection,HitStrength;
        public string ActionWeapon="fists",ProjectileId="";
        public bool Alive=true, Guard, Crouch, Sprint, Heavy, Aiming, Winded;
        public Dictionary<string,int> Bag=new Dictionary<string,int>();
        public List<float> FoodProgress=new List<float>();
        internal readonly List<ArmorPiece> ArmorPieces=new List<ArmorPiece>();
        internal ArmorPiece EquippedArmor;
        public string WornArmor { get { return EquippedArmor==null?"":EquippedArmor.Id; } }
        internal ArmorPiece ArmorAtDeath;
        internal Prop FallenPack;
        public string FallenArmor {
            get {
                return ArmorAtDeath!=null && FallenPack!=null && !FallenPack.Removed &&
                    FallenPack.PackedArmor.Contains(ArmorAtDeath)?ArmorAtDeath.Id:"";
            }
        }
        public int Count(string item) { int v; return Bag.TryGetValue(item,out v)?v:0; }
        public void Add(string item,int amount) {
            if(Armor.IsArmor(item))Armor.Adjust(this,item,amount);
            else if(item=="shield")Game.AdjustShields(this,amount);
            else {
                int remaining=Math.Max(0,Count(item)+amount);
                Bag[item]=remaining;
                if(remaining==0&&(item=="crossbow"||item=="bolts")) {
                    CrossbowLoaded=false;
                    CrossbowReload=0;
                }
            }
        }
    }
    public class Prop {
        public float FelledAt=-100f,FellDirection,BarkReadyAt;
        public int Stripped;
        public string Model="",Item="",Kind="decor",Label="";
        public float X,Y,Z,Yaw,Scale=1,W=1,H=1,D=1,HP=100,MaxHP=100,Fuel,Cook,Anim;
        public float Water;
        public int Amount=1,Owner=-1; public bool Solid,Opaque,Removed,Open,Lit,HasMeat;
        public Prop Support;
        internal Arena.FortFrame Fort;
        public int FortLevel;
        internal List<ArmorPiece> PackedArmor;
        internal List<float> PackedShieldWear;
        public bool Latched;
        public Dictionary<string,int> Bag=new Dictionary<string,int>();
        public List<float> FoodProgress=new List<float>();
    }
    public class Animal {
        public string Model="hare",State="idle"; public float X,Y,Z,Yaw,HP=30,Anim,Timer,Alert; public bool Alive=true,Harvested;
    }
    public class Effect {
        public string Type; public float X,Y,Z,Time,Life=1,DX,DY,DZ; public int Color;
    }
    public class Noise {
        public string Activity;
        public float Y=float.NaN;
        public int Source; public float X,Z,Range,Time;
    }
    public class Shot {
        public Actor Owner; public float X,Y,Z,DX,DY,DZ,Life,Age,Damage,Gravity=7; public string Model;
    }
    public partial class Config {
        public int Bots=23,Difficulty=1,Hunger=1,ArenaId=0; public bool Events=true;
        public float Sensitivity=1,Fov=77,Bob=.4f;
        public Dictionary<string,Keys> KeysMap = new Dictionary<string,Keys>();
        public Config() {
            string[] names={"Forward","Back","Left","Right","Sprint","Crouch","Jump","Use","Dodge","Shove","Craft","Build","Pack","Rotate","Cycle","Dismiss","Lean left","Lean right","Attack","Guard"};
            Keys[] keys={Keys.W,Keys.S,Keys.A,Keys.D,Keys.ShiftKey,Keys.ControlKey,Keys.Space,Keys.E,Keys.Q,Keys.V,Keys.C,Keys.B,Keys.Tab,Keys.R,Keys.F,Keys.H,Keys.Z,Keys.X,Keys.LButton,Keys.RButton};
            for(int i=0;i<names.Length;i++) KeysMap[names[i]]=keys[i];
            KeysMap["Throw"]=Keys.T;
            KeysMap["Previous weapon"]=Keys.OemOpenBrackets;KeysMap["Next weapon"]=Keys.OemCloseBrackets;
            for(int i=0;i<7;i++)KeysMap["Weapon "+(i+1)]=(Keys)((int)Keys.D1+i);
        }
    }
    public partial class Game {
        public Config Settings=new Config();
        public Random Rng=new Random();
        public List<Actor> Actors=new List<Actor>(); public List<Animal> Animals=new List<Animal>();
        public List<Prop> Props=new List<Prop>(); public List<Effect> Effects=new List<Effect>();
        public List<Noise> Noises=new List<Noise>(); public List<Shot> Shots=new List<Shot>();
        public Actor Player,CameraTarget,Winner;
        public string Mode="menu",Panel="",Notice="",EventText="",Hint="",Zone="",KillFeed="";
        public float Time,Clock,Countdown,SafeRadius=Arena.Radius+1,NoticeTime,EventTime,FeedTime,CamX,CamY,CamZ,CamYaw,CamPitch,Pitch,UseProgress,UseX,UseY,UseZ,Charge,MoveX,MoveZ;
        public bool Flood, Rain, Dismissed,Quit,Ready,Charging; public int AliveCount,Seed,SpectateIndex;
        public static float Distance(float x,float z,float a,float b) {float dx=x-a,dz=z-b;return (float)Math.Sqrt(dx*dx+dz*dz);}
        public string InputLabel(string action) {
            if(PadActive){
                if(action=="Place")return ArenaPad.Label(this,"Place");
                if(action=="Rotate")return "LB / RB";
                if(action=="Cancel")return "B";
                return ArenaPad.Label(this,action);
            }
            if(action=="Place")action="Attack";if(action=="Cancel")return "Esc";
            Keys k;if(!Settings.KeysMap.TryGetValue(action,out k))return action;
            switch(k){case Keys.LButton:return "LMB";case Keys.RButton:return "RMB";case Keys.MButton:return "MMB";
                case Keys.ShiftKey:return "Shift";case Keys.ControlKey:return "Ctrl";case Keys.Return:return "Enter";}
            return k.ToString();
        }
        public void Say(string text) { Notice=text; NoticeTime=3.1f; }
        public void SoundAt(Actor a,float range,string activity=null) { Noises.Add(new Noise{X=a.X,Y=a.Y+.79f,Z=a.Z,Source=a.Id,Range=range,Time=Time,Activity=activity}); }
    }
}
