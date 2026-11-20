(function(root){
  'use strict';
  const tau=Math.PI*2;
  const signal=['#73ecd5','#dca9ff','#ffc47b','#ff7996'];
  function meshes(Mesh,simple){
    const all={},make=name=>all[name]=new Mesh(),n=simple?8:14;
    const ball=(m,x,y,z,rx,ry,rz,color,glow=0)=>m.blob(x,y,z,rx,ry,rz,color,simple?6:10,glow);
    const rod=(m,a,b,ra,rb,col,mat=0)=>m.ring(a,b,ra,rb,col,simple?5:8,mat);
    function ridge(m,outline,crest,colors,mat=0){
      for(let j=0;j<outline.length;j++)m.tri(outline[j],outline[(j+1)%outline.length],crest,colors[j%colors.length],mat);
    }
    function mantle(m,rows,colors){
      const point=(row,i,k)=>{
        const a=i*tau/n,seam=(i%2?.95:1.07),hem=k===0?.13*Math.sin(3*a+.65)+.07*Math.cos(5*a):0;
        return [row[1]*Math.cos(a)*seam,row[0]+hem,row[3]+row[2]*Math.sin(a)*seam];
      };
      for(let k=1;k<rows.length;k++)for(let j=0;j<n;j++){
        const lo=point(rows[k-1],j,k-1),lo2=point(rows[k-1],j+1,k-1),hi=point(rows[k],j,k),hi2=point(rows[k],j+1,k);
        m.quad(lo,lo2,hi2,hi,colors[(j+k%2)%colors.length]);
      }
    }
    function hood(m,x,y,z,size,colors,mask,eye){
      // The cowl is open toward the racer. The pale death mask sits behind the rim.
      const outer=[[-.53,-.48,-.09],[-.66,.02,-.13],[-.43,.62,-.04],[0,.87,.04],[.43,.62,-.04],[.66,.02,-.13],[.53,-.48,-.09],[0,-.65,-.04]];
      const at=([a,b,c])=>[x+a*size,y+b*size,z+c*size];
      const rim=outer.map(at);
      const back=outer.map(([a,b,c])=>at([a*.77,b*.76,c+.63]));
      for(let i=0;i<rim.length;i++){
        const j=(i+1)%rim.length;
        m.quad(rim[i],rim[j],back[j],back[i],colors[i%colors.length]);
        m.tri(back[j],back[i],at([0,.07,.95]),colors[(i+2)%colors.length]);
        m.tri(rim[i],rim[j],at([0,.02,.30]),'#18162a');
        rod(m,rim[i],rim[j],size*.027,size*.024,colors[1]);
      }
      const skull=[[-.28,.28,-.15],[0,.41,-.20],[.28,.28,-.15],[.31,.02,-.15],[.16,-.32,-.21],[0,-.48,-.26],[-.16,-.32,-.21],[-.31,.02,-.15]].map(at);
      ridge(m,skull,at([0,.04,-.34]),mask);
      for(const side of [-1,1]){
        const p=(a,b,c)=>at([side*a,b,c]);
        m.tri(p(.064,.046,-.335),p(.276,.155,-.21),p(.21,-.053,-.246),'#241e30');
        rod(m,p(.11,.052,-.34),p(.222,.097,-.27),size*.026,size*.013,eye,5);
      }
    }
    for(let id=0;id<4;id++){
      const m=make('shadeMark'+id),sectors=simple?24:40;
      const p=(a,r)=>[Math.cos(a)*r,.018,Math.sin(a)*r];
      for(let j=0;j<sectors;j++){
        const a=tau*j/sectors,b=tau*(j+1)/sectors;
        m.quad(p(a,1),p(b,1),p(b,.90),p(a,.90),j%4===0?'#fff3c9':signal[id],5,[0,1,0]);
        if(j%4===0)m.tri(p(a-.09,.81),p(a+.09,.81),p(a,.59),signal[id],5,[0,1,0]);
      }
      // Central glyphs differ in shape as well as color.
      if(id===1)for(let j=-2;j<=2;j++)rod(m,[j*.13,.02,.04],[j*.18,.021,-.40+.06*Math.abs(j)],.030,.014,signal[id],5);
      else if(id===2){for(const side of [-1,1])rod(m,[0,.02,-.40],[side*.37,.02,.33],.034,.028,signal[id],5);}
      else for(const side of [-1,1])m.tri([0,.021,-.43],[side*(id===3?.45:.24),.021,0],[0,.021,.43],signal[id],5);
    }

    const bearer=make('shadeBearer'),lamp=make('shadeLantern');
    mantle(bearer,[[.10,.58,.38,.11],[.62,.39,.30,.02],[1.28,.37,.27,0],[1.54,.50,.25,0],[1.66,.21,.16,0]],
      ['#214451','#39616c','#385566','#4d7182','#284252']);
    for(const side of [-1,1]){
      const p=(x,y,z)=>[side*x,y,z];
      ridge(bearer,[p(.09,1.59,-.20),p(.43,1.51,-.12),p(.43,.39,-.25),p(.29,.20,-.30),p(.15,.51,-.34)],p(.30,1.03,-.36),['#7396a3','#506e82','#aac7bd']);
      rod(bearer,p(.17,1.50,-.27),p(.30,.43,-.37),.020,.012,'#b9a773');
    }
    hood(bearer,0,1.87,-.04,.47,['#3d6375','#809aab','#365364'],['#b6c6b7','#9cb6b0','#d1d8c4'],'#caffdd');
    rod(bearer,[-.34,1.39,0],[-.49,1.02,-.16],.16,.12,'#496576');
    rod(bearer,[.34,1.4,0],[.58,1.01,-.20],.17,.11,'#486471');
    rod(bearer,[.58,1.01,-.20],[.67,1.18,-.35],.11,.065,'#8fa9ab');
    ball(bearer,.67,1.18,-.36,.088,.084,.084,'#b7c8b6');
    rod(lamp,[0,0,0],[0,-.15,0],.019,.019,'#bfa376');
    rod(lamp,[0,-.15,0],[0,-.25,0],.042,.153,'#8a7657');
    rod(lamp,[0,-.25,0],[0,-.49,0],.094,.13,'#9affd1',5);
    rod(lamp,[0,-.49,0],[0,-.57,0],.16,.052,'#826950');
    for(let k=0;k<4;k++){
      const a=k*tau/4+.63;rod(lamp,[.139*Math.cos(a),-.24,.139*Math.sin(a)],[.15*Math.cos(a),-.50,.15*Math.sin(a)],.022,.025,'#574748');
    }

    const palm=make('shadePalm'),finger=make('shadeFinger'),crack=make('shadeFissure');
    rod(palm,[0,-.23,.17],[-.04,.64,0],.22,.34,'#8b748b');
    ball(palm,0,.85,0,.57,.48,.26,'#b2a0a8');
    for(let j=-2;j<=2;j++){
      rod(palm,[j*.095,.50,-.19],[j*.21,1.14-Math.abs(j)*.052,-.15],.052,.068,j%2?'#e6ccbe':'#cdb5b0');
      if(j%2===0)rod(palm,[j*.096,.53,-.241],[j*.21,1.01,-.202],.013,.009,'#d8a7ff',5);
    }
    const joints=[[0,0,0],[0,.40,-.05],[0,.67,-.21],[0,.79,-.45]];
    for(let j=0;j<3;j++){
      const a=joints[j],b=joints[j+1];
      ball(finger,...a,.14-j*.025,.109-j*.016,.13-j*.022,j%2?'#a58b9c':'#c8b6b2');
      rod(finger,a,b,.119-j*.022,.093-j*.020,'#c7b8b4');
    }
    rod(finger,joints[3],[0,.72,-.66],.085,.006,'#f4dddb');
    for(let j=0;j<10;j++){
      const a=tau*j/10,b=a+tau/10,r=j%2?.84:1.02;
      const pt=(angle,r,y)=>[Math.cos(angle)*r,y,Math.sin(angle)*r];
      crack.tri([0,.018,0],pt(a,r,.018),pt(b,1,.018),'#2b1c39',0,[0,1,0]);
      crack.tri(pt(a,r,.026),pt(a+.14,r*.92,.030),pt(a+.08,r*.36,.028),'#c183e4',5,[0,1,0]);
    }

    const frame=make('shadeGallows'),bell=make('shadeBell'),tongue=make('shadeClapper'),cord=make('shadeCord');
    // A cantilever from the outer shoulder keeps the opposite racing line open.
    for(const z of [-1,1]){
      frame.box(0,0,z,.34,.31,.77,0,'#666278');
      rod(frame,[0,.30,z],[0,5.48,z*.56],.23,.16,'#4e4a59');
      for(const y of [.86,3.8,5.13])rod(frame,[0,y,z*(1-y*.077)],[0,y+.13,z*(1-y*.077)],.245,.245,'#998063');
    }
    rod(frame,[0,3.68,0],[1,5.3,0],.10,.13,'#81716b');
    rod(frame,[-.13,5.41,0],[1.10,5.41,0],.18,.14,'#74645c');
    rod(frame,[1,5.5,0],[1,4.34,0],.043,.049,'#b7a077');
    const levels=[[0,.89],[.10,.92],[.22,.77],[.43,.64],[.82,.48],[1.19,.44],[1.33,.37],[1.44,.10]];
    const slices=simple?10:20,B=(a,y,r)=>[Math.cos(a)*r,y,Math.sin(a)*r];
    for(let k=1;k<levels.length;k++)for(let i=0;i<slices;i++){
      const a=tau*i/slices,b=tau*(i+1)/slices,[y0,r0]=levels[k-1],[y1,r1]=levels[k];
      bell.quad(B(a,y0,r0),B(a,y1,r1),B(b,y1,r1),B(b,y0,r0),['#aa7a55','#a57c5d','#9a7559','#727b75'][(i+Math.floor(k*.36))%4],2);
      if(k===1)bell.quad(B(a,y0,r0),B(b,y0,r0),B(b,y0+.07,r0*.90),B(a,y0+.07,r0*.90),'#57474a');
    }
    for(const [y,r] of [[.12,.89],[.36,.69],[1.10,.46]])for(let j=0;j<slices;j++){
      const a=j*tau/slices,b=(j+1)*tau/slices;
      bell.quad(B(a,y,r),B(b,y,r),B(b,y+.044,r-.012),B(a,y+.044,r-.012),'#d2ab6d',2);
    }
    for(let j=0;j<8;j++){
      const a=tau*j/8;
      bell.tri(B(a-.16,.51,.628),B(a+.16,.51,.628),B(a,.81,.51),j%2?'#d7a971':'#7bc9b2',j%2?2:5);
    }
    rod(tongue,[0,.31,0],[0,-.20,0],.053,.06,'#907255');ball(tongue,0,-.23,0,.145,.151,.145,'#d6ad71');
    rod(cord,[0,0,0],[0,1,0],.038,.038,'#c8a97c');

    const witch=make('shadeHuntress');
    mantle(witch,[[.11,.46,.47,.18],[.65,.29,.19,.07],[1.26,.32,.20,.02],[1.62,.53,.24,0],[1.76,.15,.12,-.04]],
      ['#693b56','#4b304e','#81475c','#44304b','#5d3750']);
    hood(witch,0,1.99,-.07,.52,['#35273f','#98566a','#5f374e'],['#eed6c2','#d5b6b2','#bd9ca2'],'#ff718b');
    for(const side of [-1,1]){
      const p=(x,y,z)=>[side*x,y,z],wing=make('shadeVeil'+side);
      rod(witch,p(.24,2.21,.03),p(.39,2.57,.16),.085,.039,'#c3a08e');
      rod(witch,p(.39,2.57,.16),p(.34,2.77,.02),.041,.005,'#e8c9af');
      rod(witch,p(.36,1.57,.02),p(.62,1.28,-.20),.126,.092,'#816678');
      rod(witch,p(.62,1.28,-.20),p(.60,1.01,-.59),.086,.047,'#d8bbbd');
      for(let k=0;k<3;k++)rod(witch,p(.60+k*.028,1.01,-.59),p(.53+k*.059,.90,-.80+k*.039),.027,.003,'#fff0dc');
      const root=p(.36,1.48,.09),knuckle=p(1.0,1.94,.06),tip=p(1.79,2.16,.26);
      const rim=[root,knuckle,tip,p(1.51,1.54,.35),p(1.53,1.14,.60),p(1.21,1.33,.62),p(1.04,.81,.8),
        p(.85,1.01,.75),p(.65,.61,.73),p(.48,.90,.42)];
      ridge(wing,rim,p(.84,1.53,.34),['#8d5167','#714258','#432d48','#b46f7d','#59405a']);
      rod(wing,root,knuckle,.068,.049,'#c5a2a8');rod(wing,knuckle,tip,.055,.009,'#d9bbc0');
      for(const k of [4,6,8])rod(wing,knuckle,rim[k],.026,.007,'#b98e9c');
    }
    return all;
  }

  function scene(h,time,emit){
    const p=h.progress,linger=h.phase==='receding',parked=h.phase==='clear';
    const alpha=h.warning?Math.min(1,p*5):linger?1-p:parked?0:1;
    const at=(mesh,s,x,y,yaw=0,opacity=1,roll=0,pitch=0,scale=[1,1,1])=>{
      if(opacity>.025)emit(mesh,s,x,y,yaw,1,Math.min(1,opacity),roll,pitch,scale,h.branch);
    };
    const mark=(s,x,w,l,opacity)=>at('shadeMark'+(h.id-22),s,x,.085,0,opacity,0,0,[w,1,l]);
    if(h.warning)mark(h.warningS,h.warningX,h.warningHalfWidth,h.warningHalfLength,.58+.34*p+.08*Math.cos(time*7));
    if(h.active&&h.id!==22)mark(h.s,h.x,h.halfWidth,h.halfLength,.53+.14*Math.sin(time*7.3));
    if(h.id===24){
      const shoulder=h.sourceSide*(h.roadWidth+1.4),reach=h.x-shoulder;
      // Keep the unoccupied bank's timber frame in place as the active lane alternates.
      for(const side of [-1,1])at('shadeGallows',h.baseS,shoulder*side,0,0,1,0,0,[reach*side,1,1]);
      function hang(x,angle,clapper){
        const z=h.rope*Math.sin(angle),bottom=.08+h.rope*(1-Math.cos(angle)),y=bottom+1.39;
        const dy=4.34-y,len=Math.hypot(dy,z);
        at('shadeCord',h.baseS+z,x,y,0,1,0,Math.atan2(-z,dy),[1,len,1]);
        at('shadeBell',h.baseS+z,x,bottom,0,1,0,.22*angle,[h.halfWidth,1,h.halfLength]);
        at('shadeClapper',h.baseS+z,x,bottom+.04,0,1,0,clapper);
      }
      hang(-h.x,.94,0);
      hang(h.x,h.angle,h.active?-.23*Math.sin(time*4.2):0);
      return;
    }
    if(alpha<.025)return;
    if(h.id===22){
      h.bearers.forEach((ghost,i)=>{
        if(h.active)mark(ghost.s,ghost.x,h.halfWidth,h.halfLength,.46);
        const swing=Math.sin(time*3.1+i*1.9),y=h.bottom+ghost.bob,yaw=.45*h.sourceSide;
        at('shadeBearer',ghost.s,ghost.x,y,yaw,alpha*(.86+.035*i),.026*swing);
        const dx=.67*Math.cos(yaw)-.36*Math.sin(yaw),dz=-.36*Math.cos(yaw)-.67*Math.sin(yaw);
        at('shadeLantern',ghost.s+dz,ghost.x+dx,y+1.18,yaw,alpha,.16*swing,.12*swing);
      });
    }else if(h.id===23){
      at('shadeFissure',h.s,h.x,.038,0,alpha,0,0,[h.halfWidth,1,h.halfLength]);
      if(h.active&&h.strength>.008){
        const grow=h.strength,clench=Math.sin(p*Math.PI);
        at('shadePalm',h.s,h.x,.025,0,1,0,0,[h.halfWidth,grow,h.halfLength]);
        for(let i=-2;i<=2;i++){
          const tip=i===-2?.72:i===0?1.05:.91;
          at('shadeFinger',h.s-.12,h.x+i*.22*h.halfWidth,grow*(1.12-Math.abs(i)*.06),
            -i*.13,1,-i*.14,.14+.70*clench,[h.halfWidth*.85,grow*tip,h.halfLength*tip]);
        }
      }
    }else{
      const y=h.bottom+.035*Math.sin(time*6),yaw=h.yaw-Math.PI,drop=h.active?Math.sin(p*Math.PI):0;
      at('shadeHuntress',h.s,h.x,y,yaw,alpha,0,-drop*.15);
      for(const side of [-1,1])at('shadeVeil'+side,h.s,h.x,y,yaw,alpha*.92,side*(.10+.24*Math.sin(time*5.4)), -drop*.15);
    }
  }
  root.AcornDarknessHazardsArt={meshes,scene};
})(typeof globalThis==='object'?globalThis:this);
