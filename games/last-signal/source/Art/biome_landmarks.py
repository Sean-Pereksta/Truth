import random
import numpy as np
from meshforge import *
from landscape import canopy


def strata(rows,n,seed,tints,mat='stone'):
    rng=random.Random(seed); phases=[rng.uniform(-.10,.10) for _ in range(n)]
    ringrows=[]; cs=[]
    for row,(x,y,z,rx,rz) in enumerate(rows):
        pts=[]
        for i in range(n):
            a=i*TAU/n+phases[i];k=1+.088*SIN(i*3.19+seed)+.032*SIN(i*2.5+row*.67)
            pts.append((x+rx*k*COS(a),y+.025*SIN(i*3.1+row*.21),z+rz*k*SIN(a)))
        ringrows.append(pts);cs.append((x,y,z))
    for j in range(len(rows)-1):
        hoopmesh(ringrows[j:j+2],cs[j:j+2],tints[j%len(tints)],mat,capped=False,smooth=.18,variation=.045)
    for j,up in ((0,-1),(-1,1)):
        for i in range(n):
            tri(cs[j],ringrows[j][i],ringrows[j][(i+1)%n],tints[-1],mat,front=(0,up,0))


def desert():
    colors=['ad7958','ba805c','cd9a71','c19473','a77355','d09b73','af7756','c18760','cfa079']
    begin('sand_hoodoo')
    strata([(0,-.09,0,1.25,1.16),(.06,.24,.02,1.33,1.19),(.08,.62,.05,1.10,.99),(.13,1.24,.04,1.06,.89),(.13,1.36,.03,1.09,.94),(.08,1.96,.09,.90,.82),(.06,2.62,.12,.81,.75),(.11,2.78,.12,.89,.79),(.03,3.82,.05,.74,.66),(-.06,4.63,.01,.66,.57),(-.14,5.22,.03,.59,.54),(-.21,5.51,.01,.64,.54),(-.30,5.60,.02,.94,.76),(-.25,5.78,.01,1.21,.90),(-.27,6.26,.04,1.16,.90),(-.34,6.59,.04,.81,.65),(-.44,6.80,0,.44,.33)],12,15,colors)
    # The rock breaks down into three fluted buttresses around the exposed core.
    for j,(a,h) in enumerate(((.51,3.96),(2.64,2.63),(4.42,3.04))):
        xx,zz=COS(a),SIN(a)
        strata([(xx*.71,-.09,zz*.65,.84,.71),(xx*.78,.32,zz*.72,.81,.66),
            (xx*.86,.75,zz*.76,.65,.51),(xx*.85,h*.48,zz*.75,.52,.40),
            (xx*.71,h*.78,zz*.63,.39,.28),(xx*.66,h,zz*.57,.16,.12)],8,631+j,colors)
    begin('mesa_rock')
    strata([(0,-.14,0,2.05,1.61),(.17,.37,.08,2.23,1.69),(.16,.81,.13,2.09,1.62),(.04,1.01,.14,2.10,1.62),(-.08,1.26,.08,1.91,1.43),(-.16,1.94,.01,1.80,1.30),(-.20,2.17,.05,1.91,1.45),(-.15,2.48,0,1.82,1.35),(-.14,2.84,-.06,1.62,1.21),(-.18,3.17,-.08,1.61,1.12),(-.22,3.60,-.06,1.34,1.01),(-.34,3.83,-.12,1.02,.83)],11,28,colors)
    begin('sand_arch')
    for sign in (-1,1):
        strata([(sign*3.69,-.1,0,1.23,1.10),(sign*3.72,.5,-.05,1.24,1.10),(sign*3.72,1.43,-.02,1.03,1.02),(sign*3.61,2.30,.05,.89,1.04),(sign*3.52,3.22,.02,.92,1.06),(sign*3.40,4.18,-.04,1.08,1.14),(sign*3.51,5.07,-.09,1.21,1.19),(sign*3.46,5.63,-.14,.86,.82)],10,41 if sign>0 else 60,colors)
    rings=[];centers=[]
    for i in range(12):
        u=i/11;x=-3.8+u*7.6;yy=4.27+1.05*SIN(math.pi*u)+.09*SIN(11*u);zz=.16*SIN(4*u)
        yr=.63+.27*abs(2*u-1);zr=.93+.11*COS(u*5)
        centers.append((x,yy,zz));rings.append([(x,yy+yr*COS(k*TAU/9),zz+zr*SIN(k*TAU/9)) for k in range(9)])
    hoopmesh(rings,centers,'c89873','stone',smooth=.18)
    for sign in (-1,1):
        pts=[(x,yy-.12+.055*SIN(i*4),zz+sign*(.91+.11*COS(i*5/11))) for i,(x,yy,zz) in enumerate(centers)]
        tube(pts,.071,'b57e60','stone',5)
    begin('pinon'); rng=random.Random(411)
    tube([(0,-.05,0),(.17,1.26,0),(.09,2.14,.07),(-.41,3.23,.12),(-.63,4.26,.19)],[.34,.26,.22,.14,.07],'aa9474','bark',9)
    for j in range(8):
        a=j*2.40;rr=1.3+.38*SIN(j);y=2.3+j*.23
        p=(rr*COS(a)-.23,y,rr*SIN(a));knee=(p[0]*.62,y-.44,p[2]*.62)
        tube([(.04,1.63+j*.19,.05),knee,p],[.14,.099,.041],'b29b78','bark',7)
        canopy(p,(1.10,.64,1.03),['87966b','a0a277','8b9a73','91a77d'][j%4],rng)
    canopy((-.56,4.51,.20),(1.35,.72,1.13),'9b9e74',rng)
    begin('yucca');rng=random.Random(491)
    for spr in range(3):
        xx=(spr-1)*.37;zz=.19*SIN(spr*3)
        for i in range(18):
            a=i*2.40+spr;reach=.33+.38*rng.random();h=.36+.56*rng.random()
            root=(xx,.025,zz);middle=(xx+reach*.45*COS(a),h*.67,zz+reach*.45*SIN(a));tip=(xx+reach*COS(a),h,zz+reach*SIN(a));side=(.073*COS(a+1.57),0,.073*SIN(a+1.57))
            midrib=vec(middle,(0,.039,0))
            tri(root,vec(middle,side),midrib,'9fa578','leaf',front=(0,1,0));tri(midrib,vec(middle,side),tip,'9aa579','leaf',front=(0,1,0))
            tri(root,midrib,sub(middle,side),'83936b','leaf',front=(0,1,0));tri(midrib,tip,sub(middle,side),'8f9d72','leaf',front=(0,1,0))
        if spr==0:continue
        rod((xx,0,zz),(xx+.04,1.19,zz+.07),.019,.010,'c8af83','leaf',5)
        for k in range(5):ell((xx+.04+.055*SIN(k*3),.94+.05*k,zz+.04+.06*COS(k*3)),(.037,.057,.03),'d8c8a8','skin',7,3)


def alpine():
    begin('snow_fir')
    tube([(0,-.05,0),(.06,1.65,.02),(-.04,4.4,0),(.04,8.2,-.04),(0,10.4,.03)],[.38,.26,.19,.088,.025],'85765d','bark',9)
    rng=random.Random(340)
    for level in range(7):
        y=2.05+level*1.19;rr=2.24*(1-level/8.3)
        for j in range(6):
            a=j*TAU/6+level*.57;f=rr*rng.uniform(.90,1.12);side=(COS(a+1.57),0,SIN(a+1.57));axis=(COS(a),0,SIN(a));w=.40*f
            start=(.03,y+.71,.02);mid=vec((0,y+.15,0),mul(axis,f*.63));end=vec((0,y-.24+rng.random()*.15,0),mul(axis,f))
            left=vec(mid,mul(side,w));right=sub(mid,mul(side,w));crest=vec(mid,(0,.30+.05*f,0))
            tri(start,left,crest,'5b7d73','leaf',front=(0,1,0));tri(start,crest,right,'779487','leaf',front=(0,1,0))
            tri(left,end,crest,'738e7e','leaf',front=(0,1,0));tri(crest,end,right,'597c73','leaf',front=(0,1,0))
            # Snow rests on the upper bough; exposed needles frame its scalloped edge.
            cap0=vec(start,(0,.045,0));cap1=vec(mul(vec(left,crest),.5),(0,.107,0));cap2=vec(mul(vec(end,crest),.5),(0,.085,0));cap3=vec(mul(vec(right,crest),.5),(0,.10,0));cap4=vec(crest,(0,.13,0))
            for ix,p in enumerate(((cap0,cap1,cap4),(cap1,cap2,cap4),(cap2,cap3,cap4),(cap3,cap0,cap4))):
                tri(*p,['f1f3ef','dce7e6','edf1ec','d5e2e1'][ix],'skin',front=(0,1,0))
            for s in (-1,1):
                p=vec(mid,mul(side,s*w*.62));t=vec(p,vec(mul(axis,f*.39),(0,-.20,0)))
                tri(p,t,vec(mid,mul(axis,f*.24)),'688779','leaf',front=(0,1,0))
    loft([(0,9.20,0,.42,.38),(0,9.75,0,.29,.25),(0,10.46,0,.015,.015)],'cbdcce','skin',8,.55)
    begin('snow_boulder')
    grey=['889da2','83999e','8a9b9d','799197','aec2c3']
    strata([(0,-.12,0,1.74,1.41),(.05,.20,.02,1.99,1.58),(.08,.71,.08,1.94,1.48),(.16,1.28,.03,1.61,1.27),(.17,1.60,-.02,1.36,1.04)],10,83,grey)
    strata([(.13,1.34,.03,1.65,1.30),(.15,1.51,.02,1.67,1.27),(.19,1.85,-.02,1.36,1.03),(.26,2.08,-.08,.70,.57),(.24,2.12,-.09,.26,.18)],10,83,['d1dedf','e6eeeb','f6f6ec','f4f5ee'],'skin')
    begin('ice_teeth')
    for j in range(7):
        a=j*2.4;rr=.35+j*.15;xx=COS(a)*rr;zz=SIN(a)*rr;h=5.87 if j==0 else 2.0+2.40*(.5+.5*SIN(j*7.1))
        lean=.10+.22*SIN(j*2.6);r=.67+.17*SIN(j)
        strata([(xx,-.09,zz,r,r*.8),(xx+.06,.17*h,zz,r*1.10,r*.82),(xx+.20*lean,.51*h,zz-.11,r*.79,r*.67),(xx+.41*lean,.84*h,zz-.25,r*.46,r*.40),(xx+.59*lean,h,zz-.34,r*.10,r*.06)],7,100+j,['87b4c5','96cad9','b6dae1','d9e9e7'],'skin')
    begin('snow_heath');rng=random.Random(118)
    for j in range(7):
        a=j*2.4;r=.76*math.sqrt(j/7);x=r*COS(a);z=r*SIN(a);h=.51+.12*SIN(j)
        rod((x*.60,0,z*.60),(x,h,z),.029,.014,'95846b','bark',5)
        canopy((x,h,z),(.44,.35,.41),['81978b','8fa298','879d90'][j%3],rng)
        ell((x+.02,h+.20,z-.01),(.306,.114,.251),'d8e5e1','skin',9,5)
        for k in range(3):ell((x+.26*COS(k*2.4),h+.06+.05*k,z+.255*SIN(k*2.4)),(.018,.020,.018),'aa6659','skin',7,3)
    begin('signal_lodge')
    box((0,.27,-.17),(5.56,.54,3.76),'97a6a4','stone')
    for j in range(10):
        h=.62+j*.25
        for s in (-1,1):
            rod((-2.76,h,-.17+s*1.85),(2.76,h,-.17+s*1.85),.147,.147,['9d866b','ae9778'][j%2],'bark',8)
            rod((s*2.62,h,-2.1),(s*2.62,h,1.77),.148,.148,'a38c71','bark',8)
    for s in (-1,1):
        quad((-3.07,2.82,-.20+s*2.20),(3.07,2.82,-.20+s*2.20),(3.07,4.69,-.20),(-3.07,4.69,-.20),'d4e0df','skin',(0,1,s))
        for k in range(12):
            xx=-2.99+k*.54;rod((xx,2.79,-.20+s*2.19),(xx,4.70,-.20),.026,.028,'c2ccce','steel',5)
            if k%2==0:rod((xx,2.87,-.2+s*2.20),(xx+.013,2.51-.09*SIN(k),-.2+s*2.23),.032,.003,'d0e1e1','skin',6)
        tri((s*2.75,2.81,-2.24),(s*2.75,2.81,1.84),(s*2.75,4.64,-.19),'a99477','wood',( (0,0),(1,0),(.5,1)),front=(s,0,0))
        box((s*1.55,1.69,1.76),(.99,.91,.16),'74614f','wood')
        box((s*1.55,1.69,1.86),(.81,.69,.045),'bdad83','metal')
        box((s*1.55,1.69,1.90),(.056,.74,.046),'796751','wood')
        box((s*1.55,1.69,1.90),(.88,.049,.046),'796751','wood')
    box((0,1.41,1.79),(.99,1.96,.15),'836d54','wood')
    box((0,.22,1.99),(1.52,.32,.52),'9eaaa5','stone')
    box((1.84,4.32,-.65),(.61,1.55,.60),'99a5a1','stone')
    box((1.84,5.08,-.65),(.73,.15,.72),'dce8e1','skin')


def floor_textures(dest):
    # Continuous periodic fields combine hand-painted pigments, fine grit, ripples,
    # and packed snow. All samples wrap at the four edges of each square tile.
    import os
    N=512;yy,xx=np.mgrid[0:N,0:N]
    def noise(nx,ny,seed):
        a=np.random.default_rng(seed).random((ny,nx));x=xx*nx/N;y=yy*ny/N;i=x.astype(int);j=y.astype(int);u=x-i;v=y-j;u=u*u*(3-2*u);v=v*v*(3-2*v)
        return (1-u)*(1-v)*a[j%ny,i%nx]+u*(1-v)*a[j%ny,(i+1)%nx]+(1-u)*v*a[(j+1)%ny,i%nx]+u*v*a[(j+1)%ny,(i+1)%nx]
    for slot,key in enumerate(('gorge_floor','gorge_path','frost_floor','frost_path')):
        rng=np.random.default_rng(391+slot);cloud=noise(7,6,31+slot);small=noise(28,32,89+slot);grain=noise(103,115,72+slot)
        grit=rng.normal(0,3.0,(N,N));wind=np.sin(yy/N*TAU*(12 if slot<2 else 7)+np.sin(xx/N*TAU*2)*1.7+cloud*2.3)
        if slot==0:base=(181,133,95);variation=(cloud-.5)*44+(small-.5)*25+(grain-.5)*19+grit+wind*4.8
        elif slot==1:base=(190,158,113);variation=(cloud-.5)*32+(small-.5)*20+(grain-.5)*18+grit+wind*6.3
        elif slot==2:base=(204,220,226);variation=(cloud-.5)*24+(small-.5)*13+(grain-.5)*8+grit*.60+wind*4.8
        else:base=(171,184,185);variation=(cloud-.5)*36+(small-.5)*20+(grain-.5)*18+grit*.8+wind*3.7
        rgb=np.array(base)[None,None,:]+variation[:,:,None]
        n=2450 if slot<2 else 500 if slot==2 else 1800
        for k in range(n):
            x=int(rng.integers(0,N));y=int(rng.integers(0,N));length=rng.integers(1,5)
            delta=rng.uniform(-24,13) if slot!=2 else rng.uniform(-11,9)
            for i in range(length):rgb[(y+i//3)%N,(x+i)%N]+=delta*(1-i/(length+1))
        a=np.full((N,N,4),255,dtype=np.uint8);a[:,:,:3]=np.clip(rgb,0,255).astype(np.uint8)
        png(os.path.join(dest,key+'.png'),N,N,a.tobytes())


def create():
    desert();alpine()
