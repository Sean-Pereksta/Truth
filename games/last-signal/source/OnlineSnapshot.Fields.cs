using System;
using System.IO;
using System.Text;
using System.Collections.Generic;

namespace LastSignal
{
    // Explicit field order is the wire contract, independent of the CLR object layout.
    internal sealed class SnapshotFields
    {
        readonly BinaryWriter writer;
        readonly BinaryReader reader;
        internal bool Reading { get { return reader!=null; } }
        internal SnapshotFields(BinaryWriter output) { writer=output; }
        internal SnapshotFields(BinaryReader input) { reader=input; }
        internal void Field(ref int value) { if(Reading)value=reader.ReadInt32();else writer.Write(value); }
        internal void Field(ref bool value) { if(Reading)value=reader.ReadBoolean();else writer.Write(value); }
        internal void Field(ref float value)
        {
            if(!Reading) { writer.Write(value);return; }
            value=reader.ReadSingle();
            if(float.IsNaN(value)||Math.Abs(value)>10000000f)throw new InvalidDataException("Invalid arena value.");
        }
        internal void Field(ref string value)
        {
            if(!Reading) { byte[] bytes=Encoding.UTF8.GetBytes(value??"");Count(bytes.Length,2048);writer.Write(bytes);return; }
            int n=Count(0,2048);byte[] data=reader.ReadBytes(n);
            if(data.Length!=n)throw new EndOfStreamException();
            value=Encoding.UTF8.GetString(data);
        }
        internal int Count(int value,int max)
        {
            if(Reading)value=reader.ReadUInt16();
            if(value<0||value>max)throw new InvalidDataException("Arena collection exceeds its limit.");
            if(!Reading)writer.Write((ushort)value);
            return value;
        }
        internal int Index(int value,int count)
        {
            // Index zero on the wire denotes an absent reference.
            return Count(value+1,count)-1;
        }
        internal static void AssetId(string value)
        {
            if(value.Length>64)throw new InvalidDataException("Unknown asset identifier.");
            foreach(char c in value)
                if(!(c>='a'&&c<='z'||c>='A'&&c<='Z'||c>='0'&&c<='9'||c=='_'||c=='-'))
                    throw new InvalidDataException("Invalid asset identifier.");
        }
        internal void Bag(Dictionary<string,int> bag)
        {
            int n=Count(bag.Count,128);
            if(Reading){for(int i=0;i<n;i++){string key="";int value=0;Field(ref key);AssetId(key);Field(ref value);bag[key]=value;}}
            else foreach(var entry in bag){string key=entry.Key;int value=entry.Value;Field(ref key);Field(ref value);}
        }
        internal void Food(List<float> food)
        {
            int n=Count(food.Count,4096);
            for(int i=0;i<n;i++){float amount=Reading?0:food[i];Field(ref amount);if(Reading)food.Add(amount);}
        }
        internal void Body(Actor data)
        {
            Field(ref data.Id); Field(ref data.Kills); Field(ref data.Placement); Field(ref data.TeamColor);
            Field(ref data.MeleeSide);
            Field(ref data.Name); Field(ref data.Style); Field(ref data.Weapon); Field(ref data.State);
            Field(ref data.LiftedWeapon); Field(ref data.ActionWeapon); Field(ref data.ProjectileId);
            Field(ref data.X); Field(ref data.Y); Field(ref data.Z); Field(ref data.Yaw);
            Field(ref data.Health); Field(ref data.Stamina); Field(ref data.Hunger); Field(ref data.Speed);
            Field(ref data.GuardTime); Field(ref data.DodgeTime); Field(ref data.Swing); Field(ref data.Windup);
            Field(ref data.Hurt); Field(ref data.NextAttack); Field(ref data.Anim); Field(ref data.Vertical);
            Field(ref data.Cooked); Field(ref data.Hydration); Field(ref data.WaterCarried); Field(ref data.NeedStrain);
            Field(ref data.EmptyFoodTime); Field(ref data.EmptyWaterTime); Field(ref data.DrawPower); Field(ref data.ProjectilePower);
            Field(ref data.WindupSpan); Field(ref data.ActionPitch); Field(ref data.SwingSpan); Field(ref data.AttackCharge);
            Field(ref data.GuardBlend); Field(ref data.GuardRecovery); Field(ref data.GuardPitch); Field(ref data.DodgeDX);
            Field(ref data.DodgeDZ); Field(ref data.FellAt); Field(ref data.FallYaw); Field(ref data.FallSlope);
            Field(ref data.TruceGestureAt); Field(ref data.PickupLift); Field(ref data.HitDirection); Field(ref data.HitStrength);
            Field(ref data.Throwing); Field(ref data.LastThrow); Field(ref data.SpearThrust); Field(ref data.GuardSpent);
            Field(ref data.MeleeStroke); Field(ref data.ShoveStroke); Field(ref data.TruceAccepted); Field(ref data.Alive);
            Field(ref data.Guard); Field(ref data.Crouch); Field(ref data.Sprint); Field(ref data.Heavy);
            Field(ref data.Aiming); Field(ref data.Winded);
            Field(ref data.CrossbowLoaded); Field(ref data.CrossbowReload);
        }
        internal static void Copy(Actor src,Actor dst)
        {
            dst.Id=src.Id; dst.Kills=src.Kills; dst.Placement=src.Placement; dst.TeamColor=src.TeamColor;
            dst.MeleeSide=src.MeleeSide;
            dst.Name=src.Name; dst.Style=src.Style; dst.Weapon=src.Weapon; dst.State=src.State;
            dst.LiftedWeapon=src.LiftedWeapon; dst.ActionWeapon=src.ActionWeapon; dst.ProjectileId=src.ProjectileId;
            dst.X=src.X; dst.Y=src.Y; dst.Z=src.Z; dst.Yaw=src.Yaw;
            dst.Health=src.Health; dst.Stamina=src.Stamina; dst.Hunger=src.Hunger; dst.Speed=src.Speed;
            dst.GuardTime=src.GuardTime; dst.DodgeTime=src.DodgeTime; dst.Swing=src.Swing; dst.Windup=src.Windup;
            dst.Hurt=src.Hurt; dst.NextAttack=src.NextAttack; dst.Anim=src.Anim; dst.Vertical=src.Vertical;
            dst.Cooked=src.Cooked; dst.Hydration=src.Hydration; dst.WaterCarried=src.WaterCarried; dst.NeedStrain=src.NeedStrain;
            dst.EmptyFoodTime=src.EmptyFoodTime; dst.EmptyWaterTime=src.EmptyWaterTime; dst.DrawPower=src.DrawPower; dst.ProjectilePower=src.ProjectilePower;
            dst.WindupSpan=src.WindupSpan; dst.ActionPitch=src.ActionPitch; dst.SwingSpan=src.SwingSpan; dst.AttackCharge=src.AttackCharge;
            dst.GuardBlend=src.GuardBlend; dst.GuardRecovery=src.GuardRecovery; dst.GuardPitch=src.GuardPitch; dst.DodgeDX=src.DodgeDX;
            dst.DodgeDZ=src.DodgeDZ; dst.FellAt=src.FellAt; dst.FallYaw=src.FallYaw; dst.FallSlope=src.FallSlope;
            dst.TruceGestureAt=src.TruceGestureAt; dst.PickupLift=src.PickupLift; dst.HitDirection=src.HitDirection; dst.HitStrength=src.HitStrength;
            dst.Throwing=src.Throwing; dst.LastThrow=src.LastThrow; dst.SpearThrust=src.SpearThrust; dst.GuardSpent=src.GuardSpent;
            dst.MeleeStroke=src.MeleeStroke; dst.ShoveStroke=src.ShoveStroke; dst.TruceAccepted=src.TruceAccepted; dst.Alive=src.Alive;
            dst.Guard=src.Guard; dst.Crouch=src.Crouch; dst.Sprint=src.Sprint; dst.Heavy=src.Heavy;
            dst.Aiming=src.Aiming; dst.Winded=src.Winded;
            dst.CrossbowLoaded=src.CrossbowLoaded; dst.CrossbowReload=src.CrossbowReload;
        }
        internal void Body(Prop data)
        {
            Field(ref data.Model); Field(ref data.Item); Field(ref data.Kind); Field(ref data.Label);
            Field(ref data.X); Field(ref data.Y); Field(ref data.Z); Field(ref data.Yaw);
            Field(ref data.Scale); Field(ref data.W); Field(ref data.H); Field(ref data.D);
            Field(ref data.HP); Field(ref data.MaxHP); Field(ref data.Fuel); Field(ref data.Cook);
            Field(ref data.Anim); Field(ref data.Water);
            Field(ref data.Amount); Field(ref data.Owner); Field(ref data.FortLevel);
            Field(ref data.Solid); Field(ref data.Opaque); Field(ref data.Removed); Field(ref data.Open);
            Field(ref data.Lit); Field(ref data.HasMeat); Field(ref data.Latched);
        }
        internal static void Copy(Prop src,Prop dst)
        {
            dst.Model=src.Model; dst.Item=src.Item; dst.Kind=src.Kind; dst.Label=src.Label;
            dst.X=src.X; dst.Y=src.Y; dst.Z=src.Z; dst.Yaw=src.Yaw;
            dst.Scale=src.Scale; dst.W=src.W; dst.H=src.H; dst.D=src.D;
            dst.HP=src.HP; dst.MaxHP=src.MaxHP; dst.Fuel=src.Fuel; dst.Cook=src.Cook;
            dst.Anim=src.Anim; dst.Water=src.Water;
            dst.Amount=src.Amount; dst.Owner=src.Owner; dst.FortLevel=src.FortLevel;
            dst.Solid=src.Solid; dst.Opaque=src.Opaque; dst.Removed=src.Removed; dst.Open=src.Open;
            dst.Lit=src.Lit; dst.HasMeat=src.HasMeat; dst.Latched=src.Latched;
        }
        internal void Body(Animal data)
        {
            Field(ref data.Model); Field(ref data.State);
            Field(ref data.X); Field(ref data.Y); Field(ref data.Z); Field(ref data.Yaw);
            Field(ref data.HP); Field(ref data.Anim); Field(ref data.Timer); Field(ref data.Alert);
            Field(ref data.Alive); Field(ref data.Harvested);
        }
        internal static void Copy(Animal src,Animal dst)
        {
            dst.Model=src.Model; dst.State=src.State;
            dst.X=src.X; dst.Y=src.Y; dst.Z=src.Z; dst.Yaw=src.Yaw;
            dst.HP=src.HP; dst.Anim=src.Anim; dst.Timer=src.Timer; dst.Alert=src.Alert;
            dst.Alive=src.Alive; dst.Harvested=src.Harvested;
        }
        internal void Body(Effect data)
        {
            Field(ref data.Type);
            Field(ref data.X); Field(ref data.Y); Field(ref data.Z); Field(ref data.Time);
            Field(ref data.Life); Field(ref data.DX); Field(ref data.DY); Field(ref data.DZ);
            Field(ref data.Color);
        }
        internal void Body(Shot data)
        {
            Field(ref data.Model);
            Field(ref data.X); Field(ref data.Y); Field(ref data.Z); Field(ref data.DX);
            Field(ref data.DY); Field(ref data.DZ); Field(ref data.Life); Field(ref data.Age);
            Field(ref data.Damage); Field(ref data.Gravity);
        }
        internal void Body(ref ImpactDrop data)
        {
            Field(ref data.X); Field(ref data.Y); Field(ref data.Z); Field(ref data.VX);
            Field(ref data.VY); Field(ref data.VZ); Field(ref data.Radius); Field(ref data.Age);
            Field(ref data.Life); Field(ref data.Tint);
            Field(ref data.Bloody); Field(ref data.LeavesMark); Field(ref data.Mist);
        }
        internal void Body(ref ImpactMark data)
        {
            Field(ref data.X); Field(ref data.Y); Field(ref data.Z); Field(ref data.Radius);
            Field(ref data.Angle); Field(ref data.Tint); Field(ref data.Age); Field(ref data.Life);
            Field(ref data.SlopeX); Field(ref data.SlopeZ);
        }
    }
}
