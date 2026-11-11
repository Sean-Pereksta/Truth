(function(){
  'use strict';
  const C=window.OW.Content;
  const additions=[
    {id:'blackglass_reaver',name:'Blackglass Reaver',role:'blackglassreaver',artKey:'blackglassReaver',hp:155,damage:17,speed:140,range:600,fireRate:.6,xp:75,color:'#bd9af4',attack:'returningCrescents',hint:'Violet curves lock before two crescent blades sweep outward and circle back. Avoid both sides of the arc, then close in during the catch.'},
    {id:'cinder_mortar',name:'Cinder Mortar Rat',role:'cindermortar',artKey:'cinderMortar',hp:190,damage:20,speed:88,range:780,fireRate:.35,xp:82,color:'#edac63',attack:'bouncingCinderShell',hint:'The mortar marks four landing spots. A high arcing shell rebounds three times before bursting into a burning crater. Stay clear of the numbered marks and attack while it reloads.'}
  ];
  C.deepEnemyTypes={};
  additions.forEach((enemy,i)=>{const index=48+i;if(C.enemies[index]&&C.enemies[index].id!==enemy.id)throw new Error('Deep enemy index collision: '+index);C.enemies[index]={...enemy,deepEnemy:true};C.deepEnemyTypes[enemy.id]=index;});
})();
