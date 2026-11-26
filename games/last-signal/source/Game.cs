using System;
using System.Collections.Generic;
using System.Windows.Forms;

namespace LastSignal {
    public partial class Game {
        public int Level=1,HungerLevel=1; public bool EventsOn=true;
        public HashSet<Keys> Held=new HashSet<Keys>();
        public Action<string,float,float> Audio; 
        public float AudioGain=1;
        public int ForcedSeed;
        bool customLast; float footsteps,lean,pressureClock; int eventStage=-1;
        readonly Dictionary<Actor,float> attackPitch=new Dictionary<Actor,float>();
        static readonly string[] Names={"You","Alder","Wren","Flint","Sorrel","Rune","Ash","Sable","Kestrel","Moss","Tarn","Wynn","Briar","Rill","Fen","Reed","Iris","Thorn","Lark","Cairn","Hazel","Rowan","Finch","Ember"};
        public bool Down(string action) {
            if(PadActive&&action=="Lean left")return PadLean<-.1f;
            if(PadActive&&action=="Lean right")return PadLean>.1f;
            Keys key;return Settings.KeysMap.TryGetValue(action,out key)&&Held.Contains(key);
        }
        public void Cue(string name,float x,float z,float range) {
            OnlineSnapshot.RecordSound(this,name,x,z,range);
            if(Audio==null)return;
            OnlineSeat listener=activeView==0?null:Seat(activeView);
            float lx=listener==null?CamX:listener.CamX,lz=listener==null?CamZ:listener.CamZ,angle=listener==null?CamYaw:listener.CamYaw;
            float dx=x-lx,dz=z-lz,d=Distance(x,z,lx,lz);
            if(d>range)return;
            float side=d<.1f?0:(dx*(float)Math.Cos(angle)-dz*(float)Math.Sin(angle))/d;
            Audio(name,AudioGain*(1-d/range),side*.78f);
        }
        public void GlobalCue(string name) {OnlineSnapshot.RecordSound(this,name,0,0,-1);if(Audio!=null)Audio(name,.78f,0);}
        public void TruceSignal(Actor speaker,bool accepted){
            if(speaker==null||!speaker.Alive)return;
            speaker.TruceGestureAt=Time;speaker.TruceAccepted=accepted;
            Cue(accepted?"truce_accept":"truce_offer",speaker.X,speaker.Z,18);
            SoundAt(speaker,12);
        }
        void ClearMatch() {
            onlineSeats=null;onlineHumanCount=0;activeView=0;
            FortFalls.Clear();
            ResetImpacts();ResetClimate();CancelAttackInput();
            Held.Clear(); Actors.Clear(); Animals.Clear(); Props.Clear(); Effects.Clear(); Noises.Clear(); Shots.Clear(); attackPitch.Clear();
            Player=CameraTarget=Winner=null; Countdown=Time=Clock=0; NoticeTime=EventTime=FeedTime=UseProgress=Charge=0;
            Hint=EventText=Notice=KillFeed=Panel=""; Charging=Rain=Flood=Dismissed=false; SafeRadius=Arena.Radius+1;
            footsteps=lean=pressureClock=0;eventStage=-1; MoveX=MoveZ=Pitch=0; AliveCount=0;
            PadMoveX=PadMoveY=PadLean=0;PadSprint=PadCrouch=false;
            Survival.Restart(this);
        }
        public void Menu() {
            ClearMatch(); Mode="menu"; Seed=2718;Rng=new Random(Seed);ArenaId=nextStandardArena;LoadArena();Ready=true;
            UpdateCamera(0);
        }
        public void Start(bool custom) { StartRound(custom,null,null); }
        void StartRound(bool custom,OnlineSeat[] seats,string[] names) {
            customLast=custom;ClearMatch();Mode="match";
            Seed=ForcedSeed!=0?ForcedSeed:(Guid.NewGuid().GetHashCode()&0x3fffffff);
            Rng=new Random(Seed); Level=custom?Settings.Difficulty:1;HungerLevel=custom?Settings.Hunger:1;EventsOn=!custom||Settings.Events;
            ArenaId=custom?Math.Min(2,Math.Max(0,Settings.ArenaId)):nextStandardArena;
            if(!custom)nextStandardArena=(ArenaId+1)%3;
            LoadArena();
            int bots=custom?Math.Min(23,Math.Max(1,Settings.Bots)):23;
            for(int i=0;i<=bots;i++){
                int platform=(int)Math.Round(i*24d/(1+bots))%24;
                double angle=platform*Math.PI/12.0;float x=18*(float)Math.Sin(angle),z=18*(float)Math.Cos(angle);
                Actor a=new Actor{Id=i,Name=Names[i],X=x,Z=z,Y=Arena.Ground(this,x,z),Yaw=(float)Math.Atan2(-x,-z),TeamColor=(i+Seed%6)%6};
                Actors.Add(a);
            }
            Player=Actors[0]; Player.Style="player"; CameraTarget=Player; AliveCount=Actors.Count;
            onlineSeats=seats;if(seats!=null)PrepareSeats(names);
            Countdown=4;Ready=true; Brains.Reset(this); UpdateCamera(0); GlobalCue("start");
        }
        public void Replay() { Start(customLast); }
        public void Spectate(int direction) {
            if(Winner!=null)return;
            int i=CameraTarget==null?0:Actors.IndexOf(CameraTarget);
            int step=direction<0?-1:1;
            for(int n=0;n<Actors.Count;n++){i=(i+step+Actors.Count)%Actors.Count;if(Actors[i].Alive){CameraTarget=Actors[i];SpectateIndex=i;break;}}
            Mode="spectate"; Panel="";UpdateCamera(0);
        }
        public void Look(float dx,float dy){
            if(Mode!="match"||Player==null||!Player.Alive)return;
            float sens=.0024f*Settings.Sensitivity*(Player.Aiming?.68f:1);
            Player.Yaw=Wrap(Player.Yaw+dx*sens);Pitch=Math.Max(-1.46f,Math.Min(1.46f,Pitch-dy*sens));UpdateCamera(0);
        }
        static float Wrap(float a){while(a>(float)Math.PI)a-=(float)(2*Math.PI);while(a<-(float)Math.PI)a+=(float)(2*Math.PI);return a;}
        public bool CanAct {get{return Mode=="match"&&Player!=null&&Player.Alive&&Countdown<=0&&Panel=="";}}
        public void Press(string action){
            if(Mode!="match"||Player==null||!Player.Alive||Panel!="")return;
            if(action=="Dismiss"){Dismissed=true;NoticeTime=0;return;}
            if(Countdown>0)return;
            if(action=="Next weapon"||action=="Previous weapon"){CycleWeapon(action=="Next weapon"?1:-1);return;}
            if(action.Length==8&&action.StartsWith("Weapon ",StringComparison.Ordinal)&&action[7]>='1'&&action[7]<='7'){
                RequestWeapon(belt[action[7]-'1']);return;
            }
            switch(action){
            case "Use": Survival.BeginUse(this); break;
            case "Cycle": Survival.CycleUse(this,1);break;
            case "Rotate": Survival.Rotate(this,1);break;
            case "Pack":case "Craft":case "Build":
                Panel=action.ToLowerInvariant();Unfocus();break;
            case "Jump":
                if(Player.Y<=Arena.GroundBelow(this,Player.X,Player.Z,Player.Y+.08f)+.10f&&Player.Stamina>=9){Player.Vertical=5.8f*(1-.18f*Player.NeedStrain);Player.Stamina-=9;Cue("step",Player.X,Player.Z,9);}break;
            case "Dodge": PlayerDodge();break;
            case "Shove":Shove(Player);break;
            case "Attack":
                if(!String.IsNullOrEmpty(BuildId)){Survival.Place(this);break;}
                if(Player.Weapon=="crossbow"){if(switchTo.Length==0)FireCrossbow(Player,Pitch);break;}
                if(!Charging&&switchTo.Length==0&&Player.NextAttack<=(Ranged(Player)?0:.23f)&&
                   (!Player.Guard||CarriesShield(Player))&&Player.Windup<=0){
                    Player.Guard=false;
                    Charge=0;Charging=true;Player.DrawPower=0;Player.Throwing=false;Player.LastThrow=false;
                }break;
            case "Throw":
                if(!Charging&&Player.Weapon=="spear"&&Player.NextAttack<=0&&Player.Windup<=0&&
                   (!Player.Guard||CarriesShield(Player))&&String.IsNullOrEmpty(BuildId)){
                    Player.Guard=false;
                    Charging=true;Charge=0;Player.DrawPower=0;Player.Throwing=true;Player.LastThrow=false;Player.Aiming=true;
                }break;
            case "Guard":
                if(String.IsNullOrEmpty(BuildId)){
                    guardHeld=true;bufferedWeapon="";
                    RaiseHeldGuard(Player);
                }break;
            }
        }
        public void Release(string action){
            if(Player==null)return;
            if(action=="Guard"){guardHeld=false;Player.Guard=false;Player.Aiming=false;}
            if(Charging&&((action=="Throw"&&Player.Throwing)||(action=="Attack"&&!Player.Throwing))){
                bool throwing=Player.Throwing;Player.Throwing=false;
                if(CanAct){
                    if(throwing)ThrowSpear(Player,Pitch,Player.DrawPower);
                    else if(Ranged(Player))DrawShot(Player,Pitch,Player.DrawPower);
                    else FinishMeleeInput(Player);
                }
                if(throwing)Player.Aiming=false;Charge=0;Charging=false;
            }
        }
        public void Unfocus(){Held.Clear();bufferedWeapon="";guardHeld=false;Charging=false;Charge=0;if(Player!=null){Player.Guard=false;Player.Aiming=false;Player.Sprint=false;if(Player.Windup<=0){Player.Throwing=false;Player.DrawPower=0;}} }
        void Movement(float dt){
            Actor a=Player;
            if(a==null||!a.Alive)return;
            float fw;MovementDirection(out MoveX,out MoveZ,out fw);
            if(a.Stamina<3)a.Winded=true;else if(a.Stamina>23)a.Winded=false;
            bool crouch=PadActive?PadCrouch:Down("Crouch");
            a.Crouch=crouch||(a.Crouch&&!Arena.CanStand(this,a.X,a.Y+.01f,a.Z));
            a.Sprint=(PadActive?PadSprint:Down("Sprint"))&&!a.Crouch&&fw>0&&!a.Winded&&a.Stamina>3&&!a.Guard&&!a.Aiming&&a.CrossbowReload<=0;
            float speed=(a.Sprint?6.6f:a.Crouch?1.85f:4.25f)*(a.Guard?.66f:1)*(Charging?.8f:1)*(a.Aiming?.68f:1)*(a.CrossbowReload>0?.72f:1);
            speed*=Mobility(a);
            float water=Arena.WetDepth(this,a.X,a.Z,a.Y);if(water>.08f)speed*=Flood?.63f:.82f;
            float x=a.X,z=a.Z;if(!DodgeMoving(a))Arena.Move(this,a,MoveX*speed*dt,MoveZ*speed*dt);
            a.Speed=Distance(x,z,a.X,a.Z)/Math.Max(.0001f,dt);a.Anim+=a.Speed*dt*2.1f;
            if(a.Sprint)a.Stamina=Math.Max(0,a.Stamina-11*dt);
            footsteps+=a.Speed*dt;
            if(footsteps>(a.Sprint?2.6f:a.Crouch?2.1f:1.95f)){footsteps=0;float reach=water>.15?19:a.Crouch?3:a.Sprint?16:9;SoundAt(a,reach);Cue(StrideSound(a,water>.15f),a.X,a.Z,reach);}
            a.State=a.Guard?"guard":a.Sprint?"sprint":a.Crouch?"crouch":a.Speed>.1?"walk":"idle";
            if(Charging){Charge=Math.Min(1.3f,Charge+dt);a.DrawPower=Math.Min(1,Charge/(a.Throwing?1.05f:a.Weapon=="bow"?.96f:.72f));}
        }
        void UpdateCamera(float dt){
            if(Mode=="menu"||CameraTarget==null){CamX=17;CamY=3.0f;CamZ=6.8f;CamYaw=-2.48f+(float)Math.Sin(Clock*.055f)*.035f;CamPitch=.005f;return;}
            Actor a=CameraTarget;CamYaw=a.Yaw;bool player=a==Player;CamPitch=player?Pitch:-.035f;
            float target=player&&Mode=="match"?(PadActive?PadLean:((Down("Lean right")?1:0)-(Down("Lean left")?1:0)))*.34f:0;
            lean+=(target-lean)*Math.Min(1,dt*12);
            CamX=a.X;CamZ=a.Z;CamY=a.Y+(a.Crouch?1.03f:1.58f)+(float)Math.Sin(a.Anim*2)*Math.Min(a.Speed,5)*.013f*Settings.Bob;
            if(Math.Abs(lean)>.01f){
                float off=Arena.PeekOffset(this,a,lean,CamY);
                CamX+=(float)Math.Cos(a.Yaw)*off;CamZ-=(float)Math.Sin(a.Yaw)*off;
            }
            Zone=Arena.Zone(a.X,a.Z);
        }
        void Signal(string text,float seconds){EventText=text;EventTime=seconds;GlobalCue("warning");}
        void Events(){
            int e=Time>=850?4:Time>=750?3:Time>=550?2:Time>=430?1:Time>=405?0:-1;
            if(e!=eventStage){eventStage=e;
                if(e==0&&EventsOn)Signal("Floodgate release in 25 seconds  •  Leave the low channel",12);
                if(e==1&&EventsOn){Flood=true;Signal("Channels flooding  ·  High banks remain open",10);}
                if(e==2&&EventsOn){Flood=false;Signal("Floodwaters receding",6);}
                if(e==3&&EventsOn){Rain=true;Signal("Weather front crossing the outer arena",8);}
                if(e==4&&EventsOn){Rain=false;}
            }
        }
        public void Tick(float dt){
            if(FortFalls.Count>0)FortFalls.RemoveAll(fall=>Clock-fall.Start>=1.2f);
            if(!Ready||dt<=0)return;
            if(!HostingOnlineRound&&(Panel=="pause"||Panel=="settings"||Panel=="bindings"||Panel=="controller"||Panel=="padbinds"))return;
            Clock+=dt;
            if(Mode=="menu"){UpdateCamera(dt);return;}
            if(Mode=="results"){TickImpacts(dt);UpdateCamera(dt);return;}
            NoticeTime=Math.Max(0,NoticeTime-dt);EventTime=Math.Max(0,EventTime-dt);FeedTime=Math.Max(0,FeedTime-dt);
            if(Countdown>0){Countdown-=dt;if(Countdown<=0){Countdown=0;EventText="The arena is live";EventTime=3.8f;GlobalCue("horn");} UpdateCamera(dt);return;}
            Time+=dt;Events();ClimateStep();
            foreach(Actor actor in Actors)StepDefense(actor,dt);
            if(HostingOnlineRound)StepOnlineMovement(dt);
            else if(CanAct)Movement(dt);else if(Player!=null){Player.Speed=0;Player.Sprint=false;}
            Brains.Step(this,dt);
            for(int i=0;i<Actors.Count;i++){
                Actor a=Actors[i];if(!a.Alive)continue;
                if(a.PickupLift>0){
                    bool interrupted=a.Windup>0||a.Swing>0||a.Guard||a.Throwing||a.DodgeTime>0||PlayerCharging(a);
                    a.PickupLift=interrupted?0:Math.Max(0,a.PickupLift-dt);
                    if(a.PickupLift<=0)a.PickupSource=null;
                }else if(a.PickupSource!=null)a.PickupSource=null;
                Arena.StepVertical(this,a,dt);
                float was=a.Windup; a.Windup=Math.Max(0,a.Windup-dt);a.Swing=Math.Max(0,a.Swing-dt);a.Hurt=Math.Max(0,a.Hurt-dt);a.NextAttack=Math.Max(0,a.NextAttack-dt);
                if(!PlayerDriven(a)&&was>0&&a.ProjectileId!="")a.DrawPower=a.ProjectilePower*(1-a.Windup/Math.Max(.001f,a.WindupSpan));
                bool defending=GuardPoseActive(a);
                a.GuardBlend=Math.Max(0,Math.Min(1,a.GuardBlend+(defending?10f:-8.3f)*dt));
                if(was>0&&a.Windup<=0){float p;attackPitch.TryGetValue(a,out p);Strike(a,p);}
                StepCrossbow(a,dt);
                if(a.Windup<=0&&!a.Throwing&&!PlayerCharging(a))a.DrawPower=Math.Max(0,a.DrawPower-5.5f*dt);
                if(Winner!=null)break;
                string loss=AdvanceNeeds(a,dt);
                if(a.Health>0&&StormDamage(a,dt))loss=" was lost in the storm";
                if(Flood&&Arena.WetDepth(this,a.X,a.Z,a.Y)>.95f)a.Stamina=Math.Max(0,a.Stamina-dt*2);
                if(a.Health<=0)Eliminate(a,null,loss);
                if(AliveCount<=1)break;
            }
            if(Mode=="results")return;
            PlayerFollowThrough();
            UpdateShots(dt);
            UpdateCamera(dt);
            Survival.Tick(this,dt);
            if(HostingOnlineRound)StepRemoteViews(dt);
            TickImpacts(dt);
            for(int i=Effects.Count-1;i>=0;i--){Effect e=Effects[i];e.Time+=dt;if(e.Time>=e.Life)Effects.RemoveAt(i);else{e.X+=e.DX*dt;e.Y+=e.DY*dt;e.Z+=e.DZ*dt;}}
            pressureClock+=dt;if(pressureClock>=1){pressureClock=0;Noises.RemoveAll(n=>Time-n.Time>5);}
            if(Mode=="spectate"&&!CameraTarget.Alive)Spectate(1);
            if(AliveCount<=1)Finish();
        }
        void Eliminate(Actor a,Actor killer,string cause=null){
            if(!a.Alive||Winner!=null)return;a.Alive=false;a.Health=0;a.Placement=AliveCount--;a.Guard=false;a.Windup=0;a.State="fallen";
            SettleFall(a,killer);
            if(killer!=null&&killer!=a)killer.Kills++;
            Prop p=new Prop{Kind="pack",Model="pack",Item="pack",Label=a.Name+"'s pack",X=a.X,Y=Arena.GroundBelow(this,a.X,a.Z,a.Y+.12f),Z=a.Z,Yaw=a.Yaw};
            foreach(var kv in a.Bag)if(kv.Value>0)p.Bag[kv.Key]=kv.Value;
            if(a.Weapon!="fists"&&!p.Bag.ContainsKey(a.Weapon))p.Bag[a.Weapon]=1;
            PlaceFallenPack(a,p);
            Survival.TransferWaterOnDeath(a,p);
            Armor.PackOnDeath(a,p);
            PackShields(a,p,a.Count("shield"));
            p.FoodProgress.AddRange(a.FoodProgress); Arena.Register(this,p);
            KillFeed=killer==null?a.Name+(cause??" fell to exposure"):killer.Name+" eliminated "+a.Name;FeedTime=4;GlobalCue("cannon");
            if(a==Player){Mode="dead";Panel="";Charging=false;Unfocus();Survival.Cancel(this);}
            if(AliveCount<=1)Finish();
        }
        void Finish(){if(Winner!=null)return;foreach(Actor a in Actors)if(a.Alive){Winner=a;break;}
            if(Winner==null)return;Winner.Placement=1;CameraTarget=Winner;Mode="results";Panel="";Unfocus();GlobalCue("victory");}
    }
}
