/* Controller preferences belong to the device-side player profile, across slots. */
(function () {
  'use strict';
  const W = window.OW;
  const defaults = { deadzone: .18, sensitivity: 1, assist: 0, sticks: 'inherit', glyphs: 'auto' };
  const profiles = [0, 1].map(index => {
    let saved;
    try { saved = JSON.parse(localStorage.getItem('whiskerfall.padProfiles') || '[]')[index]; } catch (_) {}
    const p = { ...defaults };
    for (const [key, min, max] of [['deadzone', .05, .45], ['sensitivity', .5, 1.75], ['assist', 0, 1]]) {
      if (Number.isFinite(saved?.[key])) p[key] = Math.max(min, Math.min(max, saved[key]));
    }
    if (['inherit','normal','swap'].includes(saved?.sticks)) p.sticks = saved.sticks;
    if (['auto','xbox','ps'].includes(saved?.glyphs)) p.glyphs = saved.glyphs;
    return p;
  });
  const save = () => { try { localStorage.setItem('whiskerfall.padProfiles', JSON.stringify(profiles)); } catch (_) {} };
  const xbox = ['A','B','X','Y','LB','RB','LT','RT','View','Menu','LS','RS','D-pad ↑','D-pad ↓','D-pad ←','D-pad →'];
  const ps = ['Cross','Circle','Square','Triangle','L1','R1','L2','R2','Create','Options','L3','R3','D-pad ↑','D-pad ↓','D-pad ←','D-pad →'];
  const I = W.Input.prototype;
  I.padProfile = index => profiles[index] || profiles[0];
  I.glyph = function (index, button) {
    const pad = this.pads?.find(p => this.padAssignments.get(p.index) === index);
    const style = this.padProfile(index).glyphs;
    const glyphs = style === 'ps' || (style === 'auto' && /dualshock|dualsense|playstation|054c/i.test(pad?.id)) ? ps : xbox;
    return glyphs[button] || W.Input.padName(button);
  };
  I.actionLabel = function (index, action) {
    const pad = this.pads?.find(p => this.padAssignments.get(p.index) === index);
    if (pad && (this.padLastUse.get(pad.index) || 0) >= Math.max(this.lastKeyboard, index ? 0 : this.mouse.lastMove)) {
      return this.glyph(index, this.padBindings[action]);
    }
    return W.Input.keyName(this.bindings[(index ? 'p2' : '') + action]);
  };
  I.assistedAngle = function (game, index, angle, strength) {
    const player = game.players[index];
    if (!strength || !player || !game.grid) return angle;
    const range = Math.min(game.weapon(player)?.range || 650, 700);
    let correction = 0, best = strength * .21;
    for (const enemy of game.grid.query(player.x, player.y, range)) {
      if (enemy.dead || enemy.hp <= 0 || Math.hypot(enemy.x-player.x, enemy.y-player.y) > range) continue;
      const delta = W.wrapAngle(Math.atan2(enemy.y-player.y, enemy.x-player.x) - angle);
      if (Math.abs(delta) < best && game.lineOfSight(player, enemy)) {
        correction = delta; best = Math.abs(delta);
      }
    }
    return angle + correction * strength;
  };
  const U = W.UI.prototype;
  const controls = U.controlsMenu;
  U.controlsMenu = function () {
    const index = this.controlPlayer || 0, profile = profiles[index];
    const field = (key, label, choices) => '<label class="setting"><span>'+label+'</span><select id="pad-'+index+'-'+key+'" data-pad-option="'+key+'">'+choices.map(([value,name])=>'<option value="'+value+'" '+(String(profile[key])===String(value)?'selected':'')+'>'+name+'</option>').join('')+'</select></label>';
    const pad = this.game.input;
    const connected = pad?.connectedPads() || [];
    return '<section class="pad-profile"><h3>Player '+(index+1)+' controller</h3><div class="pad-profile-grid">'+
      field('deadzone','Stick deadzone',[[.05,'5%'],[.12,'12%'],[.18,'18%'],[.25,'25%'],[.35,'35%'],[.45,'45%']])+
      field('sensitivity','Aim sensitivity',[[.5,'50%'],[.75,'75%'],[1,'100%'],[1.35,'135%'],[1.75,'175%']])+
      field('assist','Aim assistance',[[0,'Off'],[.35,'Light'],[.65,'Medium'],[1,'Strong']])+
      field('sticks','Movement stick',[['inherit','Use shared layout'],['normal','Left'],['swap','Right']])+
      field('glyphs','Button labels',[['auto','Detect controller'],['xbox','Xbox'],['ps','PlayStation']])+
      '<div class="setting"><span>Presets</span><button data-action="pad-preset" data-value="standard">Twin-stick</button><button data-action="pad-preset" data-value="steady">Steady aim</button></div></div>'+
      connected.map(p=>'<button data-action="assign-pad" data-value="'+p.index+'">Controller '+(p.index+1)+' · P'+((pad.padAssignments.get(p.index)??0)+1)+' → assign to Player '+(index+1)+'</button>').join('')+'</section>'+controls.call(this);
  };
  const change = U.change;
  U.change = function (e) {
    const key = e.target?.dataset?.padOption;
    if (!Object.hasOwn(defaults,key)) return change.call(this,e);
    profiles[this.controlPlayer||0][key] = typeof defaults[key] === 'number' ? Number(e.target.value) : e.target.value;
    save();
  };
  const click = U.click;
  U.click = function (e) {
    const button = e.target.closest('button[data-action]'), action = button?.dataset.action;
    const index = this.controlPlayer || 0, input = this.game.input;
    if (action === 'reset-controls') { profiles.forEach(p=>Object.assign(p, defaults)); save(); }
    if (action === 'pad-preset') {
      Object.assign(profiles[index], defaults, button.dataset.value === 'steady' ? {deadzone:.25,sensitivity:.75,assist:.65} : {});
      save(); this.render(); return;
    }
    if (action === 'assign-pad') {
      const id = Number(button.dataset.value);
      if (!input.connectedPads().some(p=>p.index===id)) return;
      const old = input.padAssignments.get(id);
      for (const [other,owner] of input.padAssignments) if (other !== id && owner === index) input.padAssignments.set(other,old ?? 1-index);
      input.padAssignments.set(id,index); input.disconnectedPads = []; this.render(); return;
    }
    return click.call(this,e);
  };
  const close = U.handlePad;
  U.handlePad = function (action, index=0) {
    const returnTarget = this.titleReturnFocus;
    const result = close.call(this,action,index);
    if (action === 'back' && this.menu==='main' && returnTarget) {
      this.setControllerFocus(this.focusableControls().find(b=>this.sameFocus(b,returnTarget)),index);
      this.titleReturnFocus = null;
    }
    return result;
  };
  const show = U.showMenu;
  U.showMenu = function (name,...args) {
    if (this.menu==='main' && this.game.state==='menu') this.titleReturnFocus=this.focusKey(this.host.querySelector('button[data-action="menu"][data-value="'+name+'"]'));
    return show.call(this,name,...args);
  };
})();
