using System;

namespace LastSignal {
    public partial class Game {
        public OnlineSession Online;
        public bool NetworkMatch { get { return Online!=null && Online.Phase=="playing"; } }
        bool RemoteInput { get { return NetworkMatch && !Online.IsHost; } }

        // Menus and camera belong to this window. Gameplay mutations belong to the host.
        public OnlinePlayerInput SampleOnlineInput() {
            var frame=new OnlinePlayerInput();
            if(Player==null)return frame;
            frame.Yaw=Player.Yaw;frame.Pitch=Pitch;
            if(Panel!="" || Mode!="match" || !Player.Alive)return frame;
            frame.Forward=PadActive?PadMoveY:(Down("Forward")?1:0)-(Down("Back")?1:0);
            frame.Right=PadActive?PadMoveX:(Down("Right")?1:0)-(Down("Left")?1:0);
            frame.Lean=PadActive?PadLean:(Down("Lean right")?1:0)-(Down("Lean left")?1:0);
            frame.Sprint=PadActive?PadSprint:Down("Sprint");
            frame.Crouch=PadActive?PadCrouch:Down("Crouch");
            return frame;
        }
        public void InputPress(string action) {
            if(!RemoteInput){Press(action);return;}
            if(Mode!="match"||Player==null||!Player.Alive||Panel!="")return;
            if(action=="Dismiss"){Dismissed=true;NoticeTime=0;Online.Command("+Dismiss","");return;}
            if(Countdown>0)return;
            if(action=="Build"||action=="Craft"||action=="Pack"){
                Panel=action.ToLowerInvariant();InputUnfocus();return;
            }
            if(action=="Attack"&&BuildId!=""){InputPlace(!PadActive&&Down("Sprint"));return;}
            if(action=="Rotate"){InputRotate(1);return;}
            if(action=="Cycle"){InputCycle(1);return;}
            if(action=="Next weapon"||action=="Previous weapon"){InputWeapon(action=="Next weapon"?1:-1);return;}
            if(action=="Forward"||action=="Back"||action=="Left"||action=="Right"||action=="Lean left"||action=="Lean right"||action=="Sprint"||action=="Crouch")return;
            Online.Command("+"+action,"");
        }
        public void InputRelease(string action) {
            if(!RemoteInput){Release(action);return;}
            if(action=="Attack"||action=="Throw"||action=="Guard")Online.Command("-"+action,"");
        }
        public void InputUnfocus() {
            if(RemoteInput)Online.Command("unfocus","");
            Unfocus();
        }
        public void InputRotate(int direction) {
            if(RemoteInput)Online.Command("rotate",direction<0?"-1":"1");
            else Survival.Rotate(this,direction);
        }
        public void InputCycle(int direction) {
            if(RemoteInput)Online.Command("cycle",direction<0?"-1":"1");
            else Survival.CycleUse(this,direction);
        }
        public void InputWeapon(int direction) {
            if(RemoteInput)Online.Command("weapon",direction<0?"-1":"1");
            else CycleWeapon(direction);
        }
        public void InputCancel() {
            if(RemoteInput)Online.Command("cancel","");
            else Survival.Cancel(this);
        }
        public void InputPlace(bool repeat) {
            if(RemoteInput)Online.Command(repeat?"repeat":"place","");
            else Survival.Place(this,repeat);
        }
        public bool InputRecipe(Recipe recipe,bool build) {
            if(recipe==null)return false;
            if(!build)return InputCraft(recipe,1);
            if(!RemoteInput)return Survival.ChooseBuild(this,recipe.Id);
            if(Player==null)return false;
            if(!Survival.CanMake(Player,recipe)){Say(Survival.Missing(Player,recipe));return false;}
            Online.Command("build",recipe.Id);return true;
        }
        public bool InputCraft(Recipe recipe,int batches) {
            if(recipe==null)return false;
            if(!RemoteInput)return Survival.ChooseCraft(this,recipe.Id,batches);
            if(Player==null || !Survival.CanCraftBatches(Player,recipe,batches))return false;
            Online.Command("craft",batches==3?recipe.Id+":3":recipe.Id);
            return true;
        }
        public bool InputBlueprint(string id) {
            if(Player==null || FortBlueprint.Find(id)==null)return false;
            if(!RemoteInput)return Survival.ChooseBuild(this,id);
            Online.Command("build",id);
            return true;
        }
        public bool InputAbandonBlueprint(string id) {
            if(Player==null || FortBlueprint.Find(id)==null)return false;
            if(!RemoteInput)return Survival.CancelBlueprint(this,id);
            Online.Command("abandon-blueprint",id);
            return true;
        }
        public bool InputUseItem(string id) {
            if(!RemoteInput)return Survival.UsePack(this,id);
            if(Player==null||Player.Count(id)<1)return false;
            Online.Command("pack",id);return true;
        }
        public void InputDrop(string id) {
            if(RemoteInput)Online.Command("drop",id);
            else Survival.Drop(this,id);
        }
    }
}
