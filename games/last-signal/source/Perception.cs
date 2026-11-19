using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;

namespace LastSignal
{
    public enum FireCue { None,Flame,Smoke }

    public static partial class Arena
    {
        internal static int SightRevision(Game g){return fields.GetOrCreateValue(g).Revision;}

        // Vegetation is not a projectile collider. For sight, measure how much of a
        // ray actually travels through its occupied height and horizontal footprint.
        internal static float FoliageAlong(Game g,float x,float y,float z,float tx,float ty,float tz)
        {
            float dx=tx-x,dz=tz-z,lenSq=dx*dx+dz*dz;if(lenSq<1f)return 0;
            Field field=fields.GetOrCreateValue(g);
            float depth=0,inv=1f/lenSq;
            int xmin=Cell(Math.Min(x,tx)-2.6f),xmax=Cell(Math.Max(x,tx)+2.6f);
            int zmin=Cell(Math.Min(z,tz)-2.6f),zmax=Cell(Math.Max(z,tz)+2.6f);
            for(int iz=zmin;iz<=zmax;iz++)for(int ix=xmin;ix<=xmax;ix++)
            {
                List<Prop> bin=field.Nearby[ix+iz*Cells];if(bin==null)continue;
                for(int k=0;k<bin.Count;k++)
                {
                    Prop p=bin[k];if(p.Removed||p.Kind!="vegetation"||p.H<.60f)continue;
                    float px=p.X-x,pz=p.Z-z,t=(px*dx+pz*dz)*inv;
                    if(t<=.015f||t>=.985f)continue;
                    float height=y+(ty-y)*t-p.Y;
                    if(height<-.1f||height>p.H)continue;
                    float qx=px-dx*t,qz=pz-dz*t,r=p.W*.47f;
                    float chord=r*r-qx*qx-qz*qz;if(chord<=0)continue;
                    float density=p.Model=="grass"||p.Model=="flowers"?.23f:p.Model=="rushes"?.53f:.82f;
                    float crown=1-Smooth(.64f,1f,height/Math.Max(.2f,p.H))*.90f;
                    depth+=2*density*crown*(float)Math.Sqrt(chord);
                    if(depth>=7f)return 7f;
                }
            }
            return depth;
        }

        public static float PeekOffset(Game g,Actor a,float desired,float eyeY)
        {
            if(Math.Abs(desired)<.001f)return 0;
            float forwardX=Sin(a.Yaw),forwardZ=Cos(a.Yaw),sign=Math.Sign(desired);
            float dx=forwardZ*sign,dz=-forwardX*sign,offset=Math.Abs(desired);
            // Probe a small head volume. Two corner samples protect the near plane
            // when a diagonal wall or jamb clears the center but clips the lens.
            for(int i=-1;i<=1;i++)
            {
                float side=i*.09f,x=a.X+forwardX*side,z=a.Z+forwardZ*side,hit;
                RayProp(g,x,eyeY+(i==0?.055f:0f),z,dx,0,dz,offset+.12f,out hit);
                offset=Math.Min(offset,Math.Max(0,hit-.12f));
            }
            return sign*offset;
        }
    }

    public static class Perception
    {
        sealed class Plume
        {
            public int Revision=-1;public float Furthest,X,Y,Z;
        }
        static readonly ConditionalWeakTable<Prop,Plume> plumes=new ConditionalWeakTable<Prop,Plume>();
        public static bool Night(Game g){return g.IsNight;}
        static float Distance(float x,float z,float tx,float tz){float a=tx-x,b=tz-z;return (float)Math.Sqrt(a*a+b*b);}
        static bool Camp(Prop p){return p!=null&&!p.Removed&&p.Lit&&p.Fuel>.001f&&p.Kind=="fire";}
        static bool Emitter(Prop p){return Camp(p)||(p!=null&&!p.Removed&&p.Lit&&p.Kind=="stove");}
        static float FlameBase(Prop p){return p.Y+(p.Kind=="stove"?.79f:.10f);}
        static bool InCone(float dx,float dz,float yaw,float d)
        {
            return d<=3.2f||dx*(float)Math.Sin(yaw)+dz*(float)Math.Cos(yaw)>=d*.2867152f;
        }
        static bool Sight(Game g,float x,float y,float z,float tx,float ty,float tz,float range,float distance)
        {
            if(distance>range||!Arena.Clear(g,x,y,z,tx,ty,tz))return false;
            float leaf=Arena.FoliageAlong(g,x,y,z,tx,ty,tz);
            return distance*(1+.45f*leaf)<=range;
        }
        static float Weather(Game g,float x,float z)
        {
            float factor=g.Rain?.79f:1f;
            if(g.StormActive&&g.StormMargin(x,z)<0)factor*=.79f;
            return factor;
        }
        public static float SmokeFraction(Game g,Prop p)
        {
            if(!Emitter(p))return 0;
            Plume plume=plumes.GetOrCreateValue(p);int revision=Arena.SightRevision(g);
            if(plume.Revision==revision && p.X==plume.X&&p.Y==plume.Y&&p.Z==plume.Z)return plume.Furthest;
            float baseY=FlameBase(p)+.37f,start=0;
            if(p.Kind=="stove")start=Math.Max(0,(p.Y+p.H+.025f-baseY)/4);
            const float travel=4.346263f;
            float cap=1f;
            for(int i=-1;i<=1;i++)
            {
                float hit,max=(1-start)*travel;
                Arena.RayProp(g,p.X+1.70f*start,baseY+4*start,p.Z+i*.13f,1.7f/travel,4f/travel,0,max,out hit);
                if(hit<max)cap=Math.Min(cap,start+Math.Max(0,hit-.12f)/travel);
            }
            plume.Revision=revision;plume.X=p.X;plume.Y=p.Y;plume.Z=p.Z;plume.Furthest=cap;
            return cap;
        }
        // A stove shines locally. It is not evidence of a contestant's camp and
        // never enters the list of fire cues available to an investigating animal.
        public static bool LightReaches(Game g,Prop p,float x,float y,float z)
        {
            if(!Emitter(p))return false;
            float yy=FlameBase(p)+.49f;
            if(p.Kind=="stove")yy=Math.Max(yy,p.Y+p.H+.035f);
            return Arena.Clear(g,x,y,z,p.X,yy,p.Z);
        }
        public static bool FlameVisible(Game g,float x,float y,float z,Prop p)
        {
            if(!Camp(p))return false;
            float distance=Distance(x,z,p.X,p.Z),range=(25f+36f*(1-g.Daylight))*Weather(g,x,z);
            if(distance>range)return false;
            float fy=FlameBase(p);
            return Sight(g,x,y,z,p.X-.095f,fy+.33f,p.Z,range,distance)
                ||Sight(g,x,y,z,p.X+.11f,fy+.48f,p.Z+.04f,range,distance)
                ||Sight(g,x,y,z,p.X-.06f,fy+.66f,p.Z,range,distance);
        }
        public static bool FireVisible(Game g,float x,float y,float z,Prop p,out FireCue cue)
        {
            cue=FireCue.None;if(!Camp(p))return false;
            if(FlameVisible(g,x,y,z,p)){cue=FireCue.Flame;return true;}
            float distance=Distance(x,z,p.X,p.Z),range=(18f+32f*g.Daylight)*Weather(g,x,z);
            if(distance>range)return false;
            float cap=SmokeFraction(g,p);
            for(int i=0;i<2;i++)
            {
                float t=i==0?.29f:.61f;if(t>cap)break;
                if(Sight(g,x,y,z,p.X+1.7f*t,FlameBase(p)+.37f+4*t,p.Z,range,distance))
                {cue=FireCue.Smoke;return true;}
            }
            return false;
        }
        static float LocalLight(Game g,Actor target)
        {
            float best=0;
            foreach(Prop p in g.CookingSites)
            {
                if(!Emitter(p))continue;float dx=target.X-p.X,dz=target.Z-p.Z;
                float sq=dx*dx+dz*dz;if(sq>=64f)continue;
                float strength=1-(float)Math.Sqrt(sq)/8;
                if(strength>best&&LightReaches(g,p,target.X,target.Y+(target.Crouch?.82f:1.28f),target.Z))best=strength;
            }
            return best;
        }
        static bool Character(Game g,float x,float y,float z,float yaw,Actor target,float range)
        {
            if(target==null||!target.Alive)return false;
            float dx=target.X-x,dz=target.Z-z,distance=(float)Math.Sqrt(dx*dx+dz*dz);
            if(distance>range||!InCone(dx,dz,yaw,distance))return false;
            float daylight=g.Daylight<.82f?Math.Max(g.Daylight,LocalLight(g,target)):g.Daylight;
            range*=Weather(g,x,z)*(.53f+.47f*daylight);
            float cover=Arena.Cover(g,target.X,target.Z);
            range*=1-(target.Crouch?.67f:.30f)*cover;
            if(distance>range)return false;
            float eyes=target.Y+(target.Crouch?1.02f:1.57f);
            if(Sight(g,x,y,z,target.X,eyes-.06f,target.Z,range,distance))return true;
            // A real exposed camera position persists briefly as a released lean eases
            // back. Using that position avoids both wall vision and invisible peeking.
            float peekX,peekY,peekZ;
            if(g.LeanEye(target,out peekX,out peekY,out peekZ))
            {
                float offset=Distance(target.X,target.Z,peekX,peekZ);
                if(offset>.065f && offset<=.39f && Math.Abs(peekY-eyes)<.22f &&
                   Arena.Clear(g,target.X,eyes,target.Z,peekX,peekY,peekZ) &&
                   Sight(g,x,y,z,peekX,peekY,peekZ,range,distance))return true;
            }
            return distance<=22 && Sight(g,x,y,z,target.X,target.Y+(target.Crouch?.64f:.79f),target.Z,range,distance);
        }
        public static bool ActorVisible(Game g,float eyeX,float eyeY,float eyeZ,float observerYaw,Actor target)
        {return Character(g,eyeX,eyeY,eyeZ,observerYaw,target,32f+3.5f*g.Level);}
        public static bool SeeImpactSource(Game g,float eyeX,float eyeY,float eyeZ,Actor shooter)
        {
            if(shooter==null||!shooter.Alive)return false;
            // Directional contact tells the victim where to look. Identification still
            // needs a visible body in the actual landscape, weather and illumination.
            float yaw=(float)Math.Atan2(shooter.X-eyeX,shooter.Z-eyeZ);
            return Character(g,eyeX,eyeY,eyeZ,yaw,shooter,78f);
        }
        public static bool SeeActor(Game g,Actor observer,Actor target)
        {
            if(observer==null||!observer.Alive||observer==target)return false;
            return Character(g,observer.X,observer.Y+(observer.Crouch?1.04f:1.58f),observer.Z,observer.Yaw,target,
                (32f+3.5f*g.Level)*g.VisibilityFactor(observer));
        }
        public static float HearingRange(Game g,Actor listener,Noise n)
        {
            if(listener==null||n==null||g.Time-n.Time>5f||g.Time<n.Time)return 0;
            float range=n.Range*(g.Rain?.78f:1f),d=Distance(listener.X,listener.Z,n.X,n.Z);
            if(d>=range)return range;
            float sourceY=float.IsNaN(n.Y)?Arena.Ground(g,n.X,n.Z)+.79f:n.Y;
            bool open=Arena.Clear(g,listener.X,listener.Y+1.27f,listener.Z,n.X,sourceY,n.Z);
            return open?range:range*.68f;
        }
    }
}
