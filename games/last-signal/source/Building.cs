using System;
using System.Collections.Generic;

namespace LastSignal
{
    public static partial class Arena
    {
        static bool BuildType(string id)
        {
            return id=="wall"||id=="barricade"||id=="gate"||id=="lean_to"||id=="ramp"||id=="floor"||id=="fire"||id=="rain_barrel";
        }
        static bool FencePiece(string model)
        {
            return model=="wall"||model=="gate"||model=="barricade";
        }
        internal static Prop CampPanelAhead(Game g,Actor a,float dx,float dz,out float distance)
        {
            // A blocked movement step touches a body in this cell. Avoid tracing
            // through the bronze shell or trees when there is no camp here at all.
            distance=0;
            List<Body> bodies=fields.GetOrCreateValue(g).Bodies[Index(a.X+dx*.12f,a.Z+dz*.12f)];
            if(bodies==null)return null;
            foreach(Body body in bodies)
            {
                if(body.Retired||body.Prop.Removed||body.Prop.Kind!="structure"||!FencePiece(body.Prop.Model))continue;
                Prop first=RayProp(g,a.X,a.Y+.66f,a.Z,dx,0,dz,1.03f,out distance);
                return first!=null&&first.Kind=="structure"&&FencePiece(first.Model)?first:null;
            }
            return null;
        }
        public static Prop JoinedPreview(Game g,string model,float x,float z,float yaw,bool rotated,out bool joined)
        {
            joined=false;
            Prop free=BuildPreview(g,model,x,z,yaw);
            if(!FencePiece(model)||free.Support!=null)return free;
            Field field=fields.GetOrCreateValue(g);
            float best=.74f*.74f,bestX=x,bestZ=z,bestYaw=yaw;
            const float quarterTurn=(float)(Math.PI/2);
            for(int iz=Cell(z-4);iz<=Cell(z+4);iz++)for(int ix=Cell(x-4);ix<=Cell(x+4);ix++)
            {
                List<Prop> nearby=field.Nearby[ix+iz*Cells];
                if(nearby==null)continue;
                foreach(Prop host in nearby)
                {
                    if(host.Removed||host.Kind!="structure"||!FencePiece(host.Model)||Math.Abs(host.Y-free.Y)>.64f)continue;
                    float aligned=host.Yaw+(float)Math.Round((yaw-host.Yaw)/quarterTurn)*quarterTurn;
                    if(Math.Abs(aligned-yaw)>(rotated?.14f:.40f))continue;
                    float hx=Cos(host.Yaw)*host.W*.5f,hz=-Sin(host.Yaw)*host.W*.5f;
                    float px=Cos(aligned)*free.W*.5f,pz=-Sin(aligned)*free.W*.5f;
                    for(int end=-1;end<=1;end+=2)for(int direction=-1;direction<=1;direction+=2)
                    {
                        float cx=host.X+hx*end+px*direction,cz=host.Z+hz*end+pz*direction;
                        if(Math.Abs(cx-host.X)+Math.Abs(cz-host.Z)<.1f)continue;
                        float dx=cx-x,dz=cz-z,error=dx*dx+dz*dz;
                        if(error>=best)continue;
                        best=error;bestX=cx;bestZ=cz;bestYaw=aligned;joined=true;
                    }
                }
            }
            return joined?BuildPreview(g,model,bestX,bestZ,bestYaw):free;
        }
        // The ends of two perpendicular boards meet at a single post. Only this
        // small end overlap is allowed. Pieces crossing at their centers still fail.
        static bool CornerJoint(Prop p,Body body)
        {
            Prop host=body.Prop;
            if(!FencePiece(p.Model)||host.Kind!="structure"||!FencePiece(host.Model)||
               Math.Abs(Cos(p.Yaw-host.Yaw))>.015f)return false;
            if(host.Model=="gate"&&host.Open&&body.HalfX>.85f)return false;
            float dx=host.X-p.X,dz=host.Z-p.Z;
            float alongP=dx*Cos(p.Yaw)-dz*Sin(p.Yaw);
            float alongHost=dx*Cos(host.Yaw)-dz*Sin(host.Yaw);
            return Math.Abs(Math.Abs(alongP)-p.W*.5f)<.025f&&Math.Abs(Math.Abs(alongHost)-host.W*.5f)<.025f;
        }
        public static Prop BuildPreview(Game g,string model,float x,float z,float yaw)
        {
            Prop p=new Prop{Kind=model=="fire"?"fire":"structure",Model=model,Label=model=="lean_to"?"lean-to":model,X=x,Z=z,Y=Ground(g,x,z),Yaw=yaw,Solid=true,Opaque=true};
            switch(model)
            {
                case "barricade":p.W=3;p.D=.26f;p.H=1f;p.MaxHP=65;break;
                case "wall":p.W=3;p.D=.27f;p.H=2.3f;p.MaxHP=100;break;
                case "gate":p.W=3;p.D=.29f;p.H=2.3f;p.MaxHP=80;break;
                case "lean_to":p.W=2.40f;p.D=2.40f;p.H=1.85f;p.MaxHP=65;break;
                case "ramp":p.W=2.4f;p.D=3f;p.H=Story;p.MaxHP=75;break;
                case "floor":p.W=p.D=3;p.H=DeckThickness;p.MaxHP=90;p.Label="Plank floor";break;
                case "fire":p.W=p.D=1.28f;p.H=.36f;p.MaxHP=28;p.Solid=p.Opaque=false;break;
                case "rain_barrel":p.W=p.D=1.05f;p.H=1.10f;p.MaxHP=65f;p.Label="Rain barrel";break;
            }
            p.HP=p.MaxHP;
            // A wall or barricade under the center may support a stacked piece. Its removal invalidates the stack.
            List<Body> hosts=fields.GetOrCreateValue(g).Bodies[Index(x,z)];
            if(hosts!=null)
            for(int i=0;i<hosts.Count;i++)
            {
                Body b=hosts[i];Prop q=b.Prop;if(q.Removed||b.Retired||q.Kind!="structure")continue;
                float lx,lz;Local(b,x,z,out lx,out lz);if(Math.Abs(lx)>b.HalfX+.07f||Math.Abs(lz)>b.HalfZ+.07f)continue;
                if(q.Model=="ramp")
                {
                    float y=FloorOn(b,x,z);if(y>=p.Y-.025f && y>Height(x,z)+.2f){p.Y=y;p.Support=q;}
                }
                else if((q.Model=="wall"||q.Model=="barricade") && model!="ramp"&&model!="lean_to"&&model!="fire")
                {
                    if(q.Y+q.H>=p.Y-.015f){p.Y=q.Y+q.H;p.Support=q;}
                }
            }
            return p;
        }
        static bool Overlap(Prop a,Body b,float padding)
        {
            float ac=Cos(a.Yaw),asine=Sin(a.Yaw),dx=a.X-b.X,dz=a.Z-b.Z;
            float hw=Math.Max(.02f,a.W*.5f-padding),hd=Math.Max(.02f,a.D*.5f-padding);
            float cd=Math.Abs(ac*b.C+asine*b.S),sd=Math.Abs(ac*b.S-asine*b.C);
            if(Math.Abs(dx*ac-dz*asine)>=hw+b.HalfX*cd+b.HalfZ*sd)return false;
            if(Math.Abs(dx*asine+dz*ac)>=hd+b.HalfX*sd+b.HalfZ*cd)return false;
            if(Math.Abs(dx*b.C-dz*b.S)>=b.HalfX+hw*cd+hd*sd)return false;
            return Math.Abs(dx*b.S+dz*b.C)<b.HalfZ+hw*sd+hd*cd;
        }
        public static bool BuildFits(Game g,Prop p)
        {
            if(p==null||!BuildType(p.Model)||p.X*p.X+p.Z*p.Z>(Radius-1.65f)*(Radius-1.65f)||
                Surface(p.X,p.Z,false)-p.Y>.42f)return false;
            if(!HasFortSupport(g,p))return false;
            float c=Cos(p.Yaw),s=Sin(p.Yaw), min=10000,max=-10000;
            for(int i=0;i<4;i++)
            {
                float lx=(i%2==0?-1:1)*p.W*.46f,lz=(i<2?-1:1)*p.D*.46f;
                float y=Height(p.X+c*lx+s*lz,p.Z-s*lx+c*lz);min=Math.Min(min,y);max=Math.Max(max,y);
            }
            if(p.Support==null && p.FortLevel==0 && max-min>(p.Model=="fire"?.73f:1.15f))return false;
            Field f=fields.GetOrCreateValue(g);int stamp=++f.Stamp;
            for(int iz=Cell(p.Z-2.4f);iz<=Cell(p.Z+2.4f);iz++)
            for(int ix=Cell(p.X-2.4f);ix<=Cell(p.X+2.4f);ix++)
            {
                List<Body> list=f.Bodies[ix+iz*Cells];if(list==null)continue;
                for(int i=0;i<list.Count;i++)
                {
                    Body b=list[i];if(b.Stamp==stamp||b.Retired||b.Prop.Removed||b.Prop==p.Support)continue;b.Stamp=stamp;
                    if(p.Y>=b.Y+b.H-.06f||p.Y+p.H<=b.Y+.05f)continue;
                    if(b.Type=="horn")
                    {
                        if(HornBlocks(p.X,p.Y,p.Z,.5f,p.H))return false;
                        continue;
                    }
                    if(b.Type=="roof")
                    {
                        float lx,lz;Local(b,p.X,p.Z,out lx,out lz);
                        float span=.5f*(p.D*Math.Abs(c*b.C+s*b.S)+p.W*Math.Abs(c*b.S-s*b.C));
                        float bottom=b.Y+b.H*Clamp01((lz-span+b.HalfZ)/(2*b.HalfZ))-.055f;
                        if(p.Y+p.H<bottom)continue;
                    }
                    if(Overlap(p,b,.065f)&&!CornerJoint(p,b)&&!FortJoint(p,b.Prop))return false;
                }
            }
            // Fires are walkable, but cannot be built over an existing fire.
            for(int iz=Cell(p.Z-2f);iz<=Cell(p.Z+2f);iz++)
            for(int ix=Cell(p.X-2f);ix<=Cell(p.X+2f);ix++)
            {
                List<Prop> list=f.Nearby[ix+iz*Cells];if(list==null)continue;
                for(int i=0;i<list.Count;i++)
                {
                    Prop q=list[i];if(q.Removed||q.Kind!="fire"||Math.Abs(q.Y-p.Y)>.6f)continue;
                    float dx=q.X-p.X,dz=q.Z-p.Z;
                    if(Math.Abs(dx*c-dz*s)<p.W*.5f+.38f && Math.Abs(dx*s+dz*c)<p.D*.5f+.38f)return false;
                }
            }
            for(int i=0;i<g.Actors.Count;i++)
            {
                Actor a=g.Actors[i];if(!a.Alive||a.Y+1.65f<=p.Y+.03f||a.Y>=p.Y+p.H)continue;
                float dx=a.X-p.X,dz=a.Z-p.Z;
                if(Math.Abs(dx*c-dz*s)<p.W*.5f+.23f&&Math.Abs(dx*s+dz*c)<p.D*.5f+.23f)return false;
            }
            return true;
        }
        public static bool BuildFits(Game g,string model,float x,float z,float yaw,out Prop support)
        {
            Prop p=BuildPreview(g,model,x,z,yaw); support=p.Support;return BuildFits(g,p);
        }
        public static Prop AddBuilt(Game g,Prop p,Actor owner)
        {
            if(!BuildFits(g,p))return null;p.Owner=owner==null?-1:owner.Id;Register(g,p);return p;
        }
        public static Prop AddBuilt(Game g,string model,float x,float z,float yaw,Actor owner)
        {
            return AddBuilt(g,BuildPreview(g,model,x,z,yaw),owner);
        }
        static void UnindexGeometry(Field f,Prop p)
        {
            for(int iz=Cell(p.Z-3.5f);iz<=Cell(p.Z+3.5f);iz++)
            for(int ix=Cell(p.X-3.5f);ix<=Cell(p.X+3.5f);ix++)
            {
                List<Body> bodies=f.Bodies[ix+iz*Cells];
                if(bodies!=null)for(int i=bodies.Count-1;i>=0;i--)
                {
                    if(bodies[i].Prop!=p)continue;bodies[i].Retired=true;bodies.RemoveAt(i);
                }
            }
        }
        public static void ToggleGate(Game g,Prop p)
        {
            if(p==null||p.Removed||p.Model!="gate"||p.Latched)return;
            float c=Cos(p.Yaw),s=Sin(p.Yaw);
            foreach(Actor a in g.Actors)
            {
                if(!a.Alive||a.Y>p.Y+p.H||a.Y+1.5f<p.Y)continue;
                float dx=a.X-p.X,dz=a.Z-p.Z,lx=dx*c-dz*s,lz=dx*s+dz*c;
                if(p.Open?Math.Abs(lx)<1.62f&&Math.Abs(lz)<.40f:
                    Math.Abs(lx+1.38f)<.39f&&Math.Abs(lz+1.32f)<1.63f)return;
            }
            Field f=fields.GetOrCreateValue(g);UnindexGeometry(f,p);
            p.Open=!p.Open;Geometry(f,p);f.Revision++;
        }
        public static bool TendsGate(Game g,Actor a,Prop p)
        {
            if(a==null||p==null||p.Removed||p.Model!="gate")return false;
            if(p.Owner==a.Id)return true;
            foreach(Actor owner in g.Actors)
                if(owner.Id==p.Owner)return Brains.Allied(g,a,owner);
            return false;
        }
        public static bool LatchGate(Game g,Actor a,Prop p)
        {
            if(!TendsGate(g,a,p)||p.Open)return false;
            p.Latched=!p.Latched;
            return true;
        }
        public static bool HitStructure(Game g,Prop p,float damage)
        {
            if(p==null||p.Removed||damage<=0||(p.Kind!="structure"&&p.Kind!="fire"))return false;
            p.HP=Math.Max(0,p.HP-damage);
            if(g.Effects.Count<240)
            for(int i=0;i<(p.HP<=0?9:3);i++)
            {
                g.Effects.Add(new Effect{Type="splinter",X=p.X+Rand(g.Rng,-.5f,.5f),Y=p.Y+p.H*.55f,Z=p.Z+Rand(g.Rng,-.5f,.5f),DX=Rand(g.Rng,-2,2),DY=Rand(g.Rng,.9f,2.7f),DZ=Rand(g.Rng,-2,2),Time=0,Life=.65f});
            }
            if(p.HP>0)return false;
            SeverFortPiece(g,p);
            return true;
        }
    }
}
