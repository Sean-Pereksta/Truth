using System;

namespace LastSignal {
    public sealed partial class Renderer {
        void DrawTracks(Game g){
            glDisable(Texture);glDisable(Light);Alpha();glDepthMask(0);
            glBegin(Triangles);
            foreach(Footprint p in g.Tracks){
                if(p.Maker==null||p.Time+p.Life<=g.Time||!Visible(g,p.X,p.Z,.4f,18))continue;
                float fade=(1-(g.Time-p.Time)/p.Life)*.52f;
                float dx=S(p.Yaw),dz=C(p.Yaw);
                float forward=Arena.Height(p.X+dx*.16f,p.Z+dz*.16f)-Arena.Height(p.X,p.Z);
                float cross=Arena.Height(p.X+dz*.16f,p.Z-dx*.16f)-Arena.Height(p.X,p.Z);
                glColor4f(.17f,.14f,.10f,fade);
                for(int l=0;l<2;l++){
                    float end=l==0?-.045f:.145f,start=l==0?-.136f:-.006f;
                    for(int j=0;j<6;j++){
                        int c=j==0||j==3?0:j==1?1:j==5?3:2;
                        float along=c<2?start:end,side=(c==0||c==3?-.047f:.047f)*(l==0?.86f:1);
                        glVertex3f(p.X+along*dx+side*dz,p.Y+(forward*along+cross*side)/.16f,p.Z+along*dz-side*dx);
                    }
                }
            }
            glEnd();glDepthMask(1);glDisable(Blend);glEnable(Light);Bind(paint);
        }
    }
}
