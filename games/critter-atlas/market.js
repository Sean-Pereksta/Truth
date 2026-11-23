import { MAX_LEVEL, REGIONS, SPECIES, getForm } from './catalog.js';
import {
  ITEMS, MARKETS, buyItem, buyCritter, itemOffer, sellItem, critterStock,
  critterOffer, sellCritter, feedCritter
} from './economy.js';
import { fightIcon } from './fight-icons.js';

const roleNames = {striker:'Striker', healer:'Healer', defender:'Defender', ranged:'Ranged'};
const itemIcons = {food:'xp', heal:'heal', capture:'capture'};
const itemKinds = {food:'Training food', heal:'Field remedy', capture:'Capture charm'};
const escape = value => String(value).replace(/[&<>"']/g, char =>
  ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[char]);

function wallet(coins) {
  return `<span class="mk-wallet"><span class="mk-coin" aria-hidden="true"></span><b>${coins.toLocaleString('en-US')}</b> coins</span>`;
}
function itemBadge(item) {
  const col = item.artIndex % 6, row = Math.floor(item.artIndex / 6);
  return `<span class="mk-item-badge mk-${item.kind}" aria-hidden="true"><i class="mk-item-art" style="background-position:${col * 20}% ${row * 50}%"></i>${fightIcon(itemIcons[item.kind],'')}</span>`;
}
function priceButton(action, id, price, coins, label='Buy') {
  const shortage = price > coins;
  return `<button type="button" class="mk-buy" data-market-action="${action}" data-id="${escape(id)}"
    ${shortage ? `disabled title="Need ${price - coins} more coins"` : ''}>${label} · ${price} coins</button>`;
}
function ownedItems(state) {
  return Object.values(ITEMS).filter(item => state.economy.bag[item.id] > 0);
}
function specimenLabel(state, member) {
  const place = state.party.includes(member.uid) ? 'Party' : 'Reserve';
  return place + ' · No. ' + (state.roster.indexOf(member) + 1);
}
function portrait(sprite, member) {
  return `<span class="mk-portrait">${sprite(member.speciesId,getForm(member).stage)}</span>`;
}
function report(root, text) {
  root.querySelector('.mk-feedback').textContent = text;
}
function focusAction(root, match) {
  if (match) root.querySelector(match)?.focus({preventScroll:true});
}

export function mountMarket(root, {state, region, sprite, onChange, onExit}) {
  const store = MARKETS[region];
  if (!store) throw new RangeError('Unknown regional market');
  let tab = 'supplies', selectedUid = null, quotePrice = null, message = '';

  function supplyCards() {
    return Object.entries(store.stock).map(([id, price]) => {
      const item = ITEMS[id];
      return `<article class="mk-card"><div class="mk-card-head">${itemBadge(item)}
        <div><small>${itemKinds[item.kind]}</small><h3>${item.name}</h3></div></div>
        <p>${item.description}</p><div class="mk-card-foot"><small>${state.economy.bag[id] || 0} in bag</small>
        ${priceButton('buy-item',id,price,state.economy.coins)}</div></article>`;
    }).join('');
  }
  function recruitCards() {
    return critterStock(region).map(offer => {
      const species = SPECIES[offer.speciesId], form = getForm(offer);
      return `<article class="mk-card"><div class="mk-card-head">${portrait(sprite,offer)}
        <div><small>${species.rarity} · Lv. ${offer.level}</small><h3>${form.name}</h3>
        <span class="mk-role">${roleNames[species.role]}${form.stage ? ' · ' + species.name + ' family' : ''}</span></div></div>
        <p>${species.lore}</p><div class="mk-card-foot">
        ${priceButton('buy-critter',species.id,offer.price,state.economy.coins,'Recruit')}</div></article>`;
    }).join('');
  }
  function sellCard(member) {
    const quote = critterOffer(state,region,member.uid);
    const species = SPECIES[member.speciesId], name = getForm(member).name;
    const label = specimenLabel(state,member);
    const selected = member.uid === selectedUid;
    const confirm = selected ? `<div class="mk-confirm" role="group" aria-label="Confirm sale of ${name}">
      <p>Sell <b>${name}</b> (${label}, Lv. ${member.level}) for <b>${quotePrice} coins</b>?
      ${quote.replacement ? `${getForm(quote.replacement).name} will join your traveling party.` : ''}</p>
      <div><button type="button" data-market-action="cancel-sale">Keep Critter</button>
      <button type="button" class="mk-sale" data-id="${escape(member.uid)}" data-market-action="confirm-sale">Confirm sale</button></div></div>` : '';
    return `<article class="mk-card${selected ? ' mk-selected' : ''}"><div class="mk-card-head">${portrait(sprite,member)}<div>
      <small>${label}</small><h3>${name}</h3><span class="mk-role">Lv. ${member.level} · ${roleNames[species.role]}${quote.wanted ? ' · In demand' : ''}</span></div></div>
      ${selected ? confirm : `<div class="mk-card-foot"><b>${quote.price} coins</b><button class="mk-trade" data-market-action="review-sale"
      data-id="${escape(member.uid)}" ${quote.sellable ? '' : 'disabled'}>${quote.sellable ? 'Review offer' : 'Last companion'}</button></div>`}</article>`;
  }
  function sales() {
    const supplies = ownedItems(state);
    return `<p class="mk-demand">${store.demandNote} <strong>+45% on ${roleNames[store.demand].toLowerCase()} offers.</strong></p>
      <h2 class="mk-subhead">Your Critters</h2><div class="mk-grid">${state.roster.map(sellCard).join('')}</div>
      ${supplies.length ? `<h2 class="mk-subhead">Your supplies</h2><div class="mk-grid">${supplies.map(item => `
      <article class="mk-card"><div class="mk-card-head">${itemBadge(item)}<div><small>${state.economy.bag[item.id]} in bag</small><h3>${item.name}</h3></div></div>
      <div class="mk-card-foot"><button class="mk-trade" data-market-action="sell-item" data-id="${item.id}">Sell one · ${itemOffer(region,item.id)} coins</button></div></article>`).join('')}</div>` : ''}`;
  }
  function draw() {
    const area = REGIONS[region];
    const x = area.artRegion % 2 ? 100 : 0, y = Math.floor(area.artRegion / 2) * 100 / 3;
    root.innerHTML = `<section class="mk-market" aria-label="${store.name}" style="--mk-accent:${area.color}">
      <header class="mk-scene" style="--mk-x:${x}%;--mk-y:${y}%;--mk-filter:${area.artFilter}"><div><small>${area.name}</small><h1>${store.name}</h1></div></header>
      <div class="mk-toolbar">${wallet(state.economy.coins)}<button class="link-action" type="button" data-market-action="leave">Return to town →</button></div>
      <div class="mk-tabs" role="group" aria-label="Market counters">${[['supplies','Buy supplies'],['critters','Buy Critters'],['sell','Sell']].map(([id,label]) =>
        `<button type="button" data-market-action="counter" data-id="${id}" aria-pressed="${tab === id}">${label}</button>`).join('')}</div>
      <div class="mk-feedback" role="status"></div>
      ${tab === 'sell' ? sales() : `<div class="mk-grid">${tab === 'supplies' ? supplyCards() : recruitCards()}</div>`}</section>`;
    report(root,message);
  }
  function click(event) {
    const b = event.target.closest('[data-market-action]');
    if (!b || !root.contains(b) || b.disabled) return;
    const {marketAction:action,id} = b.dataset;
    if (action === 'leave') { onExit?.(); return; }
    let result;
    if (action === 'counter') {
      tab=id; selectedUid=null; message=''; draw(); focusAction(root,`[data-market-action="counter"][data-id="${id}"]`); return;
    }
    if (action === 'review-sale') {
      const quote=critterOffer(state,region,id);
      if (!quote?.sellable) return;
      selectedUid=id; quotePrice=quote.price; message=''; draw(); focusAction(root,'[data-market-action="cancel-sale"]'); return;
    }
    if (action === 'cancel-sale') {
      const uid=selectedUid; selectedUid=null; draw(); focusAction(root,`[data-market-action="review-sale"][data-id="${uid}"]`); return;
    }
    if (action === 'confirm-sale' && selectedUid === id) result = sellCritter(state,region,id,quotePrice);
    if (action === 'buy-item') result = buyItem(state,region,id);
    if (action === 'buy-critter') result = buyCritter(state,region,Number(id));
    if (action === 'sell-item') result = sellItem(state,region,id);
    if (!result) return;
    selectedUid=null; message=result.message; draw();
    if (result.ok) onChange?.();
    const same=root.querySelector(`[data-market-action="${action}"][data-id="${id}"]:not(:disabled)`);
    (same ?? root.querySelector('.mk-tabs [aria-pressed="true"]'))?.focus({preventScroll:true});
  }
  root.addEventListener('click',click); draw();
  return () => root.removeEventListener('click',click);
}

export function mountBag(root, {state, sprite, onChange}) {
  let foodId=null, message='';
  function draw() {
    const items=ownedItems(state);
    root.innerHTML=`<section class="mk-bag" aria-label="Field bag"><div class="mk-bag-heading"><h1>Field bag</h1>${wallet(state.economy.coins)}</div>
      <div class="mk-feedback" role="status"></div>
      ${items.length ? `<div class="mk-grid">${items.map(item => `<article class="mk-card"><div class="mk-card-head">
        ${itemBadge(item)}<div><small>${itemKinds[item.kind]} · ${state.economy.bag[item.id]} in bag</small><h3>${item.name}</h3></div></div><p>${item.description}</p>
        <div class="mk-card-foot">${item.kind === 'food' ? `<button class="mk-trade" type="button" data-food="${item.id}">Choose Critter</button>` : '<small>Use during a battle</small>'}</div></article>`).join('')}</div>`
      : '<p class="mk-empty">Your bag is empty. Visit a town market for remedies, capture charms, and training food.</p>'}
      ${foodId ? `<div class="mk-feed"><div class="mk-toolbar"><h2>Give ${ITEMS[foodId].name} to…</h2>
      <button type="button" class="link-action" data-cancel-food>Cancel</button></div><div class="mk-grid">${state.roster.map(m => `<button type="button" class="mk-recipient" data-feed="${escape(m.uid)}" ${m.level >= MAX_LEVEL ? 'disabled' : ''}>
      ${portrait(sprite,m)}<span><b>${getForm(m).name}</b><small>${specimenLabel(state,m)} · Lv. ${m.level}</small></span></button>`).join('')}</div></div>` : ''}</section>`;
    report(root,message);
  }
  function click(event) {
    const b=event.target.closest('button');
    if (!b || !root.contains(b) || b.disabled) return;
    if (b.dataset.food) {
      foodId=b.dataset.food; message=''; draw();
      root.querySelector('.mk-feed')?.scrollIntoView?.({block:'nearest'});
      focusAction(root,'[data-feed]:not(:disabled), [data-cancel-food]'); return;
    }
    if (b.hasAttribute('data-cancel-food')) {
      const id=foodId; foodId=null; draw(); focusAction(root,`[data-food="${id}"]`); return;
    }
    if (b.dataset.feed && foodId) {
      const id=foodId, result=feedCritter(state,id,b.dataset.feed);
      foodId=null; message=result.message; draw();
      if (result.ok) onChange?.();
      focusAction(root,`[data-food="${id}"]`);
    }
  }
  root.addEventListener('click',click); draw();
  return () => root.removeEventListener('click',click);
}
