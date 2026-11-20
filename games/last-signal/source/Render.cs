using System;
using System.IO;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

namespace LastSignal
{
    // Use the Windows OpenGL driver when available. Both graphics drivers share the same scene and assets.
    public sealed partial class Renderer : IDisposable
    {
        [StructLayout(LayoutKind.Sequential)]
        struct PixelFormatDescriptor
        {
            public ushort size,version;
            public uint flags;
            public byte type,color,red,redShift,green,greenShift,blue,blueShift,alpha,alphaShift,accum,accumRed,accumGreen,accumBlue,accumAlpha,depth,stencil,aux,layer,reserved;
            public uint layerMask,visibleMask,damageMask;
        }
        [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr window);
        [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr window,IntPtr dc);
        [DllImport("gdi32.dll")] static extern int ChoosePixelFormat(IntPtr dc,ref PixelFormatDescriptor p);
        [DllImport("gdi32.dll")] static extern bool SetPixelFormat(IntPtr dc,int i,ref PixelFormatDescriptor p);
        [DllImport("gdi32.dll")] static extern bool SwapBuffers(IntPtr dc);

        const uint Texture=0x0DE1,Depth=0x0B71,Light=0x0B50,Light0=0x4000,Light1=0x4001,Fog=0x0B60,Blend=0x0BE2;
        const uint Modelview=0x1700,Projection=0x1701,Triangles=4,Strip=5,Fan=6,Quads=7,Lines=1;
        const float Deg=57.2957795f,Pi=(float)Math.PI,Tau=2*Pi;
        readonly IntPtr window,dc,rc;
        readonly Dictionary<string,Model> models=new Dictionary<string,Model>(StringComparer.OrdinalIgnoreCase);
        class Part {
            public string id; public int parent; public float x,y,z; public uint draw,shape;
            public List<Part> children=new List<Part>();
        }
        class Model { public List<Part> roots=new List<Part>(); public uint entire,preview; }
        readonly string assets;
        int w,h,maxTex;
        uint ground,soil,stone,sky,paint,terrain,skySphere,arenaTrim,overlayTex,flames,smoke;
        public string Driver {get; private set;}
        public Renderer(IntPtr window)
        {
            this.window=window;
            dc=GetDC(window);
            PixelFormatDescriptor desc=new PixelFormatDescriptor();
            desc.size=(ushort)Marshal.SizeOf(typeof(PixelFormatDescriptor));desc.version=1;
            desc.flags=4|32|1;desc.type=0;desc.color=32;desc.alpha=8;desc.depth=24;
            LoadGraphics(desc);
            int format=chooseSurface(dc,ref desc);
            if(format==0||!setSurface(dc,format,ref desc))throw new InvalidOperationException("Could not initialize the Windows pixel format.");
            rc=wglCreateContext(dc);
            if(rc==IntPtr.Zero||!wglMakeCurrent(dc,rc))throw new InvalidOperationException("Windows could not start an OpenGL context.");
            Driver=Marshal.PtrToStringAnsi(glGetString(0x1F01));
            glGetIntegerv(0x0D33,out maxTex);
            assets=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"Assets");
            ground=LoadTexture("ground.png",true);soil=LoadTexture("soil.png",true);stone=LoadTexture("pavers.png",true);
            sky=LoadTexture("sky.png",false);paint=LoadTexture(File.Exists(Path.Combine(assets,"modelpaint.png"))?"modelpaint.png":"paint.png",true);
            flames=LoadTexture("flame.png",true);smoke=LoadTexture("smoke.png",true);
            LoadModels();BuildGearModels();BuildBowPoses();
            BuildSky();BindArenaMap(Arena.Variant);
            glGenTextures(1,out overlayTex);glBindTexture(Texture,overlayTex);Filter(false);
            glTexImage2D(Texture,0,4,Math.Min(512,maxTex),Math.Min(512,maxTex),0,0x80E1,0x1401,IntPtr.Zero);
            glEnable(Depth);glDepthFunc(0x0203);glEnable(0x0BA1);
            glEnable(0x0B57);glColorMaterial(0x0408,0x1602);glEnable(Light0);
            glLightModelfv(0x0B53,new float[]{.51f,.53f,.55f,1});
            glLightfv(Light0,0x1201,new float[]{.79f,.72f,.57f,1});
            glLightfv(Light0,0x1200,new float[]{.07f,.07f,.065f,1});
        }
        static void Filter(bool mip) {
            glTexParameteri(Texture,0x2801,mip?0x2703:0x2601);
            glTexParameteri(Texture,0x2800,0x2601);
        }
        static int Power(int v,int max) { int n=1;while(n<v && n<max)n*=2;return Math.Min(n,max); }
        uint LoadTexture(string file,bool mip)
        {
            string path=Path.Combine(assets,file);
            uint tex;glGenTextures(1,out tex);glBindTexture(Texture,tex);Filter(mip);
            using(Bitmap source=new Bitmap(path)) {
                int tw=Power(source.Width,maxTex),th=Power(source.Height,maxTex);
                source.RotateFlip(RotateFlipType.RotateNoneFlipY);
                int level=0;
                while(true) {
                    using(Bitmap b=new Bitmap(tw,th,PixelFormat.Format32bppArgb)){
                        using(Graphics pen=Graphics.FromImage(b))
                        using(ImageAttributes edge=new ImageAttributes()){
                            pen.CompositingMode=System.Drawing.Drawing2D.CompositingMode.SourceCopy;
                            pen.InterpolationMode=System.Drawing.Drawing2D.InterpolationMode.HighQualityBilinear;
                            pen.PixelOffsetMode=System.Drawing.Drawing2D.PixelOffsetMode.Half;
                            edge.SetWrapMode(System.Drawing.Drawing2D.WrapMode.TileFlipXY);
                            pen.DrawImage(source,new Rectangle(0,0,tw,th),0,0,source.Width,source.Height,GraphicsUnit.Pixel,edge);
                        }
                        BitmapData data=b.LockBits(new Rectangle(0,0,tw,th),ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb);
                        glTexImage2D(Texture,level,4,tw,th,0,0x80E1,0x1401,data.Scan0);b.UnlockBits(data);
                    }
                    if(!mip||(tw==1&&th==1))break;
                    tw=Math.Max(1,tw/2);th=Math.Max(1,th/2);level++;
                }
            }
            return tex;
        }
        static uint OpenList(){uint n=glGenLists(1);glNewList(n,0x1300);return n;}
        void LoadModels()
        {
            using(BinaryReader b=new BinaryReader(File.OpenRead(Path.Combine(assets,"models.bin")))){
                if(new string(b.ReadChars(4))!="LSM1")throw new InvalidDataException("Invalid arena models.");
                int count=b.ReadInt32();
                for(int m=0;m<count;m++){
                    string id=b.ReadString();int n=b.ReadInt32();
                    Model model=new Model();List<Part> p=new List<Part>();
                    bool placeable=id=="fire"||id=="wall"||id=="gate"||id=="lean_to"||id=="ramp"||id=="barricade"||id=="rain_barrel";
                    for(int j=0;j<n;j++){
                        Part part=new Part{id=b.ReadString(),parent=b.ReadInt32(),x=b.ReadSingle(),y=b.ReadSingle(),z=b.ReadSingle()};
                        int k=b.ReadInt32();
                        if(k<0||k>1000000)throw new InvalidDataException("Invalid model vertex count.");
                        byte[] bytes=b.ReadBytes(k*44);
                        if(bytes.Length!=k*44)throw new EndOfStreamException();
                        if(k>0){
                            part.draw=CompileStream(bytes,k,placeable,out part.shape);
                            if(part.id=="root"&&(id=="bow"||id=="bow_draw1"||id=="bow_draw2")){
                                float[] source=new float[k*11];Buffer.BlockCopy(bytes,0,source,0,bytes.Length);bowSources[id]=source;
                            }
                        }
                        if(id=="contestant"&&part.id=="upperarmL")leftSleeve=part;
                        if(id=="contestant"&&part.id=="upperarmR")rightSleeve=part;
                        if(part.parent<0)model.roots.Add(part);else p[part.parent].children.Add(part);
                        p.Add(part);
                    }
                    model.entire=OpenList();foreach(Part root in model.roots)StaticPart(root,false);glEndList();
                    if(placeable){model.preview=OpenList();foreach(Part root in model.roots)StaticPart(root,true);glEndList();}
                    models.Add(id,model);
                }
            }
        }
        static uint CompileStream(byte[] bytes,int count,bool placeable,out uint shape){
            GCHandle pin=GCHandle.Alloc(bytes,GCHandleType.Pinned);shape=0;
            try{
                IntPtr a=pin.AddrOfPinnedObject();
                glEnableClientState(0x8074);glEnableClientState(0x8075);glEnableClientState(0x8076);glEnableClientState(0x8078);
                glVertexPointer(3,0x1406,44,a);glNormalPointer(0x1406,44,IntPtr.Add(a,12));
                glTexCoordPointer(2,0x1406,44,IntPtr.Add(a,24));glColorPointer(3,0x1406,44,IntPtr.Add(a,32));
                uint draw=OpenList();glDrawArrays(Triangles,0,count);glEndList();
                if(placeable){
                    glDisableClientState(0x8076);glDisableClientState(0x8078);
                    shape=OpenList();glDrawArrays(Triangles,0,count);glEndList();
                }
                glDisableClientState(0x8074);glDisableClientState(0x8075);glDisableClientState(0x8076);glDisableClientState(0x8078);
                return draw;
            }finally{pin.Free();}
        }
        static void StaticPart(Part p,bool preview){
            glPushMatrix();glTranslatef(p.x,p.y,p.z);uint list=preview?p.shape:p.draw;
            if(list!=0)glCallList(list);foreach(Part c in p.children)StaticPart(c,preview);glPopMatrix();
        }
        void Mesh(string id) { Model m;if(models.TryGetValue(id,out m))glCallList(m.entire); }
        static float S(float a){return (float)Math.Sin(a);}static float C(float a){return (float)Math.Cos(a);}
        static float Bound(float t,float lo,float hi){return Math.Max(lo,Math.Min(hi,t));}
        static void UV(float u,float v,float x,float y,float z){glTexCoord2f(u,v);glVertex3f(x,y,z);}
        static void Bind(uint t){glEnable(Texture);glBindTexture(Texture,t);}
        static void Alpha(){glEnable(Blend);glBlendFunc(0x0302,0x0303);}
        static void White(){glColor4f(1,1,1,1);}
        void BuildSky(){
            skySphere=OpenList();Bind(sky);
            for(int j=0;j<22;j++){
                float e0=(90f-117f*j/22f)/Deg,e1=(90f-117f*(j+1)/22f)/Deg;
                glBegin(Strip);
                for(int i=0;i<=80;i++){
                    float a=i*Tau/80;
                    UV(i/80f,1-j/22f,175*S(a)*C(e0),175*S(e0),175*C(a)*C(e0));
                    UV(i/80f,1-(j+1)/22f,175*S(a)*C(e1),175*S(e1),175*C(a)*C(e1));
                }
                glEnd();
            }
            glEndList();
        }
        void BuildTerrain(){
            terrain=OpenList();
            const int step=2;int bound=(int)(Arena.Radius+32f)/step*step;
            Bind(ground);glBegin(Triangles);
            for(int z=-bound;z<bound;z+=step)for(int x=-bound;x<bound;x+=step){
                TerrainCell(x,z,step,0);
            }
            glEnd();
            Bind(soil);Alpha();glDepthMask(0);glBegin(Triangles);
            for(int z=-bound;z<bound;z+=step)for(int x=-bound;x<bound;x+=step){
                if(Arena.Path(x+1,z+1)>.015f||Arena.Path(x,z)>.01f||Arena.Path(x+step,z+step)>.01f)TerrainCell(x,z,step,1);
            }
            glEnd();glDepthMask(1);glDisable(Blend);
            // True circular paving follows the concentric inlays at the edge of the plaza.
            Bind(stone);
            for(int ring=0;ring<11;ring++){
                glBegin(Strip);
                for(int k=0;k<=160;k++){
                    float a=k*Tau/160,sn=S(a),cs=C(a);
                    TV(sn*(ring*2),cs*(ring*2),2);TV(sn*((ring+1)*2),cs*((ring+1)*2),2);
                }
                glEnd();
            }
            glEndList();
        }
        static void TerrainCell(int x,int z,int step,int type){
            TV(x,z,type);TV(x,z+step,type);TV(x+step,z+step,type);
            TV(x,z,type);TV(x+step,z+step,type);TV(x+step,z,type);
        }
        static void TV(float x,float z,int type){
            float y=Arena.Height(x,z);
            glNormal3f((Arena.Height(x-.5f,z)-Arena.Height(x+.5f,z)),1,(Arena.Height(x,z-.5f)-Arena.Height(x,z+.5f)));
            float b=.91f+.043f*S(x*.47f+z*.19f)+.045f*C(z*.24f-x*.15f);
            int zone=Arena.ZoneIndex(x,z);
            if(type==2)glColor3f(b*.97f,b*.99f,b);
            else if(type==1)glColor4f(b,b*.96f,b*.87f,Arena.Path(x,z));
            else if(Arena.Variant!=0)VariantGround(x,z,b,zone);
            else if(zone==1)glColor3f(.62f*b,.77f*b,.57f*b);
            else if(zone==2)glColor3f(.63f*b,.82f*b,.68f*b);
            else if(zone==3)glColor3f(.95f*b,.91f*b,.78f*b);
            else glColor3f(.82f*b,.88f*b,.66f*b);
            float tile=type==2?4:type==1?3.6f:4.6f;UV(x/tile,z/tile,x,y+(type==0?0:.008f),z);
        }
        float floodLevel,previousClock;
        static void Ring(float rad,float width,float y){
            glBegin(Strip);for(int i=0;i<=192;i++){float a=i*Tau/192;glVertex3f(S(a)*rad,y,C(a)*rad);glVertex3f(S(a)*(rad+width),y,C(a)*(rad+width));}glEnd();
        }
        static void Box(float sx,float sy,float sz){
            float x=sx*.5f,y=sy*.5f,z=sz*.5f;
            glBegin(Quads);
            glNormal3f(0,0,1);glVertex3f(-x,-y,z);glVertex3f(x,-y,z);glVertex3f(x,y,z);glVertex3f(-x,y,z);
            glNormal3f(0,0,-1);glVertex3f(-x,-y,-z);glVertex3f(-x,y,-z);glVertex3f(x,y,-z);glVertex3f(x,-y,-z);
            glNormal3f(1,0,0);glVertex3f(x,-y,-z);glVertex3f(x,y,-z);glVertex3f(x,y,z);glVertex3f(x,-y,z);
            glNormal3f(-1,0,0);glVertex3f(-x,-y,-z);glVertex3f(-x,-y,z);glVertex3f(-x,y,z);glVertex3f(-x,y,-z);
            glNormal3f(0,1,0);glVertex3f(-x,y,-z);glVertex3f(-x,y,z);glVertex3f(x,y,z);glVertex3f(x,y,-z);
            glNormal3f(0,-1,0);glVertex3f(-x,-y,-z);glVertex3f(x,-y,-z);glVertex3f(x,-y,z);glVertex3f(-x,-y,z);glEnd();
        }
        void BuildTrim(){
            arenaTrim=OpenList();glDisable(Texture);glDisable(Light);
            glColor3f(.38f,.36f,.28f);Ring(21.1f,.45f,.012f);Ring(15.4f,.18f,.014f);
            glColor3f(.72f,.56f,.30f);Ring(20.94f,.065f,.019f);Ring(15.32f,.05f,.019f);
            for(int i=0;i<24;i++){
                glPushMatrix();glRotatef(i*15,0,1,0);glColor3f(.55f,.45f,.29f);
                glBegin(Quads);glVertex3f(-.048f,.018f,9);glVertex3f(.048f,.018f,9);glVertex3f(.058f,.018f,15.35f);glVertex3f(-.058f,.018f,15.35f);glEnd();
                glPopMatrix();
            }
            // Distant observation towers, perimeter panels and inset signal lamps.
            glEnable(Light);
            const int towers=64;
            for(int i=0;i<towers;i++){
                float a=i*Tau/towers,r=Arena.Radius+7f,cx=S(a)*r,cz=C(a)*r,y=Arena.Height(cx,cz)-1;
                glPushMatrix();glTranslatef(cx,y,cz);glRotatef(a*Deg,0,1,0);
                glColor3f(.29f,.37f,.35f);glPushMatrix();glTranslatef(0,3,0);Box(2.2f,7.7f,2.4f);glPopMatrix();
                glColor3f(.42f,.44f,.38f);glPushMatrix();glTranslatef(0,8.2f,0);Box(1.25f,5.4f,1.4f);glPopMatrix();
                glColor3f(.30f,.36f,.34f);glPushMatrix();glTranslatef(0,10.8f,0);Box(2.7f,1.0f,2.2f);glPopMatrix();
                glDisable(Light);glColor3f(.94f,.76f,.42f);glPushMatrix();glTranslatef(0,10.8f,-1.12f);Box(1.8f,.19f,.06f);glPopMatrix();glEnable(Light);
                glPopMatrix();
            }
            glDisable(Texture);glEnable(Light);
            // Connect the observation pylons around the outer rim. The playable ground ends inside this wall.
            Bind(stone);float edge=Arena.Radius+7f;
            glBegin(Quads);
            for(int i=0;i<256;i++){
                float a=i*Tau/256,b=(i+1)*Tau/256,x0=S(a)*edge,z0=C(a)*edge,x1=S(b)*edge,z1=C(b)*edge;
                float y0=Arena.Height(x0,z0)-.8f,y1=Arena.Height(x1,z1)-.8f;
                glNormal3f(-S(a),0,-C(a));glColor3f(.52f,.58f,.56f);
                UV(0,0,x0,y0,z0);UV(1.25f,0,x1,y1,z1);glColor3f(.67f,.69f,.61f);
                UV(1.25f,1,x1,y1+4.2f,z1);UV(0,1,x0,y0+4.2f,z0);
            }glEnd();
            glEndList();
        }
        float sinView,cosView,sideSlope;
        static readonly float[][] clothLights={
            new float[]{.58f,.50f,.47f,1},new float[]{.41f,.54f,.62f,1},new float[]{.54f,.57f,.40f,1},
            new float[]{.63f,.52f,.36f,1},new float[]{.54f,.45f,.60f,1},new float[]{.42f,.58f,.53f,1}};
        static readonly float[] ambient={.51f,.53f,.55f,1};
        readonly float[] frameAmbient=new float[4], frameSun=new float[4], frameFog=new float[4], costume=new float[4];
        static readonly float[] firePos=new float[4],fireLight={1f,.48f,.15f,1};
        bool Visible(Game g,float x,float z,float radius,float limit)
        {
            float dx=x-g.CamX,dz=z-g.CamZ,d=dx*sinView+dz*cosView;
            return d > -radius-2.2f && d<limit+radius &&
                Math.Abs(dx*cosView-dz*sinView)<Math.Max(0,d)*sideSlope+radius*2+3 &&
                dx*dx+dz*dz<(limit+radius)*(limit+radius);
        }

        static readonly float[] polished={.70f,.56f,.29f,1},matte={0,0,0,1};
        public void Draw(Game g,int width,int height)
        {
            if(width<2||height<2)return;
            BindArenaMap(g.ArenaId);
            w=width;h=height;glViewport(0,0,width,height);
            glClearColor(.46f,.54f,.53f,1);glDepthMask(1);glClear(0x4100);
            glMatrixMode(Projection);glLoadIdentity();
            float aspect=width/(float)height;
            double near=.060,top=near*Math.Tan(Math.PI*g.EffectiveFov()/360);
            sideSlope=(float)(top/near)*aspect*1.14f;
            glFrustum(-top*aspect,top*aspect,-top,top,near,Arena.Radius*2+65);
            glMatrixMode(Modelview);glLoadIdentity();
            glScalef(1,1,-1);glRotatef(g.CamPitch*Deg,1,0,0);glRotatef(-g.CamYaw*Deg,0,1,0);
            sinView=S(g.CamYaw);cosView=C(g.CamYaw);
            glDisable(Blend);glDisable(Depth);glDisable(Fog);glDisable(Light);
            DrawClimateSky(g);
            glEnable(Depth);glTranslatef(-g.CamX,-g.CamY,-g.CamZ);
            glEnable(Light);glLightfv(Light0,0x1203,climateSun);glLightfv(Light0,0x1202,climateSpec);glLightModelfv(0x0B53,frameAmbient);
            glLightfv(Light0,0x1201,frameSun);glEnable(Fog);glFogi(0x0B65,0x2601);glFogfv(0x0B66,frameFog);
            glFogf(0x0B63,climateFogStart);glFogf(0x0B64,climateFogEnd);
            Prop fire=null;float best=24*24;
            foreach(Prop p in g.Props)if(p.Lit&&!p.Removed){
                float dx=p.X-g.CamX,dz=p.Z-g.CamZ,d=dx*dx+dz*dz;
                if(d<best&&Perception.LightReaches(g,p,g.CamX,g.CamY,g.CamZ)){best=d;fire=p;}
            }
            if(fire!=null){
                glEnable(Light1);firePos[0]=fire.X;firePos[1]=fire.Y+(fire.Kind=="stove"?1.31f:.59f)+.06f*S(g.Clock*8);firePos[2]=fire.Z;firePos[3]=1;
                glLightfv(Light1,0x1203,firePos);glLightfv(Light1,0x1201,fireLight);glLightf(Light1,0x1208,.047f);
            }else glDisable(Light1);
            glCallList(terrain);glCallList(arenaTrim);
            glDisable(Light);glDisable(Texture);Alpha();glDepthMask(0);
            foreach(Prop p in g.Props) {
                if(p.Removed||p.Kind=="vegetation"||!Visible(g,p.X,p.Z,8,57))continue;
                string id=p.Model;
                float r=id=="cornucopia"?6.0f:id=="pine"?2.5f:id=="oak"?3.3f:id=="birch"?1.7f:
                    p.Kind=="pickup"?.34f:Math.Min(3.1f,Math.Max(.28f,(p.W+p.D)*.29f));
                if(id=="platform")r=1.26f;
                Shadow(p.X,p.Z-(id=="cornucopia"?6:0),r,r*(id=="cornucopia"?1.8f:.68f),id=="cornucopia"?.34f:.24f);
            }
            foreach(Actor a in g.Actors)if(a.Alive&&Visible(g,a.X,a.Z,1.5f,45))Shadow(a.X,a.Z,.50f,.32f,.36f);
            foreach(Animal a in g.Animals)if(!a.Harvested&&Visible(g,a.X,a.Z,1.5f,40)){
                float size=Wildlife.Radius(a);Shadow(a.X,a.Z,size*1.55f,size*.95f,.29f);
            }
            glDepthMask(1);glDisable(Blend);glEnable(Light);Bind(paint);White();
            foreach(Prop p in g.Props) {
                if(p.Removed){if(p.FelledAt>=0 && g.Clock-p.FelledAt<1.65f && Visible(g,p.X,p.Z,p.H,140))DrawFelling(p,g.Clock);continue;}
                float limit=p.Kind=="pickup"?47:p.Model=="grass"?38:p.Model=="reed"?63:p.Model=="bush"?92:p.Model=="watchtower"||p.Model=="aqueduct"?248:164;
                float radius=p.Model=="cornucopia"?18:Math.Max(4,Math.Max(p.W,p.D)*.7f);
                if(Visible(g,p.X,p.Z,radius,limit))DrawProp(p,g.Clock);
            }
            DrawFortFalls(g);
            foreach(Animal a in g.Animals) if(!a.Harvested && Visible(g,a.X,a.Z,2,95))DrawAnimal(a,g.Clock);
            foreach(Actor a in g.Actors){
                if(a==g.CameraTarget||!Visible(g,a.X,a.Z,2,a.Alive?110:68))continue;
                if(a.Alive)DrawActor(g,a);else DrawFallen(g,a);
            }
            DrawTracks(g);
            foreach(Shot s in g.Shots)DrawShot(s);
            DrawWater(g);
            DrawStormFront(g);
            if(g.Ghost!=null) DrawGhost(g.Ghost,g.GhostFits);
            DrawImpactWorld(g);
            DrawAtmosphere(g);
            if(g.Mode=="match" && g.Player!=null && g.Player.Alive){
                ViewModel(g);
                Actor viewer=g.CameraTarget;
                if(viewer!=null && viewer.Alive && viewer.NeedStrain>.001f)PeripheralFalloff(Bound(viewer.NeedStrain,0,1));
                DrawImpactEdge(g);
            }
            glDisable(Light1);
        }
        // Draw after the viewmodel and before the HUD, with the central sight picture left clear.
        static void PeripheralFalloff(float strain){
            glDisable(Depth);glDisable(Texture);glDisable(Fog);glDisable(Light);Alpha();glDepthMask(0);
            glMatrixMode(Projection);glLoadIdentity();glMatrixMode(Modelview);glLoadIdentity();
            float inner=.84f-.33f*strain, opacity=.76f*strain;
            for(int band=0;band<8;band++){
                glBegin(Strip);
                for(int k=0;k<=80;k++){
                    float angle=k*Tau/80,cx=C(angle),cy=S(angle);
                    for(int j=0;j<=1;j++){
                        float f=(band+j)/8f,r=inner+(1.42f-inner)*f;
                        float t=Bound((r-inner)/(1.08f-inner),0,1);
                        float alpha=opacity*t*t*(3-2*t);
                        glColor4f(.118f,.105f,.091f,alpha);
                        glVertex3f(cx*r,cy*r*1.025f,0);
                    }
                }
                glEnd();
            }
            glDepthMask(1);glDisable(Blend);
        }
        static readonly float[] diskX=new float[13],diskZ=new float[13];
        static Renderer(){for(int i=0;i<13;i++){diskX[i]=C(i*Tau/12);diskZ[i]=S(i*Tau/12);}}
        static void Shadow(float x,float z,float rx,float rz,float alpha){
            x+=rx*.19f;z-=rz*.13f;
            glBegin(Fan);glColor4f(.12f,.16f,.16f,alpha);glVertex3f(x,Arena.Height(x,z)+.026f,z);
            glColor4f(.15f,.18f,.17f,0);
            for(int i=0;i<13;i++){float xx=x+rx*diskX[i],zz=z+rz*diskZ[i];glVertex3f(xx,Arena.Height(xx,zz)+.026f,zz);}glEnd();
        }
        static bool LongGear(string id) {
            return id=="arrows"||id=="spear"||id=="hatchet"||id=="knife"||id=="bow"||id=="sling"||
                id=="sword"||id=="crossbow"||id=="bolt"||id=="bolts";
        }
        string Stage(Prop p){
            string id=p.Model;
            if(p.Kind=="structure" && p.MaxHP>0 && p.HP<p.MaxHP*.74f){
                string next=id+(p.HP<p.MaxHP*.37f?"2":"1");
                if(models.ContainsKey(next))return next;
            }
            return id;
        }
        void DrawFelling(Prop p,float clock){
            float age=Math.Max(0,clock-p.FelledAt),phase=Math.Min(1,age/1.18f);
            float tilt=87*phase*phase, sink=Math.Max(0,age-1.24f)*2.3f;
            glPushMatrix();glTranslatef(p.X,p.Y-sink,p.Z);glRotatef(p.FellDirection*Deg,0,1,0);
            glRotatef(tilt,1,0,0);glRotatef(p.Yaw*Deg-p.FellDirection*Deg,0,1,0);
            glScalef(p.Scale,p.Scale,p.Scale);Mesh(p.Model);glPopMatrix();
        }
        void DrawProp(Prop p,float t){
            if(p.Model=="")return;glPushMatrix();glTranslatef(p.X,p.Y,p.Z);glRotatef(p.Yaw*Deg,0,1,0);
            if(p.Kind=="remnant")glScalef(1.22f,.23f,1.16f);
            
            if(p.Kind=="pickup" && LongGear(p.Model)){glTranslatef(0,p.Model=="spear"?.074f:.13f,0);glRotatef(86,1,0,0);}
            if(p.Kind=="pickup" && p.Model=="shield"){glTranslatef(0,.115f,0);glRotatef(-90,1,0,0);}
            glScalef(p.Scale,p.Scale,p.Scale);
            bool metal=p.Model=="cornucopia"||p.Model=="platform"||p.Model=="knife";
            if(metal){glMaterialfv(0x0408,0x1202,polished);glMaterialf(0x0408,0x1601,22);}
            Model gate;
            if(p.Open&&p.Model=="gate"&&models.TryGetValue(Stage(p),out gate)){foreach(Part root in gate.roots)GatePart(root);}
            else Mesh(Stage(p));
            if(metal)glMaterialfv(0x0408,0x1202,matte);
            if(p.HasMeat){glTranslatef(0,p.Model=="stove"?.91f:.43f,0);glScalef(.7f,.7f,.7f);Mesh(p.Cook>=1?"meal":"meat");}
            glPopMatrix();
        }
        static void GatePart(Part p){
            glPushMatrix();glTranslatef(p.x,p.y,p.z);if(p.id=="leaf")glRotatef(90,0,1,0);
            if(p.draw!=0)glCallList(p.draw);foreach(Part c in p.children)GatePart(c);glPopMatrix();
        }
        void DrawGhost(Prop p,bool ok){
            glDisable(Fog);glDisable(Light);glDisable(Texture);
            Alpha();glDepthMask(0);
            float r=ok?.44f:1,g=ok?.88f:.27f,b=ok?.66f:.14f;
            glPushMatrix();glTranslatef(p.X,p.Y+.03f,p.Z);glRotatef(p.Yaw*Deg,0,1,0);
            Model m;glColor4f(r,g,b,.23f);
            if(models.TryGetValue(p.Model,out m)&&m.preview!=0){glPushMatrix();glScalef(p.Scale,p.Scale,p.Scale);glCallList(m.preview);glPopMatrix();}
            glColor4f(r,g,b,.90f);glLineWidth(2);float x=p.W/2,z=p.D/2;
            glBegin(2);glVertex3f(-x,0,-z);glVertex3f(x,0,-z);glVertex3f(x,0,z);glVertex3f(-x,0,z);glEnd();
            glBegin(Lines);for(int i=0;i<4;i++){float px=(i%2==0?-x:x),pz=(i/2==0?-z:z);
                glVertex3f(px,0,pz);glVertex3f(px,Math.Min(.18f,p.H),pz);}glEnd();
            DrawFortGuide(p,r,g,b);
            glPopMatrix();glLineWidth(1);glDepthMask(1);glDisable(Blend);glEnable(Fog);glEnable(Light);Bind(paint);
        }
        void DrawActor(Game g,Actor a){
            Model mesh;if(!models.TryGetValue("contestant",out mesh))return;
            BeginMeleePose(a);armband=Brains.PackNumber(g,a);
            visibleGuardPitch=Bound(a==g.Player?g.Pitch:a.GuardPitch,-.78f,.78f)*a.GuardBlend;
            float signalAge=g.Time-a.TruceGestureAt;
            signaling=signalAge>=0&&signalAge<1.1f&&!a.Guard&&!a.Aiming&&!Lifting(a)&&a.Swing<=0&&a.Windup<=0&&a.DodgeTime<=0;
            signalWeight=signaling?Ease(signalAge/.19f)*Ease((1.1f-signalAge)/.37f):0;
            glPushMatrix();glTranslatef(a.X,a.Y,a.Z);glRotatef(a.Yaw*Deg,0,1,0);
            DrawShield(a,false);
            if(a.Crouch)glTranslatef(0,-.30f,0);
            DodgeLean(a,false);
            if(a.SpearThrust&&a.Weapon=="spear"&&(a.Swing>0||a.Windup>0)){
                SpearStroke step=SpearMelee(a,false);
                glTranslatef(0,0,(a.Crouch?.15f:.27f)*step.travel-.024f*step.pull);
            }else if((ShortMelee(a)||Shoving(a))&&!ThrowPose(a))glTranslatef(0,0,currentMelee.step*(a.Crouch?.62f:1));
            float[] variant=clothLights[Math.Abs(a.TeamColor)%clothLights.Length];
            for(int i=0;i<3;i++)costume[i]=frameAmbient[i]+variant[i]-ambient[i];
            costume[3]=1;glLightModelfv(0x0B53,costume);
            foreach(Part root in mesh.roots)ActorPart(root,a,false);
            if(Lifting(a))DrawPickupItem(a);
            glLightModelfv(0x0B53,frameAmbient);glPopMatrix();
        }
        void ActorPart(Part p,Actor a,bool first){
            glPushMatrix();glTranslatef(p.x,p.y,p.z);
            string n=p.id;float swing=Bound(a.Swing/.36f,0,1),wind=Bound(a.Windup/.45f,0,1);
            float gait=S(a.Anim)*Math.Min(1,a.Speed*.36f);
            bool lifting=!first&&Lifting(a),shooting=!first&&(PosedHands(a)||lifting);
            bool signalArm=signaling&&!first&&n==(a.Weapon=="bow"?"upperarmR":"upperarmL");
            if((shooting||signalArm)&&(n=="upperarmR"||n=="upperarmL")){
                ArticulateArm(p,a,n=="upperarmL");glPopMatrix();return;
            }
            if(n=="torso"&&!first){
                if(a.Crouch)glRotatef(18,1,0,0);
                if(Math.Abs(visibleGuardPitch)>.001f)glRotatef(-24*visibleGuardPitch,1,0,0);
                if(lifting){
                    float reach=LiftReach(a);glTranslatef(0,-PickupDip(a),.10f*reach);glRotatef(22*reach,1,0,0);
                }
                if(a.Weapon=="spear"&&!ThrowPose(a)){
                    SpearStroke stroke=SpearMelee(a,false);
                    glTranslatef(0,-.014f*stroke.travel,.075f*stroke.travel-.025f*stroke.pull);
                    glRotatef((a.Heavy?10:6)*stroke.travel-3*stroke.pull,1,0,0);
                }
                if((ShortMelee(a)||Shoving(a))&&!ThrowPose(a)){
                    JointPoint tilt=currentMelee.body;
                    glTranslatef(0,-.027f*currentMelee.step,.17f*currentMelee.step);
                    glRotatef(tilt.Y,0,1,0);glRotatef(tilt.X,1,0,0);glRotatef(tilt.Z,0,0,1);
                }
                glRotatef(shooting?2*gait:3*gait+wind*28-swing*34,0,1,0);
                if(a.Hurt>0){
                    float remaining=Bound(a.Hurt/.42f,0,1);
                    float recoil=remaining*Ease((1.035f-remaining)/.16f)*a.HitStrength;
                    float angle=a.HitDirection-a.Yaw;
                    glRotatef(14*recoil*C(angle),1,0,0);
                    glRotatef(-18*recoil*S(angle),0,0,1);
                }
            } else if(n=="head"&&!first)glRotatef(-2*gait,0,1,0);
            else if(!first&&(n=="thighR"||n=="thighL")){
                float f=n=="thighR"?1:-1;glRotatef(f*gait*29-(a.Crouch?34:0),1,0,0);
                if(lifting)glRotatef(-22*LiftReach(a),1,0,0);
                if(a.SpearThrust&&a.Weapon=="spear"&&(a.Swing>0||a.Windup>0)){
                    SpearStroke step=SpearMelee(a,false);
                    glRotatef(f*(18*step.travel-4*step.pull),1,0,0);
                }
                if(ShortMelee(a)&&!ThrowPose(a))glRotatef(f*currentMelee.step*51,1,0,0);
            } else if(!first&&(n=="shinR"||n=="shinL")){
                float f=n=="shinR"?1:-1;glRotatef(7+Math.Max(0,-gait*f)*27+(a.Crouch?48:0),1,0,0);
                if(lifting)glRotatef(32*LiftReach(a),1,0,0);
            } else if(n=="upperarmR"&&!first){
                glRotatef(-14-gait*13-(a.Guard?55:0)-wind*104-((1-swing)*swing*4)*74,1,0,0);
                glRotatef(-6-wind*14+swing*31,0,0,1);
            } else if(n=="upperarmL"&&!first){
                glRotatef(-6+gait*19-(a.Guard?70:0),1,0,0);
            } else if(n=="forearmR"&&!first){glRotatef(-15-(a.Guard?38:0)-wind*45,1,0,0);}
            else if(n=="forearmL"&&!first){glRotatef(-9-(a.Guard?30:0),1,0,0);}
            if(p.draw!=0)glCallList(p.draw);
            if(n=="torso"&&!string.IsNullOrEmpty(a.WornArmor))Mesh(a.WornArmor);
            if(n=="forearmR"||n=="forearmL")ArmorCuff(a.WornArmor,ForearmRest,false);
            if(n=="upperarmL"&&!first)PackBand();
            if(n=="torso"&&shooting&&!lifting)SpecialWeapon(a,false);
            if(n=="gripR"&&!shooting&&!first&&a.Weapon!="fists"){glPushMatrix();glRotatef(34,1,0,0);Mesh(a.Weapon);glPopMatrix();}
            foreach(Part child in p.children)ActorPart(child,a,first);
            glPopMatrix();
        }
        void DrawAnimal(Animal a,float t){
            Model m;if(!models.TryGetValue(a.Model,out m))return;
            bool alert=a.Alert>0 || a.State=="flee" || a.State=="alert";
            bool moving=a.State=="flee"||a.State=="wander"||a.State=="roam"||a.State=="run"||a.State=="walk"||a.State=="retreat"||a.State=="charge"||a.State=="home"||a.State=="search";
            float phase=a.Anim, gait=moving?S(phase):0;
            glPushMatrix();
            float hop=(a.Model=="hare"||a.Model=="jackrabbit")&&moving?.20f*Math.Max(0,gait):moving?.018f*Math.Abs(gait):0;
            if(a.Alive&&!moving)hop+=.007f*S(phase+t*.45f);
            glTranslatef(a.X,a.Y+hop+(a.Alive?0:.11f),a.Z);glRotatef(a.Yaw*Deg,0,1,0);
            if(!a.Alive)glRotatef(84,0,0,1);
            foreach(Part root in m.roots)AnimalPart(root,a,alert,gait,t+a.X*.041f+a.Z*.055f);
            glPopMatrix();
        }
        void AnimalPart(Part p,Animal a,bool alert,float gait,float t){
            glPushMatrix();glTranslatef(p.x,p.y,p.z);
            bool warn=a.State=="warn",bite=a.State=="recover";
            switch(p.id){
                case "torso":if(warn)glRotatef(a.Model=="cougar"?8:4,1,0,0);break;
                case "head":glRotatef(warn?(a.Model=="wolf"?-6:21):bite?-9:alert?-16:6+8*S(t*.82f),1,0,0);glRotatef((warn?2:alert?8:4)*S(t*.97f),0,1,0);break;
                case "jaw":glRotatef(warn?8+4*S(t*7):bite?20:2,1,0,0);break;
                case "wildTail":glRotatef((warn?16:9)*S(t*(warn?4:1.6f))+gait*11,0,1,0);break;
                case "earL": case "earR":glRotatef(alert?-12:18+5*S(t*2.5f),1,0,0);break;
                case "frontL":case "rearR":glRotatef(warn&&p.id=="frontL"?10+15*S(t*6):30*gait,1,0,0);break;
                case "frontR":case "rearL":glRotatef(-30*gait,1,0,0);break;
                case "kneeFrontL":case "hockRearR":glRotatef(18*Math.Max(0,gait),1,0,0);break;
                case "kneeFrontR":case "hockRearL":glRotatef(18*Math.Max(0,-gait),1,0,0);break;
                case "hareFootL":case "hareFootR":glRotatef(-18*gait,1,0,0);break;
                case "grazerEarL":case "grazerEarR":glRotatef((p.id=="grazerEarL"?1:-1)*(alert?11:4*S(t*.9f)),0,0,1);break;
                case "tailFan":glRotatef(-3+6*S(t*1.5f),1,0,0);break;
                case "wingL":case "wingR":glRotatef((p.id=="wingL"?1:-1)*(alert?24*Math.Abs(gait):2),0,0,1);break;
            }
            if(p.draw!=0)glCallList(p.draw);
            foreach(Part c in p.children)AnimalPart(c,a,alert,gait,t);glPopMatrix();
        }
        void ViewModel(Game g){
            Actor a=g.Player;glDisable(Fog);glDisable(Light1);glEnable(Light);Bind(paint);glClear(0x0100);
            glMatrixMode(Modelview);glLoadIdentity();glScalef(-1,1,-1);
            DodgeLean(a,true);
            float swing=Bound(a.Swing/.36f,0,1),wind=Bound(g.Charge/.65f,0,1),arc=S(swing*Pi);
            float gait=Bound(a.Speed*.24f,0,1)*g.Settings.Bob;
            if(PosedHands(a)){BeginMeleePose(a);FirstPersonHunt(a,gait);return;}
            glTranslatef(.015f*S(a.Anim)*gait,.059f+.014f*Math.Abs(C(a.Anim))*gait,.153f+wind*.018f);
            if(a.Guard||a.Aiming){glTranslatef(.12f,.06f,.05f);glRotatef(-15,0,0,1);}
            glRotatef(-12*wind+36*arc,0,1,0);glRotatef(-34*wind+24*arc,1,0,0);
            RestingArms(a);
            if(a.Weapon!="fists"){
                glTranslatef(-.22f,-.32f,.51f);glRotatef(a.Weapon=="spear"?69:a.Weapon=="bow"?9:20,1,0,0);glRotatef(-8,0,0,1);
                Mesh(a.Weapon);
            }
        }
        void DrawShot(Shot shot){
            if(shot.Model=="arrow"||shot.Model=="bolt")DrawFletchingTrail(shot);
            glPushMatrix();glTranslatef(shot.X,shot.Y,shot.Z);
            if(shot.Model=="stone"){glScalef(.38f,.38f,.38f);Mesh("stone");}
            else{
                float d=(float)Math.Sqrt(shot.DX*shot.DX+shot.DZ*shot.DZ);
                glRotatef((float)Math.Atan2(shot.DX,shot.DZ)*Deg,0,1,0);
                glRotatef(90-(float)Math.Atan2(shot.DY,d)*Deg,1,0,0);
                // Actor shot positions trace the leading point of the projectile.
                glTranslatef(0,shot.Model=="spear"?-1.355f:shot.Model=="bolt"?-.260f:-.432f,0);
                Mesh(shot.Model);
            }glPopMatrix();
        }
        void DrawAtmosphere(Game g){
            glDisable(Texture);glDisable(Light);Alpha();glDepthMask(0);
            foreach(Prop p in g.Props) {
                if(p.Removed)continue;
                if(p.Model=="watchtower"&&Visible(g,p.X,p.Z,10,185)){
                    float warning=g.EventTime>0?.75f+.25f*S(g.Clock*2):.72f;
                    Billboard(p.X,p.Y+9.60f*p.Scale,p.Z,.65f*p.Scale,.57f*p.Scale,1,.73f,.32f,.55f*warning);
                }
                if((p.Model=="rain_barrel"||p.Model=="spring") && Visible(g,p.X,p.Z,2,53))WaterSource(p,g);
                if(!p.Lit||!Visible(g,p.X,p.Z,9,120))continue;
                float t=g.Clock+p.X*.86f+p.Z*.48f;
                float y=p.Y+(p.Model=="stove"?.79f:.10f);
                Bind(smoke);float plumeCap=Perception.SmokeFraction(g,p);
                for(int i=12;i>=0;i--){
                    float phase=(t*.13f+i/13f)%1;if(phase<0)phase+=1;
                    if(phase>plumeCap)continue;
                    float xx=p.X+phase*1.7f+.13f*S(i+t*.56f),zz=p.Z+.25f*S(i*4+phase*4);
                    float size=.14f+phase*.65f;glColor4f(.65f,.66f,.60f,(1-phase)*.28f);
                    Sprite(xx,y+phase*4.0f+.37f,zz,size,size*1.14f,i%4,2);
                }
                Bind(flames);int frame=Math.Abs((int)(t*13))%16;White();
                Sprite(p.X-.095f,y+.33f,p.Z,.36f,.39f,frame,4);
                glColor4f(1,.91f,.74f,.91f);
                Sprite(p.X+.11f,y+.25f,p.Z+.04f,.26f,.31f,(frame+7)%16,4);
                glDisable(Texture);
                Billboard(p.X,y+.23f,p.Z,.63f,.54f,1,.49f,.12f,.21f);
                for(int i=0;i<7;i++){
                    float v=t*.41f+i/7f;v-= (float)Math.Floor(v);
                    Billboard(p.X+v*.55f+.13f*S(t*.6f+i),y+.27f+v*2.1f,p.Z+.08f*C(i+t),.017f,.032f,1,.70f,.22f,1-v);
                }
            }
            foreach(Effect e in g.Effects){
                float k=Bound(e.Life<=0?0:1-e.Time/e.Life,0,1);
                if(e.Type=="wood"||e.Type=="splinter"){
                    glPushMatrix();glTranslatef(e.X,e.Y,e.Z);glRotatef(e.Time*220,1,0,1);glColor4f(.57f,.38f,.20f,.83f);Box(.043f,.16f,.041f);glPopMatrix();
                }
                else Billboard(e.X,e.Y,e.Z,.07f+k*.07f,.10f+k*.07f,1,e.Type=="hit"?.31f:.75f,.33f,Math.Max(.2f,k));
            }
            if(g.Rain){
                glBegin(Lines);glColor4f(.71f,.82f,.85f,.46f);
                int cx=(int)Math.Floor(g.CamX/10)*10,cz=(int)Math.Floor(g.CamZ/10)*10;
                for(int i=0;i<230;i++){
                    float x=cx-13+(i*1771%379)*.098f,z=cz-13+(i*677%389)*.096f;
                    float y=15-((g.Clock*11+i*3.713f)%15)+g.CamY-4;
                    glVertex3f(x,y,z);glVertex3f(x-.07f,y-.53f,z+.025f);
                }glEnd();
            }
            glDepthMask(1);glDisable(Blend);
        }
        static void WaterSource(Prop p,Game g){
            bool spring=p.Model=="spring";
            float fill=spring?1:Bound(p.Water/Survival.BarrelVolume,0,1);
            float surface=spring?.547f:.28f+.67f*fill;
            float rx=spring?.65f:.414f,rz=spring?.42f:.414f,centerZ=spring?.09f:0;
            glPushMatrix();glTranslatef(p.X,p.Y,p.Z);glRotatef(p.Yaw*Deg,0,1,0);glScalef(p.Scale,p.Scale,p.Scale);
            float time=g.Clock+p.X*.22f+p.Z*.071f;
            if(fill>.001f){
                glBegin(Fan);
                glColor4f(.18f,.48f,.48f,.88f);glVertex3f(0,surface,centerZ);
                for(int i=0;i<=32;i++){
                    float a=i*Tau/32,glint=.025f*S(2*a+time*.44f);
                    glColor4f(.14f+glint,.36f+glint,.38f+glint,.89f);
                    glVertex3f(rx*C(a),surface,centerZ+rz*S(a));
                }glEnd();
                glBegin(Lines);
                int glints=spring?9:5;
                for(int i=0;i<glints;i++){
                    float phase=.5f+.5f*S(time*(.84f+.05f*i)+i*2.76f);
                    float px=rx*C(i*2.4f)*(.24f+i*.055f),pz=centerZ+rz*S(i*2.4f)*(.24f+i*.055f);
                    float y=surface+.004f,wave=.025f+.029f*phase;
                    glColor4f(.77f,.88f,.83f,.15f+.42f*phase);
                    glVertex3f(px-wave,y,pz);glVertex3f(px+wave,y,pz+.006f);
                }glEnd();
            }
            if(spring){
                glBegin(Lines);
                for(int i=0;i<9;i++){
                    float t=Repeat(time*.91f+i*.119f);
                    float z=-.259f+t*.175f,y=.674f-.127f*t*t;
                    float x=.013f*S(i*2.3f+t*3.2f);
                    glColor4f(.66f,.84f,.86f,.62f);glVertex3f(x,y,z);
                    float end=Math.Min(1,t+.11f);glVertex3f(x,.674f-.127f*end*end,-.259f+end*.175f);
                }glEnd();
            }
            if(g.Rain&&!spring&&Survival.CatchesRain(g,p)){
                glBegin(Lines);
                for(int i=0;i<8;i++){
                    float f=Repeat(time*1.43f+i*.419f),a=i*2.4f;
                    float x=.30f*C(a),z=.30f*S(a),y=1.65f-f*(1.65f-surface);
                    glColor4f(.72f,.84f,.87f,.54f);glVertex3f(x+.015f,y+.09f,z-.007f);glVertex3f(x,y,z);
                    if(fill>.001f) {
                        float r=.01f+f*.073f;
                        glColor4f(.73f,.85f,.86f,.42f*(1-f));
                        for(int k=0;k<12;k++){
                            float b=k*Tau/12,c=(k+1)*Tau/12;
                            glVertex3f(x+r*C(b),surface+.008f,z+r*S(b));glVertex3f(x+r*C(c),surface+.008f,z+r*S(c));
                        }
                    }
                }glEnd();
            }
            glPopMatrix();
        }
        static float Repeat(float v){return v-(float)Math.Floor(v);}
        void Sprite(float x,float y,float z,float rx,float ry,int frame,int tiles){
            float u0=(frame%tiles+.008f)/tiles,u1=(frame%tiles+.992f)/tiles;
            float v1=1-(frame/tiles+.008f)/tiles,v0=1-(frame/tiles+.992f)/tiles;
            float dx=cosView*rx,dz=-sinView*rx;
            glBegin(Quads);UV(u0,v0,x-dx,y-ry,z-dz);UV(u1,v0,x+dx,y-ry,z+dz);
            UV(u1,v1,x+dx,y+ry,z+dz);UV(u0,v1,x-dx,y+ry,z-dz);glEnd();
        }
        void Billboard(float x,float y,float z,float rx,float ry,float r,float g,float b,float alpha){
            glBegin(Fan);glColor4f(r,g,b,alpha);glVertex3f(x,y,z);glColor4f(r,g,b,0);
            for(int i=0;i<13;i++)glVertex3f(x+cosView*diskX[i]*rx,y+diskZ[i]*ry,z-sinView*diskX[i]*rx);
            glEnd();
        }
        public void Overlay(Bitmap bitmap)
        {
            if(bitmap==null||w<2||h<2)return;
            glDisable(Depth);glDisable(Fog);glDisable(Light);glEnable(Blend);glBlendFunc(1,0x0303);
            Bind(overlayTex);White();glMatrixMode(Projection);glLoadIdentity();glOrtho(0,bitmap.Width,bitmap.Height,0,-1,1);
            glMatrixMode(Modelview);glLoadIdentity();
            int tile=Math.Min(512,maxTex);BitmapData data=bitmap.LockBits(new Rectangle(0,0,bitmap.Width,bitmap.Height),ImageLockMode.ReadOnly,PixelFormat.Format32bppPArgb);
            try {
                glPixelStorei(0x0CF2,Math.Abs(data.Stride)/4);
                for(int y=0;y<bitmap.Height;y+=tile)for(int x=0;x<bitmap.Width;x+=tile){
                    int tw=Math.Min(tile,bitmap.Width-x),th=Math.Min(tile,bitmap.Height-y);
                    IntPtr pixels=IntPtr.Add(data.Scan0,y*data.Stride+x*4);
                    glTexSubImage2D(Texture,0,0,0,tw,th,0x80E1,0x1401,pixels);
                    float u=tw/(float)tile,v=th/(float)tile;
                    glBegin(Quads);UV(0,0,x,y,0);UV(u,0,x+tw,y,0);UV(u,v,x+tw,y+th,0);UV(0,v,x,y+th,0);glEnd();
                }
            }finally{glPixelStorei(0x0CF2,0);bitmap.UnlockBits(data);}
            glDisable(Blend);
        }
        public Bitmap Capture(){
            Bitmap b=new Bitmap(w,h,PixelFormat.Format32bppArgb);
            BitmapData data=b.LockBits(new Rectangle(0,0,w,h),ImageLockMode.WriteOnly,PixelFormat.Format32bppArgb);
            glReadPixels(0,0,w,h,0x80E1,0x1401,data.Scan0);b.UnlockBits(data);b.RotateFlip(RotateFlipType.RotateNoneFlipY);return b;
        }
        public void Capture(string path){using(Bitmap b=Capture())b.Save(path,ImageFormat.Png);}
        public void Present(){presentSurface(dc);}
        public void Dispose(){wglMakeCurrent(IntPtr.Zero,IntPtr.Zero);wglDeleteContext(rc);ReleaseDC(window,dc);}
    }
}






