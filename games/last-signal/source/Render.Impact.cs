using System;

namespace LastSignal
{
    public sealed partial class Renderer
    {
        // The splashes share a single untextured draw batch. World depth still
        // clips them against cover and the foreground character silhouette.
        void DrawImpactWorld(Game g)
        {
            if(g.ImpactWorldTime<=0)return;
            glDisable(Texture);glDisable(Light);glEnable(Depth);glEnable(Fog);Alpha();glDepthMask(0);
            glBegin(Triangles);
            for(int i=0;i<g.ImpactMarks.Length;i++)
            {
                ImpactMark p=g.ImpactMarks[i];
                if(p.Life<=0||!Visible(g,p.X,p.Z,1,56))continue;
                if(Math.Abs(Arena.GroundBelow(g,p.X,p.Z,p.Y+.08f)+.032f-p.Y)>.13f)continue;
                float fade=Math.Min(1,(p.Life-p.Age)/4f)*.78f;
                float col=.29f+p.Tint*.13f;
                for(int j=0;j<9;j++)
                {
                    glColor4f(col,.019f,.047f,fade);glVertex3f(p.X,p.Y,p.Z);
                    for(int k=0;k<2;k++)
                    {
                        int u=(j+k)%9;float a=p.Angle+u*Tau/9;
                        float irregular=.86f+.20f*S(1.92f*u+3.6f*p.Tint);
                        float x=C(a)*irregular*p.Radius*1.28f,z=S(a)*irregular*p.Radius*.78f;
                        glColor4f(col*.76f,.014f,.035f,fade*.76f);
                        glVertex3f(p.X+x,p.Y+p.SlopeX*x+p.SlopeZ*z,p.Z+z);
                    }
                }
            }
            for(int i=0;i<g.ImpactDrops.Length;i++)
            {
                ImpactDrop p=g.ImpactDrops[i];
                if(p.Life<=0||!Visible(g,p.X,p.Z,1,100))continue;
                float xx=p.X-g.CamX,yy=p.Y-g.CamY,zz=p.Z-g.CamZ;
                if(xx*xx+yy*yy+zz*zz<.11f)continue;
                float screenVX=p.VX*cosView-p.VZ*sinView;
                float speed=(float)Math.Sqrt(screenVX*screenVX+p.VY*p.VY);
                float ax=speed>.03f?screenVX/speed:0,ay=speed>.03f?p.VY/speed:1;
                float width=p.Radius*(p.Bloody?.78f:.32f),length=p.Radius*(p.Bloody?1.28f:2.35f)+Math.Min(p.Bloody?.030f:.067f,speed*(p.Bloody?.005f:.010f));
                float fade=Math.Min(1,(p.Life-p.Age)/(p.Bloody?.19f:.09f));
                if(p.Mist)
                {
                    float haze=p.Radius*(.7f+1.2f*p.Age/p.Life);
                    for(int j=0;j<12;j++)
                    {
                        glColor4f(.57f,.03f,.072f,fade*.34f);glVertex3f(p.X,p.Y,p.Z);
                        for(int k=0;k<2;k++){
                            float angle=(j+k)*Tau/12,rad=haze*(.89f+.14f*S(j+k+p.Tint*7));
                            float sx=C(angle)*rad*1.09f;
                            glColor4f(.44f,.025f,.052f,0);glVertex3f(p.X+sx*cosView,p.Y+S(angle)*rad*.82f,p.Z-sx*sinView);
                        }
                    }
                    continue;
                }
                for(int j=0;j<6;j++)
                {
                    if(p.Bloody)glColor4f(.56f+.20f*p.Tint,.030f+.024f*p.Tint,.073f+.035f*p.Tint,fade);
                    else glColor4f(1,.85f+.12f*p.Tint,.53f+.40f*p.Tint,fade);
                    glVertex3f(p.X,p.Y,p.Z);
                    for(int k=0;k<2;k++)
                    {
                        int u=(j+k)%6;
                        float along=streakAxis[u]*length,side=streakWidth[u]*width;
                        float sx=ax*along-ay*side,sy=ay*along+ax*side;
                        if(p.Bloody)glColor4f(.32f+.23f*p.Tint,.014f,.043f,fade*(u==3?.65f:.93f));
                        else glColor4f(1,.57f+.27f*p.Tint,.16f+.39f*p.Tint,fade*(u==3?.31f:.91f));
                        glVertex3f(p.X+sx*cosView,p.Y+sy,p.Z-sx*sinView);
                    }
                }
            }
            glEnd();glDepthMask(1);glDisable(Blend);glEnable(Light);Bind(paint);
        }

        static readonly float[] streakAxis={.66f,.28f,-.40f,-1.15f,-.40f,.28f};
        static readonly float[] streakWidth={0,.86f,.95f,0,-.95f,-.86f};

        void DrawImpactEdge(Game g)
        {
            if(g.IncomingImpact<=0&&g.ConfirmedImpact<=0)return;
            glDisable(Depth);glDisable(Fog);glDisable(Light);glDisable(Texture);glDepthMask(0);Alpha();
            glMatrixMode(Projection);glLoadIdentity();glMatrixMode(Modelview);glLoadIdentity();
            if(g.IncomingImpact>0)
            {
                float relative=g.IncomingAngle-g.CamYaw,amplitude=g.IncomingStrength*Math.Min(1,g.IncomingImpact/.36f);
                glBegin(Strip);
                for(int i=0;i<=32;i++)
                {
                    float t=i/16f-1,a=relative+t*1.00f,xx=S(a),yy=C(a);
                    float rim=1/Math.Max(.001f,Math.Max(Math.Abs(xx),Math.Abs(yy)));
                    float focus=1-t*t;
                    glColor4f(.55f,.035f,.075f,.57f*amplitude*focus);glVertex3f(xx*rim,yy*rim,0);
                    float inner=rim*(1-(.09f+.13f*amplitude)*focus);
                    glColor4f(.40f,.018f,.047f,0);glVertex3f(xx*inner,yy*inner,0);
                }
                glEnd();
            }
            if(g.ConfirmedImpact>0)
            {
                // Brief open-corner marks leave the exact aim point readable.
                float fade=Math.Min(1,g.ConfirmedImpact/.10f),outward=1-g.ConfirmedImpact/.17f;
                float dx=2f/Math.Max(1,w),dy=2f/Math.Max(1,h);glLineWidth(1.6f);
                glBegin(Lines);glColor4f(.98f,.87f,.69f,fade*.89f);
                for(int i=0;i<4;i++){
                    int sx=(i&1)==0?-1:1,sy=(i&2)==0?-1:1;
                    glVertex3f(sx*dx*(6+outward*2),sy*dy*(6+outward*2),0);
                    glVertex3f(sx*dx*(10+outward*2),sy*dy*(10+outward*2),0);
                }
                glEnd();glLineWidth(1);
            }
            glDepthMask(1);glDisable(Blend);
        }
    }
}
