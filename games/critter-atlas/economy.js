import { BUFFS, MAX_LEVEL, REGIONS, SPECIES, getForm, makeMember } from './catalog.js';
import { keyFor, requirements } from './frontier-routes.js';
import { addCapture, awardXP } from './journal.js';

// Each local item is sold by its home settlement. Items can travel in the bag.
const items = [
  ['tonic', 'Trail tonic', 'heal', 20, 12],
  ['thread', 'Binding thread', 'capture', .10, 17],
  ['honeyroll', 'Clover honeyroll', 'food', 25, 16],
  ['salve', 'Birch sap salve', 'heal', 32, 18],
  ['reedcake', 'Sweetreed cake', 'food', 38, 21],
  ['wispbell', 'Wispbell charm', 'capture', .15, 24],
  ['geodesalt', 'Geode salt crunch', 'food', 50, 25],
  ['amberdrop', 'Amber drop', 'heal', 48, 25],
  ['kelpbun', 'Braided kelp bun', 'food', 64, 30],
  ['pearlloop', 'Pearl tide loop', 'capture', .19, 32],
  ['pinecake', 'Alpine pinecake', 'food', 78, 35],
  ['snowbalm', 'Snowcap balm', 'heal', 68, 35],
  ['hearthfig', 'Hearth-roasted fig', 'food', 90, 41],
  ['cinderseal', 'Cinder seal', 'capture', .22, 41],
  ['sunwafer', 'Sunfruit wafer', 'food', 108, 47],
  ['nectar', 'Mosaic nectar', 'heal', 92, 44],
  ['cometpear', 'Candied comet pear', 'food', 128, 53],
  ['starweave', 'Starweave ribbon', 'capture', .25, 49],
  ['milletbake', 'Honey millet bake', 'food', 150, 58, 2],
  ['stormbraid', 'Stormbraid loop', 'capture', .27, 55, 9],
  ['saltfig', 'Crystallized salt fig', 'food', 178, 64, 12],
  ['brinesalve', 'Brinespring salve', 'heal', 125, 60, 3],
  ['polarpear', 'Northlight pear', 'food', 210, 73, 16],
  ['aurorasilk', 'Aurora silk', 'capture', .30, 65, 17],
  ['barksigil', 'Barkskin sigil', 'support', 0, 24, 3, {buff:'ward'}],
  ['purereed', 'Purereed sachet', 'support', 0, 26, 8, {buff:'cleanse'}],
  ['resonance', 'Resonance shard', 'support', 0, 30, 7, {buff:'power'}],
  ['tidecord', 'Tidecord knot', 'support', 0, 29, 9, {buff:'regen'}],
  ['windpin', 'Windrunner pin', 'support', 0, 31, 5, {buff:'haste'}],
  ['firecask', 'Furnace signal', 'support', 0, 48, 13, {buff:'power', area:1}],
  ['sunwater', 'Sunwater flask', 'support', 0, 42, 15, {buff:'cleanse', area:1}],
  ['starbell', 'Starlight bell', 'support', 0, 54, 17, {buff:'regen', area:1}],
  ['winddrum', 'Gallop drum', 'support', 0, 50, 7, {buff:'haste', area:1}],
  ['glassshield', 'Saltglass shield', 'support', 0, 55, 5, {buff:'ward', area:1}],
  ['northbeacon', 'Northlight beacon', 'support', 0, 64, 16, {buff:'regen', area:1, duration:3}]
];

// Each row pairs a trade good (id, name, value, art, customer region) with a local tactical supply.
const trails = [
  [['briarresin','Briar resin',28,3,2],'barksigil'],
  [['bogamber','Bog amber',31,7,5],'purereed'],
  [['echogeode','Echo geode',34,7,6],'resonance'],
  [['tidepearl','Tide pearl',37,9,1],'tidecord'],
  [['whistledown','Whistledown plume',40,5,8],'windpin'],
  [['kilnobsidian','Kiln obsidian',43,13,2],'firecask'],
  [['mosaicchips','Gilded tesserae',46,15,3],'sunwater'],
  [['starglass','Star glass fragment',49,17,10],'starbell'],
  [['brassseed','Brassmane seeds',52,2,0],'winddrum'],
  [['mirrorsalt','Mirror salt',55,6,4],'glassshield'],
  [['borealglass','Boreal iceglass',58,16,7],'northbeacon']
];
const tradeGoods = trails.map(([[id, name, value, artIndex, demandRegion]]) =>
  [id, name, 'trade', 0, value, artIndex, {demandRegion}]);

function describeItem({kind, power, buff, area, duration, demandRegion}) {
  if (kind === 'food') return `Feed from your bag to give one Critter ${power} XP.`;
  if (kind === 'heal') return `Restore up to ${power} HP to one ally within 3 hexes.`;
  if (kind === 'capture') return `Add ${Math.round(power * 100)} percentage points to one capture within 3 hexes.`;
  if (kind === 'trade') return `Sell at a market. ${REGIONS[demandRegion].name} pays the highest price.`;
  const effect = BUFFS[buff];
  const turns = duration ?? effect.duration;
  const splash = area ? ' Also affects allies within 1 hex of the target.' : '';
  const durationText = turns ? ` Lasts ${turns} turns.` : '';
  return `${effect.tip}${durationText} Target an ally within 3 hexes.${splash}`;
}

export const ITEMS = Object.freeze(Object.fromEntries(items.concat(tradeGoods).map(([id, name, kind, power, value, artIndex, options], index) => {
  const item = {id, name, kind, power, value, artIndex:artIndex ?? index, ...options};
  if (kind === 'support') item.range = 3;
  return [id, Object.freeze({...item, description:describeItem(item)})];
})));
const trailFinds = Object.freeze(Object.fromEntries(trails.flatMap(([[tradeId], supplyId], region) =>
  [[keyFor(region,'ford'), tradeId], [keyFor(region,'lookout'), supplyId]])));

// The two common travel supplies have local prices. The other stocks and the
// pair of species for sale belong to this region. Den and sanctuary families stay wild.
const towns = [
  ['Mossbell Seed Exchange', 'The orchard hires defenders to guard its bee trees.', 'defender', 'salve','honeyroll', [3,4], 10,18],
  ['Lantern Quay', 'Ferry crews pay a premium for healers along the marsh route.', 'healer', 'wispbell','reedcake', [7,9], 13,15],
  ['Geode Arcade', 'The survey guild hires ranged Critters for its deep galleries.', 'ranged', 'amberdrop','geodesalt', [14,17], 11,19],
  ['Driftwood Fishmarket', 'Net runners seek fast strikers for the outgoing tide.', 'striker', 'pearlloop','kelpbun', [21,25], 14,14],
  ['High Pass Co-op', 'Summit caravans seek defenders for the high crossing.', 'defender', 'snowbalm','pinecake', [29,31], 10,20],
  ['Ember Kiln', 'The kiln crews need healers in the furnace district.', 'healer', 'cinderseal','hearthfig', [35,38], 14,17],
  ['Mosaic Bazaar', 'The court’s search parties hire keen ranged attackers.', 'ranged', 'nectar','sunwafer', [43,46], 11,16],
  ['Comet Caravan', 'Star couriers hire fast strikers to cross the moving bridges.', 'striker', 'starweave','cometpear', [49,53], 13,21],
  ['Kitewheel Exchange', 'Herdsmen hire defenders to patrol gaps in the windbreak.', 'defender', 'stormbraid','milletbake', [81,83], 12,19],
  ['Whitepan Caravanserai', 'Caravan crews pay extra for healers who can tend salt burns.', 'healer', 'brinesalve','saltfig', [90,92], 14,20],
  ['Beacon Sound Storehouse', 'Beacon keepers seek ranged Critters to defend the floe crossings.', 'ranged', 'aurorasilk','polarpear', [99,100], 15,22]
];
export const MARKETS = towns.map(([name, demandNote, demand, specialty, food, speciesIds, tonic, thread], region) => {
  const [, tactical] = trails[region];
  return {
    region, name, demand, demandNote,
    stock: {[specialty]:ITEMS[specialty].value, [tactical]:ITEMS[tactical].value, [food]:ITEMS[food].value, tonic, thread},
    speciesIds
  };
});

const startCoins = 64;
const safeCount = value => Number.isSafeInteger(value) && value > 0 ? value : 0;
const failure = message => ({ok:false, message});
const success = message => ({ok:true, message});
const itemEntry = id => Object.hasOwn(ITEMS, id) ? ITEMS[id] : null;
const battleSupplyKinds = new Set(['heal','capture','support']);

export function freshEconomy() {
  return {coins:startCoins, bag:{tonic:1}};
}
export function restoreEconomy(raw) {
  if (raw === undefined || raw === null) return freshEconomy();
  const bag = {};
  for (const id of Object.keys(ITEMS)) {
    const count = safeCount(raw.bag?.[id]);
    if (count) bag[id] = count;
  }
  const economy = {coins:safeCount(raw.coins), bag};
  if (Array.isArray(raw.found)) {
    const found = [...new Set(raw.found.filter(key => typeof key === 'string' && Object.hasOwn(trailFinds,key)))];
    if (found.length) economy.found = found;
  }
  return economy;
}

export function trailFind(state, region, site) {
  const key = keyFor(region,site);
  return Object.hasOwn(trailFinds,key) && !state.economy.found?.includes(key) ? ITEMS[trailFinds[key]] : null;
}

export function gatherTrailFind(state, region, site) {
  const {world, economy} = state;
  if (world.region !== region || world.node !== site || region > world.unlocked || requirements(world,region,site).length) {
    return failure('Reach the trail sign to gather the find.');
  }
  const item = trailFind(state,region,site);
  if (!item) return failure('There is nothing left to gather here.');
  const count = economy.bag[item.id] ?? 0;
  if (!Number.isSafeInteger(count + 1)) return failure('Your bag cannot hold another.');
  economy.bag[item.id] = count + 1;
  (economy.found ??= []).push(keyFor(region,site));
  return success(`Gathered ${item.name}. Added to your bag.`);
}

function atMarket(state, region) {
  return Number.isInteger(region) && !!MARKETS[region] && state.world?.node === 'town' &&
    state.world.region === region && region <= state.world.unlocked;
}

export function awardCoins(state, encounter, firstClear = false) {
  const area = REGIONS[encounter?.region];
  if (!area) return 0;
  const bonus = {warden:22, arena:16, legendary:24, wonder:36}[encounter.kind] ??
    (['outpost','den','sentinel'].includes(encounter.node) ? 9 : 0);
  const reward = 10 + area.id * 3 + bonus + (firstClear ? 7 : 0);
  const amount = Math.min(reward, Number.MAX_SAFE_INTEGER - state.economy.coins);
  state.economy.coins += amount;
  return amount;
}
export function battleSupplies(state) {
  return Object.values(ITEMS).filter(item => battleSupplyKinds.has(item.kind) && state.economy.bag[item.id] > 0)
    .map(item => ({...item, count:state.economy.bag[item.id]}));
}

function removeItem(state, id) {
  const bag = state.economy.bag;
  if (!safeCount(bag[id])) return false;
  if (--bag[id] === 0) delete bag[id];
  return true;
}
export function spendSupply(state, id) {
  const item = itemEntry(id);
  return !!item && battleSupplyKinds.has(item.kind) && removeItem(state, id);
}

export function buyItem(state, region, id) {
  if (!atMarket(state, region)) return failure('Visit this market to trade.');
  const store = MARKETS[region];
  if (!Object.hasOwn(store.stock, id)) return failure('This shop does not stock that supply.');
  const item = ITEMS[id], cost = store.stock[id], purse = state.economy;
  if (purse.coins < cost) return failure('You need ' + (cost - purse.coins) + ' more coins.');
  const count = purse.bag[id] ?? 0;
  if (!Number.isSafeInteger(count + 1)) return failure('Your bag cannot hold another.');
  purse.coins -= cost;
  purse.bag[id] = count + 1;
  return success(item.name + ' added to your bag.');
}

export function itemOffer(region, id) {
  const item = itemEntry(id), market = MARKETS[region];
  if (!item || !market) return 0;
  if (item.kind === 'trade') return item.demandRegion === region ? item.value : Math.floor(item.value * .65);
  // Supplies imported from other regions command better resale prices.
  return Math.max(1, Math.floor(item.value * (Object.hasOwn(market.stock, id) ? .40 : .60)));
}
export function sellItem(state, region, id) {
  if (!atMarket(state, region)) return failure('Visit this market to trade.');
  const price = itemOffer(region, id);
  if (!price || !safeCount(state.economy.bag[id])) return failure('That supply is no longer in your bag.');
  if (!Number.isSafeInteger(state.economy.coins + price)) return failure('Your purse is full.');
  removeItem(state, id);
  state.economy.coins += price;
  return success('Sold one ' + ITEMS[id].name + ' for ' + price + ' coins.');
}

const rarityValue = {Common:12, Uncommon:19, Scarce:30, Rare:47, Legendary:95, 'Hyper Rare':228};
function critterValue(member) {
  const species = SPECIES[member.speciesId];
  return rarityValue[species.rarity] + 3 * member.level + 6 * getForm(member).stage;
}
export function critterStock(region) {
  const store = MARKETS[region], area = REGIONS[region];
  if (!store) return [];
  return store.speciesIds.map((speciesId, index) => {
    const member = {speciesId, level:area.minLevel + index};
    return {...member, price:Math.ceil(critterValue(member) * 2.05)};
  });
}
export function buyCritter(state, region, speciesId) {
  if (!atMarket(state, region)) return failure('Visit this market to trade.');
  const offer = critterStock(region).find(row => row.speciesId === speciesId);
  if (!offer) return failure('This trader has no such Critter.');
  if (state.economy.coins < offer.price) return failure('You need ' + (offer.price - state.economy.coins) + ' more coins.');
  const member = makeMember(speciesId, offer.level);
  if (state.roster.some(m => m.uid === member.uid)) return failure('Please try the purchase again.');
  const recruit = addCapture(state, member);
  state.economy.coins -= offer.price;
  const place = state.party.includes(recruit.uid) ? 'party' : 'reserve';
  return success(getForm(recruit).name + ' joined your ' + place + '.');
}

export function critterOffer(state, region, uid) {
  const member = state.roster.find(m => m.uid === uid);
  const store = MARKETS[region], species = member && SPECIES[member.speciesId];
  if (!member || !species || !store) return null;
  const wanted = species.role === store.demand;
  const price = Math.floor(critterValue(member) * (wanted ? 1.45 : 1));
  const remaining = state.roster.filter(m => m.uid !== uid && SPECIES[m.speciesId]);
  const active = remaining.filter(m => state.party.includes(m.uid));
  return {member, wanted, price, sellable:remaining.length > 0, replacement:active.length ? null : remaining[0] ?? null};
}
export function sellCritter(state, region, uid, expectedPrice) {
  if (!atMarket(state, region)) return failure('Visit this market to trade.');
  const quote = critterOffer(state, region, uid);
  if (!quote) return failure('This Critter is no longer in your roster.');
  if (!quote.sellable) return failure('You need one Critter to continue your expedition.');
  if (quote.price !== expectedPrice) return failure('The offer changed. Review the current price before selling.');
  if (!Number.isSafeInteger(state.economy.coins + quote.price)) return failure('Your purse is full.');
  state.roster = state.roster.filter(m => m.uid !== uid);
  const retained = new Set(state.roster.map(m => m.uid));
  state.party = state.party.filter(id => retained.has(id));
  if (quote.replacement) state.party.push(quote.replacement.uid);
  state.economy.coins += quote.price;
  return success(getForm(quote.member).name + ' sold for ' + quote.price + ' coins.' +
    (quote.replacement ? ' ' + getForm(quote.replacement).name + ' joined your party.' : ''));
}

export function feedCritter(state, id, uid) {
  const item = itemEntry(id), member = state.roster.find(m => m.uid === uid);
  if (!item || item.kind !== 'food' || !safeCount(state.economy.bag[id])) return failure('Choose food from your bag.');
  if (!member || member.level >= MAX_LEVEL) return failure('Choose a Critter below maximum level.');
  removeItem(state, id);
  const name = getForm(member).name;
  const events = awardXP(state, item.power, [uid]);
  return success([name + ' earned ' + item.power + ' XP.', ...events].join(' '));
}
