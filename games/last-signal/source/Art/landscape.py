from meshforge import *


def horn():
    begin('cornucopia')
    sections=[(0,0,6,7.5,0),(0,-2,5.65,7,0),(-.15,-4,5.05,6.45,0),(-.36,-6,4.45,5.65,0),(-.4,-8,3.55,4.8,0),(-.05,-10,2.65,3.95,0),(.55,-11.8,1.9,3.25,.1),(1.6,-13.2,1.35,2.55,.6),(2.9,-14,.88,1.85,1.45),(4.1,-14.15,.5,1.15,2.65),(4.85,-13.45,.25,.65,3.7),(4.9,-12.8,.06,.16,4.4)]
    def pos(t,a,offset=0,flute=True):
        i=min(int(t),len(sections)-2); k=t-i
        cx,z,rx,h,by=(aa*(1-k)+bb*k for aa,bb in zip(sections[i],sections[i+1]))
        wave=(1+.022*COS(14*a-.34*t)) if flute else 1
        return (cx+(rx*wave+offset)*COS(a),by+max(-.22,h*.20+(h*.8*wave+offset)*SIN(a)),z)
    n=70; steps=33; L=len(sections)-1
    for t in range(steps):
        j0,j1=L*t/steps,L*(t+1)/steps
        for i in range(n):
            a0,a1=TAU*i/n,TAU*(i+1)/n
            for off,tint,sgn in ((0,'fff4cd',1),(-.15*(1-j0/L),'d3ac86',-1)):
                pts=(pos(j0,a0,off),pos(j0,a1,off),pos(j1,a1,off),pos(j1,a0,off))
                x=COS((a0+a1)/2); y=SIN((a0+a1)/2)
                if all(p[1]<=-.19 for p in pts): continue
                uv=((i%7/7,t%5/5),((i%7+1)/7,t%5/5),((i%7+1)/7,(t%5+1)/5),(i%7/7,(t%5+1)/5))
                ambient=1 if sgn>0 else .70-.53*min(1,j0/4.5)
                color=mul(col(tint),ambient*(.95+.06*COS(i*.9+t*.18)))
                quad(*pts,color,'metal',(x*sgn,y*sgn,.025*sgn),uv)
    # The rolled bell is a thick flared plate. Its chased herringbone and
    # return lip frame the mouth even from the opposite side of the plaza.
    def bell(a,delta,z):
        p=pos(0,a,delta)
        return (p[0],p[1],z)
    for i in range(100):
        a0=TAU*i/100;a1=TAU*(i+1)/100
        if min(bell(a0,0,0)[1],bell(a1,0,0)[1])<-.15:continue
        outer0=bell(a0,.30,.25);outer1=bell(a1,.30,.25)
        inner0=bell(a0,-.20,.28);inner1=bell(a1,-.20,.28)
        quad(outer0,outer1,inner1,inner0,'ffe6a5','gilt',(0,0,1))
        quad(outer0,bell(a0,.032,-.24),bell(a1,.032,-.24),outer1,'e8cb98','gilt',(COS(a0),SIN(a0),.2))
        quad(inner0,bell(a0,-.17,-.26),bell(a1,-.17,-.26),inner1,'d3b185','metal',(-COS(a0),-SIN(a0),.4))
        left=bell(a0+.003,.075,.295); right=bell(a1-.003,.075,.295)
        top=bell((a0+a1)*.5,.205,.295); bottom=bell((a0+a1)*.5,-.05,.295)
        quad(left,top,right,bottom,'b1b795' if i%6 else 'f9df98','patina' if i%6 else 'gilt',(0,0,1))
        if i%3==0:
            p=bell(a0,.075,.315);ell(p,(.055,.055,.029),'ffefbe','gilt',7,3)
    for j in (.43,1.4,2.55,3.85,5.2,6.6):
        pts=[pos(j,TAU*i/52,-.20) for i in range(53)]
        rr=.115-.010*j
        for i in range(52):
            if min(pts[i][1],pts[i+1][1])>-.10:
                rod(pts[i],pts[i+1],rr,rr,mul(col('d7bb8f'),.83-.080*j),'gilt',6)
    # Aged recessed plates underfoot receive progressively less light.
    for j in range(22):
        t0=j*.246+.01; t1=t0+.237
        x0,z0,rx0,_,_=tuple((a*(1-t0%1)+b*(t0%1)) for a,b in zip(sections[int(t0)],sections[int(t0)+1]))
        x1,z1,rx1,_,_=tuple((a*(1-t1%1)+b*(t1%1)) for a,b in zip(sections[int(t1)],sections[int(t1)+1]))
        for k in range(5):
            a=-.9+.36*k+.003;b=a+.353
            quad((x0+rx0*a,.023,z0),(x0+rx0*b,.023,z0),(x1+rx1*b,.023,z1),(x1+rx1*a,.023,z1),mul(col('bca182'),.72-.019*j),'metal',(0,1,0))
    # The rolled, scalloped lip reads against the dark interior.
    for j,r,co in ((0,.155,'ffedba'),(.20,.07,'fff0b1'),(.42,.055,'b8ddc7'),(1.18,.065,'d9d9ad'),(3.05,.065,'fcdd95'),(5.12,.045,'e7d79e'),(7.05,.045,'dbc28c')):
        pts=[pos(j,TAU*i/74,.035) for i in range(75)]
        for i in range(74):
            if min(pts[i][1],pts[i+1][1])>-.15:
                rod(pts[i],pts[i+1],r,r,co,'gilt',6)
    # Swept raised flutes and patinated vertical panel straps.
    for i in range(14):
        pts=[pos(t*.32,TAU*i/14+t*.0077,.03) for t in range(34)]
        for j in range(len(pts)-1):
            if min(pts[j][1],pts[j+1][1])>0:
                r=.10*(1-j/39)
                rod(pts[j],pts[j+1],r,r*.99,'e4c891','gilt',5)
    # Paired alternating bronze rivets on the outer lip.
    for i in range(33):
        a=math.pi*(i+.4)/33
        p=pos(.19,a,.11)
        ell(p,(.067,.067,.077),'e5d995','metal',6,3)


def deciduous(name,seed,birch=False):
    begin(name); rng=random.Random(seed)
    bark='d5d0b7' if birch else 'aaaa8e'; leafPal=['71936c','8da76b','b3ba72','5e876b','799752']
    H=8 if birch else 9
    trunk=[(0,0,0),(.12,1.3,0),(-.08,3.2,.14),(.25,4.7,-.02),(.08,6.5,.38)]
    tube(trunk,[.36 if birch else .55,.25 if birch else .45,.24,.17,.09],bark,'bark',9)
    if birch:
        for i in range(22):
            y=.17+i*.21; a=rng.random()*TAU; rr=.26-.015*y
            p=(.02+rr*COS(a),y,.04+rr*SIN(a))
            rod(p,vec(p,(.1*COS(a+1.57),.02,.10*SIN(a+1.57))),.017,.009,'565a4f','cloth',4)
    for i in range(9 if birch else 11):
        a=i*2.399; h=3.2+i*.25; span=(1.65 if birch else 2.65)*(1-.45*i/12)
        mid=(COS(a)*span*.53,h+.55,SIN(a)*span*.50)
        tip=(COS(a)*span,h+1.5+rng.random()*.7,SIN(a)*span)
        tube([(.09,h,.09),mid,tip],[.20,.12,.045],bark,'bark',6)
        back=(tip[0]+.6*COS(a+1),tip[1]+.75,tip[2]+.6*SIN(a+1))
        rod(mid,back,.085,.02,bark,'wood',5)
        for off,rad in [(0,1),(1,.65)]:
            p=tip if not off else back
            canopy(p,((1.25 if birch else 1.7)*rad,1.56*rad,(1.12 if birch else 1.55)*rad),leafPal[(i+off)%5],rng)
    canopy((.1,H-.9,.25),(1.35,1.3,1.45),'9cab67',rng)


def canopy(center,rad,color,rng):
    x,y,z=center; rx,ry,rz=rad
    rings=[]
    for h,width in ((-.84,.24),(-.50,.83),(-.08,1),(.49,.83),(.88,.34)):
        ringpts=[]
        for i in range(9):
            a=i*TAU/9+.2*h; q=width*rng.uniform(.82,1.12)
            ringpts.append((x+rx*q*COS(a),y+ry*(h+rng.uniform(-.12,.12)),z+rz*q*SIN(a)))
        rings.append(ringpts)
    hoopmesh(rings,[(x,y+ry*h,z) for h in (-.84,-.50,-.08,.49,.88)],color,'leaf',smooth=.13,variation=.09)
    # Small articulated leaf clusters retain the organic crown silhouette at
    # medium range; the denser crown continues to occlude the woodland below.
    for i in range(9):
        a=i*TAU/9+.24; rr=.86+.10*rng.random(); hh=rng.uniform(-.36,.3)
        start=(x+rx*rr*COS(a),y+ry*hh,z+rz*rr*SIN(a))
        tangent=(COS(a+math.pi/2),0,SIN(a+math.pi/2))
        for sign in (-1,1):
            tip=vec(start,(.29*rx*COS(a)+sign*.15*tangent[0],-.12*ry,.29*rz*SIN(a)+sign*.15*tangent[2]))
            mid=vec(mul(vec(start,tip),.5),(0,.08*ry,0))
            quad(start,vec(mid,mul(tangent,.10*rx)),tip,sub(mid,mul(tangent,.09*rx)),mul(col(color),1.05+.07*sign),'leaf',(COS(a),.52,SIN(a)))


def conifer():
    begin('pine'); rng=random.Random(44)
    tube([(0,0,0),(.07,1.8,.05),(-.11,5,.08),(.14,8.6,.14),(.05,11.7,.12)],[.43,.32,.22,.12,.015],'a6a08b','wood',9)
    for i in range(9):
        h=2.8+i*.9; R=2.9*(1-i/11)
        for j in range(7 if i<6 else 5):
            a=j*TAU/(7 if i<6 else 5)+i*.72
            rr=R*rng.uniform(.82,1.05)
            start=(.04,h+.77,.08); end=(rr*COS(a),h-.15+rng.random()*.6,rr*SIN(a))
            if i<3:rod(start,end,.09,.025,'908f7a','wood',5)
            dx=(COS(a+1.57),0,SIN(a+1.57))
            mid=vec(mul(vec(start,end),.5),(0,.30,0))
            width=rr*.41
            l=vec(mid,mul(dx,width)); r=sub(mid,mul(dx,width)); c=vec(mid,(0,.44,0))
            for ix,p in enumerate(((start,l,c),(start,c,r),(l,end,c),(c,end,r))):
                tri(*p,['578071','72916e','6b8d75','78936e'][(i+ix)%4],'leaf',front=(0,1,0))
            for k in range(3):
                s=(k+1)*.22
                e=vec(mul(start,1-s),mul(end,s)); w=width*(1-abs(s-.5))
                for sign in (-1,1):
                    tip=vec(vec(e,mul(dx,w*sign)),(COS(a)*.42,-.26,SIN(a)*.42))
                    tri(e,tip,vec(e,(COS(a)*.72,.06,SIN(a)*.72)),'628269','leaf',front=(0,1,0))
    loft([(0,9.8,0,.55,.5),(0,11.3,0,.36,.33),(.07,12,.1,.02,.02)],'74966f','cloth',8)


def foliage():
    begin('bush'); rng=random.Random(81)
    for i in range(9):
        a=i*2.4; r=(i/9)**.6*.92
        p=(r*COS(a),.75+rng.random()*.18,r*SIN(a))
        rod((0,.04,0),p,.07,.021,'b9a587','wood',5)
        canopy(p,(.61,.72,.60),['658d69','88a974','769766','9da16b'][i%4],rng)
    for name,n,h in [('reed',17,1.58),('grass',21,.52)]:
        begin(name); rng=random.Random(135)
        for i in range(n):
            a=rng.random()*TAU; rr=rng.random()*.66
            p=(rr*COS(a),.012,rr*SIN(a)); H=h*rng.uniform(.6,1.16)
            end=vec(p,(.28*COS(a),H,.28*SIN(a)))
            if name=='reed' and i%2==0:
                rod(p,end,.014,.012,'b4b078','cloth',5)
                rod(vec(end,(0,-.14,0)),vec(end,(.016,.065,.015)),.048,.036,'a18a58','wood',6)
            mid=vec(p,(.12*COS(a),H*.57,.12*SIN(a)))
            edge=(.067*COS(a+1.57),0,.067*SIN(a+1.57))
            colr=['91a768','b1b27a','7e9a61','b1bd81'][i%4]
            quad(p,sub(mid,edge),end,vec(mid,edge),colr,'cloth',(COS(a),.25,SIN(a)))


def stoneform(name,rx,ry,rz,seed):
    begin(name); rng=random.Random(seed)
    rings=[]
    for y,r in ((-.14,.81),(.12,1),(.62,.88),(.90,.62),(1,.31)):
        row=[]
        for i in range(9):
            a=i*TAU/9+.15*y
            fac=r*(rng.uniform(.88,1.05)); row.append((rx*fac*COS(a)+.14*y,ry*(y+rng.uniform(-.055,.04)),rz*fac*SIN(a)))
        rings.append(row)
    hoopmesh(rings,[(0,y*ry,0) for y in (-.14,.12,.62,.90,1)],'899899','stone',smooth=.06,variation=.14)
    for i in range(7):
        a=i*TAU/7; p=(COS(a)*rx*.78,ry*(.33+.14*SIN(i)),SIN(a)*rz*.78)
        ell(p,(rx*.22,ry*.12,rz*.19),'78895d','ground',7,3)


def landmarks():
    begin('platform')
    loft([(0,0,0,1.35,1.35),(0,.10,0,1.35,1.35),(0,.24,0,1.24,1.24),(0,.27,0,1.22,1.22)],'b9bdbb','stone',30,.2)
    ring((0,.235,0),1.24,1.24,(0,1,0),.038,'ecd79c','metal',36)
    ring((0,.275,0),1.02,1.02,(0,1,0),.017,'f0dfb0','metal',34)
    for i in range(4):
        a=i*math.pi/2
        box((1.18*COS(a),.283,1.18*SIN(a)),(.1,.025,.25),'cfb47b','metal',-a)
    begin('ruin'); rng=random.Random(53)
    for j in range(5):
        for k in range(5 if j<3 else 4 if j==3 else 2):
            x=-2.04+k*.84+(.3 if j%2 else 0)
            box((x+.32,.26+j*.51,rng.uniform(-.08,.08)),(.78+rng.random()*.11,.5,.89+rng.random()*.2),['87978d','9ba6a4','a1a697'][(k+j)%3],'stone',rng.uniform(-.026,.026))
    begin('stove')
    loft([(0,0,0,.64,.59),(0,.18,0,.65,.60),(0,.24,0,.61,.57)],'969b91','stone',10,.12)
    for s in (-1,1):
        for j in range(3):
            box((s*(.46-j*.007),.33+j*.183,-.007),(.21,.174,.83),'a4a799' if j%2==0 else '929c98','stone')
    box((0,.543,-.34),(.84,.60,.14),'696964','stone')
    box((0,.785,.310),(.90,.185,.190),'aab1a4','stone')
    loft([(0,.810,-.017,.55,.50),(0,.915,-.017,.54,.5),(0,1.018,-.017,.45,.45)],'aab0a3','stone',10,.12)
    for k in range(4):
        rod((-.27+.133*k,.275,-.24),(-.21+.122*k,.295,.32),.049,.041,'767268','charcoal',6)
    for j in range(3):
        x=(j-1)*.17
        ell((x,.337,.092),(.095,.039,.057),'c48247','metal',8,4)
    ring((0,1.04,0),.45,.45,(0,1,0),.065,'ddc99e','metal')
    for j in range(7):
        x=(j-3)*.103; reach=math.sqrt(max(.02,.43*.43-x*x))
        rod((x,1.06,-reach),(x,1.06,reach),.019,.019,'b6b7a9','metal',5)
    begin('bridge')
    for k in range(15):
        box((0,.02,-2.36+k*.335),(3,.16,.315),'d0c4ac','wood')
    for s in (-1,1):
        rod((s*1.48,-.17,-2.48),(s*1.48,-.17,2.48),.14,.14,'c2b692','wood')
        for z in (-2.35,0,2.35):rod((s*1.44,-.62,z),(s*1.44,1.1,z),.08,.066,'c3b299','wood')
        tube([(s*1.44,1,-2.35),(s*1.44,.82,-1.17),(s*1.44,1,0),(s*1.44,.82,1.17),(s*1.44,1,2.35)],.036,'c3bb9b','cloth',6)
    begin('floodgate')
    for s in (-1,1):
        loft([(s*4.25,0,0,.5,.65),(s*4.25,.6,0,.45,.59),(s*4.25,3.5,0,.32,.48)],'89948c','stone',8)
    for j in range(7):box((0,.27+j*.42,0),(8.14,.38,.3),'babcab','wood')
    for x in (-3.5,0,3.5):box((x,1.66,.2),(.22,3.2,.15),'a5b1a0','metal')
    box((0,3.34,0),(9,.43,.68),'c6c2ab','metal')
    ring((0,2.55,.54),.38,.38,(0,0,1),.045,'c68862','metal',22)
    for i in range(5):
        a=i*TAU/5
        rod((0,2.55,.54),(.37*COS(a),2.55+.37*SIN(a),.54),.02,.02,'d4ad76','metal',5)


def create():
    horn(); conifer(); deciduous('oak',88); deciduous('birch',85,True); foliage()
    stoneform('rock',2,2.15,1.7,12); stoneform('boulder',2.48,3.72,2.04,34)
    landmarks()
