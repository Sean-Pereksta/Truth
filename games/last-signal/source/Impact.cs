using System;

namespace LastSignal
{
    public struct ImpactSite
    {
        public float X, Y, Z, DX, DY, DZ;
        public string Implement;

        public ImpactSite(float x, float y, float z, float dx, float dy, float dz, string implement)
        {
            X=x; Y=y; Z=z; DX=dx; DY=dy; DZ=dz; Implement=implement;
        }
    }

    public struct ImpactDrop
    {
        public float X,Y,Z,VX,VY,VZ,Radius,Age,Life,Tint;
        public bool Bloody,LeavesMark,Mist;
    }

    public struct ImpactMark
    {
        public float X,Y,Z,Radius,Angle,Tint,Age,Life,SlopeX,SlopeZ;
    }

    public partial class Game
    {
        // Slot reuse bounds simultaneous fights. Cosmetic randomness never
        // consumes the gameplay RNG or changes deterministic match outcomes.
        public readonly ImpactDrop[] ImpactDrops=new ImpactDrop[160];
        public readonly ImpactMark[] ImpactMarks=new ImpactMark[88];
        public float IncomingImpact,IncomingAngle,IncomingStrength,ConfirmedImpact;
        public float ImpactWorldTime {get;private set;}
        int nextDrop,nextMark;
        uint impactNoise=0x83a741d3;

        float ImpactRandom()
        {
            impactNoise^=impactNoise<<13;impactNoise^=impactNoise>>17;impactNoise^=impactNoise<<5;
            return (impactNoise & 0xffffff)/16777216f;
        }

        void ResetImpacts()
        {
            Array.Clear(ImpactDrops,0,ImpactDrops.Length);
            Array.Clear(ImpactMarks,0,ImpactMarks.Length);
            nextDrop=nextMark=0;
            IncomingImpact=IncomingAngle=IncomingStrength=ConfirmedImpact=0;
            ImpactWorldTime=0;
            impactNoise=0x83a741d3;
        }

        static bool StrongContact(string implement,bool ranged,bool heavy,float damage)
        {
            return ranged ? damage>=(implement=="spear"?48f:37f) : heavy;
        }

        static string ContactSound(ImpactSite site,bool strong)
        {
            if(site.Implement=="spear")return strong?"thrust_heavy":"thrust_hit";
            return strong?"hit_heavy":"hit_light";
        }

        void EmitImpact(ImpactSite hit,float damage,bool strong,bool blocked,bool parry,bool animal)
        {
            float cameraX=hit.X-CamX,cameraZ=hit.Z-CamZ;
            if(!HostingOnlineRound&&cameraX*cameraX+cameraZ*cameraZ>115f*115f)return;
            ImpactWorldTime=Math.Max(ImpactWorldTime,blocked?.50f:57f);
            bool blunt=hit.Implement=="stone"||hit.Implement=="fists";
            float energy=Math.Min(1,Math.Max(.10f,damage/48f));
            int count=blocked?(parry?13:7):damage<6?2:(int)(5+energy*(blunt?8:18))+(strong?4:0);
            if(animal)count=Math.Max(3,count*2/3);
            float side=ImpactRandom()<.5f?-1:1;
            for(int i=0;i<count;i++)
            {
                float point=ImpactRandom(),fan=(ImpactRandom()-.5f)*(blocked?3.8f:2.35f);
                float speed=(.48f+point*.99f)*(blocked?2.8f:1.00f+energy*2.75f);
                float lateral=fan+(!blocked&&!blunt?side*.56f:0);
                float forward=-.49f-ImpactRandom()*.72f;
                float speedX=hit.DX*forward+hit.DZ*lateral;
                float speedZ=hit.DZ*forward-hit.DX*lateral;
                float length=(float)Math.Sqrt(speedX*speedX+speedZ*speedZ)+.001f;
                float rad=blocked?.013f+.015f*point:.0045f+(.005f+.011f*energy)*point;
                bool groundTrail=!blocked&&i%3==0;
                bool mist=!blocked&&damage>=6&&i%9==1;
                if(i==0&&groundTrail)speed*=.18f;
                if(mist)speed*=.35f;
                ImpactDrops[nextDrop]=new ImpactDrop {
                    X=hit.X-.021f*hit.DX+(ImpactRandom()-.5f)*.10f,
                    Y=hit.Y+.015f+(ImpactRandom()-.5f)*.09f,
                    Z=hit.Z-.021f*hit.DZ+(ImpactRandom()-.5f)*.10f,
                    VX=speedX/length*speed,VZ=speedZ/length*speed,
                    VY=i==0&&groundTrail?-.25f:(blocked?.7f:.32f)+ImpactRandom()*(blocked?2.4f:1.3f+energy*1.3f)-hit.DY*.36f,
                    Radius=mist?.055f+energy*.06f:rad,Life=blocked?.16f+point*.19f:mist?.19f:groundTrail?1.50f:.60f+point*.35f,
                    Bloody=!blocked,LeavesMark=groundTrail,Mist=mist,Tint=parry?.82f+point*.18f:ImpactRandom()
                };
                nextDrop=(nextDrop+1)%ImpactDrops.Length;
            }
        }

        void StampGround(ImpactDrop drop,float floor)
        {
            if(Arena.WetDepth(this,drop.X,drop.Z,floor)>.045f)return;
            float r=.025f+drop.Radius*(2.9f+ImpactRandom()*2.3f);
            float px=Arena.GroundBelow(this,drop.X+r,drop.Z,floor+.28f),mx=Arena.GroundBelow(this,drop.X-r,drop.Z,floor+.28f);
            float pz=Arena.GroundBelow(this,drop.X,drop.Z+r,floor+.28f),mz=Arena.GroundBelow(this,drop.X,drop.Z-r,floor+.28f);
            if(Math.Abs(px-mx)>.28f||Math.Abs(pz-mz)>.28f)return;
            ImpactMarks[nextMark]=new ImpactMark{
                X=drop.X,Y=floor+.032f,Z=drop.Z,Radius=r,Angle=ImpactRandom()*6.28318f,
                Tint=drop.Tint,Life=30f+ImpactRandom()*25f,SlopeX=(px-mx)/(2*r),SlopeZ=(pz-mz)/(2*r)
            };
            nextMark=(nextMark+1)%ImpactMarks.Length;
        }

        void TickImpacts(float dt)
        {
            IncomingImpact=Math.Max(0,IncomingImpact-dt);ConfirmedImpact=Math.Max(0,ConfirmedImpact-dt);
            if(ImpactWorldTime<=0)return;
            ImpactWorldTime=Math.Max(0,ImpactWorldTime-dt);
            for(int i=0;i<ImpactDrops.Length;i++)
            {
                ImpactDrop p=ImpactDrops[i];
                if(p.Life<=0)continue;
                p.Age+=dt;
                if(p.Age>=p.Life){ImpactDrops[i].Life=0;continue;}
                float priorY=p.Y;
                p.X+=p.VX*dt;p.Y+=p.VY*dt;p.Z+=p.VZ*dt;p.VY-=7.7f*dt;
                float drag=Math.Max(0,1-dt*(p.Bloody?1.4f:2.8f));p.VX*=drag;p.VZ*=drag;
                if(p.VY<0)
                {
                    float floor=Arena.GroundBelow(this,p.X,p.Z,priorY+.04f);
                    if(p.Y<=floor+.016f){
                        if(p.LeavesMark)StampGround(p,floor);
                        p.Life=0;
                    }
                }
                ImpactDrops[i]=p;
            }
            for(int i=0;i<ImpactMarks.Length;i++)
            {
                if(ImpactMarks[i].Life<=0)continue;
                ImpactMarks[i].Age+=dt;
                if(ImpactMarks[i].Age>=ImpactMarks[i].Life)ImpactMarks[i].Life=0;
            }
        }
    }
}
