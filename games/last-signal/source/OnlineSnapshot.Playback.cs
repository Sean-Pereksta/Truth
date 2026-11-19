using System;
using System.Collections.Generic;
using System.IO;

namespace LastSignal
{
    public partial class Game
    {
        internal int SeededPropCount;
        internal int[] OnlinePresentationPacks;
        internal int OnlinePresentationSeatMask,OnlineSnapshotHumans;
        internal void InitializeOnlineReplica(int seed,int arena)
        {
            ClearMatch();Seed=seed;ArenaId=arena;Rng=new Random(seed);Mode="match";LoadArena();Ready=true;
        }
        internal void SetOnlineWeather(int phase,float radius,float remaining,bool moving,bool warning,float impacts)
        {
            StormPhase=phase;StormNextRadius=radius;StormSecondsRemaining=remaining;StormMoving=moving;StormWarning=warning;ImpactWorldTime=impacts;
        }
    }
    public static partial class Arena
    {
        internal static void UpdateOnlineProp(Game g,Prop dst,Prop src)
        {
            Field f=fields.GetOrCreateValue(g);
            bool change=(dst.Solid||dst.Opaque||src.Solid||src.Opaque) &&
                (dst.Model!=src.Model||dst.Removed!=src.Removed||dst.Open!=src.Open||dst.Solid!=src.Solid||dst.Opaque!=src.Opaque||
                dst.X!=src.X||dst.Y!=src.Y||dst.Z!=src.Z||dst.Yaw!=src.Yaw||dst.W!=src.W||dst.H!=src.H||dst.D!=src.D);
            if(change)UnindexGeometry(f,dst);
            int oldCell=Index(dst.X,dst.Z),newCell=Index(src.X,src.Z);
            if(newCell!=oldCell)
            {
                if(f.Nearby[oldCell]!=null)f.Nearby[oldCell].Remove(dst);
                if(f.Nearby[newCell]==null)f.Nearby[newCell]=new List<Prop>();f.Nearby[newCell].Add(dst);
            }
            bool oldMember=FortMember(dst),newMember=FortMember(src);
            if(oldMember!=newMember){if(newMember)f.Forts.Members.Add(dst);else f.Forts.Members.Remove(dst);}
            SnapshotFields.Copy(src,dst);
            dst.FelledAt=src.FelledAt;dst.FellDirection=src.FellDirection;dst.BarkReadyAt=src.BarkReadyAt;dst.Stripped=src.Stripped;
            dst.Bag=src.Bag;dst.FoodProgress=src.FoodProgress;dst.Fort=src.Fort;dst.PackedArmor=src.PackedArmor;
            if(change){if(!dst.Removed)Geometry(f,dst);f.Revision++;f.Forts.Stable=null;}
        }
        internal static void HideOnlineProp(Game g,Prop p)
        {
            if(!p.Removed)
            {
                Field f=fields.GetOrCreateValue(g);
                if(p.Solid||p.Opaque){UnindexGeometry(f,p);f.Revision++;f.Forts.Stable=null;}
                p.Removed=true;p.HP=0;p.Lit=false;p.Solid=p.Opaque=false;
            }
        }
    }
    public static partial class OnlineSnapshot
    {
        struct Pose
        {
            public float X,Y,Z,Yaw;
            public Pose(float x,float y,float z,float yaw){X=x;Y=y;Z=z;Yaw=yaw;}
            internal static Pose Blend(Pose a,Pose b,float t)
            {
                if(Math.Abs(a.X-b.X)+Math.Abs(a.Z-b.Z)+Math.Abs(a.Y-b.Y)>12)return b;
                float angle=b.Yaw-a.Yaw;angle-=(float)(2*Math.PI*Math.Round(angle/(2*Math.PI)));
                return new Pose(a.X+(b.X-a.X)*t,a.Y+(b.Y-a.Y)*t,a.Z+(b.Z-a.Z)*t,a.Yaw+angle*t);
            }
        }
        sealed class Receiver
        {
            public int Round,LastPacket,LastSound,Seat;
            public readonly List<int> OldRounds=new List<int>(8);
            public readonly Dictionary<int,Prop> SeedDefaults=new Dictionary<int,Prop>();
            public readonly HashSet<int> Touched=new HashSet<int>();
            public Pose[] ActorsFrom,ActorsTo,AnimalsFrom,AnimalsTo;
            public float Window,Elapsed,FrameClock,FrameTime,FrameCountdown;
            public void ChangeRound(int round,int seat,int actors,int animals)
            {
                if(LastPacket!=0&&Round!=round){OldRounds.Add(Round);if(OldRounds.Count>8)OldRounds.RemoveAt(0);}
                SeedDefaults.Clear();Touched.Clear();Round=round;LastPacket=LastSound=0;Seat=seat;
                ActorsFrom=new Pose[actors];ActorsTo=new Pose[actors];AnimalsFrom=new Pose[animals];AnimalsTo=new Pose[animals];Elapsed=Window=0;
            }
        }
        static T Item<T>(List<T> list,int i) where T:class{return i<0?null:list[i];}
        static Prop Remember(Prop p)
        {
            var copy=new Prop();SnapshotFields.Copy(p,copy);
            copy.Bag=p.Bag;copy.FoodProgress=p.FoodProgress;copy.PackedArmor=p.PackedArmor;copy.Fort=p.Fort;
            copy.FellDirection=p.FellDirection;copy.FelledAt=p.FelledAt;copy.Stripped=p.Stripped;copy.BarkReadyAt=p.BarkReadyAt;
            return copy;
        }
        static void UpdateProps(Game g,WorldFrame f,Receiver receiver)
        {
            receiver.Touched.Clear();
            foreach(PropRecord rec in f.Props)
            {
                if(rec.Index<f.Seeded)
                {
                    receiver.Touched.Add(rec.Index);
                    if(!receiver.SeedDefaults.ContainsKey(rec.Index))receiver.SeedDefaults.Add(rec.Index,Remember(g.Props[rec.Index]));
                }
                if(rec.Index==g.Props.Count)
                {
                    Prop fresh=rec.Tombstone?new Prop{Kind="spent",Removed=true}:rec.Prop;
                    Arena.Register(g,fresh);
                }
                else if(rec.Tombstone)Arena.HideOnlineProp(g,g.Props[rec.Index]);
                else Arena.UpdateOnlineProp(g,g.Props[rec.Index],rec.Prop);
            }
            foreach(var previous in receiver.SeedDefaults)
                if(!receiver.Touched.Contains(previous.Key))Arena.UpdateOnlineProp(g,g.Props[previous.Key],previous.Value);
            foreach(PropRecord rec in f.Props)
                if(!rec.Tombstone)g.Props[rec.Index].Support=Item(g.Props,rec.Support);
        }
        static void UpdateLiving(Game g,WorldFrame f,Receiver receiver,bool fresh)
        {
            if(g.OnlinePresentationPacks==null)g.OnlinePresentationPacks=new int[f.Actors.Count];
            for(int i=0;i<f.Actors.Count;i++)
            {
                ActorRecord rec=f.Actors[i];Actor src=rec.Actor;
                if(i==g.Actors.Count)g.Actors.Add(new Actor());
                Actor dst=g.Actors[i];float look=dst.Yaw;
                receiver.ActorsFrom[i]=new Pose(dst.X,dst.Y,dst.Z,dst.Yaw);
                receiver.ActorsTo[i]=new Pose(src.X,src.Y,src.Z,src.Yaw);
                SnapshotFields.Copy(src,dst);
                dst.Bag=src.Bag;dst.FoodProgress=src.FoodProgress;dst.ArmorPieces.Clear();dst.ArmorPieces.AddRange(src.ArmorPieces);
                dst.EquippedArmor=Item(dst.ArmorPieces,rec.Equipped);dst.PickupSource=Item(g.Props,rec.PickupSource);dst.FallenPack=Item(g.Props,rec.FallenPack);
                dst.ArmorAtDeath=(dst.FallenPack!=null&&dst.FallenPack.PackedArmor!=null&&rec.FallenArmor>=0&&rec.FallenArmor<dst.FallenPack.PackedArmor.Count)?
                    dst.FallenPack.PackedArmor[rec.FallenArmor]:null;
                g.OnlinePresentationPacks[i]=rec.PackNumber;
                if(!fresh&&dst==g.Player&&dst.Alive)dst.Yaw=look;
                if(fresh)receiver.ActorsFrom[i]=receiver.ActorsTo[i];
            }
            while(g.Animals.Count>f.Animals.Count)g.Animals.RemoveAt(g.Animals.Count-1);
            for(int i=0;i<f.Animals.Count;i++)
            {
                if(i==g.Animals.Count)g.Animals.Add(new Animal());
                Animal dst=g.Animals[i],src=f.Animals[i];
                receiver.AnimalsFrom[i]=new Pose(dst.X,dst.Y,dst.Z,dst.Yaw);
                receiver.AnimalsTo[i]=new Pose(src.X,src.Y,src.Z,src.Yaw);
                SnapshotFields.Copy(src,dst);if(fresh)receiver.AnimalsFrom[i]=receiver.AnimalsTo[i];
            }
        }
        static void UpdateWorld(Game g,WorldFrame f)
        {
            g.Level=f.Difficulty;g.HungerLevel=f.Hunger;g.EventsOn=f.Events;g.AliveCount=f.Alive;g.Winner=Item(g.Actors,f.Winner);
            g.OnlineSnapshotHumans=f.Views.Count;g.OnlinePresentationSeatMask=0;
            foreach(SeatView view in f.Views)g.OnlinePresentationSeatMask|=1<<view.Seat;
            g.Rain=f.Rain;g.Flood=f.Flood;g.Time=f.Time;g.Clock=f.Clock;g.Countdown=f.Countdown;g.SafeRadius=f.SafeRadius;
            g.SetOnlineWeather(f.StormPhase,f.NextRadius,f.StormSeconds,f.StormMoving,f.StormWarning,f.ImpactTime);
            g.EventText=f.EventText;g.EventTime=f.EventTime;g.FeedTime=f.FeedTime;g.KillFeed=f.KillFeed;
            g.Shots=f.Shots;for(int i=0;i<f.Shots.Count;i++)g.Shots[i].Owner=Item(g.Actors,f.ShotOwners[i]);
            g.Effects=f.Effects;
            g.FortFalls.Clear();
            for(int i=0;i<f.Falls.Count;i++){FortFall fall=f.Falls[i];fall.Piece=g.Props[f.FallenParts[i]];g.FortFalls.Add(fall);}
            Array.Clear(g.ImpactDrops,0,g.ImpactDrops.Length);f.Drops.CopyTo(g.ImpactDrops);
            Array.Clear(g.ImpactMarks,0,g.ImpactMarks.Length);f.Marks.CopyTo(g.ImpactMarks);
        }
        static void UpdateView(Game g,SeatView v,bool fresh)
        {
            Actor previousCamera=g.CameraTarget;
            bool watching=!fresh&&g.Mode=="spectate"&&v.Mode=="dead"&&g.Winner==null;
            string mode=watching?"spectate":v.Mode;
            if(fresh||g.Mode!=mode)g.Panel="";
            g.Mode=mode;g.Player=g.Actors[v.Seat];
            if(watching && previousCamera!=null && previousCamera.Alive)g.CameraTarget=previousCamera;
            else if(watching)g.Spectate(1);
            else g.CameraTarget=Item(g.Actors,v.Camera)??g.Player;
            if(fresh)g.Pitch=v.Pitch;
            g.FocusProp=Item(g.Props,v.Focus);g.FocusAnimal=Item(g.Animals,v.FocusAnimal);
            g.UseProp=Item(g.Props,v.UseProp);g.UseAnimal=Item(g.Animals,v.UseAnimal);g.FocusShore=v.TargetShore;
            g.FocusOptions=v.Options;g.FocusChoice=v.Choice;g.Notice=v.Notice;g.NoticeTime=v.NoticeTime;
            g.BuildId=v.BuildId;g.BuildProblem=v.Problem;g.BuildAngle=v.BuildAngle;g.BuildJoined=v.Joined;g.GhostFits=v.Fits;g.Ghost=v.Ghost;
            g.Charging=v.Charging;g.Charge=v.Charge;g.ActionId=v.Action;g.ActionArgument=v.Argument;
            g.UseProgress=v.Use;g.UseX=v.UseX;g.UseY=v.UseY;g.UseZ=v.UseZ;
            g.IncomingImpact=v.Incoming;g.IncomingAngle=v.Angle;g.IncomingStrength=v.Strength;g.ConfirmedImpact=v.Confirm;
            g.Hint=String.IsNullOrEmpty(v.Hint)?"":Survival.Prompt(g);
            g.RefreshOnlineCamera(0);
        }
        public static bool Apply(Game client,byte[] data,int seat)
        {
            if(client==null||seat<0||seat>7||client.HostingOnlineRound)return false;
            WorldFrame f;
            try{f=Decode(data);}catch(IOException){return false;}catch(InvalidDataException){return false;}catch(ArgumentException){return false;}
            SeatView view=f.Views.Find(v=>v.Seat==seat);if(view==null)return false;
            Receiver r=receivers.GetOrCreateValue(client);
            if(r.OldRounds.Contains(f.Round))return false;
            bool fresh=r.LastPacket==0||r.Round!=f.Round||r.Seat!=seat||client.OnlinePresentationPacks==null;
            if(!fresh&&(r.LastPacket>=f.Sequence||client.Actors.Count!=f.Actors.Count||r.AnimalsFrom.Length!=f.Animals.Count||
                client.Seed!=f.Seed||client.ArenaId!=f.Arena||client.Props.Count>f.TotalProps))return false;
            int dynamicIndex=f.Seeded;
            foreach(PropRecord record in f.Props)
                if(record.Index>=f.Seeded&&record.Index!=dynamicIndex++)return false;
            if(dynamicIndex!=f.TotalProps)return false;
            if(fresh)
            {
                client.InitializeOnlineReplica(f.Seed,f.Arena);
                if(client.SeededPropCount!=f.Seeded)return false;
                r.ChangeRound(f.Round,seat,f.Actors.Count,f.Animals.Count);
            }
            UpdateProps(client,f,r);UpdateLiving(client,f,r,fresh);UpdateWorld(client,f);UpdateView(client,view,fresh);
            r.Window=fresh?0:Math.Max(.025f,Math.Min(.16f,f.Clock-r.FrameClock));r.Elapsed=0;r.FrameClock=f.Clock;
            r.FrameTime=f.Time;r.FrameCountdown=f.Countdown;r.LastPacket=f.Sequence;
            foreach(SoundRecord sound in f.Sounds)
            {
                if(sound.Id<=r.LastSound)continue;r.LastSound=sound.Id;
                if(fresh&&f.Time>0)continue;
                if(sound.Range<0)client.GlobalCue(sound.Name);else client.Cue(sound.Name,sound.X,sound.Z,sound.Range);
            }
            return true;
        }
        public static void Present(Game client,float dt)
        {
            Receiver r;
            if(client==null||client.OnlinePresentationPacks==null||!receivers.TryGetValue(client,out r)||dt<=0)return;
            r.Elapsed+=Math.Min(.2f,dt);
            float blend=r.Window>0?Math.Min(1,r.Elapsed/r.Window):1;
            // Keep wind, water, the storm, and falling timber moving at the display rate.
            // A lost connection can advance visuals by only a fraction of a second.
            float visualTime=Math.Min(.15f,r.Elapsed),prior=client.Clock;
            client.Clock=r.FrameClock+visualTime;
            if(r.FrameCountdown>0)client.Countdown=Math.Max(0,r.FrameCountdown-visualTime);
            else if(client.Mode!="results")client.Time=r.FrameTime+visualTime;
            float step=Math.Max(0,client.Clock-prior);
            if(step>0)
            {
                foreach(Shot s in client.Shots){s.X+=s.DX*step;s.Z+=s.DZ*step;s.Y+=s.DY*step-.5f*s.Gravity*step*step;s.DY-=s.Gravity*step;s.Age+=step;}
                foreach(Effect e in client.Effects){e.X+=e.DX*step;e.Y+=e.DY*step;e.Z+=e.DZ*step;e.Time=Math.Min(e.Life,e.Time+step);}
            }
            for(int i=0;i<client.Actors.Count;i++)
            {
                Actor a=client.Actors[i];Pose pose=Pose.Blend(r.ActorsFrom[i],r.ActorsTo[i],blend);
                a.X=pose.X;a.Y=pose.Y;a.Z=pose.Z;if(a!=client.Player||!a.Alive)a.Yaw=pose.Yaw;
                if(a.CrossbowReload>0)a.CrossbowReload=Math.Min(Actor.CrossbowReloadTime,a.CrossbowReload+step);
            }
            for(int i=0;i<client.Animals.Count;i++)
            {
                Animal a=client.Animals[i];Pose pose=Pose.Blend(r.AnimalsFrom[i],r.AnimalsTo[i],blend);
                a.X=pose.X;a.Y=pose.Y;a.Z=pose.Z;a.Yaw=pose.Yaw;
            }
            client.RefreshOnlineCamera(dt);
        }
    }
}
