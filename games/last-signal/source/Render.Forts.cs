using System;

namespace LastSignal
{
    public sealed partial class Renderer
    {
        static void Segment(float x1,float y1,float z1,float x2,float y2,float z2)
        {
            glVertex3f(x1,y1,z1);glVertex3f(x2,y2,z2);
        }

        // Only draw a short piece of each adjoining grid line. The targeted socket
        // stays readable from below without laying a persistent grid over the arena.
        static void DrawFortGuide(Prop p,float red,float green,float blue)
        {
            bool deck=p.Model=="floor",slope=p.Model=="ramp";
            bool wall=p.Model=="wall"||p.Model=="gate"||p.Model=="barricade";
            if(!deck&&!slope&&!wall)return;
            float x=p.W*.5f,z=p.D*.5f,h=p.H;
            glLineWidth(1.5f);
            glColor4f(red,green,blue,.87f);
            glBegin(Lines);
            if(slope)
            {
                Segment(-x,0,-z,-x,h,z);Segment(x,0,-z,x,h,z);
                Segment(-x,h,z,x,h,z);
                // Direction of travel is visible from either end.
                float tip=z*.45f,tipY=h*.725f+.036f;
                float tail=-z*.35f,tailY=h*.325f+.036f;
                Segment(0,tailY,tail,0,tipY,tip);
                float back=tip-.38f,backY=tipY-.38f*h/p.D;
                Segment(0,tipY,tip,-.24f,backY,back);
                Segment(0,tipY,tip,.24f,backY,back);
            }
            else
            {
                Segment(-x,h,-z,x,h,-z);Segment(x,h,-z,x,h,z);
                Segment(x,h,z,-x,h,z);Segment(-x,h,z,-x,h,-z);
                for(int side=-1;side<=1;side+=2)
                for(int end=-1;end<=1;end+=2)
                {
                    float a=x*side,b=z*end;
                    if(wall)Segment(a,0,b,a,h,b);
                    else if(p.FortLevel>0)Segment(a,0,b,a,-.20f,b);
                }
            }
            if(deck)
            {
                glColor4f(red,green,blue,.43f);
                for(int side=-1;side<=1;side+=2)
                for(int end=-1;end<=1;end+=2)
                {
                    float a=x*side,b=z*end;
                    Segment(a,h,b,a+.38f*side,h,b);Segment(a,h,b,a,h,b+.38f*end);
                }
            }
            glEnd();
        }

        void DrawFortFalls(Game g)
        {
            foreach(FortFall fall in g.FortFalls)
            {
                Prop p=fall.Piece;
                float age=g.Clock-fall.Start;
                if(age<0||age>1.12f||!Visible(g,p.X,p.Z,4,104))continue;
                float pivot=Math.Max(.08f,p.H*.5f),drop=Math.Max(.10f,p.Y-fall.FloorY);
                float travel=Bound(.06f+(float)Math.Sqrt(drop*.15f),.22f,.95f);
                float progress=Bound(age/travel,0,1),after=Math.Max(0,age-travel);
                if(after>.13f)continue;
                float angle=p.X*.72f+p.Z*.49f+p.Y*.28f;
                float lean=progress*progress,roll=(p.Model=="floor"?18:40)*lean;
                float surface=fall.FloorY+(1-lean)*drop-after*3.8f;
                glPushMatrix();
                glTranslatef(p.X+.17f*lean*C(angle),surface+pivot,p.Z+.17f*lean*S(angle));
                glRotatef(roll,C(angle),0,S(angle));
                glTranslatef(-p.X,-p.Y-pivot,-p.Z);
                DrawProp(p,g.Clock);
                glPopMatrix();
            }
        }
    }
}
