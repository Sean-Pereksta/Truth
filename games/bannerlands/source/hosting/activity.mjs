// Only the installed host's private desktop capability can renew this lease.
// Guest API traffic must never keep an abandoned hosting process alive.
export function createDesktopActivity({now=Date.now,graceMs=180000}={}){
  let lastActivity=now();
  return {touch(){lastActivity=now();},expired(){return now()-lastActivity>=graceMs;},lastSeen(){return lastActivity;}};
}
