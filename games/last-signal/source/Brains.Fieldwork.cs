using System;

namespace LastSignal {
    public static partial class Brains {
        static bool WorkOnShelter(Game g,Actor a,Mind m,float dt)
        {
            if(m.Style!=Style.Builder)return false;
            bool available=m.Job==Aim.Camp || m.Job==Aim.Wait || m.Job==Aim.Travel || m.Job==Aim.Forage || m.Job==Aim.Loot;
            if(!available || m.Opening || m.HasObservation || m.HeardFor>0 || m.LostSight>0 || m.ImpactUntil>g.Time ||
                a.Hurt>.02f || a.Health<40 || a.Hunger<35 || a.Hydration<35 || g.AliveCount<=3 ||
                Inside(a.X,a.Z,24) || !Inside(a.X,a.Z,g.SafeRadius-6f))
            {
                m.ShelterWork=0;return false;
            }
            Prop frame=m.ShelterFrame;
            if(frame==null || frame.Removed)
            {
                if(g.Time<m.NextShelterCheck)return false;
                m.NextShelterCheck=g.Time+3f;
                if(Math.Abs(a.Y-Arena.Ground(g,a.X,a.Z))>.32f || !Survival.CanMake(a,Survival.Find(Survival.Builds,"barricade")))return false;
                for(int attempt=0;attempt<6;attempt++)
                {
                    float yaw=a.Yaw+attempt*1.0472f;
                    frame=Survival.Build(g,a,"barricade",a.X+Sin(yaw)*2.5f,a.Z+Cos(yaw)*2.5f,yaw);
                    if(frame!=null)break;
                }
                if(frame==null)return false;
                frame.Label=Survival.ShelterFrameLabel;m.ShelterFrame=frame;
                m.ShelterWork=0;m.NextShelterCheck=0;
            }
            if(frame.Label!=Survival.ShelterFrameLabel || !Inside(frame.X,frame.Z,g.SafeRadius-3f) ||
                !Survival.CanMake(a,Survival.Find(Survival.Builds,"lean_to")))return false;
            float distance=Dist(a.X,a.Z,frame.X,frame.Z);
            if(distance>12f || Math.Abs(a.Y-frame.Y)>2.5f){m.ShelterWork=0;return false;}
            if(g.Time<m.NextShelterCheck)return false;
            Guard(a,false);a.State="building a shelter";a.Crouch=false;
            if(distance>3.6f)
            {
                Go(g,a,m,frame.X-a.X,frame.Z-a.Z,2.7f,dt,true);return true;
            }
            a.Speed=0;a.Crouch=true;a.Yaw=ApproachAngle(a.Yaw,Heading(frame.X-a.X,frame.Z-a.Z),dt*4);
            m.ShelterWork+=dt;
            if(m.ShelterWork<4f)return true;
            for(int side=-1;side<=1;side+=2)
            {
                float x=frame.X+side*Cos(frame.Yaw)*2.85f-Sin(frame.Yaw)*.48f;
                float z=frame.Z-side*Sin(frame.Yaw)*2.85f-Cos(frame.Yaw)*.48f;
                if(Survival.Build(g,a,"lean_to",x,z,frame.Yaw)!=null)
                {
                    frame.Label="Shelter windbreak";m.ShelterWork=0;return true;
                }
            }
            // The site may now be occupied. Resume normal work until another try.
            m.NextShelterCheck=g.Time+6f;return false;
        }

        static bool Fieldwork(Game g,Actor a,Mind m,float dt)
        {
            bool idle=m.Job==Aim.Forage || m.Job==Aim.Wait || m.Job==Aim.Travel;
            if(!idle || m.Opening || m.HasObservation || m.HeardFor>0 || m.LostSight>0 ||
                g.AliveCount<=3 || a.Health<40 || a.Hydration<35 || a.Hunger<35 ||
                (m.Style!=Style.Builder && m.Style!=Style.Hunter) || a.Count("hatchet")==0 ||
                a.Count("branch")>=4 || !Inside(a.X,a.Z,g.SafeRadius-7f))
            {
                m.WorkTree=null;return false;
            }
            if(m.WorkTree!=null && (m.WorkTree.Removed || g.Time>m.WorkEnds))m.WorkTree=null;
            if(m.WorkTree==null)
            {
                if(g.Time<m.NextWorkCheck)return false;
                m.NextWorkCheck=g.Time+6f;
                Arena.Near(g,a.X,a.Z,9f,m.Nearby);
                float best=9f;
                foreach(Prop tree in m.Nearby)
                {
                    if(tree.Removed || !Game.IsHarvestTree(tree) || tree.HP<=0 || !Inside(tree.X,tree.Z,g.SafeRadius-4f))continue;
                    float dx=tree.X-a.X,dz=tree.Z-a.Z;
                    float distance=Dist(a.X,a.Z,tree.X,tree.Z);
                    if(distance<.1f || distance>=best || Math.Abs(Angle(Heading(dx,dz)-a.Yaw))>1.65f)continue;
                    float dy=tree.Y+1.2f-Eye(a);
                    float length=(float)Math.Sqrt(distance*distance+dy*dy),hit;
                    if(Arena.RayProp(g,a.X,Eye(a),a.Z,dx/length,dy/length,dz/length,length,out hit)!=tree)continue;
                    best=distance;m.WorkTree=tree;
                }
                if(m.WorkTree==null)return false;
                m.WorkEnds=g.Time+6f;
            }
            Prop target=m.WorkTree;
            float x=target.X-a.X,z=target.Z-a.Z;
            a.Crouch=false;a.State="gathering timber";
            if(Dist(a.X,a.Z,target.X,target.Z)>1.45f+target.W*.3f)
                Go(g,a,m,x,z,2.6f,dt,true);
            else
            {
                a.Speed=0;
                float facing=Heading(x,z);
                a.Yaw=ApproachAngle(a.Yaw,facing,dt*5);
                if(Math.Abs(Angle(facing-a.Yaw))<.18f && a.Stamina>24 && m.Action<=0)
                {
                    Survival.EquipActor(a,"hatchet");
                    g.Attack(a,false,0);
                    m.Action=1.05f;
                }
            }
            return true;
        }
    }
}
