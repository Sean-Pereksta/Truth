using System;
using System.Collections.Generic;

namespace LastSignal
{
    public static partial class Arena
    {
        internal const float Story=2.3f, DeckThickness=.16f;
        const float Tile=3f, HalfTile=1.5f, QuarterTurn=(float)Math.PI/2;

        internal sealed class FortFrame
        {
            public float X,Y,Z,Yaw;
            public bool StartsOnDeck;
            public void Local(float x,float z,out float u,out float v)
            {
                float dx=x-X,dz=z-Z;
                u=dx*Cos(Yaw)-dz*Sin(Yaw);v=dx*Sin(Yaw)+dz*Cos(Yaw);
            }
            public void World(float u,float v,out float x,out float z)
            {
                x=X+u*Cos(Yaw)+v*Sin(Yaw);z=Z-u*Sin(Yaw)+v*Cos(Yaw);
            }
        }

        static bool GridModel(string id){return FencePiece(id)||id=="floor"||id=="ramp";}
        static float Node(float n){return Tile*(float)Math.Floor(n/Tile+.5f);}
        static float Edge(float n){return Tile*(float)Math.Floor(n/Tile)+HalfTile;}
        static float GridSide(float n){return n<0?-1:1;}
        static FortFrame FrameFrom(Prop p)
        {
            float offset=FencePiece(p.Model)?HalfTile:0;
            return new FortFrame{X=p.X+offset*Sin(p.Yaw),Z=p.Z+offset*Cos(p.Yaw),
                Y=p.Y+(p.Model=="floor"?p.H:0),Yaw=p.Yaw,StartsOnDeck=p.Model=="floor"};
        }
        static Prop NearestFort(Game g,float x,float z,float foot)
        {
            Field f=fields.GetOrCreateValue(g);Prop best=null;float bestScore=4.65f*4.65f;
            for(int iz=Cell(z-4.65f);iz<=Cell(z+4.65f);iz++)for(int ix=Cell(x-4.65f);ix<=Cell(x+4.65f);ix++)
            {
                List<Prop> nearby=f.Nearby[ix+iz*Cells];if(nearby==null)continue;
                foreach(Prop p in nearby)
                {
                    if(p.Removed||p.Kind!="structure"||!GridModel(p.Model))continue;
                    float dx=x-p.X,dz=z-p.Z,dy=Math.Abs(foot-p.Y);
                    float score=dx*dx+dz*dz+.12f*dy*dy;
                    if(score<bestScore){bestScore=score;best=p;}
                }
            }
            return best;
        }
        static bool FortJoint(Prop part,Prop other)
        {
            if(other.Kind!="structure"||!GridModel(part.Model)||!GridModel(other.Model))return false;
            Prop floor=part.Model=="floor"?part:other.Model=="floor"?other:null;
            if(floor!=null)
            {
                Prop frame=floor==part?other:part;
                if(!FencePiece(frame.Model)&&frame.Model!="ramp")return false;
                if(Carries(frame,floor))return true;
                // The first course of planks rests on grade between upright posts.
                if(floor.FortLevel==0&&frame.FortLevel==0&&HeightJoint(floor.Y,frame.Y))
                    return FencePiece(frame.Model)?FloorEdge(floor,frame.X,frame.Z,frame.Yaw):
                        SamePoint(floor.X,floor.Z,frame.X,frame.Z);
                return false;
            }
            Prop ramp=part.Model=="ramp"?part:other.Model=="ramp"?other:null;
            Prop wall=ramp==part?other:part;
            if(ramp==null||!FencePiece(wall.Model)||!SameBearing(ramp.Yaw,wall.Yaw)||
                !HeightJoint(ramp.Y+ramp.H,wall.Y+wall.H))return false;
            float lipX,lipZ;Lip(ramp,1,out lipX,out lipZ);
            return SamePoint(wall.X,wall.Z,lipX,lipZ);
        }
        static void NearestTileEdge(FortFrame frame,Prop deck,float x,float z,out float u,out float v,out bool alongX,out float sign)
        {
            float centerU,centerV,hitU,hitV;
            frame.Local(deck.X,deck.Z,out centerU,out centerV);frame.Local(x,z,out hitU,out hitV);
            float du=hitU-centerU,dv=hitV-centerV;
            alongX=Math.Abs(dv)>=Math.Abs(du);sign=GridSide(alongX?dv:du);
            u=centerU+(alongX?0:sign*HalfTile);v=centerV+(alongX?sign*HalfTile:0);
        }
        static Prop SightPiece(Game g,Actor a,out float hx,out float hy,out float hz)
        {
            float eye=a.Y+(a.Crouch?1.03f:1.58f),cp=Cos(g.Pitch),dy=Sin(g.Pitch);
            float dx=Sin(a.Yaw)*cp,dz=Cos(a.Yaw)*cp;
            float x=g.CameraTarget==a?g.CamX:a.X,z=g.CameraTarget==a?g.CamZ:a.Z;
            float length;Prop p=RayProp(g,x,eye,z,dx,dy,dz,5.65f,out length);
            hx=x+length*dx;hy=eye+length*dy;hz=z+length*dz;
            return p!=null&&p.Kind=="structure"&&GridModel(p.Model)?p:null;
        }
        internal static Prop PlayerFortPreview(Game g,Actor a,string id,float x,float z,float yaw,bool rotated,out bool joined)
        {
            joined=false;
            float hitX,hitY,hitZ;Prop hit=SightPiece(g,a,out hitX,out hitY,out hitZ);
            if(!GridModel(id))
            {
                Prop device=BuildPreview(g,id,x,z,yaw);
                if(hit!=null&&hit.Model=="floor"&&hitY>=hit.Y+hit.H-.04f&&a.Y>=hit.Y-.48f)
                {
                    device=BuildPreview(g,id,hitX,hitZ,yaw);device.Y=hit.Y+hit.H;
                    device.Support=hit;device.Fort=hit.Fort;device.FortLevel=hit.FortLevel;
                }
                return device;
            }
            Prop anchor=hit??NearestFort(g,x,z,a.Y);
            if(anchor==null)
            {
                Prop first=BuildPreview(g,id,x,z,yaw);
                first.Fort=FrameFrom(first);return first;
            }
            FortFrame frame=anchor.Fort??FrameFrom(anchor);
            int level=Math.Max(0,(int)Math.Round((a.Y-frame.Y)/Story));
            int quarter=(int)Math.Round((yaw-frame.Yaw)/QuarterTurn);
            float u,v;frame.Local(x,z,out u,out v);
            bool fence=FencePiece(id);
            // From below a deck, the rim is also a handle for putting up its parapet,
            // adding a neighboring panel, or running a stair to that landing.
            if(hit!=null&&hit.Model=="floor")
            {
                bool alongX;float side,eu,ev;
                NearestTileEdge(frame,hit,hitX,hitZ,out eu,out ev,out alongX,out side);
                level=hit.FortLevel;
                if(fence){u=eu;v=ev;if(!rotated)quarter=alongX?0:1;}
                else if(id=="floor"||id=="ramp"&&a.Y<hit.Y-.38f)
                {
                    u=eu+(alongX?0:side*HalfTile);v=ev+(alongX?side*HalfTile:0);
                    if(id=="ramp")
                    {
                        level=Math.Max(0,level-1);
                        if(!rotated)quarter=alongX?(side<0?0:2):(side<0?1:3);
                    }
                }
                else frame.Local(hit.X,hit.Z,out u,out v);
            }
            else if(hit!=null&&FencePiece(hit.Model)&&
                ((id=="floor"&&hitY>=hit.Y+hit.H*.54f)||(fence&&g.Pitch>.085f&&hitY>=hit.Y+hit.H*.68f)))
            {
                level=hit.FortLevel+1;float targetX=hit.X,targetZ=hit.Z;
                if(id=="floor")
                {
                    float sx=Sin(hit.Yaw),sz=Cos(hit.Yaw);
                    float side=GridSide((a.X-hit.X)*sx+(a.Z-hit.Z)*sz);
                    targetX+=side*HalfTile*sx;targetZ+=side*HalfTile*sz;
                }
                else if(!rotated)quarter=(int)Math.Round((hit.Yaw-frame.Yaw)/QuarterTurn);
                frame.Local(targetX,targetZ,out u,out v);
            }
            else if(hit!=null&&hit.Model=="ramp"&&id=="floor")
            {
                float advance=(hitX-hit.X)*Sin(hit.Yaw)+(hitZ-hit.Z)*Cos(hit.Yaw);
                if(advance>.38f){
                    level=hit.FortLevel+1;
                    frame.Local(hit.X+Tile*Sin(hit.Yaw),hit.Z+Tile*Cos(hit.Yaw),out u,out v);
                }
            }
            else if(g.Pitch>.15f && (id=="floor"||fence))
            {
                // The top silhouette often leaves the ray just above the frame.
                // Use the level indicated by the reticle at the target distance.
                float rayY=a.Y+(a.Crouch?1.03f:1.58f)+(float)Math.Tan(Math.Min(1.15f,g.Pitch))*Game.Distance(a.X,a.Z,x,z);
                level=Math.Max(level,(int)Math.Floor((rayY-frame.Y+.38f)/Story));
            }
            float pu=fence&&(quarter&1)!=0?Edge(u):Node(u);
            float pv=fence&&(quarter&1)==0?Edge(v):Node(v);
            float px,pz;frame.World(pu,pv,out px,out pz);
            Prop p=BuildPreview(g,id,px,pz,frame.Yaw+quarter*QuarterTurn);
            // A low barricade is a separate half-height seat. Keep the original
            // field trick of stacking a wall squarely on one.
            if(fence&&level==0&&p.Support!=null&&p.Support.Model=="barricade"&&
                Game.Distance(p.X,p.Z,p.Support.X,p.Support.Z)<.06f)
            {p.Fort=frame;return p;}
            SetFortCourse(p,frame,level);
            joined=true;return p;
        }

        internal static Prop PreviewFortGridPiece(Game g,FortFrame frame,string model,float u,float v,int quarter,int level)
        {
            float x,z;
            frame.World(u,v,out x,out z);
            Prop p=BuildPreview(g,model,x,z,frame.Yaw+quarter*QuarterTurn);
            SetFortCourse(p,frame,level);
            return p;
        }

        static void SetFortCourse(Prop p,FortFrame frame,int level)
        {
            p.Support=null;p.Fort=frame;p.FortLevel=level;
            p.Y=frame.Y+level*Story-(p.Model=="floor"?DeckThickness:0);
            if(p.Model=="floor"&&level==0&&!frame.StartsOnDeck)p.Y+=DeckThickness;
        }

        internal static bool FortVisible(Game g,Actor a,Prop p)
        {
            return a!=null && FortVisibleFrom(g,a.X,a.Y,a.Z,a.Y+(a.Crouch?1.03f:1.45f),p);
        }

        internal static bool FortVisibleFrom(Game g,float x,float footY,float z,float eye,Prop p)
        {
            if(p==null||Game.Distance(x,z,p.X,p.Z)>6.35f||Math.Abs(p.Y-footY)>5.8f)return false;
            if(!GridModel(p.Model))return Clear(g,x,eye,z,p.X,p.Y+.58f,p.Z);
            float targetY=p.Model=="floor"?p.Y+.07f:p.Y+Math.Min(.72f,p.H*.5f);
            if(Clear(g,x,eye,z,p.X,targetY,p.Z))return true;
            // A connected wall can obscure the center while the builder sees
            // the mounting edge. Require actual sight of an edge or top corner.
            float c=Cos(p.Yaw),s=Sin(p.Yaw);
            for(int i=0;i<8;i++)
            {
                float u=(i%2==0?-1:1)*p.W*.48f,v=((i/2)%2==0?-1:1)*p.D*.48f;
                float h=i<4?p.Y+.03f:p.Y+p.H+.025f;
                if(Clear(g,x,eye,z,p.X+c*u+s*v,h,p.Z-s*u+c*v))return true;
            }
            return false;
        }
    }
}
