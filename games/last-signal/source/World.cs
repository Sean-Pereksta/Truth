using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;

namespace LastSignal
{
    public static partial class Arena
    {
        public const float OpeningSupplyRadius=16f;
        const int Cells=60;
        const float CellSize=8f, Origin=240f;
        static readonly ConditionalWeakTable<Game,Field> fields=new ConditionalWeakTable<Game,Field>();
        sealed class Field
        {
            public readonly FortSupportState Forts=new FortSupportState();
            public List<Prop>[] Nearby=new List<Prop>[Cells*Cells];
            public List<Body>[] Bodies=new List<Body>[Cells*Cells];
            public int Stamp,Revision;
        }
        sealed class Body
        {
            public Prop Prop;
            public float X,Y,Z,HalfX,H,HalfZ,C,S;
            public string Type;
            public int Stamp;
            public bool Retired,Floor;
        }
        static int Cell(float v) { return Math.Max(0,Math.Min(Cells-1,(int)((v+Origin)/CellSize))); }
        static int Index(float x,float z) { return Cell(x)+Cell(z)*Cells; }
        static float Rand(Random rng,float a,float b) { return a+(b-a)*(float)rng.NextDouble(); }
        static float WorldYaw(Random rng) { return Rand(rng,0f,6.2831853f); }
        static void AddBody(Field f,Prop p,float x,float y,float z,float wx,float h,float dz,
                            float yaw,string type,bool floor)
        {
            Body b=new Body{Prop=p,X=x,Y=y,Z=z,HalfX=wx*.5f,H=h,HalfZ=dz*.5f,C=Cos(yaw),S=Sin(yaw),Type=type,Floor=floor};
            float rx=Math.Abs(b.C)*b.HalfX+Math.Abs(b.S)*b.HalfZ+.5f, rz=Math.Abs(b.S)*b.HalfX+Math.Abs(b.C)*b.HalfZ+.5f;
            for(int iz=Cell(z-rz);iz<=Cell(z+rz);iz++)
            for(int ix=Cell(x-rx);ix<=Cell(x+rx);ix++)
            {
                int n=ix+Cells*iz;
                if(f.Bodies[n]==null) f.Bodies[n]=new List<Body>();
                f.Bodies[n].Add(b);
            }
        }
        static void Part(Field f,Prop p,float lx,float ly,float lz,float w,float h,float d,float yaw,string shape,bool floor)
        {
            float c=Cos(p.Yaw),s=Sin(p.Yaw);
            AddBody(f,p,p.X+c*lx+s*lz,p.Y+ly,p.Z-s*lx+c*lz,w,h,d,p.Yaw+yaw,shape,floor);
        }
        static void Geometry(Field f,Prop p)
        {
            if(!p.Solid&&!p.Opaque) return;
            switch(p.Model)
            {
                case "cornucopia": AddBody(f,p,p.X+1.0f,p.Y,p.Z-7.2f,14,8.1f,15.2f,p.Yaw,"horn",false); break;
                case "gate":
                    Part(f,p,-1.42f,0,0,.20f,2.36f,.30f,0,"box",false);
                    Part(f,p,1.42f,0,0,.20f,2.36f,.30f,0,"box",false);
                    if(p.Open) Part(f,p,-1.38f,0,-1.32f,2.66f,2.13f,.18f,1.5707963f,"box",false);
                    else Part(f,p,0,0,0,2.70f,2.13f,.18f,0,"box",false);
                    break;
                case "lean_to":
                    Part(f,p,-1.08f,0,.97f,.14f,1.82f,.14f,0,"box",false);
                    Part(f,p,1.08f,0,.97f,.14f,1.82f,.14f,0,"box",false);
                    Part(f,p,0,.10f,-.08f,2.48f,1.74f,2.24f,0,"roof",false);
                    break;
                case "watchtower":
                    for(int i=0;i<4;i++)Part(f,p,i%2==0?-1.50f:1.50f,0,i<2?-1.50f:1.50f,.33f,6.5f,.33f,0,"box",false);
                    Part(f,p,0,5.6f,0,3.7f,2.45f,3.7f,0,"box",false);break;
                case "aqueduct":
                    for(int j=0;j<4;j++)
                        Part(f,p,(-5.34f+j*3.56f)*p.Scale,0,0,.76f*p.Scale,(j==3?1.73f:2.06f)*p.Scale,1.6f*p.Scale,0,"box",false);
                    for(int arch=0;arch<3;arch++)
                    for(int j=0;j<12;j++)
                    {
                        float lx=-1.78f+(j+.5f)*3.56f/12f;
                        if(arch==2&&lx>-.55f)continue;
                        float under=2.04f+(float)Math.Sqrt(Math.Max(0,1.44f*1.44f-lx*lx));
                        float crown=arch==2?4.04f:4.71f;
                        Part(f,p,(-3.56f+arch*3.56f+lx)*p.Scale,under*p.Scale,0,.30f*p.Scale,(crown-under)*p.Scale,1.60f*p.Scale,0,"box",false);
                    }
                    break;
                case "ramp": Part(f,p,0,0,0,p.W,p.H,p.D,0,"ramp",true);break;
                case "floor": Part(f,p,0,0,0,p.W,p.H,p.D,0,"deck",true);break;
                case "platform": Part(f,p,0,0,0,p.W,p.H,p.D,0,"disc",true);break;
                case "bridge": Part(f,p,0,0,0,p.W,p.H,p.D,0,"box",true);break;
                case "sand_arch":
                    Part(f,p,-3.58f*p.Scale,0,0,2.05f*p.Scale,4.45f*p.Scale,2.15f*p.Scale,0,"box",false);
                    Part(f,p,3.62f*p.Scale,0,0,1.90f*p.Scale,4.45f*p.Scale,2.1f*p.Scale,0,"box",false);
                    Part(f,p,0,4.17f*p.Scale,0,8.63f*p.Scale,1.41f*p.Scale,2.05f*p.Scale,0,"box",false);break;
                case "signal_lodge":
                    Part(f,p,0,0,-.20f*p.Scale,5.4f*p.Scale,3.84f*p.Scale,3.75f*p.Scale,0,"box",false);break;
                case "pinon":case "snow_fir":case "pine":case "oak":case "birch":
                    Part(f,p,0,0,0,p.W,p.H,p.D,0,"trunk",false);break;
                case "rain_barrel":case "spring":
                    Part(f,p,0,0,0,p.W,p.H,p.D,0,"trunk",false);break;
                case "weapon_table":
                    Part(f,p,0,.70f,0,2.40f,.10f,1.05f,0,"box",true);
                    for(int j=0;j<4;j++)Part(f,p,j%2==0?-.94f:.94f,0,j<2?-.37f:.37f,.13f,.70f,.13f,0,"box",false);
                    break;
                case "rock":case "boulder":case "sand_hoodoo":case "mesa_rock":case "snow_boulder":case "ice_teeth": Part(f,p,0,0,0,p.W,p.H,p.D,0,"stone",false);break;
                default: Part(f,p,0,0,0,p.W,p.H,p.D,0,"box",false);break;
            }
        }
        public static void Register(Game g,Prop p)
        {
            Field f=fields.GetOrCreateValue(g); g.Props.Add(p);
            if(FortMember(p)){f.Forts.Members.Add(p);f.Forts.Stable=null;}
            int i=Index(p.X,p.Z); if(f.Nearby[i]==null) f.Nearby[i]=new List<Prop>();
            f.Nearby[i].Add(p); Geometry(f,p);if(p.Solid||p.Opaque)f.Revision++;
        }
        public static void Near(Game g,float x,float z,float radius,List<Prop> result)
        {
            result.Clear(); Field f=fields.GetOrCreateValue(g);
            float rr=radius*radius;
            for(int iz=Cell(z-radius);iz<=Cell(z+radius);iz++)
            for(int ix=Cell(x-radius);ix<=Cell(x+radius);ix++)
            {
                List<Prop> list=f.Nearby[ix+Cells*iz]; if(list==null)continue;
                for(int i=0;i<list.Count;i++)
                {
                    Prop p=list[i]; float dx=x-p.X,dz=z-p.Z;
                    if(!p.Removed && dx*dx+dz*dz<=rr) result.Add(p);
                }
            }
        }
        static Prop Decor(Game g,string model,float x,float z,float scale,float yaw,float baseY=float.NaN)
        {
            Prop p=new Prop{Model=model,X=x,Z=z,Y=Height(x,z),Scale=scale,Yaw=yaw,Label=model,Kind="decor"};
            switch(model)
            {
                case "cornucopia":p.W=14;p.H=7.5f;p.D=15; p.Solid=p.Opaque=true; p.Label="Bronze Cornucopia"; break;
                case "platform":p.W=p.D=2.56f;p.H=.27f;p.Solid=true; break;
                case "tree":case "oak":p.W=p.D=.79f*scale;p.H=7.3f*scale;p.Solid=p.Opaque=true;break;
                case "birch":p.W=p.D=.37f*scale;p.H=6.4f*scale;p.Solid=p.Opaque=true;break;
                case "pine":p.W=p.D=.62f*scale;p.H=9.2f*scale;p.Solid=p.Opaque=true;break;
                case "rock":p.W=3.45f*scale;p.D=3.23f*scale;p.H=2.1f*scale;p.Solid=p.Opaque=true;break;
                case "boulder":p.W=4.2f*scale;p.D=4.15f*scale;p.H=3.65f*scale;p.Solid=p.Opaque=true;break;
                case "ruin":p.W=4.18f*scale;p.D=1.06f*scale;p.H=2.71f*scale;p.Solid=p.Opaque=true;break;
                case "floodgate":p.W=8.65f*scale;p.D=1.02f*scale;p.H=3.4f*scale;p.Solid=p.Opaque=true;break;
                case "bridge":p.W=3f*scale;p.H=.10f*scale;p.D=5f*scale;p.Y=-1.34f;p.Solid=true;break;
                case "stove":p.W=p.D=1.22f;p.H=1.28f;p.Kind="stove";p.Lit=true;p.Fuel=999999f;p.Solid=p.Opaque=true;p.Label="Arena stove";break;
                case "spring":p.W=1.90f;p.D=1.50f;p.H=.80f;p.Kind="water";p.Solid=p.Opaque=true;p.Label="Freshwater spring";break;
                case "cache":p.W=1.65f;p.D=.88f;p.H=.77f;p.Solid=p.Opaque=true;p.Label="Supply chest";break;
                case "weapon_table":p.W=2.4f;p.D=1.05f;p.H=.80f;p.Solid=p.Opaque=true;p.Label="Arena weapon stand";break;
                case "sand_arch":p.W=9.6f*scale;p.D=2.6f*scale;p.H=5.9f*scale;p.Solid=p.Opaque=true;p.Label="Weathered sandstone arch";break;
                case "sand_hoodoo":p.W=2.82f*scale;p.D=2.56f*scale;p.H=6.8f*scale;p.Solid=p.Opaque=true;break;
                case "mesa_rock":p.W=4.35f*scale;p.D=3.5f*scale;p.H=3.9f*scale;p.Solid=p.Opaque=true;break;
                case "pinon":p.W=p.D=.56f*scale;p.H=5.2f*scale;p.Solid=p.Opaque=true;break;
                case "yucca":case "snow_heath":p.Kind="vegetation";p.W=p.D=2.14f*scale;p.H=1.2f*scale;break;
                case "snow_fir":p.W=p.D=.62f*scale;p.H=9.2f*scale;p.Solid=p.Opaque=true;break;
                case "snow_boulder":p.W=3.9f*scale;p.D=3.2f*scale;p.H=2.05f*scale;p.Solid=p.Opaque=true;break;
                case "ice_teeth":p.W=4.6f*scale;p.D=3.5f*scale;p.H=5.9f*scale;p.Solid=p.Opaque=true;break;
                case "signal_lodge":p.W=6.3f*scale;p.D=4.5f*scale;p.H=5.5f*scale;p.Solid=p.Opaque=true;p.Label="Pass signal lodge";break;
                case "watchtower":p.W=p.D=3.7f;p.H=10.3f;p.Solid=p.Opaque=true;p.Label="Signal watchtower";break;
                case "aqueduct":p.W=11.42f*scale;p.D=1.65f*scale;p.H=4.9f*scale;p.Solid=p.Opaque=true;p.Label="Old aqueduct";break;
                case "flowers":case "rushes":p.Kind="vegetation";p.W=p.D=1.42f*scale;p.H=(model=="flowers"?.73f:1.08f)*scale;break;
                case "shore_rocks":p.W=2.85f*scale;p.D=2.1f*scale;p.H=.40f*scale;break;
                case "bush":case "reed":case "grass":p.Kind="vegetation";p.H=(model=="grass"?.6f:model=="bush"?1.45f:1.7f)*scale;p.W=p.D=(model=="bush"?2.4f:1.7f)*scale;break;
            }
            if(!float.IsNaN(baseY))p.Y=baseY;
            Register(g,p); return p;
        }
        public static Prop Drop(Game g,string id,int amount,float x,float z)
        {
            return Drop(g,id,amount,x,z,float.PositiveInfinity);
        }
        public static Prop Drop(Game g,string id,int amount,float x,float z,float maxY)
        {
            if(!CanStand(g,x,GroundBelow(g,x,z,maxY)+.04f,z,.12f,.4f))
            {
                float ox=x,oz=z;
                for(int i=0;i<18;i++)
                {
                    float off=.66f+.40f*(i/6),a=(i%6)*1.0472f;
                    x=ox+off*Sin(a);z=oz+off*Cos(a);
                    if(CanStand(g,x,GroundBelow(g,x,z,maxY)+.04f,z,.12f,.4f))break;
                }
            }
            Prop p=new Prop{Model=id,Kind="pickup",Item=id,Amount=amount,Label=id.Replace('_',' '),X=x,Z=z,Y=GroundBelow(g,x,z,maxY)+.04f,Yaw=WorldYaw(g.Rng),W=.55f,H=.28f,D=.50f}; Register(g,p); return p;
        }
        // The four spokes have wide openings. Every district also has a winding, vegetated side trail.
        static void PolarSite(int district,float forward,float lateral,out float x,out float z)
        {
            if(district==1) {x=-forward;z=lateral;}
            else if(district==2) {x=forward;z=lateral;}
            else {x=lateral;z=district==3?-forward:forward;}
        }
        static bool ClearSite(Game g,float x,float z,float pad)
        {
            if(x*x+z*z>119*119||Water(x,z)>.55f) return false;
            return CanStand(g,x,Ground(g,x,z)+.02f,z,pad,1.4f);
        }
        // Three stock layouts share the map's seeded generator: loose spill at the mouth
        // may move in either axis, vault items slide along a row, perimeter kits have fixed positions.
        static Prop Stock(Game g,int zone,float x,float z,float yaw,float side,float front,string item,int amount,int ammo,bool onTable)
        {
            if(zone<2)side+=Rand(g.Rng,-.035f,.035f);
            if(zone==0)front+=Rand(g.Rng,-.04f,.04f);
            float c=Cos(yaw),s=Sin(yaw);
            Prop p=Drop(g,item,amount,x+side*c+front*s,z-side*s+front*c);
            if(onTable)
            {
                p.Y=Ground(g,p.X,p.Z)-(item=="spear"?.006f:item=="bow"?.048f:.068f);
                p.Yaw=yaw+1.5707963f+.025f*Sin(p.Yaw);
            }
            if(ammo>0)
            {
                string projectile=item=="bow"?"arrows":"stone";p.Bag[projectile]=ammo;
                p.Label=(item=="bow"?"Bow + ":"Sling + ")+ammo+(item=="bow"?" arrows":" stones");
            }
            return p;
        }
        static void WeaponStation(Game g,int zone,float x,float z,float yaw,bool table,string first,int firstAmmo,
            string second,int secondAmmo,string reserve,int reserveCount,string utility,int utilityCount)
        {
            if(table)Decor(g,"weapon_table",x,z,1,yaw);
            float separation=table?.235f:.51f;
            Stock(g,zone,x,z,yaw,0,-separation,first,1,firstAmmo,table);
            Stock(g,zone,x,z,yaw,0,separation,second,1,secondAmmo,table);
            Stock(g,zone,x,z,yaw,-.70f,table?1.17f:1.04f,reserve,reserveCount,0,false);
            Stock(g,zone,x,z,yaw,.72f,table?1.21f:1.09f,utility,utilityCount,0,false);
        }
        static void OpeningSupplies(Game g)
        {
            Decor(g,"cache",-4.7f,.96f,1,.23f);Decor(g,"cache",4.55f,1.55f,1,-.51f);
            Decor(g,"cache",2.62f,-5.15f,1,-.85f);
            // Four low display stands frame the contested approach and the flanks.
            // Weapons are separate real pickups and immediately disappear when taken.
            WeaponStation(g,0,-4.9f,8.65f,-.32f,true,"spear",0,"sling",5,"stone",4,"bandage",1);
            WeaponStation(g,0,4.9f,8.65f,.32f,true,"hatchet",0,"bow",4,"arrows",4,"cloth",2);
            WeaponStation(g,0,-9.15f,-1.75f,1.30f,true,"spear",0,"shield",0,"fiber",3,"bandage",1);
            WeaponStation(g,0,9.15f,-1.75f,-1.30f,true,"hatchet",0,"sling",5,"stone",4,"tinder",2);
            Stock(g,0,-3.38f,3f,0,0,0,"sword",1,0,false);
            Stock(g,0,3.10f,3.72f,0,0,0,"spear",1,0,false);
            Stock(g,0,-1.72f,5.70f,0,0,0,"sling",1,5,false);
            string[] spill={"scrap","fiber","stone","branch","bandage","cloth","arrows","tinder"};
            for(int i=0;i<spill.Length;i++)
                Stock(g,0,(i%2==0?-1:1)*(1.8f+(i/2)*.70f),6.62f-(i/2)*1.28f,0,0,0,spill[i],i==2?4:i==6?4:1,0,false);
            // Deeper supplies offer larger ranged loads, spare spears, medicine and prepared food.
            WeaponStation(g,1,-2.18f,-4.06f,.04f,true,"bow",8,"spear",0,"arrows",8,"bandage",2);
            WeaponStation(g,1,1.43f,-7.45f,-.08f,true,"bow",8,"hatchet",0,"arrows",8,"meal",2);
            Stock(g,1,-.12f,-8.83f,0,0,0,"spear",1,0,false);
            Stock(g,1,-1.36f,-7.23f,0,0,0,"knife",1,0,false);
            Stock(g,1,.78f,-3.35f,0,0,0,"bandage",2,0,false);
            Stock(g,1,.15f,-9.65f,0,0,0,"meal",2,0,false);
            // Contestants approaching the closed back of the horn can grab equipment
            // immediately, then take either flank toward its open mouth.
            WeaponStation(g,2,-7.95f,-8.82f,.49f,false,"sword",0,"shield",0,"scrap",2,"bandage",1);
            WeaponStation(g,2,7.95f,-8.82f,-.49f,false,"bow",3,"knife",0,"arrows",3,"fiber",2);
            WeaponStation(g,2,-4.72f,-13.38f,.31f,false,"sling",5,"knife",0,"stone",4,"cloth",1);
            WeaponStation(g,2,4.72f,-13.38f,-.31f,false,"spear",0,"hatchet",0,"tinder",2,"bandage",1);
            Stock(g,2,-11.55f,2.8f,0,0,0,"branch",3,0,false);
            Stock(g,2,11.55f,2.8f,0,0,0,"stone",4,0,false);
            for(int i=0;i<3;i++)
            {
                Prop pack=new Prop{Model="pack",Kind="pack",Item="pack",Label="Supply pack",X=i==0?-3.86f:i==1?3.45f:1.75f,
                    Z=i==0?1.62f:i==1?2.08f:-4.4f,Y=.035f,Yaw=.8f*i,Scale=1.06f};
                pack.Bag["cloth"]=1;pack.Bag[i==2?"arrows":"stone"]=i==2?6:3;Register(g,pack);
            }
        }
        public static void Populate(Game g)
        {
            Select(g.ArenaId);
            fields.Remove(g); g.Props.Clear();g.Animals.Clear();
            Random r=g.Rng; Decor(g,"cornucopia",0,0,1,0);
            for(int i=0;i<24;i++)
            {
                float t=i*6.2831853f/24;
                Decor(g,"platform",18*Sin(t),18*Cos(t),1,t+3.1415927f);
            }
            OpeningSupplies(g);
            if(Variant!=0)PopulateVariant(g,r);
            else PopulateCrownwood(g,r);
            PlaceRareCrossbow(g);
        }
        // Field supply sites already have dry, walkable ground. The separate loot roll
        // keeps the terrain and ordinary supplies identical for the same arena seed.
        static void PlaceRareCrossbow(Game g)
        {
            var roll=new Random(unchecked(g.Seed ^ (g.ArenaId*1009) ^ 0x43bc27));
            if(roll.Next(3)!=0)return;
            var sites=new List<Prop>();
            foreach(Prop p in g.Props){
                float distance=p.X*p.X+p.Z*p.Z;
                if(p.Kind=="pickup" && p.Item=="scrap" && distance>=42*42 && distance<=118*118)
                    sites.Add(p);
            }
            if(sites.Count==0)return;
            Prop cache=sites[roll.Next(sites.Count)];
            cache.Model=cache.Item="crossbow";
            cache.Amount=1;
            cache.Label="Crossbow + 4 bolts";
            cache.Bag["bolts"]=4;
        }
        static void PopulateCrownwood(Game g,Random r)
        {
            Decor(g,"floodgate",85.5f,-17,1,.17f);
            // A raised crossing and two natural banks remain accessible during flood events.
            for(int i=0;i<6;i++) Decor(g,"bridge",74,-18f+i*4.90f,1,0);
            Decor(g,"stove",-31,16,1,.95f);Decor(g,"stove",40,19,1,-1f);
            Decor(g,"stove",-9,-52,1,.48f);Decor(g,"stove",24,62,1,2.42f);
            Decor(g,"spring",-37,6,1,1.17f);Decor(g,"spring",41,-13,1,-1.32f);
            Decor(g,"spring",3,-44,1,.32f);Decor(g,"spring",-5,38,1,2.91f);
            for(int k=0;k<12;k++)
            {
                float x=(k%4<2?-1:1)*(9+(k%2)*5.4f+Rand(r,-1,1));
                float z=-43-(k/4)*16.5f-Rand(r,-2,2);
                Decor(g,"ruin",x,z,Rand(r,.83f,1.25f),Rand(r,-.5f,.5f)+(k%3==0?1.25f:0));
            }
            // Distinct habitat clusters, with space between trunks, open spines and an outer circuit.
            for(int k=0;k<298;k++)
            {
                float x=Rand(r,-120,120),z=Rand(r,-120,120),rad=Distance(x,z);
                if(rad<26||rad>120||Path(x,z)>.53f||Water(x,z)>.35f){ k--;continue; }
                int district=Sector(x,z);
                string model;
                float roll=(float)r.NextDouble();
                if(district==1) model=roll<.56f?"pine":roll<.72f?"boulder":roll<.82f?"rock":"birch";
                else if(district==2) model=roll<.45f?"birch":roll<.70f?"reed":roll<.90f?"bush":"rock";
                else if(district==3) model=roll<.45f?"rock":roll<.65f?"boulder":roll<.89f?"pine":"birch";
                else model=roll<.62f?"oak":roll<.82f?"birch":roll<.93f?"bush":"rock";
                if(!ClearSite(g,x,z,1.15f))continue;
                Decor(g,model,x,z,Rand(r,.66f,1.23f),WorldYaw(r));
            }
            for(int district=1;district<=4;district++)
            {
                for(int n=0;n<30;n++)
                {
                    float f=Rand(r,26f,109f),side=TrackCenter(f,district)+12f+3f*Sin(f*.102f+district);
                    float x,z;PolarSite(district,f,side+(n%2==0?-1:1)*Rand(r,1.45f,3.25f),out x,out z);
                    if(ClearSite(g,x,z,.37f)) Decor(g,district==2?"reed":"bush",x,z,Rand(r,.83f,1.27f),WorldYaw(r));
                }
            }
            for(int i=0;i<200;i++)
            {
                float x=Rand(r,-118,118),z=Rand(r,-118,118),rad=Distance(x,z);
                if(rad<26||rad>117||Path(x,z)>.8f)continue;
                int d=Sector(x,z); string m=d==2?"reed":i%5==0?"bush":"grass";
                Decor(g,m,x,z,Rand(r,.65f,1.28f),WorldYaw(r));
            }
            for(int i=0;i<42;i++)
            {
                float x=Rand(r,42,109),z=3+Sin(x*.058f)*9+(i%2==0?-1:1)*Rand(r,4,11);
                Decor(g,"reed",x,z,Rand(r,.9f,1.37f),WorldYaw(r));
            }
            string[] material={"branch","stone","fiber","tinder","cloth","scrap"};
            for(int district=1;district<=4;district++)
            for(int n=0;n<10;n++)
            {
                float f=n==0?25f:n==1?32f:Rand(r,35,105);
                float s=n<2?TrackCenter(f,district)+(n==0?3:-3):Rand(r,-.7f*f,.7f*f);
                float bx,bz;PolarSite(district,f,s,out bx,out bz);
                for(int j=0;j<6;j++)
                {
                    float x=bx,z=bz;
                    for(int a=0;a<8;a++){float angle=Rand(r,0,6.28f),d=Rand(r,1.3f,5.1f);x=bx+Sin(angle)*d;z=bz+Cos(angle)*d;if(ClearSite(g,x,z,.28f))break;}
                    if(ClearSite(g,x,z,.22f))Drop(g,material[j],(j==0?4:j==1?4:j==2?3:j==3?2:1),x,z);
                }
            }
            for(int district=1;district<=4;district++)
            for(int j=0;j<8;j++)
            {
                for(int attempt=0;attempt<26;attempt++)
                {
                    float f=Rand(r,38,104),x,z;
                    PolarSite(district,f,Rand(r,-f*.36f,f*.38f),out x,out z);
                    if(!ClearSite(g,x,z,.52f))continue;
                    string species=j<2?"hare":district==2?(j%4==0?"grazer":"hen"):j%4==0?"hen":j%3==0?"hare":"grazer";
                    g.Animals.Add(new Animal{Model=species,X=x,Y=Ground(g,x,z),Z=z,Yaw=WorldYaw(r),HP=species=="grazer"?52:species=="hen"?16:17,Timer=Rand(r,.8f,7f),Anim=Rand(r,0,6)});break;
                }
            }
            Random innerRandom=g.Rng;
            try{g.Rng=new Random(unchecked(g.Seed^0x413a271));PopulateOuter(g,g.Rng);}
            finally{g.Rng=innerRandom;}
        }
        static bool OuterSite(Game g,float x,float z,float spacing)
        {
            float rr=x*x+z*z;
            return rr>=121*121 && rr<(Radius-3)*(Radius-3) && Water(x,z)<.32f &&
                CanStand(g,x,Ground(g,x,z)+.025f,z,spacing,1.6f);
        }
        static void PopulateOuter(Game g,Random r)
        {
            // Each river has a dry timber crossing on the main spoke, and two shallow
            // gravel fords on other routes. The bridge stays level from bank to bank.
            int[] streamDistricts={1,3,4};
            foreach(int district in streamDistricts)
            {
                float x,z,level; StreamPoint(district,0,out x,out level,out z);
                float yaw=district==1?1.5707963f:0f,sx=Sin(yaw),sz=Cos(yaw);
                for(int i=0;i<2;i++)
                {
                    float off=(i-.5f)*4.91f;
                    Decor(g,"bridge",x+sx*off,z+sz*off,1,yaw,level+.32f);
                }
                // A broken arcade over a stream, with clear passages between its piers.
                if(district!=4)
                {
                    StreamPoint(district,65,out x,out level,out z);
                    Decor(g,"aqueduct",x,z,1,district==1?0:1.5707963f,level-.38f);
                }
                for(int j=0;j<60;j++)
                {
                    float v=Rand(r,-96,96);if(Math.Abs(v)<4.4f)continue;
                    StreamPoint(district,v,out x,out level,out z);
                    float bank=(j%2==0?-1:1)*Rand(r,3.3f,6.8f);
                    if(district==1)x+=bank;else z+=bank;
                    float rr=x*x+z*z;if(rr>(Radius-3)*(Radius-3)||Path(x,z)>.78f)continue;
                    string plant=j%7==0?"shore_rocks":j%4==0?"flowers":"rushes";
                    Decor(g,plant,x,z,Rand(r,.67f,1.23f),WorldYaw(r));
                }
            }
            for(int district=1;district<=4;district++)
            {
                float hx,hz;HuntingGround(district,out hx,out hz);
                float wx,wz;PolarSite(district,190,district%2==0?-19:29,out wx,out wz);
                Decor(g,"watchtower",wx,wz,1,WorldYaw(r));
                if(district==2)Decor(g,"floodgate",160,-16,1,.94f);
                // An open feeding meadow with bordering browse and a long, covered return trail.
                for(int j=0;j<44;j++)
                {
                    float a=WorldYaw(r),d=Rand(r,10.7f,22f),x=hx+Sin(a)*d,z=hz+Cos(a)*d;
                    if(!OuterSite(g,x,z,.66f)||Path(x,z)>.8f)continue;
                    string m=j%8==0?"birch":j%5==0?"flowers":district==2?"reed":"bush";
                    Decor(g,m,x,z,Rand(r,.65f,1.34f),WorldYaw(r));
                }
                for(int j=0;j<260;j++)
                {
                    float f=Rand(r,94,200),lateral=Rand(r,-f*.99f,f*.99f),x,z;PolarSite(district,f,lateral,out x,out z);
                    if(!OuterSite(g,x,z,.68f)||Path(x,z)>.70f||Game.Distance(x,z,hx,hz)<10.3f)continue;
                    float roll=(float)r.NextDouble();string model;
                    if(district==1)model=roll<.60f?"pine":roll<.74f?"boulder":roll<.9f?"bush":"birch";
                    else if(district==2)model=roll<.41f?"birch":roll<.76f?"reed":roll<.90f?"bush":"rock";
                    else if(district==3)model=roll<.38f?"rock":roll<.57f?"boulder":roll<.77f?"pine":roll<.88f?"birch":"flowers";
                    else model=roll<.56f?"oak":roll<.72f?"birch":roll<.87f?"bush":"flowers";
                    Decor(g,model,x,z,Rand(r,.71f,1.39f),WorldYaw(r));
                }
                for(int j=0;j<9;j++)
                {
                    float bx,bz;PolarSite(district,Rand(r,126,187),Rand(r,-58,58),out bx,out bz);
                    string[] items={"branch","stone","fiber","tinder",j%2==0?"cloth":"scrap"};
                    foreach(string id in items)
                    {
                        float x=bx+Rand(r,-3.3f,3.3f),z=bz+Rand(r,-3.3f,3.3f);
                        if(OuterSite(g,x,z,.26f))Drop(g,id,id=="branch"?4:id=="stone"?5:id=="fiber"?3:2,x,z);
                    }
                }
                for(int j=0;j<7;j++)
                {
                    for(int t=0;t<18;t++)
                    {
                        float a=WorldYaw(r),d=Rand(r,2,17),x=hx+Sin(a)*d,z=hz+Cos(a)*d;
                        if(!OuterSite(g,x,z,.47f))continue;
                        string m=j%4==0?"hare":district==2&&j%3!=0?"hen":j%3==0?"hen":"grazer";
                        g.Animals.Add(new Animal{Model=m,X=x,Y=Ground(g,x,z),Z=z,Yaw=WorldYaw(r),HP=m=="grazer"?52:m=="hare"?17:16,Timer=Rand(r,.8f,6f),Anim=WorldYaw(r)});break;
                    }
                }
            }
        }
    }
}
