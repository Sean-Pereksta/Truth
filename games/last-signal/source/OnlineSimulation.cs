using System;
using System.Collections.Generic;
using System.Windows.Forms;

namespace LastSignal {
    // Clients describe intentions. The host owns positions, hits, inventory,
    // crafting costs, timers and every other change to the arena.
    public sealed class OnlinePlayerInput {
        public int Sequence;
        public float Right,Forward,Lean,Yaw,Pitch;
        public bool Sprint,Crouch;
        public List<string> Actions = new List<string>();
    }

    public partial class Game {
        const int MaxOnlineSeats=8;
        OnlineSeat[] onlineSeats;
        int activeView;
        int onlineHumanCount;
        public bool HostingOnlineRound { get { return onlineSeats!=null; } }
        public int HumanCount {
            get { return HostingOnlineRound?onlineHumanCount:OnlinePresentationPacks!=null?OnlineSnapshotHumans:(Player==null?0:1); }
        }

        sealed class OnlineSeat {
            public int Sequence=-1;
            public bool Connected=true,ReceivedInput;
            public float HeardAt;
            public Actor Player,CameraTarget;
            public string Mode="match",Panel="",Notice="",Hint="",Zone="";
            public float CamX,CamY,CamZ,CamPitch,CamYaw,Pitch,Charge,MoveX,MoveZ,NoticeTime,lean,footsteps;
            public bool Charging,Dismissed;
            public float IncomingImpact,IncomingAngle,IncomingStrength,ConfirmedImpact;
            public string switchTo="",bufferedWeapon="";
            public bool guardHeld;
            public float bufferedPower,bufferedUntil;
            public HashSet<Keys> Held=new HashSet<Keys>();
            public bool PadActive,PadCrouch,PadSprint;
            public float PadMoveX,PadMoveY,PadLean;
            public string BuildId="",BuildProblem="",ActionId="",ActionArgument="";
            public float BuildAngle,UseX,UseY,UseZ,UseProgress,ActionElapsed,ActionTotal;
            public float RepairStartHealth;
            public bool BuildTurned,BuildJoined,GhostFits,FocusShore;
            public Prop UseProp,FocusProp,Ghost;
            public Animal UseAnimal,FocusAnimal;
            public List<string> FocusOptions=new List<string>();
            public int FocusChoice,ActionBatches;

            // Exchange just the first-person view and its input/action state.
            // The world, its timers, actors, heating and the physics index stay shared.
            public void Exchange(Game g) {
                Swap(ref Player,ref g.Player); Swap(ref CameraTarget,ref g.CameraTarget);
                Swap(ref Mode,ref g.Mode); Swap(ref Panel,ref g.Panel); Swap(ref Notice,ref g.Notice);
                Swap(ref Hint,ref g.Hint); Swap(ref Zone,ref g.Zone); Swap(ref NoticeTime,ref g.NoticeTime);
                Swap(ref CamX,ref g.CamX); Swap(ref CamY,ref g.CamY); Swap(ref CamZ,ref g.CamZ);
                Swap(ref CamPitch,ref g.CamPitch); Swap(ref CamYaw,ref g.CamYaw); Swap(ref Pitch,ref g.Pitch);
                Swap(ref MoveX,ref g.MoveX); Swap(ref MoveZ,ref g.MoveZ); Swap(ref lean,ref g.lean);
                Swap(ref footsteps,ref g.footsteps); Swap(ref Charging,ref g.Charging); Swap(ref Charge,ref g.Charge);
                Swap(ref Dismissed,ref g.Dismissed); Swap(ref Held,ref g.Held);
                Swap(ref IncomingImpact,ref g.IncomingImpact); Swap(ref IncomingAngle,ref g.IncomingAngle);
                Swap(ref IncomingStrength,ref g.IncomingStrength); Swap(ref ConfirmedImpact,ref g.ConfirmedImpact);
                Swap(ref switchTo,ref g.switchTo); Swap(ref bufferedWeapon,ref g.bufferedWeapon);
                Swap(ref guardHeld,ref g.guardHeld); Swap(ref bufferedPower,ref g.bufferedPower); Swap(ref bufferedUntil,ref g.bufferedUntil);
                Swap(ref PadActive,ref g.PadActive); Swap(ref PadCrouch,ref g.PadCrouch); Swap(ref PadSprint,ref g.PadSprint);
                Swap(ref PadMoveX,ref g.PadMoveX); Swap(ref PadMoveY,ref g.PadMoveY); Swap(ref PadLean,ref g.PadLean);
                Swap(ref BuildId,ref g.BuildId); Swap(ref BuildProblem,ref g.BuildProblem);
                Swap(ref ActionId,ref g.ActionId); Swap(ref ActionArgument,ref g.ActionArgument);
                Swap(ref ActionBatches,ref g.ActionBatches); Swap(ref RepairStartHealth,ref g.RepairStartHealth);
                Swap(ref BuildAngle,ref g.BuildAngle); Swap(ref UseX,ref g.UseX); Swap(ref UseY,ref g.UseY); Swap(ref UseZ,ref g.UseZ);
                Swap(ref UseProgress,ref g.UseProgress); Swap(ref ActionElapsed,ref g.ActionElapsed); Swap(ref ActionTotal,ref g.ActionTotal);
                Swap(ref BuildTurned,ref g.BuildTurned); Swap(ref BuildJoined,ref g.BuildJoined);
                Swap(ref GhostFits,ref g.GhostFits); Swap(ref Ghost,ref g.Ghost); Swap(ref FocusChoice,ref g.FocusChoice);
                Swap(ref UseProp,ref g.UseProp); Swap(ref FocusProp,ref g.FocusProp);
                Swap(ref UseAnimal,ref g.UseAnimal); Swap(ref FocusAnimal,ref g.FocusAnimal);
                Swap(ref FocusShore,ref g.FocusShore); Swap(ref FocusOptions,ref g.FocusOptions);
            }
        }
        static void Swap<T>(ref T a,ref T b) { T tmp=a;a=b;b=tmp; }

        public bool IsOnlineHuman(Actor actor) {
            if(actor==null||actor.Id<0||actor.Id>=MaxOnlineSeats)return false;
            return onlineSeats!=null?onlineSeats[actor.Id]!=null:OnlinePresentationPacks!=null&&(OnlinePresentationSeatMask&(1<<actor.Id))!=0;
        }
        internal bool PlayerDriven(Actor actor) { return HostingOnlineRound?IsOnlineHuman(actor):actor==Player; }
        OnlineSeat Seat(int id) { return onlineSeats!=null && id>=0 && id<MaxOnlineSeats?onlineSeats[id]:null; }
        public void StartOnlineRound(string[] names,int seed,int arena,int difficulty,int hunger,bool events) {
            if(names==null || names.Length>MaxOnlineSeats || names.Length==0 || String.IsNullOrWhiteSpace(names[0]))
                throw new ArgumentException("The host occupies seat zero. Rooms have one to eight seats.","names");
            var seats=new OnlineSeat[MaxOnlineSeats];
            for(int i=0;i<names.Length;i++)if(!String.IsNullOrWhiteSpace(names[i]))seats[i]=new OnlineSeat();
            int oldSeed=ForcedSeed,oldBots=Settings.Bots,oldArena=Settings.ArenaId,oldLevel=Settings.Difficulty,oldHunger=Settings.Hunger;
            bool oldEvents=Settings.Events;
            try {
                ForcedSeed=seed;Settings.Bots=23;Settings.ArenaId=Math.Max(0,Math.Min(2,arena));
                Settings.Difficulty=Math.Max(0,Math.Min(3,difficulty));Settings.Hunger=Math.Max(0,Math.Min(2,hunger));Settings.Events=events;
                StartRound(true,seats,names);
            } finally {
                ForcedSeed=oldSeed;Settings.Bots=oldBots;Settings.ArenaId=oldArena;
                Settings.Difficulty=oldLevel;Settings.Hunger=oldHunger;Settings.Events=oldEvents;
            }
        }
        void PrepareSeats(string[] names) {
            for(int i=0;i<names.Length;i++) {
                OnlineSeat s=onlineSeats[i];if(s==null)continue;
                Actor a=Actors[i];string label=names[i].Trim();a.Name=label.Substring(0,Math.Min(24,label.Length));a.Style="player";
                s.Player=s.CameraTarget=a;s.CamYaw=a.Yaw;s.CamX=a.X;s.CamY=a.Y+1.58f;s.CamZ=a.Z;
                onlineHumanCount++;
            }
        }
        public void WithOnlineSeat(int id,Action<Game> visit) {
            OnlineSeat s=Seat(id);if(s==null||visit==null)return;
            if(activeView==id){visit(this);return;}
            if(activeView!=0)throw new InvalidOperationException("Complete the current player's view before switching seats.");
            activeView=id;s.Exchange(this);
            try {
                if(Winner!=null){Mode="results";CameraTarget=Winner;}
                else if(!Player.Alive && Mode=="match"){Mode="dead";Panel="";Unfocus();Survival.Cancel(this);}
                visit(this);
            } finally {
                s.Exchange(this);activeView=0;
                if(Winner!=null && Mode!="results"){Mode="results";CameraTarget=Winner;Panel="";Unfocus();}
            }
        }
        public void OnlineForEachView(Action<int> writeSeat) {
            if(onlineSeats==null||writeSeat==null)return;
            for(int i=0;i<onlineSeats.Length;i++)if(onlineSeats[i]!=null){
                int seat=i;WithOnlineSeat(i,delegate(Game g){writeSeat(seat);});
            }
        }
        public void RefreshOnlineCamera(float dt) { UpdateCamera(dt); }

        public void SetOnlineSeatConnected(int id,bool connected) {
            OnlineSeat s=Seat(id);if(s==null)return;
            WithOnlineSeat(id,delegate(Game g){NeutralOnlineInput();Survival.Cancel(g);});
            s.Connected=connected;s.ReceivedInput=false;s.HeardAt=Clock;
            if(connected)s.Sequence=-1;
        }
        public void ReleaseOnlineSeat(int id) {
            OnlineSeat s=Seat(id);if(s==null)return;
            SetOnlineSeatConnected(id,false);
            onlineSeats[id]=null;onlineHumanCount--;
            Brains.InheritContestant(this,Actors[id]);
        }
        void NeutralOnlineInput() {
            Unfocus();PadMoveX=PadMoveY=PadLean=0;PadCrouch=PadSprint=false;
        }
        static float Axis(float f,float limit) { return float.IsNaN(f)||float.IsInfinity(f)?0:Math.Max(-limit,Math.Min(limit,f)); }
        public void ApplyOnlineInput(int id,OnlinePlayerInput input) {
            OnlineSeat s=Seat(id);
            if(s==null || !s.Connected || input==null || input.Sequence<=s.Sequence || Winner!=null)return;
            s.Sequence=input.Sequence;s.HeardAt=Clock;s.ReceivedInput=true;
            WithOnlineSeat(id,delegate(Game g) {
                if(!Player.Alive)return;
                PadActive=true;PadMoveX=Axis(input.Right,1);PadMoveY=Axis(input.Forward,1);
                PadLean=Axis(input.Lean,1);PadCrouch=input.Crouch;PadSprint=input.Sprint;
                Player.Yaw=Wrap(Axis(input.Yaw,1000)%(float)(2*Math.PI));Pitch=Axis(input.Pitch,1.46f);
                Player.GuardPitch=Pitch;UpdateCamera(0);
                if(input.Actions==null)return;
                for(int i=0;i<input.Actions.Count && i<32;i++)ApplyOnlineAction(input.Actions[i]);
            });
        }
        void ApplyOnlineAction(string action) {
            if(String.IsNullOrEmpty(action)||action.Length>48)return;
            if(action=="unfocus"){NeutralOnlineInput();return;}
            if(Countdown>0||!CanAct)return;
            if(action[0]=='+'||action[0]=='-'){
                string key=action.Substring(1);
                switch(key) {
                case "Attack":case "Guard":case "Throw":case "Dodge":case "Shove":case "Jump":case "Use":
                case "Dismiss":case "Next weapon":case "Previous weapon":
                case "Weapon 1":case "Weapon 2":case "Weapon 3":case "Weapon 4":case "Weapon 5":case "Weapon 6":case "Weapon 7":
                    if(action[0]=='+')Press(key);else Release(key);break;
                }
                return;
            }
            int separator=action.IndexOf(':');
            string verb=separator<0?action:action.Substring(0,separator);
            string arg=separator<0?"":action.Substring(separator+1);
            switch(verb) {
                case "build":Survival.ChooseBuild(this,arg);break;
                case "abandon-blueprint":Survival.CancelBlueprint(this,arg);break;
                case "craft":Survival.ChooseCraftCommand(this,arg);break;
                case "repair":Survival.BeginRepair(this);break;
                case "pack":Survival.UsePack(this,arg);break;
                case "drop":Survival.Drop(this,arg);break;
                case "equip":RequestWeapon(arg);break;
                case "place":Survival.Place(this,arg=="1");break;
                case "repeat":Survival.Place(this,true);break;
                case "cancel":Survival.Cancel(this);break;
                case "rotate":Survival.Rotate(this,arg=="-1"?-1:1);break;
                case "cycle":Survival.CycleUse(this,arg=="-1"?-1:1);break;
                case "weapon":CycleWeapon(arg=="-1"?-1:1);break;
            }
        }
        void StepOnlineMovement(float dt) {
            for(int i=0;i<onlineSeats.Length;i++){
                OnlineSeat s=onlineSeats[i];if(s==null)continue;
                WithOnlineSeat(i,delegate(Game g) {
                    if(s.ReceivedInput && Clock-s.HeardAt>1){NeutralOnlineInput();s.ReceivedInput=false;}
                    if(s.Connected && CanAct)Movement(dt);
                    else if(Player.Alive){Player.Speed=0;Player.Sprint=false;}
                    Player.GuardPitch=Pitch;
                });
            }
        }
        void StepRemoteViews(float dt) {
            for(int i=1;i<onlineSeats.Length;i++)if(onlineSeats[i]!=null){
                WithOnlineSeat(i,delegate(Game g){
                    NoticeTime=Math.Max(0,NoticeTime-dt);ConfirmedImpact=Math.Max(0,ConfirmedImpact-dt);
                    IncomingImpact=Math.Max(0,IncomingImpact-dt);
                    PlayerFollowThrough();UpdateCamera(dt);Survival.TickInteraction(g,dt);
                });
            }
        }
        internal bool PlayerCharging(Actor a) {
            if(a==Player)return Charging;
            OnlineSeat s=StoredView(a);return s!=null&&s.Charging;
        }
        OnlineSeat StoredView(Actor a) {
            if(!IsOnlineHuman(a))return null;
            return activeView!=0 && a.Id==0?Seat(activeView):Seat(a.Id);
        }
        void ReportInjury(Actor a,float angle,float damage) {
            float strength=Math.Min(1,.27f+damage/62f);
            if(a==Player){IncomingAngle=angle;IncomingImpact=.57f;IncomingStrength=strength;return;}
            OnlineSeat s=StoredView(a);
            if(s!=null){s.IncomingAngle=angle;s.IncomingImpact=.57f;s.IncomingStrength=strength;}
        }
        void ConfirmContact(Actor a) {
            if(a==Player){ConfirmedImpact=.17f;return;}
            OnlineSeat s=StoredView(a);if(s!=null)s.ConfirmedImpact=.17f;
        }
        internal bool LeanEye(Actor a,out float x,out float y,out float z) {
            if(a==Player&&CameraTarget==a){x=CamX;y=CamY;z=CamZ;return true;}
            OnlineSeat s=StoredView(a);
            if(s!=null && s.CameraTarget==a){x=s.CamX;y=s.CamY;z=s.CamZ;return true;}
            x=y=z=0;return false;
        }
    }
}
