using System;
using System.Collections.Generic;
namespace LastSignal
{
    public sealed partial class Renderer
    {
        struct JointPoint {
            public float X,Y,Z;
            public JointPoint(float x,float y,float z){X=x;Y=y;Z=z;}
            public static JointPoint operator +(JointPoint a,JointPoint b){return new JointPoint(a.X+b.X,a.Y+b.Y,a.Z+b.Z);}
            public static JointPoint operator -(JointPoint a,JointPoint b){return new JointPoint(a.X-b.X,a.Y-b.Y,a.Z-b.Z);}
            public static JointPoint operator *(JointPoint a,float f){return new JointPoint(a.X*f,a.Y*f,a.Z*f);}
            public float Length {get{return (float)Math.Sqrt(X*X+Y*Y+Z*Z);}}
            public JointPoint Unit(){return this*(1/Math.Max(.0001f,Length));}
            public float Dot(JointPoint b){return X*b.X+Y*b.Y+Z*b.Z;}
            public JointPoint Cross(JointPoint b){return new JointPoint(Y*b.Z-Z*b.Y,Z*b.X-X*b.Z,X*b.Y-Y*b.X);}
        }
        static void PointTranslate(JointPoint a){glTranslatef(a.X,a.Y,a.Z);}
        static JointPoint Pivot(Part p){return new JointPoint(p.x,p.y,p.z);}
        static void Align(JointPoint from,JointPoint to){
            JointPoint f=from.Unit(),t=to.Unit(),axis=f.Cross(t);float c=Bound(f.Dot(t),-1,1);
            if(axis.Length>.0001f)glRotatef((float)Math.Acos(c)*Deg,axis.X,axis.Y,axis.Z);
            else if(c<0)glRotatef(180,0,1,0);
        }
        static float DrawStrength(Actor a){return Bound(a.DrawPower,0,1);}
        static bool ThrowPose(Actor a){return a.Throwing||(a.LastThrow&&a.Swing>0);}
        static bool AimedWeaponPose(Actor a){return a.Weapon=="spear"||a.Weapon=="bow"||a.Weapon=="crossbow"||ThrowPose(a);}
        static bool PosedHands(Actor a){return AimedWeaponPose(a)||ShortMelee(a)||Shoving(a);}
        static bool Lifting(Actor a){
            return a.PickupLift>0&&a.PickupSource!=null&&a.Weapon==a.LiftedWeapon&&
                a.Windup<=0&&a.Swing<=0&&!a.Guard&&!a.Throwing&&!a.Aiming&&a.DodgeTime<=0&&a.DrawPower<.015f;
        }
        static float LiftPhase(Actor a){return 1-Bound(a.PickupLift/Actor.PickupDuration,0,1);}
        static float LiftReach(Actor a){
            float t=LiftPhase(a);return Ease(t/.30f)*(1-Ease((t-.34f)/.66f));
        }
        static JointPoint PickupLocal(Actor a){
            Prop p=a.PickupSource;float x=p.X-a.X,z=p.Z-a.Z;
            return new JointPoint(x*C(a.Yaw)-z*S(a.Yaw),p.Y-a.Y+(a.Crouch?.30f:0),x*S(a.Yaw)+z*C(a.Yaw));
        }
        static JointPoint LiftGoal(Actor a,bool left,JointPoint idle){
            JointPoint src=PickupLocal(a);float m=Math.Max(.01f,(float)Math.Sqrt(src.X*src.X+src.Z*src.Z));
            float reach=LiftReach(a);
            JointPoint take=new JointPoint(Bound(src.X/m*.37f+(left?.055f:-.055f),-.34f,.34f),
                Bound(src.Y-.91f,-.21f,.14f),Bound(src.Z/m*.45f,.025f,.43f));
            return idle+(take-idle)*reach*(left?.73f:1);
        }
        void DrawPickupItem(Actor a){
            float t=LiftPhase(a),reach=LiftReach(a),raised=Ease((t-.23f)/.69f);
            bool left=a.Weapon=="bow"||Game.CarriesShield(a);
            JointPoint source=PickupLocal(a),hand=ArmGoal(a,left,false);
            hand=GloveCenter(hand,left);
            float dip=PickupDip(a),tilt=(a.Crouch?18:0)+22*reach;
            float co=C(tilt/Deg),sn=S(tilt/Deg);
            hand=new JointPoint(hand.X,.93f-dip+hand.Y*co-hand.Z*sn,.10f*reach+hand.Y*sn+hand.Z*co);
            source.Y+=a.Weapon=="spear"?.074f:.13f;
            JointPoint item=source*(1-raised)+hand*raised;
            item.Y+=.068f*S(raised*Pi);
            float sourceYaw=(a.PickupSource.Yaw-a.Yaw)*Deg;
            float yaw=(float)Math.Atan2(S(sourceYaw/Deg),C(sourceYaw/Deg))*Deg;
            glPushMatrix();PointTranslate(item);glRotatef(yaw*(1-raised),0,1,0);
            if(a.Weapon=="spear"){
                SpearStroke stroke=SpearMelee(a,false);
                glRotatef(86*(1-raised),1,0,0);
                if(raised>0){
                    JointPoint normal=new JointPoint(0,1,0),axis=(normal*(1-raised)+stroke.axis*raised).Unit();
                    Align(normal,axis);glTranslatef(0,stroke.slide*raised,0);
                }
            }else if(ShortMelee(a)){
                JointPoint tool=currentMelee.tool;
                if(Game.CarriesShield(a)){tool.Y=-tool.Y;tool.Z=-tool.Z;}
                glRotatef(86*(1-raised),1,0,0);ToolRotation(tool*raised);
                if(a.Weapon=="hatchet")glTranslatef(0,.081f*raised,0);
            }else if(a.Weapon=="crossbow")ToolRotation(J(86,0,0)*(1-raised)+CrossbowStance(a,false).Angles*raised);
            else glRotatef(86*(1-raised)+(left?-7:24)*raised,1,0,0);
            Mesh(a.Weapon);glPopMatrix();
        }
        static float PickupDip(Actor a){return LiftReach(a)*(PickupLocal(a).Y<.45f?.28f:.145f);}
        static float Ease(float t){t=Bound(t,0,1);return t*t*(3-2*t);}
        struct SpearStroke {
            public JointPoint rear,guide,axis;
            public float travel,pull,slide;
        }
        static SpearStroke SpearMelee(Actor a,bool first){
            // Advance along the aim line through contact, briefly overrun and return.
            bool active=a.SpearThrust&&(a.Windup>0||a.Swing>0);
            float charge=active?a.AttackCharge:DrawStrength(a);
            float pull=.58f*Ease(charge*1.7f),travel=0,guard=Ease(a.GuardBlend);
            if(active&&a.Windup>0){
                float t=1-a.Windup/Math.Max(.001f,a.WindupSpan);
                float fireAt=a.Heavy?.59f:.43f,drive=Bound((t-fireAt)/(1-fireAt),0,1);
                travel=drive*drive*(2.55f-1.55f*drive);
                pull=(pull+(1-pull)*Ease(t/(a.Heavy?.44f:.40f)))*(1-travel);
            }else if(active){
                float after=Math.Max(.001f,a.SwingSpan),elapsed=after-a.Swing,carry=after*(a.Heavy?.16f:.11f);
                float advanceRate=.45f/Math.Max(.02f,a.WindupSpan*(a.Heavy?.41f:.57f));
                float over=.5f*advanceRate*carry;
                if(elapsed<carry){float t=Bound(elapsed/carry,0,1);travel=1+over*(2*t-t*t);}
                else travel=(1+over)*(1-Ease((elapsed-carry)/(after-carry)));
                pull=0;
            }
            JointPoint idle=first?new JointPoint(-.30f,-.27f,.67f):new JointPoint(-.22f,.27f,.01f);
            float weight=Ease((charge-.29f)/.44f);
            if(active){
                float blend=a.Windup>0?Ease((a.WindupSpan-a.Windup)/.10f):1;
                weight+=((a.Heavy?1:0)-weight)*blend;
                guard*=a.Windup>0?1-blend:1-Bound(travel,0,1);
            }
            JointPoint drawn=first?new JointPoint(-.32f,-.29f,.46f-.12f*weight):
                new JointPoint(-.24f,.28f,-.13f-.08f*weight);
            JointPoint end=first?new JointPoint(-.13f,-.115f,a.Heavy?1.06f:1.01f):
                new JointPoint(-.095f,.47f,a.Heavy?.46f:.42f);
            JointPoint rear=idle+(drawn-idle)*pull+(end-idle)*travel;
            JointPoint axisIdle=first?new JointPoint(.18f,.113f,1):new JointPoint(.25f,.115f,1);
            JointPoint axisEnd=first?new JointPoint(.065f,.062f,1):new JointPoint(.048f,.076f,1);
            JointPoint axis=(axisIdle+(axisEnd-axisIdle)*travel).Unit();
            if(!first&&active){
                float bodyPitch=(a.Crouch?18:0)+(a.Heavy?10:6)*travel-3*pull;
                float angle=Bound(a.ActionPitch,-.97f,.97f)+bodyPitch/Deg;
                float y=axis.Y*C(angle)+axis.Z*S(angle),z=axis.Z*C(angle)-axis.Y*S(angle);
                axis=new JointPoint(axis.X,y,z);
            }
            float handGap=(first?.43f:.36f)+.12f*pull-(first?.26f:.30f)*travel;
            // The guide hand stays in place longer as the rear hand drives the shaft through it.
            float releaseSlide=first?(a.Heavy?.41f:.36f):.46f;
            bool shove=Shoving(a);
            if(guard>.0001f||shove){
                float phase=1-Bound(a.Swing/Math.Max(.001f,a.SwingSpan),0,1);
                float motion=shove?(phase<.26f?Ease(phase/.26f):1-Ease((phase-.26f)/.74f)):0;
                guard=Math.Max(guard,motion);
                JointPoint high=first?J(-.31f,-.255f,.59f):J(-.24f,.23f,.17f);
                rear=rear+(high-rear)*guard+J(0,0,(first?.27f:.15f)*motion);
                axis=(axis*(1-guard)+J(.72f,.53f,.42f).Unit()*guard).Unit();handGap+=(.48f-handGap)*guard;
            }
            return new SpearStroke{rear=rear,guide=rear+axis*handGap,axis=axis,travel=travel,pull=pull,
                slide=.35f+.10f*pull+releaseSlide*travel-.06f*guard};
        }
        readonly Dictionary<string,float[]> bowSources=new Dictionary<string,float[]>();
        readonly uint[] bowPoses=new uint[17];
        void BuildBowPoses(){
            if(!bowSources.ContainsKey("bow")||!bowSources.ContainsKey("bow_draw1")||!bowSources.ContainsKey("bow_draw2"))return;
            float[] rest=bowSources["bow"],mid=bowSources["bow_draw1"],full=bowSources["bow_draw2"];
            if(rest.Length!=mid.Length||mid.Length!=full.Length)return;
            bowPoses[0]=models["bow"].entire;bowPoses[8]=models["bow_draw1"].entire;bowPoses[16]=models["bow_draw2"].entire;
            float[] vertex=new float[rest.Length];byte[] bytes=new byte[vertex.Length*sizeof(float)];
            for(int i=1;i<16;i++){
                if(i==8)continue;
                float weight=(i%8)/8f;float[] a=i<8?rest:mid,b=i<8?mid:full;
                for(int j=0;j<vertex.Length;j++)vertex[j]=a[j]+weight*(b[j]-a[j]);
                Buffer.BlockCopy(vertex,0,bytes,0,bytes.Length);uint unused;
                bowPoses[i]=CompileStream(bytes,vertex.Length/11,false,out unused);
            }
            bowSources.Clear();
        }
        static float Nock(float power){return power<.5f?-.16f-.32f*power:-.32f-.36f*(power-.5f);}
        void BowAndArrow(float draw,bool loaded){
            uint pose=bowPoses[(int)Math.Round(Bound(draw,0,1)*16)];
            if(pose!=0)glCallList(pose);else Mesh("bow");
            if(loaded){
                glPushMatrix();glTranslatef(0,.035f,Nock(draw)+.30f);glRotatef(90,1,0,0);
                Mesh("arrow");glPopMatrix();
            }
        }
        static JointPoint BowGrip(float draw,bool first){
            return first?new JointPoint(.33f-.144f*draw,-.29f+.102f*draw,.82f+.25f*draw):
                         new JointPoint(.184f-.052f*draw,.411f+.064f*draw,.347f+.096f*draw);
        }
        static JointPoint BowNock(JointPoint grip,float draw,bool first){
            float yaw=(first?25:12)/Deg, cant=(first?-19f+draw*10f:-12f+draw*7f)/Deg;
            float z=Nock(draw), y=.035f, x=-y*S(cant);
            float pitch=first?-8/Deg:0,up=y*C(cant)*C(pitch)-z*S(pitch),forward=y*C(cant)*S(pitch)+z*C(pitch);
            return grip+new JointPoint(C(yaw)*x+S(yaw)*forward,up,-S(yaw)*x+C(yaw)*forward);
        }
        static JointPoint ThrowGrip(Actor a,bool first){
            float draw=DrawStrength(a);float follow=1-Bound(a.Swing/.36f,0,1);
            if(a.LastThrow&&a.Swing>0&&!a.Throwing){
                float reach=1-(1-follow)*(1-follow)*(1-follow);
                return first?new JointPoint(-.145f-.11f*(1-reach),-.044f-.08f*reach,.417f+.40f*reach):
                             new JointPoint(-.29f+.12f*reach,.585f-.14f*reach,-.15f+.60f*reach);
            }
            return first?new JointPoint(-.30f+.045f*draw,-.24f+.196f*draw,.65f-.233f*draw):
                         new JointPoint(-.24f-.05f*draw,.37f+.215f*draw,.32f-.47f*draw);
        }
        void SpecialWeapon(Actor a,bool first){
            float draw=DrawStrength(a);
            bool mirror=!first&&Game.CarriesShield(a);
            if(a.Weapon=="crossbow"){
                DrawCrossbow(a,first);
            }else if(ThrowPose(a)){
                if(!a.Throwing||a.Weapon!="spear")return;
                JointPoint grip=ThrowGrip(a,first);
                if(mirror)grip.X=-grip.X;
                glPushMatrix();PointTranslate(grip);glRotatef(first?3:0,0,1,0);
                glRotatef(76+8*draw,1,0,0);Mesh("spear");glPopMatrix();
            }else if(a.Weapon=="spear"){
                SpearStroke stroke=SpearMelee(a,first);
                if(mirror){stroke.rear.X=-stroke.rear.X;stroke.axis.X=-stroke.axis.X;}
                glPushMatrix();PointTranslate(stroke.rear);Align(new JointPoint(0,1,0),stroke.axis);
                glTranslatef(0,stroke.slide,0);Mesh("spear");glPopMatrix();
            }else if(ShortMelee(a)||(Shoving(a)&&a.Weapon!="bow")){
                ShortWeapon(a,first);
            }else{
                JointPoint grip=BowGrip(draw,first);
                if(Shoving(a))grip=BowShove(a,true,first,grip);
                glPushMatrix();PointTranslate(grip);glRotatef(first?25:12,0,1,0);if(first)glRotatef(-8,1,0,0);
                glRotatef(first?-19+10*draw:-12+7*draw,0,0,1);
                BowAndArrow(draw,(a.Swing<=0||Shoving(a))&&a.Count("arrows")>0);glPopMatrix();
            }
        }
        JointPoint ArmGoal(Actor a,bool left,bool first){
            if(Game.CarriesShield(a)){
                if(left==first)return ShieldHand(a,first);
                JointPoint right=WeaponArmGoal(a,false,first);
                if(!first)right.X=-right.X;
                return right;
            }
            return WeaponArmGoal(a,left,first);
        }
        JointPoint WeaponArmGoal(Actor a,bool left,bool first){
            float draw=DrawStrength(a);
            if(a.Weapon=="crossbow"){
                CrossbowViewPose pose=CrossbowStance(a,first);
                JointPoint hand=left?pose.Support:pose.Grip;
                return !first&&Lifting(a)?LiftGoal(a,left,hand):hand;
            }
            if(ThrowPose(a)){
                if(!left)return ThrowGrip(a,first);
                return first?new JointPoint(.29f,-.33f,.53f+.11f*draw):new JointPoint(.24f,.19f,.28f+.06f*draw);
            }
            if(a.Weapon=="spear"){
                SpearStroke stroke=SpearMelee(a,first);JointPoint hand=left?stroke.guide:stroke.rear;
                return !first&&Lifting(a)?LiftGoal(a,left,hand):hand;
            }
            if(ShortMelee(a)||(Shoving(a)&&a.Weapon!="bow")){
                JointPoint wrist=MeleeHand(a,left,first);
                return !first&&Lifting(a)?LiftGoal(a,left,wrist):wrist;
            }
            if(!first&&Lifting(a)&&a.Weapon!="bow")
                return LiftGoal(a,left,new JointPoint(left?.24f:-.24f,.015f,left?.07f:.15f));
            JointPoint grip=BowGrip(draw,first);
            if(Shoving(a))return BowShove(a,left,first,left?grip:BowNock(grip,draw,first));
            if(left)return !first&&Lifting(a)?LiftGoal(a,true,grip):grip;
            JointPoint nock=BowNock(grip,draw,first);
            if(a.Swing>0){
                float recoil=Bound(a.Swing/.36f,0,1);
                // The drawing hand falls away along the string after release.
                JointPoint anchor=BowNock(BowGrip(1,first),1,first);
                nock=nock*(1-recoil)+anchor*recoil+new JointPoint(-.079f,.025f,-.065f)*recoil;
            }
            return !first&&Lifting(a)?LiftGoal(a,false,nock):nock;
        }
        static JointPoint BowShove(Actor a,bool left,bool first,JointPoint ready){
            float t=1-Bound(a.Swing/Math.Max(.001f,a.SwingSpan),0,1);
            float w=t<.28f?Ease(t/.28f):1-Ease((t-.28f)/.72f);
            JointPoint target=first?(left?J(.28f,-.23f,1.02f):J(-.13f,-.16f,.98f)):
                (left?J(.19f,.36f,.45f):J(-.11f,.36f,.47f));
            return ready+(target-ready)*w;
        }
        // Bend the generated upper arm and forearm toward their common target using
        // the authored shoulder, elbow and glove positions and constant bone lengths.
        bool signaling;
        float signalWeight;
        void ArticulateArm(Part upper,Actor a,bool left){
            if(upper.children.Count==0)return;
            Part fore=upper.children[0];JointPoint upperRest=Pivot(fore),foreRest=new JointPoint(0,-.225f,.059f);
            JointPoint wrist=ArmGoal(a,left,false);
            if(signaling&&left==(a.Weapon!="bow")){
                float side=left?1:-1;
                JointPoint ready=PosedHands(a)?wrist:J(.26f*side,.01f,.12f);
                JointPoint signal=a.TruceAccepted?J(.11f*side,.46f,.20f):J(.38f*side,.64f,.19f);
                wrist=ready+(signal-ready)*signalWeight;
            }
            JointPoint target=wrist-Pivot(upper);
            float l1=upperRest.Length,l2=foreRest.Length,d=Bound(target.Length,Math.Abs(l1-l2)+.001f,l1+l2-.001f);
            JointPoint along=target.Unit(),pole=new JointPoint(left?1:-1,-.72f,-.64f);
            JointPoint outward=(pole-along*pole.Dot(along)).Unit();
            float baseline=(l1*l1-l2*l2+d*d)/(2*d);
            float height=(float)Math.Sqrt(Math.Max(0,l1*l1-baseline*baseline));
            JointPoint elbow=along*baseline+outward*height,hand=along*d;
            glPushMatrix();Align(upperRest,elbow);if(upper.draw!=0)glCallList(upper.draw);if(left)PackBand();glPopMatrix();
            glPushMatrix();PointTranslate(elbow);Align(foreRest,hand-elbow);
            if(fore.draw!=0)glCallList(fore.draw);
            ArmorCuff(a.WornArmor,foreRest,false);glPopMatrix();
        }
        int armband;
        void PackBand(){
            if(armband<=0)return;
            // Seat the two stitched edges on the moving upper sleeve. It follows
            // the skeleton even while the glove is holding a separately placed item.
            glDisable(Texture);
            for(int row=0;row<3;row++){
                float top=row==0?-.102f:row==1?-.108f:-.145f,bottom=row==0?-.108f:row==1?-.145f:-.151f;
                if(row!=1)glColor3f(.83f,.72f,.53f);
                else if(armband==1)glColor3f(.81f,.28f,.145f);
                else glColor3f(.19f,.66f,.61f);
                glBegin(Strip);
                for(int k=0;k<=16;k++){float x=S(k*Tau/16),z=C(k*Tau/16);
                    glNormal3f(x,0,z);glVertex3f(.046f+.076f*x,top,.004f+.084f*z);
                    glVertex3f(.048f+.074f*x,bottom,.004f+.082f*z);}
                glEnd();
            }
            White();Bind(paint);
        }
        Part leftSleeve,rightSleeve;
        void FirstPersonArm(Part arm,Actor a,bool left){
            if(arm.children.Count==0)return;
            Part hand=arm.children[0];
            JointPoint rest=Pivot(hand),goal=ArmGoal(a,left,true),gripLocal=J(0,.026f,.066f);
            JointPoint wrist=goal-gripLocal,wristAngles=J(0,0,0);
            JointPoint restElbow=new JointPoint(left?.39f:-.46f,-.47f,-.10f);
            JointPoint direction=(wrist-restElbow).Unit();
            bool bend=ShortMelee(a)&&!ThrowPose(a);
            if(bend){
                wristAngles=WristAngles(a,left);
                JointPoint bentGrip=RotatedPoint(gripLocal,wristAngles);
                wrist=goal-AlignedPoint(bentGrip,rest,direction);
                direction=(wrist-restElbow).Unit();
                wrist=goal-AlignedPoint(bentGrip,rest,direction);
            }
            JointPoint elbow=wrist-direction*rest.Length;
            // The authored forearms reach a defined wrist point. Continue the sleeve to
            // an offscreen shoulder when a fully extended bow arm reveals the elbow.
            Part sleeve=left?leftSleeve:rightSleeve;
            if(sleeve!=null&&sleeve.draw!=0){
                JointPoint shoulder=new JointPoint(left?.42f:-.46f,-.56f,-.11f),upper=shoulder-elbow;
                glPushMatrix();PointTranslate(elbow);Align(new JointPoint(0,1,0),upper);
                glScalef(1.79f,Math.Max(.1f,upper.Length)/.245f,1.64f);
                glTranslatef(left?-.034f:.034f,.238f,-.018f);glCallList(sleeve.draw);glPopMatrix();
            }
            glPushMatrix();PointTranslate(elbow);Align(rest,direction);
            if(arm.draw!=0)glCallList(arm.draw);
            ArmorCuff(a.WornArmor,rest,true);
            if(bend){
                PointTranslate(rest);ToolRotation(wristAngles);if(hand.draw!=0)glCallList(hand.draw);
                foreach(Part child in hand.children)StaticPart(child,false);
            }else StaticPart(hand,false);
            glPopMatrix();
        }
        void FirstPersonHunt(Actor a,float gait){
            glTranslatef(.013f*S(a.Anim)*gait,.009f*Math.Abs(C(a.Anim))*gait,0);
            Model m;if(models.TryGetValue("arms",out m)){
                foreach(Part root in m.roots)foreach(Part arm in root.children){
                    if(arm.id=="forearmL"||arm.id=="forearmR")FirstPersonArm(arm,a,arm.id=="forearmL");
                }
            }
            SpecialWeapon(a,true);
            DrawShield(a,true);
        }
    }
}
