(function () {
  'use strict';
  const C=window.OW.Content;
  // Append-only identifiers keep every existing enemy and saved spawn intact.
  const additions=[
    {id:'harpooner',name:'Harpoon Skirmisher',hp:110,damage:15,speed:126,range:660,fireRate:.6,xp:49,role:'harpooner',artKey:'harpooner',color:'#73d4ca',attack:'leadHarpoon',hint:'The turquoise lane locks before the harpoon fires. A hit hooks and drags you toward the attacker. Dodge the shot, break sight or interrupt the skirmisher to snap the tether.'},
    {id:'bellringer',name:'Tempest Bellringer',hp:132,damage:12,speed:78,range:640,fireRate:.35,xp:56,role:'bellringer',artKey:'bellringer',color:'#ead678',attack:'stormChimes',hint:'Three gold storm circles strike in sequence. The bell rallies nearby patrols. Interrupt its cast or defeat it to stop the storm.'},
    {id:'shellguard',name:'Shellguard',hp:215,damage:18,speed:92,range:150,fireRate:.45,xp:63,role:'shellguard',artKey:'shellguard',color:'#93b6cc',attack:'shieldBash',hint:'Its shell shield blocks frontal damage. Dodge the marked bash, then strike its exposed recovery or circle behind it.'},
    {id:'tideblade',name:'Tideblade',hp:120,damage:14,speed:138,range:175,fireRate:.8,xp:54,role:'tideblade',artKey:'tideblade',color:'#e58d97',attack:'feintDoubleSlash',hint:'It keeps chasing, feints sideways, then swings twice. Keep moving through the second warning before punishing its recovery.'}
  ];
  C.coastalEnemyTypes={};
  additions.forEach((enemy,i)=>{
    const index=44+i;
    if(C.enemies[index]&&C.enemies[index].id!==enemy.id)throw new Error('Coastal enemy index collision: '+index);
    C.enemies[index]={...enemy,coastal:true};C.coastalEnemyTypes[enemy.id]=index;
  });
  if(!C.coastalScaling){
    const previous=C.enemyScaling;
    // These side regions follow their recommended levels (12 and 16).
    C.enemyScaling=function(region,legacy=false){const r=Number(region);return r===8?(legacy?{health:4.5,damage:3.15}:{health:8.9,damage:5.4}):r===9?(legacy?{health:7.8,damage:4.9}:{health:15.2,damage:8.4}):previous(region,legacy);};
    C.coastalScaling=true;
  }
})();
