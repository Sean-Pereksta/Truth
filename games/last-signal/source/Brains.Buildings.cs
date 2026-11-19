using System;

namespace LastSignal
{
    public static partial class Brains
    {
        static bool UseCampEntrance(Game g,Actor a,Mind m,float direction,float dt)
        {
            float dx=Sin(direction),dz=Cos(direction),distance;
            Prop panel=Arena.CampPanelAhead(g,a,dx,dz,out distance);
            if(panel==null)return false;
            if(panel.Model=="gate"&&!panel.Open)
            {
                if(panel.Latched&&Arena.TendsGate(g,a,panel))Arena.LatchGate(g,a,panel);
                if(!panel.Latched)
                {
                    Arena.ToggleGate(g,panel);
                    if(panel.Open){g.SoundAt(a,7);m.NavTime=0;a.Speed=0;return true;}
                    return false;
                }
            }
            if(m.Job!=Aim.Combat&&m.Job!=Aim.Search||a.Weapon=="fists"||a.Health<30||
               panel.Owner==a.Id||FriendlyNoise(g,a,panel.Owner)||m.Style==Style.Shadow)return false;
            Place clue;
            if(m.Enemy!=null&&g.Time-m.SeenAt<9)clue=m.LastSeen;
            else if(m.BriefUntil>g.Time)clue=m.PackGoal;
            else if(m.HeardFor>0)clue=m.Heard;
            else return false;
            // Only work a panel which physically blocks the route to the evidence.
            float toX=clue.X-a.X,toZ=clue.Z-a.Z,range=Dist(0,0,toX,toZ);
            if(range<distance+.25f||toX*dx+toZ*dz<range*.67f)return false;
            if(a.Windup<=0&&a.Swing<=0&&a.Count("hatchet")>0)Survival.EquipActor(a,"hatchet");
            if(Game.Ranged(a))return false;
            a.Speed=0;a.Sprint=false;m.NavTime=0;
            a.Yaw=ApproachAngle(a.Yaw,direction,dt*7f);
            float pitch=(float)Math.Atan2(.66f-(a.Crouch?1.03f:1.55f),Math.Max(.12f,distance));
            if(Math.Abs(Angle(direction-a.Yaw))<.14f&&a.NextAttack<=0&&a.Stamina>=14)
                g.Attack(a,a.Stamina>36,pitch);
            return true;
        }
    }
}
