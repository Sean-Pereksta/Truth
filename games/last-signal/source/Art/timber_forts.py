"""Timber fort panels. Mesh coordinates match the walkable construction grid."""
from meshforge import begin, box, col, mul, quad, rod, tri


PLANKS = ('c6ad8e','cab599','bba58b','d8c3a1','c5b397','bdae96','d0ba9b')
SPLIT = '785e49'


def board(polygon, surface, depth, color):
    """Close both faces of one hand-cut board; UV follows the long grain."""
    top = [(x, surface(x,z), z) for x,z in polygon]
    bottom = [(x, y-depth, z) for x,y,z in top]
    mid = tuple(sum(v[i] for v in top)/len(top) for i in range(3))
    low = (mid[0],mid[1]-depth,mid[2])
    xs,zs = zip(*polygon)
    across = max(xs)-min(xs)>max(zs)-min(zs)
    def uv(v):
        x=(v[0]-min(xs))/max(.001,max(xs)-min(xs))
        z=(v[2]-min(zs))/max(.001,max(zs)-min(zs))
        return (.04+.90*(x if across else z), .08+.80*(z if across else x))
    shade=col(color)
    for i,p in enumerate(top):
        j=(i+1)%len(top);q=top[j]
        tri(p,q,mid,shade,'wood',(uv(p),uv(q),uv(mid)),front=(0,1,0))
        tri(bottom[i],bottom[j],low,mul(shade,.91),'wood',(uv(p),uv(q),uv(mid)),front=(0,-1,0))
        outward=((p[0]+q[0])/2-mid[0],0,(p[2]+q[2])/2-mid[2])
        quad(bottom[i],bottom[j],q,p,mul(shade,.84),'wood',outward)


def checks(x,z,direction,length,halfwidth,height):
    # Exposed split tapers into the board with a pale torn grain on one lip.
    dx,dz=direction;sx,sz=dz,-dx
    def pt(u,v):
        px,pz=x+dx*u+sx*v,z+dz*u+sz*v
        return (px,height(px,pz)+.001,pz)
    a,b=pt(0,-halfwidth),pt(0,halfwidth)
    c,d=pt(length*.46,halfwidth*.12),pt(length*.46,-halfwidth*.32)
    end=pt(length,.012)
    quad(a,b,c,d,SPLIT,'bark',front=(0,1,0))
    tri(d,c,end,SPLIT,'bark',front=(0,1,0))
    tri(a,d,pt(.018,-halfwidth-.016),'e2caa3','wood',front=(0,1,0))


def floor(stage):
    begin('floor'+(str(stage) if stage else ''))
    for z in (-1.36,0,1.36):
        box((0,.045,z),(2.988,.09,.15),'99836b','wood')
    # Joists cross the planks beneath. Peg ends and bevels can be read from below.
    for x in (-1.40,1.40):
        box((x,.078,0),(.115,.055,2.988),'af987b','wood')
    top=lambda x,z:.16
    for i in range(9):
        x=-1.5+i/3; l=x+.002; r=x+1/3-.002
        chip=.022+(.085 if stage and i in (2,6) else 0)+(.105 if stage==2 and i in (1,7) else 0)
        polygon=[(l,-1.50+chip),(l+.037,-1.5),(r-.015,-1.5),
                 (r,-1.48),(r,1.5-chip),(r-.026,1.5),(l+.015,1.5),(l,1.47)]
        split = (stage >= 1 and i in (1,4,6)) or (stage == 2 and i in (2,3,7))
        color = col(PLANKS[(i*3)%len(PLANKS)])
        board(polygon,top,.07,mul(color,1-.075*stage) if split else color)
        for z in (-1.36,1.36):
            # Flush darker end-grain pegs; the walking datum remains at .16.
            peg=x+.145+(i%2)*.048
            rod((peg,.154,z),(peg,.1603,z),.021,.020,'9d8063','bark',7)
        if split:
            sign=1 if i%2 else -1
            checks(x+.10,sign*1.49,(0,-sign),(.46+i*.037)*stage,.024+stage*.007,top)
            tri((x+.11,.089,sign*1.49),(x+.18,.089,sign*1.49),
                (x+.142,.089,sign*(1.4-.33*stage)),SPLIT,'bark',front=(0,-1,0))
    if stage:
        for z in (-1.425,1.425):
            for x in (-.78,.48):
                tri((x,0,z),(x+.045,.061,z),(x+.19,.032,z),'715d48','bark',front=(0,0,1 if z>0 else -1))


def ramp(stage):
    begin('ramp'+(str(stage) if stage else ''))
    def top(x,z):return (z+1.5)*2.3/3
    for side in (-1,1):
        x=side*1.095
        rod((x,.028,-1.435),(x,2.18,1.486),.060,.065,'ae9677','wood',8)
        rod((x,.024,1.405),(x,2.13,1.405),.061,.067,'aa9276','wood',8)
        rod((x,.13,1.405),(x,.98,-.12),.043,.050,'b8a183','wood',6)
    # Each tread meets the same inclined plane. Keep treads passable and visually
    # intact as they crack, up to the impact which removes the whole ramp.
    for i in range(14):
        low=-1.5+3*i/14+(0 if i==0 else .002)
        high=-1.5+3*(i+1)/14-(0 if i==13 else .002)
        chip=.027+(.095*stage if i in (3,7,12) else 0)
        polygon=[(-1.2+chip,low),(1.18,low),(1.2,low+.026),(1.2,high-.023),
                 (1.18,high),(-1.18,high),(-1.2,high-.028),(-1.2,low+.045)]
        # At the lower edge the thickness tapers to the toe.
        split = (stage >= 1 and i in (3,7,12)) or (stage == 2 and i in (2,5,9,11))
        color = col(PLANKS[(i*5)%len(PLANKS)])
        board(polygon,top,min(.058,max(.002,top(0,low))),mul(color,1-.075*stage) if split else color)
        if i%3==1 and i<13:
            z=(low+high)*.5;y=top(0,z)
            box((0,y+.005,z),(2.16,.013,.025),'a89275','bark')
        if split:
            sign=1 if i%2 else -1
            checks(sign*1.17,low+.105,(-sign,0),.39*stage,.027,top)
