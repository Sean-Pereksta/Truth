"""Articulated wildlife for the lowland, gorge and alpine arenas."""
from meshforge import *
from figures import coat


# Each profile defines a rump, loin, ribcage, withers and shoulder in metres.
# The neck and head have their own origins; all four legs articulate at two joints.
profiles = {
    # chest height, flank width, torso half length, body depth, neck lift,
    # skull width, muzzle length, coat, belly, extremities
    'boar': (.64,.315,.69,.36,.10,.201,.29,'70543e','a08a66','413f37'),
    'cougar': (.67,.237,.72,.247,.10,.169,.117,'c39158','e4c79d','635347'),
    'wolf': (.72,.225,.64,.276,.18,.159,.227,'989589','cec6ac','575954'),
    'bighorn': (.95,.25,.59,.28,.22,.15,.24,'a89679','e2cfab','585444'),
    'caribou': (1.20,.267,.72,.32,.36,.15,.30,'918876','ded7bd','504a44'),
    'jackrabbit': (.32,.132,.31,.138,.12,.083,.118,'a48968','ddcba8','695947'),
    'marmot': (.28,.165,.34,.18,.08,.108,.092,'88775e','bca27c','565048'),
}


def eyes(w,z,y,coat_color):
    for sign in (-1,1):
        x=sign*w*.82
        ell((x,y,z),(w*.21,w*.17,w*.21),'473f34','fur',9,4)
        ell((sign*w*.962,y+w*.022,z+w*.025),(w*.072,w*.115,w*.115),'b09b72','skin',9,4)
        ell((sign*w*1.02,y+w*.029,z+w*.042),(w*.035,w*.088,w*.065),'272a26','skin',8,4)
        ell((sign*w*1.045,y+w*.066,z+w*.056),(w*.015,w*.026,w*.03),'ebe4cf','skin',6,3)
        ribbon([(sign*w*.72,y+w*.21,z+w*.25),(sign*w*.92,y+w*.24,z),(sign*w*.84,y+w*.16,z-w*.30)],
               [w*.022,w*.077,w*.01],coat_color,'fur',dx=(0,1,0),front=(sign,0,0))


def antlers(model,s,w):
    if model=='bighorn':
        pts=[];radii=[]
        for j in range(22):
            a=math.pi*.31+j*.275
            r=.24-.003*j
            pts.append((s*(w*.70+.0056*j),.16+r*SIN(a),-.055+r*COS(a)))
            radii.append(.082*(1-j/24)**.82)
        tube(pts,radii,'ab9470','wood',11)
        for j in range(1,20,2):
            rod(pts[j],vec(pts[j],mul(sub(pts[j+1],pts[j]),.22)),radii[j]*1.09,radii[j]*1.05,'d4bd91','wood',11)
    elif model=='caribou':
        path=[(s*.09,.20,-.024),(s*.14,.342,-.064),(s*.223,.46,-.194),
              (s*.30,.65,-.296),(s*.344,.78,-.204),(s*.355,.90,-.078)]
        tube(path,[.052,.047,.045,.038,.027,.006],'b4a489','wood',9)
        for k in range(3):
            base=path[2+k];tip=vec(base,(s*(.06+.02*k),.18+.025*k,.12-.047*k))
            tube([base,vec(base,(s*.03,.1,.027)),tip],[.035,.020,.002],'cfbea0','wood',8)
        # Forward-facing brow palm and two fine tines.
        tube([path[1],(s*.15,.364,.10),(s*.176,.405,.213)],[.039,.045,.019],'c1af92','wood',8)
        for j in range(3):
            rod((s*.17,.39,.17),(s*(.133+.033*j),.463+.015*j,.216+.023*j),.020,.003,'c7b698','wood',7)


def legs(model,h,w,L,d,fur,shade,feet):
    hoof=model in ('boar','bighorn','caribou')
    small=model in ('jackrabbit','marmot')
    for front in (True,False):
        for s,side in ((1,'L'),(-1,'R')):
            upper=('front' if front else 'rear')+side
            pivot=(s*w*.62,-d*.18,(.66 if front else -.62)*L)
            bone(upper,'torso',pivot)
            height=h+pivot[1]
            ankle=(0,-height*.55,-height*(.10 if front else .19))
            thick=w*(.41 if front else .53)*(1.16 if model=='jackrabbit' and not front else 1)
            if model in ('cougar','wolf'):thick*=1.24
            tube([(0,.02,0),(0,-height*.21,.024),ankle],
                 [thick,thick*.87,thick*.45],fur,'fur',10)
            bone(('kneeFront' if front else 'hockRear')+side,upper,ankle)
            end=(0,-height*.43+.012,height*(.09 if front else .15))
            tube([(0,0,0),(0,-height*.22,-.013),end],[thick*.49,thick*.32,thick*.35],shade,'fur',9)
            if hoof:
                for toe in (-1,1):
                    ell((toe*thick*.19,end[1],end[2]+thick*.13),(thick*.23,height*.042,thick*.55),feet,'bark',9,4)
            else:
                foot_length=thick*(1.7 if small and not front else 1.05)
                if model=='jackrabbit' and not front:foot_length*=1.5
                ell((0,end[1],end[2]+foot_length*.40),(thick*.68,thick*.43,foot_length),shade,'fur',10,5)
                for toe in (-1,0,1):
                    ell((toe*thick*.25,end[1]-.004,end[2]+foot_length*1.15),
                        (thick*.20,thick*.19,thick*.36),feet,'fur',7,4)


def quadruped(model):
    h,w,L,d,lift,skull,muzzle,fur,buff,feet=profiles[model]
    begin(model);bone('torso','root',(0,h,0))
    neck_z=.69*L
    shoulder=.35 if model=='boar' else .13 if model in ('cougar','marmot') else .20
    rows=[(-1.02,.08,.12,.26),(-.92,.12,.68,.75),(-.73,.13,.94,1),
          (-.49,.14,.96,.96),(-.22,.15,.83,.79),(.02,.09,.91,.90),
          (.29,.07,1,.99),(.51,shoulder,1,1.09),(.73,shoulder+.03,.83,.90),(.88,.20,.48,.70),(.95,.20,.19,.34)]
    coat([(z*L,y*d,width*w,depth*d) for z,y,width,depth in rows],fur,'fur')
    # Follow the body surface so the dorsal mantle follows the underlying anatomy.
    if model in ('wolf','boar','caribou'):
        mantle={'wolf':'686d68','boar':'514a3d','caribou':'766f60'}[model]
        for s in (-1,1):
            for k in range(3):
                fractions=(.19+k*.17,.38+k*.17,.31+k*.17)
                sweep=[]
                for j,row in enumerate(rows[1:-1]):
                    z,cy,rx,ry=row
                    f=fractions[0] if j<2 else fractions[2] if j>5 else fractions[1]
                    sweep.append((s*w*rx*f,(cy+ry*math.sqrt(1-f*f))*d+.003,z*L))
                ribbon(sweep,[.003,.021,.026,.031,.032,.026,.021,.014,.002],mantle,'fur',
                       dx=(s,-.43,0),front=(s,.9,0))
    # Long lighter ventral guard hairs follow both flanks without floating.
    for s in (-1,1):
        points=[(s*w*.70,-d*.45,-.75*L),(s*w*.79,-d*.42,-.50*L),(s*w*.66,-d*.34,-.22*L),
                (s*w*.72,-d*.46,.02*L),(s*w*.80,-d*.50,.30*L),(s*w*.84,-d*.44,.50*L)]
        ribbon(points,[d*.04,d*.09,d*.105,d*.09,d*.12,d*.045],buff,'fur',dx=(0,1,0),front=(s,-.2,0))
    neck=(0,d*.39+lift,neck_z+.10*L)
    tube([(0,d*.18,.58*L),(0,d*.36+lift*.45,.76*L),neck],
         [w*.82,w*.72,skull*.80],fur,'fur',13)
    if model in ('wolf','caribou','boar'):
        for s in (-1,1):
            tint=buff if model!='boar' else '80684d'
            for j in range(6):
                z=neck_z+(.11-j*.033)*L
                ribbon([(s*w*(.39+.055*j),d*.48+lift*.70-j*.011,z),
                        (s*w*(.53+.05*j),d*.14+lift*.44-j*.015,z-.014),
                        (s*w*(.47+.05*j),-d*.12+lift*.34-j*.015,z-.024)],
                       [.024,.038,.002],tint,'fur',dx=(0,0,1),front=(s,0,0))
    if model=='boar':
        for j in range(27):
            z=(-.68+j*.05)*L; y=d*(.97+.24*math.sin((j/26)*math.pi))
            x=(-1 if j%2 else 1)*w*(.04+.10*SIN(j*1.7))
            rod((x,y-.038,z),(x*.68,y+.067,z-.043),.020,.001,'564b3e','fur',5)
    bone('head','torso',neck)
    ell((0,.5*skull,.21*skull),(skull,skull*.97,skull*1.22),fur,'fur',14,8)
    snout_y=skull*(.11 if model=='boar' else .25)
    snout_z=skull*.72+muzzle
    tube([(0,skull*.48,skull*.60),(0,snout_y+.016,skull*.78+muzzle*.43),(0,snout_y,snout_z)],
         [skull*.72,skull*(.55 if model=='boar' else .49),skull*(.45 if model=='boar' else .36)],fur,'fur',12)
    nose_color='967465' if model=='boar' else '4b4740'
    ell((0,snout_y+.012,snout_z+.015),(skull*.51,skull*(.35 if model=='boar' else .23),skull*.20),nose_color,'skin',10,5)
    eyes(skull,skull*.55,skull*.81,buff)
    for s in (-1,1):
        select('head')
        if model=='boar':
            ell((s*skull*.21,snout_y+.015,snout_z+.047),(skull*.10,skull*.09,skull*.034),'413731','skin',7,4)
            tube([(s*skull*.61,-skull*.08,snout_z-.073),(s*skull*.84,-skull*.09,snout_z-.043),
                  (s*skull*.97,skull*.14,snout_z-.036),(s*skull*.87,skull*.35,snout_z-.052)],
                 [.024,.024,.015,.002],'e7d2aa','wood',9)
        if model=='cougar':
            ell((s*skull*.31,snout_y-.012,snout_z-.018),(skull*.38,skull*.26,skull*.37),buff,'fur',9,5)
            for j in range(3):
                ell((s*skull*.61,snout_y-.014+.006*j,snout_z-.005-j*.014),(.004,.004,.005),'625242','fur',6,3)
        antlers(model,s,skull)
        bone('ear'+('L' if s>0 else 'R'),'head',(s*skull*.59,skull*1.12,-skull*.24))
        ear_h={'jackrabbit':.31,'boar':.135,'wolf':.162,'cougar':.096,'bighorn':.114,
               'caribou':.143,'marmot':.053}[model]
        spread=.76 if model in ('bighorn','caribou') else .39
        ear=(s*ear_h*spread,ear_h,-ear_h*.20)
        tube([(0,0,0),(s*ear_h*spread*.47,ear_h*.45,-ear_h*.08),ear],
             [skull*.29,skull*(.47 if model=='jackrabbit' else .37),skull*(.17 if model in ('marmot','cougar') else .035)],fur,'fur',10)
        ribbon([(0,0,skull*.23),(s*ear_h*spread*.50,ear_h*.51,skull*.27-ear_h*.08),
                (ear[0]*.94,ear_h*.88,ear[2]+skull*.14)],[skull*.09,skull*.19,skull*.035],
               'ac8d7b' if model!='wolf' else 'aca598','skin',dx=(1,0,0),front=(0,0,1))
        if model=='jackrabbit':
            tube([(s*ear_h*.33,ear_h*.84,-ear_h*.18),ear],[skull*.27,skull*.05],'45473e','fur',9)
    bone('jaw','head',(0,snout_y-skull*.33,skull*.51))
    ell((0,0,muzzle*.49),(skull*.50,skull*.23,muzzle*.67),buff,'fur',10,5)
    if model in ('cougar','wolf','boar'):
        for s in (-1,1):rod((s*skull*.39,skull*.10,muzzle*.83),(s*skull*.39,skull*.29,muzzle*.86),.012,.002,'e1d8bf','wood',7)
    if model in ('marmot','jackrabbit'):
        for s in (-1,1):rod((s*.009,-.005,muzzle*1.07),(s*.009,-.025,muzzle*1.06),.008,.007,'d8c29a','wood',6)
    bone('wildTail','torso',(0,d*.27,-.88*L))
    if model in ('cougar','wolf','marmot'):
        length={'cougar':.95,'wolf':.62,'marmot':.31}[model]
        pts=[(0,0,0),(.025,-length*.14,-length*.17),(.037,-length*.32,-length*.44),
             (.064,-length*.35,-length*.73),(.095,-length*.22,-length*.94),(.155,-length*.10,-length*1.03)]
        tail_w=w*({'cougar':.29,'wolf':.56,'marmot':.39}[model])
        if model=='wolf':tail_w*=1.27
        radii=[tail_w*.78,tail_w,tail_w*1.07,tail_w*.91,tail_w*.64,tail_w*.10]
        tube(pts,radii,fur,'fur',11);tube(pts[-3:],radii[-3:],feet,'fur',11)
    elif model=='boar':
        tube([(0,0,0),(0,-.14,-.10),(.027,-.30,-.09),(.042,-.36,-.106)],[.024,.021,.015,.008],feet,'fur',7)
    else:ell((0,-.008,-.052),(w*.28,w*.34,w*.42),buff,'fur',10,6)
    legs(model,h,w,L,d,fur,fur,feet)


def ground_bird(model):
    winter=model=='ptarmigan'
    feather='e1e2d2' if winter else '9c9280'
    wing='caccbd' if winter else '796f59'; light='f0efe0' if winter else 'd8c6a0'
    dark='636764' if winter else '45473f'
    size=1.0 if winter else .82
    begin(model);bone('torso','root',(0,.265*size,0))
    coat([(-.255,.068,.025,.026),(-.18,.052,.129,.11),(-.07,.035,.158,.138),
          (.06,.036,.161,.144),(.148,.064,.122,.128),(.192,.112,.063,.066)],feather,'feather')
    for s,side in ((1,'L'),(-1,'R')):
        bone('wing'+side,'torso',(s*.098,.065,.109))
        ell((s*.034,-.004,-.13),(.065,.091,.188),wing,'feather',12,6)
        for row in range(3):
            for j in range(6):
                y=.045-row*.035;z=-.05-j*.026
                ribbon([(s*.081,y,z),(s*.095,y-.009,z-.057),(s*.079,y-.029,z-.112)],
                       [.012,.021,.002],(light if (row+j)%4 else dark),'feather',dx=(0,1,0),front=(s,0,0))
        bone('rear'+side,'torso',(s*.068,-.077,.004))
        leg=.265*size-.085
        tube([(0,0,0),(0,-leg*.55,-.031),(0,-leg,.013)],[.035,.020,.013],
             light if winter else 'a89674','feather',8)
        if winter:ell((0,-leg+.007,.033),(.027,.022,.056),light,'feather',8,4)
        for j in (-1,0,1):rod((0,-leg,.014),(j*.035,-leg-.008,.085-.013*abs(j)),.009,.002,'8f846d','feather',5)
    bone('tailFan','torso',(0,.06,-.20))
    for j in range(7):
        x=(j-3)*.025
        ribbon([(x*.4,0,0),(x*.84,.047,-.094),(x,.089,-.169+.009*abs(j-3))],
               [.018,.030,.013],dark if winter or j%3==0 else wing,'feather',front=(0,1,0))
    bone('head','torso',(0,.143,.141))
    ell((0,.034,.025),(.087,.10,.096),feather,'feather',12,6)
    ell((0,.054,.105),(.065,.070,.045),light if winter else dark,'feather',10,5)
    tube([(0,.053,.112),(0,.052,.15),(0,.029,.198)],[.034,.027,.002],dark,'feather',8)
    for s in (-1,1):
        ell((s*.077,.062,.076),(.013,.014,.013),'303432','skin',8,4)
        ell((s*.087,.067,.078),(.004,.004,.004),'efe9ce','skin',6,3)
        ribbon([(s*.059,.079,.107),(s*.079,.091,.068),(s*.079,.091,.029)],
               [.004,.009,.005],'b45b45' if winter else light,'feather',dx=(0,1,0),front=(s,0,0))
        if not winter:
            ribbon([(s*.025,.009,.135),(s*.068,.012,.106),(s*.076,.037,.073)],
                   [.006,.008,.004],light,'feather',dx=(0,1,0),front=(s,0,.35))
    if not winter:
        tube([(0,.118,.024),(0,.176,.014),(0,.196,.042),(0,.175,.084),(0,.159,.089)],
             [.008,.009,.018,.022,.010],'353a34','feather',8)


def create():
    for name in profiles:quadruped(name)
    ground_bird('quail');ground_bird('ptarmigan')
