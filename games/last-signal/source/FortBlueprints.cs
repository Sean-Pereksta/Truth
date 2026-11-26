using System;
using System.Collections.Generic;

namespace LastSignal
{
    internal struct FortPart
    {
        public readonly string Model;
        public readonly float U,V;
        public readonly int Quarter,Level;

        public FortPart(string model,float u,float v,int quarter=0,int level=0)
        { Model=model; U=u; V=v; Quarter=quarter; Level=level; }
    }

    internal struct FortExit
    {
        public readonly float X,Z;
        public FortExit(float x,float z) { X=x; Z=z; }
    }

    public sealed class FortBlueprint
    {
        public readonly string Id,Name,Description;
        internal readonly float Reach;
        internal readonly FortExit[] Exits;
        internal readonly FortPart[] Parts;
        Recipe recipe;

        FortBlueprint(string id,string name,string description,float reach,FortExit[] exits,params FortPart[] parts)
        { Id=id; Name=name; Description=description; Reach=reach; Exits=exits; Parts=parts; }

        public int Count { get { return Parts.Length; } }
        public IEnumerable<KeyValuePair<string,int>> Needs { get { return Recipe.Needs; } }
        public Recipe Recipe
        {
            get
            {
                if(recipe==null)recipe=CombineRecipe(0);
                return recipe;
            }
        }

        internal Recipe RemainingRecipe(int complete)
        {
            return complete==0?Recipe:CombineRecipe(complete);
        }

        Recipe CombineRecipe(int complete)
        {
            var combined=new Dictionary<string,int>();
            for(int i=0;i<Parts.Length;i++)
            {
                if((complete&(1<<i))!=0)continue;
                foreach(var need in Survival.Find(Survival.Builds,Parts[i].Model).Needs)
                {
                    int held;
                    combined.TryGetValue(need.Key,out held);
                    combined[need.Key]=held+need.Value;
                }
            }
            var material=new List<object>();
            foreach(var need in combined)
            { material.Add(need.Key);material.Add(need.Value); }
            return new Recipe(Id,Name,Description,1,material.ToArray());
        }

        // Positive V is forward. Each piece uses the ordinary three-metre
        // grid and recipe. Ramps ascend toward their authored rotation.
        internal static readonly FortBlueprint TrailHide=new FortBlueprint("blueprint_hide","Trail Hide",
            "Two walls meet at a corner. Leave by either open side.",2.9f,
            new[]{new FortExit(-3.2f,0),new FortExit(0,-3.2f)},
            new FortPart("wall",0,1.5f),new FortPart("wall",1.5f,0,1));
        internal static readonly FortBlueprint FieldCamp=new FortBlueprint("blueprint_camp","Field Camp",
            "Four walls around two spaces with staggered exits.",5f,
            new[]{new FortExit(-3.2f,0),new FortExit(3.2f,3)},
            new FortPart("wall",0,4.5f),new FortPart("wall",-1.5f,3,1),
            new FortPart("wall",0,-1.5f),new FortPart("wall",1.5f,0,1));
        internal static readonly FortBlueprint RaisedLookout=new FortBlueprint("blueprint_lookout","Raised Lookout",
            "Support walls carry a raised deck with a ramp and low parapet.",5f,
            new[]{new FortExit(0,-5),new FortExit(0,3.2f)},
            new FortPart("wall",-1.5f,0,1),new FortPart("wall",1.5f,0,1),
            new FortPart("floor",0,0,0,1),new FortPart("ramp",0,-3),
            new FortPart("barricade",0,1.5f,0,1));
        internal static readonly FortBlueprint Stronghold=new FortBlueprint("blueprint_stronghold","Stronghold",
            "Two covered spaces, an upper ramp, a front gate and an open rear exit.",5.8f,
            new[]{new FortExit(0,-3.2f),new FortExit(0,6.2f)},
            new FortPart("wall",-1.5f,3,1),new FortPart("wall",1.5f,3,1),
            new FortPart("wall",-1.5f,0,1),new FortPart("wall",1.5f,0,1),
            new FortPart("floor",0,3,0,1),new FortPart("floor",0,0,0,1),
            new FortPart("ramp",3,3,3),new FortPart("gate",0,4.5f));

        public static readonly IList<FortBlueprint> All=Array.AsReadOnly(new[]{TrailHide,FieldCamp,RaisedLookout,Stronghold});

        public static FortBlueprint Find(string id)
        {
            foreach(FortBlueprint template in All)if(template.Id==id)return template;
            return null;
        }

        internal Prop Preview(Game g,Arena.FortFrame frame,int index)
        {
            FortPart part=Parts[index];
            return Arena.PreviewFortGridPiece(g,frame,part.Model,part.U,part.V,part.Quarter,part.Level);
        }

        internal bool HasClearExits(Game g,Arena.FortFrame frame)
        {
            foreach(FortExit exit in Exits)
                if(!ExitClear(g,frame,exit))return false;
            return true;
        }

        bool ExitClear(Game g,Arena.FortFrame frame,FortExit exit)
        {
            float inside=(this==FieldCamp||this==Stronghold)&&exit.Z>2f?3f:0f;
            float last=frame.Y;
            for(int i=0;i<=8;i++)
            {
                float fraction=i/8f,v=inside+(exit.Z-inside)*fraction;
                float x,z;
                frame.World(exit.X*fraction,v,out x,out z);
                float y=Arena.Ground(g,x,z);
                if(Math.Abs(y-last)>.38f||Arena.WetDepth(g,x,z,y)>.15f||!Arena.CanStand(g,x,y,z))return false;
                // Check clearance under the planned deck along the route.
                if(this==Stronghold&&v>=-1.85f&&v<=4.85f&&
                    y+1.77f>frame.Y+Arena.Story-Arena.DeckThickness)return false;
                last=y;
            }
            return true;
        }
    }
}
