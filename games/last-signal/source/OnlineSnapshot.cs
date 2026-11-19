using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Runtime.CompilerServices;
using System.Threading;

namespace LastSignal
{
    public static partial class OnlineSnapshot
    {
        public const int Version=2;
        const int Magic=0x4E53534C; // LSSN
        const int Limit=4194304;
        static int nextRound=Environment.TickCount;
        static readonly ConditionalWeakTable<Game,Sender> senders=new ConditionalWeakTable<Game,Sender>();
        static readonly ConditionalWeakTable<Game,Receiver> receivers=new ConditionalWeakTable<Game,Receiver>();
        sealed class SoundRecord
        {
            public int Id;public string Name;public float Clock,X,Z,Range;
        }
        sealed class Sender
        {
            public Actor First;
            public int Round,Sequence,LastSound;
            public readonly Queue<SoundRecord> Sounds=new Queue<SoundRecord>();
            public readonly Dictionary<Prop,int> Indices=new Dictionary<Prop,int>();
        }
        static Sender Source(Game g)
        {
            Sender source=senders.GetOrCreateValue(g);
            if(g.Actors.Count>0 && source.First!=g.Actors[0])
            {
                source.First=g.Actors[0];source.Round=Interlocked.Increment(ref nextRound);
                source.Sequence=0;source.LastSound=0;source.Indices.Clear();source.Sounds.Clear();
            }
            return source;
        }
        internal static void RecordSound(Game g,string name,float x,float z,float range)
        {
            if(!g.HostingOnlineRound || g.Actors.Count==0)return;
            Sender source=Source(g);
            if(source.Sounds.Count==256)source.Sounds.Dequeue();
            source.Sounds.Enqueue(new SoundRecord{Id=++source.LastSound,Name=name,X=x,Z=z,Range=range,Clock=g.Clock});
        }
        static int PropId(Sender source,Prop p)
        {
            int i;return p!=null&&source.Indices.TryGetValue(p,out i)?i:-1;
        }
        static int ActorId(Actor a){return a==null?-1:a.Id;}
        static bool ActiveSeedProp(Prop p)
        {
            return p.Removed || p.HP!=p.MaxHP || p.Stripped!=0 || p.BarkReadyAt>0 || p.FelledAt> -99f ||
                p.Kind=="stove" || p.Kind=="structure" || p.Kind=="pack" || p.Kind=="fire";
        }
        static WorldFrame CaptureWorld(Game g,Sender source)
        {
            var f=new WorldFrame{Round=source.Round,Sequence=++source.Sequence,Seed=g.Seed,Arena=g.ArenaId,
                Difficulty=g.Level,Hunger=g.HungerLevel,Events=g.EventsOn,Alive=g.AliveCount,Winner=ActorId(g.Winner),
                Rain=g.Rain,Flood=g.Flood,Clock=g.Clock,Time=g.Time,Countdown=g.Countdown,StormPhase=g.StormPhase,
                SafeRadius=g.SafeRadius,NextRadius=g.StormNextRadius,StormSeconds=g.StormSecondsRemaining,
                StormMoving=g.StormMoving,StormWarning=g.StormWarning,ImpactTime=g.ImpactWorldTime,
                EventText=g.EventText,EventTime=g.EventTime,KillFeed=g.KillFeed,FeedTime=g.FeedTime,
                Seeded=g.SeededPropCount,TotalProps=g.Props.Count};
            // The native world is append-only. Keep stable indices even after a pickup or collapse.
            for(int i=source.Indices.Count;i<g.Props.Count;i++)source.Indices[g.Props[i]]=i;
            var visibleRemains=new HashSet<Prop>();
            foreach(FortFall fall in g.FortFalls){visibleRemains.Add(fall.Piece);f.FallenParts.Add(PropId(source,fall.Piece));f.Falls.Add(fall);}
            foreach(Actor a in g.Actors)
            {
                if(a.PickupSource!=null)visibleRemains.Add(a.PickupSource);
                f.Actors.Add(new ActorRecord{Actor=a,Equipped=a.ArmorPieces.IndexOf(a.EquippedArmor),
                    PickupSource=PropId(source,a.PickupSource),FallenPack=PropId(source,a.FallenPack),
                    FallenArmor=a.FallenPack==null||a.FallenPack.PackedArmor==null?-1:a.FallenPack.PackedArmor.IndexOf(a.ArmorAtDeath),
                    PackNumber=Brains.PackNumber(g,a)});
            }
            for(int i=0;i<g.Props.Count;i++)
            {
                Prop p=g.Props[i];
                if(i<f.Seeded&&!ActiveSeedProp(p))continue;
                // Felled timber remains visible during its fall. A generic consumed pickup needs only its index.
                bool tomb=p.Removed && !visibleRemains.Contains(p) && p.FelledAt< -99f;
                f.Props.Add(new PropRecord{Index=i,Prop=p,Tombstone=tomb,Support=PropId(source,p.Support)});
            }
            f.Animals=g.Animals;f.Effects=g.Effects;f.Shots=g.Shots;
            foreach(Shot s in g.Shots)f.ShotOwners.Add(ActorId(s.Owner));
            foreach(ImpactDrop d in g.ImpactDrops)if(d.Life>0)f.Drops.Add(d);
            foreach(ImpactMark m in g.ImpactMarks)if(m.Life>0)f.Marks.Add(m);
            g.OnlineForEachView(delegate(int seat)
            {
                f.Views.Add(new SeatView{Seat=seat,Camera=ActorId(g.CameraTarget),Focus=PropId(source,g.FocusProp),
                    FocusAnimal=g.Animals.IndexOf(g.FocusAnimal),UseAnimal=g.Animals.IndexOf(g.UseAnimal),UseProp=PropId(source,g.UseProp),
                    Options=g.FocusOptions,Choice=Math.Min(g.FocusChoice,Math.Max(0,g.FocusOptions.Count-1)),
                    Mode=g.Mode,Pitch=g.Pitch,Hint=g.Hint,Notice=g.Notice,NoticeTime=g.NoticeTime,BuildId=g.BuildId,Problem=g.BuildProblem,
                    BuildAngle=g.BuildAngle,Fits=g.GhostFits,Joined=g.BuildJoined,Ghost=g.Ghost,Charging=g.Charging,Charge=g.Charge,
                    TargetShore=g.FocusShore,Use=g.UseProgress,UseX=g.UseX,UseY=g.UseY,UseZ=g.UseZ,Action=g.ActionId,Argument=g.ActionArgument,
                    Incoming=g.IncomingImpact,Angle=g.IncomingAngle,Strength=g.IncomingStrength,Confirm=g.ConfirmedImpact});
            });
            while(source.Sounds.Count>0&&g.Clock-source.Sounds.Peek().Clock>1.15f)source.Sounds.Dequeue();
            f.Sounds.AddRange(source.Sounds);
            return f;
        }
        public static byte[] Capture(Game host)
        {
            if(host==null||!host.HostingOnlineRound)throw new InvalidOperationException("An authoritative online arena is required.");
            var f=CaptureWorld(host,Source(host));
            using(var raw=new MemoryStream(32768))
            using(var writer=new BinaryWriter(raw))
            {
                EncodeDecode(new SnapshotFields(writer),f);writer.Flush();
                if(raw.Length>Limit)throw new InvalidDataException("Arena frame too large.");
                using(var output=new MemoryStream())
                using(var outer=new BinaryWriter(output))
                {
                    outer.Write(Magic);outer.Write((byte)Version);outer.Write((int)raw.Length);
                    using(var zip=new DeflateStream(output,CompressionLevel.Fastest,true))
                        zip.Write(raw.GetBuffer(),0,(int)raw.Length);
                    return output.ToArray();
                }
            }
        }
        static WorldFrame Decode(byte[] data)
        {
            if(data==null||data.Length<10||data.Length>Limit)throw new InvalidDataException("Invalid arena frame size.");
            using(var bytes=new MemoryStream(data,false))
            using(var header=new BinaryReader(bytes))
            {
                if(header.ReadInt32()!=Magic||header.ReadByte()!=Version)throw new InvalidDataException("Wrong arena protocol.");
                int size=header.ReadInt32();
                if(size<=0||size>Limit)throw new InvalidDataException("Invalid arena payload size.");
                byte[] decoded=new byte[size];int read=0;
                using(var zip=new DeflateStream(bytes,CompressionMode.Decompress,true))
                {
                    while(read<size){int n=zip.Read(decoded,read,size-read);if(n==0)throw new EndOfStreamException();read+=n;}
                    if(zip.ReadByte()!=-1)throw new InvalidDataException("Arena frame overflow.");
                }
                using(var raw=new MemoryStream(decoded,false))
                using(var input=new BinaryReader(raw))
                {
                    var f=new WorldFrame();EncodeDecode(new SnapshotFields(input),f);
                    if(raw.Position!=size)throw new InvalidDataException("Trailing arena state.");
                    return f;
                }
            }
        }
    }
}
