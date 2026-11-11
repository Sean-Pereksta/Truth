(function(){
  'use strict';
  const W=window.OW;
  const sheets=['assets/abilities/field-abilities.png','assets/abilities/arcane-abilities.png'];
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const assetURL=path=>W.config.assetBaseURL?W.config.assetBaseURL.replace(/\/$/,'')+'/'+path.replace(/^assets\//,''):path;
  W.AbilityArt={sheets,assetURL,markup(a,options={}){
    const index=W.Content.abilities.findIndex(item=>item.id===a.id);if(index<0)return '';
    const frame=index%12,col=frame%4,row=Math.floor(frame/4),x=col*384+5,y=row*(1024/3)+5,width=374,height=1024/3-10;
    return `<div class="${escape(options.className||'ability-art illustrated-ability-art')}" data-ability-art="${escape(a.id)}"><svg class="ability-painting" viewBox="${x} ${y} ${width} ${height}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${escape(a.name)} spell illustration"><title>${escape(a.name)} — ${escape(a.description||'')}</title><image href="${escape(assetURL(sheets[Math.floor(index/12)]))}" width="1536" height="1024"/></svg></div>`;
  }};
})();
