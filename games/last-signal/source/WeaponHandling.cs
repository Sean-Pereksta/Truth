using System;

namespace LastSignal {
    public partial class Game {
        static readonly string[] belt={"knife","spear","bow","hatchet","sling"};
        string switchTo="",bufferedWeapon="";
        float bufferedUntil,bufferedPower;
        bool guardHeld;

        public static string PeekWeapon(Actor a,int direction){
            if(a==null)return "fists";
            return NextCarried(a,a.Weapon,direction);
        }
        static string NextCarried(Actor a,string current,int direction){
            int index=Array.IndexOf(belt,current),step=direction<0?-1:1;
            if(index<0)index=step<0?0:-1;
            for(int i=1;i<=belt.Length;i++){
                string id=belt[(index+i*step+belt.Length*2)%belt.Length];
                if(a.Count(id)>0)return id;
            }
            return "fists";
        }
        public void CycleWeapon(int direction){
            if(Player==null||!CanAct)return;
            RequestWeapon(NextCarried(Player,switchTo.Length==0?Player.Weapon:switchTo,direction));
        }
        public bool RequestWeapon(string id){
            Actor a=Player;
            if(Mode!="match"||a==null||!a.Alive)return false;
            if(id!="fists"&&(Array.IndexOf(belt,id)<0||a.Count(id)==0)){Say("No "+Survival.Label(id).ToLowerInvariant()+" in pack");return false;}
            if(id==a.Weapon){switchTo="";return true;}
            // An attack that has committed gets its contact before the weapon changes.
            // A held draw can still be lowered without spending an arrow.
            Charging=false;Charge=0;bufferedWeapon="";guardHeld=false;
            a.Guard=a.Aiming=false;
            if(a.Windup<=0){a.Throwing=false;a.DrawPower=0;}
            switchTo=id;ResolveSwitch(a);
            return true;
        }
        void ResolveSwitch(Actor a){
            if(switchTo.Length==0||a.Windup>0||a.Swing>a.SwingSpan*.49f)return;
            string id=switchTo;switchTo="";
            if(id!="fists"&&a.Count(id)==0)return;
            Survival.EquipActor(a,id);
            a.MeleeStroke=a.ShoveStroke=a.LastThrow=a.SpearThrust=false;
            a.Swing=0;a.DrawPower=0;a.NextAttack=Math.Max(.14f,a.NextAttack);
            Cue("focus_equip",a.X,a.Z,10);Say("Equipped "+Survival.Label(id).ToLowerInvariant());
        }
        void CancelAttackInput(){switchTo=bufferedWeapon="";bufferedUntil=bufferedPower=0;guardHeld=false;}
        void FinishMeleeInput(Actor a){
            float power=a.DrawPower;
            if(a.NextAttack<=0&&a.Windup<=0){Attack(a,Charge>.32f,Pitch);return;}
            if(a.Windup<=0&&a.NextAttack<=.23f){
                bufferedWeapon=a.Weapon;bufferedPower=power;bufferedUntil=Time+.25f;
            }
        }
        void PlayerFollowThrough(){
            Actor a=Player;
            if(a==null||!a.Alive||!CanAct)return;
            ResolveSwitch(a);
            if(guardHeld&&!a.Guard&&!a.Aiming&&!Charging&&a.Windup<=0&&a.Swing<a.SwingSpan*.42f&&a.DodgeTime<=.12f){
                if(Ranged(a))a.Aiming=true;
                else SetGuard(a,true);
            }
            if(bufferedWeapon.Length==0)return;
            if(bufferedUntil<Time||a.Weapon!=bufferedWeapon||a.Guard||switchTo.Length>0){bufferedWeapon="";return;}
            if(a.NextAttack>0||a.Windup>0)return;
            bufferedWeapon="";a.DrawPower=bufferedPower;Attack(a,bufferedPower>.32f/.72f,Pitch);
        }
        public static float ShotSpeed(string projectile,float power){
            return projectile=="arrow"?18+22*power:projectile=="spear"?13+17*power:34+8*power;
        }
        public static float ShotGravity(string projectile){return projectile=="arrow"?14.4f:projectile=="spear"?10.5f:7;}

        public void WildHit(Animal hunter,Actor a,float damage){
            if(hunter==null||a==null||!a.Alive||Winner!=null||Evading(a))return;
            float dx=a.X-hunter.X,dz=a.Z-hunter.Z,d=Math.Max(.001f,Distance(hunter.X,hunter.Z,a.X,a.Z));dx/=d;dz/=d;
            ImpactSite site=new ImpactSite(a.X-dx*.27f,a.Y+.88f,a.Z-dz*.27f,dx,0,dz,"claw");
            float yaw=(float)Math.Atan2(-dx,-dz);
            float pitch=(float)Math.Atan2(hunter.Y+Wildlife.Height(hunter)-(a.Y+(a.Crouch?1.03f:1.58f)),d);
            GuardOutcome guard=Defend(a,site,yaw,pitch,false,ref damage);
            if(guard!=GuardOutcome.Miss){
                bool parry=guard==GuardOutcome.Parry;
                Cue((a==Player?"focus_":"")+(parry?"parry":"guard"),a.X,a.Z,22);
                if(parry)return;
            }
            damage=Armor.Absorb(this,a,damage,site);
            a.Health-=damage;a.Hurt=.42f;a.HitDirection=(float)Math.Atan2(dx,dz);a.HitStrength=Math.Min(1,damage/32f);
            EmitImpact(site,damage,damage>24,false,false,false);
            Cue((a==Player?"focus_":"")+ContactSound(site,damage>24),a.X,a.Z,20);
            ReportInjury(a,(float)Math.Atan2(-dx,-dz),damage);
            if(a.Health<=0)Eliminate(a,null," was taken by "+Wildlife.Name(hunter));
        }
    }
}
