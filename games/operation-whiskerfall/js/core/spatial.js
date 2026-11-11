(function () {
  'use strict';
  window.OW = window.OW || {};
  OW.clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  OW.dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  OW.wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
  OW.SpatialGrid = class {
    constructor(size = 180) { this.size = size; this.cells = new Map(); }
    clear() { this.cells.clear(); }
    insert(o) {
      const key = Math.floor(o.x / this.size) + ':' + Math.floor(o.y / this.size);
      let list = this.cells.get(key);
      if (!list) this.cells.set(key, list = []);
      list.push(o);
    }
    query(x, y, r) {
      const out = [], size = this.size;
      for (let a = Math.floor((x-r)/size); a <= Math.floor((x+r)/size); a++)
        for (let b = Math.floor((y-r)/size); b <= Math.floor((y+r)/size); b++) {
          const cell = this.cells.get(a+':'+b);
          if (cell) for (const o of cell) if ((o.x-x)**2+(o.y-y)**2 <= r*r) out.push(o);
        }
      return out;
    }
  };
  OW.Pool = class {
    constructor(limit) { this.limit = limit; this.items = []; this.cursor = 0; }
    take(data) {
      let item;
      for (let n=0; n<this.items.length; n++) {
        const i = (this.cursor+n)%this.items.length;
        if (!this.items[i].alive) { item=this.items[i]; this.cursor=i+1; break; }
      }
      if (!item && this.items.length < this.limit) this.items.push(item={});
      if (!item) return null;
      for (const k in item) delete item[k];
      Object.assign(item, data, {alive:true});
      return item;
    }
    reset() { this.items.length=0; this.cursor=0; }
  };
}());
