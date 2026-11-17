/* Painted regional plates are fetched only when the party or journal needs one. */
(function () {
  'use strict';
  const W = window.OW;
  const sites = ['archive','spire','court','depot','cistern','vault'];
  const terrain = { hushfen:'archive', glasswind:'spire', gloamroot:'court' };
  const names = ['Floodgate Archive','Signal Spire','Lantern Court','Cinder Rail Depot','Mirror Cistern','Blackglass Command Vault'];
  const registry = new Map(), cache = new Map();
  for (const [i,site] of sites.entries()) {
    for (const [type,label] of [['plate','Panorama'],['floor','Floor'],['mechanism','Mechanism'],['wall','Boundary wall']]) {
      registry.set(type+'-'+site, names[i]+' · '+label);
    }
  }
  ['The Missing Dispatches','The Hidden Network','The Berlin Dossier'].forEach((name,i)=>registry.set('chapter-'+(i+1),name));
  registry.set('courier-camp','Couriers at dusk');
  const landmarks={rushlight:'Rushlight Landing',leeward:'Leeward Inn',lamplighter:'Lamplighter Refuge',gatehouse:'Eastern gatehouse',hatch:'Document lift',courtyard:'Courtyard field station'};
  Object.entries(landmarks).forEach(([id,label])=>registry.set('landmark-'+id,label));
  for(let i=0;i<9;i++)registry.set('commander-'+i,W.Content?.bosses?.[i]?.name||'Commander portrait '+(i+1));
  for(let i=1;i<=12;i++)registry.set('contact-'+i,'Dispatch contact '+i);
  for(const key of ['gold','materials','cores'])registry.set('resource-'+key,'Forge supplies · '+key);
  registry.set('forge','The resistance forge');
  const url = key => (W.config?.assetBaseURL || 'assets').replace(/\/$/,'')+'/recon/'+key+'.webp';
  function image(kind,id) {
    const key=kind+'-'+String(id).replace(/^recon_/,'');
    if (!registry.has(key)) return null;
    if (!cache.has(key)) {
      const im=new Image(); cache.set(key, null);
      im.onload=()=>{cache.set(key,im); if(kind==='floor') W.game?.renderer?.chunks.clear();};
      im.src=url(key);
    }
    return cache.get(key);
  }
  W.ReconArt = {
    registry,url,
    chapterURL:act=>url('chapter-'+act),
    dungeonPlate:id=>image('plate',id),
    floor:id=>image('floor',id),
    wall:id=>image('wall',id),
    landmark:id=>image('landmark',id),
    mechanism:id=>image('mechanism',id),
    regionalGround:region=>terrain[region?.slug] ? image('floor',terrain[region.slug]) : null
  };
  if(!W.Renderer)return;
  const sitesByObject={town_10_house_0:'rushlight',town_11_house_0:'leeward',town_12_house_0:'lamplighter',recon_vault_entrance:'hatch',recon_vault_east_gatehouse:'gatehouse',recon_courtyard_station:'courtyard'};
  const draw=W.Renderer.prototype.drawObject;
  W.Renderer.prototype.drawObject=function(o,world){
    const id=sitesByObject[o.id],art=id&&image('landmark',id);
    if(!art || o.hidden || o.destroyed || o.alive===false)return draw.call(this,o,world);
    const width=o.w*1.35,height=width*art.height/art.width,ctx=this.ctx;
    const obscures=this.game.players.some(p=>Math.abs(p.x-o.x)<width*.52&&p.y<o.y+12&&p.y>o.y-height);
    ctx.save();ctx.globalAlpha *= obscures ? .42 : 1;
    ctx.drawImage(art,o.x-width/2,o.y-height+6,width,height);ctx.restore();
  };
})();
