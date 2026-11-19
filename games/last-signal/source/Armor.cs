using System;
using System.Collections.Generic;

namespace LastSignal
{
    internal sealed class ArmorPiece
    {
        internal readonly string Id;
        internal float Integrity;
        internal ArmorPiece(string id) { Id=id; Integrity=Armor.Capacity(id); }
    }

    public static class Armor
    {
        public const string Woven="woven_vest", Scrap="scrap_cuirass";

        public static bool IsArmor(string id) { return id==Woven || id==Scrap; }
        internal static float Capacity(string id) { return id==Scrap?72f:36f; }
        private static float Protection(string id) { return id==Scrap?.40f:.24f; }

        // Compare protection against a substantial hit first, then remaining wear.
        // A nearly broken cuirass need not replace an intact padded vest.
        private static float Value(ArmorPiece piece)
        {
            return piece==null?0:Math.Min(piece.Integrity,40f*Protection(piece.Id))+.001f*piece.Integrity;
        }
        private static ArmorPiece Best(Actor a,string id)
        {
            ArmorPiece best=null;
            foreach(ArmorPiece piece in a.ArmorPieces)
                if((id==null || id==piece.Id) && Value(piece)>Value(best))best=piece;
            return best;
        }
        private static ArmorPiece ToGive(Actor a,string id)
        {
            ArmorPiece spare=null;
            foreach(ArmorPiece piece in a.ArmorPieces)
                if(piece.Id==id && piece!=a.EquippedArmor && (spare==null || piece.Integrity<spare.Integrity))spare=piece;
            if(spare!=null)return spare;
            return a.WornArmor==id?a.EquippedArmor:null;
        }
        private static void Store(Actor a,ArmorPiece piece)
        {
            a.ArmorPieces.Add(piece);
            a.Bag[piece.Id]=a.Count(piece.Id)+1;
            if(Value(piece)>Value(a.EquippedArmor))a.EquippedArmor=piece;
        }
        private static void Remove(Actor a,ArmorPiece piece)
        {
            a.ArmorPieces.Remove(piece);
            if(piece==a.EquippedArmor)a.EquippedArmor=null;
            int left=a.Count(piece.Id)-1;
            if(left>0)a.Bag[piece.Id]=left;
            else a.Bag.Remove(piece.Id);
        }
        internal static void Adjust(Actor a,string id,int amount)
        {
            for(int i=0;i<amount;i++)Store(a,new ArmorPiece(id));
            for(int i=0;i>amount;i--)
            {
                ArmorPiece piece=ToGive(a,id);
                if(piece==null)break;
                Remove(a,piece);
            }
        }
        public static float Condition(Actor a,string id)
        {
            if(a==null || !IsArmor(id))return 0;
            ArmorPiece piece=a.WornArmor==id?a.EquippedArmor:Best(a,id);
            return piece==null?0:piece.Integrity/Capacity(id);
        }
        public static string Detail(Actor a,string id)
        {
            string state=a.WornArmor==id?"Worn":"Carried";
            return state+"  /  "+Math.Ceiling(Condition(a,id)*100)+"% condition. Absorbs "+
                (id==Scrap?"40%":"24%")+" of torso damage until it breaks. Head and legs are exposed.";
        }
        internal static bool Toggle(Game g,Actor a,string id)
        {
            ArmorPiece piece=Best(a,id);
            if(piece==null)return false;
            if(a.WornArmor==id)
            {
                a.EquippedArmor=null;
                g.Say("Removed "+Survival.Label(id).ToLowerInvariant());
            }
            else
            {
                a.EquippedArmor=piece;
                g.Say("Wearing "+Survival.Label(id).ToLowerInvariant());
            }
            return true;
        }
        public static float Absorb(Game g,Actor wearer,float damage,ImpactSite site)
        {
            ArmorPiece piece=wearer.EquippedArmor;
            float height=(site.Y-wearer.Y)/(wearer.Crouch?1.18f:1.78f);
            if(piece==null || damage<=0 || height<.40f || height>.84f)return damage;
            float absorbed=Math.Min(piece.Integrity,damage*Protection(piece.Id));
            piece.Integrity-=absorbed;
            if(absorbed>=.5f)g.Cue(piece.Id==Scrap?"plated_hit":"woven_hit",wearer.X,wearer.Z,14);
            if(piece.Integrity<=.001f)
            {
                Remove(wearer,piece);
                if(wearer==g.Player)g.Say(Survival.Label(piece.Id)+" broke");
            }
            return damage-absorbed;
        }
        public static bool Give(Actor donor,Actor recipient,string id)
        {
            if(donor==null || recipient==null || donor==recipient || !donor.Alive || !recipient.Alive || !IsArmor(id))return false;
            ArmorPiece piece=ToGive(donor,id);
            if(piece==null)return false;
            Remove(donor,piece);
            Store(recipient,piece);
            return true;
        }
        internal static void PackOne(Actor a,Prop pack,string id)
        {
            ArmorPiece piece=ToGive(a,id);
            if(piece==null)return;
            Remove(a,piece);
            pack.PackedArmor=new List<ArmorPiece>{piece};
        }
        internal static void PackOnDeath(Actor a,Prop pack)
        {
            if(a.ArmorPieces.Count==0)return;
            pack.PackedArmor=new List<ArmorPiece>(a.ArmorPieces);
            a.ArmorAtDeath=a.EquippedArmor;
            a.FallenPack=pack;
            a.ArmorPieces.Clear();
            a.EquippedArmor=null;
            a.Bag.Remove(Woven);
            a.Bag.Remove(Scrap);
        }
        internal static void Collect(Actor a,Prop pack,string id,int count)
        {
            if(pack.PackedArmor!=null)
            {
                for(int i=pack.PackedArmor.Count-1;i>=0 && count>0;i--)
                {
                    ArmorPiece piece=pack.PackedArmor[i];
                    if(piece.Id!=id)continue;
                    Store(a,piece);
                    pack.PackedArmor.RemoveAt(i);
                    count--;
                }
            }
            // Loose or pre-stocked arena gear has no previous wearer.
            Adjust(a,id,count);
        }
        public static void Outfit(Game g,Actor a)
        {
            if(a==null || !a.Alive || a.Weapon=="fists")return;
            a.EquippedArmor=Best(a,null);
            if(a.WornArmor!=Scrap && a.Count(Scrap)==0 && Survival.Craft(g,a,Scrap))return;
            if(a.EquippedArmor==null)Survival.Craft(g,a,Woven);
        }
    }
}
