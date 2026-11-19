using System;

namespace LastSignal {
    public partial class Game {
        public int ArenaId;
        int nextStandardArena,announcedPhase=-1,announcedDay=-1;
        bool announcedNight;
        const float DayLength=720;
        // Each closure has a warning, a travel window and a period in the new eye.
        // Radii are measured from the same plaza that players can see at the start.
        static readonly float[] warnings={1000,1245,1445,1600,1730,1830,1900};
        static readonly float[] starts={1040,1280,1480,1630,1755,1850,1915};
        static readonly float[] stops={1170,1380,1550,1695,1815,1880,1940};
        static readonly float[] radii={151,105,68,40,19,7,0};
        public int DayNumber {get{return 1+(int)(Time/DayLength);}}
        public float Daylight {
            get{
                float hour=Time%DayLength;
                if(hour<=350)return 1;
                if(hour>=450&&hour<=620)return 0;
                float t=hour<450?(450-hour)/100:(hour-620)/100;
                return t*t*(3-2*t);
            }
        }
        public bool IsNight {get{return Daylight<.34f;}}
        public int StormPhase {get;private set;}
        public float StormX {get{return 0;}}
        public float StormZ {get{return 0;}}
        public float StormNextX {get{return 0;}}
        public float StormNextZ {get{return 0;}}
        public float StormRadius {get{return SafeRadius;}}
        public float StormNextRadius {get;private set;}
        public float StormSecondsRemaining {get;private set;}
        public bool StormWarning {get;private set;}
        public bool StormMoving {get;private set;}
        public bool StormActive {get{return Time>=starts[0];}}
        public float StormMargin(float x,float z){return StormRadius-Distance(x,z,StormX,StormZ);}
        public float StormStrength {get{return StormActive?Math.Min(1,.24f+.11f*(StormPhase-1)):0;}}
        void ResetClimate(){
            announcedPhase=-1;announcedDay=1;announcedNight=false;
            StormPhase=0;StormWarning=StormMoving=false;StormNextRadius=Arena.Radius+1;StormSecondsRemaining=0;
        }
        void ClimateStep(){
            int p=-1;for(int i=0;i<warnings.Length&&Time>=warnings[i];i++)p=i;
            StormPhase=p+1;StormWarning=p>=0&&Time<starts[p];StormMoving=p>=0&&Time>=starts[p]&&Time<stops[p];
            StormNextRadius=p<0?Arena.Radius+1:radii[p];
            float before=p<=0?Arena.Radius+1:radii[p-1];
            SafeRadius=p<0?before:before+(radii[p]-before)*Math.Max(0,Math.Min(1,(Time-starts[p])/(stops[p]-starts[p])));
            StormSecondsRemaining=p<0?0:StormWarning?starts[p]-Time:StormMoving?stops[p]-Time:p+1<warnings.Length?warnings[p+1]-Time:0;
            if(announcedDay!=DayNumber){announcedDay=DayNumber;EventText="Dawn  ·  Day "+DayNumber;EventTime=5;}
            if(announcedNight!=IsNight){
                announcedNight=IsNight;
                if(IsNight){EventText="Nightfall  ·  Firelight carries across open ground";EventTime=5;}
            }
            if(p<0)return;
            int stage=p*3+(StormWarning?0:StormMoving?1:2);
            if(stage==announcedPhase)return;
            announcedPhase=stage;
            if(StormWarning)Signal("Storm warning  ·  Next safe radius "+(int)radii[p]+" m",7);
            else if(StormMoving)Signal(p==radii.Length-1?"Final storm  ·  The last eye is closing":"Storm closing  ·  Move toward the Cornucopia",6);
        }
        bool StormDamage(Actor a,float dt){
            if(!StormActive)return false;
            float depth=-StormMargin(a.X,a.Z);
            if(depth<=0&&Time<stops[stops.Length-1])return false;
            float severity=.7f+.22f*StormPhase+.025f*Math.Min(40,Math.Max(0,depth));
            a.Health-=severity*dt;
            return a.Health<=0;
        }
        void LoadArena(){
            Arena.Select(ArenaId); Arena.Populate(this); Wildlife.PopulateBiome(this);
            SeededPropCount=Props.Count;OnlinePresentationPacks=null;
        }
    }
}
