using System;

namespace LastSignal {
    public partial class Game {
        public static bool IsHarvestTree(Prop p) {
            if(p==null||p.Kind=="pickup")return false;
            switch(p.Model){case "tree":case "oak":case "birch":case "pine":case "pinon":case "snow_fir":return true;default:return false;}
        }
        public static bool IsHarvestRock(Prop p) {
            if(p==null||p.Kind=="pickup")return false;
            switch(p.Model){case "rock":case "boulder":case "mesa_rock":case "snow_boulder":case "sand_hoodoo":return true;default:return false;}
        }
        static bool Harvestable(Prop p){return IsHarvestTree(p)||IsHarvestRock(p);}
        void HarvestNotice(Actor actor,string message) {
            if(actor==Player)Say(message);
            else if(HostingOnlineRound && IsOnlineHuman(actor))WithOnlineSeat(actor.Id,delegate(Game g){g.Say(message);});
        }
        bool HarvestContact(Actor actor,Prop node,ImpactSite contact) {
            if(node.Removed||!Harvestable(node))return false;
            bool tree=IsHarvestTree(node),axe=actor.Weapon=="hatchet";
            if(!axe&&!(tree&&actor.Weapon=="fists"))return false;
            if(!axe){
                if(node.Stripped>0&&Time>=node.BarkReadyAt)node.Stripped=0;
                if(node.Stripped>=3){HarvestNotice(actor,"Bark stripped  ·  Use a hatchet for wood");return true;}
                node.Stripped++;node.BarkReadyAt=Time+45;actor.Add("fiber",1);
                HitEffect("wood",contact.X,contact.Y,contact.Z,3);Cue("rustle",contact.X,contact.Z,8);
                HarvestNotice(actor,"+1 fiber  ·  Hatchet yields wood");return true;
            }
            if(node.HP<=0){HarvestNotice(actor,"Rock face depleted");return true;}
            float wear=tree?20f:12.5f;
            int amount=Math.Min(actor.Heavy?2:1,(int)Math.Ceiling(node.HP/wear));
            actor.Add(tree?"branch":"stone",amount);
            node.HP=Math.Max(0,node.HP-wear*amount);
            HitEffect(tree?"wood":"spark",contact.X,contact.Y,contact.Z,actor.Heavy?10:6);
            SoundAt(actor,tree?35:29,tree?"chop":null);Cue(tree?"wood":"guard",contact.X,contact.Z,32);
            if(tree){
                actor.Add("fiber",1);
                if(node.HP<=0){
                    node.FelledAt=Clock;node.FellDirection=actor.Yaw;
                    Arena.FellTree(this,node);
                    SoundAt(actor,52);Cue("timber_fall",node.X,node.Z,54);
                }
            }
            string reward=tree?"+"+amount+" wood  ·  +1 fiber":"+"+amount+" stone";
            HarvestNotice(actor,node.HP>0?reward:reward+(tree?"  ·  Tree felled":"  ·  Rock face depleted"));
            return true;
        }
    }
    public static partial class Arena {
        internal static void FellTree(Game g,Prop tree) {
            if(tree.Removed)return;
            var field=fields.GetOrCreateValue(g);
            tree.Removed=true;tree.Solid=tree.Opaque=false;
            UnindexGeometry(field,tree);field.Revision++;
        }
    }
}
