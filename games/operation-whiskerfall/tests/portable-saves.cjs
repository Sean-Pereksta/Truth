/* Isolated browser profile. Exercise real downloads, file inputs and storage. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || undefined,headless:true});
  try{
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.locator('[data-action="launch"]').click();
    await page.waitForFunction(()=>window.OW?.game?.state==='playing');
    // Make the slot identifiable; the reserve hero's pack must survive the transfer.
    const expected=await page.evaluate(()=>{
      const g=OW.game;g.toggleCoop();g.players[1].gold=731;g.toggleCoop();
      g.players[0].gold=827;
      if(!g.save(false))throw Error('Initial save failed');
      g.ui.showMenu('settings');
      return g.players[0].gold;
    });
    const pending=page.waitForEvent('download');
    await page.getByRole('button',{name:'Export campaign'}).click();
    const download=await pending, bytes=await fs.readFile(await download.path());
    const backup=JSON.parse(bytes);
    assert.equal(backup.format,'operation-whiskerfall');
    assert.equal(backup.data.reservePlayer.gold,731);
    const upload=async(buffer)=>page.locator('#import-save').setInputFiles({name:'Campaign.json',mimeType:'application/json',buffer});
    await page.evaluate(()=>{OW.game.players[0].gold=333;OW.game.save(false);});
    await upload(bytes);
    await page.waitForFunction(gold=>OW.game.players[0].gold===gold&&!OW.game.ui.isOpen,expected);
    assert.equal(await page.evaluate(()=>OW.game.reservePlayer.gold),731);
    await page.evaluate(()=>OW.game.ui.showMenu('settings'));
    const key='whiskerfall.save.v1.0';
    const prior=await page.evaluate(key=>localStorage.getItem(key),key);
    await upload(Buffer.from('{"broken":'));
    await page.waitForFunction(()=>document.querySelector('#toast-region').innerText.includes('invalid'));
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),prior);
    // Inject a late failure after a migration save. No slot copy may be replaced.
    assert.ok(await page.evaluate(({key,backup})=>{
      const g=OW.game,load=g.load,primary=localStorage.getItem(key),oldBackup=localStorage.getItem(key+'.backup');
      g.load=()=>{const data=OW.Save.read(0);data.players[0].gold=411;OW.Save.write(0,data);throw Error('Injected late hydration failure');};
      try{return !g.importSave(JSON.stringify(backup))&&primary===localStorage.getItem(key)&&oldBackup===localStorage.getItem(key+'.backup')&&g.players[0].gold===827;}
      finally{g.load=load;}
    },{key,backup}));
    // Verify a cold page reads the durable backup after a damaged primary.
    await page.evaluate(()=>{OW.game.save(false);sessionStorage.setItem('test.corruptOnBoot','1');});
    await page.addInitScript(key=>{
      if(sessionStorage.getItem('test.corruptOnBoot')){
        sessionStorage.removeItem('test.corruptOnBoot');localStorage.setItem(key,'truncated');
      }
    },key);
    await page.reload();await page.waitForFunction(()=>window.OW?.game?.ready);
    assert.ok(await page.evaluate(()=>OW.Save.status(0).recovered));
    await page.locator('[data-action="launch"]').click();
    await page.waitForFunction(()=>OW.game.state==='playing');
    assert.equal(await page.evaluate(()=>OW.game.players[0].gold),827);
    // A refused persistent write should produce a portable session copy and warning.
    const temporary=await page.evaluate(()=>{
      const orig=Storage.prototype.setItem;
      Storage.prototype.setItem=function(k,v){if(this===localStorage)throw new DOMException('Full','QuotaExceededError');return orig.call(this,k,v);};
      const g=OW.game;g.players[0].gold=911;
      const ok=g.save(false);
      return [ok,OW.Save.status(0).state,JSON.parse(OW.Save.export(0)).data.players[0].gold];
    });
    assert.deepEqual(temporary,[true,'temporary',911]);
    await page.reload();await page.waitForFunction(()=>window.OW?.game?.ready);
    await page.locator('[data-action="launch"]').click();
    await page.waitForFunction(()=>OW.game.state==='playing');
    assert.equal(await page.evaluate(()=>OW.game.players[0].gold),911);
    assert.ok(await page.evaluate(()=>OW.game.save(false)&&OW.Save.status(0).state==='saved'));
    assert.deepEqual(errors,[]);
    console.log('PASS · file download and restore, resting partner, invalid file, late-load rollback, cold backup recovery, temporary reload and durable retry');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
