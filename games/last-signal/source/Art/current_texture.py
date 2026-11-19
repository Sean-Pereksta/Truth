import numpy as np,struct,zlib
from pathlib import Path
size=256
u,v=np.meshgrid((np.arange(size)+.5)/size,(np.arange(size)+.5)/size)
a,b=2*np.pi*u,2*np.pi*v
def ripple(k,l,x,y):
    return np.sin(k*a+l*b+.85*np.sin(x*a-y*b)+.40*np.cos((x+1)*a+(y+1)*b))
coarse=ripple(2,5,1,2)*.44+ripple(-2,6,2,1)*.30+ripple(4,12,1,1)*.26
medium=ripple(5,18,3,2)*.59+ripple(-7,13,1,4)*.41
high=ripple(11,32,3,7)*.61+ripple(-13,27,4,2)*.39
line=np.exp(-28*(coarse+medium*.30)**2)*(.35+.65*(.5+.5*high))
q=221+14*coarse+8*medium+17*line+4*high
im=np.uint8(np.clip(np.stack([q*.98,q,q+2*line],axis=2),0,255))
def chunk(t,d):return struct.pack(">I",len(d))+t+d+struct.pack(">I",zlib.crc32(t+d)&0xffffffff)
(Path(__file__).resolve().parents[2] / "Assets" / "current.png").write_bytes(b"\x89PNG\r\n\x1a\n"+chunk(b'IHDR',struct.pack(">2I5B",size,size,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b"".join(b"\0"+r.tobytes() for r in im),8))+chunk(b'IEND',b''))
