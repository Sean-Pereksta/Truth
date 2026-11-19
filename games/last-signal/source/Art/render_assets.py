import numpy as np
import struct, zlib, os

D=os.path.join(os.path.dirname(__file__),"..","..","Assets")
os.makedirs(D,exist_ok=True)
def png(name,a):
    a=np.asarray(np.clip(a,0,255),np.uint8)
    def chunk(t,d):
        return struct.pack(">I",len(d))+t+d+struct.pack(">I",zlib.crc32(t+d)&0xffffffff)
    h,w=a.shape[:2]
    data=b"".join(b"\0"+row.tobytes() for row in a)
    open(os.path.join(D,name+".png"),"wb").write(b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">2I5B",w,h,8,2,0,0,0))+chunk(b"IDAT",zlib.compress(data,7))+chunk(b"IEND",b""))

def noise(u,v,w,h,seed):
    rng=np.random.default_rng(seed)
    grid=rng.random((h,w))
    xx=u*w; yy=v*h
    ix=np.floor(xx).astype(int); iy=np.floor(yy).astype(int)
    tx=xx-ix; ty=yy-iy
    tx=tx*tx*(3.-2.*tx); ty=ty*ty*(3.-2.*ty)
    a=grid[iy%h,ix%w]*(1-tx)+grid[iy%h,(ix+1)%w]*tx
    b=grid[(iy+1)%h,ix%w]*(1-tx)+grid[(iy+1)%h,(ix+1)%w]*tx
    return a*(1-ty)+b*ty

def fb(u,v,w,h,seed):
    return sum(noise(u,v,w*(2**i),h*(2**i),seed+i*97)*a for i,a in enumerate([.48,.26,.14,.08,.04]))
def mix(a,b,t):
    return a*(1-t[...,None])+b*t[...,None]
def smooth(a,b,x):
    t=np.clip((x-a)/(b-a),0,1)
    return t*t*(3-2*t)

w,h=2048,512
u,v=np.meshgrid(np.arange(w)/w,np.arange(h)/h)
horizon=.76
sky=mix(np.array([52,92,118]),np.array([224,202,156]),np.clip(v/horizon,0,1)**.85)
distance=np.minimum(abs(u-.15),1-abs(u-.15))*3.45
sunr=np.sqrt(distance**2+(v-.62)**2)
glow=np.exp(-sunr*6)*.91
sky=mix(sky,np.array([255,213,149]),glow)
cloud=fb(u+.012*noise(u,v,11,9,38),v,14,12,5)
cloud2=fb(u,v,7,27,199)
body=smooth(.44,.69,cloud+.18*(cloud2-.5))*(1-smooth(.63,.77,v))
shade=mix(np.array([144,158,165]),np.array([255,234,191]),smooth(.44,.71,cloud2)*.84+glow*.16)
sky=mix(sky,shade,np.clip(body*(.68+.22*v),0,.88))
sky=mix(sky,np.array([255,250,212]),1-smooth(.017,.021,sunr))
for i,(baseline,amplitude,col,seed) in enumerate([(.705,.065,[150,155,151],43),(.756,.090,[123,140,141],75),(.789,.064,[97,117,118],11),(.821,.058,[73,99,96],17)]):
    ridge=baseline-amplitude*fb(u,u*0,13+i*3,2,seed)-.018*np.sin(u*6.28*(3+i))
    ridge-=.012*noise(u,v*0,1700,2,111+i) if i>=2 else 0
    side=fb(u,v,75,19,seed+191)
    layer=np.array(col)[None,None,:]+(side[...,None]-.5)*18
    sky=mix(sky,layer,smooth(-.0007,.0012,v-ridge))
sky=mix(sky,np.array([94,113,106]),smooth(.83,1.,v)*.7)
png("sky",sky)

w=h=512
u,v=np.meshgrid(np.arange(w)/w,np.arange(h)/h)
rng=np.random.default_rng(68275)
def surface(cold,warm,seed):
    v1=fb(u,v,6,6,seed)
    group=fb(u,v,27,27,seed+23)
    finer=noise(u,v,175,175,seed+64)
    brush=noise(u+.01*(group-.5),v,190,60,seed+71)
    t=np.clip(.59*v1+.29*group+.12*finer,0,1)
    return mix(np.array(cold),np.array(warm),t)+(brush[...,None]-.5)*19+(rng.random((h,w,1))-.5)*8
grass=surface([76,82,55],[195,181,134],21)
for k in range(10000):
    x=int(rng.integers(w)); y=int(rng.integers(h)); n=int(rng.integers(2,9))
    dx=float(rng.uniform(-.68,.68)); tint=rng.uniform(-24,24)
    for j in range(n):
        grass[(y-j)%h,(x+int(dx*j))%w]+=tint*(1-j/n)
png("ground",grass)
soil=surface([88,74,58],[214,188,148],87)
for k in range(2600):
    x=int(rng.integers(w)); y=int(rng.integers(h))
    rx=int(rng.integers(1,5)); ry=int(rng.integers(1,3))
    tint=rng.uniform(6,33)
    for i in range(-rx,rx+1):
        for j in range(-ry,ry+1):
            if (i/rx)**2+(j/ry)**2<1.12: soil[(y+j)%h,(x+i)%w]+=tint*(1. if j<=0 else -.63)
png("soil",soil)
stone=surface([106,103,92],[211,204,179],49)
x=u*4
y=v*6
row=np.floor(y).astype(int)
x+=(row%2)*.5
x+=.024*(noise(u,v,59,59,33)-.5)
y+=.02*(noise(u,v,54,54,93)-.5)
seam=np.minimum(np.minimum(x%1,1-x%1),np.minimum(y%1,1-y%1)*.72)
joint=1-smooth(.004,.018,seam)
stone=mix(stone,np.array([73,69,60]),joint*.93)
stone+=((1-smooth(.015,.046,seam))*(1-joint)*np.where((x%1<.5)|(y%1<.5),7,-7))[...,None]
png("pavers",stone)
