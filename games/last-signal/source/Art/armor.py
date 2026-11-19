"""Body-fitted wearable meshes in the contestant's torso and forearm bind spaces."""
import math
from meshforge import begin, col, ell, mul, quad, rod, tube, ring, SIN, COS, TAU


def outline(a):
    # The straps bridge the shoulders. The armholes sit below the shoulder joint.
    side = abs(SIN(a))
    collar = .431 + .092 * math.exp(-((side - .57) / .32) ** 2)
    return collar - .101 * side ** 8 + (.027 if COS(a) < 0 else 0) * (1 - side)


def hem(a):
    return .038 + .046 * abs(SIN(a)) + .010 * (1 - COS(a))


def shell(a, t, relief=0):
    y = hem(a) + (outline(a) - hem(a)) * t
    rx = .199 + .054 * min(1, max(0, (y - .10) / .32))
    rz = .154 + .021 * SIN(math.pi * max(0, min(1, (y - .045) / .46)))
    if y > .435:
        # Taper the strap ends over the shoulder onto the existing scarf.
        fade = min(1, (y - .435) / .075)
        rx -= .035 * fade
        rz -= .066 * fade
    return ((rx + relief) * SIN(a), y, (rz + relief) * COS(a) + .003)


def normal(a):
    return SIN(a), 0, COS(a)


def binding(t, radius, color):
    points = [shell(i * TAU / 64, t, .002) for i in range(65)]
    tube(points, [radius] * len(points), color, 'cloth', 5)


def underbody(color):
    slices = 48
    heights = (0, .20, .46, .72, .90, 1)
    for n in range(slices):
        a, b = n * TAU / slices, (n + 1) * TAU / slices
        for low, high in zip(heights, heights[1:]):
            quad(shell(a,low), shell(b,low), shell(b,high), shell(a,high),
                 color, 'cloth', normal((a+b)/2))
    binding(0, .007, '6e5039')
    binding(1, .007, '957758')


def shoulder_bridges(metal):
    # Join each pair of shoulder points over the trapezius, leaving a separate
    # opening under the band for the moving arm and an open neckline between them.
    for side in (-1, 1):
        def point(u,v):
            a=.59+.33*u
            front=shell(a,.99,.006);back=shell(math.pi-a,.99,.006)
            return (side*(front[0]+(back[0]-front[0])*v+.030*SIN(v*math.pi)),
                    front[1]+(back[1]-front[1])*v+.035*SIN(v*math.pi),
                    front[2]+(back[2]-front[2])*v)
        for i in range(8):
            v=i/8; b=(i+1)/8
            tint=('785f47' if metal else '9c895c')
            quad(point(0,v),point(1,v),point(1,b),point(0,b),tint,'wood' if metal else 'cloth',(0,1,0))
        for u in (0,1):
            path=[point(u,j/8) for j in range(9)]
            tube(path,[.0038]*9,'a99472','cloth',5)
        if metal:
            for v in (.24,.74):
                p=point(.5,v)
                ell((p[0],p[1]+.002,p[2]),(.005,.003,.005),'ccac7d','gilt',7,3)


def woven_panel(a, b, index):
    # Each channel stands proud of the seam and tapers into both stitched hems.
    edge = .018
    angles = (a+edge, a+(b-a)*.23, (a+b)/2, b-(b-a)*.23, b-edge)
    heights = (.025,.13,.32,.53,.73,.88,.97)
    colors = ('aa9666','9c9668','aa9b71','b29d70')
    for i in range(4):
        for k in range(len(heights)-1):
            def point(j,h):
                return shell(angles[j],h,.002 + (.002,.008,.013,.008,.002)[j] * SIN(h*math.pi)**.28)
            shade = (.84,1,.96,.76)[i]
            quad(point(i,heights[k]),point(i+1,heights[k]),point(i+1,heights[k+1]),point(i,heights[k+1]),
                 mul(col(colors[index%4]),shade), 'cloth', normal(angles[i]))
    if index%2==0:
        for t in (.12,.25,.38,.51,.64,.77,.90):
            rod(shell(a,t,.0045),shell(a+.01,t+.038,.005),.0019,.0015,'d5be83','cloth',4)


def lace(a, b, t, higher=False):
    y2 = t+.074 if higher else t
    mid=(a+b)*.5
    tube([shell(a,t,.012),shell(mid,(t+y2)/2,.022),shell(b,y2,.012)],
         [.003,.004,.003],'dac69b','cloth',6)


def woven():
    begin('woven_vest')
    underbody('746942')
    shoulder_bridges(False)
    for i in range(18):
        woven_panel(i*TAU/18,(i+1)*TAU/18,i)
    for a in (-.138,.138):
        pts=[shell(a,t,.016) for t in (.09,.31,.55,.80,.91)]
        tube(pts,[.009,.007,.007,.007,.005],'725b43','wood',6)
    for t in (.21,.40,.59,.78):
        for a in (-.138,.138):
            at=shell(a,t,.020)
            ring(at,.006,.005,normal(a),.0022,'aa8d56','gilt',7)
        lace(-.138,.138,t,True)
        lace(.138,-.138,t,True)


def plate(a0, a1, bottom, top, tint, sequence):
    angles = [a0,a0+.045,(a0+a1)*.5,a1-.045,a1]
    def shape(col_idx, row):
        a = angles[col_idx]
        corner=.041 if col_idx in (0,4) else 0
        low=bottom + corner + .011*SIN(a*2.1+sequence)
        high=top - corner*.68 + .012*COS(a*2.4+sequence)
        t = (low,low+.025,high-.019,high)[row]
        raised=(.007,.015,.012,.008)[row]+(.002 if col_idx==2 else 0)+(.009 if bottom>.59 else .004)
        return shell(a,t,raised)
    for j in range(3):
        for i in range(4):
            tintband = ('5b5851',tint,'c1b290')[j]
            quad(shape(i,j),shape(i+1,j),shape(i+1,j+1),shape(i,j+1),
                 tintband,'steel',normal((angles[i]+angles[i+1])/2))
    for a in (a0+.082,a1-.082):
        p = shell(a,top-.088,.020 if bottom<.59 else .026)
        ell(p,(.005,.005,.005),'e1b573','gilt',7,3)
    # Narrow pale gouges follow one face without cutting through an edge.
    if sequence%3==1:
        a=(a0+a1)*.5; t=(bottom+top)*.5
        rod(shell(a,t,.021),shell(a+.072,t+.049,.021),.0015,.0007,'d0c6a7','steel',4)


def cuirass():
    begin('scrap_cuirass')
    underbody('675a4d')
    shoulder_bridges(True)
    shades=('889797','a4aaa4','9b8a72','8e9995','b5aa92')
    for j,(low,high,n) in enumerate(((.055,.36,8),(.32,.66,8),(.61,.98,6))):
        for i in range(n):
            a=(i+(.17 if j==1 else 0))*TAU/n
            seq=j*8+i
            plate(a+.034,a+TAU/n-.034,low,high,shades[seq%len(shades)],seq)
    # A salvaged leather belt cinches the lower plates, with a raised brass clasp.
    for i in range(48):
        a,b=i*TAU/48,(i+1)*TAU/48
        quad(shell(a,.215,.023),shell(b,.215,.023),shell(b,.275,.023),shell(a,.275,.023),
             '71523c','wood',normal((a+b)/2))
    clasp=[shell(-.15,.209,.025),shell(.10,.209,.025),shell(.10,.288,.025),shell(-.15,.288,.025)]
    tube(clasp+[clasp[0]],[.004]*5,'d9b27b','gilt',7)


def cuff_point(a,t,radius):
    return radius*SIN(a), t, radius*COS(a)


def cuff(metal):
    begin('cuirass_cuff' if metal else 'vest_cuff')
    base = '745943' if metal else 'ad9c73'
    low=.39 if metal else .38;high=.91 if metal else .71
    segments=16
    for i in range(segments):
        a,b=i*TAU/segments,(i+1)*TAU/segments
        for j in range(3):
            t0=low+(high-low)*j/3;t1=low+(high-low)*(j+1)/3
            r0=.089-.035*t0;r1=.089-.035*t1
            quad(cuff_point(a,t0,r0),cuff_point(b,t0,r0),cuff_point(b,t1,r1),cuff_point(a,t1,r1),base,'cloth',normal((a+b)/2))
    edges=(low,high-.026) if not metal else (low+.022,high-.052)
    for t in edges:
        for i in range(segments):
            a,b=i*TAU/segments,(i+1)*TAU/segments
            r=.091-.035*t
            quad(cuff_point(a,t,r),cuff_point(b,t,r),cuff_point(b,t+.023,r),cuff_point(a,t+.023,r),
                 '503f34' if metal else '756644','wood' if metal else 'cloth',normal((a+b)/2))
    for i in range(8):
        a0,a1=i*TAU/8+.060,(i+1)*TAU/8-.060
        for j in range(2):
            a,b=(a0,(a0+a1)/2,a1)[j:j+2]
            bottom=low+.065;top=high-.055
            r0=.095-.035*bottom; r1=.094-.035*top
            p0=cuff_point(a,bottom+.014*(j==0),r0);p1=cuff_point(b,bottom+.014*(j==1),r0)
            p2=cuff_point(b,top-.019*(j==1),r1);p3=cuff_point(a,top-.019*(j==0),r1)
            quad(p0,p1,p2,p3,('96a09b' if j==0 else '798782') if metal else ('b6a46f' if j==0 else '94855c'), 'steel' if metal else 'cloth',normal((a+b)/2))
        if metal:
            p=cuff_point((a0+a1)/2,low+.15,.097-.035*(low+.15))
            # Scale axial dimensions in the authored unit-length forearm space.
            ell(p,(.0028,.007,.0028),'d9b780','gilt',6,3)


def create():
    woven()
    cuirass()
    cuff(False)
    cuff(True)
