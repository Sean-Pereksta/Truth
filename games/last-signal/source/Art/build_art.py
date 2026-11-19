import argparse
import math
import os
import shutil
import struct
import sys
import tempfile
import zlib
import numpy as np
import equipment
import figures
import landscape
import waterlands
import biome_landmarks
import wildlife_variants
import armor
import meshforge as M


def read_rgb_png(filename):
    # The source is the supplied truecolor painted texture atlas.
    raw=open(filename,'rb').read()
    w,h,bit,mode,_,_,interlace=struct.unpack('>IIBBBBB',raw[16:29])
    assert bit==8 and mode in (2,6) and interlace==0
    off=8; buf=bytearray()
    while off<len(raw):
        size=struct.unpack('>I',raw[off:off+4])[0]; name=raw[off+4:off+8]
        if name==b'IDAT':buf.extend(raw[off+8:off+8+size])
        off+=12+size
    data=np.frombuffer(zlib.decompress(buf),dtype=np.uint8)
    bpp=3 if mode==2 else 4
    stride=w*bpp; arr=np.zeros((h,stride),dtype=np.uint8)
    for i,row in enumerate(data.reshape(h,stride+1)):
        a=int(row[0]); pixels=row[1:]; prev=arr[i-1] if i else np.zeros(stride,dtype=np.uint8); cur=arr[i]
        if a==0:cur[:]=pixels
        elif a==1:cur[:]=np.cumsum(pixels.reshape(-1,bpp),axis=0,dtype=np.uint16).astype(np.uint8).ravel()
        elif a==2:np.add(pixels,prev,out=cur)
        else:
            cur[:bpp]=pixels[:bpp]+(prev[:bpp]//2 if a==3 else prev[:bpp])
            # Use Python ints here, as numpy.uint8 arithmetic would wrap.
            pp=prev.tolist(); src=pixels.tolist(); cc=cur[:bpp].tolist()+[0]*(stride-bpp)
            for j in range(bpp,stride):
                x,y=cc[j-bpp],pp[j]; c=pp[j-bpp]
                if a==3:k=(x+y)//2
                else:
                    p=x+y-c; da,db,dc=abs(p-x),abs(p-y),abs(p-c)
                    k=x if da<=db and da<=dc else y if db<=dc else c
                cc[j]=(src[j]+k)&255
            cur[:]=cc
    return arr.reshape(h,w,bpp)[:,:,:3]


def atlas(src,dest):
    image=read_rgb_png(src); h,w=image.shape[:2]; n=256
    def crop(tx,ty):
        xx=(np.arange(n)*((w/2)-10)/(n-1)+tx*w/2+5).astype(int)
        yy=(np.arange(n)*((h/2)-10)/(n-1)+ty*h/2+5).astype(int)
        return image[yy[:,None],xx].astype(float)
    bronze,wood,soil,cloth=[crop(x,y) for x,y in ((0,0),(1,0),(0,1),(1,1))]
    def lum(mat):return mat@np.array([.289,.533,.178])
    rock,plank,patina,weave=lum(soil),lum(wood),lum(bronze),lum(cloth)
    i,j=np.mgrid[0:n,0:n]
    nr=np.random.default_rng(77).normal(0,1,(n,n))
    def rgb(v,m=(1,1,1)):
        return v[...,None]*np.array(m)
    ivy=np.sin(.12*j+1.2*np.sin(i*.048))*.4+np.sin(i*.05+j*.028)*.4
    fiber=np.sin(j*1.85+i*.16+np.sin(i*.082)+.4*np.sin(j*.19))
    tiles={
        'metal':bronze*.65+np.array([80,72,56]),
        'gilt':bronze*.24+rgb(132+.30*patina,(1.19,1,.72)),
        'patina':bronze*.22+rgb(118+.22*patina,(.69,.96,.86)),
        'wood':wood*.42+rgb(115+.27*plank,(1.05,1.00,.93)),
        'stone':rgb(157+.31*rock+.09*patina+nr*2,(.97,1,1.015)),
        'steel':rgb(175+.30*patina+.09*plank+nr*2,(.97,.996,1.02)),
        'ground':soil*.61+37,
        'cloth':rgb(164+.46*weave,(1,.995,.972)),
        'skin':rgb(229+nr*3+.060*weave+2.2*np.sin(j*.031)*np.sin(i*.051),(1,.99,.973)),
        'fur':rgb(191+12*fiber+.12*rock+.065*weave+nr*3),
        'leaf':rgb(167+21*ivy+.26*rock+nr*3,(.96,1,.92)),
        'bark':rgb(146+.6*plank+nr*2,(1.035,1,.97)),
        'feather':rgb(182+12*np.sin(i*.99+(j-n/2)**2*.0018)+.19*weave+nr*2),
        'charcoal':rgb(139+.38*patina+nr*2)}
    sheet=np.full((n*4,n*4,4),255,dtype=np.uint8)
    for name,arr in tiles.items():
        x,y=M.material_grid[name]
        sheet[y*n:(y+1)*n,x*n:(x+1)*n,:3]=np.clip(arr,0,255).astype(np.uint8)
    M.png(dest,4*n,4*n,sheet.tobytes())
    return sheet


def icon(key,parts,texture,filename):
    pitch=.38
    yaw=.61
    if key=='floor':pitch=.63
    if key=='ramp':yaw=2.22
    if key=='bow': yaw=1.08
    if key in ('sling','knife','hatchet'): yaw=-.32
    up=np.array([-.23*math.sin(yaw),.97,-.23*math.cos(yaw)])
    forward=np.array([math.sin(yaw)*math.cos(pitch),math.sin(pitch), math.cos(yaw)*math.cos(pitch)])
    right=np.cross([0,1,0],forward); right/=np.linalg.norm(right)
    up=np.cross(forward,right)
    if key in ('arrow','arrows','spear','knife','bow','hatchet'):
        aa=.61 if key!='bow' else .48
        right,up=math.cos(aa)*right+math.sin(aa)*up,-math.sin(aa)*right+math.cos(aa)*up
    basis=np.array([right,-up,forward]).T
    triples=[]; offsets=[]
    for p in parts:
        offset=np.array(p['pivot'])+(offsets[p['parent']] if p['parent']>=0 else 0)
        offsets.append(offset)
        if not p['v']:continue
        verts=np.array(p['v'],dtype=float)
        verts[:,:3]=(verts[:,:3]+offset)@basis
        triples.append(verts)
    if not triples:return
    verts=np.vstack(triples)
    low=verts[:,:2].min(axis=0);high=verts[:,:2].max(axis=0)
    n=256
    verts[:,:2]=(verts[:,:2]-(low+high)/2)*((n-36)/max(high-low))+n/2
    rgba=np.zeros((n,n,4),dtype=np.uint8)
    depth=np.full((n,n),-float('inf'))
    keyLight=np.array([-.32,.78,.53]); keyLight/=np.linalg.norm(keyLight)
    for tri in verts.reshape(-1,3,11):
        p,q,r=tri[:,:3]
        x0,y0=np.maximum(0,np.floor(np.min(tri[:,:2],axis=0))).astype(int)
        x1,y1=np.minimum(n-1,np.ceil(np.max(tri[:,:2],axis=0))).astype(int)
        det=(q[1]-r[1])*(p[0]-r[0])+(r[0]-q[0])*(p[1]-r[1])
        if abs(det)<1e-6:continue
        yy,xx=np.mgrid[y0:y1+1,x0:x1+1]; dx=xx+.5-r[0]; dy=yy+.5-r[1]
        a=((q[1]-r[1])*dx+(r[0]-q[0])*dy)/det; b=((r[1]-p[1])*dx+(p[0]-r[0])*dy)/det
        c=1-a-b; zz=a*p[2]+b*q[2]+c*r[2]; block=depth[y0:y1+1,x0:x1+1]
        mask=(np.minimum(np.minimum(a,b),c)>=-.001)&(zz>block)
        if not np.any(mask):continue
        block[mask]=zz[mask]
        weights=np.column_stack([a[mask],b[mask],c[mask]])
        uv=weights@tri[:,6:8]; tex=texture[np.clip(((1-uv[:,1])*1024).astype(int),0,1023),np.clip((uv[:,0]*1024).astype(int),0,1023),:3]
        lambert=np.clip(weights@(tri[:,3:6]@keyLight),0,1)
        color=tex*(weights@tri[:,8:11])*(.62+.52*lambert[:,None])+3
        tile=rgba[y0:y1+1,x0:x1+1]
        tile[mask,:3]=np.clip(color,0,255).astype(np.uint8);tile[mask,3]=255
    # Antialias the silhouette using premultiplied coverage before unpremultiplying.
    den=rgba.reshape(128,2,128,2,4).mean(axis=(1,3)); alpha=den[:,:,3]
    den[:,:,:3]=np.divide(den[:,:,:3],np.maximum(alpha[:,:,None]/255,.00001))
    M.png(filename,128,128,np.clip(den,0,255).astype(np.uint8).tobytes())


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--icons',action='store_true')
    args=parser.parse_args()
    target=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..','Assets'))
    work=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','work'))
    os.makedirs(work,exist_ok=True)
    landscape.create();figures.create();equipment.create();waterlands.create();biome_landmarks.create()
    wildlife_variants.create()
    armor.create()
    biome_landmarks.floor_textures(target)
    texture=atlas(os.path.join(target,'paint.png'),os.path.join(work,'modelpaint.png'))
    M.emit(os.path.join(work,'models.bin'))
    for name in ('models.bin','modelpaint.png'):
        os.replace(os.path.join(work,name),os.path.join(target,name))
    print('Exported %d models, %d bind-pose parts, %d triangles' %(len(M.objects),sum(map(len,M.objects.values())),sum(len(p['v'])//3 for ps in M.objects.values() for p in ps)),flush=True)
    if args.icons:
        names='knife hatchet bow sling spear arrows arrow branch stone fiber tinder cloth scrap bandage meat meal pack fire wall barricade gate lean_to ramp floor waterskin rain_barrel woven_vest scrap_cuirass'.split()
        for key in names:icon(key,M.objects[key],texture,os.path.join(target,'icons',key+'.png'))
        print('Created %d original item graphics.'%len(names),flush=True)


if __name__=='__main__': main()
