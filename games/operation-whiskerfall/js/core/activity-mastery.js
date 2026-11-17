(function(){
  'use strict';
  const W=window.OW,C=W.Content,G=W.Game.prototype,U=W.UI.prototype;
  const byActivity=new Map(C.activityMasterworks.map(item=>[item.activityMastery,item]));
  const wearing=p=>p?.equipment?.accessory?.activityMastery;
  function qualifies(id,m,i){
    if(!m||m.practice)return false;
    switch(id){
      case 'lantern':return ['ai3','versus'].includes(m.mode)&&m.winner===i&&m.signals?.[i]>=4;
      case 'quarry':return m.won===true&&m.tier===3;
      case 'bay':{
        const line=m.lines?.[i];
        return !!line&&((m.mode==='fish'&&line.count>=8)||(line.count>=3&&line.bestThree>=7));
      }
      case 'yard':return m.level===3&&m.deliveries===3&&m.crashes===0&&m.beats>0&&m.beats<=12;
      case 'wind':{const heat=m.heats?.[i];return heat?.rings===6&&heat.penalty===0&&heat.time>0&&heat.time<120;}
      default:return false;
    }
  }
  function description(id){
    const item=byActivity.get(id);
    return item?item.name+' · '+item.requirement+' '+item.description:'';
  }
  function settle(g,id,performance,eligible){
    const item=byActivity.get(id),grants=[];
    if(!item||!performance||performance.practice||!Array.isArray(eligible))return grants;
    for(const i of new Set(eligible)){
      if(!Number.isInteger(i)||i<0||i>1||!qualifies(id,performance,i))continue;
      const hero=g.players.find(p=>p.id===i)||(g.reservePlayer?.id===i?g.reservePlayer:null);
      if(!hero)continue;
      const owned=hero.inventory.some(v=>(v.id||v)===item.id);
      if(owned)continue;
      hero.inventory.push({id:item.id,upgrade:0});
      grants.push('P'+(i+1)+' earned '+item.name);
    }
    return grants;
  }
  const weapon=G.weapon;G.weapon=function(p){
    const gun=weapon.apply(this,arguments),id=wearing(p);
    if(id==='yard')return {...gun,reload:gun.reload*.8};
    if(id==='lantern'&&Math.hypot(p.velocityX||0,p.velocityY||0)<12)return {...gun,spread:(gun.spread??.04)*.65,range:gun.range*1.12};
    return gun;
  };
  const dodge=G.armorDodge;G.armorDodge=function(p){
    const used=dodge.apply(this,arguments);if(wearing(p)==='wind')p.cooldowns.dodge*=.82;return used;
  };
  const dress=G.useConsumable;G.useConsumable=function(p){
    const hero=typeof p==='number'?this.players[p]:(p||this.players[0]),used=dress.apply(this,arguments);
    if(used&&wearing(hero)==='bay'){
      hero.hp=Math.min(hero.maxHp,hero.hp+hero.maxHp*.15);
      for(const ally of this.players)if(ally!==hero&&!ally.downed&&Math.hypot(ally.x-hero.x,ally.y-hero.y)<=235){
        ally.hp=Math.min(ally.maxHp,ally.hp+ally.maxHp*.08);this.effect('heal',ally.x,ally.y,60,.4);
      }
    }
    return used;
  };
  const impact=W.ReconGear.bladeImpact;W.ReconGear.bladeImpact=function(g,p,e,blade,swing){
    return impact.apply(this,arguments)*(wearing(p)==='quarry'&&swing.finisher?1.2:1);
  };
  const icon=U.icon;U.icon=function(item,large){
    if(!item?.activityMastery)return icon.apply(this,arguments);
    const src=W.HeroArmorArt?.assetURL(item.art)||item.art;
    return '<span class="item-icon'+(large?' large-icon':'')+'" style="background:none"><img alt="" src="'+src+'" style="width:100%;height:100%;object-fit:contain"></span>';
  };
  W.ActivityMastery={settle,description,qualifies};
}());
