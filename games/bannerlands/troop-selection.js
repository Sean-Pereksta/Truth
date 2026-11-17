// A filter remembers the original, explicitly selected force until the player
// makes a new selection. Commands still operate only on the visible subset.
export function createTroopSelectionFilter(){
 let group=null,last=null,active='all';
 const same=(a,b)=>a.size===b.size&&[...a].every(id=>b.has(id));
 return {
  reset(){group=null;last=null;active='all';},
  sync(selection,isLiving){
   if(!group)return;
   for(const id of group)if(!isLiving(id))group.delete(id);
   for(const id of last)if(!isLiving(id))last.delete(id);
   if(!group.size||!same(selection,last))this.reset();
  },
  apply(kind,selection,isLiving,classOf){
   this.sync(selection,isLiving);
   if(!group){if(!selection.size)return null;group=new Set([...selection].filter(isLiving));}
   if(!group.size){this.reset();return null;}
   active=kind;
   last=new Set([...group].filter(id=>kind==='all'||classOf(id)===kind));
   return new Set(last);
  },
  get hasGroup(){return !!group?.size;},
  get active(){return active;}
 };
}
export function troopFilterShortcut(event,{panelOpen,formationMode,hasSelection}){
 if(panelOpen||formationMode||!hasSelection||!event.shiftKey||event.ctrlKey||event.altKey||event.metaKey)return null;
 const digit=/^(?:Digit|Numpad)([1-4])$/.exec(event.code)?.[1]||(/^[1-4]$/.test(event.key)?event.key:null);
 return ({1:'infantry',2:'archer',3:'cavalry',4:'all'})[digit]||null;
}
