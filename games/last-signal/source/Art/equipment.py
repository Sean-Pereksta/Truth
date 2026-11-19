from meshforge import *
import timber_forts


def binding(a,b,r,n=4):
    for i in range(n):
        p=vec(mul(a,1-i/n),mul(b,i/n))
        q=vec(mul(a,1-(i+.70)/n),mul(b,(i+.70)/n))
        rod(p,q,r,r*.995,'d6c098','cloth',8)


def blade(profile,tint='eaf0e9',depth=.025):
    # Convex double-edged shape, an actual beveled ridge on both faces.
    n=len(profile); cx=sum(x for x,y in profile)/n; cy=sum(y for x,y in profile)/n
    for zsign in (-1,1):
        for i in range(n):
            x,y=profile[i]; xx,yy=profile[(i+1)%n]
            tri((x,y,0),(xx,yy,0),(cx,cy,depth*zsign),mul(col(tint),1 if i%2 else .88),'steel',front=(0,0,zsign))


def field_bow(draw):
    begin(('bow','bow_draw1','bow_draw2')[draw])
    tension=(0,.50,1)[draw]
    ends=[]
    for side in (-1,1):
        # A flattened yew limb, backed by a narrower darker lamination.
        rows=[]
        for u,z,rx,rz in [(0,.022,.030,.026),(.16,.016,.035,.019),(.33,-.023,.030,.015),(.49,-.089,.025,.013),(.61,-.168,.017,.010),(.70,-.188,.010,.008),(.73,-.160,.006,.006)]:
            f=u/.73
            y=.025+side*u*(1-.125*tension*f*f)
            zz=z-.135*tension*f*f
            rows.append((.009*SIN(f*4)*side,y,zz,rx,rz))
        cap=rows[-1][:3]
        ends.append((cap[0],cap[1]-.012*side,cap[2]))
        loft(rows,'c8a67b','wood',12,.64)
        backing=[(x,y,z+rz*.80,rx*.66,rz*.25) for x,y,z,rx,rz in rows[:-1]]
        loft(backing,'917755','bark',10,.68)
        tip=rows[-2][:3]
        tube([tip,cap],[.013,.006],'d9c29d','gilt',8)
        lo=rows[1][:3];hi=rows[2][:3]
        for n in range(3):
            f=.25+n*.13
            a=vec(mul(lo,1-f),mul(hi,f));b=vec(a,(0,.006*side,-.001))
            rod(a,b,.034-.002*n,.034-.002*n,'c3ae84','cloth',10)
    binding((0,-.084,.022),(0,.110,.020),.034,12)
    for sy in (-.092,.119):
        ring((0,sy,.02),.033,.030,(0,1,0),.004,'c2aa81','gilt',14)
    nock=(0,.035,(-.16,-.32,-.50)[draw])
    for p in ends:
        rod(p,nock,.0037,.0037,'ded9c0','cloth',6)
    rod((0,.015,nock[2]),(0,.051,nock[2]),.0052,.0052,'946d4c','wood',7)


def items():
    begin('knife')
    tube([(0,-.089,0),(0,-.032,0),(.005,.083,.003)],[.026,.036,.026],'aa8b69','wood',10)
    binding((0,-.077,0),(.004,.068,.003),.032,8)
    box((0,.085,0),(.12,.022,.05),'e5d5ae','metal')
    blade([(-.030,.091),(.040,.092),(.050,.185),(.038,.273),(-.012,.404),(-.025,.245)])
    begin('spear')
    tube([(0,-.76,0),(-.012,-.41,.006),(.009,.03,0),(-.009,.56,.011),(0,1.08,.008)],[.024,.024,.022,.022,.018],'dac3a2','wood',9)
    binding((.004,-.15,.001),(.004,.117,.001),.027,12)
    blade([(-.025,1.006),(.025,1.006),(.062,1.098),(.033,1.213),(0,1.355),(-.038,1.202),(-.056,1.098)],'dbe3de',.025)
    binding((0,.97,.007),(0,1.071,.007),.031,6)
    for yy in (-.58,-.49,.72,.84):
        ring((0,yy,.008),.023,.023,(0,1,0),.004,'d5be8e','gilt',10)
    rod((0,-.765,0),(0,-.826,0),.026,.009,'a9b1aa','steel',10)
    for s in (-1,1):
        ribbon([(s*.012,1.082,.024),(s*.015,1.159,.023),(s*.001,1.316,.008)],[.004,.005,.001],'e4ddd1','steel')
    begin('hatchet')
    tube([(.036,-.191,.004),(.007,-.082,0),(-.018,.151,0),(.003,.328,0)],[.033,.029,.027,.03],'e5cfac','wood',9)
    binding((.027,-.173,.002),(.003,-.068,0),.035,6)
    blade([(-.07,.282),(.025,.308),(.126,.292),(.208,.349),(.224,.206),(.191,.112),(.096,.173),(.011,.213),(-.078,.224)],'bfcdca',.040)
    box((-.018,.262,0),(.074,.079,.091),'d1c7a8','metal')
    binding((0,.17,.002),(0,.227,.001),.036,3)
    for draw in range(3):field_bow(draw)
    begin('sling')
    ell((.003,.135,.002),(.066,.09,.023),'bb9778','wood',9)
    tube([(-.036,.192,0),(-.109,.363,.01),(-.105,.455,.05),(-.041,.515,.097)],[.009,.006,.007,.008],'d8c4a0','cloth',6)
    tube([(.036,.191,0),(.095,.338,-.016),(.048,.456,-.017),(-.026,.50,.09)],[.009,.007,.007,.008],'c8b28e','cloth',6)
    tube([(-.029,.086,0),(-.054,.006,.02),(-.023,-.048,.036),(.010,-.045,.038),(.034,.015,.021),(.035,.085,0)],.008,'cfb68e','cloth',6)
    def arrow(x,y,z,tilt=0):
        a=(x,y,z); end=(x+tilt,y+.65,z)
        rod(a,end,.009,.005,'d6c19d','wood',7)
        for s in (-1,1):
            a=(end[0]-.022,end[1]-.012,z);b=(end[0]+.022,end[1]-.012,z);point=(end[0]+.05*tilt,end[1]+.082,z)
            ridge=(end[0],end[1]+.019,z+s*.010)
            tri(a,point,ridge,'ced5d1','steel',front=(0,0,s))
            tri(point,b,ridge,'eee5cf','steel',front=(0,0,s))
            tri(b,a,ridge,'a4a99e','steel',front=(0,0,s))
        rod((end[0],end[1]-.060,z),end,.010,.009,'bda17c','cloth',7)
        for j in range(3):
            ang=j*TAU/3; dx,dz=.032*COS(ang),.032*SIN(ang)
            quad((x,y+.017,z),(x+dx,y+.01,z+dz),(x+dx*.70,y+.09,z+dz*.70),(x+tilt*.16,y+.14,z),'cdd2bf','cloth')
            quad((x+.1*dx,y+.051,z+.1*dz),(x+.86*dx,y+.048,z+.86*dz),(x+.78*dx,y+.060,z+.78*dz),(x+.17*dx,y+.063,z+.17*dz),'9b886d','feather')
    begin('arrow'); arrow(0,-.30,0)
    begin('arrows')
    for j in range(4):
        a=j*1.68
        arrow(.020*COS(a),.014*j,.018*SIN(a),.050*COS(a))
    binding((0,.12,0),(0,.154,0),.043,3)
    begin('branch')
    tube([(-.35,.043,-.09),(-.17,.055,-.047),(.076,.062,.024),(.31,.086,.07),(.47,.087,.101)],[.047,.052,.039,.027,.012],'dad0b5','wood',8)
    tube([(.089,.064,.018),(.151,.13,-.062),(.207,.15,-.124)],[.026,.018,.008],'cebea0','wood',6)
    begin('stone')
    ell((.01,.087,-.004),(.151,.099,.113),'a3aaa3','stone',8,4)
    ell((-.106,.052,.075),(.087,.051,.066),'919d9c','stone',7,4)
    begin('fiber')
    for k in range(12):
        a=k*2.399; x=COS(a)*.03;z=SIN(a)*.03
        tube([(-.18,.04+x,-.086+z),(-.064,.07+x,-.026+z),(.083,.046+x,.045+z),(.241+z,.061+x,.121+z*2)],[.011,.015,.013,.004],'d8c58d' if k%2 else 'a9ae77','cloth',5)
    binding((-.005,.061,-.003),(.051,.061,.023),.048,3)
    begin('tinder')
    rng=random.Random(74)
    for i in range(12):
        x,z=rng.uniform(-.14,.14),rng.uniform(-.10,.10)
        rod((x,.024,z),(x+.16,.024+i*.006,z+rng.uniform(-.12,.12)),.01,.006,'d7c5a5','wood',5)
    for i in range(7):
        a=i*2.399
        ell((.092*COS(a),.084,.078*SIN(a)),(.051,.04,.06),'d1b484','cloth',6,3)
    begin('cloth')
    for i in range(3):
        box((i*.013,.025+i*.036,0),(.319-i*.029,.033,.218+i*.019),['c6c5a7','bbbda7','d3ccaf'][i],'cloth',.06*i)
    ribbon([(-.133,.13,-.1),(-.16,.084,-.02),(-.177,.032,.10)],[.034,.031,.025],'c7c6aa')
    begin('scrap')
    box((0,.030,.02),(.28,.049,.18),'a4b1ac','steel',-.18)
    box((.014,.071,.016),(.23,.026,.085),'bdc3b8','steel',.34)
    ring((-.081,.106,.029),.055,.045,(0,1,0),.012,'c9b696','metal',11)
    begin('bandage')
    rod((-.084,.095,0),(.089,.095,0),.091,.091,'e7e0c6','cloth',16)
    for x in (-.084,.089):
        for r in (.030,.051,.074):
            ring((x,.095,0),r,r,(1,0,0),.003,'b9b69e','cloth',18)
    ribbon([(0,.021,.025),(0,.012,.119),(.015,.009,.211),(.042,.012,.252)],[.083,.085,.07,.063],'e2dac1',front=(0,1,0))
    begin('meat')
    loft([(0,.015,0,.15,.076),(.006,.045,0,.19,.095),(.012,.12,-.008,.13,.067),(.037,.14,-.009,.060,.04)],'c77866','skin',11,.6)
    ribbon([(-.132,.055,.05),(-.061,.111,.052),(.021,.135,.028),(.121,.079,-.005)],[.012,.013,.009,.009],'ecd5b6','skin',dx=(0,0,1),front=(0,1,0))
    begin('meal')
    loft([(0,.008,0,.12,.079),(0,.044,0,.158,.093),(.018,.091,-.014,.10,.061),(.028,.105,-.01,.048,.034)],'a77e57','wood',11,.55)
    for i in range(4):
        x=-.09+.052*i
        rod((x,.075+.019*SIN(i),.036),(x+.015,.075+.019*SIN(i),-.038),.007,.005,'645643','wood',5)
    begin('pack')
    loft([(0,.022,0,.182,.109),(0,.081,-.005,.209,.124),(0,.255,-.013,.210,.142),(0,.392,-.023,.170,.115)],'98967c','cloth',10)
    ell((0,.35,.03),(.190,.102,.130),'a69f80','cloth',10,5)
    for s in (-1,1):
        ribbon([(s*.109,.391,.041),(s*.12,.331,.139),(s*.112,.191,.139),(s*.117,.083,.115)],[.018]*4,'8b7151','wood')
        box((s*.11,.224,.146),(.046,.044,.015),'dacf9f','metal')
        tube([(s*.091,.32,-.107),(s*.15,.235,-.199),(s*.157,.118,-.173),(s*.119,.065,-.095)],.022,'a08f70','wood',7)
    box((0,.124,.136),(.155,.113,.079),'b0a387','cloth')


def plank(x,width,height,z,damage,seed):
    rng=random.Random(seed)
    corners=[(-width*.52,-.082),(width*.5,-.073),(width*.52,.079),(-width*.48,.085)]
    base=[(x+dx,.006,z+dz) for dx,dz in corners]
    mid=[(x+dx,.84*height,z+dz) for dx,dz in corners]
    tip=[(x+dx*.77+rng.uniform(-.025,.025),height+rng.uniform(-.11,.06)*damage,z+dz*.65) for dx,dz in corners]
    co=['d5c7ab','c4b295','bdae97','d8c5a4'][seed%4]
    for i in range(4):
        k=(i+1)%4
        quad(base[i],base[k],mid[k],mid[i],co,'wood')
        quad(mid[i],mid[k],tip[k],tip[i],co,'wood')
    quad(*tip,'e1d0aa','wood',front=(0,1,0))
    if damage>1 and seed%2==0:
        origin=(x-width*.24,height*.73,z+.078)
        tube([origin,vec(origin,(-.052,-.095,0)),vec(origin,(.04,-.135,0)),vec(origin,(-.011,-.288,.001))],[.011,.012,.009,.002],'615847','wood',4)


def buildings():
    begin('fire')
    for i in range(10):
        a=TAU*i/10
        ell((.51*COS(a),.101,.45*SIN(a)),(.139,.116,.151),['8b948b','9fa598','a59d8b'][i%3],'stone',7,4)
    ell((0,.041,0),(.47,.045,.42),'4f4941','stone',10,3)
    for i in range(5):
        a=i*TAU/5
        rod((.32*COS(a),.08,.31*SIN(a)),(-.12*COS(a),.38,-.11*SIN(a)),.075,.047,'a58b6c','wood',8)
    for typ in ('wall','barricade','gate','lean_to'):
        for stage in range(3):
            begin(typ+('' if stage==0 else str(stage))); rng=random.Random(52+stage)
            if typ in ('wall','barricade','gate'):
                h=1 if typ=='barricade' else 2.3
                for s in (-1,1):
                    rod((s*1.39,-.015,0),(s*1.39,h+.04-rng.random()*.11,0),.112,.095,'ad9d80','wood',8)
                if typ=='gate':
                    box((0,h-.008,0),(3,.14,.19),'c1ad8f','wood')
                    bone('leaf','root',(-1.33,.035,0))
                off=1.33 if typ=='gate' else 0
                for j in range(10):
                    x=-1.19+j*.265+off
                    gap=stage*.18*max(0,1-abs(4-j)*.25)
                    if stage==2 and j in (3,5):gap=.57
                    hh=h*(1-.023*rng.random()-gap)-(.16 if typ=='gate' else .06)
                    plank(x,.25,hh,.014*SIN(j),stage+1,39+j)
                for k in range(2):
                    yy=h*(.235+k*.48)
                    if stage<2 or k==0:
                        box((off,yy,-.091),(2.74,.109,.085),'b3a384','wood')
                if typ=='gate':
                    rod((off-1.2,.26,-.131),(off+1.23,h-.40,-.131),.061,.065,'c3ad8e','wood',6)
                    rod((off-1.2,.26,.127),(off+1.2,h-.37,.127),.055,.055,'c3ad8e','wood',6)
                    box((off+1.01,h*.47,.129),(.301,.038,.066),'ded5ab','metal')
                    ring((off+.981,h*.47-.090,.166),.087,.092,(0,0,1),.018,'e0d4b0','gilt',14)
                    for hh in (.36,1.70):
                        box((.23,hh,.124),(.48,.063,.039),'bdb599','steel')
                        for xx in (.05,.40):ell((xx,hh,.151),(.024,.024,.016),'dec89c','gilt',7,3)
                for k in range(3):
                    x=off+(k-1)*1.16
                    for yy in (h*.23,h*.71):
                        if stage<2 or yy<h*.5:
                            binding((x,yy-.045,.022),(x,yy+.048,.022),.129,3)
            else:
                for s in (-1,1):
                    rod((s*1.09,0,1),(s*1.09,1.89,1),.092,.061,'b8a98d','wood',7)
                    rod((s*1.08,.10,-1.17),(s*1.08,1.87,1.04),.078,.061,'c7b89b','wood',8)
                rod((-1.2,1.85,1.00),(1.2,1.85,1.00),.079,.073,'c7b395','wood',8)
                for i in range(12):
                    if stage==2 and i in (4,8):continue
                    x=-1.19+i*.213; co=['99a07b','c3b988','aea57c'][i%3]; t=1-.17*(stage if i%4==0 else 0)
                    quad((x,.115,-1.2),(x+.235,.117,-1.195),(x+.237,.115+1.72*t,-1.20+2.24*t),(x,.115+1.72*t,-1.2+2.24*t),co,'cloth',front=(0,1,-.5))
                    rod((x,.15,-1.16),(x,1.83,1),.022,.017,'baa781','wood',5)
    for stage in range(3):
        timber_forts.ramp(stage)
        timber_forts.floor(stage)


def create():
    items(); buildings(); cache(); water_assets(); weapon_table()


def weapon_table():
    begin('weapon_table')
    for k in range(4):
        box((0,.741,-.393+k*.262),(2.40,.118,.255),'bdac8d' if k%2 else 'c8b596','wood')
    for sign in (-1,1):
        x=sign*.776
        for zside in (-1,1):
            rod((x,.04,zside*.436),(x,.701,zside*.264),.084,.071,'ab987c','wood',8)
            rod((x-sign*.47,.676,zside*.31),(x,.298,zside*.32),.037,.044,'c1ac8c','wood',7)
        box((x,.157,0),(.119,.089,.783),'afa187','wood')
        box((x,.677,0),(.157,.108,.961),'a8967d','wood')
    box((0,.303,0),(1.59,.110,.114),'c3ae8f','wood')
    for sx in (-1,1):
        for sz in (-1,1):
            box((sx*1.081,.747,sz*.525),(.235,.095,.026),'b9bd9c','patina')
            box((sx*1.201,.747,sz*.440),(.021,.093,.165),'d2c697','gilt')
            for dx in (-.061,.061):
                ell((sx*1.081+dx,.746,sz*.542),(.014,.014,.006),'e8d8a7','gilt',7,3)
    # A short bronze-trimmed cloth runner drapes toward the approach edge.
    ribbon([(-.52,.808,-.516),(-.52,.810,0),(-.52,.810,.525),(-.529,.696,.549),(-.53,.399,.557)],[.191,.192,.196,.190,.174],'985b42','cloth',front=(0,.38,1))
    ribbon([(-.53,.471,.561),(-.531,.451,.561)],[.173,.171],'d9c18a','cloth',front=(0,0,1))
    tri((-.61,.63,.557),(-.44,.63,.557),(-.528,.54,.560),'e1c791','cloth',front=(0,0,1))


def cache():
    begin('cache')
    w=.825; d=.44
    box((0,.077,0),(1.64,.146,.87),'aa957b','wood')
    for row in range(3):
        yy=.17+row*.176
        for z in (-d,d):
            box((0,yy,z),(1.65,.172,.064),'c7af91','wood')
        for s in (-1,1):
            box((s*w,yy,0),(.066,.172,.83),'bbac90','wood')
    for z in (-d,d):
        box((0,.642,z),(1.72,.062,.086),'d5c6a2','gilt')
        for x in (-.691,.691):
            box((x,.32,z*1.072),(.094,.59,.027),'cbbca2','metal')
            for yy in (.102,.354,.575):ell((x,yy,z*1.115),(.021,.022,.018),'ebdbaa','gilt',7,3)
    for s in (-1,1):
        box((s*w,.642,0),(.082,.061,.91),'d5c6a2','gilt')
    # Hinged open lid, folded close to vertical with an embossed crossed-strand emblem.
    def lid(x,u,layer=0):
        return (x,.657+u*.79-layer*.055,-.409-u*.31-layer*.062)
    for j in range(5):
        u=j*.18
        quad(lid(-.823,u),lid(.823,u),lid(.823,u+.177),lid(-.823,u+.177),'b4ad91','wood',(0,.25,1))
        quad(lid(-.823,u,1),lid(.823,u,1),lid(.823,u+.177,1),lid(-.823,u+.177,1),'a59d81','wood',(0,0,-1))
    for a in (-.803,-.655,.655,.803):
        rod(lid(a,0),lid(a,.91),.03,.028,'d9c8a2','gilt',7)
    for u in (0,.91):
        rod(lid(-.827,u),lid(.827,u),.045,.045,'e2d2ac','gilt',7)
    for s in (-1,1):
        for i in range(4):
            p=vec(lid(s*(.03+i*.072),.21+i*.101),(0,0,.026))
            tri(p,vec(p,(s*.12,.04,-.015)),vec(p,(s*.107,.116,-.04)),'dec89c','gilt',front=(0,.20,1))
    # Store a mixture of rolled wool, a drawstring bundle and arrow shafts.
    for j in range(2):
        rod((-.63,.59+j*.11,-.15),(-.15,.59+j*.11,-.15),.115,.115,'acb6a0' if j else 'd1c7a0','cloth',13)
        for x in (-.52,-.26):
            rod((x,.59+j*.11,-.15),(x+.032,.59+j*.11,-.15),.121,.121,'b6a081','wood',10)
    ell((-.12,.55,.14),(.25,.196,.129),'a69870','cloth',10,5)
    for q in range(6):
        x=.34+.066*(q%3);z=.032+.075*(q//3)
        end=(x+.026*(q-2),.99+.077*(q%3),z-.113)
        rod((x,.31,z),end,.012,.009,'dbc9a3','wood',6)
        for s in (-1,1):
            tri(end,vec(end,(s*.043,-.094,.013)),vec(end,(0,-.173,.028)),'d2d7c1','feather',front=(0,0,1))
    # Painted signal-cloth drapes over the front wall, with a stitched hem.
    ribbon([(.188,.66,.08),(.188,.674,.37),(.187,.663,.498),(.17,.437,.514),(.20,.335,.526)],[.120,.127,.129,.119,.11],'a56b51',front=(0,.45,1))
    ribbon([(.188,.400,.525),(.19,.381,.529)],[.116,.116],'e2c795',front=(0,.20,1))


def water_assets():
    begin('waterskin')
    # Two sealed panels taper into an offset cork neck. The bright welt,
    # stitches, and carrying loop make the flask readable in a dropped pack.
    profile=[(-.003,.023,-.002,.036,.019),(-.006,.041,0,.093,.045),(-.010,.098,0,.118,.063),(-.005,.158,0,.111,.057),(.012,.208,0,.076,.047),(.034,.250,0,.043,.030),(.054,.280,0,.026,.025)]
    loft(profile,'b39471','wood',14,.75)
    for s in (-1,1):
        pts=[(x+s*rx,y,z) for x,y,z,rx,rz in profile]
        tube(pts,.0065,'e2ce9e','cloth',6)
        for j in range(len(pts)-1):
            a,b=pts[j],pts[j+1]
            c=vec(mul(a,.55),mul(b,.45))
            end=vec(mul(a,.34),mul(b,.66));d=(s*.007,0,.003)
            rod(sub(c,d),vec(end,d),.0036,.0036,'ede1b4','cloth',5)
    tube([(.037,.244,0),(.051,.277,0),(.061,.292,0)],[.034,.029,.024],'c8b187','wood',9)
    rod((.058,.283,0),(.067,.305,0),.023,.021,'c4ac83','wood',8)
    ring((.047,.264,0),.03,.030,(.40,1,0),.006,'e8d2a7','gilt',15)
    tube([(-.107,.114,0),(-.130,.234,.002),(-.071,.317,.004),(.023,.309,.009),(.048,.275,.008)],[.006,.005,.006,.005,.006],'d9c39a','cloth',6)
    begin('spring')
    # Field-cut oval basin, with an open depression that holds reflective water.
    loft([(0,.01,.085,.89,.64),(0,.12,.085,.94,.67),(0,.28,.085,.88,.60)],'a7aca0','stone',17,.18)
    for i in range(15):
        a0=i*TAU/15+.018;a1=(i+1)*TAU/15-.017
        def slab(a,r,h):
            return (.92*r*COS(a),h,.085+.665*r*SIN(a))
        co=['a8afa6','949f94','a8ab99','b5b5a6'][i%4];ri=.75
        y=.57+.019*SIN(i*3.1)
        quad(slab(a0,1,.20),slab(a1,1,.20),slab(a1,1,y),slab(a0,1,y),co,'stone',(COS(a0),0,SIN(a0)))
        quad(slab(a0,1,y),slab(a1,1,y),slab(a1,ri,y-.017),slab(a0,ri,y-.017),co,'stone',(0,1,0))
        quad(slab(a0,ri,y-.017),slab(a1,ri,y-.017),slab(a1,.66,.235),slab(a0,.66,.235),'839c91','stone',(-COS(a0),.4,-SIN(a0)))
        for ang in (a0,a1):
            quad(slab(ang,1,.22),slab(ang,1,y),slab(ang,ri,y-.017),slab(ang,.66,.235),'859486','stone')
    loft([(0,.045,-.51,.44,.23),(0,.42,-.50,.36,.23),(.015,.65,-.54,.27,.19),(.035,.785,-.54,.19,.15)],'a1aa98','stone',10,.27)
    tube([(0,.667,-.44),(0,.676,-.367),(0,.676,-.282)],[.069,.060,.05],'c9c8a8','patina',10)
    ring((0,.676,-.278),.050,.050,(0,0,1),.009,'c6b99b','gilt',14)
    for i in range(6):
        a=TAU*i/6
        ell((.75*COS(a),.42,.09+.53*SIN(a)),(.12,.08,.09),'829871','ground',7,3)
    for stage in (0,1,2):
        begin('rain_barrel'+('' if stage==0 else str(stage)))
        n=16
        ringheights=[(.025,.416),(.18,.458),(.54,.517),(.88,.482),(1.078,.446)]
        for i in range(n):
            a=i*TAU/n+.008; b=(i+1)*TAU/n-.008
            hh=1
            if stage and i in (1,4,9,13):hh=.91 if stage==1 else .78-(i%3)*.05
            if stage==2 and i in (3,10):hh=.79
            def rail(t,k,inn=0):
                h,r=ringheights[k]
                if k==4:h*=hh
                return ((r-inn)*COS(t),h,(r-inn)*SIN(t))
            co=['bba489','cbb193','d5c4a5','beaa91'][i%4]
            for j in range(4):
                front=(COS(a),0,SIN(a))
                quad(rail(a,j),rail(b,j),rail(b,j+1),rail(a,j+1),co,'wood',front)
                quad(rail(b,j,.024),rail(a,j,.024),rail(a,j+1,.024),rail(b,j+1,.024),'aa957e','wood',mul(front,-1))
            quad(rail(a,4),rail(b,4),rail(b,4,.027),rail(a,4,.027),'e1cfad','wood',(0,1,0))
        loft([(0,.045,0,.414,.414),(0,.082,0,.425,.425)],'a69377','wood',16,.1)
        for y,r in ((.135,.451),(.442,.511),(.838,.50)):
            band=[[(rr*COS(k*TAU/n),y+dy,rr*SIN(k*TAU/n)) for k in range(n)] for dy,rr in ((-.025,r),(-.017,r+.004),(.019,r+.004),(.025,r))]
            hoopmesh(band,[(0,y+dy,0) for dy in (-.025,-.017,.019,.025)],'b3b9ad','steel',capped=False,smooth=.42)
        tube([(0,.272,.463),(0,.269,.548),(0,.234,.572)],[.032,.029,.022],'d6b887','gilt',9)
        rod((0,.270,.541),(0,.330,.544),.010,.011,'d6c093','gilt',7)
        box((0,.332,.544),(.098,.017,.022),'b8b7a0','steel')
