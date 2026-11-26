using System;
using System.Collections.Generic;

namespace LastSignal
{
    public static partial class Arena
    {
        static readonly float[,] HornSection={
            {0,0,6,7.5f,0},{0,-2,5.65f,7,0},{-.15f,-4,5.05f,6.45f,0},{-.36f,-6,4.45f,5.65f,0},
            {-.4f,-8,3.55f,4.8f,0},{-.05f,-10,2.65f,3.95f,0},{.55f,-11.8f,1.9f,3.25f,.1f},
            {1.6f,-13.2f,1.35f,2.55f,.6f},{2.9f,-14,.88f,1.85f,1.45f},{4.1f,-14.15f,.5f,1.15f,2.65f},
            {4.85f,-13.45f,.25f,.65f,3.7f},{4.9f,-12.8f,.06f,.16f,4.40f}};
        struct V3
        {
            public float x,y,z;
            public V3(float X,float Y,float Z){x=X;y=Y;z=Z;}
            public static V3 operator-(V3 a,V3 b){return new V3(a.x-b.x,a.y-b.y,a.z-b.z);}
            public static V3 Cross(V3 a,V3 b){return new V3(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);}
            public static float Dot(V3 a,V3 b){return a.x*b.x+a.y*b.y+a.z*b.z;}
        }
        struct Facet {public V3 a,u,v; public Facet(V3 A,V3 B,V3 C){a=A;u=B-A;v=C-A;}}
        static readonly Facet[] hornMesh=HornMesh();
        static V3 HornRing(int i,int j)
        {
            float a=j*(float)(Math.PI*2/24);
            return new V3(HornSection[i,0]+HornSection[i,2]*Cos(a),
                HornSection[i,4]+Math.Max(-.19f,HornSection[i,3]*(.2f+.8f*Sin(a))),HornSection[i,1]);
        }
        static Facet[] HornMesh()
        {
            List<Facet> faces=new List<Facet>();
            for(int i=0;i<HornSection.GetLength(0)-1;i++) for(int j=0;j<24;j++)
            {
                V3 a=HornRing(i,j),b=HornRing(i,j+1),c=HornRing(i+1,j+1),d=HornRing(i+1,j);
                faces.Add(new Facet(a,b,c));faces.Add(new Facet(a,c,d));
            }
            return faces.ToArray();
        }
        static bool HornBlocks(float x,float foot,float z,float r,float h)
        {
            if(z>r*.90f || z < -14.55f-r) return false;
            if(z< -11.7f)
            {
                if(z< -12.3f && x>2f-r && x<5.05f+r && foot+h>1.50f && foot<4.76f)return true;
                return x>-.7f-r && x<3.05f+r && foot<3.35f;
            }
            int n=0;while(n<5 && z<HornSection[n+1,1])n++;
            float k=Clamp01((z-HornSection[n,1])/(HornSection[n+1,1]-HornSection[n,1]));
            float center=HornSection[n,0]+(HornSection[n+1,0]-HornSection[n,0])*k;
            float rx=HornSection[n,2]+(HornSection[n+1,2]-HornSection[n,2])*k;
            float roof=HornSection[n,3]+(HornSection[n+1,3]-HornSection[n,3])*k;
            float ax=Math.Abs(x-center);
            if(foot>roof+.12f||ax>rx+r+.08f)return false;
            if(ax>rx-r-.10f)return true;
            float u=Math.Min(1f,(ax+r+.08f)/rx);
            float arch=roof*(.2f+.8f*(float)Math.Sqrt(1-u*u));
            return foot<arch+.13f && foot+h>arch-.12f;
        }
        // Points in the open aisle between the weapon stands and around the flared
        // lip. Check each connection against the current solid geometry before use.
        static readonly float[,] vaultLane={
            {-.44f,-9.45f},{-.52f,-6.12f},{-.44f,-2.75f},{-.40f,3.65f},
            {-3.77f,-6.12f},{-4.05f,-2.62f},{3.58f,-2.67f},
            {-7.34f,3.84f},{7.34f,3.84f},{-7.25f,-6.2f},{7.25f,-6.2f},
            {-7.1f,-15.65f},{7.1f,-15.65f}
        };
        sealed class VaultPaths {
            public int Revision=-1;
            public readonly float[,] Cost=new float[vaultLane.GetLength(0),vaultLane.GetLength(0)];
            public readonly float[] ToTarget=new float[vaultLane.GetLength(0)];
        }
        static readonly System.Runtime.CompilerServices.ConditionalWeakTable<Field,VaultPaths> vaultRoutes=
            new System.Runtime.CompilerServices.ConditionalWeakTable<Field,VaultPaths>();
        static bool VaultLaneOpen(Game g,float x,float z,float tx,float tz)
        {
            float dx=tx-x,dz=tz-z,length=(float)Math.Sqrt(dx*dx+dz*dz);
            if(length<.01f)return true;
            int steps=Math.Max(1,(int)Math.Ceiling(Math.Min(length,34)/.32f));
            float stride=Math.Min(length,34)/steps,ox=x,oz=z;
            for(int n=1;n<=steps;n++){
                x=ox+dx*(n*stride/length);z=oz+dz*(n*stride/length);
                if(Math.Abs(x)>11.2f||z>10.9f||z< -16.35f)return true;
                if(!CanStand(g,x,Height(x,z),z,.34f,1.72f))return false;
            }
            return true;
        }
        public static bool VaultExit(Game g,float x,float z,float targetX,float targetZ,out float nextX,out float nextZ)
        {
            nextX=targetX;nextZ=targetZ;
            if(Math.Abs(x)>9.8f||z< -15.9f||z>5.2f||targetX*targetX+targetZ*targetZ<16*16)return false;
            if(VaultLaneOpen(g,x,z,targetX,targetZ))return false;
            Field field=fields.GetOrCreateValue(g);VaultPaths paths=vaultRoutes.GetValue(field,k=>new VaultPaths());
            int count=vaultLane.GetLength(0);
            if(paths.Revision!=field.Revision){
                paths.Revision=field.Revision;
                for(int i=0;i<count;i++)for(int j=i;j<count;j++){
                    float ax=vaultLane[i,0],az=vaultLane[i,1],bx=vaultLane[j,0],bz=vaultLane[j,1];
                    paths.Cost[i,j]=paths.Cost[j,i]=VaultLaneOpen(g,ax,az,bx,bz)?Game.Distance(ax,az,bx,bz):float.PositiveInfinity;
                }
                for(int k=0;k<count;k++)for(int i=0;i<count;i++)for(int j=0;j<count;j++)
                    paths.Cost[i,j]=Math.Min(paths.Cost[i,j],paths.Cost[i,k]+paths.Cost[k,j]);
            }
            for(int i=0;i<count;i++){
                float ax=vaultLane[i,0],az=vaultLane[i,1];
                paths.ToTarget[i]=VaultLaneOpen(g,ax,az,targetX,targetZ)?Game.Distance(ax,az,targetX,targetZ):float.PositiveInfinity;
            }
            float best=float.PositiveInfinity;
            for(int i=0;i<count;i++){
                float ax=vaultLane[i,0],az=vaultLane[i,1],d=Game.Distance(x,z,ax,az);
                if(d<.22f||!VaultLaneOpen(g,x,z,ax,az))continue;
                for(int j=0;j<count;j++){
                    float score=d+paths.Cost[i,j]+paths.ToTarget[j];
                    if(score>=best)continue;best=score;nextX=ax;nextZ=az;
                }
            }
            return !float.IsPositiveInfinity(best);
        }
        static void Local(Body b,float x,float z,out float lx,out float lz)
        {
            x-=b.X;z-=b.Z;lx=x*b.C-z*b.S;lz=x*b.S+z*b.C;
        }
        static float FloorOn(Body b,float x,float z)
        {
            float lx,lz;Local(b,x,z,out lx,out lz);
            // Rotated neighbours can put a mathematically shared edge a fraction
            // of a millimetre apart after world/local coordinate conversion.
            float seam=b.Type=="ramp"||b.Type=="deck"?.002f:0;
            if(Math.Abs(lx)>b.HalfX+seam || Math.Abs(lz)>b.HalfZ+seam)return -10000f;
            if(b.Type=="disc" && lx*lx+lz*lz>b.HalfX*b.HalfX)return -10000f;
            if(b.Type=="ramp")return b.Y+b.H*Clamp01((lz+b.HalfZ)/(2*b.HalfZ));
            return b.Y+b.H;
        }
        // Spawn points, vegetation and terrain routes are at the arena's permanent
        // surface. Movers and loose objects choose a storey using their own height.
        public static float Ground(Game g,float x,float z)
        {
            Prop ignored;return FindFloor(g,x,z,float.PositiveInfinity,false,out ignored);
        }
        public static float GroundBelow(Game g,float x,float z,float maxY)
        {
            Prop ignored;return FindFloor(g,x,z,maxY,true,out ignored);
        }
        public static Prop WalkSurface(Game g,float x,float footY,float z)
        {
            Prop prop;float y=FindFloor(g,x,z,footY+.09f,true,out prop);
            return Math.Abs(footY-y)<=.10f?prop:null;
        }
        static float FindFloor(Game g,float x,float z,float maxY,bool forts,out Prop surface)
        {
            surface=null;float floor=Height(x,z);List<Body> list=fields.GetOrCreateValue(g).Bodies[Index(x,z)];
            if(list!=null) for(int i=0;i<list.Count;i++)
            {
                Body b=list[i]; if(!b.Floor||b.Retired||b.Prop.Removed)continue;
                if(!forts&&(b.Type=="deck"||b.Type=="ramp"))continue;
                float top=FloorOn(b,x,z);
                if(top>=floor && top<=maxY+.001f){floor=top;surface=b.Prop;}
            }return floor;
        }
        public static void SettleLooseItems(Game g,float x,float z,float radius)
        {
            Field f=fields.GetOrCreateValue(g);
            for(int iz=Cell(z-radius);iz<=Cell(z+radius);iz++)
            for(int ix=Cell(x-radius);ix<=Cell(x+radius);ix++)
            {
                List<Prop> items=f.Nearby[ix+iz*Cells];if(items==null)continue;
                foreach(Prop item in items)
                {
                    if(item.Removed||(item.Kind!="pickup"&&item.Kind!="pack"))continue;
                    float dx=item.X-x,dz=item.Z-z;
                    if(dx*dx+dz*dz>radius*radius)continue;
                    float y=GroundBelow(g,item.X,item.Z,item.Y+.10f)+(item.Kind=="pickup"?.035f:0);
                    if(item.Y-y>.12f)item.Y=y;
                }
            }
        }
        public static float WetDepth(Game g,float x,float z)
        {
            float level=Surface(x,z,g.Flood);
            return level< -9000f ? 0f : Math.Max(0f,level-Ground(g,x,z));
        }
        public static float WetDepth(Game g,float x,float z,float footY)
        {
            return Math.Max(0,Surface(x,z,g.Flood)-footY);
        }
        // From a bank, a wading edge or a bridge, find a reachable patch of open water.
        // A solid barrier between the contestant and the sampled surface blocks drawing water.
        public static bool Shore(Game g,float x,float z,out float waterX,out float waterZ)
        {
            waterX=x;waterZ=z;
            if(x*x+z*z>Radius*Radius || WetDepth(g,x,z)>.57f)return false;
            float ground=Ground(g,x,z),ownLevel=Surface(x,z,g.Flood);
            if(ownLevel< -9000f && (x<32.5f||Math.Abs(z)>x*.84f+4f))return false;
            if(ownLevel> -9000f && ground>ownLevel+2.1f)return false;
            float eyeY=ground+1.08f;
            for(int ring=0;ring<4;ring++)
            {
                float radius=ring==0?0:ring==1?.70f:ring==2?1.50f:2.44f;
                int samples=ring==0?1:12;
                for(int i=0;i<samples;i++)
                {
                    float angle=i*.5235988f,px=x+radius*Sin(angle),pz=z+radius*Cos(angle);
                    float level=Surface(px,pz,g.Flood);
                    if(level< -9000f || level-Ground(g,px,pz)<.07f)continue;
                    if(!Clear(g,x,eyeY,z,px,level+.05f,pz))continue;
                    waterX=px;waterZ=pz;return true;
                }
            }
            return false;
        }
        static bool Blocks(Body b,float x,float y,float z,float radius,float h)
        {
            if(b.Retired||b.Prop.Removed||!b.Prop.Solid||y>=b.Y+b.H-.08f||y+h<=b.Y+.04f)return false;
            float lx,lz;Local(b,x,z,out lx,out lz);
            if(Math.Abs(lx)>b.HalfX+radius||Math.Abs(lz)>b.HalfZ+radius)return false;
            if(b.Type=="horn")return HornBlocks(x-b.Prop.X,y-b.Prop.Y,z-b.Prop.Z,radius,h);
            if(b.Type=="ramp")
            {
                float top=b.Y+b.H*Clamp01((lz+b.HalfZ)/(2*b.HalfZ));
                float under=b.Y+b.H*Clamp01((lz-radius+b.HalfZ)/(2*b.HalfZ))-.15f;
                return top-y>.44f && y+h>under+.01f;
            }
            if(b.Type=="roof")
            {
                float top=b.Y+b.H*Clamp01((lz+b.HalfZ)/(2*b.HalfZ)),margin=.055f+radius*b.H/(2*b.HalfZ);
                return y<top+margin && y+h>top-margin;
            }
            if(b.Type=="disc" || b.Type=="trunk" || b.Type=="stone")
            {
                float scale=b.Type=="stone"?StoneScale(b,y):1;
                return EllipseDistanceSquared(lx,lz,b.HalfX*scale+radius,b.HalfZ*scale+radius)<1 &&
                    (!b.Floor||b.Y+b.H-y>.44f);
            }
            if(b.Floor&&b.Y+b.H-y<=.45f)return false;
            float ex=Math.Max(0,Math.Abs(lx)-b.HalfX),ez=Math.Max(0,Math.Abs(lz)-b.HalfZ);
            return ex*ex+ez*ez<radius*radius;
        }
        static float StoneScale(Body b,float foot)
        {
            float q=Math.Max(0,(foot+.14f-b.Y-b.H*.32f)/(b.H*.68f));
            return (float)Math.Sqrt(Math.Max(0,1-q*q));
        }
        static float EllipseDistanceSquared(float x,float z,float rx,float rz)
        {
            x/=rx;z/=rz;
            return x*x+z*z;
        }
        static bool AdvancesOutOfStone(Body b,Actor mover,float x,float z,float radius,float h)
        {
            if(!Blocks(b,mover.X,mover.Y,mover.Z,radius,h))return false;
            float beforeX,beforeZ,afterX,afterZ;
            Local(b,mover.X,mover.Z,out beforeX,out beforeZ);
            Local(b,x,z,out afterX,out afterZ);
            float scale=StoneScale(b,mover.Y);
            float rx=b.HalfX*scale+radius,rz=b.HalfZ*scale+radius;
            return EllipseDistanceSquared(afterX,afterZ,rx,rz)>EllipseDistanceSquared(beforeX,beforeZ,rx,rz);
        }
        public static bool CanStand(Game g,float x,float footY,float z){return CanStand(g,x,footY,z,.30f,1.68f);}
        static bool CanStand(Game g,float x,float footY,float z,float radius,float h,Prop tread=null,Actor mover=null)
        {
            if(x*x+z*z>(Radius-radius)*(Radius-radius))return false;
            List<Body> list=fields.GetOrCreateValue(g).Bodies[Index(x,z)];
            if(list!=null)for(int i=0;i<list.Count;i++){
                Body b=list[i];
                bool stone=b.Type=="stone";
                float y=mover!=null&&!stone?footY+.009f:footY;
                if(!Blocks(b,x,y,z,radius,h))continue;
                if(stone&&mover!=null&&AdvancesOutOfStone(b,mover,x,z,radius,h))continue;
                // The last portion of a tread overlaps the lip of its supporting
                // wall. Let feet on the ramp step over that lip as they crest it.
                if(tread!=null && tread.Model=="ramp" && FencePiece(b.Prop.Model) &&
                   Math.Abs(tread.Y+tread.H-b.Y-b.H)<.20f && b.Y+b.H-y<=.44f)continue;
                return false;
            }
            return true;
        }
        static bool FreeStep(Game g,Actor actor,float x,float y,float z,float h,Prop tread)
        {
            if(!CanStand(g,x,y,z,.30f,h,tread,actor))return false;
            y+=.009f;
            const float gap=.56f;
            for(int i=0;i<g.Actors.Count;i++)
            {
                Actor other=g.Actors[i];
                if(other==actor||!other.Alive||y>=other.Y+(other.Crouch?1.15f:1.69f)||y+h<=other.Y)continue;
                float dx=x-other.X,dz=z-other.Z;
                if(Math.Abs(dx)>=gap||Math.Abs(dz)>=gap)continue;
                float ds=dx*dx+dz*dz;if(ds>=gap*gap)continue;
                // If a change in elevation made two capsules overlap, always allow them to part.
                float ox=actor.X-other.X,oz=actor.Z-other.Z;
                if(ds<=ox*ox+oz*oz+.000001f)return false;
            }
            return true;
        }
        public static void Move(Game g,Actor a,float dx,float dz)
        {
            float len2=dx*dx+dz*dz;if(len2<.00000001f)return;
            int steps=len2<.1024f?1:(int)Math.Ceiling(Math.Sqrt(len2)/.32);
            dx/=steps;dz/=steps;float h=a.Crouch?1.10f:1.70f;
            for(int n=0;n<steps;n++)
            {
                if(WalkStep(g,a,a.X+dx,a.Z+dz,h))continue;
                if(dx!=0)WalkStep(g,a,a.X+dx,a.Z,h);
                if(dz!=0)WalkStep(g,a,a.X,a.Z+dz,h);
            }
        }
        static bool WalkStep(Game g,Actor a,float x,float z,float h)
        {
            float available=a.Vertical>0?.025f:.44f;
            Prop support;
            float next=FindFloor(g,x,z,a.Y+available,true,out support);
            float foot=Math.Max(a.Y,next);
            if(!FreeStep(g,a,x,foot,z,h,support))return false;
            a.X=x;a.Z=z;a.Y=foot;
            // Track a descending tread. Larger drops belong to the vertical sweep.
            if(a.Vertical<=0 && foot-next<.32f)a.Y=StoneLanding(g,x,z,foot,next,h);
            return true;
        }
        static float StoneLanding(Game g,float x,float z,float from,float to,float h)
        {
            if(from<=to)return to;
            List<Body> bodies=fields.GetOrCreateValue(g).Bodies[Index(x,z)];
            if(bodies==null)return to;
            foreach(Body body in bodies){
                if(body.Type!="stone")continue;
                // A rock widens toward its base. Find the last clear foot height
                // along the drop so a landing cannot put the actor inside that wider part.
                float blocked=Math.Max(to,body.Y);
                if(blocked>=from || !Blocks(body,x,blocked,z,.30f,h) || Blocks(body,x,from,z,.30f,h))continue;
                float clear=from;
                for(int i=0;i<12;i++){
                    float middle=(blocked+clear)*.5f;
                    if(Blocks(body,x,middle,z,.30f,h))blocked=middle;else clear=middle;
                }
                to=clear;
            }
            return to;
        }
        internal static bool CanJump(Game g,Actor a)
        {
            float below=a.Y-.10f;
            return GroundBelow(g,a.X,a.Z,a.Y+.08f)>=below ||
                StoneLanding(g,a.X,a.Z,a.Y,below,a.Crouch?1.10f:1.70f)>below;
        }
        internal static void StepVertical(Game g,Actor a,float dt)
        {
            float foot=a.Y,baseY=GroundBelow(g,a.X,a.Z,foot+.06f);
            a.Vertical-=15.8f*dt;
            float next=foot+a.Vertical*dt;
            float h=a.Crouch?1.10f:1.70f;
            if(next<=foot || next<=baseY){
                float end=Math.Max(next,baseY);
                a.Y=StoneLanding(g,a.X,a.Z,foot,end,h);
                if(next<=baseY||a.Y>end)a.Vertical=0;
                return;
            }
            List<Body> bodies=fields.GetOrCreateValue(g).Bodies[Index(a.X,a.Z)];
            if(bodies!=null)foreach(Body body in bodies){
                if(body.Retired||body.Prop.Removed||!body.Prop.Solid)continue;
                float lx,lz;Local(body,a.X,a.Z,out lx,out lz);
                float ex=Math.Max(0,Math.Abs(lx)-body.HalfX),ez=Math.Max(0,Math.Abs(lz)-body.HalfZ);
                if(ex*ex+ez*ez>.30f*.30f)continue;
                float bottom=body.Y;
                if(body.Type=="ramp"||body.Type=="roof")
                    bottom+=body.H*Clamp01((lz-.30f+body.HalfZ)/(2*body.HalfZ))-(body.Type=="ramp"?.15f:.055f);
                if(bottom<foot+h-.012f || bottom>next+h)continue;
                next=Math.Max(foot,bottom-h-.004f);a.Vertical=0;
            }
            a.Y=next;
        }
        static bool Slab(float origin,float dir,float low,float high,ref float lo,ref float hi)
        {
            if(Math.Abs(dir)<.000001f)return origin>=low&&origin<=high;
            float a=(low-origin)/dir,b=(high-origin)/dir;
            if(a>b){float t=a;a=b;b=t;} if(a>lo)lo=a;if(b<hi)hi=b;return lo<=hi;
        }
        static bool EllipseInterval(float x,float z,float dx,float dz,float rx,float rz,ref float lo,ref float hi)
        {
            x/=rx;z/=rz;dx/=rx;dz/=rz;
            float a=dx*dx+dz*dz,b=x*dx+z*dz,c=x*x+z*z-1;
            if(a<.0000001f)return c<=0;
            float disc=b*b-a*c;if(disc<0)return false;float s=(float)Math.Sqrt(disc);
            lo=Math.Max(lo,(-b-s)/a);hi=Math.Min(hi,(-b+s)/a);return lo<=hi;
        }
        static float Intersect(Body b,float x,float y,float z,float dx,float dy,float dz,float max)
        {
            float lx,lz;Local(b,x,z,out lx,out lz);float ly=y-b.Y,ux=dx*b.C-dz*b.S,uz=dx*b.S+dz*b.C;
            float lo=0.0001f,hi=max;
            if(!Slab(lx,ux,-b.HalfX,b.HalfX,ref lo,ref hi)||!Slab(lz,uz,-b.HalfZ,b.HalfZ,ref lo,ref hi)||!Slab(ly,dy,0,b.H,ref lo,ref hi))return max;
            if(b.Type=="horn")
            {
                V3 origin=new V3(x-b.Prop.X,y-b.Prop.Y,z-b.Prop.Z),dir=new V3(dx,dy,dz);
                float best=max;
                for(int i=0;i<hornMesh.Length;i++)
                {
                    Facet t=hornMesh[i];V3 h=V3.Cross(dir,t.v);float det=V3.Dot(t.u,h);if(Math.Abs(det)<.000001f)continue;
                    float inv=1/det;V3 s=origin-t.a;float u=inv*V3.Dot(s,h);if(u<-.0001f||u>1.0001f)continue;
                    V3 q=V3.Cross(s,t.u);float v=inv*V3.Dot(dir,q);if(v<-.0001f||u+v>1.0001f)continue;
                    float d=inv*V3.Dot(t.v,q);if(d>.009f && d<best)best=d;
                }return best;
            }
            if(b.Type=="ramp"||b.Type=="roof")
            {
                float slope=b.H/(2*b.HalfZ),side=ly-slope*(lz+b.HalfZ),rate=dy-slope*uz;
                if(!Slab(side,rate,b.Type=="roof"?-.055f:-.15f,b.Type=="roof"?.055f:0f,ref lo,ref hi))return max;
            }
            else if(b.Type=="trunk"||b.Type=="disc")
            { if(!EllipseInterval(lx,lz,ux,uz,b.HalfX,b.HalfZ,ref lo,ref hi))return max; }
            else if(b.Type=="stone")
            {
                float ax=lx/b.HalfX,ay=(ly-b.H*.32f)/(b.H*.68f),az=lz/b.HalfZ;
                float vx=ux/b.HalfX,vy=dy/(b.H*.68f),vz=uz/b.HalfZ;
                float a=vx*vx+vy*vy+vz*vz, q=ax*vx+ay*vy+az*vz,dist=q*q-a*(ax*ax+ay*ay+az*az-1);
                if(dist<0)return max;float root=(float)Math.Sqrt(dist);
                lo=Math.Max(lo,(-q-root)/a);hi=Math.Min(hi,(-q+root)/a);if(lo>hi)return max;
            }
            return lo;
        }
        public static Prop RayProp(Game g,float x,float y,float z,float dx,float dy,float dz,float max,out float distance)
        {
            distance=max;if(max<=0)return null;
            Field f=fields.GetOrCreateValue(g);int stamp=++f.Stamp;Prop hit=null;
            int ix=Cell(x),iz=Cell(z),sx=dx>=0?1:-1,sz=dz>=0?1:-1;
            float deltaX=Math.Abs(dx)<.0000001f?float.PositiveInfinity:CellSize/Math.Abs(dx);
            float deltaZ=Math.Abs(dz)<.0000001f?float.PositiveInfinity:CellSize/Math.Abs(dz);
            float nextX=float.IsInfinity(deltaX)?deltaX:((ix+(sx>0?1:0))*CellSize-Origin-x)/dx;
            float nextZ=float.IsInfinity(deltaZ)?deltaZ:((iz+(sz>0?1:0))*CellSize-Origin-z)/dz;
            for(int iter=0;iter<Cells*2+4;iter++)
            {
                List<Body> list=f.Bodies[ix+iz*Cells];
                if(list!=null) for(int i=0;i<list.Count;i++)
                {
                    Body b=list[i];if(b.Stamp==stamp||b.Retired||b.Prop.Removed||(!b.Prop.Opaque&&!b.Prop.Solid))continue;b.Stamp=stamp;
                    float t=Intersect(b,x,y,z,dx,dy,dz,distance);if(t<distance){distance=t;hit=b.Prop;}
                }
                if(Math.Min(nextX,nextZ)>distance)break;
                if(nextX<nextZ){ix+=sx;nextX+=deltaX;}else{iz+=sz;nextZ+=deltaZ;}
                if(ix<0||iz<0||ix>=Cells||iz>=Cells)break;
            }
            // Terrain is sampled from the same continuous field as navigation and drawing.
            float prev=0,t0=Math.Min(.055f,distance);
            if(y+dy*t0<Height(x+dx*t0,z+dz*t0)-.015f){distance=t0;return null;}
            float stride=Math.Abs(dy)>.65f?.76f:1.30f;
            for(float t=Math.Min(distance,stride);t>prev;t=Math.Min(distance,t+stride))
            {
                if(y+dy*t<Height(x+dx*t,z+dz*t)-.015f)
                {
                    float low=prev,high=t;
                    for(int j=0;j<7;j++){float mid=(low+high)*.5f;if(y+dy*mid<Height(x+dx*mid,z+dz*mid))high=mid;else low=mid;}
                    distance=high;return null;
                }
                if(t>=distance)break;prev=t;
            }
            return hit;
        }
        public static bool Clear(Game g,float x,float y,float z,float tx,float ty,float tz)
        {
            float dx=tx-x,dy=ty-y,dz=tz-z,dist=(float)Math.Sqrt(dx*dx+dy*dy+dz*dz);
            if(dist<.035f)return true;float limit=dist-.025f,hit;RayProp(g,x,y,z,dx/dist,dy/dist,dz/dist,limit,out hit);return hit>=limit;
        }
        public static float Cover(Game g,float x,float z)
        {
            Field f=fields.GetOrCreateValue(g);float cover=0;
            for(int iz=Cell(z-2.4f);iz<=Cell(z+2.4f);iz++)
            for(int ix=Cell(x-2.4f);ix<=Cell(x+2.4f);ix++)
            {
                List<Prop> list=f.Nearby[ix+iz*Cells];if(list==null)continue;
                for(int i=0;i<list.Count;i++)
                {
                    Prop p=list[i];if(p.Removed||p.Kind!="vegetation")continue;
                    float dx=x-p.X,dz=z-p.Z,rr=p.W*.54f+.3f,sq=dx*dx+dz*dz;
                    if(sq>=rr*rr)continue;
                    float w=1-Smooth(.34f,1f,sq/(rr*rr));
                    float density=p.Model=="grass"||p.Model=="flowers"?.30f:p.Model=="rushes"?.72f:1f;
                    cover=Math.Max(cover,w*density);
                }
            }return cover;
        }
    }
}
