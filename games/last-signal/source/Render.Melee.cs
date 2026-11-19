using System;

namespace LastSignal {
    public sealed partial class Renderer {
        // The wrist locations are specified in eye space. Third-person gloves use the
        // same choreography, retargeted into the authored two-bone arm's reach.
        struct MeleePose {
            public JointPoint right,left,tool,body;
            public float step;
            public MeleePose(JointPoint r,JointPoint l,JointPoint weaponAngles,JointPoint torsoAngles,float stepForward){
                right=r;left=l;tool=weaponAngles;body=torsoAngles;step=stepForward;
            }
            public static MeleePose operator +(MeleePose a,MeleePose b){
                return new MeleePose(a.right+b.right,a.left+b.left,a.tool+b.tool,a.body+b.body,a.step+b.step);
            }
            public static MeleePose operator -(MeleePose a,MeleePose b){return a+b*(-1);}
            public static MeleePose operator *(MeleePose a,float t){
                return new MeleePose(a.right*t,a.left*t,a.tool*t,a.body*t,a.step*t);
            }
        }
        MeleePose currentMelee;
        static JointPoint J(float x,float y,float z){return new JointPoint(x,y,z);}
        static bool ShortMelee(Actor a){return a.Weapon=="knife"||a.Weapon=="hatchet"||a.Weapon=="fists";}
        static bool Shoving(Actor a){return a.ShoveStroke&&a.Swing>0;}
        static MeleePose MixPose(MeleePose a,MeleePose b,float w){return a+(b-a)*w;}
        static MeleePose ReadyPose(string id){
            bool bare=id=="fists";
            return new MeleePose(J(-.278f,bare?-.235f:-.285f,bare?.59f:.675f),J(.282f,bare?-.235f:-.327f,bare?.615f:.59f),
                id=="hatchet"?J(17,-17,-12):J(35,-10,-16),J(0,0,0),0);
        }
        static MeleePose GuardPose(string id){
            return new MeleePose(J(-.157f,-.133f,.56f),J(.158f,-.128f,.60f),
                id=="hatchet"?J(25,6,-53):J(39,10,-67),J(-4,8,1),-.02f);
        }
        static void KeyPoses(string weapon,int side,float weight,MeleePose ready,out MeleePose prepare,out MeleePose contact,out MeleePose carry){
            float h=weight,s=side>=0?1:-1;
            prepare=contact=carry=ready;
            if(weapon=="fists"){
                // Alternating lead and rear hands. A heavier punch loads the
                // shoulder farther back, turns the hips and carries through.
                JointPoint loaded=J(s*(.296f+.047f*h),-.19f-.014f*h,.54f-.067f*h);
                JointPoint hit=J(s*.020f,-.043f,.975f+.09f*h),through=J(-s*(.042f+.05f*h),-.064f,1.02f+.06f*h);
                JointPoint other=J(-s*.17f,-.17f,.55f);
                if(side<0){
                    prepare.right=loaded;contact.right=hit;carry.right=through;
                    prepare.left=other;contact.left=other+J(.032f,-.018f,-.017f);carry.left=other;
                }else{
                    prepare.left=loaded;contact.left=hit;carry.left=through;
                    prepare.right=other;contact.right=other+J(-.032f,-.018f,-.017f);carry.right=other;
                }
                prepare.body=J(-3,s*(11+8*h),-s*3);
                contact.body=J(4+3*h,-s*(14+7*h),s*3);
                carry.body=J(5+4*h,-s*(18+9*h),s*4);
            }else if(weapon=="knife"){
                // Outside forehand and returning backhand trace different arcs.
                bool fore=side<0;
                prepare.right=fore?J(-.36f-.046f*h,-.22f+.068f*h,.55f-.05f*h):J(.127f+.052f*h,-.22f+.065f*h,.61f);
                prepare.tool=fore?J(49+16*h,-26,-33-14*h):J(61-9*h,20,58+14*h);
                contact.right=J(-.052f,-.088f,.958f+.062f*h);
                contact.tool=fore?J(76,4,-9):J(79,13,11);
                carry.right=fore?J(.134f+.052f*h,-.14f,.925f):J(-.264f-.047f*h,-.154f,.915f);
                carry.tool=fore?J(91,32,-42):J(108,-26,30);
                prepare.body=J(-3,s*(13+6*h),s*3);
                contact.body=J(5+3*h,-s*9,-s*2);
                carry.body=J(7+3*h,-s*(20+6*h),-s*5);
            }else{
                // The head travels down through a forehand chop or across the
                // shorter backhand path. The free hand braces near the chest.
                bool fore=side<0;
                prepare.right=fore?J(-.35f,-.056f+.104f*h,.582f):J(.072f+.085f*h,-.10f+.11f*h,.62f);
                prepare.tool=fore?J(-38-23*h,-28,13):J(-17-23*h,20,37);
                contact.right=J(-.116f,-.22f,.93f+.055f*h);
                contact.tool=fore?J(45,1,-6):J(58,-4,-7);
                carry.right=fore?J(.045f+.05f*h,-.359f,.86f):J(-.27f-.04f*h,-.29f,.87f);
                carry.tool=fore?J(108,22,-24):J(104,-30,22);
                prepare.body=J(-6-4*h,s*(15+7*h),s*3);
                contact.body=J(9+5*h,-s*9,-s*3);
                carry.body=J(13+5*h,-s*18,-s*6);
            }
            if(weapon!="fists"){
                prepare.left=side<0?J(.199f,-.20f,.66f):J(.338f,-.285f,.563f);
                contact.left=J(.238f,-.21f,.51f);carry.left=J(.223f,-.24f,.54f);
            }
            prepare.step=-.025f-.023f*h;
            contact.step=(weapon=="knife"?.26f:weapon=="hatchet"?.28f:.29f)+.064f*h;
            carry.step=contact.step+.017f;
        }
        static MeleePose MeleeMovement(Actor a){
            MeleePose idle=ReadyPose(a.Weapon),ready=MixPose(idle,GuardPose(a.Weapon),Ease(a.GuardBlend));
            if(Shoving(a)){
                float t=1-Bound(a.Swing/Math.Max(.001f,a.SwingSpan),0,1);
                float w=t<.28f?Ease(t/.28f):1-Ease((t-.28f)/.72f);
                MeleePose push=new MeleePose(J(-.125f,-.15f,1.02f),J(.13f,-.143f,1.04f),J(23,2,-66),J(7,0,0),.15f);
                return MixPose(ready,push,w);
            }
            bool active=a.MeleeStroke&&a.ActionWeapon==a.Weapon&&(a.Windup>0||a.Swing>0);
            float charge=Bound(active?a.AttackCharge:a.DrawPower,0,1);
            if(!active&&charge<.0001f)return ready;
            int side=active?a.MeleeSide:-a.MeleeSide;
            float heavy=active?(a.Heavy?1:0):Ease((charge-.29f)/.44f);
            MeleePose pre,hit,over;
            KeyPoses(a.Weapon,side,heavy,idle,out pre,out hit,out over);
            // Holding the button draws toward the very same ready-to-strike pose.
            // Blend against the charge shape at keydown so release never teleports a hand.
            MeleePose chargePre,unusedHit,unusedOver;
            KeyPoses(a.Weapon,side,Ease((charge-.29f)/.44f),idle,out chargePre,out unusedHit,out unusedOver);
            MeleePose start=MixPose(ready,chargePre,.70f*Ease(charge*1.5f));
            if(!active)return start;
            float wind=Math.Max(.001f,a.WindupSpan),after=Math.Max(.001f,a.SwingSpan);
            float turn=wind*(a.Heavy?.58f:.40f),tail=after*(a.Weapon=="hatchet"?.28f:.21f);
            float age=a.Windup>0?wind-a.Windup:wind+after-a.Swing;
            if(age<turn)return MixPose(start,pre,Ease(age/turn));
            // Piecewise Hermite across the registered contact. Both halves share
            // the same world-time tangent at impact, so the wrist carries through.
            MeleePose velocity=(over-pre)*(1.06f/(wind-turn+tail));
            if(age<wind){
                float span=wind-turn,t=Bound((age-turn)/span,0,1);
                return MixPose(pre,hit,Ease(t))+velocity*(span*t*t*(t-1));
            }
            if(age<wind+tail){
                float t=Bound((age-wind)/tail,0,1);
                return MixPose(hit,over,Ease(t))+velocity*(tail*t*(1-t)*(1-t));
            }
            return MixPose(over,ready,Ease((age-wind-tail)/Math.Max(.001f,after-tail)));
        }
        void BeginMeleePose(Actor a){if(ShortMelee(a)||Shoving(a))currentMelee=MeleeMovement(a);}
        JointPoint MeleeHand(Actor a,bool left,bool first){
            JointPoint pos=left?currentMelee.left:currentMelee.right;
            if(first)return pos;
            JointPoint world=J(.78f*pos.X,.55f+.90f*pos.Y,.235f+.80f*(pos.Z-.60f));
            float pitch=Bound(a.ActionPitch,-.83f,.83f);
            if(a.MeleeStroke&&(a.Swing>0||a.Windup>0)){
                float engage=Bound((pos.Z-.65f)/.36f,0,1);
                float offset=.4f*engage*S(pitch);
                world.Y+=offset;world.Z-=Math.Abs(offset)*.33f;
            }
            return world;
        }
        static JointPoint GloveCenter(JointPoint target,bool left){
            JointPoint shoulder=J(left?.207f:-.207f,.412f,.002f),d=target-shoulder;
            return shoulder+d.Unit()*Math.Min(d.Length,.479f);
        }
        static void ToolRotation(JointPoint angles){
            glRotatef(angles.Y,0,1,0);glRotatef(angles.X,1,0,0);glRotatef(angles.Z,0,0,1);
        }
        static JointPoint RotatedPoint(JointPoint v,JointPoint angles){
            float x=angles.X/Deg,y=angles.Y/Deg,z=angles.Z/Deg;
            JointPoint roll=J(v.X*C(z)-v.Y*S(z),v.X*S(z)+v.Y*C(z),v.Z);
            JointPoint tip=J(roll.X,roll.Y*C(x)-roll.Z*S(x),roll.Y*S(x)+roll.Z*C(x));
            return J(tip.X*C(y)+tip.Z*S(y),tip.Y,-tip.X*S(y)+tip.Z*C(y));
        }
        static JointPoint AlignedPoint(JointPoint v,JointPoint from,JointPoint to){
            JointPoint f=from.Unit(),axis=f.Cross(to);float sine=axis.Length,cosine=Bound(f.Dot(to),-1,1);
            if(sine<.0001f)return v;
            axis=axis*(1/sine);
            return v*cosine+axis.Cross(v)*sine+axis*(axis.Dot(v)*(1-cosine));
        }
        JointPoint WristAngles(Actor a,bool left){
            if(left||a.Weapon=="fists")return J(0,0,0);
            JointPoint delta=currentMelee.tool-ReadyPose(a.Weapon).tool;
            return J(Bound(delta.X*.27f,-20,22),Bound(delta.Y*.30f,-12,12),Bound(delta.Z*.30f,-18,22));
        }
        void ShortWeapon(Actor a,bool first){
            if(a.Weapon=="fists")return;
            JointPoint grip=MeleeHand(a,false,first);
            if(!first)grip=GloveCenter(grip,false);
            glPushMatrix();PointTranslate(grip);ToolRotation(currentMelee.tool);
            if(a.Weapon=="hatchet")glTranslatef(0,.081f,0);Mesh(a.Weapon);glPopMatrix();
        }
    }
}
