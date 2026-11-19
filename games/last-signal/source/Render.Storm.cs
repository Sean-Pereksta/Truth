using System;

namespace LastSignal {
    public sealed partial class Renderer {
        static readonly float[] climateSun={0,1,0,0},climateSpec={1,1,1,1};
        float climateFogStart,climateFogEnd;
        struct StarPoint {public float X,Y,Z,U,V,Size;}
        static readonly StarPoint[] stars=MakeStars();
        static StarPoint[] MakeStars(){
            var rng=new Random(92713);var result=new StarPoint[285];
            for(int i=0;i<result.Length;i++){
                float a=(float)(rng.NextDouble()*Tau),rise=.06f+.93f*(float)rng.NextDouble();
                float altitude=(float)Math.Asin(rise),flat=C(altitude),sz=.034f+.115f*(float)Math.Pow(rng.NextDouble(),2);
                result[i]=new StarPoint {X=155*S(a)*flat,Y=155*rise,Z=155*C(a)*flat,U=C(a),V=-S(a),Size=sz};
            }return result;
        }
        static float Mix(float a,float b,float t){return a+(b-a)*t;}
        static void SkyDisk(float a,float e,float r,float red,float green,float blue,float alpha,bool soft){
            float sn=S(a),cs=C(a),h=C(e),v=S(e),x=sn*h*146,y=v*146,z=cs*h*146;
            glBegin(Fan);glColor4f(red,green,blue,alpha);glVertex3f(x,y,z);glColor4f(red,green,blue,soft?0:alpha);
            for(int i=0;i<=40;i++){float angle=Tau*i/40,ss=S(angle)*r,cc=C(angle)*r;
                glVertex3f(x+cs*cc-sn*v*ss,y+h*ss,z-sn*cc-cs*v*ss);
            }glEnd();
        }
        void DrawClimateSky(Game g){
            float day=g.Mode=="menu"?1:Bound(g.Daylight,0,1),night=1-day;
            float rain=g.Rain?.20f:0,outside=g.StormActive?Bound(-g.StormMargin(g.CamX,g.CamZ)/13,0,1):0;
            float harsh=outside*Bound(.25f+.75f*g.StormStrength,0,1);
            float orange=4*day*night;int arena=g.ArenaId;
            float red=arena==1?1.02f:arena==2?.89f:.98f,green=arena==1?.93f:arena==2?.97f:1,blue=arena==1?.84f:arena==2?1.05f:.98f;
            glColor3f((Mix(.125f,red,day)+orange*.13f)*(1-rain-.19f*harsh),
                Mix(.18f,green,day)*(1-rain-.35f*harsh),Mix(.34f,blue,day)*(1-rain*.56f-.09f*harsh));
            glCallList(skySphere);glDisable(Texture);Alpha();
            float phase=g.Mode=="menu"?120:g.Time%720f;
            float a=(phase/720f)*Tau+1.36f;
            float arc=(phase+55)%720;
            float e=arc<460?-.02f+.98f*S(Pi*arc/460f):-.02f-.64f*S(Pi*(arc-460)/260f);
            float moonA=a+Pi,moonE=.065f-e;
            if(orange>.03f){
                glBegin(Strip);
                for(int i=0;i<=76;i++){float b=Tau*i/76,smoke=orange*(.13f+.32f*Math.Max(0,C(b-a)));
                    glColor4f(.96f,.52f,.28f,smoke);glVertex3f(S(b)*150,1,C(b)*150);
                    glColor4f(.78f,.44f,.52f,0);glVertex3f(S(b)*150,39,C(b)*150);
                }glEnd();
            }
            float starAlpha=Bound((.39f-day)*2.55f,0,1)*(1-rain*2-harsh*.45f);
            if(starAlpha>.015f){
                glColor4f(.79f,.87f,1,starAlpha);glBegin(Quads);
                foreach(StarPoint s in stars){float u=s.U*s.Size,v=s.V*s.Size;
                    glVertex3f(s.X-u,s.Y,s.Z-v);glVertex3f(s.X,s.Y+s.Size*1.24f,s.Z);
                    glVertex3f(s.X+u,s.Y,s.Z+v);glVertex3f(s.X,s.Y-s.Size*1.24f,s.Z);}
                glEnd();
            }
            float orb=(1-rain*2.8f)*(1-harsh*.78f);
            float moon=Bound((.76f-day)*1.7f,0,1)*orb,sun=Bound((day-.035f)*1.65f,0,1)*orb;
            if(moon>.01f&&moonE>-.07f){
                SkyDisk(moonA,moonE,7,.46f,.65f,.96f,.22f*moon,true);SkyDisk(moonA,moonE,1.84f,.83f,.88f,.97f,.86f*moon,false);
                SkyDisk(moonA-.0046f,moonE+.0032f,.40f,.59f,.67f,.81f,.52f*moon,true);
            }
            if(sun>.01f&&e>-.08f){
                SkyDisk(a,e,12,1,.76f,.42f,.37f*sun,true);SkyDisk(a,e,2.13f,1,.91f,.71f,.88f*sun,false);
            }
            glDisable(Blend);
            frameAmbient[0]=Mix(.155f,.51f*red,day)*(1-rain*.25f-harsh*.18f);
            frameAmbient[1]=Mix(.19f,.53f*green,day)*(1-rain*.25f-harsh*.26f);
            frameAmbient[2]=Mix(.27f,.55f*blue,day)*(1-rain*.17f)+harsh*.024f;frameAmbient[3]=1;
            frameSun[0]=Mix(.16f,.79f*red,day)*(1-rain-harsh*.27f)+orange*.15f;
            frameSun[1]=Mix(.22f,.72f*green,day)*(1-rain-harsh*.33f);
            frameSun[2]=Mix(.36f,.57f*blue,day)*(1-rain*.6f-harsh*.2f);frameSun[3]=1;
            float sunShare=Bound((day-.19f)*2.2f,0,1);
            climateSun[0]=Mix(S(moonA)*C(moonE),S(a)*C(e),sunShare);
            climateSun[1]=Math.Max(.16f,Mix(S(moonE),S(e),sunShare));
            climateSun[2]=Mix(C(moonA)*C(moonE),C(a)*C(e),sunShare);
            climateSpec[0]=Mix(.35f,1,day);climateSpec[1]=Mix(.44f,.9f,day);climateSpec[2]=Mix(.69f,.67f,day);
            frameFog[0]=Mix(Mix(.10f,.55f*red,day)+orange*.09f,.27f,harsh*.65f)*(1-rain*.6f);
            frameFog[1]=Mix(Mix(.14f,.63f*green,day),.20f,harsh*.71f)*(1-rain*.6f);
            frameFog[2]=Mix(Mix(.23f,.61f*blue,day),.39f,harsh*.68f)*(1-rain*.35f);frameFog[3]=1;
            climateFogStart=Mix(Mix(37,74,day),9,harsh)-rain*32;
            climateFogEnd=Mix(Mix(165,298,day),66,harsh)-rain*125;
        }
        static void FrontBand(Game g,float radius,int row,bool forecast){
            const int segments=144;float t=g.Clock*.42f;glBegin(Strip);
            for(int i=0;i<=segments;i++){
                float a=Tau*i/segments,s=S(a),c=C(a),fold=.68f*S(11*a+t)+.33f*C(27*a-t*.63f);
                float x=g.StormX+s*radius,z=g.StormZ+c*radius,y=Arena.Height(x,z);
                float high=39+8*S(a*5+t*.15f)+4*C(a*9-.5f*t);
                float detail=.5f+.5f*S(a*27+t+.9f*S(a*11-t*.45f));
                float skirt=forecast?.16f:.19f+.105f*g.StormStrength;
                for(int corner=0;corner<2;corner++){
                    int level=row+corner;float h,edge,alpha;
                    switch(level){
                        case 0:h=-.45f;edge=0;alpha=skirt+.15f;break;
                        case 1:h=forecast?.24f:.46f;edge=.10f;alpha=forecast?.46f:.49f;break;
                        case 2:h=forecast?1.4f:4.7f+fold;edge=.35f;alpha=skirt*(.59f+.4f*detail);break;
                        case 3:h=forecast?3.3f:high*.66f;edge=1.78f;alpha=skirt*(.54f+.42f*detail);break;
                        default:h=forecast?5:high+16;edge=4.7f;alpha=.025f;break;
                    }
                    if(level==1)glColor4f(.72f,.77f,1,alpha);
                    else glColor4f(.22f+.13f*detail,.22f+.11f*detail,.46f+.16f*detail,forecast?alpha*.69f:alpha);
                    glVertex3f(x+s*edge,y+h,z+c*edge);
                }
            }glEnd();
        }
        void StormClouds(Game g,float radius){
            // Wide drifting wisps give the boundary a soft body against trees and cliffs.
            Bind(smoke);float t=g.Clock*.077f;
            for(int layer=1;layer>=0;layer--){
                int count=layer==1?118:104;
                for(int i=0;i<count;i++){
                    float offset=.09f*S(i*1.73f+t*.41f);
                    float a=Tau*(i+.42f*layer)/count+.006f*t+offset*.10f,cs=C(a),sn=S(a);
                    float b=.5f+.5f*S(i*2.38f+t),cycle=.5f+.5f*C(t*.47f+i*3.17f);
                    float rr=radius+1.5f+layer*2+b*2f,x=g.StormX+rr*sn,z=g.StormZ+rr*cs;
                    if(!Visible(g,x,z,19,162))continue;
                    float y=Arena.Height(x,z)+1.3f+layer*(4.5f+4*b);
                    float width=Math.Min(18f,1f+radius*.077f)*(1+b*.62f);
                    float height=1.9f+layer*(5.5f+2.2f*cycle)+cycle*1.4f;
                    glColor4f(.83f,.84f,1f,(.36f+.24f*cycle)*(.70f+.30f*g.StormStrength));
                    Sprite(x,y,z,width,height,i%4,2);
                }
            }
            glDisable(Texture);
        }
        static void DrawNextEye(Game g){
            float r=g.StormNextRadius;if(r<1||Math.Abs(r-g.StormRadius)<10)return;
            glBegin(Lines);for(int i=0;i<150;i++){
                float a=Tau*i/150,b=Tau*(i+.58f)/150;
                float x=g.StormNextX+r*S(a),z=g.StormNextZ+r*C(a),xx=g.StormNextX+r*S(b),zz=g.StormNextZ+r*C(b);
                glColor4f(.75f,.79f,1,.6f);glVertex3f(x,Arena.Height(x,z)+.20f,z);glVertex3f(xx,Arena.Height(xx,zz)+.20f,zz);
            }glEnd();
        }
        void DrawStormFront(Game g){
            if(g.Mode=="menu"||!g.StormActive&&!g.StormWarning)return;
            bool forecast=!g.StormActive;float radius=forecast?g.StormNextRadius:g.StormRadius;if(radius<.55f)return;
            glEnable(Depth);glDisable(Light);glDisable(Fog);glDisable(Texture);glDepthMask(0);Alpha();
            for(int row=0;row<(forecast?2:4);row++)FrontBand(g,radius,row,forecast);
            // Sparse moving ion trails follow the wall, keeping the playable ground readable.
            if(!forecast){
                StormClouds(g,radius);if(g.StormWarning)DrawNextEye(g);
                float t=g.Clock;
                glBegin(Lines);
                for(int i=0;i<124;i++){
                    float a=i*Tau/124+.007f*S(t*.19f+i),sn=S(a),cs=C(a),x=g.StormX+radius*sn,z=g.StormZ+radius*cs;
                    float baseY=Arena.Height(x,z),pulse=.5f+.5f*S(t*(.57f+(i%4)*.035f)+i*2.3f);
                    float flash=Bound((pulse-.65f)*2.4f,0,1);if(flash<=0)continue;
                    float h0=.7f+(i%8)*1.22f;
                    glColor4f(.67f,.79f,.99f,.49f*flash);glVertex3f(x,baseY+h0,z);
                    glColor4f(.60f,.53f,.94f,.06f*flash);glVertex3f(x+sn*.9f+cs*.52f,baseY+h0+8.7f,z+cs*.9f-sn*.52f);
                }glEnd();
                if(g.StormMargin(g.CamX,g.CamZ)<0){
                    glBegin(Lines);for(int i=0;i<68;i++){
                        float fx=Repeat(i*.61803f+t*.29f),fz=Repeat(i*.41421f+t*.073f),fy=Repeat(i*.73205f-t*.58f);
                        float x=g.CamX+(fx-.5f)*16,z=g.CamZ+(fz-.5f)*16,y=g.CamY-1.2f+fy*8;
                        glColor4f(.73f,.70f,.91f,.3f);glVertex3f(x,y,z);glColor4f(.58f,.58f,.89f,0);glVertex3f(x-.47f,y+.76f,z-.18f);
                    }glEnd();
                }
            }
            glDepthMask(1);glDisable(Blend);glEnable(Fog);glEnable(Light);Bind(paint);White();
        }
    }
}
