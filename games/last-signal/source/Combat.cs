using System;

namespace LastSignal {
    public partial class Game {
        public static bool Ranged(Actor a){return a!=null&&RangedProjectile(a.Weapon).Length>0;}
        public void Attack(Actor a,bool heavy,float pitch){
            if(a==null||!a.Alive||a.NextAttack>0||a.Windup>0||a.DodgeTime>.12f)return;
            if(Ranged(a)){DrawShot(a,pitch,heavy?1:.57f);return;}
            float cost=heavy?23:11;if(a.Stamina<cost){if(a==Player)Say("Recover stamina");return;}
            a.Stamina-=cost;a.Heavy=heavy;a.Guard=false;
            a.LastThrow=false;a.Throwing=false;a.ActionWeapon=a.Weapon;a.ProjectileId="";
            a.AttackCharge=a==Player?a.DrawPower:0;
            a.MeleeSide=-a.MeleeSide;a.MeleeStroke=true;a.ShoveStroke=false;
            bool blade=a.Weapon=="knife",axe=a.Weapon=="hatchet",pole=a.Weapon=="spear",sword=a.Weapon=="sword";
            a.Windup=pole?(heavy?.57f:.27f):axe?(heavy?.54f:.29f):sword?(heavy?.46f:.23f):blade?(heavy?.38f:.17f):(heavy?.37f:.20f);
            a.SwingSpan=pole?(heavy?.47f:.36f):axe?(heavy?.53f:.40f):sword?(heavy?.47f:.33f):blade?(heavy?.38f:.27f):(heavy?.37f:.29f);
            a.WindupSpan=a.Windup;a.ActionPitch=pitch;a.SpearThrust=a.Weapon=="spear";
            a.NextAttack=a.Windup+a.SwingSpan+(heavy?.13f:.035f);
            attackPitch[a]=pitch; a.State=heavy?"heavy":"windup";
            Cue(a.SpearThrust?"thrust":"swing",a.X,a.Z,heavy?13:8);
        }
        public void ThrowSpear(Actor a,float pitch,float power){
            if(a!=null&&a.Weapon=="spear")PrepareShot(a,pitch,power,"spear");
        }
        public void DrawShot(Actor a,float pitch,float power){
            if(!Ranged(a))return;
            if(a.Weapon=="crossbow"){FireCrossbow(a,pitch);return;}
            PrepareShot(a,pitch,power,RangedProjectile(a.Weapon));
        }
        void PrepareShot(Actor a,float pitch,float power,string id){
            if(!a.Alive||a.Windup>0||a.NextAttack>0||a.DodgeTime>.12f)return;
            string item=ShotAmmo(id);
            if(a.Count(item)<1){if(a==Player)Say(id=="arrow"?"Out of arrows":id=="bolt"?"Out of bolts":id=="stone"?"Gather sling stones":"No spear to throw");return;}
            power=Math.Max(0,Math.Min(1,power));float cost=id=="bolt"?8:(id=="spear"?10:6)+5*power;
            if(a.Stamina<cost){if(a==Player)Say("Recover stamina");return;}
            a.Stamina-=cost;a.Guard=false;a.Heavy=power>.62f;a.ProjectilePower=power;a.ActionWeapon=a.Weapon;
            a.SpearThrust=a.MeleeStroke=a.ShoveStroke=false;a.ActionPitch=pitch;a.SwingSpan=.36f;
            a.ProjectileId=id;a.Throwing=id=="spear";a.LastThrow=false;a.DrawPower=a==Player?power:0;
            a.WindupSpan=ShotWindup(id,power,a==Player);
            a.Windup=a.WindupSpan;a.NextAttack=a.Windup+(id=="bolt"?.33f:a.Throwing?.82f:.56f);
            attackPitch[a]=pitch;a.State=a.Throwing?"throw":"draw";
        }
        // A finite ray against an ellipsoid. Its entry point gives the correct ordering
        // between contestants, wildlife, wooden cover and terrain.
        static float BodyHit(float x,float y,float z,float dx,float dy,float dz,float cx,float cy,float cz,float rx,float ry,float rz){
            float px=(x-cx)/rx,py=(y-cy)/ry,pz=(z-cz)/rz;
            dx/=rx;dy/=ry;dz/=rz;float aa=dx*dx+dy*dy+dz*dz,bb=px*dx+py*dy+pz*dz,cc=px*px+py*py+pz*pz-1;
            if(cc<0)return 0;float disc=bb*bb-aa*cc;
            if(disc<0||aa<.0001f||bb>0)return float.MaxValue;
            return Math.Max(0,(-bb-(float)Math.Sqrt(disc))/aa);
        }
        void TraceBodies(Actor source,float x,float y,float z,float dx,float dy,float dz,float pad,bool checkShields,
            ref float nearest,out Actor actor,out Animal creature,out bool shieldHit){
            actor=null;creature=null;shieldHit=false;
            foreach(Actor a in Actors){
                if(a==source||!a.Alive)continue;
                float h=a.Crouch?1.18f:1.78f, hr=.39f+pad;
                bool shieldReady=checkShields&&ShieldRaised(a);
                float margin=shieldReady?Math.Max(hr,ShieldTraceMargin):hr;
                if(Math.Abs(a.X-x)>nearest+margin||Math.Abs(a.Z-z)>nearest+margin)continue;
                float t=BodyHit(x,y,z,dx,dy,dz,a.X,a.Y+h*.52f,a.Z,hr,h*.52f+pad,hr);
                float peekX,peekY,peekZ;
                if(LeanEye(a,out peekX,out peekY,out peekZ)&&Distance(a.X,a.Z,peekX,peekZ)>.09f)
                    t=Math.Min(t,BodyHit(x,y,z,dx,dy,dz,peekX,peekY-.08f,peekZ,.21f+pad,.22f+pad,.21f+pad));
                float shield=shieldReady?ShieldContact(a,x,y,z,dx,dy,dz):float.MaxValue;
                // The visible shield lies ahead of the real body. Aiming padding
                // on the body must not pass through the face of the raised shield.
                bool blocked=shield<float.MaxValue;
                if(blocked)t=shield;
                if(t<nearest){nearest=t;actor=a;creature=null;shieldHit=blocked;}
            }
            foreach(Animal a in Animals){
                if(!a.Alive)continue;
                float reach=Wildlife.LengthRadius(a)+pad;
                if(Math.Abs(a.X-x)>nearest+reach||Math.Abs(a.Z-z)>nearest+reach)continue;
                float c=(float)Math.Cos(a.Yaw),s=(float)Math.Sin(a.Yaw);
                float px=x-a.X,pz=z-a.Z;
                float t=BodyHit(c*px-s*pz,y,s*px+c*pz,c*dx-s*dz,dy,s*dx+c*dz,0,a.Y+Wildlife.Height(a),0,
                    Wildlife.Radius(a)+pad,Wildlife.VerticalRadius(a)+pad,reach);
                if(t<nearest){nearest=t;actor=null;creature=a;shieldHit=false;}
            }
        }
        void Strike(Actor a,float pitch){
            if(!a.Alive)return;
            string projectile=a.ProjectileId;a.ProjectileId="";a.Throwing=false;
            if(a.ActionWeapon!=a.Weapon){a.SpearThrust=false;return;}
            float sp=(float)Math.Sin(pitch),cp=(float)Math.Cos(pitch),dx=(float)Math.Sin(a.Yaw)*cp,dz=(float)Math.Cos(a.Yaw)*cp;
            float x=a.X,y=a.Y+(a.Crouch?1.03f:1.55f),z=a.Z;
            float eyeX,eyeY,eyeZ;
            if(LeanEye(a,out eyeX,out eyeY,out eyeZ)){x=eyeX;y=eyeY;z=eyeZ;}
            a.Swing=a.SwingSpan;SoundAt(a,projectile==""?12:17);
            if(projectile!=""){
                bool bow=projectile=="arrow",spear=projectile=="spear",bolt=projectile=="bolt";
                string ammo=ShotAmmo(projectile);
                if(a.Count(ammo)==0||bolt&&!a.CrossbowLoaded)return;
                if(bolt)a.CrossbowLoaded=false;
                a.Add(ammo,-1);float power=a.ProjectilePower;
                float v=ShotSpeed(projectile,power);
                a.LastThrow=spear;if(spear&&a.Count("spear")==0)a.Weapon="fists";
                float shotDamage=bolt?68:bow?15+34*power:spear?25+39*power:23+12*power;
                Shots.Add(new Shot{Owner=a,Model=projectile,X=x,Y=y,Z=z,DX=dx*v,DY=sp*v,DZ=dz*v,Life=bolt?3.1f:9,Gravity=ShotGravity(projectile),Damage=shotDamage});
                Cue(spear?"cast":"release",x,z,18);return;
            }
            float reach=a.Weapon=="spear"?3.07f:a.Weapon=="sword"?2.35f:a.Weapon=="hatchet"?1.98f:a.Weapon=="knife"?1.64f:1.43f;
            float limit;Prop surface=Arena.RayProp(this,x,y,z,dx,sp,dz,reach,out limit);
            Actor target;Animal game;bool shieldHit;
            TraceBodies(a,x,y,z,dx,sp,dz,a.Weapon=="spear"?.10f:.18f,true,ref limit,out target,out game,out shieldHit);
            // A swinging blade can catch the near edge of a body during its cut.
            // Each sample has its own solid-cover test. Thrusts retain a straight point.
            if(target==null&&game==null&&surface==null&&limit>=reach-.001f&&(a.Weapon=="knife"||a.Weapon=="hatchet"||a.Weapon=="sword")){
                for(int j=0;j<4;j++){
                    float offset=(j/2+1)*(j%2==0?1:-1)*a.MeleeSide*(a.Weapon=="sword"?.18f:a.Weapon=="hatchet"?.145f:.105f);
                    float sx=(float)Math.Sin(a.Yaw+offset)*cp,sz=(float)Math.Cos(a.Yaw+offset)*cp,sideLimit;
                    Prop cover=Arena.RayProp(this,x,y,z,sx,sp,sz,reach*.96f,out sideLimit);
                    TraceBodies(a,x,y,z,sx,sp,sz,.08f,true,ref sideLimit,out target,out game,out shieldHit);
                    if(target!=null||game!=null||cover!=null&&(cover.Kind=="structure"||Harvestable(cover))){
                        dx=sx;dz=sz;limit=sideLimit;surface=cover;break;
                    }
                }
            }
            float baseDamage=a.Weapon=="sword"?34:a.Weapon=="hatchet"?29:a.Weapon=="spear"?25:a.Weapon=="knife"?22:12;
            float damage=baseDamage*(a.Heavy?1.6f:1);
            ImpactSite contact=new ImpactSite(x+dx*limit,y+sp*limit,z+dz*limit,dx,sp,dz,a.Weapon);
            if(target!=null)HitActor(target,a,damage,false,contact,shieldHit);
            else if(game!=null)HitAnimal(game,a,damage,false,contact);
            else if(surface!=null&&surface.Kind=="structure"){
                float chop=(a.Weapon=="hatchet"?51:a.Weapon=="fists"?8:18)*(a.Heavy?1.7f:1);
                bool broken=Arena.HitStructure(this,surface,chop);
                HitEffect("wood",x+dx*limit,y+sp*limit,z+dz*limit,8);SoundAt(a,32);Cue("wood",x,z,32);
                if(a==Player)Say(broken?"Breach open  •  Recover fallen wood":surface.Label+"  "+(int)Math.Ceiling(surface.HP)+" / "+(int)surface.MaxHP);
            } else if(surface!=null&&!HarvestContact(a,surface,contact)){HitEffect("spark",x+dx*limit,y+sp*limit,z+dz*limit,4);Cue("guard",x,z,13);}
        }
        void HitEffect(string type,float x,float y,float z,int n){
            for(int i=0;i<n;i++)Effects.Add(new Effect{Type=type,X=x,Y=y,Z=z,DX=(float)(Rng.NextDouble()-.5)*1.5f,DZ=(float)(Rng.NextDouble()-.5)*1.5f,DY=(float)Rng.NextDouble()*1.7f,Life=.16f+(float)Rng.NextDouble()*.28f});
        }
        void HitActor(Actor target,Actor source,float damage,bool ranged,ImpactSite site,bool shieldHit){
            if(!target.Alive||Winner!=null||Evading(target)||Brains.Allied(this,source,target))return;
            Brains.Hostility(this,target,source);
            bool strong=StrongContact(site.Implement,ranged,source.Heavy,damage);
            string focus=target==Player||source==Player?"focus_":"";
            GuardOutcome result=GuardStrike(target,source,site,ranged,shieldHit,ref damage);
            if(ranged&&(site.Implement=="arrow"||site.Implement=="bolt"))Brains.AlertShot(this,target,source,site.DX,site.DZ);
            bool guarded=result!=GuardOutcome.Miss;
            if(guarded){
                bool timed=result==GuardOutcome.Parry;
                if(timed&&!ranged){source.NextAttack=Math.Max(source.NextAttack,1.0f);source.Stamina=Math.Max(0,source.Stamina-10);}
                if(source==Player&&timed)Say("Parried");Cue(focus+(timed?"parry":"guard"),target.X,target.Z,22);
            }
            if(damage>.1f){
                damage=Armor.Absorb(this,target,damage,site);
                target.Health-=damage;target.Hurt=.42f;
                target.HitDirection=(float)Math.Atan2(site.DX,site.DZ);
                target.HitStrength=Math.Min(1,.12f+damage/50f);
                EmitImpact(site,damage,strong&&!guarded,false,false,false);
                if(!guarded)Cue(focus+ContactSound(site,strong),site.X,site.Z,20);
                ReportInjury(target,(float)Math.Atan2(-site.DX,-site.DZ),damage);
                if(target!=Player||HostingOnlineRound)ConfirmContact(source);
            }
            if(target.Health<=0)Eliminate(target,source);
        }
        void HitAnimal(Animal a,Actor source,float damage,bool ranged,ImpactSite site){
            if(!a.Alive)return;
            a.HP-=damage;a.Alert=6;if(a.HP<=0){a.Alive=false;a.State="fallen";if(source==Player) Say("Game down  •  Approach to harvest");}
            else {a.State="alert";Wildlife.OnHit(this,a,source,ranged,site);}
            bool strong=StrongContact(site.Implement,ranged,source.Heavy,damage);
            EmitImpact(site,damage,strong,false,false,true);
            ConfirmContact(source);
            Cue((source==Player?"focus_":"")+ContactSound(site,strong),site.X,site.Z,16);Cue("rustle",a.X,a.Z,15);
        }
        public void Shove(Actor a){
            if(a==null||!a.Alive||a.Stamina<16||a.NextAttack>0)return;
            a.Stamina-=16;a.NextAttack=.7f;a.SwingSpan=.30f;a.Swing=a.SwingSpan;
            a.MeleeStroke=a.SpearThrust=false;a.ShoveStroke=true;
            float dx=(float)Math.Sin(a.Yaw),dz=(float)Math.Cos(a.Yaw),y=a.Y+(a.Crouch?.86f:1.16f);
            float d;Arena.RayProp(this,a.X,y,a.Z,dx,0,dz,1.85f,out d);
            Actor t;Animal wild;bool shieldHit;
            TraceBodies(a,a.X,y,a.Z,dx,0,dz,.19f,false,ref d,out t,out wild,out shieldHit);
            if(t!=null&&!Brains.Allied(this,a,t)&&!Evading(t)){
                Brains.Hostility(this,t,a);
                for(int i=0;i<5;i++)Arena.Move(this,t,dx*.31f,dz*.31f);
                t.Guard=false;t.Windup=0;t.Throwing=false;t.ProjectileId="";t.SpearThrust=false;t.DrawPower=0;t.NextAttack=Math.Max(.67f,t.NextAttack);t.Stamina=Math.Max(0,t.Stamina-14);t.Hurt=.27f;t.HitDirection=a.Yaw;t.HitStrength=.68f;Cue("hit",t.X,t.Z,17);
            }SoundAt(a,14);
        }
        void UpdateShots(float dt){
            for(int i=Shots.Count-1;i>=0;i--){
                if(Winner!=null)break;
                Shot s=Shots[i];float left=dt;
                while(left>.00001f){
                    float step=Math.Min(left,1f/45);left-=step;
                    if(AdvanceShot(s,step)){Shots.RemoveAt(i);break;}
                }
            }
        }
        bool AdvanceShot(Shot s,float dt){
                // Integrate the parabolic trajectory exactly and sweep each short chord
                // against the same cover, terrain and body geometry used by melee.
                s.Life-=dt;s.Age+=dt;
                float vx=s.DX,vy=s.DY-.5f*s.Gravity*dt,vz=s.DZ;
                float v=(float)Math.Sqrt(vx*vx+vy*vy+vz*vz),advance=v*dt;
                if(v<.0001f)return true;
                float dx=vx/v,dy=vy/v,dz=vz/v,dist;Prop obstacle=Arena.RayProp(this,s.X,s.Y,s.Z,dx,dy,dz,advance,out dist);
                Actor victim; Animal animal;bool shieldHit;
                TraceBodies(s.Owner,s.X,s.Y,s.Z,dx,dy,dz,.035f,true,ref dist,out victim,out animal,out shieldHit);
                if(victim!=null||animal!=null||obstacle!=null||dist<advance-.0002f||s.Life<=0){
                    ImpactSite contact=new ImpactSite(s.X+dx*dist,s.Y+dy*dist,s.Z+dz*dist,dx,dy,dz,s.Model);
                    if(victim!=null)HitActor(victim,s.Owner,s.Damage,true,contact,shieldHit);else if(animal!=null)HitAnimal(animal,s.Owner,s.Damage,true,contact);
                    else if(obstacle!=null&&obstacle.Kind=="structure"){
                        Arena.HitStructure(this,obstacle,s.Model=="spear"?11:4);
                        HitEffect("wood",contact.X,contact.Y,contact.Z,s.Model=="spear"?6:3);
                        Cue("wood",contact.X,contact.Z,12);
                    }
                    if(s.Model=="spear"||s.Model=="arrow"||s.Model=="bolt"){
                        float back=obstacle!=null?.38f:.05f, land=Math.Max(-back,dist-back);
                        float x=s.X+dx*land,z=s.Z+dz*land,r=Distance(x,z,0,0);
                        if(r>Arena.Radius-1){float scale=(Arena.Radius-1)/r;x*=scale;z*=scale;}
                        var p=new Prop{Kind="pickup",Item=ShotAmmo(s.Model),Model=s.Model,
                            Label=s.Model=="bolt"?"Spent bolt":s.Model=="arrow"?"Spent arrow":"Thrown spear",X=x,Z=z,Y=Arena.GroundBelow(this,x,z,s.Y+dy*land+.045f)+.035f,Yaw=(float)Math.Atan2(dx,dz),Amount=1,Owner=s.Owner.Id};
                        Arena.Register(this,p);
                    }
                    return true;
                }
                s.X+=vx*dt;s.Y+=vy*dt;s.Z+=vz*dt;s.DY-=s.Gravity*dt;
                return false;
        }
    }
}
