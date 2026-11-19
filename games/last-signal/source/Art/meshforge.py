import math
import os
import random
import struct
import zlib
from collections import OrderedDict


TAU = 2 * math.pi
SIN, COS = math.sin, math.cos
objects = OrderedDict()
model = None
part = None


def vec(a, b):
    return tuple(x + y for x, y in zip(a, b))


def sub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def mul(a, f):
    return tuple(x * f for x in a)


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def dot(a, b):
    return sum(x * y for x, y in zip(a,b))


def unit(a):
    return mul(a, 1 / max(.000001, math.sqrt(dot(a,a))))


def col(c):
    if isinstance(c, str):
        return tuple(int(c[i:i+2], 16)/255.0 for i in (0,2,4))
    return c


def begin(name):
    global model
    model = objects[name] = []
    bone('root', -1, (0,0,0))


def bone(name, parent, xyz):
    global part
    if isinstance(parent, str):
        parent = next(i for i,p in enumerate(model) if p['name'] == parent)
    part = {'name':name, 'parent':parent, 'pivot':xyz, 'v':[]}
    model.append(part)


def select(name):
    global part
    part=next(p for p in model if p['name']==name)


def shift_geometry(offset):
    part['v']=[(*vec(v[:3],offset),*v[3:]) for v in part['v']]


material_grid={'metal':(0,0),'wood':(1,0),'stone':(2,0),'steel':(3,0),'ground':(0,1),'cloth':(1,1),'skin':(2,1),'fur':(3,1),'leaf':(0,2),'bark':(1,2),'feather':(2,2),'charcoal':(3,2),'gilt':(0,3),'patina':(1,3)}


def texture_uv(mat,u,v):
    tx, row = material_grid[mat]
    return ((tx+.021+.958*u)*.25,(3-row+.021+.958*v)*.25)


def tri(a,b,c,tint,mat='cloth',uv=None,normals=None,front=None):
    if uv is None:
        uv=((.03,.05),(.97,.05),(.55,.95))
    n = unit(cross(sub(b,a),sub(c,a)))
    if front is not None and dot(n,front)<0:
        b,c=c,b
        uv=(uv[0],uv[2],uv[1])
        if normals: normals=(normals[0],normals[2],normals[1])
        n=mul(n,-1)
    if dot(n,n)<.3: return
    tint=col(tint)
    for pos,co,nor in zip((a,b,c),uv,normals if normals else (n,n,n)):
        part['v'].append((*pos,*nor,*texture_uv(mat,*co),*tint))


def quad(a,b,c,d,tint,mat='cloth',front=None,uv=None):
    if uv is None: uv=((.025,.025),(.975,.025),(.975,.975),(.025,.975))
    tri(a,b,c,tint,mat,(uv[0],uv[1],uv[2]),front=front)
    tri(a,c,d,tint,mat,(uv[0],uv[2],uv[3]),front=front)


def hoopmesh(rings, centers, tint, mat='cloth', capped=True, inside=False, smooth=.58, variation=.045):
    """Closed ring loft, outward normals blended between flat and radial."""
    n=len(rings[0])
    tint=col(tint)
    organic=mat in ('skin','fur','feather','leaf')
    if organic:
        smooth=max(smooth,.90 if mat!='leaf' else .65)
        variation*=.28 if mat!='leaf' else .50
        vertex_normals=[]
        for j,ringpts in enumerate(rings):
            last=rings[max(0,j-1)]
            following=rings[min(len(rings)-1,j+1)]
            row=[]
            for i,point in enumerate(ringpts):
                tangent=sub(ringpts[(i+1)%n],ringpts[(i-1)%n])
                along=sub(following[i],last[i])
                normal=unit(cross(tangent,along))
                radial=sub(point,centers[j])
                if dot(normal,radial)<0:normal=mul(normal,-1)
                row.append(normal)
            vertex_normals.append(row)
    for j in range(len(rings)-1):
        for i in range(n):
            k=(i+1)%n
            pts=(rings[j][i],rings[j][k],rings[j+1][k],rings[j+1][i])
            rads=(sub(pts[0],centers[j]),sub(pts[1],centers[j]),sub(pts[2],centers[j+1]),sub(pts[3],centers[j+1]))
            radial=unit(vec(rads[0],rads[2]))
            nrm=unit(cross(sub(pts[1],pts[0]),sub(pts[2],pts[0])))
            if dot(nrm,radial)<0:nrm=mul(nrm,-1)
            sign=-1 if inside else 1
            curved=(vertex_normals[j][i],vertex_normals[j][k],vertex_normals[j+1][k],vertex_normals[j+1][i]) if organic else rads
            nors=[mul(unit(vec(mul(nrm,1-smooth),mul(unit(r),smooth))),sign) for r in curved]
            uv=((i/n,j/(len(rings)-1)),((i+1)/n,j/(len(rings)-1)),((i+1)/n,(j+1)/(len(rings)-1)),(i/n,(j+1)/(len(rings)-1)))
            color=mul(tint,1+variation*SIN(i*13.52+j*17.124))
            for inds in ((0,1,2),(0,2,3)):
                tri(*(pts[p] for p in inds),color,mat,tuple(uv[p] for p in inds),tuple(nors[p] for p in inds),mul(radial,sign))
    if capped:
        for j,h in ((0,1),(-1,-2)):
            front=unit(sub(centers[j],centers[h]))
            for i in range(n):
                tri(centers[j],rings[j][i],rings[j][(i+1)%n],tint,mat,front=front)


def loft(rows, tint, mat='cloth',n=10,smooth=.57,phase=0):
    # (cx,cy,cz,rx,rz) cross-sections along vertical axis
    rings=[[(x+rx*COS(phase+i*TAU/n),y,z+rz*SIN(phase+i*TAU/n)) for i in range(n)] for x,y,z,rx,rz in rows]
    hoopmesh(rings,[r[:3] for r in rows],tint,mat,smooth=smooth)


def ell(pos,rad,tint,mat='cloth',n=10,bands=5):
    x,y,z=pos; rx,ry,rz=rad
    if mat in ('fur','skin','feather') and max(rad)>.077:
        n=max(n,15);bands=max(bands,8)
    rows=[]
    for j in range(bands+1):
        a=-math.pi*.496+j*math.pi*.992/bands
        rows.append((x,y+ry*SIN(a),z,rx*COS(a),rz*COS(a)))
    loft(rows,tint,mat,n,.65)


def parallel_ring(cent, direction, rx, rz, count, phase=0):
    direction=unit(direction)
    r=unit(cross(direction,(0,0,1) if abs(direction[2])<.96 else (0,1,0)))
    s=unit(cross(direction,r))
    return [vec(cent,vec(mul(r,rx*COS(phase+i*TAU/count)),mul(s,rz*SIN(phase+i*TAU/count)))) for i in range(count)]


def tube(points,radii,tint,mat='wood',n=7,smooth=.35):
    rings=[]
    for i,p in enumerate(points):
        d=sub(points[min(len(points)-1,i+1)],points[max(0,i-1)])
        r=radii[i] if isinstance(radii,(list,tuple)) else radii
        rings.append(parallel_ring(p,d,r,r,n))
    hoopmesh(rings,points,tint,mat,smooth=smooth)


def rod(a,b,r1,r2,tint,mat='wood',n=8):
    tube([a,b],[r1,r2],tint,mat,n)


def box(c,size,color,mat='wood',ang=0):
    w,h,d=[a*.5 for a in size]
    def tr(x,y,z): return (c[0]+x*COS(ang)+z*SIN(ang),c[1]+y,c[2]-x*SIN(ang)+z*COS(ang))
    pts=[tr(x,y,z) for y in (-h,h) for z in (-d,d) for x in (-w,w)]
    for inds in ((0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)):
        vs=[pts[i] for i in inds]; front=sub(mul(tuple(sum(v[k] for v in vs) for k in range(3)),.25),c)
        quad(*vs,color,mat,front)


def ribbon(points,widths,tint,mat='cloth',dx=(1,0,0),front=(0,0,1)):
    for i in range(len(points)-1):
        quad(sub(points[i],mul(dx,widths[i])),vec(points[i],mul(dx,widths[i])),vec(points[i+1],mul(dx,widths[i+1])),sub(points[i+1],mul(dx,widths[i+1])),tint,mat,front)


def ring(c,ra,rb,axis,radius,color,mat='metal',n=20):
    pts=parallel_ring(c,axis,ra,rb,n)
    # Splines close around path with tangent continuity.
    rings=[parallel_ring(pts[i],sub(pts[(i+1)%n],pts[(i-1)%n]),radius,radius,6) for i in range(n)]
    hoopmesh(rings+[rings[0]],pts+[pts[0]],color,mat,capped=False,smooth=.5)


def encode_string(f,s):
    b=s.encode()
    n=len(b)
    while n>=128:
        f.write(bytes([(n&127)|128])); n>>=7
    f.write(bytes([n])); f.write(b)


def emit(path):
    fmt=struct.Struct('<11f')
    with open(path,'wb') as f:
        f.write(b'LSM1'); f.write(struct.pack('<i',len(objects)))
        for key,parts in objects.items():
            encode_string(f,key); f.write(struct.pack('<i',len(parts)))
            for p in parts:
                encode_string(f,p['name']); f.write(struct.pack('<i3fi',p['parent'],*p['pivot'],len(p['v'])))
                f.write(b''.join(fmt.pack(*v) for v in p['v']))


def png(path,w,h,pixels):
    def chunk(name,bytes_):
        return struct.pack('>I',len(bytes_))+name+bytes_+struct.pack('>I',zlib.crc32(name+bytes_)&0xffffffff)
    data=b''.join(b'\x00'+pixels[i*w*4:(i+1)*w*4] for i in range(h))
    with open(path,'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>2I5B',w,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(data,7))+chunk(b'IEND',b''))
