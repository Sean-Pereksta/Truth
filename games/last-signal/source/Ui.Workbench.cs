using System;
using System.Collections.Generic;
using System.Drawing;

namespace LastSignal {
    public sealed partial class Ui {
        static readonly string[] craftCategories={"Essentials","Weapons & Armor","Ammo"};
        static readonly string[] buildCategories={"Cover","Camp","Levels","Blueprints"};
        const string WorkPrefix="work:";
        const int WorkPageSize=8;
        string workCategory="",workRecipe="",materialView="",materialReturn="";
        int workOffset,workReturnPackOffset;
        bool workReady;

        sealed class WorkEntry {
            public readonly Recipe Recipe;
            public readonly FortBlueprint Blueprint;
            public readonly bool Build;
            public readonly int Shortcut;

            public WorkEntry(Recipe recipe,bool build,int shortcut) { Recipe=recipe;Build=build;Shortcut=shortcut; }
            public WorkEntry(FortBlueprint blueprint,int shortcut) { Blueprint=blueprint;Build=true;Shortcut=shortcut; }
            public string Id { get { return Recipe==null?Blueprint.Id:Recipe.Id; } }
            public string Name { get { return Recipe==null?Blueprint.Name:Recipe.Name; } }
            public string Info { get { return Recipe==null?Blueprint.Description:Recipe.Info; } }
            public string Key { get { return WorkPrefix+(Build?"b:":"c:")+Id; } }
            public string IconId { get { return Blueprint==null?Id:"wall"; } }
            public bool Ammo { get { return !Build&&(Id=="arrows"||Id=="bolts"); } }
            public string Category { get { return Blueprint==null?Survival.RecipeCategory(Recipe,Build):"Blueprints"; } }
            public IEnumerable<KeyValuePair<string,int>> Needs { get { return Recipe==null?Blueprint.Needs:Recipe.Needs; } }
            public bool Kit(Actor actor) { return Build&&Id=="fire"&&actor.Count("firekit")>0; }
            public int Copies(Actor actor) {
                return Survival.RecipeCopies(actor,Blueprint==null?Recipe:Blueprint.Recipe,Build);
            }
            public bool Ready(Game game) {
                return Blueprint==null?Copies(game.Player)>0:Survival.CanStartBlueprint(game,Blueprint);
            }
            public bool Uses(string id) {
                foreach(var part in Needs)if(part.Key==id)return true;
                return false;
            }
        }

        static IEnumerable<WorkEntry> WorkEntries(bool build) {
            Recipe[] recipes=build?Survival.Builds:Survival.Crafts;
            for(int i=0;i<recipes.Length;i++)yield return new WorkEntry(recipes[i],build,i);
            if(build)for(int i=0;i<FortBlueprint.All.Count;i++)yield return new WorkEntry(FortBlueprint.All[i],i);
        }

        static bool IsWorkMaterial(string id) {
            foreach(bool build in new[]{false,true})foreach(WorkEntry entry in WorkEntries(build))if(entry.Uses(id))return true;
            return false;
        }

        List<WorkEntry> VisibleWork(Game g) {
            bool build=g.Panel=="build";
            var entries=new List<WorkEntry>();
            if(materialView!="") {
                foreach(bool family in new[]{false,true})foreach(WorkEntry entry in WorkEntries(family))
                    if(entry.Uses(materialView)&&(!workReady||entry.Ready(g)))entries.Add(entry);
            } else {
                string[] categories=build?buildCategories:craftCategories;
                if(Array.IndexOf(categories,workCategory)<0)workCategory=categories[0];
                foreach(WorkEntry entry in WorkEntries(build))
                    if(entry.Category==workCategory&&(!workReady||entry.Ready(g)))entries.Add(entry);
            }
            return entries;
        }

        void WorkButton(string id,string title,float x,float y,float width,float height,bool enabled=true,bool active=false) {
            bool hot=enabled&&selected==id;
            Box(x,y,width,height,hot?Color.FromArgb(228,82,74,53):active?Color.FromArgb(226,57,62,47):Color.FromArgb(214,30,43,40));
            Edge(x,y,width,height,hot||active?Gold:A(Brass,105));
            if(enabled)HitBox(id,x,y,width,height);
            Mid(title,x+width/2,y+(height-15)/2,14,enabled?Ivory:Muted,true);
        }

        void Workbench(Game g) {
            bool build=g.Panel=="build";
            float x=(sw-1016)/2,y=(sh-586)/2,left=x+25,details=x+462;
            var entries=VisibleWork(g);
            workOffset=Math.Max(0,Math.Min(workOffset,Math.Max(0,entries.Count-WorkPageSize)));
            WorkEntry focus=entries.Find(e=>e.Key==selected)??entries.Find(e=>e.Key==workRecipe);
            if(focus==null&&entries.Count>0)focus=entries[workOffset];
            workRecipe=focus==null?"":focus.Key;
            if(selected=="workFirst"&&focus!=null)selected=focus.Key;
            Box(0,0,sw,sh,A(Ink,107));Box(x,y,1016,586,Color.FromArgb(246,17,27,27));Edge(x,y,1016,586,A(Brass,170));
            T(materialView==""?(build?"Build":"Craft"):Survival.Label(materialView)+" uses",left,y+17,31,Ivory,true,false,true);
            WorkButton("workReady",workReady?"Ready only: On":"Ready only: Off",x+684,y+23,148,32,true,workReady);
            string close=materialReturn=="pack"?"Back to pack":materialView!=""?"Back to recipes":g.PadActive?"B  Close":"Esc  Close";
            WorkButton("workClose",close,x+845,y+23,146,32);
            if(materialView=="") {
                string[] categories=build?buildCategories:craftCategories;
                for(int i=0;i<categories.Length;i++)WorkButton("workCat"+i,categories[i],left+i*177,y+70,165,36,true,categories[i]==workCategory);
                WorkButton("workOther",build?"Craft":"Build",x+845,y+70,146,36);
            } else {
                T(g.Player.Count(materialView)+" held",left,y+76,17,Gold,true);
                Para(Survival.MaterialSource(materialView),left+120,y+76,500,30,15,Muted);
            }
            Line(x+25,y+120,x+991,y+120,A(Brass,114));
            Line(x+428,y+136,x+428,y+501,A(Brass,93));
            if(entries.Count==0)T(workReady?"Nothing is ready with the supplies you have.":"No recipes use this material.",left,y+150,16,Muted);
            for(int i=workOffset;i<Math.Min(entries.Count,workOffset+WorkPageSize);i++) {
                WorkEntry entry=entries[i];float row=y+140+(i-workOffset)*44;
                bool ready=entry.Ready(g),hot=entry.Key==workRecipe;
                Box(left,row,381,39,hot?Color.FromArgb(225,62,65,51):Color.FromArgb(216,31,44,41));
                if(hot)Edge(left,row,381,39,Gold);
                HitBox(entry.Key,left,row,381,39);
                Icon(entry.IconId,left+6,row+4,30);
                T(entry.Name,left+44,row+9,16,hot||ready?Ivory:Muted,true);
                string tag=materialView!=""?(entry.Blueprint!=null?"BLUEPRINT":entry.Build?"BUILD":"CRAFT"):
                    entry.Shortcut<10?((entry.Shortcut+1)%10).ToString():"";
                Right(tag,left+369,row+11,12,ready?Moss:Muted,true,true);
            }
            if(entries.Count>WorkPageSize) {
                WorkButton("workPrev",g.PadActive?"LB  Previous":"Previous",left,y+505,118,31,workOffset>0);
                WorkButton("workNext",g.PadActive?"RB  Next":"Next",left+263,y+505,118,31,workOffset<entries.Count-WorkPageSize);
            }
            if(focus!=null)WorkDetail(g,focus,details,y+140);
            if(g.ActionId=="craft"&&g.UseProgress>0){
                T("Crafting",details,y+497,14,Gold,true);
                Box(details+84,y+507,410,3,A(Muted,65));Box(details+84,y+507,410*Clamp(g.UseProgress,0,1),3,Gold);
            }
            if(g.NoticeTime<=0)T(g.PadActive?"Left stick / D-pad  Browse     A  Select     Right stick  Look":
                "Number keys  Quick select     Arrow keys  Browse     Right mouse  Look",left,y+550,12,Muted,false,true);
            if(g.NoticeTime>0&&!String.IsNullOrEmpty(g.Notice))Para(g.Notice,left,y+548,965,25,16,Gold);
        }

        void WorkDetail(Game g,WorkEntry entry,float x,float y) {
            Actor actor=g.Player;int copies=entry.Copies(actor);
            T(entry.Name,x,y,27,Ivory,true,false,true);
            Para(entry.Info,x,y+40,501,48,16,Muted);
            string readiness=entry.Blueprint!=null?copies+" full plans available"+(entry.Ready(g)?"   /   Next piece ready":""):
                entry.Build?copies+" copies available":copies+" craft batches available";
            T(readiness,x,y+94,15,entry.Ready(g)?Moss:Muted,true);
            var missing=new List<string>();
            T("Held / Needed",x+165,y+115,12,Muted,true);
            float row=y+135;
            if(entry.Kit(actor))T("Campfire kits   "+actor.Count("firekit")+" / 1",x,row,16,Moss,true);
            else foreach(var need in entry.Blueprint==null?entry.Needs:Survival.BlueprintRemainingRecipe(g,entry.Blueprint).Needs) {
                int held=actor.Count(need.Key),shortage=Math.Max(0,need.Value-held);
                if(shortage>0)missing.Add(shortage+" "+Survival.Label(need.Key).ToLowerInvariant());
                WorkButton("workMat:"+need.Key,Survival.Label(need.Key),x,row,147,28);
                T(held+" / "+need.Value,x+165,row+5,15,shortage>0?Rust:Moss,true,true);
                if(shortage>0)T(Survival.MaterialSource(need.Key),x+250,row+6,13,Muted);
                row+=33;
            }
            if(missing.Count>0)Para("Missing "+String.Join(" + ",missing.ToArray()),x,y+238,500,26,16,Rust);
            bool saved=entry.Blueprint!=null&&Survival.HasSavedBlueprint(g,entry.Blueprint);
            string action=entry.Blueprint!=null?(saved?"Resume blueprint":"Preview blueprint"):
                entry.Build?"Place":entry.Ammo?"Craft "+entry.Recipe.Yield:"Craft";
            WorkButton("workDo",action,x,y+277,182,38,copies>0||entry.Blueprint!=null);
            if(entry.Ammo)WorkButton("workTriple","Craft "+(entry.Recipe.Yield*3),x+196,y+277,182,38,copies>=3);
            if(saved){
                WorkButton("workAbandon","Abandon plan",x+196,y+277,182,38);
                Para("Placed pieces stay in the arena if you abandon the plan.",x,y+329,500,38,14,Muted);
            }else if(entry.Blueprint!=null)Para(entry.Blueprint.Count+" pieces. Place one piece at a time using the arena preview.",x,y+329,500,38,14,Muted);
        }

        void StepWorkbench(Game g,int direction) {
            var entries=VisibleWork(g);if(entries.Count==0)return;
            int index=entries.FindIndex(entry=>entry.Key==workRecipe);
            index=index<0?0:(index+direction+entries.Count)%entries.Count;
            if(index<workOffset)workOffset=index;
            if(index>=workOffset+WorkPageSize)workOffset=index-WorkPageSize+1;
            selected=workRecipe=entries[index].Key;hoverMoved=false;
        }

        void WorkShortcut(Game g,int slot) {
            if(materialView!="")return;
            bool build=g.Panel=="build",blueprint=build&&workCategory=="Blueprints";
            foreach(WorkEntry entry in WorkEntries(build)) {
                if(entry.Shortcut!=slot||(entry.Blueprint!=null)!=blueprint)continue;
                if(workReady&&!entry.Ready(g))return;
                workCategory=entry.Category;workOffset=0;
                selected=workRecipe=entry.Key;RunWork(g,entry,1);return;
            }
        }

        void RunWork(Game g,WorkEntry entry,int batches) {
            if(entry.Blueprint!=null) { if(g.InputBlueprint(entry.Id))g.Panel="";return; }
            if(entry.Build) { if(g.InputRecipe(entry.Recipe,true))g.Panel="";return; }
            g.InputCraft(entry.Recipe,batches);
        }

        bool WorkAction(Game g,string id) {
            if(g.Panel!="craft"&&g.Panel!="build")return false;
            bool build=g.Panel=="build";
            if(id=="workClose") { Close(g);return true; }
            if(id=="workOther") { g.Panel=build?"craft":"build";return true; }
            if(id=="workReady") { workReady=!workReady;workOffset=0;return true; }
            if(id.StartsWith("workCat",StringComparison.Ordinal)) {
                int index;var categories=build?buildCategories:craftCategories;
                if(int.TryParse(id.Substring(7),out index)&&index>=0&&index<categories.Length) {
                    workCategory=categories[index];workRecipe="";workOffset=0;selected="workFirst";
                }
                return true;
            }
            if(id=="workPrev"||id=="workNext") {
                int maximum=Math.Max(0,VisibleWork(g).Count-WorkPageSize);
                workOffset=Math.Max(0,Math.Min(maximum,workOffset+(id=="workPrev"?-WorkPageSize:WorkPageSize)));
                workRecipe="";selected="workFirst";return true;
            }
            if(id.StartsWith("workMat:",StringComparison.Ordinal)) {
                if(materialView=="")materialReturn=g.Panel;
                materialView=id.Substring(8);workOffset=0;workRecipe="";selected="workFirst";return true;
            }
            if(id.StartsWith(WorkPrefix,StringComparison.Ordinal)||id=="workDo"||id=="workTriple"||id=="workAbandon") {
                var entries=VisibleWork(g);
                WorkEntry entry=entries.Find(item=>item.Key==(id.StartsWith(WorkPrefix,StringComparison.Ordinal)?id:workRecipe));
                if(entry!=null) {
                    workRecipe=entry.Key;
                    if(id=="workAbandon") {
                        if(entry.Blueprint!=null&&Survival.HasSavedBlueprint(g,entry.Blueprint))g.InputAbandonBlueprint(entry.Id);
                        selected=entry.Key;
                    }else if(id=="workTriple") { if(entry.Ammo)RunWork(g,entry,3); }
                    else if(id=="workDo"||id.StartsWith(WorkPrefix,StringComparison.Ordinal))RunWork(g,entry,1);
                }
                return true;
            }
            return false;
        }
    }
}
