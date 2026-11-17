/* Painted arms and field movement. Each attachment rotates about the live suit shoulder. */
(function(){
  'use strict';
  const W=window.OW, R=W.Renderer.prototype;
  const keys={gun:'fieldGunMotion',melee:'fieldMeleeMotion',scout:'fieldScoutMotion'};
  const paths={gun:'gun-motion',melee:'melee-motion',scout:'scout-motion'};
  const family={carbine:0,scatter:1,marksman:2,spool:3};
  const gunRows={rifle:0,smg:0,shotgun:1,sniper:2,lmg:3,pistol:4,rocket:5,flame:5,plasma:0};
  // Local end of the barrel on the six painted recoil poses, before the flash.
  const tips=[[221,24],[186,32],[228,35],[212,43],[172,27],[194,47]];
  const scoutShoulders=[[.58,.53],[.56,.55],[.59,.59],[.64,.64],[.54,.72],[.62,.73]];
  const scoutNecks=[[95,67],[94,68],[104,77],[118,88],[114,102],[119,103]];
  const scarfCache=new WeakMap();
  function scoutScarf(r,skin){
    if(!r.images.bodies||typeof document==='undefined')return null;
    let pair=scarfCache.get(r.images.bodies);
    if(!pair){pair=[];scarfCache.set(r.images.bodies,pair);}
    if(pair[skin])return pair[skin];
    // Trace the two starter scarves out of their original painted idle bodies.
    // Their trailing ends stay visible while the new sprint and roll frames turn.
    const cloth=document.createElement('canvas');cloth.width=89;cloth.height=38;
    const c=cloth.getContext('2d'),origin=skin?[30,590]:[33,50];
    c.translate(-12,-32);c.beginPath();
    for(const [i,[x,y]] of [[15,45],[20,39],[36,37],[47,40],[57,40],[64,43],[77,50],[98,54],[94,61],[87,66],[80,65],[70,61],[59,52],[53,51],[45,57],[37,61],[23,63],[16,60],[14,55]].entries())i?c.lineTo(x,y):c.moveTo(x,y);
    c.closePath();c.clip();c.drawImage(r.images.bodies,-origin[0],-origin[1]);
    pair[skin]=cloth;return cloth;
  }
  const lastShot=new WeakMap();
  function ready(r,type){
    const key=keys[type];if(!r?.images)return false;
    if(!r.images[key]&&typeof Image==='function'&&r.assetURL){
      const im=new Image();r.images[key]=im;im.src=r.assetURL('assets/fieldwork/'+paths[type]+'.webp');
    }
    const img=r.images[key];return !!(img?.complete&&img.naturalWidth);
  }
  function gunModel(w){
    if(!w)return null;
    const row=family[w.reconFamily]??gunRows[w.kind]??0;
    // Bespoke weapons retain their own measured arm or receiver silhouette.
    const attachment=w.art?'measured':w.reconArt!=null?(w.reconArt%2?'recon':'sheet'):['flame','plasma'].includes(w.kind)?'energy':'sheet';
    return {type:'gun',row,attachment};
  }
  function meleeModel(w){
    if(!w)return null;
    const name=w.name||'',row=/maul|hammer|pick/i.test(name)?1:/cleaver|axe|glaive/i.test(name)?3:/saber|sabre|scimitar|foil/i.test(name)?0:2;
    const attachment=w.reconArt!=null?(w.reconArt%2?'recon':'sheet'):/spear|trident|dual|knife|dagger|bayonet/i.test(name)?'measured':'sheet';
    return {type:'melee',row,attachment};
  }
  function gunPhase(p,time){
    const shot=lastShot.get(p);
    const age=shot&&shot.weapon===p.weapon?time-shot.time:Infinity;
    if(age>=0&&age<.055)return 1;
    if(p.reloading>0||p.anim==='reload')return 3;
    const t=p.anim==='shoot'?p.animTime??0:age;
    return t>=0&&t<.055?1:t>=0&&t<.16?2:0;
  }
  function meleePhase(p){
    if(p.anim!=='melee'&&p.anim!=='heavy')return 0;
    if(p.meleeStrike)return 1;
    const t=p.animTime||0,heavy=p.anim==='heavy',training=1+(p.skills?.melee||0)*.035;
    return t<(heavy?.23:.10)/training?1:t<(heavy?.43:.23)/training?2:3;
  }
  function scoutPose(base,e){
    if(base?.key!=='bodies'||base.row%3||base.col===0||base.col>5||e.equipment?.armor?.armorStyle||e.equipment?.armor?.reconSuit||e.equipment?.armor?.resistanceStyle||e.equipment?.armor?.expeditionStyle)return -1;
    return base.col===5?(e.dodgeTime>.10?4:5):base.col-1;
  }
  function source(r,e,isPlayer){
    if(!isPlayer)return null;
    const base=body.call(r,e,true),col=scoutPose(base,e);
    return col>=0&&ready(r,'scout')?{key:keys.scout,col,row:Number(base.row>=3),cols:6,rows:2,modular:true}:null;
  }
  const body=R.actorFrame;
  R.actorFrame=function(e,isPlayer){return source(this,e,isPlayer)||body.apply(this,arguments);};
  const sprite=R.sprite;
  R.sprite=function(key,col,row,cols,rows,x,y,w,h,opts){
    if(key!==keys.scout)return sprite.apply(this,arguments);
    const [sx,sy,sw,sh]=W.FieldMotion.scout[row][col],scale=68/128;
    sprite.call(this,key,col,row,cols,rows,x,y,sw*scale,sh*scale,{...opts,sx,sy,sw,sh,px:.5,py:.97});
    const cloth=scoutScarf(this,row);if(!cloth)return;
    const c=this.ctx,[nx,ny]=scoutNecks[col],fabric=col===4?.39:.45;
    c.save();c.translate(x,y);if(opts?.angle)c.rotate(opts.angle);if(opts?.flip)c.scale(-1,1);
    if(opts?.alpha!=null)c.globalAlpha*=opts.alpha;
    c.translate((nx-.5*sw)*scale,(ny-.97*sh)*scale);
    c.rotate(col===4?.5:col>=3?.16:0);c.drawImage(cloth,-82*fabric,-24*fabric,89*fabric,38*fabric);c.restore();
  };
  const joint=R.playerShoulder;
  R.playerShoulder=function(e,jump=0){
    const f=source(this,e,true);if(!f)return joint.apply(this,arguments);
    const [,,sw,sh]=W.FieldMotion.scout[f.row][f.col],[px,py]=scoutShoulders[f.col],scale=68/128;
    const sign=Math.cos(e.angle||0)<0?-1:1,dx=(px-.5)*sw*scale*sign,dy=(py-.97)*sh*scale;
    const lean=f.col>=4?Math.sin(this.clock*30)*.13:0;
    return {x:e.x+dx*Math.cos(lean)-dy*Math.sin(lean),y:e.y+3-jump+dx*Math.sin(lean)+dy*Math.cos(lean),row:f.row*3,col:Math.min(5,f.col+1)};
  };
  function spec(e){
    const blade=e.anim==='melee'||e.anim==='heavy';
    return blade?meleeModel(W.Content.melee[e.melee]):gunModel(W.Content.weapons[e.weapon]);
  }
  const originalPose=R.playerArmPose;
  R.playerArmPose=function(e,size,jump){
    const p=originalPose.apply(this,arguments),s=spec(e);if(!s)return p;
    const col=p.melee?meleePhase(e):gunPhase(e,this.game?.time||0),sign=p.flip?-1:1;
    // Rotate original bespoke art as well. Its muzzle queries use this same pose.
    const turn=p.melee?(s.attachment==='sheet'?-.42:[0,-.12,.07,.13][col]):[0,-.055,.045,.075][col];
    return {...p,rotation:p.rotation+turn*sign};
  };
  const armDraw=R.drawPlayerArms;
  R.drawPlayerArms=function(e,size,jump){
    if(e.downed||e.anim==='death')return;
    const s=spec(e);if(!s||!ready(this,s.type))return armDraw.apply(this,arguments);
    const melee=s.type==='melee',col=melee?meleePhase(e):gunPhase(e,this.game?.time||0),p=this.playerArmPose(e,size,jump);
    if(s.attachment!=='sheet'){
      armDraw.apply(this,arguments);
      // Keep the individually painted receiver and animate its support hand and
      // reload payload from the same four action cells as the matching family.
      const c=this.ctx,[sx,sy]=W.FieldMotion[s.type][s.row][col],scale=size/77;
      const grip=melee?[27,80,18,15]:col===3?[57,40,23,19]:[43,66,20,18];
      const reach=melee?7:s.attachment==='measured'?12:8;
      c.save();c.translate(p.x,p.y);c.rotate(p.rotation);if(p.flip)c.scale(-1,1);
      c.globalAlpha=e.invuln>0&&Math.floor(this.clock*18)%2===0?.5:1;
      c.drawImage(this.images[keys[s.type]],sx+grip[0],sy+grip[1],grip[2],grip[3],(reach+(col===2?2:0))*scale,(col===1?-1:0)*scale,9*scale,8*scale);
      if(!melee&&col===3){
        const payload=s.row===5?[139,85,55,22]:s.row===4?[80,87,21,22]:[113,85,31,22];
        c.drawImage(this.images[keys.gun],sx+payload[0],sy+payload[1],payload[2],payload[3],17*scale,6*scale,payload[2]*.33*scale,payload[3]*.33*scale);
      }
      c.restore();
      return;
    }
    const [sx,sy,sw,sh]=W.FieldMotion[s.type][s.row][col],scale=(melee?.42:.278)*size/77;
    const alpha=e.invuln>0&&Math.floor(this.clock*18)%2===0?.5:1;
    this.sprite(keys[s.type],col,s.row,4,melee?4:6,p.x,p.y,sw*scale,sh*scale,{sx,sy,sw,sh,angle:p.rotation,flip:p.flip,px:melee?.23:.18,py:melee?.62:.37,alpha});
    if(e.charge>0&&!melee){const power=Math.min(1,e.charge/(W.Content.weapons[e.weapon]?.chargeTime||.85));this.sprite('items',4,3,8,4,p.x+Math.cos(e.angle)*43,p.y+Math.sin(e.angle)*43,13+power*14,13+power*14,{angle:this.clock*3,alpha:Math.max(.25,power*.85)});}
  };
  function muzzle(renderer,p){
    const weapon=W.Content.weapons[p.weapon],s=gunModel(weapon);
    if(!s||!renderer?.playerArmPose)return null;
    if(s.attachment==='measured')return W.ExpeditionArt?.muzzle(renderer,p,true)||W.ResistanceArt?.muzzle(renderer,p,true)||null;
    const jump=Math.max(0,p.jumpHeight||0),pose=renderer.playerArmPose({...p,anim:'shoot',animTime:0,reloading:0},77,jump);
    let dx,dy;const height=30+jump;
    if(s.attachment==='recon'){
      if(!W.ReconGearArt||!renderer.images.reconWeapons)return null;
      const [,,sw,sh]=W.ReconGearArt.crops.weapons[weapon.reconArt];
      const [tx,ty]=[[244,24],[243,20],[243,34],[243,70]][(weapon.reconArt-1)/2];
      dx=(tx-sw*.14)*62/sw;dy=(ty-sh*.53)*62/sw;
    }else if(s.attachment==='energy'){
      if(!renderer.images.arms)return null;
      const [tx,ty]=[[240,43],[240,45],[240,43],[243,49],[239,45],[240,43]][pose.row];
      dx=(tx/pose.sw-pose.px)*pose.w;dy=(ty/140-pose.py)*pose.h;
    }else{
      if(!ready(renderer,'gun'))return null;
      const [tx,ty]=tips[s.row];dx=(tx-256*.18)*.278;dy=(ty-118*.37)*.278;
    }
    if(pose.flip)dx=-dx;
    return {x:pose.x+dx*Math.cos(pose.rotation)-dy*Math.sin(pose.rotation),y:pose.y+dx*Math.sin(pose.rotation)+dy*Math.cos(pose.rotation)+height,visualHeight:height};
  }
  W.FieldMotionArt={gunModel,meleeModel,gunPhase,meleePhase,scoutPose,muzzle,record(p,time){lastShot.set(p,{time,weapon:p.weapon});}};
}());
