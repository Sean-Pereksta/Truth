using System;

namespace LastSignal
{
    public sealed partial class Renderer
    {
        static void DrawShelterFrame(float width)
        {
            // The paid windbreak carries a lashed ridge and two bare, sloping rafters.
            glDisable(Texture);
            for(int side=-1;side<=1;side+=2)
            {
                float x=side*width*.34f;
                glColor3f(.40f,.29f,.17f);
                glPushMatrix();glTranslatef(x,.84f,0);Box(.09f,1.68f,.09f);glPopMatrix();
                glColor3f(.57f,.43f,.26f);
                glPushMatrix();glTranslatef(x,.81f,.48f);glRotatef(-31,1,0,0);Box(.075f,1.88f,.075f);glPopMatrix();
                glColor3f(.75f,.62f,.38f);
                glPushMatrix();glTranslatef(x,1.58f,0);glRotatef(12,0,0,1);Box(.14f,.075f,.16f);glPopMatrix();
            }
            glColor3f(.46f,.34f,.21f);
            glPushMatrix();glTranslatef(0,1.61f,0);Box(width*.76f,.08f,.09f);glPopMatrix();
            White();
        }

        static void Segment(float x1,float y1,float z1,float x2,float y2,float z2)
        {
            glVertex3f(x1,y1,z1);glVertex3f(x2,y2,z2);
        }

        // Only draw a short piece of each adjoining grid line. The targeted socket
        // stays readable from below without laying a persistent grid over the arena.
        static void DrawFortGuide(Prop p,float red,float green,float blue,float intensity=1f)
        {
            bool deck=p.Model=="floor",slope=p.Model=="ramp";
            bool wall=p.Model=="wall"||p.Model=="gate"||p.Model=="barricade";
            if(!deck&&!slope&&!wall)return;
            float x=p.W*.5f,z=p.D*.5f,h=p.H;
            glLineWidth(1.5f);
            glColor4f(red,green,blue,.87f*intensity);
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
                glColor4f(red,green,blue,.43f*intensity);
                for(int side=-1;side<=1;side+=2)
                for(int end=-1;end<=1;end+=2)
                {
                    float a=x*side,b=z*end;
                    Segment(a,h,b,a+.38f*side,h,b);Segment(a,h,b,a,h,b+.38f*end);
                }
            }
            glEnd();
        }

        void DrawBuildPreview(Game g)
        {
            if(g.Panel!="" || g.Mode!="match" || g.Player==null || !g.Player.Alive)return;
            if(g.FortBlueprintPreviews.Length>0)
            {
                foreach(FortBlueprintPreview part in g.FortBlueprintPreviews)
                {
                    if(part.Complete || part.Piece==null)continue;
                    if(part.Next)DrawBuildSupport(part.Support);
                    DrawGhost(part.Piece,part.Fits,part.Next);
                }
                return;
            }
            if(g.Ghost==null)return;
            DrawBuildSupport(Arena.PreviewSupport(g,g.Ghost));
            DrawGhost(g.Ghost,g.GhostFits);
        }

        static void DrawBuildSupport(Prop piece)
        {
            if(piece==null || piece.Removed)return;
            glDisable(Fog);glDisable(Light);glDisable(Texture);
            Alpha();glDepthMask(0);
            glPushMatrix();
            glTranslatef(piece.X,piece.Y+.04f,piece.Z);glRotatef(piece.Yaw*Deg,0,1,0);
            DrawFortGuide(piece,1,.76f,.29f);
            glPopMatrix();
            glLineWidth(1);glDepthMask(1);glDisable(Blend);glEnable(Fog);glEnable(Light);
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
