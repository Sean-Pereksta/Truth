/* The unchanged Windows runtime and models live in the base ZIP. The overlay
 * supplies updated entries and one complete ZIP directory for the download. */
(() => {
  'use strict';
  const headerSize=28;
  const linkSelector='a[href="?download=pc"]';
  let busy=false;

  async function resource(path){
    const response=await fetch('assets/'+path);
    if(!response.ok)throw new Error('Missing download resource');
    return response.blob();
  }
  function crc(bytes){
    let value=0xffffffff;
    for(const byte of bytes){
      value^=byte;
      for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0);
    }
    return (value^0xffffffff)>>>0;
  }
  async function download(){
    if(busy)return;
    busy=true;
    notice('Preparing the Windows download…');
    try{
      const [base,overlay]=await Promise.all([resource('Acorn-Rally-PC.zip'),resource('pc-expansion.bin')]);
      const head=new DataView(await overlay.slice(0,headerSize).arrayBuffer());
      const field=offset=>head.getUint32(offset,true);
      const cut=field(12),addition=overlay.slice(headerSize);
      if(new TextDecoder().decode(head.buffer.slice(0,8))!=='ACORNZIP'||base.size!==field(8)||
         cut>=base.size||addition.size!==field(20)||
         crc(new Uint8Array(await base.slice(cut).arrayBuffer()))!==field(16)||
         crc(new Uint8Array(await addition.arrayBuffer()))!==field(24)){
        throw new Error('Mismatched download resources');
      }
      const url=URL.createObjectURL(new Blob([base.slice(0,cut),addition],{type:'application/zip'}));
      const a=document.createElement('a');
      a.href=url;a.download='Acorn-Rally-PC.zip';document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      notice('PC edition ready. Extract the ZIP and open Start Acorn Rally.cmd.');
    }catch{
      notice('PC download interrupted. Check your connection and select PC edition to retry.');
    }finally{busy=false;}
  }
  document.addEventListener('click',event=>{
    if(event.target.closest(linkSelector)&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){
      event.preventDefault();download();
    }
  });
  if(new URLSearchParams(location.search).get('download')==='pc')download();
})();
