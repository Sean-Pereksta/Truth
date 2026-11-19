from meshforge import *


def watchtower():
    begin('watchtower')
    for sx in (-1,1):
        for sz in (-1,1):
            x,z=sx*1.52,sz*1.52
            loft([(x,-.08,z,.39,.39),(x,.17,z,.40,.40),(x,.47,z,.31,.31),(x,.53,z,.26,.26)],'a6aaa1','stone',8,.22)
            tube([(x,.46,z),(sx*1.38,2.80,sz*1.38),(sx*1.19,5.76,sz*1.19)],[.18,.169,.148],'c9b395','bark',9)
            for yy,rr in ((.64,.184),(2.65,.172),(5.19,.161)):
                xx=sx*(1.52-.33*(yy/5.76));zz=sz*(1.52-.33*(yy/5.76))
                ring((xx,yy,zz),rr,rr,(0,1,0),.024,'96a398','steel',10)
            rod((sx*1.26,5.63,sz*1.26),(sx*1.26,7.85,sz*1.26),.102,.093,'c9b89c','wood',8)
            loft([(sx*1.26,6.98,sz*1.26,.108,.108),(sx*1.26,7.10,sz*1.26,.109,.109)],'bdc0a8','metal',8)
    for side in (-1,1):
        for dim in (0,1):
            def pt(x,y,z):
                return (x,y,z) if dim==0 else (z,y,x)
            for y1,y2,r1,r2 in ((.73,2.78,1.51,1.38),(2.86,5.43,1.36,1.21)):
                rod(pt(-r1,y1,side*r1),pt(r2,y2,side*r2),.084,.080,'b6a287','wood',7)
                rod(pt(r1,y1,side*r1),pt(-r2,y2,side*r2),.079,.079,'c1af90','wood',7)
            rod(pt(-1.38,2.80,side*1.38),pt(1.38,2.80,side*1.38),.117,.117,'b6a689','wood',8)
            roof_points=[pt(-1.87,7.79,side*1.87),pt(1.87,7.79,side*1.87),pt(.48,8.85,side*.48),pt(-.48,8.85,side*.48)]
            quad(*roof_points,'c4c2a1','patina',pt(0,1,side))
            for i in range(5):
                x=-1.75+i*.875
                rod(pt(x,7.83,side*1.84),pt(x*.25,8.87,side*.48),.032,.022,'d5c399','gilt',6)
            # Four clear observation bays, with a cross rail and warning pennant below.
            box(pt(0,5.54,side*1.36),(2.85,.21,.19) if dim==0 else (.19,.21,2.85),'b5a687','wood')
            rod(pt(-1.3,6.43,side*1.28),pt(1.3,6.43,side*1.28),.074,.074,'b3a082','wood',8)
            for k in range(5):
                p=pt(-1.15+k*.57,5.82,side*1.28)
                rod(p,vec(p,(0,.62,0)),.046,.044,'a99c86','wood',6)
            a=pt(-.56,6.35,side*1.33);b=pt(.57,6.35,side*1.33);c=pt(.43,5.74,side*1.39);d=pt(-.49,5.78,side*1.36)
            quad(a,b,c,d,'a56548','cloth',pt(0,0,side))
            tri(pt(-.30,6.21,side*1.362),pt(.30,6.21,side*1.362),pt(.02,5.91,side*1.392),'dec58e','cloth',front=pt(0,0,side))
    for i in range(12):
        box((0,5.72,-1.56+i*.281),(3.39,.16,.267),'c6b396','wood')
    loft([(0,8.73,0,.61,.61),(0,8.89,0,.56,.56),(0,9.02,0,.40,.40)],'c7baa2','metal',8,.25)
    loft([(0,9.00,0,.36,.36),(0,9.15,0,.38,.38),(0,9.24,0,.34,.34)],'dbbd8c','gilt',12,.36)
    loft([(0,9.24,0,.305,.305),(0,9.43,0,.351,.351),(0,9.82,0,.351,.351),(0,9.98,0,.30,.30)],'ffaf62','skin',16,.77)
    for i in range(6):
        a=TAU*i/6
        rod((.362*COS(a),9.21,.362*SIN(a)),(.362*COS(a),10.01,.362*SIN(a)),.023,.023,'cfc1a0','gilt',6)
    for y in (9.25,9.61,9.99):
        ring((0,y,0),.354,.354,(0,1,0),.025,'c9bda1','gilt',16)
    loft([(0,10.0,0,.39,.39),(0,10.10,0,.43,.43),(0,10.29,0,.11,.11),(0,10.34,0,.04,.04)],'b9bb9a','patina',10,.29)


def aqueduct():
    begin('aqueduct')
    stone_colors=['a5aea2','b2b3a6','a6aba0','b1b3a1','969f94','bcbcad']
    rng=random.Random(4017)
    for i,x in enumerate((-5.34,-1.78,1.78,5.34)):
        h=1.73 if i==3 else 2.06
        for j in range(5):
            w=.72-.054*j+(.06 if j==0 else 0)
            box((x,(j+.5)*h/5,0),(w,h/5-.012,1.62-.05*j),stone_colors[(i*4+j)%6],'stone',.013*SIN(i+j))
        if i!=3:
            box((x,2.03,0),(.78,.15,1.63),'bac0b1','stone')
    for arch,x in enumerate((-3.56,0,3.56)):
        for k in range(13):
            if arch==2 and k<8:continue
            a0=k*math.pi/13+.004;a1=(k+1)*math.pi/13-.004
            r1=1.44;r2=1.81+( .075 if k==6 else 0)
            def v(r,a,z):
                return (x+r*COS(a),2.04+r*SIN(a),z)
            co=stone_colors[(k+arch*3)%6]; d=.79+(.041 if k==6 else 0)
            quads=[((r1,a0,d),(r2,a0,d),(r2,a1,d),(r1,a1,d)),((r1,a1,-d),(r2,a1,-d),(r2,a0,-d),(r1,a0,-d)),((r1,a0,-d),(r1,a0,d),(r1,a1,d),(r1,a1,-d)),((r2,a0,-d),(r2,a0,d),(r2,a1,d),(r2,a1,-d)),((r1,a0,d),(r1,a0,-d),(r2,a0,-d),(r2,a0,d)),((r1,a1,d),(r2,a1,d),(r2,a1,-d),(r1,a1,-d))]
            for j,face in enumerate(quads):
                front=(0,0,1 if j==0 else -1) if j<2 else None
                quad(*(v(*t) for t in face),co,'stone',front)
            cap=4.23 if arch!=2 else 4.04+.11*SIN(k*5)
            for s in (-1,1):
                lower0=v(r2,a0,s*.68);lower1=v(r2,a1,s*.68)
                upper0=(lower0[0],cap,s*.68);upper1=(lower1[0],cap,s*.68)
                quad(lower0,lower1,upper1,upper0,mul(col(co),.85),'stone',(0,0,s))
        if arch<2:
            for j in range(5):
                xx=x-1.78+(j+.5)*.711
                box((xx,4.28,0),(.697,.235,1.69),'a9afa0','stone')
                for s in (-1,1):
                    box((xx,4.55,s*.684),(.695,.314,.244),'b5b7a6','stone')
            if arch==0:
                for s in (-1,1):
                    rod((x-.81,4.47,s*.83),(x+.81,4.47,s*.83),.047,.047,'a4b3a2','patina',6)
    # Moss hems and hanging ivy soften only the outer masonry surfaces.
    for i in range(24):
        x=rng.uniform(-5.4,2.95);s=1 if i%2 else -1; z=s*.842
        if i%3==0:
            ell((x,4.69,z*.84),(.19,.064,.11),'829575','ground',7,3)
        drop=rng.uniform(.20,.69)
        tube([(x,4.56,z),(x+.07,4.50-drop*.43,z+.01*s),(x+.035,4.48-drop,z+.016*s)],[.012,.01,.004],'829878','leaf',4)
        for k in range(3):
            yy=4.46-k*drop*.28; sx=-1 if k%2 else 1
            tri((x,yy,z+.027*s),(x+sx*.10,yy+.017,z+.027*s),(x+sx*.084,yy-.094,z+.031*s),'909e76','leaf',front=(0,0,s))


def bank_plants():
    begin('flowers');rng=random.Random(70)
    for j in range(12):
        a=j*2.40;r=.57*(j/12)**.64
        x,z=r*COS(a),r*SIN(a);h=.39+.34*rng.random()
        base=(x*.87,0,z*.87);mid=(x,.51*h,z);tip=(x+.035*COS(a),h,z+.035*SIN(a))
        tube([base,mid,tip],[.015,.011,.007],'729664','leaf',5)
        for k in range(3):
            aa=a+k*2.26;rise=.13+k*.079
            p=(x,rise,z);end=vec(p,(.17*COS(aa),.105,.17*SIN(aa)))
            center=mul(vec(p,end),.5);side=(.044*COS(aa+1.57),.012,.044*SIN(aa+1.57))
            quad(p,vec(center,side),end,sub(center,side),'839e69','leaf',(0,1,0))
        for k in range(5):
            aa=k*TAU/5+a; p=vec(tip,(.068*COS(aa),.021,.068*SIN(aa)));cx=vec(tip,(.043*COS(aa),.017,.043*SIN(aa)));d=(.025*COS(aa+math.pi/2),.006,.025*SIN(aa+math.pi/2))
            quad(tip,vec(cx,d),p,sub(cx,d),['d9cbb6','d0bec0','c3c1ce'][j%3],'skin',(0,1,0))
        ell(vec(tip,(0,.019,0)),(.016,.012,.016),'e2bb67','skin',7,3)
    begin('rushes');rng=random.Random(73)
    for i in range(27):
        a=i*2.399+.12*rng.random();r=.65*math.sqrt(rng.random());x=r*COS(a);z=r*SIN(a);h=rng.uniform(.43,1.13)
        p=(x,0,z);axis=(COS(a),0,SIN(a));side=(COS(a+1.57),0,SIN(a+1.57))
        if i%4==0:
            tip=(x+.11*axis[0],h,z+.11*axis[2])
            rod(p,tip,.012,.008,'a5a777','leaf',5)
            for k in range(3):
                ell((tip[0]+k*.010*COS(a),h+k*.035,tip[2]+k*.01*SIN(a)),(.027-k*.003,.038,.021),'b6a278','feather',7,3)
        else:
            mid=vec(p,(.09*axis[0],h*.55,.09*axis[2]));second=vec(p,(.27*axis[0],h*.83,.27*axis[2]));tip=vec(p,(.36*axis[0],h*.75,.36*axis[2]))
            ribbon([p,mid,second,tip],[.015,.031,.018,.001],['7f9e6c','98ad7b','b1b780'][i%3],'leaf',dx=side,front=(axis[0],.36,axis[2]))
    begin('shore_rocks');rng=random.Random(77)
    for i in range(9):
        a=i*2.398;r=.93*math.sqrt(i/9);x=r*COS(a);z=.73*r*SIN(a)
        rx=rng.uniform(.22,.48);rz=rx*rng.uniform(.65,.89);ry=rx*rng.uniform(.36,.58)
        loft([(x,-.03,z,rx*.74,rz*.74),(x,ry*.57,z,rx,rz),(x+.046,ry*1.3,z-.017,rx*.85,rz*.81),(x+.04,ry*1.63,z-.023,rx*.44,rz*.41)],['a5aaa0','85968c','a7ac9c','929e97'][i%4],'stone',8,.48,phase=a)
        if i%2==0:
            ell((x+.046,ry*1.52,z-.006),(rx*.38,ry*.119,rz*.35),'8c9c72','ground',7,3)


def create():
    watchtower();aqueduct();bank_plants()
