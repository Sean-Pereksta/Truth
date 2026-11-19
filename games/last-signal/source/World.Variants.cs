using System;

namespace LastSignal
{
    public static partial class Arena
    {
        static bool OpenBiomeSite(Game g,float x,float z,float pad)
        {
            float rr=x*x+z*z;
            return rr>22*22&&rr<(Radius-3)*(Radius-3)&&Water(x,z)<.36f&&CanStand(g,x,Ground(g,x,z)+.02f,z,pad,1.45f);
        }
        static void BiomeBridge(Game g,float x,float z,float level,float yaw,int segments)
        {
            float dx=Sin(yaw),dz=Cos(yaw);
            for(int i=0;i<segments;i++){
                float off=(i-(segments-1)*.5f)*4.92f;
                Decor(g,"bridge",x+off*dx,z+off*dz,1,yaw,level+.34f);
            }
        }
        static void BiomeLandmarks(Game g)
        {
            bool gorge=Variant==1;
            if(gorge){
                Decor(g,"sand_arch",-52,-12,1.36f,.92f);
                Decor(g,"sand_arch",41,-81,1.48f,.14f);
                Decor(g,"sand_arch",-112,63,1.15f,-.62f);
                Decor(g,"watchtower",62,80,.93f,.55f);
                Decor(g,"aqueduct",-52,-144,.92f,.72f);
                for(int i=0;i<15;i++){
                    float z=-65+i*7.55f,x=-78+12*Sin(z*.048f);
                    if(OpenBiomeSite(g,x,z,1.4f)&&Path(x,z)<.70f)Decor(g,"sand_hoodoo",x,z,1.14f+.48f*Cos(i*2),i*.44f);
                }
            }else{
                Decor(g,"signal_lodge",-27,-47,1.05f,.56f);
                Decor(g,"signal_lodge",33,114,.98f,-.82f);
                Decor(g,"watchtower",-110,83,1.02f,.32f);
                for(int i=0;i<16;i++){
                    float x=-49+i*6.2f,z=-94+12*Cos(x*.049f);
                    if(OpenBiomeSite(g,x,z,.95f)&&Path(x,z)<.72f)Decor(g,"ice_teeth",x,z,.88f+.37f*Sin(i*2.24f),i*.48f);
                }
                Decor(g,"aqueduct",-53,-62,1.10f,1.2f);
            }
            float bx=gorge?75:94,bz=BasinLine(bx);
            BiomeBridge(g,bx,bz,BasinLevel(bx),0,gorge?3:4);
            Decor(g,"floodgate",bx+12,bz-BasinWidth(bx)-4.7f,1,gorge?.32f:-.26f);
            for(int d=1;d<=4;d++){
                float x,z;PolarSite(d,gorge?37+3*d:42+2*d,TrackCenter(48,d)+(d%2==0?-7:7),out x,out z);
                if(Water(x,z)>.1f){z+=9;x+=3;}
                Decor(g,"spring",x,z,1,d*.92f);
                PolarSite(d,33+5*d,TrackCenter(33+5*d,d)+(d%2==0?7:-8),out x,out z);
                if(Water(x,z)>.1f)z-=10;
                Decor(g,"stove",x,z,1,d*.65f);
                if(d!=2){
                    float level;StreamPoint(d,gorge?11:-13,out x,out level,out z);
                    BiomeBridge(g,x,z,level,d==1?1.5707963f:0,2);
                }
            }
        }
        static void BiomeSupplies(Game g,Random r,int district)
        {
            string[] materials={"branch","stone","fiber","tinder","cloth","scrap"};
            for(int n=0;n<20;n++){
                float f=n<2?25+n*8:n<11?Rand(r,40,113):Rand(r,119,189);
                float side=n<2?TrackCenter(f,district)+(n==0?3:-3):Rand(r,-.54f*f,.54f*f);
                float bx,bz;PolarSite(district,f,side,out bx,out bz);
                for(int item=0;item<materials.Length;item++)
                for(int t=0;t<9;t++){
                    float a=WorldYaw(r),dist=Rand(r,1.0f,5.1f),x=bx+Sin(a)*dist,z=bz+Cos(a)*dist;
                    if(!OpenBiomeSite(g,x,z,.25f))continue;
                    Drop(g,materials[item],item<2?4:item==2?3:item==3?2:1,x,z);break;
                }
            }
        }
        static void BiomeAnimals(Game g,Random r,int district)
        {
            float hx,hz;HuntingGround(district,out hx,out hz);
            for(int j=0;j<15;j++)for(int a=0;a<32;a++){
                float x,z;
                if(j<8){float f=Rand(r,41,111);PolarSite(district,f,Rand(r,-f*.44f,f*.42f),out x,out z);}
                else{float dir=WorldYaw(r),dist=Rand(r,2,19);x=hx+Sin(dir)*dist;z=hz+Cos(dir)*dist;}
                if(!OpenBiomeSite(g,x,z,.55f))continue;
                string animal=j%3==0?"hare":j%3==1?"hen":"grazer";
                g.Animals.Add(new Animal{Model=animal,X=x,Y=Ground(g,x,z),Z=z,HP=animal=="hare"?17:animal=="hen"?16:52,Yaw=WorldYaw(r),Timer=Rand(r,.8f,6f),Anim=WorldYaw(r)});break;
            }
        }
        static string BiomePlant(int sector,float roll)
        {
            if(Variant==1){
                if(sector==1||sector==3)return roll<.37f?"mesa_rock":roll<.47f?"sand_hoodoo":roll<.78f?"yucca":roll<.95f?"pinon":"shore_rocks";
                if(sector==2)return roll<.30f?"pinon":roll<.62f?"yucca":roll<.75f?"rushes":roll<.92f?"mesa_rock":"rock";
                return roll<.52f?"pinon":roll<.79f?"yucca":roll<.93f?"mesa_rock":"sand_hoodoo";
            }
            if(sector==1||sector==4)return roll<.66f?"snow_fir":roll<.83f?"snow_heath":"snow_boulder";
            if(sector==2)return roll<.37f?"snow_fir":roll<.68f?"snow_heath":roll<.88f?"snow_boulder":"ice_teeth";
            return roll<.35f?"ice_teeth":roll<.60f?"snow_boulder":roll<.79f?"snow_heath":"snow_fir";
        }
        static void PopulateVariant(Game g,Random r)
        {
            BiomeLandmarks(g);
            string brush=Variant==1?"yucca":"snow_heath";
            for(int d=1;d<=4;d++){
                float hx,hz;HuntingGround(d,out hx,out hz);
                for(int n=0;n<390;n++){
                    float f=Rand(r,26,201),side=Rand(r,-f*.99f,f*.99f),x,z;PolarSite(d,f,side,out x,out z);
                    if(!OpenBiomeSite(g,x,z,.84f)||Path(x,z)>.59f||Game.Distance(x,z,hx,hz)<9f)continue;
                    string model=BiomePlant(d,(float)r.NextDouble());
                    Decor(g,model,x,z,Rand(r,.62f,model=="sand_hoodoo"?1.35f:1.29f),WorldYaw(r));
                }
                for(int n=0;n<44;n++){
                    float f=Rand(r,27,183),side=AltPathCenter(f,d)+(n%2==0?-1:1)*Rand(r,1.4f,3.1f),x,z;
                    PolarSite(d,f,side,out x,out z);
                    if(OpenBiomeSite(g,x,z,.32f))Decor(g,brush,x,z,Rand(r,.83f,1.22f),WorldYaw(r));
                }
                for(int n=0;n<28;n++){
                    float a=WorldYaw(r),dist=Rand(r,11,20),x=hx+Sin(a)*dist,z=hz+Cos(a)*dist;
                    if(OpenBiomeSite(g,x,z,.53f))Decor(g,n%5==0?(Variant==1?"pinon":"snow_fir"):brush,x,z,Rand(r,.66f,1.17f),WorldYaw(r));
                }
                for(int i=0;i<48;i++){
                    float x,z,level,bank=Rand(r,3.2f,7.6f)*(i%2==0?1:-1);
                    if(d==2){x=Rand(r,43,194);z=BasinLine(x)+(i%2==0?1:-1)*(BasinWidth(x)+Rand(r,.1f,3f));}
                    else{StreamPoint(d,Rand(r,-89,89),out x,out level,out z);if(d==1)x+=bank;else z+=bank;}
                    if(!OpenBiomeSite(g,x,z,.22f)||Path(x,z)>.8f)continue;
                    Decor(g,i%4==0?"shore_rocks":Variant==1?(d==2?"rushes":"yucca"):"snow_heath",x,z,Rand(r,.61f,1.11f),WorldYaw(r));
                }
                BiomeSupplies(g,r,d);BiomeAnimals(g,r,d);
            }
        }
    }
}
