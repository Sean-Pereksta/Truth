/* Expedition selection and portable hero management share the launch bay dialog. */
(() => {
  'use strict';
  window.HeroMenus = function({ui,act,art,vista,escape,titled,show,renderLocal,kitOwned}){
    let setup,origin='home',returnOp='',rosterFrom='home',selected='',pilotIndex=0;
    const modes=[
      {id:'solo',name:'Solo'},
      {id:'keyboard-pad',name:'Keyboard + controller'},
      {id:'dual-pad',name:'Two controllers'}
    ];
    const record=id=>id?HeroRoster.get(id):null;
    const role=id=>Progress.kits[id]||Progress.kits[0];
    const select=(key,label,items,value)=>{
      const id='hero-'+key;
      const options=items.map(item=>'<option value="'+escape(item.id)+'"'+(String(value)===String(item.id)?' selected':'')+(item.disabled?' disabled':'')+'>'+escape(item.name)+'</option>').join('');
      return '<label class="hero-field" for="'+id+'"><span>'+escape(label)+'</span><select id="'+id+'" data-hero-field="'+key+'">'+options+'</select></label>';
    };
    const nameInput=(key,label,value,placeholder)=>'<label class="hero-field" for="hero-'+key+'"><span>'+escape(label)+'</span><input type="text" id="hero-'+key+'" data-hero-field="'+key+'" maxlength="'+HeroRoster.maxName+'" value="'+escape(value||'')+'" placeholder="'+escape(placeholder)+'" autocomplete="off"></label>';
    function message(value){
      const el=document.getElementById('hero-status');
      if(el){el.textContent=value||'';el.hidden=!value;}
    }
    function focusField(key){
      document.querySelector('#panel [data-hero-field="'+key+'"]')?.focus({preventScroll:true});
    }
    function moveFocus(direction){
      if(ui.screen!=='hero-setup'&&ui.screen!=='hero-roster')return false;
      const controls=[...document.querySelectorAll('#panel :is(button,select,input):not(:disabled):not([hidden])')];
      if(!controls.length)return false;
      const index=controls.indexOf(document.activeElement);
      controls[(Math.max(0,index)+Math.sign(direction)+controls.length)%controls.length].focus();
      return true;
    }
    const status='<p class="hero-status" role="status" aria-live="polite" id="hero-status" hidden></p>';
    function beginSetup(layout,mode,firstHero=null){
      const g=ui.g;
      origin=ui.screen;returnOp=origin==='coop-setup'?'configure-crew':origin==='endless-setup'?'configure-endless':'configure-expedition';
      const defaults=ExpeditionRules.normalize({});
      setup={layout,mode,kit:ui.kit,contract:ui.contract,difficulty:defaults.difficulty,stage:defaults.startGate,mapId:defaults.startRegion,
        pilots:[0,1].map(i=>({heroId:i===0?firstHero:null,roleId:ui.kit,name:''}))};
      ui.screen='hero-setup';drawSetup(g);
      document.getElementById('hero-layout')?.focus();
    }
    function focusedRole(g,p,i){
      const otherId=setup.layout==='solo'?null:setup.pilots[1-i].heroId;
      const list=HeroRoster.list().map(h=>({id:h.id,name:h.name+' · Lv '+h.level,disabled:h.id===otherId}));
      const saved=record(p.heroId),kit=role(saved?saved.kitId:p.roleId),build=saved?.build;
      const suit=Progress.suits[build?.suit??kit.suit],guns=build?.guns||[],fitted=build?.ready||[];
      const gun=Combat.guns[guns[fitted[build?.selected||0]]?.id??kit.gun];
      const abilities=build?build.activeSlots.map(index=>Combat.abilities[build.abilities[index]?.id]).filter(Boolean):[Combat.abilities[kit.ability]].filter(Boolean);
      const controls=select('pilot-'+i,'Hero',[{id:'',name:'New hero'},...list],p.heroId||'')+
        (!saved?select('role-'+i,'Starting role',HeroRoster.roles().filter(k=>kitOwned(g,k.id)),p.roleId)+nameInput('name-'+i,'Callsign (optional)',p.name,'Automatic callsign'):'');
      return '<section class="hero-pilot"><h3>Pilot '+(i+1)+'</h3><div class="hero-fields">'+controls+'</div>'+
        '<div class="hero-loadout">'+art('suit',build?.skin??suit.id)+'<div><strong>'+escape(kit.name)+'</strong><p>'+escape(saved?'Saved gear and upgrades · Level '+saved.level:kit.desc)+'</p></div></div>'+
        '<dl class="hero-gear"><dt>Weapon</dt><dd>'+escape(gun?.name)+'</dd>'+
        abilities.map(ab=>'<dt>Active</dt><dd>'+escape(ab.name)+'<small>'+escape(ab.desc)+' · '+escape(ab.cooldown)+'s cooldown</small></dd>').join('')+
        '<dt>Armor</dt><dd>'+escape(suit.name)+'<small>'+escape(suit.desc)+'</small></dd></dl></section>';
    }
    function drawSetup(g){
      const rules=ExpeditionRules,region=rules.regions.find(r=>String(r.id)===String(setup.mapId))||rules.regions[0];
      const challenge=rules.difficulties.find(v=>v.id===setup.difficulty)||rules.difficulties[0];
      const pilots=setup.pilots.slice(0,setup.layout==='solo'?1:2);
      const config='<div class="hero-fields hero-mission">'+select('layout','Pilots',modes,setup.layout)+
        select('difficulty','Difficulty',rules.difficulties,setup.difficulty)+select('gate','Starting gate',rules.gates,setup.stage)+select('region','Starting region',rules.regions,setup.mapId)+'</div>'+
        '<p class="hero-brief">'+escape(challenge.description||'')+'</p>'+
        (region.id==='auto'?'':vista(Number(region.id),'vista hero-region'))+
        '<p class="hero-brief">'+escape(region.description||'')+'</p>';
      const checkpoint=g.saved?'<p class="msg">Starting replaces your current expedition checkpoint.</p>':'';
      titled('LAUNCH BAY / '+(setup.mode==='endless'?'ENDLESS':'CAMPAIGN'),'Configure expedition',config+
        '<div class="hero-pilots">'+pilots.map((v,i)=>focusedRole(g,v,i)).join('')+'</div>'+checkpoint+status+
        '<p id="hero-pad-count" class="hero-brief" role="status"></p><div class="panel-actions">'+
        act('hero-launch','Deploy expedition','primary')+act('hero-roster','Hero roster')+act('back','Back','quiet')+'</div>');
      refreshPads();
    }
    function refreshPads(){
      if(ui.screen!=='hero-setup')return;
      const status=document.getElementById('hero-pad-count'),button=document.querySelector('[data-op=hero-launch]');
      if(!status||!button)return;
      const count=CrewInput.count(),need=setup.layout==='dual-pad'?2:setup.layout==='keyboard-pad'?1:0;
      button.disabled=count<need;
      status.hidden=!need;
      status.textContent=count<need?'Connect '+(need-count)+' more controller'+(need-count===1?'':'s')+' to deploy.':count+' controller'+(count===1?'':'s')+' connected.';
    }
    function openRoster(){
      rosterFrom=ui.screen;
      pilotIndex=0;ui.screen='hero-roster';drawRoster();
    }
    function selectedHero(){
      const list=HeroRoster.list();
      if(!list.some(h=>h.id===selected))selected=list[0]?.id||'';
      return list.find(h=>h.id===selected);
    }
    function drawRoster(){
      const g=ui.g,hero=selectedHero(),list=HeroRoster.list();
      let save='';
      if(['pause','junction','routes','result'].includes(rosterFrom)&&g.players?.length){
        const pilot=g.players[pilotIndex]||g.players[0],old=record(pilot.heroId);
        save='<section class="hero-pilot"><h3>Save current pilot</h3><div class="hero-fields">'+
          (g.players.length>1?select('save-pilot','Pilot',g.players.map((p,i)=>({id:i,name:'Pilot '+(i+1)+(p.heroName?' · '+p.heroName:'')})),pilotIndex):'')+
          nameInput('save-name','Hero name',pilot.heroName||old?.name||'','Automatic callsign')+'</div>'+
          '<div class="panel-actions">'+act('hero-save','Save hero','primary')+'</div></section>';
      }
      const manage=hero?select('record','Saved heroes',list.map(h=>({id:h.id,name:h.name+' · Lv '+h.level})),selected)+
        '<div class="hero-loadout">'+art('suit',hero.build.skin??hero.build.suit)+
        '<div><strong>'+escape(hero.name)+'</strong><p>'+escape(role(hero.kitId).name)+' · Level '+escape(hero.level)+' · '+hero.build.guns.length+' weapons · '+hero.build.abilities.length+' actives</p></div></div>':
        '<p class="detail-text">Start with a new hero, or import a hero file to join your roster.</p>';
      titled('PILOT RECORDS','Hero roster',save+'<section class="hero-pilot">'+manage+
        '<div class="panel-actions">'+(hero&&rosterFrom==='home'?act('hero-deploy-selected','Deploy with this hero','primary'):'')+(hero?act('hero-export','Export selected hero'):'')+act('hero-import','Import hero file')+
        '<input type="file" id="hero-import-file" accept=".json,application/json" hidden></div></section>'+
        status+'<div class="panel-actions">'+act('back',rosterFrom==='hero-setup'?'Back to expedition':'Back','secondary')+'</div>',{narrow:true});
    }
    function change(el,input){
      const id=el.dataset.heroField;
      if(!id)return;
      const idx=Number(id.split('-')[1]);
      if(input){
        if(id.startsWith('name-'))setup.pilots[idx].name=el.value;
        return;
      }
      if(ui.screen==='hero-roster'){
        if(id==='record')selected=el.value;
        else if(id==='save-pilot')pilotIndex=Number(el.value);
        else return;
        drawRoster();focusField(id);return;
      }
      if(ui.screen!=='hero-setup')return;
      if(id==='layout')setup.layout=el.value;
      else if(id==='difficulty')setup.difficulty=el.value;
      else if(id==='gate')setup.stage=Number(el.value);
      else if(id==='region')setup.mapId=el.value==='auto'?'auto':Number(el.value);
      else if(id.startsWith('pilot-'))setup.pilots[idx].heroId=el.value||null;
      else if(id.startsWith('role-'))setup.pilots[idx].roleId=Number(el.value);
      else return;
      drawSetup(ui.g);focusField(id);
    }
    function goBack(){
      if(ui.screen==='hero-roster'){
        if(rosterFrom==='hero-setup'){ui.screen='hero-setup';drawSetup(ui.g);}else show(rosterFrom,ui.g);
        const scope=rosterFrom==='home'?document.getElementById('bay'):document.getElementById('panel');
        scope.querySelector('[data-op="hero-roster"]')?.focus();return true;
      }
      if(ui.screen==='hero-setup'){
        if(origin==='coop-setup'||origin==='endless-setup')renderLocal(origin,ui.g);else show(origin,ui.g);
        document.querySelector('[data-op="'+returnOp+'"]')?.focus();return true;
      }
      return false;
    }
    async function importFile(file){
      if(!file)return;
      try{
        if(file.size>HeroRoster.maxBytes)throw Error('Hero files can be up to '+Math.round(HeroRoster.maxBytes/1024)+' KB.');
        const text=await file.text();if(ui.screen!=='hero-roster')return;
        const h=HeroRoster.importJSON(text);selected=h.id;drawRoster();message('Imported '+h.name+'.');focusField('record');
      }catch(e){message(e.message);}
      const el=document.getElementById('hero-import-file');if(el)el.value='';
    }
    function handle(op){
      const g=ui.g;
      switch(op){
        case 'configure-expedition':beginSetup('solo','campaign');break;
        case 'configure-crew':beginSetup(ui.layout,ui.endlessCrew?'endless':'campaign');break;
        case 'configure-endless':beginSetup('solo','endless');break;
        case 'hero-roster':openRoster();break;
        case 'hero-deploy-selected':{
          const h=selectedHero();if(!h)break;
          ui.screen='home';beginSetup('solo','campaign',h.id);
          break;
        }
        case 'hero-launch':{
          try{
            const pilots=setup.pilots.slice(0,setup.layout==='solo'?1:2);
            HeroRoster.checkCrew(pilots.map(p=>p.heroId));
            if(!Game.startExpedition({...setup,pilots}))message('Deployment could not start. Check the selected pilots and controllers.');
          }catch(e){message(e.message);}
          break;
        }
        case 'hero-save':{
          try{
            const name=document.getElementById('hero-save-name').value.trim(),h=Game.saveHero(pilotIndex,name);
            selected=h.id;drawRoster();message('Saved '+h.name+' at level '+h.level+'.');focusField('record');
          }catch(e){message(e.message);}
          break;
        }
        case 'hero-export':{
          try{
            const h=selectedHero();if(!h)break;
            const blob=new Blob([HeroRoster.exportJSON(h.id)],{type:'application/json'});
            const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;
            a.download=(h.name.replace(/[^a-z0-9_-]+/gi,'-').slice(0,48)||'Cinder-Relay')+'-hero.json';
            a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);message('Exported '+h.name+'.');
          }catch(e){message(e.message);}
          break;
        }
        case 'hero-import':document.getElementById('hero-import-file')?.click();break;
        default:return false;
      }
      return true;
    }
    return {handle,change,goBack,refreshPads,importFile,moveFocus};
  };
})();
