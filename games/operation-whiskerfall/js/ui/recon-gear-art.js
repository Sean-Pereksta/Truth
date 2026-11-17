(function(){
  'use strict';
  const W=window.OW, R=W.Renderer.prototype, U=W.UI.prototype;
  // Packed pixel coordinates. Full source-space measurements accompany the sheets.
  const crops={"weapons":[[6,74,244,107],[262,88,244,80],[518,78,244,100],[774,79,244,98],[6,345,244,78],[262,343,244,82],[518,328,244,112],[774,322,244,124],[6,591,244,98],[262,606,244,67],[518,576,244,127],[774,584,244,112]],"suits":[[22,6,211,244],[277,6,214,244],[535,6,210,244],[789,6,214,244],[23,262,210,244],[278,262,212,244],[535,262,210,244],[789,262,214,244],[22,518,212,244],[278,518,212,244],[534,518,211,244],[791,518,210,244],[22,774,212,244],[278,774,212,244],[534,774,211,244],[791,774,209,244]]};
  const paths={suits:'assets/recon/recon-suits.webp',weapons:'assets/recon/recon-weapons.webp'};
  W.Assets.reconSuits=paths.suits;W.Assets.reconWeapons=paths.weapons;
  const ready=im=>im&&(im.complete!==false)&&im.naturalWidth!==0;
  const atlasIndex=(item,skin)=>item.reconSuit?Math.floor(item.reconArt/4)*8+(skin%2)*4+(item.reconArt%4):item.reconArt;
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function icon(item,skin=0){
    const suit=!!item.reconSuit,type=suit?'suits':'weapons',box=crops[type][atlasIndex(item,skin)];
    if(!box)return '';
    const path=W.HeroArmorArt?.assetURL(paths[type])||paths[type];
    return '<svg viewBox="0 0 '+box[2]+' '+box[3]+'" role="img" aria-label="'+escape(item.name)+'" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block"><svg width="'+box[2]+'" height="'+box[3]+'" viewBox="'+box.join(' ')+'" overflow="hidden"><image href="'+escape(path)+'" width="1024" height="'+(suit?1024:768)+'"/></svg></svg>';
  }
  const oldIcon=U.icon;
  U.icon=function(item,large){
    if(item?.reconArt==null)return oldIcon.apply(this,arguments);
    return '<span class="item-icon'+(large?' large-icon':'')+'" style="background:none;display:inline-block">'+icon(item,this.player()?.skin||0)+'</span>';
  };
  function suit(actor){return actor.equipment?.armor?.reconSuit?actor.equipment.armor:null;}
  function body(actor){return atlasIndex(suit(actor),actor.skin||0);}
  const actionCrops={"run":[[6,8,180,176],[198,10,180,172],[390,8,180,175],[582,8,180,175],[6,200,180,176],[198,202,180,172],[390,200,180,175],[582,201,180,174],[6,393,180,174],[198,391,180,177],[390,393,180,174],[582,391,180,177],[6,584,180,175],[198,585,180,174],[390,585,180,174],[582,584,180,176]],"strike":[[774,16,180,160],[966,15,180,162],[1158,15,180,162],[1350,17,180,158],[774,208,180,160],[966,207,180,161],[1158,206,180,163],[1350,208,180,159],[774,399,180,161],[966,400,180,160],[1158,400,180,160],[1350,400,180,160],[774,592,180,160],[966,592,180,160],[1158,592,180,160],[1350,592,180,160]],"dodge":[[6,809,180,109],[198,810,180,108],[390,812,180,103],[582,810,180,107],[6,1000,180,111],[198,1002,180,108],[390,1004,180,103],[582,1002,180,107],[6,1192,180,112],[198,1190,180,115],[390,1195,180,105],[582,1193,180,110],[6,1384,180,111],[198,1382,180,115],[390,1388,180,104],[582,1385,180,110]],"down":[[774,825,180,77],[966,825,180,77],[1158,826,180,75],[1350,825,180,78],[774,1018,180,76],[966,1017,180,77],[1158,1018,180,75],[1350,1017,180,78],[774,1210,180,75],[966,1209,180,77],[1158,1209,180,77],[1350,1209,180,78],[774,1403,180,74],[966,1401,180,77],[1158,1402,180,76],[1350,1400,180,79]]}; // FITTED_ACTION_CROPS
  paths.actions='assets/recon/suit-actions.webp';
  const loading=new WeakSet();
  function loadActions(renderer){
    if(loading.has(renderer))return;
    loading.add(renderer);
    const im=new Image();
    im.onload=()=>{renderer.images.reconSuitActions=im;};
    im.src=renderer.assetURL(paths.actions);
  }
  function bodyPose(actor){
    const pose=W.HeroArmorArt?.poseFor(actor)||0;
    if(pose>=5)return pose;
    if((['melee','heavy','shoot'].includes(actor.anim))&&actor.animTime<.20)return 8;
    return pose;
  }
  // Height in world pixels and relative foot/shoulder anchors. Changing a
  // body's crouch or lean moves the attachment through the same transform.
  const poses={
    idle:{height:68,foot:[.54,.98],shoulder:[.63,.46]},
    run:{height:62,foot:[.53,.97],shoulder:[.51,.51]},
    strike:{height:59,foot:[.53,.97],shoulder:[.56,.51]},
    dodge:{height:44,foot:[.52,.95],shoulder:[.54,.65]},
    down:{height:27,foot:[.5,.9],shoulder:[.70,.61]}
  };
  function fit(renderer,pose,row){
    let name=pose===8||pose===6?'strike':pose===7?'down':pose===5?'dodge':pose===1||pose===3?'run':'idle';
    if(!ready(renderer.images.reconSuitActions)||!actionCrops[name])name='idle';
    const geometry=poses[name],crop=(actionCrops[name]||crops.suits)[row];
    const scale=Math.min(geometry.height/crop[3],(name==='down'?77:name==='dodge'?83:92)/crop[2]);
    return {name,geometry,crop,scale,dx:pose===5?2:0,dy:pose===1||pose===3?-1:0,turn:pose===6?-.12:0};
  }
  const actorFrame=R.actorFrame;
  R.actorFrame=function(e,isPlayer){
    if(!isPlayer||!suit(e)||!ready(this.images.reconSuits))return actorFrame.apply(this,arguments);
    loadActions(this);
    return {key:'reconSuits',col:bodyPose(e),row:body(e),cols:8,rows:16,modular:true};
  };
  const sprite=R.sprite;
  R.sprite=function(key,col,row,cols,rows,x,y,w,h,opts){
    if(key!=='reconSuits'||rows!==16)return sprite.apply(this,arguments);
    const pose=fit(this,col,row),[sx,sy,sw,sh]=pose.crop,[px,py]=pose.geometry.foot,sign=opts?.flip?-1:1;
    return sprite.call(this,pose.name==='idle'?key:'reconSuitActions',col,row,cols,rows,x+pose.dx*sign,y+pose.dy,sw*pose.scale,sh*pose.scale,{...opts,sx,sy,sw,sh,px,py,angle:(opts.angle||0)+pose.turn*sign});
  };
  const shoulder=R.playerShoulder;
  R.playerShoulder=function(e,jump=0){
    if(!suit(e)||!ready(this.images.reconSuits))return shoulder.apply(this,arguments);
    const pose=bodyPose(e),o=fit(this,pose,body(e)),sign=Math.cos(e.angle||0)<0?-1:1;
    const turn=o.turn*sign+(pose===5?Math.sin(this.clock*30)*.13:0),[,,w,h]=o.crop;
    const joint=o.geometry.shoulder,foot=o.geometry.foot;
    const dx=(joint[0]-foot[0])*w*o.scale*sign,dy=(joint[1]-foot[1])*h*o.scale;
    return {x:e.x+o.dx*sign+dx*Math.cos(turn)-dy*Math.sin(turn),y:e.y+3-jump+o.dy+dx*Math.sin(turn)+dy*Math.cos(turn),row:(e.skin%2)*3+(suit(e).role==='Heavy'?2:1),col:Math.min(pose,6)};
  };
  const arms=R.drawPlayerArms;
  R.drawPlayerArms=function(e,size,jump){
    const melee=e.anim==='melee'||e.anim==='heavy',weapon=melee?W.Content.melee[e.melee]:W.Content.weapons[e.weapon];
    if(weapon?.reconArt==null||!ready(this.images.reconWeapons))return arms.apply(this,arguments);
    if(e.downed||e.anim==='death')return;
    const p=this.playerArmPose(e,size,jump),[sx,sy,sw,sh]=crops.weapons[weapon.reconArt],c=this.ctx;
    const scale=(melee?57:62)*size/77/sw;
    c.save();c.translate(p.x,p.y);c.rotate(p.rotation);if(p.flip)c.scale(-1,1);
    c.globalAlpha=e.invuln>0&&Math.floor(this.clock*18)%2===0?.5:1;
    c.drawImage(this.images.reconWeapons,sx,sy,sw,sh,-sw*scale*.14,-sh*scale*.53,sw*scale,sh*scale);
    // The glove crop comes from the same hero and cloth color as the suit.
    // Its painted edge sits above the rear grip as the complete weapon rotates.
    if(ready(this.images.reconSuits)){
      const glove=crops.suits[suit(e)?body(e):(e.skin||0)%2*4];
      c.drawImage(this.images.reconSuits,glove[0]+glove[2]*.815,glove[1]+glove[3]*.365,glove[2]*.155,glove[3]*.11,4,-3,9,7);
    }
    c.restore();
  };
  W.ReconGearArt={crops,paths,icon,atlasIndex,actionCrops,poses};
}());
