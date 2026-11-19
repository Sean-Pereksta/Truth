using System;
using System.Runtime.CompilerServices;

namespace LastSignal
{
    public static class Wildlife
    {
        enum Kind { Small, Bird, Herd, Dangerous }
        sealed class Species
        {
            public readonly string Model, Label;
            public readonly float Hp, Height, Radius, Speed;
            public readonly int Meat;
            public readonly Kind Family;
            public Species(string model,string label,Kind family,int hp,float height,float radius,int meat,float speed)
            { Model=model;Label=label;Family=family;Hp=hp;Height=height;Radius=radius;Meat=meat;Speed=speed; }
        }
        static readonly Species[] animals={
            new Species("hare","woodland hare",Kind.Small,17,.29f,.26f,1,4.55f),
            new Species("hen","reed hen",Kind.Bird,16,.39f,.24f,2,3.65f),
            new Species("grazer","ridge grazer",Kind.Herd,52,1.01f,.47f,3,5.15f),
            new Species("boar","brush boar",Kind.Dangerous,94,.69f,.45f,4,5.5f),
            new Species("jackrabbit","black-tailed jackrabbit",Kind.Small,17,.34f,.27f,1,5.15f),
            new Species("quail","crest quail",Kind.Bird,15,.25f,.20f,2,3.95f),
            new Species("bighorn","mesa bighorn",Kind.Herd,60,.96f,.44f,3,4.85f),
            new Species("cougar","canyon cougar",Kind.Dangerous,78,.69f,.43f,3,6.35f),
            new Species("marmot","alpine marmot",Kind.Small,22,.30f,.31f,1,3.6f),
            new Species("ptarmigan","snow ptarmigan",Kind.Bird,17,.31f,.23f,2,3.7f),
            new Species("caribou","pass caribou",Kind.Herd,64,1.22f,.52f,4,5.5f),
            new Species("wolf","timber wolf",Kind.Dangerous,76,.73f,.42f,3,5.9f)
        };
        static Species Info(Animal a)
        {
            for(int i=0;i<animals.Length;i++)if(animals[i].Model==a.Model)return animals[i];
            return animals[0];
        }
        public static string Name(Animal a){return Info(a).Label;}
        public static float Height(Animal a){return Info(a).Height;}
        public static float Radius(Animal a){return Info(a).Radius;}
        public static float VerticalRadius(Animal a){
            return Predator(a)?(a.Model=="boar"?.36f:.27f):Large(a)?.35f:Small(a)?.18f:.17f;
        }
        public static float LengthRadius(Animal a){
            return Predator(a)?.83f:Large(a)?.76f:Small(a)?.34f:.31f;
        }
        public static float MaxHealth(Animal a){return Info(a).Hp;}
        public static float FlightSpeed(Animal a){return Info(a).Speed;}
        public static int Yield(Animal a){return Info(a).Meat;}
        public static bool Small(Animal a){return Info(a).Family==Kind.Small;}
        public static bool Bird(Animal a){return Info(a).Family==Kind.Bird;}
        public static bool Large(Animal a){return Info(a).Family==Kind.Herd;}
        public static bool Predator(Animal a){return a.Model=="boar"||a.Model=="cougar"||a.Model=="wolf";}
        sealed class Territory
        {
            public float HomeX,HomeZ,LastX,LastZ,GoalX,GoalZ,Timer,Scan,Patrol,Hold;
            public Actor Target;
            public Random Dice;
        }
        static readonly ConditionalWeakTable<Animal,Territory> territories=new ConditionalWeakTable<Animal,Territory>();
        static Territory TerritoryOf(Animal a)
        {
            return territories.GetValue(a,delegate(Animal v) {
                return new Territory{HomeX=v.X,HomeZ=v.Z,GoalX=v.X,GoalZ=v.Z,Dice=new Random(unchecked((int)(v.X*2171+v.Z*733)))};
            });
        }
        static float D(float x,float z,float tx,float tz){return Game.Distance(x,z,tx,tz);}
        static float Yaw(float dx,float dz){return (float)Math.Atan2(dx,dz);}
        static float Angle(float yaw){return (float)Math.Atan2(Math.Sin(yaw),Math.Cos(yaw));}
        static float Leash(Animal a){return a.Model=="boar"?30f:a.Model=="wolf"?39f:35f;}
        static bool Footing(Game g,float x,float z){
            float y=Arena.Ground(g,x,z);
            return x*x+z*z<(Arena.Radius-2)*(Arena.Radius-2) && Arena.WetDepth(g,x,z)<.47f && Arena.CanStand(g,x,y,z);
        }
        public static void PopulateBiome(Game g)
        {
            int offset=Math.Min(2,Math.Max(0,g.ArenaId))*4;
            foreach(Animal v in g.Animals){
                int index=v.Model=="grazer"?2:v.Model=="hen"?1:0;
                Species species=animals[offset+index];v.Model=species.Model;v.HP=species.Hp;
            }
            int[] districts=g.ArenaId==1?new int[]{1,3}:g.ArenaId==2?new int[]{3,4}:new int[]{2,4};
            Random rng=new Random(unchecked(g.Seed^0x5b6872));
            foreach(int district in districts){
                float hx,hz;Arena.HuntingGround(district,out hx,out hz);
                for(int i=0;i<72;i++){
                    float angle=(float)rng.NextDouble()*6.2832f,r=3+(float)rng.NextDouble()*12;
                    float x=hx+(float)Math.Sin(angle)*r,z=hz+(float)Math.Cos(angle)*r;
                    if(!Footing(g,x,z))continue;
                    Species s=animals[offset+3];Animal v=new Animal{Model=s.Model,X=x,Y=Arena.Ground(g,x,z),Z=z,Yaw=angle,HP=s.Hp};
                    TerritoryOf(v);g.Animals.Add(v);break;
                }
            }
        }
        // A direct hit supplies a bearing. Only an unobstructed view identifies its source.
        static bool SightLine(Game g,Animal v,Actor a)
        {
            float eye=v.Y+Height(v)*1.12f;
            if(a==null||!a.Alive)return false;
            float upper=a.Y+(a.Crouch?.89f:1.53f),lower=a.Y+(a.Crouch?.47f:.8f);
            return (Arena.Clear(g,v.X,eye,v.Z,a.X,upper,a.Z) && Arena.FoliageAlong(g,v.X,eye,v.Z,a.X,upper,a.Z)<4.8f)
                || (Arena.Clear(g,v.X,eye,v.Z,a.X,lower,a.Z) && Arena.FoliageAlong(g,v.X,eye,v.Z,a.X,lower,a.Z)<4.8f);
        }
        static void Remember(Territory m,Actor target)
        {m.Target=target;m.LastX=target.X;m.LastZ=target.Z;}
        static void Warn(Game g,Animal v,Territory m,Actor a)
        {
            Remember(m,a);v.Yaw=Yaw(a.X-v.X,a.Z-v.Z);v.Alert=2;v.State="warn";
            m.Timer=v.Model=="boar"?.98f:v.Model=="wolf"?.77f:.86f;
            g.Cue(v.Model,v.X,v.Z,33);
            if(a==g.Player && D(v.X,v.Z,a.X,a.Z)<16)g.Say(Name(v)+"  ·  "+(v.Model=="boar"?"Scraping the ground":v.Model=="wolf"?"Growling":"Crouching to spring"));
        }
        public static void OnHit(Game g,Animal v,Actor shooter,bool ranged,ImpactSite impact)
        {
            if(!v.Alive || !Predator(v))return;
            Territory m=TerritoryOf(v);
            bool visible=ranged && impact.Implement=="arrow"
                ?Perception.SeeImpactSource(g,v.X,v.Y+Height(v)*1.12f,v.Z,shooter)
                :SightLine(g,v,shooter);
            if(visible){Warn(g,v,m,shooter);return;}
            m.Target=null;
            float norm=(float)Math.Sqrt(impact.DX*impact.DX+impact.DZ*impact.DZ);
            m.LastX=v.X-(norm>.02f?impact.DX/norm:0)*3.4f;m.LastZ=v.Z-(norm>.02f?impact.DZ/norm:0)*3.4f;
            v.Yaw=Yaw(m.LastX-v.X,m.LastZ-v.Z);v.Alert=1;v.State="search";m.Timer=3.8f;m.Scan=.16f;
            g.Cue(v.Model,v.X,v.Z,26);
        }
        public static bool ThreatTo(Game g,Actor observer,out Animal danger)
        {
            danger=null;float nearest=18;
            if(observer==null||!observer.Alive)return false;
            foreach(Animal v in g.Animals){
                if(!v.Alive||!Predator(v)||v.State=="retreat")continue;
                float d=D(v.X,v.Z,observer.X,observer.Z);
                if(d>=nearest || (d>3.5f && Math.Abs(Angle(Yaw(v.X-observer.X,v.Z-observer.Z)-observer.Yaw))>1.58f))continue;
                if(!Arena.Clear(g,observer.X,observer.Y+(observer.Crouch?.98f:1.57f),observer.Z,v.X,v.Y+Height(v),v.Z))continue;
                nearest=d;danger=v;
            }
            return danger!=null;
        }
        static Actor Notice(Game g,Animal v,Territory m)
        {
            Actor best=null;float nearest=v.Model=="wolf"?16:v.Model=="cougar"?15:12;
            foreach(Actor a in g.Actors){
                if(!a.Alive)continue;
                float d=D(v.X,v.Z,a.X,a.Z);
                if(d>=nearest || D(m.HomeX,m.HomeZ,a.X,a.Z)>Leash(v))continue;
                if(!Perception.ActorVisible(g,v.X,v.Y+Height(v)*1.12f,v.Z,v.Yaw,a))continue;
                nearest=d;best=a;
            }
            return best;
        }
        static readonly float[] offsets={0,.52f,-.52f,1.04f,-1.04f,1.47f,-1.47f};
        static bool Walk(Game g,Animal v,Territory m,float tx,float tz,float speed,float dt)
        {
            float dx=tx-v.X,dz=tz-v.Z,dist=D(v.X,v.Z,tx,tz);
            if(dist<.23f)return false;
            float yaw=Yaw(dx,dz),step=Math.Min(dist,Math.Min(.55f,speed*dt));
            foreach(float offset in offsets){
                float heading=yaw+offset;
                float sx=(float)Math.Sin(heading),sz=(float)Math.Cos(heading),x=v.X+sx*step,z=v.Z+sz*step;
                if(D(m.HomeX,m.HomeZ,x,z)>Leash(v)+1 || !Footing(g,x,z))continue;
                float y=Arena.Ground(g,x,z);
                if(Math.Abs(y-v.Y)>.32f+step*.95f || !Arena.Clear(g,v.X,v.Y+.35f,v.Z,x,y+.35f,z))continue;
                v.X=x;v.Z=z;v.Y=y;v.Yaw=heading;v.Anim+=step*(speed>3?4.5f:3.2f);return true;
            }
            return false;
        }
        static void Search(Animal v,Territory m)
        {m.Target=null;v.State="search";m.Timer=4.8f;m.Scan=.22f;v.Alert=.7f;}
        static void Retreat(Animal v,Territory m)
        {
            m.Target=null;v.State="retreat";m.Timer=7f;m.Hold=14;
            float yaw=Yaw(v.X-m.LastX,v.Z-m.LastZ);
            m.GoalX=m.HomeX+12*(float)Math.Sin(yaw);m.GoalZ=m.HomeZ+12*(float)Math.Cos(yaw);
        }
        public static void StepPredator(Game g,Animal v,float dt)
        {
            if(!v.Alive || g.Winner!=null)return;
            Territory m=TerritoryOf(v);
            m.Timer-=dt;m.Scan-=dt;m.Hold-=dt;
            if(m.Target!=null){
                float eyes=v.Y+Height(v)*1.12f;
                bool seen=v.State=="warn"?Perception.SeeImpactSource(g,v.X,eyes,v.Z,m.Target):
                    Perception.ActorVisible(g,v.X,eyes,v.Z,v.Yaw,m.Target);
                if(!seen){Search(v,m);return;}
                Remember(m,m.Target);
                float d=D(v.X,v.Z,m.LastX,m.LastZ);
                if(v.State=="warn"){
                    v.Yaw=Yaw(m.LastX-v.X,m.LastZ-v.Z);v.Anim+=dt*2;
                    if(m.Timer>0)return;
                    if(v.HP<MaxHealth(v)*.32f){Retreat(v,m);return;}
                    if(D(m.HomeX,m.HomeZ,m.LastX,m.LastZ)>Leash(v)){Search(v,m);return;}
                    v.State="charge";m.Timer=4f;
                }
                if(D(m.HomeX,m.HomeZ,m.LastX,m.LastZ)>Leash(v) || d>45){Search(v,m);return;}
                if(v.State=="recover"){
                    if(m.Timer<=0)Warn(g,v,m,m.Target);
                    return;
                }
                if(d<1.65f && Math.Abs(m.Target.Y-v.Y)<1.65f){
                    v.Yaw=Yaw(m.LastX-v.X,m.LastZ-v.Z);
                    g.WildHit(v,m.Target,v.Model=="boar"?26:v.Model=="cougar"?24:20);
                    v.State="recover";m.Timer=1.23f;v.Anim+=.8f;return;
                }
                if(m.Timer<=0){Warn(g,v,m,m.Target);return;}
                Walk(g,v,m,m.LastX,m.LastZ,FlightSpeed(v),dt);return;
            }
            if(v.State=="retreat"){
                Walk(g,v,m,m.GoalX,m.GoalZ,FlightSpeed(v)*.86f,dt);
                if(m.Timer<=0){v.State="home";v.Alert=0;}return;
            }
            if(m.Scan<=0 && m.Hold<=0){
                m.Scan=.24f+(float)m.Dice.NextDouble()*.18f;
                Actor a=Notice(g,v,m);if(a!=null){Warn(g,v,m,a);return;}
            }
            if(v.State=="search"){
                if(m.Timer<=0){v.State="home";v.Alert=0;return;}
                if(!Walk(g,v,m,m.LastX,m.LastZ,2.75f,dt))v.Yaw+=dt*.87f;
                return;
            }
            if(v.State=="home"){
                if(D(v.X,v.Z,m.HomeX,m.HomeZ)>.8f){Walk(g,v,m,m.HomeX,m.HomeZ,2.35f,dt);return;}
                v.State="idle";m.Patrol=3;
            }
            m.Patrol-=dt;
            if(m.Patrol<=0){
                float yaw=(float)m.Dice.NextDouble()*6.2832f,r=2+(float)m.Dice.NextDouble()*7;
                m.GoalX=m.HomeX+(float)Math.Sin(yaw)*r;m.GoalZ=m.HomeZ+(float)Math.Cos(yaw)*r;
                m.Patrol=7+(float)m.Dice.NextDouble()*8;
            }
            v.State=Walk(g,v,m,m.GoalX,m.GoalZ,.95f,dt)?"walk":"idle";
        }
    }
}
