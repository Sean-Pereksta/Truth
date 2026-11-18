(function (root) {
  'use strict';
  // Standard Gamepad API indices. Menu navigation is independent of race bindings.
  const presets = {
    trigger: {name:'Trigger Drive', accelerate:7, brake:6, drift:1, item:2, ability:3, lookBack:0},
    arcade: {name:'Arcade', accelerate:0, brake:1, drift:4, item:7, ability:2, lookBack:3},
    leftTrigger: {name:'Left Trigger', accelerate:6, brake:7, drift:1, item:2, ability:3, lookBack:0}
  };
  const labels = {
    xbox:['A','B','X','Y','LB','RB','LT','RT'],
    ps:['Cross','Circle','Square','Triangle','L1','R1','L2','R2']
  };
  const symbols = ['×','○','□','△'];
  const get = id => Object.hasOwn(presets,id) ? presets[id] : presets.trigger;

  function buttonLabel(preset, action, style, compact = false) {
    if (action === 'left' || action === 'right') return 'Left stick';
    const index = preset[action];
    if (style === 'ps' && compact && index < symbols.length) return symbols[index];
    return (style === 'ps' ? labels.ps : labels.xbox)[index];
  }
  function pressure(pad, index) {
    const button = pad?.buttons?.[index];
    return button?.value || (button?.pressed ? 1 : 0);
  }
  root.AcornGamepad = {presets, get, buttonLabel, pressure};
})(typeof globalThis === 'object' ? globalThis : window);
