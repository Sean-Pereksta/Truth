using System;

namespace LastSignal {
    public struct Footprint {
        public Actor Maker;
        public float X,Y,Z,Yaw,Time,Life;
        public bool Left;
    }

    public partial class Game {
        public readonly Footprint[] Tracks=new Footprint[420];

        struct TrackOrigin {
            public float X,Z;
            public bool Left;
        }

        readonly TrackOrigin[] trackOrigins=new TrackOrigin[24];
        float trackClock;
        int writeTrack;

        internal void ResetTracks() {
            writeTrack=0;
            trackClock=0;
            Array.Clear(Tracks,0,Tracks.Length);
            Array.Clear(trackOrigins,0,trackOrigins.Length);
            foreach(Actor actor in Actors) {
                if(actor.Id<0||actor.Id>=trackOrigins.Length)continue;
                trackOrigins[actor.Id]=new TrackOrigin{X=actor.X,Z=actor.Z};
            }
        }

        internal void RecordTracks(float dt) {
            trackClock-=dt;
            if(trackClock>0)return;
            trackClock=.45f;
            foreach(Actor actor in Actors) {
                if(!actor.Alive||actor.Id<0||actor.Id>=trackOrigins.Length)continue;
                TrackOrigin origin=trackOrigins[actor.Id];
                float dx=actor.X-origin.X,dz=actor.Z-origin.Z;
                float stride=actor.Sprint?3f:2.25f;
                if(dx*dx+dz*dz<stride*stride)continue;
                origin.X=actor.X;origin.Z=actor.Z;
                trackOrigins[actor.Id]=origin;
                if(actor.X*actor.X+actor.Z*actor.Z<=22*22||actor.Crouch||actor.Speed<.2f||
                    actor.Y>Arena.Ground(this,actor.X,actor.Z)+.32f||Arena.WetDepth(this,actor.X,actor.Z)>.055f)continue;
                if(Arena.Cover(this,actor.X,actor.Z)>.70f||Arena.Path(actor.X,actor.Z)>.86f&&!actor.Sprint)continue;
                origin.Left=!origin.Left;
                trackOrigins[actor.Id]=origin;
                float yaw=(float)Math.Atan2(dx,dz),side=origin.Left?.09f:-.09f;
                float x=actor.X+(float)Math.Cos(yaw)*side,z=actor.Z-(float)Math.Sin(yaw)*side;
                float y=Arena.Height(x,z);
                if(Math.Abs(Arena.GroundBelow(this,x,z,actor.Y+.09f)-y)>.10f)continue;
                Tracks[writeTrack]=new Footprint{Maker=actor,X=x,Y=y+.026f,Z=z,Yaw=yaw,Time=Time,
                    Life=(actor.Sprint?67:40)*(Rain?.47f:1),Left=origin.Left};
                writeTrack=(writeTrack+1)%Tracks.Length;
            }
        }
    }
}
