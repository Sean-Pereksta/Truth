using System;

namespace LastSignal {
    public partial class Game {
        public const float GuardStart=.045f, ParryEnd=.22f, BlockEnd=.46f;
        public const float DodgeDuration=.42f, DodgeTravelTime=.24f;
        const float GuardRearm=.50f, DodgeEvadeTime=.16f, DodgeDistance=1.55f;
        // Dot products against the full view direction, including elevation.
        const float ParryCos=.90631f, DeflectCos=.74314f;

        internal static void SetGuard(Actor a,bool raised){
            if(!raised){a.Guard=false;return;}
            if(a.Guard||a.GuardRecovery>0||a.Stamina<6||a.DodgeTime>.12f)return;
            a.Guard=true;a.GuardTime=0;a.GuardSpent=false;
            a.GuardRecovery=GuardRearm;a.Stamina-=3;
        }
        // The input edge and movement both sample the current stick/keys. A strafe
        // pressed together with dodge must work even before the next movement tick.
        void MovementDirection(out float x,out float z,out float forward){
            forward=PadActive?PadMoveY:(Down("Forward")?1:0)-(Down("Back")?1:0);
            float right=PadActive?PadMoveX:(Down("Right")?1:0)-(Down("Left")?1:0);
            float n=(float)Math.Sqrt(forward*forward+right*right);
            if(n>1){forward/=n;right/=n;}
            float sy=(float)Math.Sin(Player.Yaw),cy=(float)Math.Cos(Player.Yaw);
            x=sy*forward+cy*right;z=cy*forward-sy*right;
        }
        public static bool Evading(Actor a){return a.DodgeTime>DodgeDuration-DodgeEvadeTime;}
        public static bool DodgeMoving(Actor a){return a.DodgeTime>DodgeDuration-DodgeTravelTime;}
        static float DodgeProgress(float remaining){
            float t=Math.Min(1,Math.Max(0,(DodgeDuration-remaining)/DodgeTravelTime));
            return t*(2-t);
        }
        void StepDefense(Actor a,float dt){
            if(!a.Alive)return;
            a.GuardRecovery=Math.Max(0,a.GuardRecovery-dt);
            if(a.Guard)a.GuardTime=Math.Min(5,a.GuardTime+dt);
            if(a.DodgeTime<=0)return;
            float earlier=a.DodgeTime;
            a.DodgeTime=Math.Max(0,a.DodgeTime-dt);
            float step=DodgeDistance*(DodgeProgress(a.DodgeTime)-DodgeProgress(earlier));
            if(step<=0)return;
            Arena.Move(this,a,step*a.DodgeDX,step*a.DodgeDZ);
        }
        void PlayerDodge(){
            float x,z,forward;MovementDirection(out x,out z,out forward);
            if(x*x+z*z<.01f){x=-(float)Math.Sin(Player.Yaw);z=-(float)Math.Cos(Player.Yaw);}
            Dodge(Player,x,z);
        }
        public void Dodge(Actor a,float dx,float dz){
            if(a==null||!a.Alive||a.DodgeTime>0)return;
            if(a.Stamina<21){if(a==Player)Say("Dodge needs 21 stamina");return;}
            float n=(float)Math.Sqrt(dx*dx+dz*dz);if(n<.01f)return;
            a.Stamina-=21;a.DodgeDX=dx/n;a.DodgeDZ=dz/n;a.DodgeTime=DodgeDuration;
            a.Guard=a.Aiming=a.Throwing=false;a.DrawPower=a.Windup=a.Swing=0;
            a.ProjectileId="";a.SpearThrust=a.ShoveStroke=a.MeleeStroke=false;
            a.NextAttack=Math.Max(a.NextAttack,.30f);
            if(a==Player){guardHeld=false;bufferedWeapon="";Charging=false;Charge=0;}
            Cue("step",a.X,a.Z,12);SoundAt(a,12);
        }

        enum GuardOutcome { Miss, Deflect, Parry }
        GuardOutcome Defend(Actor a,ImpactSite hit,float yaw,float pitch,bool ranged,ref float damage){
            if(!a.Guard||a.GuardSpent||Ranged(a))return GuardOutcome.Miss;
            float look=a==Player?Pitch:a.GuardPitch;
            float alignment=(float)(Math.Cos(look)*Math.Cos(pitch)*Math.Cos(a.Yaw-yaw)+Math.Sin(look)*Math.Sin(pitch));
            if(a.GuardTime<GuardStart||a.GuardTime>BlockEnd||alignment<DeflectCos){
                if(a==Player)Say(alignment<DeflectCos?"Guard missed their line":a.GuardTime>BlockEnd?"Guard was too early":"Guard was too late");
                return GuardOutcome.Miss;
            }
            bool perfect=a.GuardTime<=ParryEnd&&alignment>=ParryCos;
            float cost=perfect?(ranged?7:4):damage*(ranged?.70f:.55f);
            a.GuardSpent=true;
            if(a.Stamina<cost){
                a.Stamina=0;a.Guard=false;
                a.GuardRecovery=Math.Max(.33f,a.GuardRecovery);
                if(a==Player){guardHeld=false;Say("Guard broken");}
                return GuardOutcome.Miss;
            }
            a.Stamina-=cost;
            damage*=perfect?0:ranged?.55f:.32f;
            EmitImpact(hit,0,false,true,perfect,false);
            if(a==Player)Say(perfect?"Timed guard  ·  Opening":"Deflected");
            return perfect?GuardOutcome.Parry:GuardOutcome.Deflect;
        }
        GuardOutcome GuardStrike(Actor defender,Actor attacker,ImpactSite hit,bool ranged,bool shieldHit,ref float damage){
            if(CarriesShield(defender))return shieldHit?BlockShield(defender,hit,ranged,ref damage):GuardOutcome.Miss;
            if(!defender.Guard)return GuardOutcome.Miss;
            float yaw,pitch;
            if(ranged){
                yaw=(float)Math.Atan2(-hit.DX,-hit.DZ);
                pitch=(float)Math.Atan2(-hit.DY,Math.Sqrt(hit.DX*hit.DX+hit.DZ*hit.DZ));
            }else{
                float dx=attacker.X-defender.X,dz=attacker.Z-defender.Z;
                float distance=Math.Max(.15f,(float)Math.Sqrt(dx*dx+dz*dz));
                yaw=(float)Math.Atan2(dx,dz);
                float hand=attacker.Y+(attacker.Crouch?.90f:1.38f);
                float eye=defender.Y+(defender.Crouch?1.03f:1.58f);
                pitch=(float)Math.Atan2(hand-eye,distance);
                // A cut approaches from the loading shoulder. A spear's point is central.
                if(hit.Implement=="hatchet"||hit.Implement=="knife"||hit.Implement=="sword"){
                    yaw+=attacker.MeleeSide*(float)Math.Atan2(.22f,distance);
                    if(hit.Implement=="hatchet")pitch+=.065f;
                }
            }
            return Defend(defender,hit,yaw,pitch,ranged,ref damage);
        }
    }
}
