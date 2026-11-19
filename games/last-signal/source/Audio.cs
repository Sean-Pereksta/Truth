using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;

namespace LastSignal {
    // Four short stereo buffers let the native mixer overlap directional cues without
    // depending on a media player or dropping the previous sound on each footstep.
    sealed class ArenaAudio : IDisposable {
        [StructLayout(LayoutKind.Sequential,Pack=2)] struct Format {public ushort tag,channels; public uint rate,bytes;public ushort align,bits,extra;}
        [StructLayout(LayoutKind.Sequential)] struct Header {public IntPtr data;public uint size,done;public UIntPtr user;public uint flags,loops;public IntPtr next;public UIntPtr reserved;}
        [DllImport("winmm.dll")]static extern int waveOutOpen(out IntPtr handle,uint device,ref Format format,IntPtr callback,IntPtr instance,uint flags);
        [DllImport("winmm.dll")]static extern int waveOutPrepareHeader(IntPtr dev,IntPtr header,int size);
        [DllImport("winmm.dll")]static extern int waveOutWrite(IntPtr dev,IntPtr header,int size);
        [DllImport("winmm.dll")]static extern int waveOutUnprepareHeader(IntPtr dev,IntPtr header,int size);
        [DllImport("winmm.dll")]static extern int waveOutReset(IntPtr dev);
        [DllImport("winmm.dll")]static extern int waveOutClose(IntPtr dev);
        enum Family { Steps, Pickup, Windup, Contact, Guard, Signal, World }
        sealed class Voice{
            public short[] data; public float l,r,priority,pan;
            public int pos; public string name; public Family family;
            public float Score { get{return priority*(1-.55f*pos/(float)data.Length);} }
        }
        class Buffer{public IntPtr data,header;public bool used;}
        readonly Dictionary<string,short[]> samples=new Dictionary<string,short[]>();
        readonly List<Voice> voices=new List<Voice>();
        readonly List<Buffer> buffers=new List<Buffer>();readonly short[] mix=new short[1024];
        const int VoiceLimit=14; float mixGain=1;
        readonly int hs=Marshal.SizeOf(typeof(Header)); IntPtr dev;int amb;bool muted;
        readonly string[] loops={"stream","camp","rain","storm"};
        readonly float[] left=new float[4],right=new float[4],targetL=new float[4],targetR=new float[4];
        readonly int[] at=new int[4];readonly short[][] beds=new short[4][];float sampled=-50;
        public ArenaAudio():this(true){}
        internal ArenaAudio(bool openDevice){
            string path=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"Assets","Audio");
            if(Directory.Exists(path))foreach(string f in Directory.GetFiles(path,"*.wav")){
                byte[] b=File.ReadAllBytes(f);
                if(b.Length<46)continue;
                short[] sample=new short[(b.Length-44)/2];
                System.Buffer.BlockCopy(b,44,sample,0,sample.Length*2);
                samples[Path.GetFileNameWithoutExtension(f)]=sample;
            }
            for(int i=0;i<loops.Length;i++)samples.TryGetValue(loops[i],out beds[i]);
            if(!openDevice)return;
            var form=new Format{tag=1,channels=2,rate=22050,bits=16,bytes=88200,align=4};
            if(waveOutOpen(out dev,0xffffffff,ref form,IntPtr.Zero,IntPtr.Zero,0)!=0){dev=IntPtr.Zero;muted=true;return;}
            for(int i=0;i<4;i++){var b=new Buffer{data=Marshal.AllocHGlobal(mix.Length*2),header=Marshal.AllocHGlobal(hs)};
                Marshal.StructureToPtr(new Header{data=b.data,size=(uint)(mix.Length*2)},b.header,false);
                int ok=waveOutPrepareHeader(dev,b.header,hs);if(ok!=0){Marshal.FreeHGlobal(b.data);Marshal.FreeHGlobal(b.header);break;}buffers.Add(b);}
        }
        static Family Group(string name){
            switch(name){
                case "step":case "splash":case "plank_step":return Family.Steps;
                case "equip":return Family.Pickup;
                case "swing":case "thrust":case "cast":case "release":return Family.Windup;
                case "hit":case "hit_light":case "hit_heavy":case "thrust_hit":case "thrust_heavy":
                case "woven_hit":case "plated_hit":case "wood":case "timber_break":case "timber_fall":return Family.Contact;
                case "guard":case "parry":return Family.Guard;
                case "horn":case "start":case "victory":case "warning":case "cannon":return Family.Signal;
                default:return Family.World;
            }
        }
        static int FamilyLimit(Family group){
            switch(group){
                case Family.Steps:return 3;
                case Family.Windup:case Family.Contact:return 4;
                case Family.Signal:return 3;
                default:return 2;
            }
        }
        static float LevelFor(Family group){
            switch(group){case Family.Steps:return .23f;case Family.Windup:return .43f;case Family.Signal:return .53f;case Family.World:return .33f;default:return .54f;}
        }
        public void Cue(string name,float vol,float pan){
            if(muted)return;
            bool focus=name.StartsWith("focus_",StringComparison.Ordinal);if(focus)name=name.Substring(6);
            short[] sample;if(vol<.018f||!samples.TryGetValue(name,out sample))return;
            vol=Math.Min(1,vol);pan=Math.Max(-1,Math.Min(1,pan));
            Family group=Group(name);
            float priority=vol+(focus?2.35f:0);
            if(name=="horn"||name=="victory")priority+=3.0f;
            else if(group==Family.Signal)priority+=.73f;
            else if(group==Family.Contact||group==Family.Guard)priority+=.25f;
            int weakest=-1,groupWeakest=-1,inGroup=0;
            for(int i=0;i<voices.Count;i++){
                Voice v=voices[i];if(weakest<0||v.Score<voices[weakest].Score)weakest=i;
                if(v.family!=group)continue;
                ++inGroup;if(groupWeakest<0||v.Score<voices[groupWeakest].Score)groupWeakest=i;
                // Simultaneous raiders on one side of the listener share a transient.
                if(v.name==name&&v.pos<760&&Math.Abs(v.pan-pan)<.31f){
                    if(priority<=v.priority+.02f)return;
                    groupWeakest=i;inGroup=FamilyLimit(group);break;
                }
            }
            int replace=inGroup>=FamilyLimit(group)?groupWeakest:voices.Count>=VoiceLimit?weakest:-1;
            if(replace>=0){if(priority<voices[replace].Score)return;voices.RemoveAt(replace);}
            float gain=vol*LevelFor(group)*(focus?1.27f:1);if(name=="cannon")gain*=.63f;
            voices.Add(new Voice{data=sample,l=gain*(1-.75f*Math.Max(0,pan)),r=gain*(1+.75f*Math.Min(0,pan)),
                priority=priority,pan=pan,name=name,family=group});
        }
        void Level(Game g,int layer,float x,float z,float reach,float volume){
            float dx=x-g.CamX,dz=z-g.CamZ,d=Game.Distance(x,z,g.CamX,g.CamZ);
            float pan=d<.5f?0:(dx*(float)Math.Cos(g.CamYaw)-dz*(float)Math.Sin(g.CamYaw))/d;
            float level=Math.Max(0,1-d/reach)*volume;
            targetL[layer]=level*(1-.58f*Math.Max(0,pan));targetR[layer]=level*(1+.58f*Math.Min(0,pan));
        }
        public void Environment(Game g){
            if(dev==IntPtr.Zero||Math.Abs(g.Clock-sampled)<.22f)return;sampled=g.Clock;
            float best=31,bx=g.CamX,bz=g.CamZ;
            for(int k=0;k<4;k++)for(int i=0;i<12;i++){
                float rad=k==0?0:k==1?5:k==2?13:23;double dir=i*Math.PI/6;
                float x=g.CamX+rad*(float)Math.Sin(dir),z=g.CamZ+rad*(float)Math.Cos(dir);
                if(rad<best&&Arena.Surface(x,z,g.Flood)>Arena.Height(x,z)+.04f){best=rad;bx=x;bz=z;}
            }
            foreach(Prop p in g.Props)if(p.Model=="spring"&&!p.Removed){
                float d=Game.Distance(p.X,p.Z,g.CamX,g.CamZ);
                if(d<best&&d<12){best=d;bx=p.X;bz=p.Z;}
            }
            Level(g,0,bx,bz,28,best<30?.45f:0);
            best=18;bx=g.CamX;bz=g.CamZ;
            foreach(Prop p in g.Props)if(p.Lit&&!p.Removed){float d=Game.Distance(p.X,p.Z,g.CamX,g.CamZ);if(d<best){best=d;bx=p.X;bz=p.Z;}}
            Level(g,1,bx,bz,18,best<18?.41f:0);
            targetL[2]=targetR[2]=g.Rain?.19f:0;
            float margin=g.StormMargin(g.CamX,g.CamZ);
            float near=g.StormActive?Math.Max(0,Math.Min(1,1-margin/36f)):0;
            targetL[3]=targetR[3]=near*(.13f+.15f*g.StormStrength);
        }
        internal void MixBlock(short[] output){
            short[] wind;samples.TryGetValue("forest",out wind);
            for(int i=0;i<output.Length;i+=2){
                float l=0,r=0;
                if(wind!=null){l=r=wind[amb++]*.15f;if(amb>=wind.Length)amb=0;}
                for(int k=0;k<beds.Length;k++)if(beds[k]!=null){
                    left[k]+=(targetL[k]-left[k])*.00013f;right[k]+=(targetR[k]-right[k])*.00013f;
                    float s=beds[k][at[k]++];if(at[k]>=beds[k].Length)at[k]=0;l+=s*left[k];r+=s*right[k];
                }
                for(int j=voices.Count-1;j>=0;j--){
                    Voice v=voices[j];float sample=v.data[v.pos++];l+=sample*v.l;r+=sample*v.r;
                    if(v.pos==v.data.Length)voices.RemoveAt(j);
                }
                // A linked stereo limiter preserves direction and avoids flattening close transients.
                float peak=Math.Max(Math.Abs(l),Math.Abs(r));
                float target=peak>29700f?29700f/peak:1f;
                if(target<mixGain)mixGain=target;else mixGain=Math.Min(target,mixGain+(1f-mixGain)*.0012f);
                output[i]=(short)(l*mixGain);output[i+1]=(short)(r*mixGain);
            }
        }
        public void Pump(){
            if(dev==IntPtr.Zero)return;
            foreach(Buffer b in buffers){
                Header h=(Header)Marshal.PtrToStructure(b.header,typeof(Header));if(b.used&&(h.flags&1)==0)continue;
                MixBlock(mix);
                Marshal.Copy(mix,0,b.data,mix.Length);waveOutWrite(dev,b.header,hs);b.used=true;
            }
        }
        public void Dispose(){if(dev==IntPtr.Zero)return;waveOutReset(dev);foreach(Buffer b in buffers){waveOutUnprepareHeader(dev,b.header,hs);Marshal.FreeHGlobal(b.header);Marshal.FreeHGlobal(b.data);}waveOutClose(dev);dev=IntPtr.Zero;}
    }
}

