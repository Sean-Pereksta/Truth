using System;
using System.Collections.Generic;
using System.IO;

namespace LastSignal
{
    public static partial class OnlineSnapshot
    {
        sealed class ActorRecord
        {
            public Actor Actor;
            public int PackNumber,PickupSource,FallenPack,FallenArmor,Equipped;
        }
        sealed class PropRecord
        {
            public Prop Prop;
            public int Index,Support;
            public bool Tombstone;
        }
        sealed class SeatView
        {
            public int Seat,Camera,Focus,FocusAnimal,UseProp,UseAnimal,Choice;
            public List<string> Options;
            public string Mode,Hint,Notice,BuildId,Problem,Action,Argument;
            public float NoticeTime,Pitch,Use,UseX,UseY,UseZ,Charge,BuildAngle,Incoming,Angle,Strength,Confirm;
            public bool Charging,TargetShore,Joined,Fits;
            public Prop Ghost;
        }
        sealed class WorldFrame
        {
            public int Round,Sequence,Seed,Arena,Difficulty,Hunger,Alive,Winner,Seeded,TotalProps;
            public bool Events,Rain,Flood,StormWarning,StormMoving;
            public float Time,Clock,Countdown,SafeRadius,EventTime,FeedTime,ImpactTime,NextRadius,StormSeconds;
            public int StormPhase;
            public string EventText,KillFeed;
            public List<PropRecord> Props=new List<PropRecord>();
            public List<ActorRecord> Actors=new List<ActorRecord>();
            public List<Animal> Animals=new List<Animal>();
            public List<Shot> Shots=new List<Shot>();
            public List<int> ShotOwners=new List<int>();
            public List<Effect> Effects=new List<Effect>();
            public List<FortFall> Falls=new List<FortFall>();
            public List<int> FallenParts=new List<int>();
            public List<ImpactDrop> Drops=new List<ImpactDrop>();
            public List<ImpactMark> Marks=new List<ImpactMark>();
            public List<SeatView> Views=new List<SeatView>();
            public List<SoundRecord> Sounds=new List<SoundRecord>();
        }
        static void ArmorList(SnapshotFields io,List<ArmorPiece> pieces)
        {
            int n=io.Count(pieces==null?0:pieces.Count,256);
            for(int i=0;i<n;i++)
            {
                string id=io.Reading?"":pieces[i].Id;
                float integrity=io.Reading?0:pieces[i].Integrity;
                io.Field(ref id);io.Field(ref integrity);
                if(io.Reading)
                {
                    if(!Armor.IsArmor(id))throw new InvalidDataException("Unknown armor.");
                    pieces.Add(new ArmorPiece(id){Integrity=integrity});
                }
            }
        }
        static void PropFields(SnapshotFields io,Prop p)
        {
            io.Body(p);
            if(io.Reading){SnapshotFields.AssetId(p.Model);SnapshotFields.AssetId(p.Item);SnapshotFields.AssetId(p.Kind);}
            io.Field(ref p.Stripped);io.Field(ref p.FelledAt);io.Field(ref p.FellDirection);io.Field(ref p.BarkReadyAt);
            io.Bag(p.Bag);io.Food(p.FoodProgress);
            if(io.Reading)p.PackedArmor=new List<ArmorPiece>();
            ArmorList(io,p.PackedArmor);
            bool framed=p.Fort!=null;io.Field(ref framed);
            if(framed)
            {
                if(io.Reading)p.Fort=new Arena.FortFrame();
                io.Field(ref p.Fort.X);io.Field(ref p.Fort.Y);io.Field(ref p.Fort.Z);io.Field(ref p.Fort.Yaw);io.Field(ref p.Fort.StartsOnDeck);
            }
        }
        static void ViewFields(SnapshotFields io,SeatView s,int totalProps,int totalActors,int totalAnimals)
        {
            s.Seat=io.Count(s.Seat,7);
            s.Camera=io.Index(s.Camera,totalActors);s.Focus=io.Index(s.Focus,totalProps);
            s.UseProp=io.Index(s.UseProp,totalProps);s.UseAnimal=io.Index(s.UseAnimal,totalAnimals);s.FocusAnimal=io.Index(s.FocusAnimal,totalAnimals);
            int options=io.Count(s.Options==null?0:s.Options.Count,32);
            if(io.Reading)s.Options=new List<string>(options);
            for(int i=0;i<options;i++){string option=io.Reading?"":s.Options[i];io.Field(ref option);if(io.Reading)s.Options.Add(option);}
            s.Choice=io.Count(s.Choice,Math.Max(0,options-1));
            io.Field(ref s.Mode);io.Field(ref s.Pitch);io.Field(ref s.Hint);io.Field(ref s.Notice);io.Field(ref s.NoticeTime);
            io.Field(ref s.BuildId);io.Field(ref s.Problem);io.Field(ref s.BuildAngle);io.Field(ref s.Joined);io.Field(ref s.Fits);
            io.Field(ref s.Charging);io.Field(ref s.Charge);io.Field(ref s.TargetShore);
            io.Field(ref s.Use);io.Field(ref s.UseX);io.Field(ref s.UseY);io.Field(ref s.UseZ);io.Field(ref s.Action);io.Field(ref s.Argument);
            io.Field(ref s.Incoming);io.Field(ref s.Angle);io.Field(ref s.Strength);io.Field(ref s.Confirm);
            bool ghost=s.Ghost!=null;io.Field(ref ghost);
            if(ghost){if(io.Reading)s.Ghost=new Prop();PropFields(io,s.Ghost);}
        }
        static void EncodeDecode(SnapshotFields io,WorldFrame f)
        {
            io.Field(ref f.Round);io.Field(ref f.Sequence);io.Field(ref f.Seed);
            if(f.Sequence<1)throw new InvalidDataException("Missing sequence number.");
            f.Arena=io.Count(f.Arena,2);f.Difficulty=io.Count(f.Difficulty,3);f.Hunger=io.Count(f.Hunger,2);
            io.Field(ref f.Events);io.Field(ref f.Rain);io.Field(ref f.Flood);io.Field(ref f.Clock);io.Field(ref f.Time);io.Field(ref f.Countdown);
            io.Field(ref f.SafeRadius);io.Field(ref f.NextRadius);io.Field(ref f.StormSeconds);io.Field(ref f.StormPhase);
            io.Field(ref f.StormMoving);io.Field(ref f.StormWarning);io.Field(ref f.ImpactTime);
            io.Field(ref f.EventText);io.Field(ref f.EventTime);io.Field(ref f.KillFeed);io.Field(ref f.FeedTime);
            int actors=io.Count(f.Actors.Count,24);if(actors<1)throw new InvalidDataException("No contestants.");
            f.Alive=io.Count(f.Alive,actors);f.Winner=io.Index(f.Winner,actors);
            f.TotalProps=io.Count(f.TotalProps,32767);f.Seeded=io.Count(f.Seeded,f.TotalProps);
            int changed=io.Count(f.Props.Count,f.TotalProps),prev=-1;
            for(int i=0;i<changed;i++)
            {
                PropRecord record=io.Reading?new PropRecord():f.Props[i];
                record.Index=io.Count(record.Index,f.TotalProps-1);
                if(record.Index<=prev)throw new InvalidDataException("Unordered arena objects.");
                prev=record.Index;io.Field(ref record.Tombstone);
                if(!record.Tombstone)
                {
                    if(io.Reading)record.Prop=new Prop();
                    PropFields(io,record.Prop);
                    record.Support=io.Index(record.Support,f.TotalProps);
                }
                if(io.Reading)f.Props.Add(record);
            }
            for(int i=0;i<actors;i++)
            {
                ActorRecord rec=io.Reading?new ActorRecord{Actor=new Actor()}:f.Actors[i];
                Actor a=rec.Actor;io.Body(a);
                if(a.Id!=i)throw new InvalidDataException("Unexpected contestant number.");
                if(io.Reading){SnapshotFields.AssetId(a.Weapon);SnapshotFields.AssetId(a.ActionWeapon);SnapshotFields.AssetId(a.LiftedWeapon);SnapshotFields.AssetId(a.ProjectileId);}
                io.Bag(a.Bag);io.Food(a.FoodProgress);ArmorList(io,a.ArmorPieces);
                rec.Equipped=io.Index(rec.Equipped,a.ArmorPieces.Count);
                rec.PickupSource=io.Index(rec.PickupSource,f.TotalProps);
                rec.FallenPack=io.Index(rec.FallenPack,f.TotalProps);rec.FallenArmor=io.Index(rec.FallenArmor,256);
                io.Field(ref rec.PackNumber);
                if(io.Reading)f.Actors.Add(rec);
            }
            int animals=io.Count(f.Animals.Count,128);
            for(int i=0;i<animals;i++)
            {
                Animal a=io.Reading?new Animal():f.Animals[i];io.Body(a);if(io.Reading){SnapshotFields.AssetId(a.Model);f.Animals.Add(a);}
            }
            int shots=io.Count(f.Shots.Count,1024);
            for(int i=0;i<shots;i++)
            {
                Shot s=io.Reading?new Shot():f.Shots[i];io.Body(s);
                int owner=io.Index(io.Reading?-1:f.ShotOwners[i],actors);
                if(io.Reading){SnapshotFields.AssetId(s.Model);f.Shots.Add(s);f.ShotOwners.Add(owner);}
            }
            int effects=io.Count(f.Effects.Count,4096);
            for(int i=0;i<effects;i++)
            {
                Effect e=io.Reading?new Effect():f.Effects[i];io.Body(e);if(io.Reading)f.Effects.Add(e);
            }
            int falls=io.Count(f.Falls.Count,4096);
            for(int i=0;i<falls;i++)
            {
                FortFall fall=io.Reading?new FortFall():f.Falls[i];
                int refId=io.Count(io.Reading?0:f.FallenParts[i],f.TotalProps-1);
                io.Field(ref fall.Start);io.Field(ref fall.FloorY);if(io.Reading){f.Falls.Add(fall);f.FallenParts.Add(refId);}
            }
            int drops=io.Count(f.Drops.Count,160);
            for(int i=0;i<drops;i++){ImpactDrop d=io.Reading?new ImpactDrop():f.Drops[i];io.Body(ref d);if(io.Reading)f.Drops.Add(d);}
            int marks=io.Count(f.Marks.Count,88);
            for(int i=0;i<marks;i++){ImpactMark m=io.Reading?new ImpactMark():f.Marks[i];io.Body(ref m);if(io.Reading)f.Marks.Add(m);}
            int views=io.Count(f.Views.Count,8),seatMask=0;
            for(int i=0;i<views;i++)
            {
                SeatView view=io.Reading?new SeatView():f.Views[i];ViewFields(io,view,f.TotalProps,actors,animals);
                if(view.Seat>=actors||(seatMask&(1<<view.Seat))!=0)throw new InvalidDataException("Invalid player seat.");
                seatMask|=1<<view.Seat;if(io.Reading)f.Views.Add(view);
            }
            int sounds=io.Count(f.Sounds.Count,256);
            for(int i=0;i<sounds;i++)
            {
                SoundRecord cue=io.Reading?new SoundRecord():f.Sounds[i];
                io.Field(ref cue.Id);io.Field(ref cue.Name);io.Field(ref cue.X);io.Field(ref cue.Z);io.Field(ref cue.Range);
                if(io.Reading)f.Sounds.Add(cue);
            }
        }
    }
}
