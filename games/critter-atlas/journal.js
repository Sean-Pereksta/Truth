import {
  SPECIES, REGIONS, EVOLUTION_LEVELS, MAX_LEVEL, PARTY_LIMIT,
  getAbilities, getAura, getForm, makeMember, xpToNext
} from './catalog.js';
import { ensureWorld, freshWorld, restoreWonderTrails } from './world.js';
import { hasSite } from './frontier-routes.js';
import { freshEconomy, restoreEconomy } from './economy.js';

const SAVE_KEY = 'catnmice.critter-atlas.expedition.v1';
const VERSION = 1;

function nonnegative(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}
function isSpecies(id) {
  return Number.isInteger(id) && id >= 0 && id < SPECIES.length;
}
function validRegion(index) {
  return Number.isInteger(index) && index >= 0 && index < REGIONS.length;
}
function advance(member, amount) {
  member.xp += amount;
  while (member.level < MAX_LEVEL && member.xp >= xpToNext(member.level)) {
    member.xp -= xpToNext(member.level);
    member.level++;
  }
  if (member.level === MAX_LEVEL) member.xp = 0;
}
function readMember(data) {
  if (!data || !isSpecies(data.speciesId) || typeof data.uid !== 'string' ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(data.uid)) return null;
  const member = { uid: data.uid, speciesId: data.speciesId, level: Math.min(MAX_LEVEL, nonnegative(data.level) || 1), xp: 0 };
  advance(member, nonnegative(data.xp));
  return member;
}
function restoreWorld(data, region, unlocked) {
  const fresh = freshWorld();
  if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
  fresh.wonders = restoreWonderTrails(data.wonders);
  fresh.unlocked = validRegion(data.unlocked) ? data.unlocked : (validRegion(unlocked) ? unlocked : 0);
  fresh.region = Math.min(fresh.unlocked, validRegion(data.region) ? data.region : (validRegion(region) ? region : 0));
  if (hasSite(fresh.region, data.node)) fresh.node = data.node;
  fresh.visits = nonnegative(data.visits);
  const isSite = value => {
    const match = typeof value === 'string' && /^(0|[1-9]\d*)\/([a-z]+)$/.exec(value);
    return !!match && validRegion(Number(match[1])) && hasSite(Number(match[1]), match[2]);
  };
  for (const key of ['cleared', 'clues', 'hunts']) {
    if (Array.isArray(data[key])) fresh[key] = [...new Set(data[key].filter(isSite))];
  }
  if (data.patrols && typeof data.patrols === 'object') {
    for (const [key, count] of Object.entries(data.patrols)) {
      if (isSite(key)) fresh.patrols[key] = nonnegative(count);
    }
  }
  if (data.sightings && typeof data.sightings === 'object') {
    for (const [key, count] of Object.entries(data.sightings)) {
      if (/^(0|[1-9]\d*)$/.test(key) && validRegion(Number(key))) {
        fresh.sightings[key] = count === -1 ? -1 : nonnegative(count);
      }
    }
  }
  return ensureWorld(fresh);
}

export function newJournal(starterId = 0) {
  const lead = [0, 1, 2].includes(starterId) ? starterId : 0;
  const roster = [makeMember(lead, 3), makeMember((lead + 1) % 3, 3)];
  return {
    version: VERSION, roster, party: roster.map(m => m.uid), seen: roster.map(m => m.speciesId), savedAt: 0,
    wins: REGIONS.map(() => 0), region: 0, unlocked: 0, world: freshWorld(), economy: freshEconomy()
  };
}

export function parseJournal(saved) {
  try {
    const data = JSON.parse(saved);
    if (data?.version !== VERSION || !Array.isArray(data.roster)) return null;
    const roster = [];
    const uids = new Set();
    for (const raw of data.roster) {
      const member = readMember(raw);
      if (member && !uids.has(member.uid)) {
        roster.push(member);
        uids.add(member.uid);
      }
    }
    if (!roster.length) return null;
    const oldParty = Array.isArray(data.party) ? data.party : [];
    const party = [...new Set(oldParty.filter(uid => uids.has(uid)))].slice(0, PARTY_LIMIT);
    if (!party.length) party.push(roster[0].uid);
    const seen = Array.isArray(data.seen) ? data.seen.filter(isSpecies) : [];
    const world = restoreWorld(data.world, data.region, data.unlocked);
    return {
      version: VERSION, roster, party, savedAt: Math.min(8.64e15, nonnegative(data.savedAt)),
      seen: [...new Set([...seen, ...roster.map(m => m.speciesId)])],
      wins: REGIONS.map((_, index) => nonnegative(data.wins?.[index])),
      region: world.region, unlocked: world.unlocked, world, economy: restoreEconomy(data.economy)
    };
  } catch {
    return null;
  }
}

export function loadJournal(storage) {
  try {
    return parseJournal((storage ?? globalThis.localStorage)?.getItem(SAVE_KEY));
  } catch {
    return null;
  }
}

export function serializeJournal(state, savedAt = Date.now()) {
  return JSON.stringify({ ...state, savedAt });
}

export function saveJournal(state, storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    if (!target) return false;
    const savedAt = Date.now();
    target.setItem(SAVE_KEY, serializeJournal(state, savedAt));
    state.savedAt = savedAt;
    return true;
  } catch {
    return false;
  }
}

export function getParty(state) {
  const members = new Map(state.roster.map(member => [member.uid, member]));
  return state.party.map(uid => members.get(uid)).filter(Boolean);
}

export function setParty(state, uids) {
  if (!Array.isArray(uids) || !uids.length || uids.length > PARTY_LIMIT || new Set(uids).size !== uids.length) return false;
  if (uids.some(uid => !state.roster.some(member => member.uid === uid))) return false;
  state.party = [...uids];
  return true;
}

export function addCapture(state, specimen) {
  const existing = state.roster.find(member => member.uid === specimen.uid);
  if (existing) return existing;
  const member = readMember(specimen);
  if (!member) throw new TypeError('Invalid captured Critter');
  state.roster.push(member);
  if (state.party.length < PARTY_LIMIT) state.party.push(member.uid);
  if (!state.seen.includes(member.speciesId)) state.seen.push(member.speciesId);
  return member;
}

export function awardXP(state, amount, participantUids = state.party) {
  const earned = nonnegative(Math.floor(amount));
  if (!earned) return [];
  const participants = new Set(participantUids);
  const notices = [];
  for (const member of state.roster) {
    if (!participants.has(member.uid) || member.level >= MAX_LEVEL) continue;
    const previous = { ...member };
    advance(member, earned);
    if (previous.level === member.level) continue;
    const form = getForm(member);
    const steps = EVOLUTION_LEVELS.filter(level => level > previous.level && level <= member.level);
    if (steps.length) {
      const names = [getForm(previous).name, ...steps.map(level => getForm({ ...member, level }).name)];
      notices.push(names.join(' → ') + ' · evolved at Lv. ' + steps.join(', ') + '.');
    }
    const learned = getAbilities(member).filter(move => move.learnLevel > previous.level).map(move => move.name);
    const learnedText = learned.length ? ' Learned ' + learned.join(', ') + '.' : '';
    notices.push(form.name + ' reached Lv. ' + member.level + '.' + learnedText);
    const aura = getAura(member);
    if (aura && !getAura(previous)) notices.push(form.name + ' unlocked ' + aura.name + '.');
  }
  return notices;
}
