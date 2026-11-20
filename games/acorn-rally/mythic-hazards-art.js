(function(root){
  'use strict';
  const tau=Math.PI*2;
  const colorways=[
    ['#a39aff','#67e7f4','#fff3ba'], ['#ff72ae','#94ffe1','#ffdf74'],
    ['#fb4867','#ff9a68','#ffe2ab'], ['#efb45a','#79e1d2','#fff3c4']
  ];
  const names=['Leviathan','Hart','Moth','Orchid','Hound','Talon','Heel','Eagle'];

  function meshes(Mesh,simple,courseIndex){
    const result={},make=name=>result[name]=new Mesh(),n=simple?6:10;
    const tube=(m,a,b,r,t,color,mat=0)=>m.ring(a,b,r,t,color,simple?4:7,mat);
    const oval=(m,x,y,z,rx,ry,rz,color,mat=0)=>m.blob(x,y,z,rx,ry,rz,color,n,mat);
    // Sections run from tail to nose. Separate dorsal, flank and ventral faces
    // give the animals painted markings in both renderers without image loads.
    function hull(m,rows,palette){
      const point=(row,i)=>[Math.cos(i*tau/n)*row[2],row[1]+Math.sin(i*tau/n)*row[3],row[0]];
      for(let k=1;k<rows.length;k++)for(let i=0;i<n;i++){
        const height=Math.sin((i+.5)*tau/n),c=palette[height>.45?0:height<-.38?2:1];
        m.quad(point(rows[k-1],i),point(rows[k],i),point(rows[k],i+1),point(rows[k-1],i+1),c);
      }
    }
    // A folded membrane or feather. Both sides have a distinct center ridge.
    function vane(m,rim,ridge,colors){
      for(let i=0;i<rim.length;i++){
        m.tri(rim[i],rim[(i+1)%rim.length],ridge,colors[i%colors.length]);
      }
    }
    const between=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
    // Raised lozenges use four triangles for a reflective shaft and two different vanes.
    function feather(m,start,tip,width,side,light,shade){
      const mid=between(start,tip,.48),dx=tip[0]-start[0],dz=tip[2]-start[2],n=Math.hypot(dx,dz)||1;
      const rim=(sign)=>[mid[0]+sign*width*dz/n,mid[1],mid[2]-sign*width*dx/n];
      const ridge=[mid[0],mid[1]+width*.36,mid[2]];
      vane(m,[start,rim(side),tip,rim(-side)],ridge,[light,light,shade,shade]);
    }
    function ringMark(realm){
      const m=make('mythMark'+realm),colors=colorways[realm],sides=simple?20:32;
      const v=(angle,r,y=0)=>[r*Math.cos(angle),y,r*Math.sin(angle)];
      for(let i=0;i<sides;i++){
        const a=tau*i/sides,b=tau*(i+1)/sides;
        m.quad(v(a,1),v(b,1),v(b,.94),v(a,.94),colors[0],5,[0,1,0]);
        if(i%4<2)m.quad(v(a,.91),v(b,.91),v(b,.86),v(a,.86),colors[2],5,[0,1,0]);
        if(i%4===0)m.tri(v(a-.085,.82),v(a+.085,.82),v(a,realm===2?.43:.62),colors[1],5,[0,1,0]);
      }
    }
    function leviathan(){
      const m=make('mythLeviathan'),tail=make('mythFlukes');
      hull(m,[[-.85,.88,.046,.062],[-.62,.90,.23,.25],[-.37,.88,.41,.49],[-.11,.84,.61,.65],[.34,.82,.69,.71],
        [.60,.80,.62,.64],[.78,.76,.49,.47],[.90,.76,.32,.31],[.96,.74,.075,.11]],['#54549a','#344d80','#e3d5c7']);
      for(const side of [-1,1]){
        const fin=make('mythLeviathanFin'+side);
        const rim=[[side*.45,.74,.36],[side*.78,.65,.24],[side*1.08,.36,-.37],[side*.87,.37,-.38],[side*.53,.57,-.16]];
        const hub=[side*.73,.59,-.03];
        vane(fin,rim,hub,['#99bbd5','#8071bb','#ad85c6','#526c9c']);
        [[.72,.63,.18],[.89,.51,.01],[1.03,.4,-.23]].forEach(([x,y,z],i)=>{
          feather(fin,[side*.58,.68,.28-i*.09],[side*x,y+.025,z],.035,side,'#e1c6b3','#a8a6cc');
        });
        // Broad ivory throat pleats sweep from the nose toward the pectoral joint.
        const lip=[[.10,.69,.976],[.32,.69,.914],[.50,.69,.785],[.59,.68,.62],[.645,.71,.39]];
        for(let j=1;j<lip.length;j++){
          const p=lip[j-1],q=lip[j];
          m.quad([side*p[0],p[1],p[2]],[side*q[0],q[1],q[2]],[side*q[0],q[1]-.034,q[2]],[side*p[0],p[1]-.034,p[2]],'#2d374d');
        }
        oval(m,side*.598,.95,.45,.053,.075,.084,'#292649');
        oval(m,side*.635,.97,.47,.028,.044,.048,'#ccfff2',5);
        const chain=[[.49,1.14,.55],[.64,1.02,.19],[.52,1.12,-.09],[.46,.96,-.35]];
        chain.forEach(([x,y,z],i)=>{
          oval(m,side*x,y,z,.033,.041,.034,'#ffecb4',5);
          if(i){const [px,py,pz]=chain[i-1];tube(m,[side*px,py,pz],[side*x,y,z],.009,.009,'#efcc95',5);}
        });
        for(let i=0;i<(simple?3:5);i++){
          const f=i*.09,a=[side*(.34-f*.55),.54-f*.29,.85],b=[side*(.54-f*.56),.41-f*.38,.62],c=[side*(.61-f*.74),.44-f*.91,.28];
          const lift=v=>[v[0],v[1]+.016,v[2]];
          m.quad(a,b,lift(b),lift(a),'#a39ab9');m.quad(b,c,lift(c),lift(b),'#9289aa');
        }
        // Faint star clusters follow the curvature of the whaleback.
        const stars=simple?4:9;
        for(let i=0;i<stars;i++){
          const z=-.49+i*.085,y=.99+.08*Math.sin(i*2.36);
          const x=(z<-.11?.31+(z+.49)*.76:.61+(z+.11)*.15);
          const size=i%3===0?.039:.022;
          m.quad([side*x,y+size,z],[side*(x+.007),y,z+size*.55],[side*x,y-size,z],[side*(x+.007),y,z-size*.55],i%3?'#a4d8dc':'#ffdeae',5);
        }
        vane(tail,[[0,.91,-.65],[side*.27,1.02,-.77],[side*.88,1.14,-.83],[side*.99,1.08,-1.03],[side*.52,.94,-1.0],[0,.83,-.85]],
          [side*.43,.99,-.86],['#7684cf','#9885c8','#d7cce4']);
      }
      vane(m,[[-.076,1.42,.28],[-.05,1.69,.02],[0,1.84,-.21],[0,1.54,-.16],[.066,1.39,-.22]],[0,1.51,.034],['#9e94cc','#ddd2e9','#ad91c3']);
      for(let i=0;i<(simple?2:4);i++){
        const z=-.27-i*.105,h=1.36-i*.084;
        vane(m,[[-.039,h,z],[0,h+.12,z-.095],[.039,h,z]],[0,h+.03,z+.066],['#ada1db','#d5cedf']);
      }
    }
    function hart(){
      const m=make('mythHart'),legs=make('mythHartLegs');
      hull(m,[[-.77,1.01,.08,.12],[-.50,1.03,.44,.39],[.18,1.10,.43,.39],[.47,1.22,.25,.35],[.55,1.31,.07,.09]],
        ['#a897db','#c6aed8','#fff0cc']);
      tube(m,[0,1.27,.26],[0,1.75,.54],.27,.18,'#d7bee8');
      oval(m,0,1.80,.60,.255,.215,.30,'#ead3e3');
      oval(m,0,1.73,.81,.17,.13,.19,'#ded0df');
      oval(m,0,1.76,.98,.11,.065,.07,'#565478');
      for(const d of [-1,1]){
        vane(m,[[d*.13,1.87,.55],[d*.42,2.04,.42],[d*.27,1.81,.52]],[d*.25,1.91,.54],['#d699be','#eec5de']);
        oval(m,d*.22,1.84,.70,.032,.038,.046,'#fff6c1',5);
        const a=[d*.13,1.94,.51],b=[d*.28,2.17,.40],c=[d*.48,2.37,.20],end=[d*.49,2.67,.01];
        tube(m,a,b,.055,.05,'#e9bc75');tube(m,b,c,.05,.038,'#ffde91');tube(m,c,end,.038,.009,'#ffedb6',5);
        tube(m,b,[d*.34,2.44,.51],.035,.007,'#fae5a0',5);tube(m,c,[d*.63,2.54,.33],.026,.005,'#fff2af',5);
        for(const front of [-1,1]){
          const z=front*.39,knee=z+front*.23;
          tube(legs,[d*.22,.90,z],[d*.29,.42,knee],.099,.06,'#b4a2cf');
          tube(legs,[d*.29,.42,knee],[d*.28,.12,knee-.17],.057,.043,'#d7bdc9');
          oval(legs,d*.28,.09,knee-.14,.07,.07,.09,'#f8db8a',5);
        }
      }
    }
    function moth(){
      const m=make('mythMoth');
      hull(m,[[-1,.29,.02,.04],[-.52,.38,.14,.14],[.14,.46,.18,.18],[.46,.49,.15,.17],[.62,.47,.035,.06]],
        ['#d1c19e','#584661','#f6c57a']);
      for(const d of [-1,1]){
        const w=make('mythMothWing'+d);
        oval(m,d*.13,.51,.39,.065,.079,.073,'#c1ffde',5);
        tube(m,[d*.07,.59,.50],[d*.28,.78,.85],.024,.009,'#eabc82');
        const root=[d*.10,.46,.12];
        const points=[[.22,.61,.53],[.64,.72,.90],[.91,.67,.89],[1.02,.58,.61],[.87,.49,.20],
          [.72,.48,-.04],[.90,.41,-.29],[.81,.32,-.47],[.48,.28,-.71],[.32,.30,-.94],[.29,.38,-.51],[.17,.41,-.23]];
        const rim=points.map(([x,y,z])=>[d*x,y,z]),hub=[d*.43,.54,.07];
        const colors=['#b7fced','#8ddbc4','#6ba8be','#b39fc6','#efacc8','#f9cc97','#d286a7','#a5b4d0'];
        // Actual open cells let the racing line show through. Narrow colored
        // membranes, vein junctions and dark edges carry the wing silhouette.
        const border=[root,...rim];
        for(let i=0;i<border.length;i++){
          const a=border[i],b=border[(i+1)%border.length],col=colors[i%colors.length];
          const center=[0,1,2].map(k=>(a[k]+b[k]+hub[k])/3),open=i>1&&i<11&&i%3!==0;
          if(open){
            const inner=[hub,a,b].map(p=>between(p,center,.52));
            w.quad(hub,a,inner[1],inner[0],col);w.quad(a,b,inner[2],inner[1],col);w.quad(b,hub,inner[0],inner[2],col);
          }else w.tri(hub,a,b,col);
        }
        for(let i=0;i<rim.length;i++){
          tube(w,rim[i],rim[(i+1)%rim.length],.018,.014,'#785b78');
          if(i%2===0)tube(w,hub,rim[i],.012,.009,'#ffe29c');
        }
        const ocellus=(x,y,z,rx,rz,color)=>{
          const ring=[],count=simple?7:12;
          for(let j=0;j<count;j++){const a=tau*j/count;ring.push([d*(x+rx*Math.cos(a)),y+.17*rz*Math.sin(a),z+rz*Math.sin(a)]);}
          vane(w,ring,[d*x,y+.006,z],[color]);
        };
        ocellus(.70,.645,.49,.125,.169,'#66587b');ocellus(.70,.655,.49,.102,.134,'#f2baa9');
        ocellus(.70,.665,.49,.071,.093,'#5893a0');ocellus(.69,.676,.51,.034,.049,'#fff1c1');
        ocellus(.60,.454,-.36,.061,.072,'#ae719e');ocellus(.60,.464,-.36,.032,.04,'#fae4b2');
        for(let i=0;i<4;i++){
          const t=.22+i*.17,p=[d*(.07+.21*t),.59+.19*t,.50+.35*t];
          m.tri(p,[p[0]+d*.072,p[1]+.055,p[2]+.009],[p[0]+d*.017,p[1]+.025,p[2]+.041],'#cbae80');
        }
      }
    }
    function orchid(){
      const m=make('mythOrchid'),petal=make('mythOrchidPetals');
      tube(m,[0,.03,0],[.05,.63,0],.16,.11,'#2b766b');
      for(let i=0;i<5;i++){
        const a=tau*i/5,pt=(r,y,b=0)=>[r*Math.cos(a+b),y,r*Math.sin(a+b)];
        vane(m,[pt(.03,.1),pt(.31,.14,-.49),pt(.92,.21),pt(.37,.28,.43)],pt(.42,.30),['#80caaa','#3d927d']);
        const outline=[pt(.10,.51),pt(.54,.75,-.42),pt(.87,1.25,-.32),pt(.82,1.64),pt(.71,1.53,.30),pt(.44,.91,.48)];
        vane(petal,outline,pt(.58,1.12),['#d86a9c','#ffaaad','#ffe8bc','#f9a3cb','#b75d9f']);
        tube(petal,pt(.22,.64),pt(.75,1.48),.028,.012,'#ffdf97',5);
        tube(petal,pt(.47,.93,-.14),pt(.49,1.18,-.10),.042,.003,'#fff0c7');
      }
      oval(m,0,.67,0,.29,.21,.29,'#6b3a71');
      for(let i=0;i<5;i++){
        const a=tau*i/5,p=[.16*Math.cos(a),.98,.16*Math.sin(a)];
        tube(m,[0,.68,0],p,.024,.015,'#dbad5d');oval(m,...p,.064,.097,.062,'#fce99c',5);
      }
    }
    function hound(){
      const m=make('mythHound');
      hull(m,[[-.85,.87,.05,.12],[-.63,.90,.39,.41],[-.23,.89,.33,.31],[.17,1.01,.49,.53],[.51,1.04,.44,.42],[.61,1.02,.05,.12]],
        ['#413848','#292938','#665464']);
      tube(m,[0,.99,-.65],[.07,1.28,-.88],.115,.065,'#3b3449');
      tube(m,[.07,1.28,-.88],[.06,1.63,-.97],.065,.008,'#a34459');
      const strides=[make('mythHoundStride0'),make('mythHoundStride1')];
      for(const d of [-1,1])for(const front of [-1,1]){
        const limb=strides[d===front?0:1];
        const z=front*.39,b=[d*.34,.43,z-.05],foot=[d*.45,.10,z+.18];
        tube(limb,[d*.24,.92,z],b,.17,.097,'#493c4b');tube(limb,b,foot,.10,.08,'#403645');
        oval(limb,...foot,.13,.10,.15,'#4c3c4e');
        for(const k of [-1,1])tube(limb,[foot[0]+.052*k,.09,foot[2]+.09],[foot[0]+.064*k,.046,foot[2]+.20],.032,.002,'#d8ac91');
      }
      for(let i=0;i<4;i++)tube(m,[0,1.28,-.46+i*.16],[0,1.52+i*.04,-.54+i*.15],.073,.002,'#8b4257');
      for(const d of [-1,1])for(let j=0;j<4;j++){
        const z=.24-j*.125,x=.485-j*.033;
        const ridge=[d*x,1.14,z],heel=[d*(x-.047),.913,z-.026],end=[d*(x-.11),.79,z+.068];
        m.quad(ridge,heel,[heel[0],heel[1]+.012,heel[2]+.037],[ridge[0],ridge[1]+.024,ridge[2]+.045],'#996068');
        m.tri(heel,end,[heel[0],heel[1]+.012,heel[2]+.037],'#f88360',5);
      }
      const head=make('mythHoundHead'),jaw=make('mythHoundJaw');
      hull(head,[[-.25,.09,.08,.09],[-.10,.09,.29,.23],[.12,.05,.24,.19],[.31,-.005,.13,.10],[.42,0,.09,.07]],
        ['#615063','#3a3447','#7c5761']);
      hull(jaw,[[-.085,-.075,.075,.04],[.044,-.112,.132,.054],[.19,-.153,.143,.052],[.345,-.133,.108,.037],[.40,-.115,.046,.017]],['#dd776a','#704555','#503f4d']);
      vane(jaw,[[-.051,-.089,.054],[.049,-.089,.054],[.069,-.109,.241],[0,-.092,.334],[-.065,-.109,.241]],[0,-.076,.21],['#bf555c','#e37a6b']);
      oval(head,0,.040,.412,.084,.061,.043,'#232431');
      for(const d of [-1,1]){
        vane(head,[[d*.04,.23,-.13],[d*.30,.57,-.24],[d*.31,.17,-.11]],[d*.22,.27,-.07],['#542f49','#7b415b','#3b3446']);
        vane(head,[[d*.147,.248,-.099],[d*.274,.477,-.188],[d*.257,.257,-.096]],[d*.226,.293,-.091],['#9f5059','#743e54']);
        oval(head,d*.178,.141,.18,.057,.043,.059,'#f45643',5);
        head.tri([d*.15,.133,.225],[d*.199,.155,.19],[d*.18,.125,.206],'#ffedbc',5);
        vane(head,[[d*.119,.161,.224],[d*.230,.205,.114],[d*.253,.187,.058],[d*.197,.148,.169]],[d*.197,.188,.142],['#6c5367','#7a5a68']);
        for(let j=0;j<3;j++){
          const z=.135-j*.069,y=.117-j*.037;
          vane(head,[[d*.20,y+.067,z],[d*.30,y+.014,z-.074],[d*.336,y-.089,z-.132],[d*.19,y-.039,z-.031]],
            [d*.269,y+.003,z-.032],['#624759','#855364','#483e4d']);
        }
        // Upper canines and smaller lower teeth interlock when the jaws close.
        tube(head,[d*.119,-.023,.282],[d*.127,-.16,.321],.034,.002,'#ffe0ac');
        for(let j=0;j<(simple?2:4);j++){
          const z=.110+j*.045,x=.117+(z<.18?.018:-.007);
          head.tri([d*x,-.039,z],[d*x,-.039,z+.034],[d*(x-.008),-.092,z+.026],'#dcb793');
          jaw.tri([d*(x-.011),-.115,z+.014],[d*x,-.066,z+.031],[d*x,-.115,z+.049],'#ffd6a4');
        }
      }
    }
    function talon(){
      const m=make('mythTalon');
      oval(m,0,.53,0,.43,.55,.29,'#4f364b');
      oval(m,0,.62,-.255,.26,.15,.055,'#f9a179',5);oval(m,0,.63,-.296,.036,.13,.023,'#3f263e');
      for(let i=0;i<5;i++){
        const a=tau*i/5-.2,pt=(r,y,t=0)=>[r*Math.cos(a+t),y,r*Math.sin(a+t)];
        const base=pt(.26,.45),joint=pt(.73,.83),knuckle=pt(.88,1.45),tip=pt(.56,1.95+(i%3)*.22);
        tube(m,base,joint,.152,.123,'#59405a');tube(m,joint,knuckle,.128,.095,'#845064');
        oval(m,...joint,.14,.13,.13,'#714c61');tube(m,knuckle,pt(.84,1.70),.112,.062,'#b6787a');
        tube(m,pt(.84,1.70),tip,.063,.001,'#f9bfa1');
        tube(m,pt(.82,1.42,.06),pt(.76,1.68,.06),.023,.009,'#ff715b',5);
      }
    }
    function heel(){
      const m=make('mythHeel');
      // Hammered bronze cuirass plates and turquoise oxidation on the greave.
      hull(m,[[-.69,.23,.045,.08],[-.57,.26,.55,.24],[-.05,.23,.66,.205],[.55,.21,.78,.18],
        [.85,.20,.65,.14],[.97,.18,.035,.045]],['#a8784f','#80523c','#59483d']);
      for(let i=0;i<5;i++)oval(m,-.56+i*.27,.29,.72+.055*Math.sin(i*.8),.145,.156,.19,'#c9945d');
      for(const d of [-1,1]){
        tube(m,[d*.67,.33,.59],[d*.30,.64,.03],.092,.079,'#79513f');
        tube(m,[d*.61,.30,.25],[-d*.31,.71,-.21],.094,.078,'#e5b06b');
      }
      tube(m,[0,.38,-.27],[0,1.34,-.29],.38,.44,'#8a654f');
      tube(m,[0,1.07,-.29],[0,2.91,-.31],.47,.70,'#b28352');
      tube(m,[0,2.87,-.31],[0,3.75,-.28],.69,.52,'#b18b60');
      for(const [y,r] of [[.83,.43],[1.09,.50],[2.9,.75],[3.12,.72],[3.70,.57]]){
        tube(m,[0,y-.055,-.295],[0,y+.055,-.295],r,r,'#e8bd79');
      }
      vane(m,[[-.43,2.91,.02],[0,3.37,.31],[.44,2.89,.03],[.23,1.43,.16],[0,1.15,.28],[-.24,1.45,.16]],
        [0,2.30,.42],['#edd08b','#d6a56a','#aa7d57','#709385','#93b09b','#e3ac6a']);
      for(const d of [-1,1])for(let i=0;i<5;i++){
        const y=1.51+i*.21;
        tube(m,[d*.09,y,.34],[d*(.22+i*.015),y+.20,.30],.032,.017,'#5f8e82');
      }
      oval(m,0,3.84,-.27,.62,.57,.57,'#bf9667');
      // The moving joint meets the articulated thigh at lane center. The plinth,
      // planted leg and torso share the stamping foot's road tangent.
      oval(m,0,3.93,-.12,.54,.54,.50,'#ab815c');
      const thigh=make('mythTalosThigh');
      tube(thigh,[0,0,0],[0,.25,0],.49,.68,'#a27c54');
      tube(thigh,[0,.25,0],[0,.78,0],.68,.87,'#c49a66');
      tube(thigh,[0,.78,0],[0,1,0],.87,.67,'#a87e55');
      for(const [y,r] of [[.20,.655],[.76,.87]])
        tube(thigh,[0,y-.012,0],[0,y+.012,0],r+.027,r+.027,'#e4c489');
      const giant=make('mythTalos');
      // Standing hip sits outside the road. All coordinates are relative to
      // the stomp mark so curved and pitched sections cannot separate the rig.
      const X=4.65,Z=4.55,P=(x,y,z)=>[X+x,y,Z+z];
      const limb=(a,b,ra,rb,color)=>tube(giant,P(...a),P(...b),ra,rb,color);
      const mass=(x,y,z,rx,ry,rz,color,mat=0)=>oval(giant,...P(x,y,z),rx,ry,rz,color,mat);
      const plate=(outline,ridge,colors)=>vane(giant,outline.map(v=>P(...v)),P(...ridge),colors);
      const bronze='#b88a54',shadow='#705947',gold='#edc685',patina='#769b8d',cream='#f7dca0';
      // Moss-veined marble and a supporting leg give the suspended stomp a fixed point.
      limb([1.9,-1.75,1.0],[1.9,-.20,1.0],2.0,1.75,'#a7aaa1');
      limb([1.9,-.27,1.0],[1.9,-.06,1.0],1.85,1.85,'#e1d5bb');
      mass(1.78,.15,.88,.69,.27,.98,'#a78355');
      limb([1.85,.26,1.14],[1.59,2.65,.75],.38,.64,bronze);
      mass(1.60,2.69,.70,.63,.57,.58,'#c9a06a');
      limb([1.60,2.67,.78],[.57,5.70,.15],.54,.83,bronze);
      for(const [y,x,z,r] of [[.63,1.82,1.06,.48],[2.24,1.63,.79,.64]]){
        limb([x,y-.065,z],[x,y+.065,z],r,r,gold);
      }
      mass(0,5.72,.08,1.29,.68,.78,shadow);
      limb([0,5.83,0],[-.12,7.06,-.22],.88,1.06,'#a77b50');
      mass(-.22,7.51,-.20,1.52,1.10,.83,bronze);
      // Paired breastplates, tunic tabs and raised belt medallion.
      for(const side of [-1,1]){
        mass(-.21+side*.63,7.69,-.76,.68,.44,.31,'#c69b61');
        plate([[side*.98,6.59,-.28],[side*.84,7.08,-.50],[side*.23,6.83,-.89],[side*.23,6.47,-.77]],
          [side*.58,6.72,-.74],[bronze,gold,'#958364']);
      }
      limb([0,6.01,.03],[0,6.22,.02],1.08,1.10,gold);
      mass(0,6.13,-.98,.27,.23,.08,'#68968c');
      for(let i=0;i<9;i++){
        const a=tau*i/9,pa=(t,r,y)=>[Math.cos(t)*r,y,.08+Math.sin(t)*r*.78];
        plate([pa(a-.26,1.01,6.0),pa(a+.26,1.01,6.0),pa(a+.23,1.35,5.16),pa(a,1.40,4.94),pa(a-.23,1.35,5.16)],
          pa(a,1.28,5.56),[i%2?bronze:patina,'#aa8259',gold,shadow]);
      }
      // The soldier extends his inside hand for balance and braces the other behind a shield.
      for(const side of [-1,1]){
        const shoulder=[-.21+side*1.23,7.93,-.10];
        const elbow=side<0?[-2.24,7.09,-.79]:[1.97,7.00,-.52];
        const hand=side<0?[-2.92,6.98,-1.44]:[1.83,6.65,-1.28];
        limb(shoulder,elbow,.47,.34,bronze);mass(...elbow,.37,.35,.36,shadow);
        limb(elbow,hand,.32,.23,side<0?patina:gold);mass(...hand,.32,.29,.35,'#b88f62');
        mass(...shoulder,.58,.48,.62,'#dfb571');
      }
      // The shield boss and concentric gilded rims face approaching racers.
      for(const [r,z,col] of [[1.04,-1.32,shadow],[.97,-1.39,gold],[.85,-1.43,patina],[.64,-1.46,bronze],[.26,-1.51,gold]]){
        limb([1.86,6.62,z+.1],[1.86,6.62,z],r,r,col);
      }
      mass(1.86,6.62,-1.55,.24,.24,.18,gold);
      // High Corinthian helmet with an open face, cheek plates and horsehair crest.
      limb([-.25,8.18,-.23],[-.45,8.77,-.51],.49,.47,shadow);
      mass(-.47,9.06,-.58,.58,.66,.55,'#6e5848');
      mass(-.47,9.35,-.58,.66,.62,.62,bronze);
      for(const d of [-1,1]){
        const cheek=[[-.47+d*.56,9.28,-.82],[-.47+d*.48,9.33,-1.03],[-.47+d*.26,9.20,-1.15],
          [-.47+d*.29,8.93,-1.17],[-.47+d*.42,8.59,-1.08],[-.47+d*.57,8.80,-.89]];
        plate(cheek,[-.47+d*.45,9.00,-1.08],[bronze,gold,'#9c7954',patina]);
        mass(-.47+d*.245,9.21,-1.10,.137,.040,.048,'#a1f6dc',5);
      }
      plate([[-1.05,9.39,-.87],[-.47,9.59,-1.03],[.11,9.39,-.87],[-.39,9.31,-1.17],[-.47,8.92,-1.20],[-.57,9.30,-1.17]],
        [-.47,9.40,-1.20],[gold,bronze,gold,'#cba66a']);
      for(let j=0;j<9;j++){
        const t=j/8,z=-1.09+1.21*t,y=9.56+.28*Math.sin(t*Math.PI);
        limb([-.47,y,z],[-.49,y+.42+.15*Math.sin(t*Math.PI),z+.13],.13,.075,j%2?'#a14c40':'#813d39');
      }
    }
    function eagle(){
      const m=make('mythEagle');
      hull(m,[[-.75,.41,.04,.06],[-.45,.51,.25,.20],[.06,.52,.28,.28],[.36,.57,.20,.23],[.50,.56,.06,.11]],
        ['#91633c','#ad7849','#e5b768']);
      oval(m,0,.72,.41,.171,.188,.215,'#eed8ac');
      tube(m,[0,.73,.55],[0,.70,.72],.09,.059,'#e2ab4e');tube(m,[0,.70,.72],[0,.599,.699],.06,.005,'#8e623d');
      for(const d of [-1,1]){
        oval(m,d*.145,.76,.48,.033,.045,.040,'#925d28');
        oval(m,d*.161,.762,.482,.022,.026,.025,'#2a3030');
        vane(m,[[d*.092,.801,.585],[d*.169,.814,.478],[d*.170,.806,.413],[d*.137,.773,.513]],[d*.145,.808,.504],
          ['#e5be73','#f3d89f','#d3ac74']);
        for(let j=0;j<3;j++){
          const x=.055+j*.042,z=.34-j*.049;
          vane(m,[[d*x,.714,z],[d*(x+.057),.685,z],[d*(x+.062),.546,z-.082],[d*x,.637,z-.069]],
            [d*(x+.033),.667,z-.025],['#f2dfb6','#cfaf7f','#e6c591']);
        }
        tube(m,[d*.123,.36,.15],[d*.224,.15,.10],.051,.038,'#e8b150');
        for(const j of [-1,1]){
          const knuckle=[d*.224+.055*j,.078,.234];
          tube(m,[d*.224,.15,.10],knuckle,.035,.026,'#d5a04c');tube(m,knuckle,[knuckle[0],.026,.27],.024,.002,'#514335');
        }
        const w=make('mythEagleWing'+d),p=(x,y,z)=>[d*x,y,z];
        vane(w,[p(.14,.60,.23),p(.47,.75,.46),p(.74,.78,.26),p(.85,.73,-.07),p(.61,.62,-.30),p(.23,.48,-.25)],
          p(.47,.79,.10),['#d5a05b','#bc864c','#a27241','#ebc378']);
        for(let i=0;i<7;i++){
          const t=i/6;
          const start=p(.37+.33*t,.71,.31-.47*t),end=p(1.16-.41*t,.62-.22*t,.35-.98*t);
          feather(w,start,end,.087,d,i%2?'#bf945a':'#cca562','#79573c');
          feather(w,between(start,end,.61),end,.046,d,'#715843','#4e483d');
        }
        for(let j=0;j<(simple?4:7);j++){
          const t=j/(simple?3:6);
          feather(w,p(.255+.275*t,.747,.312-.34*t),p(.676+.19*t,.741,.237-.56*t),.061,d,
            j%2?'#e5be7c':'#efcb89','#aa8454');
        }
        vane(m,[p(.04,.49,-.44),p(.17,.46,-.55),p(.27,.30,-.91),p(.10,.30,-1.0)],
          p(.13,.42,-.68),['#d6ab63','#977342']);
      }
    }
    const builders=[[leviathan,hart],[moth,orchid],[hound,talon],[heel,eagle]];
    for(let realm=0;realm<builders.length;realm++){
      if(courseIndex!==undefined&&courseIndex!==realm+16)continue;
      ringMark(realm);for(const build of builders[realm])build();
    }
    return result;
  }

  function scene(h,time,emit){
    if(h.phase==='clear')return;
    const realm=Math.floor((h.id-14)/2),p=h.progress,alpha=h.phase==='receding'?1-p:h.warning?Math.min(1,p*6):1;
    if(alpha<=.02)return;
    const base='myth'+names[h.id-14],stretch=[h.bodyWidth,1,h.bodyLength];
    const mark=(s,x,w,l,opacity)=>emit('mythMark'+realm,s,x,.078,0,1,opacity,0,0,[w,1,l],h.branch);
    if(h.warning){
      mark(h.warningS,h.warningX,h.warningHalfWidth,h.warningHalfLength,.58+.32*p+.10*Math.sin(time*9));
    }else if(h.active){
      mark(h.s,h.x,h.halfWidth,h.halfLength,.39+.17*Math.sin(time*8));
    }
    // Local offsets follow the same heading used by the oriented contact test.
    const cs=Math.cos(h.yaw),sn=Math.sin(h.yaw),bob=Math.sin(time*3+h.baseS);
    const draw=(name,dx=0,dy=0,dz=0,roll=0,pitch=0,scale=stretch,angle=0)=>{
      const x=dx*h.bodyWidth,z=dz*h.bodyLength;
      emit(name,h.s+cs*z-sn*x,h.x+cs*x+sn*z,h.bottom+dy,h.yaw+angle,1,alpha,roll,pitch,scale,h.branch);
    };
    switch(h.id){
      case 14:{
        const heave=.053*bob,roll=.038*Math.sin(time*2.1+h.baseS);
        draw(base,0,0,0,roll,heave);
        draw('mythFlukes',0,-.03*bob,0,roll,.16*Math.sin(time*3+h.baseS-.30));
        for(const d of [-1,1]){
          const stroke=.14*Math.sin(time*2.7+h.baseS+d*.24);
          draw('mythLeviathanFin'+d,0,-.38*stroke,0,roll+d*stroke,heave);
        }
        break;
      }
      case 15:
        draw(base,0,.025*bob);
        draw('mythHartLegs',0,.025*bob,0,0,.22*Math.sin(time*5+h.baseS));
        break;
      case 16:case 21:{
        const bird=h.id===21,stroke=Math.sin(time*(bird?4:7)+h.baseS);
        const dive=bird&&h.active?Math.sin(2*Math.PI*p):0;
        const beat=bird?.24+.34*stroke+.16*dive:.23+.49*stroke;
        const bank=(bird?.067:.06)*Math.sin(time*(bird?2.5:3.4)+h.baseS);
        const pitch=bird?.22*dive:.035*Math.cos(time*7+h.baseS);
        draw(base,0,0,0,bank,pitch);
        for(const d of [-1,1])draw(base+'Wing'+d,0,0,0,bank+d*beat,pitch);
        break;
      }
      case 17:{
        const growth=h.active?h.reveal:0;
        // A flush flower bud opens into the road, then withdraws completely.
        if(growth>.01){
          draw(base,0,0,0,0,0,[h.bodyWidth,growth,h.bodyLength]);
          draw('mythOrchidPetals',0,0,0,0,0,[h.bodyWidth,growth,h.bodyLength],.23*Math.sin(p*Math.PI*2));
        }
        break;
      }
      case 18:{
        const stride=Math.sin(time*(h.active?8:4)+h.baseS),breath=.024*Math.abs(stride);
        draw(base,0,breath);
        draw('mythHoundStride0',0,breath,0,0,stride*.16);
        draw('mythHoundStride1',0,breath,0,0,-stride*.16);
        for(const d of [-1,1,0]){
          const cycle=time*5+d*1.7+h.baseS,headPitch=.07*Math.sin(cycle),y=1.34+(d===0?.18:0)+breath+.045*Math.sin(cycle*.84);
          const z=.36+(d===0?.22:0),yaw=d*.28,roll=d*.11;
          draw('mythHoundHead',d*.42,y,z,roll,headPitch,stretch,yaw);
          draw('mythHoundJaw',d*.42,y,z,roll,headPitch+.29*Math.max(0,Math.sin(cycle))**2,stretch,yaw);
        }
        break;
      }
      case 19:
        if(h.reveal>.01)draw(base,0,0,0,0,0,[h.bodyWidth,h.reveal,h.bodyLength],h.reveal*.27);
        break;
      case 20:{
        // Rotate a unit-length thigh between the fixed hip and the moving knee.
        // Mirror the entire stance on alternate cycles, matching the warned lane.
        const side=h.sourceSide,kneeY=h.bottom+3.93,dx=side*(4.65-.43),dz=4.55,dy=5.70-kneeY;
        emit('mythTalos',h.s,h.x,0,0,1,alpha,0,0,[side,1,1],h.branch);
        emit('mythTalosThigh',h.s,h.x,kneeY,Math.atan2(dx,dz),1,alpha,0,
          Math.atan2(Math.hypot(dx,dz),dy),[1,Math.hypot(dx,dy,dz),1],h.branch);
        draw(base);
        if(h.active&&p>.19&&p<.39){
          const wave=(p-.19)/.20;mark(h.s,h.x,h.bodyWidth*(1+wave*.7),h.bodyLength*(1+wave*.7),.75*(1-wave));
        }
        break;
      }
    }
  }
  root.AcornMythicHazardsArt={meshes,scene};
})(typeof globalThis==='object'?globalThis:this);
