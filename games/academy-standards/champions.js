/* House relics attune to their original students, including recruited rivals. */
(() => {
 'use strict';
 const houses=[['player','Augustus','Laurelguard Plate','#5ca8ff'],['mars','Mars','Warborn Panoply','#d65d5d'],['minerva','Minerva','Owlkeeper Aegis','#d0a44d'],['diana','Diana','Moonstalker Mail','#67c98d'],['apollo','Apollo','Sunforged Harness','#e6a04a'],['juno','Juno','Sovereign Regalia','#b58ada'],['neptune','Neptune','Tidewarden Plate','#59bfd0'],['vulcan','Vulcan','Emberforged Plate','#e77b45'],['venus','Venus','Roseguard Regalia','#df85af'],['saturn','Saturn','Elderstar Panoply','#a3b78a']];
 const relics=houses.map(([id,house,name,color])=>({key:'Champion_'+id,houseId:id,house:'House '+house,name,color,description:'Champion · +80 health · 36% protection · +18% damage',image:'champions/'+id+'-champion.png'}));
 const isChampion=armor=>typeof armor==='string'&&relics.some(r=>r.key===armor);
 const forStudent=s=>relics.find(r=>r.houseId===s.origHouse);
 const api={relics,isChampion,forStudent};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else window.AcademyChampions=api;
})();
