using System;
using System.Collections.Generic;

namespace LastSignal
{
    public sealed class FortFall
    {
        public Prop Piece;
        public float Start,FloorY;
    }

    public partial class Game
    {
        public readonly List<FortFall> FortFalls=new List<FortFall>();
    }

    public static partial class Arena
    {
        sealed class FortSupportState
        {
            public readonly List<Prop> Members=new List<Prop>();
            public HashSet<Prop> Stable;
        }

        const float JointGap=.095f;

        static bool FortMember(Prop p)
        {
            return (p.Kind=="structure" || p.Kind=="fire") && BuildType(p.Model);
        }

        static float FixedSurface(Game g,float x,float y,float z)
        {
            Prop ignored;
            return FindFloor(g,x,z,y+.43f,false,out ignored);
        }

        static bool FoundationAt(Game g,Prop p,float x,float z)
        {
            float gap=p.Y-FixedSurface(g,x,p.Y,z);
            return gap>=-.43f && gap<=.43f;
        }

        static bool GroundedPiece(Game g,Prop p)
        {
            if(p.Model=="ramp")
            {
                float reach=p.D*.47f;
                return FoundationAt(g,p,p.X-Sin(p.Yaw)*reach,p.Z-Cos(p.Yaw)*reach);
            }
            if(FoundationAt(g,p,p.X,p.Z))return true;
            if(!FencePiece(p.Model)&&p.Model!="floor")return false;
            float span=p.W*.47f,c=Cos(p.Yaw),s=Sin(p.Yaw);
            return FoundationAt(g,p,p.X+c*span,p.Z-s*span) || FoundationAt(g,p,p.X-c*span,p.Z+s*span);
        }

        // The joints use the same world-space dimensions as collision. This also
        // permits an older, freely rotated wall to carry a new grid of floor panels.
        static bool SameBearing(float a,float b)
        {
            return Math.Abs(Cos(a-b))>.997f;
        }
        static bool SamePoint(float x,float z,float xx,float zz)
        {
            return Math.Abs(x-xx)<JointGap && Math.Abs(z-zz)<JointGap;
        }
        static bool FloorEdge(Prop floor,float x,float z,float bearing)
        {
            float dx=x-floor.X,dz=z-floor.Z,c=Cos(floor.Yaw),s=Sin(floor.Yaw);
            float lx=Math.Abs(c*dx-s*dz),lz=Math.Abs(s*dx+c*dz);
            if(lx<JointGap && Math.Abs(lz-floor.D*.5f)<JointGap)return SameBearing(floor.Yaw,bearing);
            return lz<JointGap && Math.Abs(lx-floor.W*.5f)<JointGap && Math.Abs(Sin(floor.Yaw-bearing))>.997f;
        }
        static bool FloorNeighbors(Prop a,Prop b)
        {
            float x=(a.X+b.X)*.5f,z=(a.Z+b.Z)*.5f;
            float bearing=(float)Math.Atan2(b.X-a.X,b.Z-a.Z);
            return FloorEdge(a,x,z,bearing)&&FloorEdge(b,x,z,bearing);
        }
        static bool FootOver(Prop plate,Prop cargo)
        {
            float dx=cargo.X-plate.X,dz=cargo.Z-plate.Z,c=Cos(plate.Yaw),s=Sin(plate.Yaw);
            return Math.Abs(dx*c-dz*s)<=plate.W*.5f+.045f && Math.Abs(dx*s+dz*c)<=plate.D*.5f+.045f;
        }
        static void Lip(Prop ramp,int sign,out float x,out float z)
        {
            float offset=ramp.D*.5f*sign;
            x=ramp.X+Sin(ramp.Yaw)*offset;z=ramp.Z+Cos(ramp.Yaw)*offset;
        }
        static bool HeightJoint(float a,float b){return Math.Abs(a-b)<JointGap;}

        // A directed joint can transfer weight upward or, across coplanar
        // flooring, sideways. A floor resting on a wall cannot suspend that wall.
        static bool Carries(Prop below,Prop load)
        {
            if(below==load || below.Removed || load.Removed)return false;
            string baseModel=below.Model,loadModel=load.Model;
            float top=below.Y+below.H;
            if(loadModel=="floor")
            {
                if(!HeightJoint(top,load.Y+load.H))return false;
                if(baseModel=="floor")return FloorNeighbors(below,load);
                if(FencePiece(baseModel))return FloorEdge(load,below.X,below.Z,below.Yaw);
                if(baseModel=="ramp")
                {
                    float x,z;Lip(below,1,out x,out z);
                    return FloorEdge(load,x,z,below.Yaw);
                }
                return false;
            }
            if(baseModel=="ramp" && load.Support==below)
            {
                float dx=load.X-below.X,dz=load.Z-below.Z,s=Sin(below.Yaw),c=Cos(below.Yaw);
                float u=dx*c-dz*s,v=dx*s+dz*c;
                float rise=below.Y+below.H*Clamp01(.5f+v/below.D);
                if(Math.Abs(u)<=below.W*.5f+JointGap && Math.Abs(v)<=below.D*.5f+JointGap && HeightJoint(load.Y,rise))return true;
            }
            if(!HeightJoint(top,load.Y))return false;
            if(baseModel=="floor")
            {
                if(loadModel=="ramp")
                {
                    float x,z;Lip(load,-1,out x,out z);
                    return FootOver(below,load)||FloorEdge(below,x,z,load.Yaw);
                }
                return FencePiece(loadModel)?FloorEdge(below,load.X,load.Z,load.Yaw):FootOver(below,load);
            }
            float bx=below.X,bz=below.Z;
            if(baseModel=="ramp")Lip(below,1,out bx,out bz);
            else if(!FencePiece(baseModel))return false;
            float lx=load.X,lz=load.Z;
            if(loadModel=="ramp")Lip(load,-1,out lx,out lz);
            return SamePoint(bx,bz,lx,lz) && (SameBearing(below.Yaw,load.Yaw) || load.Support==below);
        }

        static HashSet<Prop> StablePieces(Game g,FortSupportState structure)
        {
            if(structure.Stable!=null)return structure.Stable;
            var reached=new HashSet<Prop>();var frontier=new Queue<Prop>();
            foreach(Prop p in structure.Members)
                if(!p.Removed && GroundedPiece(g,p)) {reached.Add(p);frontier.Enqueue(p);}
            var nearby=new List<Prop>(20);
            while(frontier.Count>0)
            {
                Prop p=frontier.Dequeue();
                Near(g,p.X,p.Z,3.4f,nearby);
                foreach(Prop q in nearby)
                    if(FortMember(q) && !reached.Contains(q) && Carries(p,q)) {reached.Add(q);frontier.Enqueue(q);}
            }
            structure.Stable=reached;return reached;
        }

        public static bool HasFortSupport(Game g,Prop p)
        {
            if(p==null||p.Removed||!FortMember(p))return false;
            if(GroundedPiece(g,p))return true;
            Field field=fields.GetOrCreateValue(g);
            var stable=StablePieces(g,field.Forts);
            // Ghosts run every tick. Reuse the grounded set until the next
            // structural change, and test only authored joints in nearby cells.
            for(int iz=Cell(p.Z-3.4f);iz<=Cell(p.Z+3.4f);iz++)
            for(int ix=Cell(p.X-3.4f);ix<=Cell(p.X+3.4f);ix++)
            {
                var cell=field.Nearby[ix+iz*Cells];if(cell==null)continue;
                foreach(Prop q in cell)if(stable.Contains(q)&&Carries(q,p))return true;
            }
            return false;
        }

        static void RemoveMember(Field f,Prop p)
        {
            p.HP=0;p.Removed=true;p.Solid=p.Opaque=p.Lit=false;
            UnindexGeometry(f,p);
            if(p.Model=="rain_barrel")p.Water=0;
        }

        static void Salvage(Game g,Prop p)
        {
            // Material drops from the piece itself. Breaking the wall below
            // an intact ceiling must not put its wood upstairs on the ceiling.
            float maxY=p.Y+p.H*.5f+.03f;
            if(p.HasMeat)
            {
                Prop food=Drop(g,"meat",1,p.X+.38f,p.Z+.15f,maxY);food.FoodProgress.Add(p.Cook);p.HasMeat=false;
            }
            Recipe recipe=Survival.Find(Survival.Builds,p.Model);
            int woodCost;
            if(recipe!=null && recipe.Needs.TryGetValue("branch",out woodCost) && woodCost>0)
            {
                int wood=p.Model=="wall"||p.Model=="gate"?3:p.Model=="fire"?1:2;
                Drop(g,"branch",Math.Min(woodCost,wood),p.X,p.Z,maxY);
            }
        }
        static void SeverFortPiece(Game g,Prop struck)
        {
            Field f=fields.GetOrCreateValue(g);var graph=f.Forts;
            HashSet<Prop> before=StablePieces(g,graph);
            RemoveMember(f,struck);graph.Stable=null;
            HashSet<Prop> after=StablePieces(g,graph);
            var lost=new List<Prop>();
            foreach(Prop p in graph.Members)
                if(!p.Removed&&before.Contains(p)&&!after.Contains(p))lost.Add(p);
            foreach(Prop p in lost)RemoveMember(f,p);
            graph.Members.RemoveAll(p=>p.Removed);
            f.Revision++;
            foreach(Prop p in lost)
            {
                g.FortFalls.Add(new FortFall{Piece=p,Start=g.Clock,FloorY=GroundBelow(g,p.X,p.Z,p.Y+.04f)});
                if(p.Model=="floor"||p.Model=="ramp")SettleLooseItems(g,p.X,p.Z,2.5f);
            }
            if(struck.Model=="floor"||struck.Model=="ramp")SettleLooseItems(g,struck.X,struck.Z,2.5f);
            if(lost.Count!=0)g.FortCrash(lost[0],lost.Count);
            Salvage(g,struck);foreach(Prop p in lost)Salvage(g,p);
        }
    }
}
