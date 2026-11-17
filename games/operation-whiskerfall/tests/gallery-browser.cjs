'use strict';
const path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
  try{
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname,'../art-gallery.html')).href);
    const count=await page.evaluate(async()=>{
      let count=0;
      for(const [id,g] of Object.entries(window.FieldworkGallery)){
        document.querySelector('[data-tab="'+id+'"]').click();
        const cards=[...document.querySelectorAll('article')];
        if(cards.length!==g.entries.length)throw Error(g.name);
        for(const card of cards){
          const im=card.querySelector('img'),link=card.querySelector('a');
          if(!im||!link||link.href!==im.src||!card.querySelector('h2').textContent.trim())throw Error(id+' gallery card');
          im.loading='eager';
        }
        await Promise.all(cards.map(c=>c.querySelector('img').decode()));count+=cards.length;
      }
      document.querySelector('[data-tab="enemies"]').click();
      if(!document.querySelector('article canvas'))throw Error('Enemy preview');
      return count;
    });
    await page.waitForFunction(()=>Object.keys(images).length>0);assert.deepEqual(errors,[]);
    console.log('Direct-file art library decoded '+count+' fieldwork illustrations and sheets and restored the animated enemy gallery.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
