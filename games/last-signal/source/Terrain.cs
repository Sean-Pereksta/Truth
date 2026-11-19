using System;

namespace LastSignal
{
    public static partial class Arena
    {
        public const float Radius = 205f;
        const int Extent = 238, Side = 2 * Extent + 1;
        static readonly float[][] elevations=new float[3][], routes=new float[3][];
        static float[] elevation,tracks;
        public static int Variant {get;private set;}
        static Arena(){Select(0);}
        public static string NameOf(int id){return id==1?"Redstone Gorge":id==2?"Frostveil Pass":"Crownwood Basin";}
        public static void Select(int id)
        {
            id=Math.Max(0,Math.Min(2,id));
            if(elevation!=null&&Variant==id)return;
            Variant=id;
            if(elevations[id]!=null){elevation=elevations[id];tracks=routes[id];return;}
            elevation=elevations[id]=new float[Side*Side];tracks=routes[id]=new float[Side*Side];
            for (int z = -Extent; z <= Extent; ++z)
            for (int x = -Extent; x <= Extent; ++x)
            {
                int i=(z+Extent)*Side+x+Extent;
                float r=Distance(x,z);
                float track=PathFormula(x,z,r);
                tracks[i]=track;
                elevation[i]=HeightFormula(x,z,r,track);
            }
        }
        static float Distance(float x,float z) { return (float)Math.Sqrt(x*x+z*z); }
        static float Clamp01(float t) { return Math.Max(0f,Math.Min(1f,t)); }
        static float Smooth(float a,float b,float t)
        {
            t=Clamp01((t-a)/(b-a)); return t*t*(3f-2f*t);
        }
        static float Sin(float v) { return (float)Math.Sin(v); }
        static float Cos(float v) { return (float)Math.Cos(v); }
        static float TrackCenter(float forward,int district)
        {
            if(Variant==1)return (14.5f*Sin(forward*.057f+district*.61f)+5.5f*Sin(forward*.103f-district))*Smooth(17,53,forward);
            if(Variant==2)return (21f*Sin(forward*.032f+district*1.35f)+6.5f*Cos(forward*.081f-district))*Smooth(19,68,forward);
            return (4.9f*Sin(forward*.072f+district*.72f)+2.2f*Sin(forward*.157f-district)) * Smooth(16,43,forward);
        }
        static float PathFormula(float x,float z,float r)
        {
            if(r<20) return 0f;
            bool ew=Math.Abs(x)>Math.Abs(z);
            float f=ew?Math.Abs(x):Math.Abs(z), s=ew?z:x;
            int district=Sector(x,z);
            if(Variant!=0)return VariantPath(x,z,r,f,s,district);
            float reference=TrackCenter(f,district);
            float d=Math.Abs(s-reference);
            float winding=reference+12f+3f*Sin(f*.102f+district);
            float ringD=Math.Abs(r-(60+3f*Sin(x*.055f)+2f*Cos(z*.081f)));
            float outerD=Math.Abs(r-(94+3.5f*Sin(z*.063f)));
            float broad=1f-Smooth(2.5f,5.9f,d);
            float narrow=1f-Smooth(.85f,2.4f,Math.Abs(s-winding));
            float ring=1f-Smooth(1.1f,3.1f,ringD);
            float network=Math.Max(Math.Max(broad,.75f*narrow), Math.Max(.90f*ring,.66f*(1f-Smooth(1.0f,2.7f,outerD))));
            if(r>110)
            {
                float outerRing=Math.Abs(r-(173+6f*Sin(x*.036f)+3f*Cos(z*.043f)));
                network=Math.Max(network,.78f*(1f-Smooth(1.3f,4.0f,outerRing)));
            }
            return network;
        }
        static float HeightFormula(float x,float z,float r,float track)
        {
            if(Variant!=0)return VariantHeight(x,z,r,track);
            float fade=Smooth(22,41,r), rough=(Sin(x*.085f+z*.031f)*Cos(z*.092f)+.50f*Sin(x*.173f-z*.072f))*(1.25f-.5f*track);
            float ridge=Smooth(18,68,-x)*Smooth(-22,19,-x-Math.Abs(z)*.66f);
            float terrace=Smooth(15,69,-z)*Smooth(-19,15,-z-Math.Abs(x)*.58f);
            float grove=Smooth(17,64,z)*Smooth(-22,21,z-Math.Abs(x)*.68f);
            float basin=Smooth(20,58,x)*Smooth(-15,20,x-Math.Abs(z)*.70f);
            float channel=z-(3f+Sin(x*.058f)*9f);
            float bank=(1f-Smooth(4,16,Math.Abs(channel)));
            float terraced=1.55f*Smooth(42,47,-z)+1.82f*Smooth(62,69,-z)+2.15f*Smooth(83,89,-z);
            float foothills=ridge*(4.0f+4.8f*Sin(z*.051f+x*.032f)+2.25f*Cos(x*.088f));
            float ground=rough+foothills+terrace*(terraced+1f)+grove*(1.9f+1.7f*Sin(x*.055f));
            ground+=basin*(-1.50f-2.25f*bank+.54f*Cos(z*.15f));
            float edge=Smooth(202,225,r)*(6.0f+3.2f*Sin(x*.071f+z*.039f));
            float land=fade*ground+edge;
            if(r>111f)
            {
                float u,v;
                int district=WaterDistrict(x,z,out u,out v);
                if(district!=2 && u>106 && u<195 && Math.Abs(v)<117)
                {
                    float distance,width,level,depth;StreamMetric(district,u,v,out distance,out width,out level,out depth);
                    float margin=distance-width;
                    float target=margin<0?level-depth*(1-Smooth(.18f,1f,distance/width)):level+Math.Min(1.95f,margin*.30f);
                    land+=(target-land)*(1f-Smooth(4f,16f,margin));
                }
            }
            return land;
        }
        static float Sample(float[] data,float x,float z)
        {
            x=Math.Max(0,Math.Min(Side-1.001f,x+Extent)); z=Math.Max(0,Math.Min(Side-1.001f,z+Extent));
            int ix=(int)x, iz=(int)z, i=iz*Side+ix; float u=x-ix,v=z-iz;
            return (1-v)*(data[i]+(data[i+1]-data[i])*u)+v*(data[i+Side]+(data[i+Side+1]-data[i+Side])*u);
        }
        public static float Height(float x,float z) { return Sample(elevation,x,z); }
        public static float Path(float x,float z) { return Sample(tracks,x,z); }
        static int Sector(float x,float z)
        {
            if(Math.Abs(x)>Math.Abs(z)) return x<0?1:2;
            return z<0?3:4;
        }
        public static int ZoneIndex(float x,float z) { return x*x+z*z<22f*22f?0:Sector(x,z); }
        public static string Zone(float x,float z)
        {
            if(Variant==1)return GorgeZones[ZoneIndex(x,z)];
            if(Variant==2)return PassZones[ZoneIndex(x,z)];
            switch(ZoneIndex(x,z)) { case 1:return "Forest Ridge"; case 2:return "Reed Basin"; case 3:return "Stone Terraces"; case 4:return "Outer Groves"; default:return "Cornucopia Plaza"; }
        }
        public static float Water(float x,float z)
        {
            return Math.Max(0f,Surface(x,z,false)-Height(x,z));
        }
        static int WaterDistrict(float x,float z,out float forward,out float along)
        {
            int district=Sector(x,z);bool ew=district<3;
            forward=ew?Math.Abs(x):Math.Abs(z);along=ew?z:x;return district;
        }
        static float StreamCenter(int district,float v)
        {
            if(Variant==1)return (district==1?127:district==3?164:143)+11*Sin(v*.044f+district*.9f)+4.2f*Cos(v*.088f);
            if(Variant==2)return (district==1?164:district==3?123:155)+8*Sin(v*.058f-district*.7f)+3.6f*Sin(v*.104f+district);
            float phase=district*.78f;
            float reach=district==1?148:district==3?140:154;
            return reach+8.40f*Sin(v*.034f+phase)+4.70f*Sin(v*.084f-phase)+1.50f*Cos(v*.136f);
        }
        // A gently graded catchment with two shallow fords. Bank elevation is blended back
        // into each district's native terrain, so the water sits inside the channel.
        static void StreamMetric(int district,float u,float v,out float dist,out float width,out float level,out float depth)
        {
            float clamped=Math.Max(-96f,Math.Min(96f,v)),offset=u-StreamCenter(district,clamped),end=v-clamped;
            dist=end==0?Math.Abs(offset):Distance(offset,end);
            width=3.10f+.54f*Sin(clamped*.127f+district)+.28f*Cos(clamped*.047f+district);
            level=(district==1?3.8f:district==3?5.40f:1.08f)+clamped*(district==4?.0065f:-.008f);
            float ford=Math.Min(Math.Abs(v-38f),Math.Abs(v+46f));
            depth=.17f+(.99f+.30f*Sin(v*.076f+district))*Smooth(2.5f,8f,ford);
            if(Variant==1){width=2.4f+.90f*(.5f+.5f*Sin(v*.085f));level=(district==1?2.9f:district==3?7.7f:3.4f)-.013f*clamped;depth*=1.13f;}
            else if(Variant==2){width=3.2f+.66f*Cos(v*.09f+district);level=(district==1?7.8f:district==3?3.4f:6.1f)-.014f*clamped;depth*=.92f;}
        }
        public static void StreamPoint(int district,float along,out float x,out float level,out float z)
        {
            float v=Math.Max(-96f,Math.Min(96f,along)),u=StreamCenter(district,v);
            float distance,width,depth;StreamMetric(district,u,v,out distance,out width,out level,out depth);
            PolarSite(district,u,v,out x,out z);
        }
        public static float Surface(float x,float z,bool flood)
        {
            float u,v;int district=WaterDistrict(x,z,out u,out v);
            if(district==2){
                if(Variant!=0)return x>=38f&&Math.Abs(z-BasinLine(x))<BasinWidth(x)+6f?BasinLevel(x)+(flood?.85f:0):-10000f;
                return x>=35f && Math.Abs(z)<=x*.84f ? (flood?-1.41f:-2.26f):-10000f;
            }
            if(u<106||u>195||Math.Abs(v)>117)return -10000f;
            float d,w,h,b;StreamMetric(district,u,v,out d,out w,out h,out b);
            return d<w+4.1f?h:-10000f;
        }
        public static string WaterName(float x,float z)
        {
            if(Variant==1)return GorgeWater[Sector(x,z)];
            if(Variant==2)return PassWater[Sector(x,z)];
            switch(Sector(x,z)){case 1:return "Alder Run";case 3:return "Terrace Beck";case 4:return "Willow Brook";default:return "Reed Basin";}
        }
        public static void HuntingGround(int district,out float x,out float z)
        {
            if(Variant==1){PolarSite(district,district==1?155:district==2?139:district==3?175:163,district==1?-43:district==2?54:district==3?32:-41,out x,out z);return;}
            if(Variant==2){PolarSite(district,district==1?173:district==2?158:district==3?149:181,district==1?32:district==2?-48:district==3?-41:13,out x,out z);return;}
            if(district==1){x=-168;z=25;}else if(district==2){x=164;z=36;}
            else if(district==3){x=-26;z=-166;}else{x=22;z=165;}
        }
    }
}
