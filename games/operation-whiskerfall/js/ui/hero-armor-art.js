(function(){
  'use strict';
  const W=window.OW,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  // Crops preserve complete tails, cloaks and the dodge noses that cross a cell
  // boundary. Shoulder joints are measured in the original source artwork.
  const measured={"stormrunner":{"width":1254,"height":1254,"frames":[{"crop":[40,40,237,272],"anchor":[174.05,307],"shoulder":[161,179],"coreHeight":262},{"crop":[347,47,249,264],"anchor":[488.05,307],"shoulder":[475,181],"coreHeight":256},{"crop":[650,46,251,262],"anchor":[804.05,303],"shoulder":[791,181],"coreHeight":252},{"crop":[955,51,262,265],"anchor":[1114.05,311],"shoulder":[1101,183],"coreHeight":256},{"crop":[35,345,263,261],"anchor":[190.05,601],"shoulder":[177,475],"coreHeight":251},{"crop":[347,413,284,190],"anchor":[529.05,599],"shoulder":[516,529],"coreHeight":182},{"crop":[657,336,254,273],"anchor":[795.05,604],"shoulder":[782,470],"coreHeight":264},{"crop":[937,478,301,124],"anchor":[1087,597],"shoulder":[1085,544],"coreHeight":115},{"crop":[40,648,241,277],"anchor":[177.81,921],"shoulder":[163,791],"coreHeight":269},{"crop":[344,660,257,264],"anchor":[490.81,919],"shoulder":[476,793],"coreHeight":254},{"crop":[649,654,257,269],"anchor":[805.81,918],"shoulder":[791,796],"coreHeight":259},{"crop":[954,659,266,268],"anchor":[1117.81,922],"shoulder":[1103,798],"coreHeight":258},{"crop":[33,946,267,268],"anchor":[192.81,1210],"shoulder":[178,1081],"coreHeight":260},{"crop":[342,1013,290,197],"anchor":[531.81,1206],"shoulder":[517,1137],"coreHeight":188},{"crop":[656,939,255,276],"anchor":[796.81,1211],"shoulder":[782,1081],"coreHeight":267},{"crop":[937,1092,302,125],"anchor":[1087.5,1213],"shoulder":[1085,1155],"coreHeight":116}]},"bastion":{"width":1254,"height":1254,"frames":[{"crop":[38,51,232,263],"anchor":[172.7,309],"shoulder":[149,180],"coreHeight":254},{"crop":[336,55,261,260],"anchor":[488.7,310],"shoulder":[465,182],"coreHeight":250},{"crop":[645,53,249,263],"anchor":[794.7,312],"shoulder":[771,180],"coreHeight":254},{"crop":[957,60,261,255],"anchor":[1113.7,310],"shoulder":[1090,185],"coreHeight":246},{"crop":[34,357,248,263],"anchor":[184.7,615],"shoulder":[161,484],"coreHeight":254},{"crop":[337,433,292,173],"anchor":[509.7,602],"shoulder":[486,525],"coreHeight":165},{"crop":[667,348,237,267],"anchor":[802.7,611],"shoulder":[779,469],"coreHeight":258},{"crop":[945,467,291,137],"anchor":[1090,599],"shoulder":[1087,546],"coreHeight":128},{"crop":[41,650,235,270],"anchor":[175.58,915],"shoulder":[149,792],"coreHeight":260},{"crop":[339,658,258,262],"anchor":[491.58,915],"shoulder":[465,792],"coreHeight":253},{"crop":[646,658,253,263],"anchor":[797.58,916],"shoulder":[771,789],"coreHeight":254},{"crop":[957,669,262,255],"anchor":[1116.58,919],"shoulder":[1090,799],"coreHeight":245},{"crop":[30,951,257,269],"anchor":[185.58,1215],"shoulder":[159,1083],"coreHeight":259},{"crop":[334,1023,295,182],"anchor":[512.58,1200],"shoulder":[486,1128],"coreHeight":172},{"crop":[664,945,243,269],"anchor":[805.58,1210],"shoulder":[779,1080],"coreHeight":260},{"crop":[941,1075,295,133],"anchor":[1088,1204],"shoulder":[1087,1150],"coreHeight":124}]},"spellweaver":{"width":1254,"height":1254,"frames":[{"crop":[12,50,245,259],"anchor":[152.35,304],"shoulder":[143,177],"coreHeight":249},{"crop":[326,50,242,258],"anchor":[460.35,303],"shoulder":[451,175],"coreHeight":248},{"crop":[641,50,249,259],"anchor":[780.35,304],"shoulder":[771,178],"coreHeight":249},{"crop":[946,66,286,246],"anchor":[1120.35,308],"shoulder":[1111,186],"coreHeight":237},{"crop":[25,368,259,247],"anchor":[171.35,610],"shoulder":[162,484],"coreHeight":237},{"crop":[330,432,292,181],"anchor":[502.35,608],"shoulder":[493,539],"coreHeight":171},{"crop":[655,343,256,273],"anchor":[795.35,611],"shoulder":[786,472],"coreHeight":263},{"crop":[940,478,300,132],"anchor":[1089.5,605],"shoulder":[1091,544],"coreHeight":122},{"crop":[12,658,245,263],"anchor":[151.02,916],"shoulder":[143,792],"coreHeight":253},{"crop":[326,657,242,262],"anchor":[459.02,914],"shoulder":[451,789],"coreHeight":252},{"crop":[640,656,250,260],"anchor":[779.02,912],"shoulder":[771,789],"coreHeight":251},{"crop":[949,677,284,247],"anchor":[1119.02,920],"shoulder":[1111,801],"coreHeight":239},{"crop":[25,973,258,244],"anchor":[170.02,1213],"shoulder":[162,1100],"coreHeight":235},{"crop":[330,1033,292,181],"anchor":[501.02,1210],"shoulder":[493,1144],"coreHeight":172},{"crop":[653,947,256,270],"anchor":[794.02,1212],"shoulder":[786,1081],"coreHeight":260},{"crop":[939,1082,301,129],"anchor":[1089,1207],"shoulder":[1091,1155],"coreHeight":120}]}};
  const styles={
    stormrunner:{key:'heroArmorStormrunner',path:'assets/armor/stormrunner.png',name:'Stormrunner',armSet:1,trim:'#65b7bd',shadow:'#294d58'},
    bastion:{key:'heroArmorBastion',path:'assets/armor/bastion.png',name:'Bastion',armSet:2,trim:'#bd8a3e',shadow:'#594528'},
    spellweaver:{key:'heroArmorSpellweaver',path:'assets/armor/spellweaver.png',name:'Spellweaver',armSet:1,trim:'#a995d1',shadow:'#443553'}
  };
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const assetURL=path=>W.config?.assetBaseURL?W.config.assetBaseURL.replace(/\/$/,'')+'/'+path.replace(/^assets\//,''):path;
  const imageReady=image=>!!image&&image.complete!==false&&(image.naturalWidth===undefined||image.naturalWidth>0)&&(image.width===undefined||image.width>0);
  function styleFor(value){
    let item=value?.equipment?value.equipment.armor:value;
    if(typeof item==='string'){if(styles[item])return item;item=W.Content?.equipment?.find(e=>e.id===item);}
    const style=item?.armorStyle||W.Content?.equipment?.find(e=>e.id===item?.id)?.armorStyle;
    return styles[style]?style:null;
  }
  function poseFor(actor,clock=0){
    if(actor.downed||actor.anim==='death')return 7;
    if(actor.anim==='hurt')return 6;
    if(actor.dodgeTime>0||actor.anim==='dodge')return 5;
    const moving=Math.hypot(actor.velocityX||0,actor.velocityY||0)>8||['run','walk'].includes(actor.anim)||['patrol','chase','flank'].includes(actor.state);
    return moving?1+Math.floor((actor.moveTime??clock+(typeof actor.id==='number'?actor.id*.17:0))*11)%4:0;
  }
  function frame(value,skin=0,pose=0){
    const style=styleFor(value),sheet=measured[style];if(!sheet)return null;
    skin=Math.abs(Math.floor(skin||0))%2;pose=clamp(Math.floor(pose||0),0,7);const index=skin*8+pose;
    return {...sheet.frames[index],style,skin,pose,index,col:index%4,row:Math.floor(index/4),sourceWidth:sheet.width,sourceHeight:sheet.height,scale:68/sheet.frames[skin*8].coreHeight};
  }
  function markup(item,options={}){
    const f=frame(item,options.skin,options.pose);if(!f)return '';
    const style=styles[f.style],name=item?.name||style.name+' armor',title=name+(options.variant==='icon'?'':' — illustrated armor'),crop=f.crop.join(' ');
    return `<span class="${escape(options.className||'hero-armor-art')}" data-armor-art="${f.style}" style="display:inline-flex;align-items:center;justify-content:center;background:none;overflow:visible"><svg viewBox="${crop}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escape(title)}" style="display:block;width:100%;height:100%;overflow:hidden"><title>${escape(title)}</title><image href="${escape(assetURL(style.path))}" width="${f.sourceWidth}" height="${f.sourceHeight}"/></svg></span>`;
  }
  function draw(renderer,item,x,y,width,height,options={}){
    const f=frame(item,options.skin,options.pose),style=f&&styles[f.style];if(!f||!imageReady(renderer.images?.[style.key])||typeof renderer.sprite!=='function')return false;
    const [sx,sy,sw,sh]=f.crop,scale=Math.min(width/sw,height/sh),c=renderer.ctx;
    c.save();c.translate(x,y);if(options.angle)c.rotate(options.angle);if(options.flip)c.scale(-1,1);if(options.alpha!==undefined)c.globalAlpha*=options.alpha;
    c.drawImage(renderer.images[style.key],sx,sy,sw,sh,-sw*scale*(options.px??.5),-sh*scale*(options.py??.5),sw*scale,sh*scale);c.restore();return true;
  }
  W.HeroArmorArt={styles,measured,styleFor,frame,poseFor,markup,draw,assetURL};
  W.Assets=W.Assets||{};for(const style of Object.values(styles))W.Assets[style.key]=style.path;
  const R=W.Renderer?.prototype;
  if(typeof R?.actorFrame==='function'){
    const actorFrame=R.actorFrame;
    R.actorFrame=function(actor,isPlayer,...args){
      const style=isPlayer&&styleFor(actor);
      if(!style||!imageReady(this.images[styles[style].key]))return actorFrame.call(this,actor,isPlayer,...args);
      const f=frame(style,actor.skin,poseFor(actor,this.clock));
      return {key:styles[style].key,col:f.col,row:f.row,cols:4,rows:4,modular:true,heroArmor:true,armorStyle:style,pose:f.pose,skin:f.skin};
    };
    const sprite=R.sprite;
    R.sprite=function(key,col,row,cols,rows,x,y,width,height,options){
      const style=Object.keys(styles).find(name=>styles[name].key===key);
      if(!style||cols!==4||rows!==4)return sprite.apply(this,arguments);
      const f=frame(style,row>=2?1:0,(row%2)*4+col),[sx,sy,sw,sh]=f.crop;
      return sprite.call(this,key,col,row,cols,rows,x,y,sw*f.scale,sh*f.scale,{...options,sx,sy,sw,sh,px:(f.anchor[0]-sx)/sw,py:(f.anchor[1]-sy)/sh});
    };
    const shoulder=R.playerShoulder;
    R.playerShoulder=function(actor,jumpHeight=0){
      const style=styleFor(actor);
      if(!style||!imageReady(this.images[styles[style].key]))return shoulder.call(this,actor,jumpHeight);
      const f=frame(style,actor.skin,poseFor(actor,this.clock)),flip=Math.cos(actor.angle||0)<0,dx=(f.shoulder[0]-f.anchor[0])*f.scale*(flip?-1:1),dy=(f.shoulder[1]-f.anchor[1])*f.scale;
      const lean=actor.dodgeTime>0||actor.anim==='dodge'?Math.sin(this.clock*30)*.13:0;
      return {x:actor.x+dx*Math.cos(lean)-dy*Math.sin(lean),y:actor.y+3-jumpHeight+dx*Math.sin(lean)+dy*Math.cos(lean),row:f.skin*3+styles[style].armSet,col:Math.min(f.pose,6)};
    };
    const arms=R.drawPlayerArms;
    R.drawPlayerArms=function(actor,size,jumpHeight){
      const style=styleFor(actor);
      if(style&&imageReady(this.images[styles[style].key])&&imageReady(this.images.arms)&&!actor.downed&&actor.anim!=='death'){
        const p=this.playerShoulder(actor,jumpHeight),c=this.ctx;c.save();c.globalAlpha=actor.invuln>0&&Math.floor(this.clock*18)%2===0?.5:1;c.fillStyle=styles[style].shadow;c.strokeStyle=styles[style].trim;c.lineWidth=1.2;c.beginPath();c.ellipse(p.x,p.y,5.4,6.2,-.2,0,Math.PI*2);c.fill();c.stroke();c.restore();
      }
      return arms.call(this,actor,size,jumpHeight);
    };
  }
  const U=W.UI?.prototype;
  if(typeof U?.icon==='function'){
    const icon=U.icon;
    U.icon=function(item,large=false){
      const style=styleFor(item),renderer=this.game?.renderer;
      if(!style||renderer?.ready&&!imageReady(renderer.images?.[styles[style].key]))return icon.apply(this,arguments);
      return markup(item,{skin:this.player?.()?.skin||0,className:'item-icon hero-armor-art'+(large?' large':''),variant:'icon'});
    };
  }
})();
