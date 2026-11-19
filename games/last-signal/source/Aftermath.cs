using System;

namespace LastSignal {
    public partial class Game {
        void SettleFall(Actor a,Actor killer){
            a.FellAt=Clock;
            a.FallYaw=killer==null?a.Yaw:(float)Math.Atan2(killer.X-a.X,killer.Z-a.Z);
            float ground=Arena.GroundBelow(this,a.X,a.Z,a.Y+.12f);
            // The rig falls onto its back, placing its head behind its final facing.
            // Pick a clear patch next to the feet so a wall does not swallow the body.
            float baseYaw=a.FallYaw;
            for(int i=0;i<8;i++){
                int step=i%2==0?-(i/2):(i+1)/2;
                float angle=baseYaw+step*(float)Math.PI/4;
                float x=a.X-1.55f*(float)Math.Sin(angle),z=a.Z-1.55f*(float)Math.Cos(angle);
                float end=Arena.GroundBelow(this,x,z,a.Y+.45f);
                if(Math.Abs(end-ground)>.78f||!Arena.CanStand(this,x,end,z))continue;
                if(!Arena.Clear(this,a.X,ground+.31f,a.Z,x,end+.31f,z))continue;
                a.FallYaw=angle;a.FallSlope=(float)Math.Atan2(end-ground,1.55f);break;
            }
        }
        void PlaceFallenPack(Actor a,Prop pack){
            float forwardX=(float)Math.Sin(a.FallYaw),forwardZ=(float)Math.Cos(a.FallYaw);
            for(int i=0;i<2;i++){
                float side=i==0?.51f:-.51f;
                float x=a.X+forwardZ*side+forwardX*.15f,z=a.Z-forwardX*side+forwardZ*.15f,y=Arena.GroundBelow(this,x,z,a.Y+.40f);
                if(Math.Abs(y-pack.Y)>.45f||!Arena.CanStand(this,x,y,z))continue;
                if(!Arena.Clear(this,a.X,pack.Y+.22f,a.Z,x,y+.22f,z))continue;
                pack.X=x;pack.Y=y;pack.Z=z;return;
            }
        }
    }

    public sealed partial class Renderer {
        void DrawFallen(Game g,Actor a){
            Model body;if(!models.TryGetValue("contestant",out body))return;
            float progress=Bound((g.Clock-a.FellAt)/.63f,0,1);
            float rotation=progress*progress*(3-2*progress);
            float flinch=S(progress*Pi);
            float turn=(float)Math.Atan2(Math.Sin(a.FallYaw-a.Yaw),Math.Cos(a.FallYaw-a.Yaw));
            float yaw=a.Yaw+turn*rotation;
            float ground=Arena.GroundBelow(g,a.X,a.Z,a.Y+.10f);
            float y=(1-rotation)*a.Y+rotation*(ground+.122f);
            if(rotation>.015f){
                glDisable(Texture);glDisable(Light);Alpha();glDepthMask(0);
                glPushMatrix();glTranslatef(a.X,ground+.019f,a.Z);glRotatef(yaw*Deg,0,1,0);glRotatef(a.FallSlope*Deg,1,0,0);
                glBegin(Fan);glColor4f(.12f,.15f,.14f,.32f*rotation);glVertex3f(0,0,-.86f*rotation);
                glColor4f(.12f,.15f,.14f,0);
                for(int k=0;k<13;k++)glVertex3f(diskX[k]*.47f,0,(-.86f+diskZ[k]*.99f)*rotation);
                glEnd();glPopMatrix();glDepthMask(1);glDisable(Blend);glEnable(Light);Bind(paint);
            }
            glPushMatrix();glTranslatef(a.X,y,a.Z);glRotatef(yaw*Deg,0,1,0);
            glRotatef((-90+a.FallSlope*Deg)*rotation,1,0,0);
            glRotatef((a.Id%2==0?1:-1)*10*flinch,0,1,0);
            float[] variant=clothLights[Math.Abs(a.TeamColor)%clothLights.Length];
            for(int i=0;i<3;i++)costume[i]=frameAmbient[i]+variant[i]-ambient[i];
            costume[3]=1;glLightModelfv(0x0B53,costume);
            string garment=a.FallenArmor;
            foreach(Part root in body.roots) FallenPart(root,rotation,flinch,a.Id%2==0?1:-1,garment);
            glLightModelfv(0x0B53,frameAmbient);glPopMatrix();
        }
        void FallenPart(Part part,float settling,float flinch,int side,string garment){
            glPushMatrix();glTranslatef(part.x,part.y,part.z);
            switch(part.id){
            case "torso": glRotatef(12*flinch,1,0,0);break;
            case "head": glRotatef(side*15*settling,0,1,0);glRotatef(-5*settling,1,0,0);break;
            case "upperarmR": glRotatef(-55*settling-20*flinch,0,0,1);glRotatef(14*settling,1,0,0);break;
            case "upperarmL": glRotatef(36*settling+12*flinch,0,0,1);glRotatef(13.5f*settling,1,0,0);break;
            case "forearmR":case "forearmL": glRotatef(9*settling,1,0,0);break;
            case "thighR": glRotatef(-10*settling,0,0,1);glRotatef(3*settling-12*flinch,1,0,0);break;
            case "thighL": glRotatef(8*settling,0,0,1);glRotatef(3*settling,1,0,0);break;
            case "shinR": glRotatef(2.5f*settling+18*flinch,1,0,0);break;
            case "shinL": glRotatef(2.5f*settling,1,0,0);break;
            }
            if(part.draw!=0)glCallList(part.draw);
            if(part.id=="torso"&&!string.IsNullOrEmpty(garment))Mesh(garment);
            if(part.id=="forearmR"||part.id=="forearmL")ArmorCuff(garment,ForearmRest,false);
            foreach(Part c in part.children)FallenPart(c,settling,flinch,side,garment);
            glPopMatrix();
        }
    }
}
