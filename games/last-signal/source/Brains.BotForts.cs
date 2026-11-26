using System;

namespace LastSignal {
    public static partial class Brains {
        sealed class BotFort
        {
            public readonly FortBlueprint Template;
            public readonly Arena.FortFrame Frame;
            public readonly Prop[] Placed;
            public Place WorkSpot;
            public int NextPiece;
            public float ApproachUntil, LastProgress;

            public BotFort(FortBlueprint template,Arena.FortFrame frame)
            { Template=template; Frame=frame; Placed=new Prop[template.Parts.Length]; }
        }

        static bool FortWorkSafe(Game g,Actor a,Mind m)
        {
            return !m.Opening && !m.HasObservation && m.LostSight<=0 && m.HeardFor<=0 &&
                m.ImpactUntil<=g.Time && a.Hurt<=.02f && a.Health>=43 && a.Hunger>=42 &&
                a.Hydration>=45 && g.AliveCount>3 && g.StormMargin(a.X,a.Z)>9f;
        }

        static bool FortSiteSafe(Game g,BotFort fort)
        {
            Arena.FortFrame site=fort.Frame;
            float margin=fort.Template.Reach+7f;
            if(Inside(site.X,site.Z,24f+fort.Template.Reach) || g.StormMargin(site.X,site.Z)<margin)return false;
            if((g.StormWarning||g.StormMoving) &&
                g.StormNextRadius-Dist(site.X,site.Z,g.StormNextX,g.StormNextZ)<margin)return false;
            return true;
        }

        static Prop PlannedFortPiece(Game g,BotFort fort,int index)
        {
            return fort.Template.Preview(g,fort.Frame,index);
        }

        static bool CanFundFort(Actor a,FortBlueprint template)
        {
            foreach(var need in template.Needs)
                if(a.Count(need.Key)<need.Value+(need.Key=="fiber"?1:0))return false;
            return true;
        }

        static bool StandForFortPiece(Game g,Actor a,Prop piece,out Place stand)
        {
            stand=new Place(a.X,a.Z);
            float distance=Dist(a.X,a.Z,piece.X,piece.Z);
            if(distance>=.85f && distance<=3f && !Arena.FortOccupies(piece,a.X,a.Y,a.Z) &&
                Arena.FortVisible(g,a,piece))return true;
            float direction=distance>.2f?Heading(a.X-piece.X,a.Z-piece.Z):a.Yaw;
            float best=float.PositiveInfinity;
            for(int n=0;n<8;n++)
            {
                float yaw=direction+(n%2==0?-1:1)*((n+1)/2)*(float)Math.PI/4;
                float x=piece.X+Sin(yaw)*2.45f,z=piece.Z+Cos(yaw)*2.45f;
                float y=Arena.GroundBelow(g,x,z,a.Y+.4f);
                if(Math.Abs(y-piece.Y)>2.7f || Arena.WetDepth(g,x,z,y)>.15f || Arena.FortOccupies(piece,x,y,z) ||
                    !Arena.CanStand(g,x,y,z) || !Arena.FortVisibleFrom(g,x,y,z,y+1.45f,piece))continue;
                float score=Dist(a.X,a.Z,x,z);
                if(!Arena.Clear(g,a.X,Eye(a),a.Z,x,y+1.45f,z))score+=4f;
                if(score>=best)continue;
                best=score;stand=new Place(x,z);
            }
            return best<float.PositiveInfinity;
        }

        static BotFort FindFortSite(Game g,Actor a,Mind m,FortBlueprint template)
        {
            BotFort best=null;
            float bestScore=float.NegativeInfinity;
            for(int n=0;n<7;n++)
            {
                float bearing=a.Yaw+(n%2==0?-1:1)*((n+1)/2)*.84f;
                float distance=n<4?4.35f:6.15f;
                float x=a.X+Sin(bearing)*distance,z=a.Z+Cos(bearing)*distance;
                float y=Arena.Ground(g,x,z);
                if(Arena.WetDepth(g,x,z,y)>.15f || Math.Abs(y-a.Y)>1.45f || !Arena.CanStand(g,x,y,z))continue;
                float front=g.Time-m.SeenAt<35f?Heading(m.LastSeen.X-x,m.LastSeen.Z-z):bearing;
                for(int rotation=0;rotation<2;rotation++)
                {
                    var frame=new Arena.FortFrame{X=x,Y=y,Z=z,Yaw=front+rotation*(float)Math.PI/2};
                    var site=new BotFort(template,frame){LastProgress=g.Time};
                    if(!FortSiteSafe(g,site) || !template.HasClearExits(g,frame))continue;
                    bool fits=true;
                    for(int i=0;i<template.Parts.Length;i++)
                    {
                        if(template.Parts[i].Level==0 && !Arena.BuildFits(g,PlannedFortPiece(g,site,i),a))
                        { fits=false;break; }
                    }
                    if(!fits || !StandForFortPiece(g,a,PlannedFortPiece(g,site,0),out site.WorkSpot))continue;
                    float score=Arena.Cover(g,x,z)*3f+Math.Min(g.StormMargin(x,z),35f)*.035f-
                        Dist(a.X,a.Z,site.WorkSpot.X,site.WorkSpot.Z)*.3f-rotation*.18f;
                    if(score>bestScore){best=site;bestScore=score;}
                }
            }
            return best;
        }

        static bool FortIntact(BotFort fort)
        {
            for(int i=0;i<fort.NextPiece;i++)
                if(fort.Placed[i].Removed)return false;
            return true;
        }

        static bool TryFortRefuge(Game g,Actor a,Mind m,Place threat,out Place cover)
        {
            cover=new Place(a.X,a.Z);
            BotFort fort=m.Fort;
            float threatGround=Arena.Ground(g,threat.X,threat.Z)+1.45f;
            float best=17f;
            if(fort!=null && fort.NextPiece>0 && FortSiteSafe(g,fort) && FortIntact(fort))
            {
                bool sound=true;
                for(int i=0;i<fort.NextPiece;i++)
                    if(fort.Placed[i].HP<fort.Placed[i].MaxHP*.34f){sound=false;break;}
                if(sound)RefugeInFrame(g,a,fort.Frame,threat,threatGround,ref cover,ref best);
            }
            Arena.Near(g,a.X,a.Z,13,m.Nearby);
            foreach(Prop panel in m.Nearby)
            {
                if(panel.Removed || panel.Fort==null || (fort!=null && panel.Fort==fort.Frame) ||
                    (panel.Model!="wall" && panel.Model!="gate" && panel.Model!="barricade") ||
                    panel.HP<panel.MaxHP*.34f)continue;
                float dx=panel.X-a.X,dy=panel.Y+panel.H*.55f-Eye(a),dz=panel.Z-a.Z;
                float range=(float)Math.Sqrt(dx*dx+dy*dy+dz*dz),hit;
                if(range<.35f || range>13f || Math.Abs(Angle(Heading(dx,dz)-a.Yaw))>1.38f ||
                    Arena.RayProp(g,a.X,Eye(a),a.Z,dx/range,dy/range,dz/range,range+.12f,out hit)!=panel)continue;
                RefugeInFrame(g,a,panel.Fort,threat,threatGround,ref cover,ref best);
            }
            return best<17f;
        }

        static void RefugeInFrame(Game g,Actor a,Arena.FortFrame frame,Place threat,float threatY,ref Place cover,ref float best)
        {
            float startRange=Dist(a.X,a.Z,threat.X,threat.Z);
            for(int i=0;i<2;i++)
            {
                float x,z;
                frame.World(0,i*3f,out x,out z);
                float y=Arena.Ground(g,x,z),range=Dist(x,z,threat.X,threat.Z),distance=Dist(a.X,a.Z,x,z);
                if(distance<1.5f || range<5f || range<startRange*.8f || distance>=best || g.StormMargin(x,z)<6f ||
                    ((g.StormWarning||g.StormMoving) && Dist(x,z,g.StormNextX,g.StormNextZ)>g.StormNextRadius-6f) ||
                    Arena.WetDepth(g,x,z,y)>.15f || !Arena.CanStand(g,x,y,z) ||
                    !Arena.Clear(g,a.X,Eye(a),a.Z,x,y+1.05f,z) || Arena.Clear(g,threat.X,threatY,threat.Z,x,y+1.05f,z))continue;
                cover=new Place(x,z);best=distance;
            }
        }

        static bool TryPlanFort(Game g,Actor a,Mind m,out Place destination,out float score)
        {
            destination=new Place(a.X,a.Z);score=0;
            if(!FortWorkSafe(g,a,m) || g.Time<m.FortPauseUntil)return false;

            BotFort fort=m.Fort;
            if(fort!=null && (!FortSiteSafe(g,fort)||!FortIntact(fort)||
                fort.NextPiece<fort.Template.Parts.Length && g.Time-fort.LastProgress>85f))
            { m.Fort=null; m.FortCandidate=null; fort=null; }

            if(fort!=null && fort.NextPiece>=fort.Template.Parts.Length)fort=null;
            if(fort==null && m.FortCandidate!=m.Fort && m.FortCandidate!=null &&
                g.Time-m.FortCandidate.LastProgress<14f && FortSiteSafe(g,m.FortCandidate))
                fort=m.FortCandidate;
            if(fort==null)
            {
                if(g.Time<m.NextFortCheck || m.FortsStarted>=2 || m.BuildInterest<.60f)return false;
                m.NextFortCheck=g.Time+m.Between(5f,9f);
                bool strongholdFunds=m.BuildInterest>=.82f && CanFundFort(a,FortBlueprint.Stronghold);
                if(strongholdFunds)fort=FindFortSite(g,a,m,FortBlueprint.Stronghold);
                bool savingForFort=m.BuildInterest>=.82f && m.FortsStarted==0 && a.Count("hatchet")>0 &&
                    a.Count("scrap")>0 && !strongholdFunds && !g.IsNight;
                if(!savingForFort)
                {
                    bool useHighGround=m.BuildInterest>=.73f || (m.BuildInterest>=.64f && Ranged(a));
                    if(fort==null && useHighGround && CanFundFort(a,FortBlueprint.RaisedLookout))
                        fort=FindFortSite(g,a,m,FortBlueprint.RaisedLookout);
                    if(fort==null && m.BuildInterest>=.62f && CanFundFort(a,FortBlueprint.FieldCamp))fort=FindFortSite(g,a,m,FortBlueprint.FieldCamp);
                    if(fort==null && CanFundFort(a,FortBlueprint.TrailHide))fort=FindFortSite(g,a,m,FortBlueprint.TrailHide);
                }
                if(fort==null)return false;
            }
            if(Dist(a.X,a.Z,fort.Frame.X,fort.Frame.Z)>30f)return false;

            Prop piece=PlannedFortPiece(g,fort,fort.NextPiece);
            if(!Survival.CanMake(a,Survival.Find(Survival.Builds,piece.Model)))return false;
            if(m.Job!=Aim.Build || fort!=m.Fort || g.Time>=fort.ApproachUntil)
            {
                if(!Arena.BuildFits(g,piece,a) || !StandForFortPiece(g,a,piece,out fort.WorkSpot))return false;
            }
            m.FortCandidate=fort; destination=fort.WorkSpot;
            score=49f+m.BuildInterest*13f+(fort.NextPiece>0?5f:0)+(g.IsNight?2f:0)-
                Dist(a.X,a.Z,destination.X,destination.Z)*.36f;
            return true;
        }

        static void PauseFort(Game g,Mind m,float seconds)
        {
            m.FortWork=0; m.FortPauseUntil=g.Time+seconds;
            if(m.Fort!=null)m.Fort.ApproachUntil=0;
            m.Job=Aim.Travel; m.Replan=0;
        }

        static bool WorkOnFort(Game g,Actor a,Mind m,float dt)
        {
            if(m.Job!=Aim.Build)
            {
                m.FortWork=0;
                if(m.Fort!=null)m.Fort.ApproachUntil=0;
                return false;
            }
            BotFort fort=m.FortCandidate;
            if(fort==null || !FortWorkSafe(g,a,m) || !FortSiteSafe(g,fort) || !FortIntact(fort))
            { a.Speed=0; PauseFort(g,m,5f);return true; }
            m.Fort=fort;
            if(fort.ApproachUntil<=0)fort.ApproachUntil=g.Time+10f;
            if(g.Time>=fort.ApproachUntil)
            {
                m.Fort=null;m.FortCandidate=null;
                PauseFort(g,m,12f);return true;
            }

            Prop piece=PlannedFortPiece(g,fort,fort.NextPiece);
            a.State="building "+fort.Template.Name;
            Guard(a,false);
            a.Crouch=false;
            if(Dist(a.X,a.Z,piece.X,piece.Z)>3f || Arena.FortOccupies(piece,a.X,a.Y,a.Z) ||
                !Arena.FortVisible(g,a,piece))
            {
                m.FortWork=0;
                Go(g,a,m,fort.WorkSpot.X-a.X,fort.WorkSpot.Z-a.Z,2.65f,dt,true);
                return true;
            }

            a.Speed=0;
            a.Yaw=ApproachAngle(a.Yaw,Heading(piece.X-a.X,piece.Z-a.Z),dt*5f);
            m.FortWork+=dt;
            if(m.FortWork<1.15f)return true;
            Prop placed=Survival.Build(g,a,piece);
            if(placed==null){PauseFort(g,m,7f);return true;}
            if(fort.NextPiece==0)m.FortsStarted++;
            fort.Placed[fort.NextPiece++]=placed;
            fort.LastProgress=g.Time;
            if(fort.NextPiece==fort.Template.Parts.Length)
            {
                m.NextFortCheck=g.Time+85f;
                PauseFort(g,m,18f);
            }
            else
            {
                // Break after initial cover and every other component so a
                // half-finished project leaves time for food, patrol and fights.
                float pause=fort.NextPiece==1 || fort.NextPiece%2==0?m.Between(4f,8f):.8f;
                PauseFort(g,m,pause);
            }
            return true;
        }
    }
}
