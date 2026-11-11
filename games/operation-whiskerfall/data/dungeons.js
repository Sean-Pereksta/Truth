(function(){
  'use strict';
  const W=window.OW,C=W.Content;
  const puzzles=['echo','mirrors','conduit','constellation'];
  const guardians=[
    {name:'Gravelback, the Iron Rat',kind:'rat',color:'#d4af7b',hint:'Watch the walls: long armored rolls ricochet around the chamber. Dodge across the roll, leave the slam circle, and cross the expanding rock ring after impact. Punish the brief recovery; later phases chain separately warned rolls.'},
    {name:'The Gloamwing',kind:'bat',color:'#a5d5ef',hint:'Cross its committed swoop, slip between the icicle fan, and keep moving away from staggered falling-ice circles. Every attack leaves a recovery opening.'},
    {name:'Mother Briar',kind:'spider',color:'#b2d38b',hint:'Leave venom blooms, avoid slowing web snares, and clear her bounded brood before it surrounds you. Her aimed venom fans and shorter late-phase recoveries punish standing still.'},
    {name:'The Hollow King',kind:'burrower',color:'#d2a6f4',hint:'Move off the violet seal before the delayed emergence strike, cross the marked burrow rift sideways, and dodge the void fan. The king commits to every marked target before attacking.'}
  ];
  W.DungeonGuardians=guardians;
  C.dungeons=[];
  C.regions.forEach((r,i)=>{for(let j=0;j<2;j++){
    const n=i*2+j,id='cave_'+i+'_'+j,guardian=n%4,puzzle=puzzles[(i+j)%4];
    const config={id,region:i,variant:j,puzzle,guardian,level:r.level+j+1,questId:'vault_'+i+'_'+j,
      sequence:[(i+j)%4,(i+j+2)%4,(i+j+1)%4,(i+j+3)%4],
      title:['Echoes Below','A Light in the Deep','The Broken Waterworks','The Starless Vault'][puzzles.indexOf(puzzle)]};
    C.dungeons.push(config);
    const npc=C.npcs.find(p=>p.townId==='town_'+i&&p.resident)||C.npcs.find(p=>p.townId==='town_'+i);
    const q={id:config.questId,title:config.title+' · '+r.name+(j?' Depths':''),description:'Investigate the sealed cavern, decipher its visible mechanism, defeat '+guardians[guardian].name+', and recover the guardian’s relic.',type:'dungeon',target:id,targetLocation:id,region:i,required:1,rewardGold:100+i*55,rewardXp:160+i*70,giverNpcId:npc?.id,main:false};
    C.quests.push(q);if(npc){npc.questIds=npc.questIds||[];npc.questIds.push(q.id);}
  }});
})();
