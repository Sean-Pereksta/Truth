namespace LastSignal
{
    public static partial class OnlineSnapshot
    {
        // Optional presentation on the existing ghost. The wire shape stays
        // the same, and clients without blueprint UI still get the next piece.
        const string BlueprintFlags="blueprint_flags",BlueprintSupport="blueprint_support",BlueprintCatalog="blueprint_catalog";
        const int BlueprintLockedBit=1<<25;

        static Prop CaptureBlueprintGhost(Game g,Sender source)
        {
            FortBlueprintPreview[] previews=g.FortBlueprintPreviews;
            Prop ghost=g.Ghost;
            bool active=ghost!=null && ghost.Fort!=null && previews.Length>0;
            if(active)ghost=CopyBlueprintEnvelope(g.Ghost);
            foreach(FortBlueprint template in FortBlueprint.All)
            {
                int mask=Survival.BlueprintCatalogState(g,template);
                if(mask==0)continue;
                if(ghost==g.Ghost)ghost=CopyBlueprintEnvelope(g.Ghost);
                ghost.Bag[template.Id]=mask;
            }
            if(active)
            {
                int flags=g.FortBlueprintLocked?BlueprintLockedBit:0;
                for(int i=0;i<previews.Length;i++)
                {
                    FortBlueprintPreview p=previews[i];
                    int part=(p.Complete?1:0)|(p.Next?2:0)|(p.Fits?4:0);
                    flags|=part<<(i*3);
                    if(p.Next && p.Support!=null)ghost.Bag[BlueprintSupport]=PropId(source,p.Support);
                }
                ghost.Bag[BlueprintFlags]=flags;
            }
            return ghost;
        }

        static Prop CopyBlueprintEnvelope(Prop existing)
        {
            // A paused catalog has no drawable ghost, and a zero-size proxy
            // keeps its costs in the existing seat-view record.
            if(existing==null)return new Prop{Model=BlueprintCatalog,W=0,D=0,H=0,Scale=0};
            var copy=new Prop{Fort=existing.Fort};
            SnapshotFields.Copy(existing,copy);
            return copy;
        }

        static void ApplyBlueprintGhost(Game g)
        {
            g.RemoteBlueprintPreviews=null;g.RemoteBlueprintLocked=false;
            if(g.RemoteBlueprintCompletion!=null)g.RemoteBlueprintCompletion.Clear();
            if(g.Ghost==null)return;
            foreach(FortBlueprint blueprint in FortBlueprint.All)
            {
                int mask;
                if(!g.Ghost.Bag.TryGetValue(blueprint.Id,out mask))continue;
                if(g.RemoteBlueprintCompletion==null)g.RemoteBlueprintCompletion=new System.Collections.Generic.Dictionary<string,int>();
                g.RemoteBlueprintCompletion[blueprint.Id]=mask;
            }
            if(g.Ghost.Model==BlueprintCatalog){g.Ghost=null;return;}
            FortBlueprint template=FortBlueprint.Find(g.BuildId);
            int flags;
            if(template==null || g.Ghost.Fort==null ||
                !g.Ghost.Bag.TryGetValue(BlueprintFlags,out flags))return;

            g.RemoteBlueprintLocked=(flags&BlueprintLockedBit)!=0;
            var previews=new FortBlueprintPreview[template.Count];
            for(int i=0;i<previews.Length;i++)
            {
                int part=(flags>>(i*3))&7;
                bool next=(part&2)!=0;
                int supportIndex;
                Prop support=next && g.Ghost.Bag.TryGetValue(BlueprintSupport,out supportIndex)?Item(g.Props,supportIndex):null;
                previews[i]=new FortBlueprintPreview{
                    Piece=next?g.Ghost:template.Preview(g,g.Ghost.Fort,i),Support=support,
                    Complete=(part&1)!=0,Next=next,Fits=(part&4)!=0};
            }
            g.RemoteBlueprintPreviews=previews;
        }
    }
}
