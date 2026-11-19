from meshforge import *
import meshforge as geometry


def glove(x=0,y=0,z=0,side=1):
    ell((x,y-.036,z+.035),(.056,.081,.047),'947657','skin',12,7)
    for i in range(4):
        off=(i-1.5)*.024
        tube([(x+off,y-.050,z+.046),(x+off,y-.098,z+.065),(x+off,y-.106,z+.089),(x+off,y-.084,z+.098),(x+off,y-.066,z+.084)],[.018,.019,.017,.014,.005],'bc9c81','skin',10)
    tube([(x+.041*side,y-.039,z+.039),(x+.057*side,y-.065,z+.079),(x+.030*side,y-.080,z+.106),(x+.002*side,y-.077,z+.103)],[.024,.023,.018,.007],'bc9c81','skin',10)


face_rows=[(.046,.039,.051,.038),(.063,.069,.074,.027),(.083,.087,.087,.022),(.103,.097,.095,.018),(.125,.106,.099,.017),(.146,.112,.102,.016),(.159,.113,.103,.015),(.168,.115,.103,.013),(.179,.116,.107,.011),(.202,.115,.106,.004),(.229,.107,.101,-.004),(.251,.093,.090,-.011),(.272,.061,.068,-.014)]


def face_delta(x,y):
    def g(cx,cy,wx,wy): return math.exp(-((x-cx)/wx)**2-((y-cy)/wy)**2)
    return (.025*g(0,.135,.016,.021)+.016*g(0,.158,.012,.034)
            +.010*g(.019,.132,.011,.009)+.010*g(-.019,.132,.011,.009)
            -.010*g(.044,.162,.024,.013)-.010*g(-.044,.162,.024,.013)
            +.005*g(.061,.145,.027,.013)+.005*g(-.061,.145,.027,.013)
            +.006*g(0,.091,.035,.014))


def face_z(x,y):
    j=next((i for i in range(len(face_rows)-1) if y<=face_rows[i+1][0]),len(face_rows)-2)
    lo,hi=face_rows[j:j+2];f=max(0,min(1,(y-lo[0])/(hi[0]-lo[0])))
    rx,rz,cz=[lo[i]+(hi[i]-lo[i])*f for i in (1,2,3)]
    return cz+rz*math.sqrt(max(0,1-(x/rx)**2))+face_delta(x,y)


def sculpt_face():
    r=[];centers=[];n=38
    start=len(geometry.part['v'])
    for y,rx,rz,cz in face_rows:
        ringpts=[]
        for j in range(n):
            a=TAU*j/n; x=rx*COS(a);sn=SIN(a)
            ringpts.append((x,y,cz+rz*sn+(face_delta(x,y) if sn>0 else 0)))
        r.append(ringpts);centers.append((0,y,cz))
    hoopmesh(r,centers,'cfa78b','skin',smooth=.95)
    for i in range(start,len(geometry.part['v'])):
        v=geometry.part['v'][i];x,y,z=v[:3]
        shade=.10*math.exp(-((y-.079)/.018)**2)+.11*math.exp(-((y-.129)/.005)**2-(x/.025)**2)
        blush=.025*math.exp(-((y-.145)/.022)**2-((abs(x)-.070)/.028)**2)
        geometry.part['v'][i]=(*v[:8],v[8]*(1-shade+blush),v[9]*(1-shade-blush*.5),v[10]*(1-shade-blush))
    # A continuous bridge reaches the tip, then turns underneath toward the
    # philtrum. Narrow side planes blend flush into the cheeks.
    rows=[]
    for yy,ww,cc in ((.126,.016,.002),(.129,.021,.006),(.132,.025,.010),(.137,.023,.014),(.141,.018,.014),(.149,.014,.008),(.161,.011,.005),(.172,.010,.001)):
        row=[]
        for u in (-1,-.75,-.45,0,.45,.75,1):
            x=u*ww; z=face_z(x,yy)+.00062+cc*.68*(1-u*u)**1.48
            row.append((x,yy,z))
        rows.append(row)
    norms=[]
    for j,row in enumerate(rows):
        ns=[]
        for k,point in enumerate(row):
            dx=sub(row[min(6,k+1)],row[max(0,k-1)])
            dy=sub(rows[min(len(rows)-1,j+1)][k],rows[max(0,j-1)][k])
            sculpted=unit(cross(dx,dy))
            x,y,z=point
            blend=.67*(1-(abs(k-3)/3)**2)*(.44 if j in (0,len(rows)-1) else 1)
            underlying=unit((x*9.5,(y-.145)*3,1))
            ns.append(unit(vec(mul(underlying,1-blend),mul(sculpted,blend))))
        norms.append(ns)
    for j in range(len(rows)-1):
        for k in range(6):
            tint='c09980' if j==0 else ('c9a287' if k in (0,5) else 'd0a98c')
            for ids in (((j,k),(j,k+1),(j+1,k+1)),((j,k),(j+1,k+1),(j+1,k))):
                tri(*(rows[a][b] for a,b in ids),tint,'skin',normals=tuple(norms[a][b] for a,b in ids),front=(0,0,1))
    for s in (-1,1):
        ell((s*.109,.144,-.004),(.020,.032,.016),'ba957c','skin',10,6)
        # A thin curved almond is recessed between the upper and lower lids.
        def eye(u,offset,lift=.0018):
            x=s*(.044+u*.019);y=.162+.0011*u+offset
            return (x,y,face_z(x,y)+lift)
        samples=[j/6-1 for j in range(13)]
        upper=[eye(u,.0048*(1-u*u)) for u in samples]
        lower=[eye(u,-.0031*(1-u*u)) for u in samples]
        for j in range(12):
            quad(upper[j],upper[j+1],lower[j+1],lower[j],'bfb5a4','skin',(0,0,1))
        for rad,co,depth in ((.0052,'706047',.0026),(.0025,'393c35',.0031)):
            cx=s*.044
            pts=[]
            for j in range(14):
                a=j*TAU/14;x=cx+rad*COS(a);q=rad*SIN(a)
                yy=.162+max(-.00295,min(.00435,q))
                pts.append((x,yy,face_z(x,yy)+depth))
            center=(cx,.162,face_z(cx,.162)+depth)
            for j in range(14):tri(center,pts[j],pts[(j+1)%14],co,'skin',front=(0,0,1))
        # The lids follow the eye surface rather than separate spherical geometry.
        for j in range(12):
            u,v=samples[j],samples[j+1]
            a,b=upper[j],upper[j+1]
            c=eye(v,(.0048+.0041)*(1-v*v),.0009);d=eye(u,(.0048+.0041)*(1-u*u),.0009)
            quad(a,b,c,d,'bf987e','skin',(0,0,1))
            a,b=lower[j],lower[j+1]
            c=eye(v,-.0051*(1-v*v),.0011);d=eye(u,-.0051*(1-u*u),.0011)
            quad(a,b,c,d,'c29e84','skin',(0,0,1))
        tube(upper,[.00065+.00068*(1-u*u) for u in samples],'86725e','skin',6)
        brow=[]
        for j in range(7):
            u=j/3-1;x=s*(.044+u*.023)
            yy=.179+.0037*(1-u*u)+.0008*u
            brow.append((x,yy,face_z(x,yy)+.001))
        tube(brow,[.0012,.0022,.0027,.0028,.0024,.0017,.0006],'745e4b','fur',8)
        nostrilx=s*.014;yy=.1303
        ell((nostrilx,yy,face_z(nostrilx,yy)+.0047),(.0032,.0014,.0010),'977561','skin',7,3)
    lip=[]
    for j in range(9):
        x=(j-4)*.0057; yy=.107-.0016*abs(x)/.023+.0006*COS(x*230)
        lip.append((x,yy,face_z(x,yy)+.001))
    tube(lip,[.0006,.001,.0014,.0017,.0016,.0017,.0014,.001,.0006],'a47e69','skin',7)
    for i in range(8):
        x0=(i-4)*.0057;x1=(i-3)*.0057
        def beneath(x):
            yy=.1066-.0046*max(0,1-(x/.024)**2)
            return (x,yy,face_z(x,yy)+.00115)
        quad(lip[i],lip[i+1],beneath(x1),beneath(x0),'bc947d','skin',(0,0,1))


def contestant():
    begin('contestant')
    bone('torso','root',(0,.93,0))
    loft([(0,-.05,.0,.159,.118),(0,.09,0,.18,.123),(0,.28,-.012,.202,.134),(0,.43,0,.239,.136),(0,.50,.008,.183,.112),(0,.515,.008,.10,.085)],'9ab3aa','cloth',14)
    # Stitched short jacket, undershirt, shoulder yoke, diagonal leather baldric.
    loft([(0,.07,0,.195,.133),(0,.16,0,.194,.138),(0,.33,.003,.221,.146),(0,.43,.006,.245,.14),(0,.465,.004,.19,.124)],'6b918a','cloth',14)
    for s in (-1,1):
        ribbon([(s*.073,.452,.097),(s*.105,.347,.132),(s*.056,.26,.137),(s*.025,.081,.136)],[.041,.048,.027,.012],'a9b3a0','cloth',dx=(s,0,.1))
    ribbon([(-.168,.446,.087),(-.108,.362,.145),(.028,.237,.157),(.145,.109,.123),(.178,.071,.092)],[.032]*5,'98734f','wood',dx=(.68,.68,0))
    box((.032,.239,.159),(.054,.048,.013),'e8d4a1','metal',-.06)
    loft([(0,.045,0,.19,.138),(0,.098,0,.189,.138)],'6d5c46','wood',14,.2)
    box((0,.071,.142),(.067,.043,.014),'e1c99c','metal')
    for s in (-1,1):
        box((s*.165,.028,.038),(.09,.115,.097),'b59a78','wood',s*.18)
        box((s*.167,.064,.096),(.076,.034,.014),'c4b697','cloth',s*.18)
    loft([(0,.442,0,.181,.121),(0,.50,0,.141,.115),(0,.56,.01,.107,.096)],'a9ab85','cloth',12)
    ribbon([(.055,.51,.082),(.093,.427,.128),(.071,.363,.157),(.10,.322,.144)],[.041,.034,.031,.009],'bda77c')
    bone('head','torso',(0,.531,.006))
    loft([(0,-.012,0,.071,.070),(0,.074,.009,.077,.075)],'c7a185','skin',10)
    sculpt_face()
    loft([(0,.185,-.015,.117,.106),(-.006,.235,-.012,.115,.109),(-.014,.273,-.018,.086,.085),(-.022,.29,-.016,.039,.053)],'5c5544','wood',13,.3)
    for j in range(8):
        a=j*TAU/8
        p=(.093*COS(a),.198+.023*SIN(a),-.013+.09*SIN(a))
        ell(p,(.029,.043,.035),'685e48','wood',7,3)
    for s,suffix in ((1,'L'),(-1,'R')):
        bone('upperarm'+suffix,'torso',(s*.207,.412,.002))
        loft([(s*.033,-.257,.018,.057,.066),(s*.05,-.16,0,.073,.077),(s*.035,-.044,0,.083,.089),(s*.009,.029,-.007,.076,.073)],'98aea1','cloth',10)
        ell((s*.035,-.031,-.006),(.095,.085,.101),'668178','cloth')
        loft([(s*.050,-.215,.012,.067,.074),(s*.051,-.173,.007,.071,.076)],'b4ab8c','cloth',10)
        bone('forearm'+suffix,'upperarm'+suffix,(s*.038,-.245,.017))
        loft([(s*.005,-.208,.044,.043,.045),(s*.009,-.113,.024,.054,.059),(0,-.012,0,.059,.066)],'bd9980','skin',10)
        loft([(s*.005,-.216,.048,.047,.048),(s*.010,-.146,.031,.055,.058),(s*.008,-.11,.022,.055,.060)],'7e6953','skin',11)
        for j in range(3):
            loft([(s*.005,-.207+j*.036,.046-j*.008,.049+j*.001,.052+j*.002),(s*.006,-.200+j*.036,.044-j*.008,.049+j*.001,.052+j*.002)],'c6b890','cloth',9)
        glove(s*.004,-.196,.028,-s)
        if suffix=='R': bone('gripR','forearmR',(0,-.24,.075))
        bone('thigh'+suffix,'root',(s*.101,.945,-.008))
        loft([(s*.021,-.415,.013,.073,.084),(s*.027,-.27,0,.085,.095),(s*.016,-.119,-.003,.100,.110),(0,.019,-.004,.102,.112)],'63747a','cloth',11)
        ribbon([(s*.076,-.08,.048),(s*.092,-.20,.050),(s*.074,-.329,.044)],[.018,.016,.013],'788986','cloth')
        bone('shin'+suffix,'thigh'+suffix,(s*.021,-.405,.015))
        loft([(0,-.372,-.012,.055,.067),(s*.006,-.21,-.02,.069,.078),(0,-.064,-.012,.077,.084),(0,.017,-.006,.072,.088)],'70817d','cloth',11)
        ell((0,-.015,.059),(.064,.083,.039),'838578','wood',8,5)
        loft([(0,-.434,0,.068,.083),(0,-.314,-.011,.076,.08),(0,-.226,-.01,.075,.079)],'76694f','wood',9)
        for j in range(3):
            loft([(0,-.337+j*.041,-.011,.077,.081),(0,-.328+j*.041,-.011,.077,.081)],'b2a889','cloth',9)
        ell((0,-.447,.051),(.076,.084,.135),'796b54','wood',10,5)
        box((0,-.499,.054),(.143,.041,.252),'575243','wood')


def arms():
    begin('arms')
    for side,suffix in ((1,'L'),(-1,'R')):
        wrist=(side*(.28 if side==1 else .22),-.39 if side==1 else -.32,.29 if side==1 else .46)
        elbow=(side*.44,-.59,-.07)
        bone('forearm'+suffix,'root',elbow)
        w=sub(wrist,elbow); m=mul(w,.54)
        tube([(0,0,0),m,mul(w,.77),w],[.099,.079,.060,.047],'ad8c73','skin',10)
        tube([(0,0,0),m],[.109,.084],'849d8c','cloth',10)
        tube([mul(w,.60),mul(w,.76),mul(w,.97)],[.078,.068,.052],'755b47','skin',16)
        for f in (.635,.862):
            radius=.077-(f-.60)*.067
            tube([mul(w,f),mul(w,f+.043)],[radius+.002,radius-.001],'5e5243','skin',15)
            for h in (f+.004,f+.036):
                tube([mul(w,h),mul(w,h+.004)],[radius+.0022,radius+.0022],'bb9c70','cloth',14)
        length=unit(w); across=unit(cross(length,(0,1,0))); up=unit(cross(across,length))
        for j in range(8):
            f=.66+j*.039; radius=.077-(f-.60)*.067
            a=vec(mul(w,f),vec(mul(up,radius*.92),mul(across,radius*.40*side)))
            b=vec(a,vec(mul(length,.007),mul(across,side*.002)))
            rod(a,b,.0016,.0015,'bcab89','cloth',5)
        bone('hand'+suffix,'forearm'+suffix,w)
        # The fist is continuous from cuff to metacarpal ridge; finger pads
        # curve under the palm and overlap the thumb in the at-rest grip.
        rows=[(-.028,-.001,.043,.031),(-.003,.001,.048,.034),(.025,.008,.052,.039),(.053,.012,.057,.041),(.077,.014,.058,.037),(.094,.013,.052,.031),(.106,.007,.038,.023)]
        coat(rows,'88694e','skin')
        for j in range(3):
            x=side*(j-1)*.025
            pts=[(x*.72,.032,-.005),(x*.87,.044,.022),(x,.049,.054),(x*1.07,.045,.079)]
            tube(pts,[.0015,.002,.002,.0015],'7f674f','skin',6)
            for k in range(4):
                zz=.018+k*.014
                y=.045+.003*SIN(k*.95)-abs(x)*.12
                rod((x-.0014,y,zz),(x+.0006,y+.0006,zz+.005),.0011,.0011,'c0aa89','cloth',5)
        for j in range(4):
            x=side*(j-1.5)*.025;drop=(j/3)**2*.012; far=.114-drop
            knuckle=(x,.040-drop*.47,.087-drop)
            ell(knuckle,(.017,.017,.023),'97795d','skin',12,7)
            leather=[(x,.039-drop*.40,.077-drop),knuckle,(x,.032-drop*.50,.103-drop)]
            tube(leather,[.018,.019,.017],'a28363','skin',11)
            # Exposed proximal joint, middle phalanx and tip form a closed curl.
            pts=[(x,.033-drop*.40,.099-drop),(x,.026-drop*.50,far),(x,.009-drop*.4,far+.005),(x,-.008,far+.002),(x,-.019,far-.010),(x,-.021,far-.026),(x,-.014,far-.043)]
            tube(pts,[.016,.016,.015,.014,.013,.012,.008],'c39e82','skin',11)
            ell(pts[-1],(.009,.008,.010),'c29b7e','skin',8,5)
        base=(-side*.044,.007,.031)
        tube([base,(-side*.058,.016,.052),(-side*.061,.017,.072)],[.026,.025,.022],'98785b','skin',12)
        thumb=[(-side*.059,.016,.065),(-side*.063,.010,.082),(-side*.056,.001,.099),(-side*.038,-.004,.106),(-side*.021,-.002,.101)]
        tube(thumb,[.021,.023,.020,.017,.011],'c49f84','skin',12)
        ell(thumb[-1],(.012,.011,.013),'c49f84','skin',10,5)


def coat(rows,tint,material):
    # Cross sections along the spine keep the shoulder, flank and rump continuous.
    n=18;rings=[]
    for z,cy,rx,ry in rows:
        rings.append([(rx*COS(i*TAU/n),cy+ry*SIN(i*TAU/n),z) for i in range(n)])
    hoopmesh(rings,[(0,cy,z) for z,cy,rx,ry in rows],tint,material,smooth=.94,variation=.024)


def hare():
    begin('hare')
    bone('torso','root',(0,.26,0))
    coat([(-.268,.024,.033,.037),(-.231,.039,.102,.129),(-.144,.055,.163,.179),(-.049,.042,.159,.167),(.028,.025,.139,.144),(.105,.023,.124,.129),(.17,.044,.105,.106),(.201,.058,.066,.068)],'ae9c84','fur')
    for s in (-1,1):
        ribbon([(s*.092,-.055,.159),(s*.127,-.088,.054),(s*.141,-.078,-.065),(s*.128,-.079,-.162)],[.015,.021,.020,.01],'d1c5aa','fur',dx=(s*.065,.9,0),front=(s,-.4,0))
        for j in range(11):
            z=-.197+j*.025;y=.113+.026*SIN(j*1.9);x=s*(.139-.22*abs(z+.09))
            ribbon([(x,y,z),(x+s*.005,y-.008,z-.024),(x+s*.006,y-.017,z-.036)],[.004,.006,.001],'94846e','fur',dx=(0,1,0),front=(s,.33,0))
    ell((0,.049,-.273),(.057,.061,.060),'ded9c6','fur',8)
    bone('head','torso',(0,.103,.176))
    ell((0,.055,.029),(.106,.105,.111),'b2a082','fur')
    for s in (-1,1):
        ell((s*.027,.033,.105),(.047,.042,.056),'d7c9ae','fur',10)
    ell((0,.047,.16),(.020,.013,.014),'997b70','skin',9,4)
    for s in (-1,1):
        for j in range(3):
            origin=(s*.041,.033+j*.004,.137-j*.004)
            rod(origin,(s*(.117+.012*j),.037+j*.012,.168-j*.008),.0014,.0004,'ccc3aa','fur',4)
    for s,suffix in ((1,'L'),(-1,'R')):
        select('head')
        ell((s*.086,.082,.076),(.015,.025,.025),'d2c4a6','fur',10,4)
        ell((s*.096,.083,.081),(.010,.018,.015),'7b6c48','skin',9,4)
        ell((s*.102,.083,.082),(.008,.015,.013),'35352f','skin',9,4)
        ell((s*.110,.089,.086),(.003,.004,.004),'fff7e4','skin',6,3)
        bone('ear'+suffix,'head',(s*.046,.126,.002))
        loft([(0,0,0,.027,.018),(s*.018,.103,-.033,.037,.020),(s*.038,.215,-.070,.026,.014),(s*.043,.259,-.084,.004,.004)],'a49b81','fur',8)
        ribbon([(0,.025,.012),(s*.019,.102,-.013),(s*.038,.206,-.053),(s*.043,.237,-.071)],[.01,.022,.014,.002],'d4afa1')
        loft([(s*.036,.204,-.067,.027,.014),(s*.041,.238,-.078,.017,.011),(s*.044,.263,-.086,.001,.001)],'625f54','fur',10,.94)
    for front in (True,False):
        for s,suffix in ((1,'L'),(-1,'R')):
            bone(('front' if front else 'rear')+suffix,'torso',(s*(.079 if front else .102),-.035,.11 if front else -.123))
            if front:
                tube([(0,.011,0),(0,-.111,-.012),(0,-.180,.011)],[.04,.031,.024],'b0a28b','fur',8)
                ell((0,-.185,.040),(.033,.024,.071),'c4b498','fur',8,4)
            else:
                ell((s*.012,.001,-.005),(.083,.120,.095),'aa9980','fur',12)
                rod((0,-.061,-.045),(0,-.169,-.084),.049,.035,'b4a58b','fur',7)
                bone('hareFoot'+suffix,'rear'+suffix,(0,-.168,-.084))
                ell((0,-.014,.066),(.044,.029,.112),'c5b69e','fur',11,5)
                for j in range(3):
                    ell(((j-1)*.022,-.018,.143),(.014,.017,.034),'cdbda5','fur',7,4)


def hen():
    begin('hen'); bone('torso','root',(0,.35,0))
    coat([(-.294,.064,.04,.04),(-.22,.079,.106,.096),(-.12,.066,.157,.151),(-.021,.062,.169,.172),(.089,.060,.159,.167),(.162,.073,.124,.147),(.222,.103,.093,.102),(.244,.121,.049,.066)],'9b8159','feather')
    for s in (-1,1):
        pivot=(s*.128,.118,.011)
        bone('wing'+('L' if s==1 else 'R'),'torso',pivot)
        ell((s*.136,.075,-.012),(.065,.140,.220),'857752','feather',9,5)
        for j in range(5):
            ribbon([(s*.17,.077+.012*j,.104-.024*j),(s*.19,.048+.016*j,-.023-.018*j),(s*.15,.014+.02*j,-.141-.017*j)],[.007,.012,.003],'b4ab83',dx=(0,1,0),front=(s,0,0))
        for row in range(2):
            for j in range(6):
                yy=.028+.029*j+.016*row; zz=.064-.035*j-.09*row
                lead=(s*(.194-.004*abs(2-j)),yy,zz)
                broad=vec(lead,(s*.009,-.010,-.059))
                end=vec(lead,(-s*.023,-.019,-.114+.008*row))
                ribbon([lead,broad,end],[.009,.015,.001],['a89975','83785a','a6956b'][(j+row)%3],'feather',dx=(0,1,0),front=(s,0,0))
                rod(vec(lead,(s*.002,0,0)),vec(broad,(s*.002,0,-.012)),.0019,.0009,'c8b99a','feather',4)
        shift_geometry(mul(pivot,-1))
    bone('tailFan','torso',(0,.097,-.172))
    for k in range(6):
        x=(k-2.5)*.026
        ribbon([(x,.097,-.172),(x*1.3,.164,-.30),(x*1.40,.225+.020*COS(k),-.437+.018*abs(k-2.5))],[.026,.033,.008],['726e50','989270'][k%2],front=(0,1,0))
    shift_geometry((0,-.097,.172))
    bone('head','torso',(0,.139,.153))
    ell((0,.085,.042),(.078,.126,.085),'9c8664','feather',10,5)
    ell((0,.159,.056),(.084,.078,.093),'aa946e','feather',10,5)
    for i in range(3):
        ell((0,.221+.011*SIN(i),.021+i*.030),(.017,.033-i*.003,.023),'ad7859','skin',8,4)
    ell((0,.108,.132),(.024,.029,.021),'b98267','skin',8,4)
    tube([(0,.143,.112),(0,.124,.217)],[.036,.003],'d6a65a','feather',6)
    for s in (-1,1):
        ribbon([(s*.062,.184,.108),(s*.083,.189,.062),(s*.076,.179,.027)],[.005,.010,.004],'e0c39a','feather',dx=(0,1,0),front=(s,0,0))
        ell((s*.072,.172,.083),(.012,.012,.011),'333831','feather',7,3)
        ell((s*.082,.176,.085),(.003,.003,.003),'f6e6be','skin',6,3)
    for s,suffix in ((1,'L'),(-1,'R')):
        bone('rear'+suffix,'torso',(s*.064,-.090,-.004))
        tube([(0,0,0),(0,-.129,-.037),(0,-.241,.019)],[.023,.015,.014],'c1a76e','feather',6)
        for dx in (-.033,0,.033):
            rod((0,-.24,.019),(dx,-.252,.092-abs(dx)*.37),.011,.003,'c6ad79','feather',5)


def grazer():
    begin('grazer'); bone('torso','root',(0,1.03,0))
    coat([(-.600,.132,.047,.048),(-.536,.142,.186,.207),(-.418,.156,.254,.281),(-.300,.155,.263,.278),(-.178,.157,.238,.244),(-.057,.149,.241,.255),(.075,.121,.272,.301),(.205,.127,.270,.326),(.332,.157,.221,.302),(.425,.179,.166,.226),(.473,.204,.078,.119)],'ad9475','fur')
    for s in (-1,1):
        ribbon([(s*.165,-.064,-.436),(s*.224,-.044,-.298),(s*.204,-.022,-.171),(s*.206,-.041,-.024),(s*.228,-.069,.136),(s*.210,-.076,.272)],[.020,.026,.030,.027,.036,.020],'d2bea0','fur',dx=(0,1,.04),front=(s,-.25,0))
        for j in range(5):
            x=s*(.208+.004*j);z=.244-.014*j
            ribbon([(x,.327-j*.021,z),(x+s*.025,.214-j*.023,z-.074),(x+s*.032,.181-j*.020,z-.090)],[.005,.008,.001],'9a8265','fur',dx=(0,1,0),front=(s,.2,0))
    tube([(0,.099,-.529),(0,-.016,-.653),(0,-.144,-.686)],[.068,.046,.024],'8c7f66','fur',8)
    tube([(0,.183,.346),(0,.44,.460),(0,.608,.505)],[.213,.159,.115],'a08b6e','fur',10)
    for j in range(5):
        q=j*.045
        ribbon([(-.014,.235+q,.508+q*.34),(.010,.175+q,.516+q*.4),(.012,.166+q,.504+q*.37)],[.045,.034,.004],'bfad8f','fur',front=(0,0,1))
    bone('head','torso',(0,.574,.503))
    ell((0,.091,.052),(.124,.152,.164),'a69476','fur',10,6)
    ell((0,.056,.185),(.085,.078,.139),'b4a187','fur',10)
    ell((0,.059,.294),(.072,.053,.049),'605c50','fur',10,4)
    for s in (-1,1):
        select('head')
        ribbon([(s*.107,.168,.046),(s*.116,.151,.12),(s*.081,.115,.184),(s*.067,.10,.232)],[.010,.016,.013,.006],'726654','fur',dx=(0,1,0),front=(s,.15,0))
        ribbon([(s*.098,.179,.036),(s*.116,.169,.108),(s*.093,.143,.164)],[.008,.013,.005],'d3bd9a','fur',dx=(0,1,0),front=(s,.2,0))
        ell((s*.108,.141,.118),(.025,.022,.023),'353a32','fur',8,4)
        ell((s*.132,.147,.127),(.003,.005,.006),'e5d7bb','skin',6,3)
        ell((s*.036,.069,.333),(.014,.008,.005),'45473c','skin',7,3)
        path=[(s*.062,.205,.006),(s*.082,.319,-.022),(s*.110,.464,-.119),(s*.128,.543,-.224)]
        tube(path,[.056,.047,.027,.005],'a99c77','wood',8)
        rod((s*.095,.378,-.055),(s*.135,.464,.014),.028,.006,'ac9e7f','wood',7)
        for j in range(3):
            a=vec(path[0],(s*.007*j,.033*j,-.007*j))
            rod(a,vec(a,(s*.002,.013,-.003)),.057-.002*j,.056-.002*j,'c5b996','fur',8)
        bone('grazerEar'+('L' if s==1 else 'R'),'head',(s*.080,.174,.003))
        tube([(0,0,0),(s*.081,.078,-.016),(s*.153,.117,-.048),(s*.183,.124,-.054)],[.032,.047,.021,.004],'b8a185','fur',9)
        ribbon([(s*.01,.015,.017),(s*.081,.087,.010),(s*.149,.114,-.025)],[.012,.023,.008],'bda28c','skin',dx=(0,1,0),front=(0,0,1))
    for front in (True,False):
        for s,suffix in ((1,'L'),(-1,'R')):
            bone(('front' if front else 'rear')+suffix,'torso',(s*.169,-.045,.343 if front else -.347))
            z=1 if front else -1
            joint=(s*.014,-.47,-.032 if front else -.124)
            shoulder=(0,.056,.011 if front else .022)
            tube([shoulder,(s*.023,-.145,.025),(s*.011,-.284,-.035*z),joint],[.102 if front else .132,.085 if front else .114,.064,.045],'ab967d','fur',11)
            ell(joint,(.049,.059,.054),'a39177','fur',9,4)
            bone(('kneeFront' if front else 'hockRear')+suffix,('front' if front else 'rear')+suffix,joint)
            shin=(.002,-.284,.055 if front else .077);ankle=(s*.003,-.439,.060 if front else .150)
            tube([(0,0,0),shin,ankle],[.044,.027,.031],'a28c73','fur',9)
            rod(shin,ankle,.031,.034,'736d5e','fur',9)
            hoof=vec(ankle,(0,-.039,.009))
            for toe in (-1,1):
                ell(vec(hoof,(toe*.017,0,.005)),(.025,.036,.059),'635f52','bark',8,4)


def create():
    contestant(); arms(); hare(); hen(); grazer()
