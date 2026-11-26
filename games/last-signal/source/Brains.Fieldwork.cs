using System;

namespace LastSignal {
    public static partial class Brains {
        static bool Fieldwork(Game g,Actor a,Mind m,float dt)
        {
            bool idle=m.Job==Aim.Forage || m.Job==Aim.Wait || m.Job==Aim.Travel;
            int woodGoal=m.BuildInterest>=.82f?12:m.BuildInterest>=.64f?7:4;
            int fiberGoal=m.BuildInterest>=.82f?10:m.BuildInterest>=.64f?6:4;
            if(!idle || m.Opening || m.HasObservation || m.HeardFor>0 || m.LostSight>0 ||
                g.AliveCount<=3 || a.Health<40 || a.Hydration<35 || a.Hunger<35 ||
                a.Count("hatchet")==0 || a.Count("branch")>=woodGoal && a.Count("fiber")>=fiberGoal ||
                !Inside(a.X,a.Z,g.SafeRadius-7f))
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
