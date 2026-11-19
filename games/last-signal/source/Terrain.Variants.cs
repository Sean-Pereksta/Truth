using System;

namespace LastSignal
{
    public static partial class Arena
    {
        static readonly string[] GorgeZones={"Cornucopia Plaza","Needle Canyon","Copperwash Oasis","The Step Mesas","Juniper Shelf"};
        static readonly string[] PassZones={"Cornucopia Plaza","Firline Ridge","Meltwater Basin","Blueglass Cirque","The High Saddle"};
        static readonly string[] GorgeWater={"","Needle Creek","Copperwash Oasis","Ochre Fork","Juniper Run"};
        static readonly string[] PassWater={"","Firline Beck","Meltwater Basin","Glasswater","Snowmelt Run"};

        static float BasinLine(float x)
        {
            return Variant==1?8+18*Sin(x*.038f-.95f)+6*Sin(x*.087f): -8+18*Sin(x*.032f+.45f)-7*Cos(x*.075f);
        }
        static float BasinWidth(float x)
        {
            return Variant==1?3.2f+5.7f*(1-Smooth(2,29,Math.Abs(x-112))):
                4.4f+7.2f*(1-Smooth(1,31,Math.Abs(x-147)));
        }
        static float BasinLevel(float x){return (Variant==1?-.92f:1.82f)-.012f*(x-65);}
        static float AltPathCenter(float f,int sector){
            return TrackCenter(f,sector)+(Variant==1?-1:1)*(16+5*Sin(f*.065f+sector));
        }
        static float VariantPath(float x,float z,float rad,float f,float s,int district)
        {
            float main=1-Smooth(2.0f,5.5f,Math.Abs(s-TrackCenter(f,district)));
            float side=.88f*(1-Smooth(1.0f,2.95f,Math.Abs(s-AltPathCenter(f,district))));
            float ring=Variant==1?78+14*Sin(x*.034f)+9*Cos(z*.031f):98+18*Sin(x*.024f-z*.032f);
            float crossway=.84f*(1-Smooth(1.4f,4,Math.Abs(rad-ring)));
            float outer=.67f*(1-Smooth(1.15f,3.8f,Math.Abs(rad-(169+10*Sin(x*.032f+z*.019f)))));
            return Math.Max(Math.Max(main,side),Math.Max(crossway,outer));
        }
        static float Profile(float x,float z,float cx,float cz,float w,float d)
        {
            float u=(x-cx)/w,v=(z-cz)/d;return (float)Math.Sqrt(u*u+v*v);
        }
        static float VariantHeight(float x,float z,float rad,float path)
        {
            int sector=Sector(x,z);float s=sector<3?z:x,f=sector<3?Math.Abs(x):Math.Abs(z);
            float rim=Smooth(188,230,rad);
            float rough=(Sin(x*.091f+z*.031f)*Cos(z*.101f-x*.021f)+.5f*Sin(x*.151f-z*.079f));
            float land;
            if(Variant==1)
            {
                // The gorge is cut between two long sandstone benches, with
                // breaks at parallel switchbacks and an exposed perimeter shelf.
                float line=TrackCenter(f,sector),right=s-line;
                float shelf=Smooth(12,24,Math.Abs(right))*Smooth(34,76,f);
                float west=sector==1?1f:.46f,north=sector==3?1f:.42f;
                float mesas=1-Smooth(.57f,1.08f,Profile(x,z,-91,59,43,35));
                mesas+=1-Smooth(.55f,1.06f,Profile(x,z,62,-119,43,36));
                mesas+=1-Smooth(.58f,1.1f,Profile(x,z,37,131,33,48));
                float levels=Smooth(0,.37f,mesas)*2.6f+Smooth(.38f,.62f,mesas)*4.2f+Smooth(.66f,.94f,mesas)*4.1f;
                land=.8f+rough*(1.55f-.62f*path)+shelf*(4.1f*west+2.4f*north)+levels;
                land+=Smooth(65,144,f)*(sector==3?2.6f:1.3f)+rim*(8+5*Sin(x*.057f+z*.019f));
            } else {
                // Broad U-shaped alpine valleys meet at the arena. A traversable
                // saddle cuts each ridge and the north opens into a glacial bowl.
                float ridge=Math.Abs(s-TrackCenter(f,sector));
                float mountain=Smooth(8,45,ridge)*Smooth(30,96,f);
                float notch=1-Smooth(10,32,Math.Abs(rad-(104+14*Sin(x*.027f-z*.041f))));
                float peaks=9*(1-Smooth(.08f,1.10f,Profile(x,z,-86,-73,37,49)));
                peaks+=16*(1-Smooth(.1f,1.12f,Profile(x,z,73,-126,45,48)));
                peaks+=13*(1-Smooth(.12f,1.14f,Profile(x,z,-73,132,40,42)));
                float northBowl=sector==3?3.1f*Smooth(62,115,f)*(1-Smooth(12,40,Math.Abs(s+9))):0;
                land=2.35f+.99f*rough+Smooth(32,166,rad)*4+mountain*(9.5f-5.2f*notch)+peaks-northBowl;
                land+=rim*(12+6*Cos(x*.043f-z*.03f));
            }
            if(sector==2&&x>33)
            {
                float offset=Math.Abs(z-BasinLine(x)),w=BasinWidth(x),m=offset-w;
                float ford=Math.Min(Math.Abs(x-91),Math.Abs(x-156));
                float depth=.17f+1.12f*Smooth(2,9,ford);
                float bed=m<0?BasinLevel(x)-depth*(1-Smooth(.18f,1,offset/w)):BasinLevel(x)+Math.Min(2.2f,m*.31f);
                land+=(bed-land)*(1-Smooth(4,20,m))*Smooth(33,46,x);
            }
            if(sector!=2&&f>105&&f<197&&Math.Abs(s)<117)
            {
                float dist,w,level,depth;StreamMetric(sector,f,s,out dist,out w,out level,out depth);
                float m=dist-w;
                float bed=m<0?level-depth*(1-Smooth(.18f,1,dist/w)):level+Math.Min(1.9f,m*.28f);
                land+=(bed-land)*(1-Smooth(4.1f,19,m));
            }
            return land*Smooth(22,46,rad);
        }
    }
}
