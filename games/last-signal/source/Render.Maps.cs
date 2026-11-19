using System;

namespace LastSignal
{
    public sealed partial class Renderer
    {
        sealed class MapDrawing
        {
            public uint Ground,Soil,Terrain,Trim,River,Basin;
            public Ripple[] Ripples;
        }
        readonly MapDrawing[] mapDrawings=new MapDrawing[3];
        int renderedMap=-1;
        uint originalGround,originalSoil;
        void BindArenaMap(int id)
        {
            id=Math.Max(0,Math.Min(2,id));
            if(Arena.Variant!=id)Arena.Select(id);
            if(renderedMap==id)return;
            if(originalGround==0){originalGround=ground;originalSoil=soil;}
            renderedMap=id;ripples.Clear();floodLevel=0;previousClock=0;
            MapDrawing cached=mapDrawings[id];
            if(cached!=null){
                ground=cached.Ground;soil=cached.Soil;terrain=cached.Terrain;arenaTrim=cached.Trim;
                streamMesh=cached.River;basinMesh=cached.Basin;ripples.AddRange(cached.Ripples);return;
            }
            string prefix=id==1?"gorge":"frost";
            ground=id==0?originalGround:LoadTexture(prefix+"_floor.png",true);
            soil=id==0?originalSoil:LoadTexture(prefix+"_path.png",true);
            BuildTerrain();BuildTrim();BuildWater();
            mapDrawings[id]=new MapDrawing{Ground=ground,Soil=soil,Terrain=terrain,Trim=arenaTrim,
                River=streamMesh,Basin=basinMesh,Ripples=ripples.ToArray()};
        }
        static void VariantGround(float x,float z,float brightness,int zone)
        {
            if(Arena.Variant==1){
                float bed=zone==2?.94f:1f;
                float bands=.975f+.025f*S(Arena.Height(x,z)*2.4f);
                glColor3f(brightness*bands,brightness*(zone==3?.83f:.91f)*bed,brightness*.80f*bed);
            }else{
                float y=Arena.Height(x,z),stone=Bound((y-13)/13,0,1);
                float canopy=zone==1?.93f:1f;
                glColor3f((1-.23f*stone)*canopy,(.99f-.16f*stone)*canopy,(1-.10f*stone)*canopy);
            }
        }
    }
}
