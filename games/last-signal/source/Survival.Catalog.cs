using System;
using System.Collections.Generic;

namespace LastSignal {
    public static partial class Survival {
        public static string MaterialSource(string id) {
            switch(id) {
            case "branch": return "Harvest a tree with a hatchet";
            case "fiber": return "Gather plants or strip bark from trees";
            case "stone": return "Harvest a rock with a hatchet";
            case "scrap": case "cloth": return "Look in supply caches and packs";
            case "tinder": return "Look for dry brush or supply caches";
            case "firekit": return "Craft a campfire kit";
            default: return "";
            }
        }

        public static string RecipeCategory(Recipe recipe,bool build) {
            switch(recipe.Id) {
            case "fire": return build?"Camp":"Essentials";
            case "hatchet": case "bandage": case "waterskin": return "Essentials";
            case "arrows": case "bolts": return "Ammo";
            case "wall": case "barricade": case "gate": return "Cover";
            case "lean_to": case "rain_barrel": return "Camp";
            case "floor": case "ramp": return "Levels";
            default: return "Weapons & Armor";
            }
        }

        internal static int MaterialCopies(Actor actor,IEnumerable<KeyValuePair<string,int>> needs) {
            if(actor==null || !actor.Alive)return 0;
            int copies=int.MaxValue;
            foreach(var item in needs)copies=Math.Min(copies,actor.Count(item.Key)/item.Value);
            return copies==int.MaxValue?0:copies;
        }

        public static int RecipeCopies(Actor actor,Recipe recipe,bool build) {
            if(recipe==null || actor==null || !actor.Alive)return 0;
            int copies=MaterialCopies(actor,recipe.Needs);
            return build&&recipe.Id=="fire"?copies+actor.Count("firekit"):copies;
        }

        public static bool CanCraftBatches(Actor actor,Recipe recipe,int batches) {
            return recipe!=null&&(batches==1 || batches==3&&(recipe.Id=="arrows" || recipe.Id=="bolts")) &&
                RecipeCopies(actor,recipe,false)>=batches;
        }

        internal static bool ChooseCraftCommand(Game g,string argument) {
            int split=argument.IndexOf(':');
            if(split<0)return ChooseCraft(g,argument);
            if(argument.Substring(split+1)!="3")return false;
            return ChooseCraft(g,argument.Substring(0,split),3);
        }
    }
}
