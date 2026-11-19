import math,struct,zlib,numpy as np
from pathlib import Path
out=Path(__file__).resolve().parents[2] / "Assets"
def write(name,img):
    a=np.asarray(np.clip(img,0,255),dtype=np.uint8)
    h,w=a.shape[:2]
    def chunk(t,d):
        return struct.pack(">I",len(d))+t+d+struct.pack(">I",zlib.crc32(t+d)&0xffffffff)
    buf=b"".join(b"\0"+r.tobytes() for r in a)
    (out/name).write_bytes(b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">2I5B",w,h,8,6,0,0,0))+chunk(b"IDAT",zlib.compress(buf,8))+chunk(b"IEND",b""))
def smooth(a,b,x):
    t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)
def noise(x,y,n,seed):
    rng=np.random.default_rng(seed);grid=rng.random((n,n))
    xx=x*n; yy=y*n;ix=np.floor(xx).astype(int);iy=np.floor(yy).astype(int)
    tx=xx-ix;ty=yy-iy;tx=tx*tx*(3-2*tx);ty=ty*ty*(3-2*ty)
    return (1-ty)*((1-tx)*grid[iy%n,ix%n]+tx*grid[iy%n,(ix+1)%n])+ty*((1-tx)*grid[(iy+1)%n,ix%n]+tx*grid[(iy+1)%n,(ix+1)%n])
sz=128
u,v=np.meshgrid((np.arange(sz)+.5)/sz,(np.arange(sz)+.5)/sz)
sheet=np.zeros((sz*4,sz*4,4))
for n in range(16):
    phase=n*2*np.pi/16;y=1-v
    freq=.012*noise(u,v,22,59)+.038*np.sin(y*11-phase*2)*y
    x=(u-.5)*2; hot=np.zeros_like(x)
    for j in range(7):
        a=j*3.139;cen=.52*np.sin(a+.42)
        peak=.36+.51*(.5+.5*np.cos(j*2.52+phase*.0))+.055*np.sin(phase+a)
        slant=(.15*np.sin(a*1.72+phase)+.10*np.sin(y*13.4-phase+a))*(y+.1)
        width=(.11+.10*(.5+.5*np.sin(j*2.70)))*(1-.5*y)
        taper=smooth(0,.97,np.clip(1-y/peak,0,1))**.40
        profile=1-abs(x-cen*(1-y*.31)-slant-freq)/(width*taper+.009)
        hot=np.maximum(hot,np.maximum(profile,0)*smooth(-.035,.09,y)*(1-smooth(peak-.04,peak+.015,y))*(1-.34*y))
    turbulence=.57*noise(u,v+n/16,7,31)+.28*noise(u,v+n/16,14,53)+.15*noise(u,v+n/16,32,32)
    heat=np.clip(hot*(.8+.32*turbulence)+.45*np.maximum(0,1-abs(x)*1.65)*np.exp(-10*y),0,1)
    alpha=smooth(.015,.32,heat)*(.75+.24*heat)*smooth(0,.045,y)*smooth(0,.07,u)*smooth(0,.07,1-u)
    r=252+3*heat;g=58+180*heat**.70;b=6+117*heat**2.4
    frame=np.stack((r,g,b,alpha*255),axis=2);sheet[(n//4)*sz:(n//4+1)*sz,(n%4)*sz:(n%4+1)*sz]=frame
write("flame.png",sheet)
sheet=np.zeros((sz*2,sz*2,4))
for n in range(4):
    mask=.52*noise(u,v,4,259+n)+.25*noise(u,v,8,535+n)+.14*noise(u,v,16,91+n)+.09*noise(u,v,34,19+n)
    radius=np.sqrt(((u-.5)*2.03)**2+((v-.5)*2.17)**2)
    a=smooth(.09,.82,(1-radius)+.87*(mask-.50))*smooth(0,.08,u)*smooth(0,.08,1-u)
    c=119+67*mask+12*(1-v)
    sheet[(n//2)*sz:(n//2+1)*sz,(n%2)*sz:(n%2+1)*sz]=np.stack((c*.97,c,c*.96,a*255),axis=2)
write("smoke.png",sheet)
