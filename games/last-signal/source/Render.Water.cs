using System;
using System.Collections.Generic;
namespace LastSignal
{
    public sealed partial class Renderer
    {
        struct RiverVertex {
            public float X,Z,Level,Bed;
        }
        struct Ripple {
            public float X,Z,Y,Dx,Dz,Phase,Width,Length,Depth;
            public bool Basin;
        }
        readonly List<Ripple> ripples=new List<Ripple>();
        uint streamMesh,basinMesh,flowTexture;
        static readonly float[] waterShine={.80f,.86f,.81f,1};
        void BuildWater(){
            if(flowTexture==0)flowTexture=LoadTexture("current.png",true);
            const float step=1.5f;
            int extent=(int)Math.Ceiling((Arena.Radius+13)/step),size=extent*2+1;
            RiverVertex[] nodes=new RiverVertex[size*size];
            for(int j=0;j<size;j++)for(int i=0;i<size;i++){
                float x=(i-extent)*step,z=(j-extent)*step;
                nodes[j*size+i]=new RiverVertex{X=x,Z=z,Bed=Arena.Height(x,z),Level=Arena.Surface(x,z,false)};
            }
            for(int pass=0;pass<2;pass++){
                bool basin=pass==1;uint list=OpenList();glBegin(Triangles);
                for(int j=0;j<size-1;j++)for(int i=0;i<size-1;i++){
                    int idx=j*size+i;RiverVertex a=nodes[idx],b=nodes[idx+size],c=nodes[idx+size+1],d=nodes[idx+1];
                    if((a.X>Math.Abs(a.Z))!=basin)continue;
                    float surface=Math.Max(Math.Max(a.Level,b.Level),Math.Max(c.Level,d.Level));
                    if(surface< -999 || Math.Min(Math.Min(a.Bed,b.Bed),Math.Min(c.Bed,d.Bed))>surface+(basin?.91f:.12f))continue;
                    WaterVertex(a,surface);WaterVertex(b,surface);WaterVertex(c,surface);
                    WaterVertex(a,surface);WaterVertex(c,surface);WaterVertex(d,surface);
                }
                glEnd();glEndList();if(basin)basinMesh=list;else streamMesh=list;
            }
            Random rng=new Random(609241);
            int[] sectors={1,3,4};
            foreach(int district in sectors){
                for(float along=-95;along<95;along+=.36f){
                    float x,z,level,xx,zz,next;
                    Arena.StreamPoint(district,along,out x,out level,out z);
                    Arena.StreamPoint(district,along+.25f,out xx,out next,out zz);
                    float dx=xx-x,dz=zz-z,inv=1f/Math.Max(.01f,(float)Math.Sqrt(dx*dx+dz*dz));
                    dx*=inv;dz*=inv;
                    float across=(float)(rng.NextDouble()*5.9-2.95);
                    x+=dz*across;z-=dx*across;
                    if(next>level){dx=-dx;dz=-dz;}
                    AddRipple(rng,x,z,level,dx,dz,false);
                }
            }
            for(int n=0;n<3400;n++){
                float x=35+(float)rng.NextDouble()*(Arena.Radius-32),z=(float)(rng.NextDouble()*2-1)*103;
                float level=Arena.Surface(x,z,false);
                if(level>-999 && x>Math.Abs(z))AddRipple(rng,x,z,level,-.91f,.41f,true);
            }
        }
        static void WaterVertex(RiverVertex v,float fallback){
            float surface=v.Level> -999?v.Level:fallback;
            float depth=Bound((surface-v.Bed)/1.32f,0,1);
            float grad=.5f+.5f*S(v.X*.20f+v.Z*.13f);
            if(Arena.Variant==1)glColor4f(.38f-depth*.25f,.72f-depth*.18f,.63f-depth*.05f,.49f+depth*.30f);
            else if(Arena.Variant==2)glColor4f(.53f-depth*.34f,.75f-depth*.20f,.81f-depth*.13f,.49f+depth*.30f);
            else glColor4f(.40f-depth*.27f,.61f-depth*.14f+grad*.025f,.50f+depth*.055f,.43f+depth*.29f);
            glNormal3f(.04f*C(v.X*.70f+v.Z*.42f),1,.06f*S(v.Z*.84f-v.X*.49f));
            UV(v.X*.205f+v.Z*.094f,v.Z*.174f-v.X*.087f,v.X,surface+.012f,v.Z);
        }
        void AddRipple(Random rng,float x,float z,float level,float dx,float dz,bool basin){
            float depth=level-Arena.Height(x,z);
            if(depth<.06f)return;
            float size=(float)rng.NextDouble();
            ripples.Add(new Ripple{X=x,Z=z,Y=level+.031f,Dx=dx,Dz=dz,Depth=depth,Basin=basin,
                Phase=(float)rng.NextDouble(),Width=.06f+size*.19f,Length=.17f+.39f*size});
        }
        void DrawWater(Game g){
            float elapsed=Bound(g.Clock-previousClock,0,.25f);previousClock=g.Clock;
            floodLevel=g.Flood?Math.Min(1,floodLevel+elapsed*.38f):Math.Max(0,floodLevel-elapsed*.2f);
            glDepthMask(0);Alpha();Bind(flowTexture);
            glMatrixMode(0x1702);glPushMatrix();glLoadIdentity();
            glTranslatef(Repeat(g.Clock*.012f),Repeat(-g.Clock*.021f),0);glMatrixMode(Modelview);
            glEnable(Light);glMaterialfv(0x0408,0x1202,waterShine);glMaterialf(0x0408,0x1601,28);
            glCallList(streamMesh);glPushMatrix();glTranslatef(0,.85f*floodLevel,0);glCallList(basinMesh);glPopMatrix();
            glMaterialfv(0x0408,0x1202,matte);
            glMatrixMode(0x1702);glPopMatrix();glMatrixMode(Modelview);glDisable(Light);glDisable(Texture);
            float daylight=.38f+.62f*g.Daylight;glBegin(Triangles);
            foreach(Ripple m in ripples){
                if(!Visible(g,m.X,m.Z,2,87))continue;
                float phase=Repeat(g.Clock*(m.Basin?.17f:.25f)+m.Phase);
                float fade=S(phase*Pi),w=m.Width*fade;
                float x=m.X+(phase-.5f)*m.Dx*.88f,z=m.Z+(phase-.5f)*m.Dz*.88f;
                float y=m.Y+(m.Basin?floodLevel*.85f:0);
                float oldX=0,oldZ=0;
                int segments=4;
                for(int k=0;k<=segments;k++){
                    float p=k/(float)segments,bend=S(p*Pi)*w;
                    float px=x+m.Dx*((p-.5f)*2*m.Length)-m.Dz*bend,pz=z+m.Dz*((p-.5f)*2*m.Length)+m.Dx*bend;
                    if(k>0){
                        float prev=(k-1)/(float)segments,alpha=(m.Depth<.32f?.48f:.32f)*fade;
                        float width=.021f+.028f*fade;
                        glColor4f(.83f*daylight,.92f*daylight,.85f*daylight,alpha*S(prev*Pi));glVertex3f(oldX,y,oldZ);
                        glColor4f(.62f,.79f,.75f,0);glVertex3f(oldX-m.Dz*width,y,oldZ+m.Dx*width);
                        glColor4f(.86f*daylight,.94f*daylight,.88f*daylight,alpha*S(p*Pi));glVertex3f(px,y,pz);
                        glVertex3f(px,y,pz);glColor4f(.62f,.79f,.75f,0);glVertex3f(oldX-m.Dz*width,y,oldZ+m.Dx*width);
                        glVertex3f(px-m.Dz*width,y,pz+m.Dx*width);
                    }
                    oldX=px;oldZ=pz;
                }
            }
            glEnd();glDepthMask(1);glDisable(Blend);glEnable(Light);Bind(paint);
        }
    }
}
