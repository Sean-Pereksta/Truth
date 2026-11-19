using System;

namespace LastSignal {
    public partial class Game {
        internal string StrideSound(Actor a,bool wet) {
            Prop surface=Arena.WalkSurface(this,a.X,a.Y,a.Z);
            if(surface!=null && (surface.Model=="floor" || surface.Model=="ramp"))return "plank_step";
            return wet?"splash":"step";
        }

        internal void FortCrash(Prop origin,int count) {
            if(count<=0 || origin==null)return;
            float range=Math.Min(43,23+count*2);
            Cue(count==1?"timber_break":"timber_fall",origin.X,origin.Z,range);
            Noises.Add(new Noise{Source=-1,X=origin.X,Y=origin.Y+Math.Min(1f,origin.H*.6f),Z=origin.Z,Range=range,Time=Time});
        }
    }
}
