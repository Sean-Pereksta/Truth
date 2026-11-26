using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Web.Script.Serialization;

namespace LastSignal {
    // The browser renders the host's arena. It sends the same player intentions as a Windows guest.
    internal sealed class MobileFrames {
        const int TerrainStep = 3;
        const int TerrainOrigin = -210;
        const int TerrainSize = 141;
        const float SceneRange = 130f;
        readonly JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength = OnlineTransport.MaxMessageBytes };
        readonly List<PropChange> changes = new List<PropChange>();
        byte[] world, compressedWorld;
        int worldRound;
        PropView[] initialProps;
        float propsClock = float.NaN;

        struct PropView {
            internal float X,Y,Z,Scale,Yaw,W,H,D;
            internal string Model,Kind;
            internal int Damage;
            internal bool Lit,Open,Present,ShelterFrame;

            internal PropView(Prop p) {
                X=p.X;Y=p.Y;Z=p.Z;Scale=p.Scale;Yaw=p.Yaw;W=p.W;H=p.H;D=p.D;
                Model=p.Model;Kind=p.Kind;Damage=DamageStage(p);
                ShelterFrame=Survival.IsShelterFrame(p);
                Lit=p.Lit;Open=p.Open;Present=!p.Removed&&!String.IsNullOrEmpty(p.Model);
            }
            internal bool Matches(Prop p) {
                return Present==(!p.Removed&&!String.IsNullOrEmpty(p.Model))&&
                    (!Present||(X==p.X&&Y==p.Y&&Z==p.Z&&Scale==p.Scale&&Yaw==p.Yaw&&W==p.W&&H==p.H&&D==p.D&&
                    Model==p.Model&&Kind==p.Kind&&Damage==DamageStage(p)&&Lit==p.Lit&&Open==p.Open&&
                    ShelterFrame==Survival.IsShelterFrame(p)));
            }
        }

        struct PropChange {
            internal int Index;
            internal PropView Initial;
            internal Prop Current;
            internal float FallAge;
            internal object[] Record;
        }

        internal void Clear() {
            world = compressedWorld = null;
            worldRound = 0;
            initialProps = null;
            propsClock = float.NaN;
            changes.Clear();
        }

        internal byte[] World(Game g,int round,bool gzip) {
            if(world == null || worldRound != round) {
                worldRound = round;
                compressedWorld = null;
                propsClock = float.NaN;
                int cells = TerrainSize * TerrainSize;
                var heights = new float[cells];
                var paths = new float[cells];
                var waters = new float?[cells];
                var floodWaters = new float?[cells];
                for(int z=0;z<TerrainSize;z++) for(int x=0;x<TerrainSize;x++) {
                    int cell = z*TerrainSize+x;
                    float wx=TerrainOrigin+x*TerrainStep,wz=TerrainOrigin+z*TerrainStep;
                    float height=Arena.Height(wx,wz);
                    heights[cell]=Value(height);
                    paths[cell]=Value(Arena.Path(wx,wz));
                    waters[cell]=Water(wx,wz,height,false);
                    floodWaters[cell]=Water(wx,wz,height,true);
                }
                // Stable indices match the host list. Runtime-created items are delivered only
                // while nearby, even to a phone that reconnects after the round has begun.
                int seeded=Math.Min(g.SeededPropCount,g.Props.Count);
                initialProps=new PropView[seeded];
                var props=new object[seeded][];
                for(int index=0;index<seeded;index++) {
                    Prop prop=g.Props[index];
                    initialProps[index]=new PropView(prop);
                    if(initialProps[index].Present)props[index]=PropRecord(prop,-1);
                }
                world=Bytes(new {
                    type="world",round,arena=g.ArenaId,seed=g.Seed,radius=Arena.Radius,props,
                    terrain=new {originX=TerrainOrigin,originZ=TerrainOrigin,step=TerrainStep,
                        size=TerrainSize,heights,paths,waters,floodWaters}
                });
            }
            if(!gzip)return world;
            if(compressedWorld==null)compressedWorld=Compress(world);
            return compressedWorld;
        }

        static float? Water(float x,float z,float height,bool flood) {
            float surface=Arena.Surface(x,z,flood);
            return surface > height+.025f ? (float?)Value(surface) : null;
        }

        internal byte[] Frame(Game game,int seat,int round,bool gzip) {
            PrepareChanges(game);
            byte[] bytes = null;
            game.WithOnlineSeat(seat,delegate(Game g) {
                g.RefreshOnlineCamera(0);
                Actor player=g.Player;
                if(player==null)return;
                float extendedSight=player.Weapon=="crossbow"&&player.Aiming?75f:0f;
                var actors=new List<object[]>();
                foreach(Actor actor in g.Actors) {
                    if(actor==g.CameraTarget)continue;
                    if(!InRange(g,actor.X,actor.Z,actor.Alive?100f:65f))continue;
                    if(actor.Alive&&!Perception.ActorVisible(g,g.CamX,g.CamY,g.CamZ,g.CamYaw,actor,extendedSight))continue;
                    actors.Add(new object[]{Value(actor.X),Value(actor.Y),Value(actor.Z),Value(actor.Yaw),
                        actor.Alive,actor.Crouch,actor.Style,actor.Name,Value(actor.FallYaw),Value(actor.Anim),Value(actor.Speed),
                        actor.Weapon,Game.CarriesShield(actor),Game.ShieldRaised(actor),Value(actor.GuardBlend),
                        Value(actor.CrossbowReload/Actor.CrossbowReloadTime),actor.CrossbowLoaded,Value(actor.Swing),
                        Value(Math.Min(1f,actor.Hurt/.42f))});
                }
                var wildlife=new List<object[]>();
                foreach(Animal animal in g.Animals) {
                    if(animal.Harvested||!InRange(g,animal.X,animal.Z,72f))continue;
                    wildlife.Add(new object[]{animal.Model,Value(animal.X),Value(animal.Y),Value(animal.Z),
                        Value(animal.Yaw),animal.Alive,Value(animal.Anim)});
                }
                var shots=new List<object[]>();
                foreach(Shot shot in g.Shots) {
                    if(!InRange(g,shot.X,shot.Z,62f))continue;
                    float yaw=(float)Math.Atan2(shot.DX,shot.DZ);
                    float pitch=(float)(Math.PI*.5-Math.Atan2(shot.DY,Math.Sqrt(shot.DX*shot.DX+shot.DZ*shot.DZ)));
                    shots.Add(new object[]{shot.Model,Value(shot.X),Value(shot.Y),Value(shot.Z),Value(yaw),Value(pitch)});
                }
                var pack=new List<object[]>();
                foreach(var item in player.Bag) {
                    if(item.Value>0)pack.Add(new object[]{item.Key,Survival.Label(item.Key),item.Value});
                }
                pack.Sort(delegate(object[] left,object[] right) {
                    return StringComparer.OrdinalIgnoreCase.Compare((string)left[1],(string)right[1]);
                });
                bytes=Bytes(new {
                    type="frame",round,clock=Value(g.Clock),time=Value(g.Time),mode=g.Mode,
                    daylight=Value(g.Daylight),rain=g.Rain,flood=g.Flood,
                    camera=new {x=Value(g.CamX),y=Value(g.CamY),z=Value(g.CamZ),yaw=Value(g.CamYaw),pitch=Value(g.CamPitch)},
                    storm=new {x=g.StormX,z=g.StormZ,radius=Value(g.StormRadius),nextRadius=Value(g.StormNextRadius),
                        seconds=Value(g.StormSecondsRemaining),warning=g.StormWarning,moving=g.StormMoving,active=g.StormActive},
                    propChanges=ChangesInView(g),actors,wildlife,shots,tracks=TracksInView(g),workSound=RecentWorkSound(g,player),
                    ghost=g.Ghost==null?null:PropRecord(g.Ghost,-1),ghostFits=g.GhostFits,
                    player=new {id=player.Id,name=player.Name,yaw=Value(player.Yaw),pitch=Value(g.Pitch),
                        health=Value(player.Health),stamina=Value(player.Stamina),hunger=Value(player.Hunger),
                        hydration=Value(player.Hydration),water=Value(player.WaterCarried),weapon=player.Weapon,
                        armor=player.WornArmor,aim=player.Aiming,hurt=Value(player.Hurt),swing=Value(player.Swing),
                        shield=Game.CarriesShield(player),guard=player.Guard,shieldRaised=Game.ShieldRaised(player),guardBlend=Value(player.GuardBlend),
                        crossbowLoaded=player.CrossbowLoaded,reload=Value(player.CrossbowReload/Actor.CrossbowReloadTime),
                        reloadSeconds=Actor.CrossbowReloadTime,
                        speed=Value(player.Speed),alive=player.Alive,placement=player.Placement},
                    alive=g.AliveCount,countdown=Value(g.Countdown),winner=g.Winner==null?"":g.Winner.Name,
                    hud=new {hint=g.Hint,notice=g.NoticeTime>0?g.Notice:"",@event=g.EventTime>0?g.EventText:"",
                        feed=g.FeedTime>0?g.KillFeed:"",progress=Value(g.UseProgress),charge=Value(g.Charge),zone=g.Zone,
                        impact=Value(g.IncomingImpact),impactAngle=Value(g.IncomingAngle),impactStrength=Value(g.IncomingStrength),
                        confirmed=Value(g.ConfirmedImpact),
                        buildId=g.BuildId,buildProblem=g.BuildProblem,useAction=g.ActionId,focusOptions=g.FocusOptions,focusChoice=g.FocusChoice},
                    pack,craft=Recipes(player,Survival.Crafts),build=Recipes(player,Survival.Builds)
                });
            });
            return bytes!=null&&gzip?Compress(bytes):bytes;
        }

        static List<object[]> TracksInView(Game g) {
            var tracks=new List<object[]>();
            foreach(Footprint track in g.Tracks) {
                if(track.Maker==null||track.Time+track.Life<=g.Time||!InRange(g,track.X,track.Z,18f))continue;
                if(!Arena.Clear(g,g.CamX,g.CamY,g.CamZ,track.X,track.Y+.04f,track.Z))continue;
                tracks.Add(new object[]{Value(track.X),Value(track.Y),Value(track.Z),Value(track.Yaw),
                    Value(1f-(g.Time-track.Time)/track.Life)});
            }
            return tracks;
        }

        static object RecentWorkSound(Game g,Actor listener) {
            if(!listener.Alive)return null;
            for(int i=g.Noises.Count-1;i>=0;i--) {
                Noise n=g.Noises[i];
                if(g.Time-n.Time>.55f)break;
                if(n.Activity==null)continue;
                float dx=n.X-listener.X,dz=n.Z-listener.Z;
                float distance=(float)Math.Sqrt(dx*dx+dz*dz);
                float range=Perception.HearingRange(g,listener,n);
                if(distance>=range || range<=0)continue;
                float pan=distance<.2f?0:(float)(Math.Cos(listener.Yaw)*dx-Math.Sin(listener.Yaw)*dz)/distance;
                return new {at=Value(n.Time),kind=n.Activity,pan=Value(pan),volume=Value(1f-distance/range)};
            }
            return null;
        }

        void PrepareChanges(Game g) {
            if(propsClock==g.Clock)return;
            propsClock=g.Clock;
            changes.Clear();
            for(int index=0;index<g.Props.Count;index++) {
                Prop prop=g.Props[index];
                PropView initial=index<initialProps.Length?initialProps[index]:default(PropView);
                float age=g.Clock-prop.FelledAt;
                bool felling=prop.Removed&&prop.FelledAt>=0&&age>=0&&age<1.65f;
                if(!felling&&initial.Matches(prop))continue;
                changes.Add(new PropChange {Index=index,Initial=initial,Current=prop,FallAge=felling?age:-1,
                    Record=(!prop.Removed||felling)&&!String.IsNullOrEmpty(prop.Model)?PropRecord(prop,felling?age:-1):null});
            }
        }

        List<object[]> ChangesInView(Game g) {
            var rows=new List<object[]>();
            foreach(PropChange change in changes) {
                Prop p=change.Current;
                bool present=change.Record!=null&&InRange(g,p.X,p.Z,change.FallAge>=0?95f:PropRange(p));
                if(present||change.Initial.Present&&InRange(g,change.Initial.X,change.Initial.Z,SceneRange))
                    rows.Add(new object[]{change.Index,present?change.Record:null});
            }
            return rows;
        }

        static float PropRange(Prop p) {
            if(p.Model=="cornucopia"||p.H>=7f)return SceneRange;
            if(p.Kind=="vegetation")return 30f;
            return p.Kind=="pickup"||p.Kind=="pack"?43f:95f;
        }
        static int DamageStage(Prop p) {
            if(p.Kind!="structure"||p.MaxHP<=0||p.HP>=p.MaxHP*.74f)return 0;
            return p.HP<p.MaxHP*.37f?2:1;
        }
        static object[] PropRecord(Prop p,float fallAge) {
            int damage=DamageStage(p);
            string stage=damage==0?p.Model:p.Model+(damage==2?"2":"1");
            return new object[]{p.Model,Value(p.X),Value(p.Y),Value(p.Z),Value(p.Scale),Value(p.Yaw),
                  Value(p.W),Value(p.H),Value(p.D),p.Kind,p.Lit,Value(fallAge),Value(p.FellDirection),p.Open,stage,Survival.IsShelterFrame(p)};
        }

        static List<object[]> Recipes(Actor actor,Recipe[] recipes) {
            var rows=new List<object[]>(recipes.Length);
            foreach(Recipe recipe in recipes)
                rows.Add(new object[]{recipe.Id,recipe.Name,recipe.CostText,Survival.CanMake(actor,recipe)});
            return rows;
        }

        static bool InRange(Game g,float x,float z,float radius) {
            float dx=x-g.CamX,dz=z-g.CamZ;
            return dx*dx+dz*dz<=radius*radius;
        }

        static float Value(float amount) {
            return float.IsNaN(amount)||float.IsInfinity(amount)?0f:(float)Math.Round(amount,3);
        }
        byte[] Bytes(object value) { return OnlineTransport.Utf8.GetBytes(json.Serialize(value)); }
        static byte[] Compress(byte[] bytes) {
            using(var buffer=new MemoryStream()) {
                using(var gzip=new GZipStream(buffer,CompressionLevel.Fastest,true))gzip.Write(bytes,0,bytes.Length);
                return buffer.ToArray();
            }
        }
    }
}
