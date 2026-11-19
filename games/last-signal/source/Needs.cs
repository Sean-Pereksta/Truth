using System;

namespace LastSignal {
    public partial class Game {
        public float Sip(Actor a,float available){
            if(a==null||!a.Alive||available<=0)return 0;
            float amount=Math.Min(Math.Min(40,available),Math.Max(0,100-a.Hydration));
            a.Hydration+=amount;return amount;
        }
        public float Mobility(Actor a){return 1-.34f*a.NeedStrain;}
        public float VisibilityFactor(Actor a){return 1-.22f*a.NeedStrain;}
        public float EffectiveFov(){
            float baseFov=Settings.Fov;
            if(CameraTarget==null||!CameraTarget.Alive||(Mode!="match"&&Mode!="spectate"))return baseFov;
            return baseFov*(1-.12f*CameraTarget.NeedStrain);
        }
        // Strain accumulates gradually, with each deficit independently able to
        // slow a contestant. Eating or drinking allows a short recovery period.
        internal string AdvanceNeeds(Actor a,float dt){
            float foodRate=HungerLevel==0?.036f:HungerLevel==2?.082f:.058f;
            a.Hunger=Math.Max(0,a.Hunger-dt*foodRate*(a.Sprint?1.28f:1f));
            a.Hydration=Math.Max(0,a.Hydration-dt*.069f*(a.Sprint?1.33f:1f));
            float hungry=Math.Max(0,1-a.Hunger/35f),thirsty=Math.Max(0,1-a.Hydration/38f);
            float target=Math.Min(1,.82f*Math.Max(hungry,thirsty)+.25f*Math.Min(hungry,thirsty));
            if(target>a.NeedStrain) a.NeedStrain=Math.Min(target,a.NeedStrain+dt/95f);
            else a.NeedStrain=Math.Max(target,a.NeedStrain-dt/45f);
            if(!a.Sprint&&a.NextAttack<=.18f&&a.DodgeTime<=0)
                a.Stamina=Math.Min(100,a.Stamina+dt*11*(1-.71f*a.NeedStrain)*(a.Guard?.37f:1));
            a.EmptyFoodTime=a.Hunger<=0?a.EmptyFoodTime+dt:0;
            a.EmptyWaterTime=a.Hydration<=0?a.EmptyWaterTime+dt:0;
            float starvation=a.EmptyFoodTime<=12?0:.27f+.22f*Math.Min(1,(a.EmptyFoodTime-12)/120);
            float dehydration=a.EmptyWaterTime<=10?0:.43f+.33f*Math.Min(1,(a.EmptyWaterTime-10)/90);
            a.Health-=dt*(starvation+dehydration);
            if(a.Health>0)return null;
            return dehydration>starvation?" succumbed to thirst":starvation>0?" succumbed to starvation":null;
        }
    }
}
