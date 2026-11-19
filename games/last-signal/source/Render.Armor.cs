using System;

namespace LastSignal {
    public sealed partial class Renderer {
        static readonly JointPoint ForearmRest = new JointPoint(0,-.225f,.059f);
        float visibleGuardPitch;

        void ArmorCuff(string armorId,JointPoint bindWrist,bool firstPerson){
            string mesh;
            switch(armorId){
                case Armor.Woven: mesh="vest_cuff";break;
                case Armor.Scrap: mesh="cuirass_cuff";break;
                default:return;
            }
            glPushMatrix();
            Align(new JointPoint(0,1,0),bindWrist);
            float girth=firstPerson?1.32f:1;
            glScalef(girth,bindWrist.Length,girth);
            Mesh(mesh);
            glPopMatrix();
        }

        void RestingArms(Actor actor){
            Mesh("arms");
            if(string.IsNullOrEmpty(actor.WornArmor))return;
            Model arms;
            if(!models.TryGetValue("arms",out arms))return;
            foreach(Part root in arms.roots){
                foreach(Part arm in root.children){
                    if(arm.children.Count==0)continue;
                    glPushMatrix();PointTranslate(Pivot(arm));
                    ArmorCuff(actor.WornArmor,Pivot(arm.children[0]),true);
                    glPopMatrix();
                }
            }
        }

        void DodgeLean(Actor actor,bool firstPerson){
            if(actor.DodgeTime<=0)return;
            float elapsed=Game.DodgeDuration-actor.DodgeTime;
            float weight=Ease(elapsed/.075f)*(1-Ease((elapsed-.12f)/(Game.DodgeDuration-.12f)));
            float side=(actor.DodgeDX*C(actor.Yaw)-actor.DodgeDZ*S(actor.Yaw))*weight;
            float forward=(actor.DodgeDX*S(actor.Yaw)+actor.DodgeDZ*C(actor.Yaw))*weight;
            if(firstPerson){
                // The weapon settles toward the body while the view and aim stay level.
                glTranslatef(.034f*side,-.042f*weight,-.037f*weight);
                glRotatef(6*side,0,0,1);
            }else{
                glTranslatef(0,-.075f*weight,0);
                glRotatef(-13*side,0,0,1);
                glRotatef(9*forward,1,0,0);
            }
        }
    }
}
