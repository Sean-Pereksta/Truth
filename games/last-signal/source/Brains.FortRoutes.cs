using System;

namespace LastSignal {
    public static partial class Brains {
        // A fighter who saw a contestant upstairs can commit to a short, visible
        // ramp. A ranged fighter can also use a visible deck as a firing position.
        static bool ClimbObservedFort(Game g,Actor a,Mind m,float dt){
            bool ranged=Ranged(a);
            float targetRange=Dist(a.X,a.Z,m.LastSeen.X,m.LastSeen.Z);
            if((m.Job!=Aim.Combat && m.Job!=Aim.Search)||a.Health<30 ||
                ranged && (m.Job!=Aim.Combat || !m.HasObservation || !HasRanged(a,a.Weapon) || targetRange<8f)){
                m.ApproachRamp=null;return false;
            }
            if(m.ApproachRamp==null){
                if(!m.HasObservation || m.Enemy==null || !ranged && m.SeenFeet-a.Y<1.45f ||
                    m.NextRampCheck>g.Time || g.Time-m.SeenAt>.75f)return false;
                m.NextRampCheck=g.Time+.55f;
                if(!ranged && m.SeenFeet-Arena.Height(m.LastSeen.X,m.LastSeen.Z)<1.6f)return false;
                Arena.Near(g,a.X,a.Z,14,m.Nearby);
                float best=14;
                foreach(Prop p in m.Nearby){
                    if(p.Removed||p.Model!="ramp"||p.Kind!="structure"||Math.Abs(p.Y-a.Y)>.52f)continue;
                    float sx=Sin(p.Yaw),sz=Cos(p.Yaw),half=p.D*.5f;
                    float lipX=p.X+sx*half,lipZ=p.Z+sz*half;
                    float lx=lipX+sx*.42f,lz=lipZ+sz*.42f;
                    float landing=Arena.GroundBelow(g,lx,lz,p.Y+p.H+.17f);
                    if(Math.Abs(landing-p.Y-p.H)>.28f)continue;
                    float targetDist=Dist(lipX,lipZ,m.LastSeen.X,m.LastSeen.Z);
                    float x=p.X-sx*(half+.35f),z=p.Z-sz*(half+.35f);
                    float score=Dist(a.X,a.Z,x,z);
                    if(ranged){
                        Prop deck=Arena.WalkSurface(g,lx,landing,lz);
                        if(deck==null || deck.Model!="floor" || deck.FortLevel<1 || score>7.5f ||
                            targetDist<8f || targetDist>32f || g.StormMargin(lx,lz)<5f ||
                            !Arena.Clear(g,lx,landing+1.45f,lz,m.LastSeen.X,m.SeenFeet+1.05f,m.LastSeen.Z))continue;
                    }else{
                        if(targetDist>7f || p.Y+p.H>m.SeenFeet+.65f)continue;
                        score+=targetDist*.45f;
                    }
                    if(score>=best || !Arena.Clear(g,a.X,Eye(a),a.Z,x,p.Y+.66f,z))continue;
                    // Confirm that the visible approach actually leads into a ramp.
                    if(!Arena.Clear(g,a.X,Eye(a),a.Z,p.X,p.Y+p.H*.5f+.26f,p.Z))continue;
                    best=score;m.ApproachRamp=p;
                }
                if(m.ApproachRamp==null)return false;
                m.OnApproachRamp=false;m.RampUntil=g.Time+6f;m.NavTime=0;
            }
            Prop ramp=m.ApproachRamp;
            if(ramp.Removed||g.Time>m.RampUntil || !ranged && m.HasObservation && m.SeenFeet<a.Y-.55f){
                m.ApproachRamp=null;return false;
            }
            float dirX=Sin(ramp.Yaw),dirZ=Cos(ramp.Yaw),edge=ramp.D*.5f;
            float along=(a.X-ramp.X)*dirX+(a.Z-ramp.Z)*dirZ;
            float across=(a.X-ramp.X)*dirZ-(a.Z-ramp.Z)*dirX;
            if(a.Y>ramp.Y+ramp.H-.21f && along>edge+.18f){
                m.ApproachRamp=null;m.NavTime=0;return false;
            }
            if(along<=-edge+.15f && along>=-edge-.86f && Math.Abs(across)<.63f)m.OnApproachRamp=true;
            float offset=m.OnApproachRamp?edge+.54f:-edge-.40f;
            a.Crouch=a.Sprint=a.Aiming=false;
            Guard(a,false);
            a.State=ranged?"climbing to a firing position":"climbing to last sighting";
            Go(g,a,m,ramp.X+dirX*offset-a.X,ramp.Z+dirZ*offset-a.Z,3.6f,dt,true);
            return true;
        }

        static bool WouldLeaveFiringDeck(Game g,Actor a,float dx,float dz)
        {
            Prop deck=Arena.WalkSurface(g,a.X,a.Y,a.Z);
            if(deck==null || deck.Model!="floor" || deck.FortLevel<1)return false;
            float length=Dist(0,0,dx,dz);
            if(length<.02f)return false;
            return Arena.GroundBelow(g,a.X+.6f*dx/length,a.Z+.6f*dz/length,a.Y+.22f)<a.Y-.42f;
        }
    }
}
