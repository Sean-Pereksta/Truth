using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;

namespace LastSignal
{
    public sealed class FortBlueprintPreview
    {
        public Prop Piece,Support;
        public bool Complete,Next,Fits;
    }

    public partial class Game
    {
        internal FortBlueprintPreview[] RemoteBlueprintPreviews;
        internal bool RemoteBlueprintLocked;
        internal Dictionary<string,int> RemoteBlueprintCompletion;

        public FortBlueprintPreview[] FortBlueprintPreviews { get { return Survival.BlueprintPreviews(this); } }
        public bool FortBlueprintLocked { get { return Survival.BlueprintLocked(this); } }
        public string FortBlueprintName
        {
            get { FortBlueprint blueprint=FortBlueprint.Find(BuildId);return blueprint==null?"":blueprint.Name; }
        }

        public int FortBlueprintCount
        {
            get { FortBlueprint blueprint=FortBlueprint.Find(BuildId);return blueprint==null?0:blueprint.Count; }
        }

        public int FortBlueprintProgress
        {
            get
            {
                int complete=0;
                foreach(FortBlueprintPreview preview in FortBlueprintPreviews)if(preview.Complete)complete++;
                return complete;
            }
        }
    }

    public static partial class Survival
    {
        sealed class PositionedBlueprint
        {
            public Arena.FortFrame Anchor;
            public readonly Prop[] Built;
            public readonly FortBlueprintPreview[] Previews;

            public PositionedBlueprint(int count)
            {
                Built=new Prop[count];Previews=new FortBlueprintPreview[count];
                for(int i=0;i<count;i++)Previews[i]=new FortBlueprintPreview();
            }

            public int Next
            {
                get
                {
                    for(int i=0;i<Built.Length;i++)if(Built[i]==null||Built[i].Removed)return i;
                    return -1;
                }
            }
        }

        static readonly FortBlueprintPreview[] noBlueprintPreviews=new FortBlueprintPreview[0];
        const int SavedBlueprintBit=1<<8;
        static readonly ConditionalWeakTable<Actor,Dictionary<string,PositionedBlueprint>> positionedBlueprints=
            new ConditionalWeakTable<Actor,Dictionary<string,PositionedBlueprint>>();

        static PositionedBlueprint ActorBlueprint(Game g,string id)
        {
            Dictionary<string,PositionedBlueprint> plans;
            PositionedBlueprint plan;
            return g.Player!=null && positionedBlueprints.TryGetValue(g.Player,out plans) &&
                plans.TryGetValue(id,out plan)?plan:null;
        }

        static PositionedBlueprint ViewedBlueprint(Game g)
        {
            return ActorBlueprint(g,g.BuildId);
        }

        internal static int BlueprintCatalogState(Game g,FortBlueprint template)
        {
            int mask=0;
            if(g.OnlinePresentationPacks!=null && g.RemoteBlueprintCompletion!=null)
            {
                g.RemoteBlueprintCompletion.TryGetValue(template.Id,out mask);
                return mask;
            }
            PositionedBlueprint plan=ActorBlueprint(g,template.Id);
            if(plan==null||plan.Anchor==null)return mask;
            mask=SavedBlueprintBit;
            for(int i=0;i<plan.Built.Length;i++)
                if(plan.Built[i]!=null && !plan.Built[i].Removed)mask|=1<<i;
            return mask;
        }

        public static bool HasSavedBlueprint(Game g,FortBlueprint template)
        {
            return template!=null && (BlueprintCatalogState(g,template)&SavedBlueprintBit)!=0;
        }

        public static Recipe BlueprintRemainingRecipe(Game g,FortBlueprint template)
        {
            return template==null?null:template.RemainingRecipe(BlueprintCatalogState(g,template)&(SavedBlueprintBit-1));
        }

        public static bool CanStartBlueprint(Game g,FortBlueprint template)
        {
            if(template==null || g.Player==null || !g.Player.Alive)return false;
            int mask=BlueprintCatalogState(g,template);
            for(int i=0;i<template.Count;i++)
                if((mask&(1<<i))==0)return CanMake(g.Player,Find(Builds,template.Parts[i].Model));
            return false;
        }

        internal static FortBlueprintPreview[] BlueprintPreviews(Game g)
        {
            if(FortBlueprint.Find(g.BuildId)==null)return noBlueprintPreviews;
            if(g.OnlinePresentationPacks!=null && g.RemoteBlueprintPreviews!=null)return g.RemoteBlueprintPreviews;
            PositionedBlueprint plan=ViewedBlueprint(g);
            return plan==null?noBlueprintPreviews:plan.Previews;
        }

        internal static bool BlueprintLocked(Game g)
        {
            if(FortBlueprint.Find(g.BuildId)==null)return false;
            if(g.OnlinePresentationPacks!=null && g.RemoteBlueprintPreviews!=null)return g.RemoteBlueprintLocked;
            PositionedBlueprint plan=ViewedBlueprint(g);
            return plan!=null && plan.Anchor!=null;
        }

        public static bool SelectBlueprint(Game g,string id)
        {
            FortBlueprint template=FortBlueprint.Find(id);
            if(template==null || g.Player==null || !g.Player.Alive)return false;
            var plans=positionedBlueprints.GetOrCreateValue(g.Player);
            if(!plans.ContainsKey(id))plans.Add(id,new PositionedBlueprint(template.Count));
            Cancel(g);g.BuildId=id;g.BuildAngle=0;g.Panel="";
            PreviewBlueprint(g);
            return true;
        }

        public static bool CancelBlueprint(Game g,string id)
        {
            if(!ClearBlueprint(g,id))return false;
            g.Say("Plan abandoned. Placed pieces remain.");
            return true;
        }

        static bool ClearBlueprint(Game g,string id)
        {
            if(FortBlueprint.Find(id)==null || g.Player==null)return false;
            Dictionary<string,PositionedBlueprint> plans;
            if(!positionedBlueprints.TryGetValue(g.Player,out plans) || !plans.Remove(id))return false;
            if(g.BuildId==id)Cancel(g);
            return true;
        }

        internal static bool RotateBlueprint(Game g,int steps)
        {
            PositionedBlueprint plan=ViewedBlueprint(g);
            if(plan==null)return false;
            if(plan.Anchor!=null){g.Say("Blueprint stays anchored after the first piece.");return false;}
            if(!g.BuildTurned)g.BuildAngle=g.Player.Yaw;
            g.BuildTurned=true;g.BuildAngle+=steps*(float)Math.PI/12f;
            PreviewBlueprint(g);
            return true;
        }

        static Arena.FortFrame BlueprintFrame(Game g,FortBlueprint template)
        {
            Actor a=g.Player;
            float yaw=g.BuildTurned?g.BuildAngle:a.Yaw;
            float reach=Math.Max(1.7f,Math.Min(3f,2.85f+g.Pitch*.85f));
            float x=a.X+reach*(float)Math.Sin(a.Yaw),z=a.Z+reach*(float)Math.Cos(a.Yaw);
            var frame=new Arena.FortFrame { Yaw=yaw };
            // Aim at the first panel so it stays within ordinary placement
            // reach while the rest of the plan rotates around that position.
            float u,v;
            frame.World(template.Parts[0].U,template.Parts[0].V,out u,out v);
            frame.X=x-u;frame.Z=z-v;frame.Y=Arena.Ground(g,frame.X,frame.Z);
            return frame;
        }

        internal static void PreviewBlueprint(Game g)
        {
            Actor a=g.Player;
            FortBlueprint template=FortBlueprint.Find(g.BuildId);
            PositionedBlueprint plan=ViewedBlueprint(g);
            g.Ghost=null;g.GhostFits=g.BuildJoined=false;g.BuildProblem="";
            if(a==null || !a.Alive || template==null || plan==null)return;

            Arena.FortFrame frame=plan.Anchor??BlueprintFrame(g,template);
            int next=plan.Next;
            for(int i=0;i<plan.Previews.Length;i++)
            {
                FortBlueprintPreview preview=plan.Previews[i];
                preview.Complete=plan.Built[i]!=null && !plan.Built[i].Removed;
                preview.Piece=preview.Complete?plan.Built[i]:template.Preview(g,frame,i);
                preview.Next=i==next;preview.Support=null;
                if(preview.Complete){preview.Fits=true;continue;}
                if(!preview.Next){preview.Fits=Arena.FutureFortPieceFits(g,preview.Piece,a);continue;}

                Prop piece=preview.Piece;
                Recipe recipe=Find(Builds,piece.Model);
                preview.Support=Arena.PreviewSupport(g,piece);
                if(!CanMake(a,recipe))g.BuildProblem=Missing(a,recipe);
                else if(Game.Distance(a.X,a.Z,piece.X,piece.Z)>3.1f)g.BuildProblem="Move within reach of the highlighted piece";
                else
                {
                    g.BuildProblem=Arena.BuildBlocker(g,piece);
                    if(g.BuildProblem=="Needs grounded support" && piece.FortLevel>0)
                        g.BuildProblem="Rebuild the supporting piece";
                    else if(g.BuildProblem=="" && plan.Anchor==null && !template.HasClearExits(g,frame))
                        g.BuildProblem="An exit is blocked";
                    else if(g.BuildProblem=="" && !Arena.FortVisible(g,a,piece))
                        g.BuildProblem="Move until you can see the highlighted piece";
                }
                preview.Fits=g.BuildProblem=="";
                g.Ghost=piece;g.GhostFits=preview.Fits;g.BuildJoined=plan.Anchor!=null;
                g.UseX=piece.X;g.UseY=piece.Y+.8f;g.UseZ=piece.Z;
            }
        }

        internal static bool PlaceBlueprint(Game g)
        {
            PositionedBlueprint plan=ViewedBlueprint(g);
            if(plan==null || g.Player==null || !g.Player.Alive)return false;
            PreviewBlueprint(g);
            if(!g.GhostFits || g.Ghost==null){g.Say(g.BuildProblem);return false;}
            int current=plan.Next;
            Prop piece=Build(g,g.Player,g.Ghost);
            if(piece==null){g.Say("The highlighted piece is obstructed");return false;}
            if(plan.Anchor==null)plan.Anchor=piece.Fort;
            plan.Built[current]=piece;
            FortBlueprint template=FortBlueprint.Find(g.BuildId);
            if(plan.Next<0)
            {
                g.Say(template.Name+" completed");
                ClearBlueprint(g,template.Id);
            }
            else
            {
                PreviewBlueprint(g);
                g.Say(template.Name+" "+g.FortBlueprintProgress+"/"+template.Count+" · "+Label(piece.Model)+" placed");
            }
            return true;
        }

        internal static string BlueprintPrompt(Game g)
        {
            string prompt=g.Ghost==null?g.FortBlueprintName:"Next: "+Label(g.Ghost.Model);
            if(!String.IsNullOrEmpty(g.BuildProblem))prompt+="  ·  "+g.BuildProblem;
            if(g.GhostFits)prompt+="   ["+g.InputLabel("Place")+"] Place";
            if(!g.FortBlueprintLocked)prompt+="   ["+g.InputLabel("Rotate")+"] Rotate";
            return prompt+"   ["+g.InputLabel("Cancel")+"] Pause";
        }
    }
}
