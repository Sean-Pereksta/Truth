(function () {
  'use strict';
  window.OW = window.OW || {};
  const prefix = 'whiskerfall.save.v1.';
  const fallback = new Map();
  const attempts = new Map();
  const validSlot = slot => Number.isInteger(Number(slot)) && Number(slot) >= 0 && Number(slot) <= 2;
  const parseRecord = raw => {
    try {
      const record = raw && JSON.parse(raw);
      if (!record || record.format !== 'operation-whiskerfall' || record.version !== 1 || !Save.validData(record.data)) return null;
      const savedAt = Number(record.savedAt) || Date.parse(record.data.savedAt) || 0;
      return {raw, data:record.data, savedAt:Number.isFinite(savedAt) ? savedAt : 0};
    } catch (_) { return null; }
  };
  const storageReason = error => error?.name === 'QuotaExceededError' || error?.code === 22 || error?.code === 1014
    ? 'Browser storage is full.' : 'The browser could not store this campaign permanently.';
  class Save {
    static validPlayer(p) {
      if (!p || typeof p !== 'object' || Array.isArray(p)) return false;
      if (!['x','y','hp','maxHp','level'].every(key=>Number.isFinite(p[key]))) return false;
      if (p.hp < 0 || p.maxHp <= 0 || p.maxHp > 10000000 || p.level < 1 || p.level > 10000) return false;
      if (!Array.isArray(p.inventory) || p.inventory.length > 10000 || !p.inventory.every(item=>typeof item === 'string' || item && typeof item.id === 'string')) return false;
      if (!p.skills || typeof p.skills !== 'object' || Array.isArray(p.skills) || !Object.values(p.skills).every(value=>Number.isFinite(value) && value >= 0 && value <= 100)) return false;
      for (const [key,catalog] of [['weapon','weapons'],['secondary','weapons'],['melee','melee'],['ability','abilities'],['ability2','abilities']]) {
        if (p[key] === undefined) continue;
        if (!Number.isInteger(p[key]) || p[key] < 0 || p[key] >= (OW.Content?.[catalog]?.length || 1000)) return false;
      }
      for (const key of ['cooldowns','stats','equipment','weaponUpgrades']) if (p[key] !== undefined && (!p[key] || typeof p[key] !== 'object' || Array.isArray(p[key]))) return false;
      if (p.equipment && !Object.values(p.equipment).every(item=>item && typeof item === 'object' && !Array.isArray(item))) return false;
      if (p.unlockedArmorSets !== undefined && (!Array.isArray(p.unlockedArmorSets) || !p.unlockedArmorSets.every(index=>Number.isInteger(index) && index >= 0 && index <= 2))) return false;
      if (p.unlockedAbilities !== undefined && (!Array.isArray(p.unlockedAbilities) || p.unlockedAbilities.length > 100 || !p.unlockedAbilities.every(id=>typeof id === 'string' && OW.Content.abilities.some(a=>a.id===id && a.unlockCost>0)))) return false;
      if (p.abilityCooldowns !== undefined && (!p.abilityCooldowns || typeof p.abilityCooldowns !== 'object' || Array.isArray(p.abilityCooldowns) || !Object.entries(p.abilityCooldowns).every(([id,time])=>OW.Content.abilities.some(a=>a.id===id) && Number.isFinite(time) && time >= 0 && time <= 3600))) return false;
      if (p.skillPoints !== undefined && (!Number.isFinite(p.skillPoints) || p.skillPoints < 0)) return false;
      if (p.weaponTunes !== undefined) {
        const modes=['power','rapid','tactical'];
        if (!p.weaponTunes || typeof p.weaponTunes !== 'object' || Array.isArray(p.weaponTunes) || !Object.values(p.weaponTunes).every(tune=>tune && Array.isArray(tune.unlocked) && tune.unlocked.every(mode=>modes.includes(mode)) && (tune.active == null || modes.includes(tune.active)))) return false;
      }
      return true;
    }
    static validData(data) {
      if (!(data && data.version === 1 && typeof data === 'object' && !Array.isArray(data) && data.world && typeof data.world === 'object' && !Array.isArray(data.world) && Array.isArray(data.players) && data.players.length > 0 && data.players.length <= 2 && data.players.every(Save.validPlayer) && (!data.reservePlayer || Save.validPlayer(data.reservePlayer)))) return false;
      for (const key of ['dead','liberated','discovered','opened','locations','enemies']) if (data.world[key] !== undefined && !Array.isArray(data.world[key])) return false;
      for (const key of ['locations','enemies']) if (data.world[key] && !data.world[key].every(item=>item && typeof item.id === 'string')) return false;
      for (const key of ['completedQuests','acceptedQuests','missionCompleted']) if (data[key] !== undefined && !Array.isArray(data[key])) return false;
      if (data.missionRuns !== undefined) {
        if (!data.missionRuns || typeof data.missionRuns !== 'object' || Array.isArray(data.missionRuns)) return false;
        if (!Object.values(data.missionRuns).every(run=>run && typeof run === 'object' && !Array.isArray(run) && ['x','y','hp','maxHp','elapsed','duration','targetX','targetY'].every(key=>run[key] === undefined || Number.isFinite(run[key])))) return false;
      }
      if (data.questStats) {
        if (typeof data.questStats !== 'object' || Array.isArray(data.questStats)) return false;
        for (const key of ['explored','caches','rescued','convoys']) if (data.questStats[key] !== undefined && !Array.isArray(data.questStats[key])) return false;
      }
      return true;
    }
    static record(slot) {
      if (!validSlot(slot)) return {record:null, unreadable:false, unavailable:false};
      slot = Number(slot);
      const key = prefix + slot, candidates = [];
      let unreadable = false, unavailable = false;
      const add = (raw, source, durable) => {
        if (!raw) return;
        const record = parseRecord(raw);
        if (record) candidates.push({...record, source, durable}); else unreadable = true;
      };
      // Compare all available copies. An unsuccessful write must never make an
      // older persistent save win over the newer progress still held in memory.
      add(fallback.get(slot), 'memory', false);
      try { if (typeof sessionStorage !== 'undefined') add(sessionStorage.getItem(key + '.pending'), 'session', false); } catch (_) { unavailable = true; }
      try { add(localStorage.getItem(key), 'primary', true); } catch (_) { unavailable = true; }
      try { add(localStorage.getItem(key + '.backup'), 'backup', true); } catch (_) { unavailable = true; }
      candidates.sort((a,b) => b.savedAt - a.savedAt || Number(b.durable) - Number(a.durable) || Number(a.source === 'backup') - Number(b.source === 'backup'));
      const record = candidates[0] || null;
      if (record && !record.durable) record.retention = candidates.some(candidate => candidate.source === 'session' && candidate.raw === record.raw) ? 'session' : 'memory';
      return {record, unreadable, unavailable};
    }
    static read(slot) {
      const {record} = Save.record(slot);
      Save.temporary = !!record && !record.durable;
      return record?.data || null;
    }
    static status(slot) {
      if (!validSlot(slot)) return {state:'error', savedAt:0, reason:'Choose a valid campaign slot.'};
      const last = attempts.get(Number(slot)), {record, unreadable, unavailable} = Save.record(slot);
      if (last?.state === 'error') return {...last, savedAt:record?.savedAt || 0};
      if (!record) return {state:unreadable || unavailable ? 'error' : 'empty', savedAt:0, unavailable,
        reason:unavailable ? 'Browser storage could not be read. Your stored campaign has not been changed.' : unreadable ? 'This campaign could not be read. Its stored copies have been kept.' : ''};
      return {state:record.durable ? 'saved' : 'temporary', savedAt:record.savedAt,
        reason:record.durable ? (record.source === 'backup' ? 'Recovered the previous saved copy.' : '') : (last?.reason || 'This progress is available only in this browser session.'),
        retention:record.retention, recovered:record.source === 'backup'};
    }
    static write(slot, data) {
      if (!validSlot(slot)) return false;
      slot = Number(slot);
      const key = prefix + slot;
      try {
        if (!Save.validData(data)) throw Error('Campaign data did not pass its save checks. The previous save has been kept.');
        const previous = Save.record(slot).record;
        const savedAt = Math.max(Date.now(), (previous?.savedAt || 0) + 1);
        const raw = JSON.stringify({ format: 'operation-whiskerfall', version: 1, savedAt, data });
        if (!parseRecord(raw)) throw Error('Campaign data could not be restored after saving. The previous save has been kept.');
        let oldPrimary;
        try { oldPrimary = localStorage.getItem(key); } catch (_) {}
        fallback.set(slot, raw);
        try {
          localStorage.setItem(key, raw);
          if (localStorage.getItem(key) !== raw) throw Error('The browser did not retain the new save.');
          Save.temporary = false;
          attempts.set(slot, {state:'saved', savedAt, reason:''});
          // A backup failure must not invalidate a successfully committed save.
          if (parseRecord(oldPrimary)) try { localStorage.setItem(key + '.backup', oldPrimary); } catch (_) {}
          try { sessionStorage.removeItem(key + '.pending'); } catch (_) {}
        } catch (error) {
          Save.temporary = true;
          attempts.set(slot, {state:'temporary', savedAt, reason:storageReason(error)});
          // Session storage survives a page reload in the same tab. It is still
          // explicitly temporary: closing the browser requires an exported file.
          try { sessionStorage.setItem(key + '.pending', raw); } catch (_) {}
        }
        return true;
      } catch (error) {
        attempts.set(slot, {state:'error', savedAt:0, reason:error instanceof TypeError ? 'Campaign data could not be serialized. The previous save has been kept.' : error.message || 'Saving failed. The previous save has been kept.'});
        return false;
      }
    }
    static slots() {
      return Array.from({ length: 3 }, (_, slot) => {
        const data = Save.record(slot).record?.data, status = Save.status(slot), savedAt = status.savedAt;
        const p = data && (data.players || [data.player])[0];
        return { slot, empty: !data, valid: !!data, name: data && data.name || 'Resistance campaign', level: p && p.level || 1,
          coop: !!(data && data.players && data.players.length > 1), savedAt,
          state:status.state, reason:status.reason, recovered:!!status.recovered, unavailable:!!status.unavailable,
          region: data && (data.regionName || data.region) || 'The animal kingdoms', playTime: data && (data.playTime || data.time) || 0 };
      });
    }
    static export(slot) {
      const data = Save.read(slot);
      return data ? JSON.stringify({ format: 'operation-whiskerfall', version: 1, data }, null, 2) : '';
    }
    static import(slot, text) {
      try {
        if (typeof text !== 'string' || text.length > 10000000) return false;
        const record = JSON.parse(text);
        const data = record.format === 'operation-whiskerfall' && record.version === 1 ? record.data : record.version === 1 ? record : null;
        if (!Save.validData(data)) return false;
        return Save.write(slot, data);
      } catch (_) { return false; }
    }
    static exportData(slot) { return Save.export(slot); }
    static importData(slot, text) { return Save.import(slot, text); }
  }
  Save.temporary = false;
  OW.Save = Save;
})();
