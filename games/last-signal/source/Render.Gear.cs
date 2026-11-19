using System;

namespace LastSignal {
    public sealed partial class Renderer {
        uint crossbowStock;
        static readonly JointPoint DarkIron=J(.176f,.202f,.209f),Iron=J(.34f,.40f,.43f),EdgeSteel=J(.68f,.74f,.75f);
        static readonly JointPoint Walnut=J(.275f,.149f,.075f),Leather=J(.144f,.084f,.057f),Brass=J(.57f,.397f,.195f);
        static readonly JointPoint Cord=J(.66f,.58f,.42f),Fletch=J(.62f,.256f,.139f);

        void BuildGearModels() {
            crossbowStock=OpenList();
            glDisable(Texture);CrossbowStock();White();Bind(paint);
            glEndList();
            AddGearModel("sword",SwordModel);
            AddGearModel("shield",ShieldModel);
            AddGearModel("bolt",BoltModel);
            AddGearModel("bolts",BoltBundle);
            AddGearModel("crossbow",delegate { glCallList(crossbowStock);CrossbowBow(0); });
        }

        void AddGearModel(string name,Action geometry) {
            uint draw=OpenList();
            glDisable(Texture);geometry();White();Bind(paint);glEndList();
            models[name]=new Model { entire=draw };
        }

        static void GearColor(JointPoint color) { glColor3f(color.X,color.Y,color.Z); }
        static void GearVertex(JointPoint point) { glVertex3f(point.X,point.Y,point.Z); }
        static void GearFace(JointPoint color,JointPoint a,JointPoint b,JointPoint c,JointPoint d) {
            JointPoint normal=(b-a).Cross(c-a).Unit();
            GearColor(color);glNormal3f(normal.X,normal.Y,normal.Z);
            GearVertex(a);GearVertex(b);GearVertex(c);GearVertex(d);
        }
        static void GearBox(JointPoint center,float width,float height,float depth,JointPoint color) {
            GearColor(color);glPushMatrix();PointTranslate(center);Box(width,height,depth);glPopMatrix();
        }
        static void GearBar(JointPoint from,JointPoint to,float width,float depth,JointPoint color) {
            JointPoint delta=to-from;
            GearColor(color);glPushMatrix();PointTranslate((to+from)*.5f);
            Align(J(0,1,0),delta);Box(width,delta.Length,depth);glPopMatrix();
        }
        static void GearTube(JointPoint from,JointPoint to,float radius,float tip,JointPoint color,int sides=12) {
            JointPoint axis=(to-from).Unit();
            JointPoint alongX=axis.Cross(Math.Abs(axis.Y)>.85f?J(0,0,1):J(0,1,0)).Unit();
            JointPoint alongZ=alongX.Cross(axis);
            glBegin(Quads);
            for(int i=0;i<sides;i++) {
                float a=i*Tau/sides,b=(i+1)*Tau/sides;
                JointPoint u=alongX*C(a)+alongZ*S(a),v=alongX*C(b)+alongZ*S(b);
                GearFace(color*(.86f+.14f*C(a-.32f)),from+u*radius,to+u*tip,to+v*tip,from+v*radius);
                if(tip>.0001f)GearFace(color*.94f,to,to+v*tip,to+u*tip,to);
                if(radius>.0001f)GearFace(color*.81f,from,from+u*radius,from+v*radius,from);
            }
            glEnd();
        }

        static void SwordModel() {
            glMaterialfv(0x0408,0x1202,polished);glMaterialf(0x0408,0x1601,31);
            float[] y={.074f,.13f,.50f,.72f,.83f},w={.045f,.044f,.035f,.025f,0},ridge={.012f,.013f,.010f,.006f,0};
            glBegin(Quads);
            for(int i=1;i<y.Length;i++) {
                JointPoint a=J(0,y[i-1],ridge[i-1]),b=J(0,y[i],ridge[i]);
                JointPoint c=J(0,y[i-1],-ridge[i-1]),d=J(0,y[i],-ridge[i]);
                JointPoint l=J(-w[i-1],y[i-1],0),ll=J(-w[i],y[i],0),r=J(w[i-1],y[i-1],0),rr=J(w[i],y[i],0);
                GearFace(EdgeSteel,l,a,b,ll);GearFace(Iron,a,r,rr,b);
                GearFace(EdgeSteel,r,c,d,rr);GearFace(Iron,c,l,ll,d);
            }
            glEnd();
            GearBox(J(0,.097f,0),.094f,.026f,.029f,DarkIron);
            GearBar(J(-.142f,.064f,0),J(-.063f,.079f,0),.026f,.036f,Iron);
            GearBar(J(-.075f,.081f,0),J(.075f,.081f,0),.029f,.038f,Brass);
            GearBar(J(.063f,.079f,0),J(.142f,.064f,0),.026f,.036f,Iron);
            GearTube(J(0,-.129f,0),J(0,.066f,0),.024f,.024f,Leather,10);
            for(int i=0;i<9;i++) {
                float line=-.117f+i*.019f;
                GearTube(J(0,line,0),J(0,line+.006f,0),.0248f,.0242f,Walnut,9);
            }
            GearTube(J(0,-.170f,0),J(0,-.130f,0),.041f,.026f,DarkIron);
            GearTube(J(0,-.177f,0),J(0,-.169f,0),.027f,.044f,Brass);
            glMaterialfv(0x0408,0x1202,matte);
        }

        static JointPoint ShieldRim(float angle,float radius,float z) {
            return J(Game.ShieldHalfWidth*radius*C(angle),Game.ShieldHalfHeight*radius*S(angle),z);
        }
        static JointPoint ShieldPoint(float x,float y,bool front) {
            float curve=1-x*x/(Game.ShieldHalfWidth*Game.ShieldHalfWidth)-y*y/(Game.ShieldHalfHeight*Game.ShieldHalfHeight);
            return J(x,y,front?.03f+.049f*Bound(curve,0,1):-.023f+.035f*Bound(curve,0,1));
        }
        static void ShieldModel() {
            glBegin(Quads);
            const int boards=9,vertical=12;
            for(int i=0;i<boards;i++) {
                float breakAt=(i-boards*.5f)/boards,mid=(i+.5f-boards*.5f)/boards;
                JointPoint board=Walnut*(1.03f+.29f*S(i*2.41f));
                for(int stripe=0;stripe<3;stripe++) {
                    float x=Game.ShieldHalfWidth*1.88f*(breakAt+(stripe*1f/3)/boards);
                    float next=Game.ShieldHalfWidth*1.88f*(breakAt+((stripe+1f)/3)/boards);
                    float gap=stripe==2?.004f:0;
                    next-=gap;
                    float edge=Game.ShieldHalfHeight*.94f*(float)Math.Sqrt(Math.Max(0,1-x*x/(Game.ShieldHalfWidth*Game.ShieldHalfWidth)));
                    float nextEdge=Game.ShieldHalfHeight*.94f*(float)Math.Sqrt(Math.Max(0,1-next*next/(Game.ShieldHalfWidth*Game.ShieldHalfWidth)));
                    for(int j=0;j<vertical;j++) {
                        float floor=j*2f/vertical-1,top=(j+1)*2f/vertical-1;
                        JointPoint grain=board*(.89f+.13f*S(j*.81f+mid*17)+.075f*(stripe-1));
                        GearFace(grain,ShieldPoint(x,edge*floor,true),ShieldPoint(next,nextEdge*floor,true),ShieldPoint(next,nextEdge*top,true),ShieldPoint(x,edge*top,true));
                        GearFace(grain*.78f,ShieldPoint(x,edge*top,false),ShieldPoint(next,nextEdge*top,false),ShieldPoint(next,nextEdge*floor,false),ShieldPoint(x,edge*floor,false));
                    }
                }
            }
            for(int i=0;i<48;i++) {
                float a=i*Tau/48,b=(i+1)*Tau/48;
                JointPoint light=Iron*(.82f+.18f*S(i*1.71f));
                GearFace(light,ShieldRim(a,.89f,.039f),ShieldRim(a,1,.021f),ShieldRim(b,1,.021f),ShieldRim(b,.89f,.039f));
                GearFace(DarkIron,ShieldRim(b,1,.021f),ShieldRim(a,1,.021f),ShieldRim(a,1,-.032f),ShieldRim(b,1,-.032f));
                GearFace(light*.81f,ShieldRim(b,.89f,-.016f),ShieldRim(b,1,-.032f),ShieldRim(a,1,-.032f),ShieldRim(a,.89f,-.016f));
            }
            glEnd();
            for(int i=0;i<14;i++) {
                JointPoint bolt=ShieldRim(i*Tau/14,.946f,.038f);
                GearTube(bolt,bolt+J(0,0,.017f),.018f,.012f,Brass,7);
            }
            GearTube(J(0,0,.081f),J(0,0,.11f),.153f,.145f,DarkIron,18);
            GearTube(J(0,0,.11f),J(0,0,.17f),.145f,.102f,Iron,18);
            GearTube(J(0,0,.17f),J(0,0,.199f),.102f,.051f,EdgeSteel,18);
            GearTube(J(0,0,.199f),J(0,0,.205f),.051f,.001f,Iron,12);
            GearBox(J(0,.27f,-.013f),.431f,.047f,.042f,Leather);
            GearBox(J(0,-.27f,-.013f),.431f,.047f,.042f,Leather);
            GearBar(J(-.16f,-.09f,-.011f),J(-.16f,-.054f,-.105f),.045f,.046f,DarkIron);
            GearBar(J(-.16f,-.054f,-.105f),J(-.16f,.104f,-.105f),.046f,.047f,Leather);
            GearBar(J(-.16f,.104f,-.105f),J(-.16f,.14f,-.011f),.045f,.046f,DarkIron);
            GearBar(J(.174f,-.128f,-.011f),J(.174f,-.092f,-.081f),.075f,.023f,Leather);
            GearBar(J(.174f,-.092f,-.081f),J(.174f,.098f,-.081f),.075f,.024f,Leather);
            GearBar(J(.174f,.098f,-.081f),J(.174f,.139f,-.011f),.075f,.023f,Leather);
        }

        static void BoltModel() {
            GearTube(J(0,-.11f,0),J(0,.187f,0),.0075f,.0065f,Walnut,8);
            GearTube(J(0,.157f,0),J(0,.193f,0),.010f,.010f,DarkIron,8);
            GearTube(J(0,.193f,0),J(0,.260f,0),.022f,.0005f,EdgeSteel,4);
            GearTube(J(0,-.123f,0),J(0,-.098f,0),.008f,.008f,DarkIron,8);
            for(int i=0;i<3;i++) {
                float angle=i*120;
                glPushMatrix();glRotatef(angle,0,1,0);
                glBegin(Quads);
                GearFace(Fletch,J(.002f,-.111f,.001f),J(.010f,-.087f,.020f),J(.010f,-.047f,.016f),J(.002f,-.029f,.001f));
                GearFace(Fletch*.85f,J(.002f,-.029f,-.001f),J(.008f,-.047f,.016f),J(.008f,-.087f,.020f),J(.002f,-.111f,-.001f));
                glEnd();glPopMatrix();
            }
        }

        static void BoltBundle() {
            for(int i=0;i<4;i++) {
                glPushMatrix();glTranslatef((i-1.5f)*.028f,(i%2)*.026f,.016f*S(i));
                glRotatef((i-1.5f)*4,0,0,1);BoltModel();glPopMatrix();
            }
            GearBox(J(0,.026f,0),.116f,.035f,.036f,Leather);
            GearBox(J(0,.074f,0),.111f,.028f,.033f,Leather);
        }

        static void CrossbowStock() {
            GearBar(J(0,-.233f,.033f),J(0,-.139f,.010f),.090f,.105f,Walnut*.86f);
            GearBar(J(0,-.165f,.006f),J(0,.135f,.005f),.072f,.081f,Walnut);
            GearBar(J(0,.075f,.005f),J(0,.315f,.009f),.065f,.089f,Walnut);
            GearBar(J(0,.302f,.009f),J(0,.548f,.003f),.064f,.062f,Walnut*1.08f);
            GearBox(J(0,-.226f,.026f),.096f,.023f,.108f,DarkIron);
            GearBar(J(0,-.042f,.031f),J(0,-.082f,.175f),.068f,.057f,Walnut*.82f);
            GearBar(J(0,-.082f,.169f),J(0,-.092f,.20f),.070f,.057f,DarkIron);
            GearBox(J(0,.365f,.048f),.079f,.122f,.038f,Leather);
            GearBox(J(0,.476f,0),.092f,.123f,.073f,DarkIron);
            GearBox(J(0,.191f,-.043f),.068f,.612f,.022f,Iron);
            GearBar(J(-.014f,-.107f,-.059f),J(-.014f,.544f,-.058f),.009f,.009f,EdgeSteel);
            GearBar(J(.014f,-.107f,-.059f),J(.014f,.544f,-.058f),.009f,.009f,EdgeSteel);
            GearBar(J(0,.016f,.043f),J(0,.038f,.11f),.018f,.02f,Iron);
            GearBar(J(0,-.068f,.141f),J(0,.049f,.148f),.025f,.015f,DarkIron);
            GearBar(J(0,.049f,.148f),J(0,.089f,.039f),.025f,.015f,DarkIron);
            for(int side=-1;side<=1;side+=2) {
                for(int i=0;i<4;i++) {
                    float y=.13f+i*.104f;
                    GearTube(J(side*.034f,y,.001f),J(side*.04f,y,.001f),.011f,.009f,Brass,7);
                }
                for(int i=0;i<3;i++) {
                    JointPoint a=J(side*.0365f,-.18f+.015f*i,-.025f+.016f*i);
                    JointPoint b=J(side*.0365f,.08f-.019f*i,-.016f+.016f*i);
                    GearBar(a,b,.002f,.002f,Walnut*.72f);
                }
                GearBar(J(.040f*side,.522f,.012f),J(.093f*side,.632f,.012f),.022f,.031f,Iron);
            }
            GearBar(J(-.093f,.632f,.012f),J(.093f,.632f,.012f),.024f,.031f,Iron);
            GearBox(J(0,.449f,-.083f),.035f,.017f,.050f,DarkIron);
            GearTube(J(0,.450f,-.106f),J(0,.45f,-.117f),.009f,.007f,Brass,7);
        }

        static float StringCatch(float progress) { return .425f-.34f*progress; }
        static void CrossbowBow(float cock) {
            glDisable(Texture);
            for(int side=-1;side<=1;side+=2) {
                JointPoint root=J(side*.027f,.509f,-.037f),inner=J(side*.148f,.517f,-.046f);
                JointPoint middle=J(side*(.278f-.012f*cock),.481f-.042f*cock,-.055f);
                JointPoint tip=J(side*(.382f-.025f*cock),.421f-.063f*cock,-.072f);
                GearBar(root,inner,.057f,.028f,DarkIron);
                GearBar(inner,middle,.041f,.025f,Iron);
                GearBar(middle,tip,.027f,.020f,Iron);
                GearBar(root+J(0,0,-.014f),inner+J(0,0,-.014f),.037f,.006f,EdgeSteel*.73f);
                GearBar(inner+J(0,0,-.012f),middle+J(0,0,-.011f),.026f,.006f,EdgeSteel*.73f);
                GearBox(tip,.037f,.042f,.022f,DarkIron);
                GearTube(tip+J(0,0,-.012f),J(0,StringCatch(cock),-.082f),.004f,.004f,Cord,6);
            }
        }

        struct CrossbowViewPose {
            public JointPoint Grip,Support,Angles,BoltPosition,BoltAngles;
            public float Cock;
            public bool ShowBolt;
        }
        static readonly JointPoint CrossbowHandle=J(0,-.062f,.096f);

        static CrossbowViewPose CrossbowStance(Actor actor,bool first) {
            bool reloading=actor.CrossbowReload>0;
            float phase=reloading?Bound(actor.CrossbowReload/Actor.CrossbowReloadTime,0,1):0;
            float work=reloading?Ease(phase/.20f)*(1-Ease((phase-.78f)/.22f)):0;
            float cock=actor.CrossbowLoaded?1:reloading?Ease((phase-.22f)/.32f):0;
            float aim=actor.Aiming&&!reloading?1:0;
            float recoil=!reloading&&actor.Swing>0?Ease(actor.Swing/.26f):0;
            float pitch=first?0:Bound(actor.Aiming?actor.GuardPitch:actor.ActionPitch*recoil,-.9f,.9f)*Deg;
            JointPoint grip=first?J(-.205f+.143f*aim,-.238f+.099f*aim,.565f+.075f*aim):
                J(-.157f+.059f*aim,.235f+.108f*aim,.213f+.038f*aim);
            grip+=first?J(-.031f,-.092f,-.112f)*work:J(-.036f,-.153f,-.058f)*work;
            grip+=J(0,.037f,-.106f)*recoil;
            JointPoint angles=J(103-13*aim+20*work-8*recoil-pitch,13-11*aim-16*work,-7+6*aim-14*work);
            JointPoint rest=J(.072f,.333f,.035f),target=rest;
            if(reloading&&phase<.55f) {
                JointPoint latch=J(.008f,StringCatch(cock),-.086f);
                target=rest+(latch-rest)*Ease(phase/.22f);
            }
            bool showBolt=actor.CrossbowLoaded||reloading&&phase>=.63f;
            JointPoint seat=J(0,.208f,-.087f);
            JointPoint fetch=J(.205f,.015f,.043f);
            float seating=actor.CrossbowLoaded?1:Ease((phase-.63f)/.15f);
            JointPoint bolt=fetch+(seat-fetch)*seating;
            JointPoint boltAngles=J(-39*(1-seating),18*(1-seating),71*(1-seating));
            if(reloading&&phase>=.55f) {
                JointPoint latch=J(.008f,StringCatch(1),-.086f);
                JointPoint fingers=J(.019f,-.078f,-.014f);
                if(phase<.63f)target=latch+(fetch+fingers-latch)*Ease((phase-.55f)/.08f);
                else {
                    JointPoint guide=bolt+fingers;
                    target=guide+(rest-guide)*Ease((phase-.79f)/.20f);
                }
            }
            return new CrossbowViewPose {
                Grip=grip,Support=grip+RotatedPoint(target-CrossbowHandle,angles),Angles=angles,
                Cock=cock,ShowBolt=showBolt,BoltPosition=bolt,BoltAngles=boltAngles
            };
        }

        void DrawCrossbow(Actor actor,bool first) {
            CrossbowViewPose pose=CrossbowStance(actor,first);
            JointPoint grip=first?pose.Grip:GloveCenter(pose.Grip,false);
            glPushMatrix();PointTranslate(grip);ToolRotation(pose.Angles);
            glTranslatef(-CrossbowHandle.X,-CrossbowHandle.Y,-CrossbowHandle.Z);
            glCallList(crossbowStock);CrossbowBow(pose.Cock);
            if(pose.ShowBolt) {
                glPushMatrix();PointTranslate(pose.BoltPosition);ToolRotation(pose.BoltAngles);Mesh("bolt");glPopMatrix();
            }
            White();Bind(paint);glPopMatrix();
        }

        static JointPoint ShieldCenter(Actor actor,bool first) {
            float rise=Game.ShieldRaised(actor)?1:Ease(actor.GuardBlend)*.92f;
            float height=actor.Crouch?Game.ShieldCrouchedHeight:Game.ShieldStandingHeight;
            float x=-.355f+(Game.ShieldRight+.355f)*rise;
            float y=height-.33f*(1-rise),z=.184f+(Game.ShieldForward-.184f)*rise;
            return first?J(-x,y-(actor.Crouch?1.03f:1.58f),z):J(x,y,z);
        }
        static JointPoint ShieldAngles(Actor actor,bool first) {
            float rest=Game.ShieldRaised(actor)?0:1-Ease(actor.GuardBlend)*.92f;
            float side=first?1:-1;
            return J(36*rest,side*34*rest,-side*22*rest);
        }
        static JointPoint ShieldHand(Actor actor,bool first) {
            JointPoint center=ShieldCenter(actor,first);
            JointPoint grip=center+RotatedPoint(J(first?.16f:-.16f,.024f,-.108f),ShieldAngles(actor,first));
            if(first)return grip;
            float pitch=((actor.Crouch?18:0)-24*Bound(actor.GuardPitch,-.78f,.78f)*actor.GuardBlend)/Deg;
            JointPoint point=grip-J(0,actor.Crouch?.63f:.93f,0);
            return J(point.X,point.Y*C(pitch)+point.Z*S(pitch),point.Z*C(pitch)-point.Y*S(pitch));
        }
        void DrawShield(Actor actor,bool first) {
            if(!Game.CarriesShield(actor))return;
            glPushMatrix();PointTranslate(ShieldCenter(actor,first));ToolRotation(ShieldAngles(actor,first));
            Mesh("shield");glPopMatrix();
        }
    }
}
