/* The reader sits above either the battlefield or the menu that opened it. */
(function () {
  'use strict';
  const W=window.OW, U=W.UI.prototype;
  const element=(tag,cls,content)=>{
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(content)node.textContent=content;
    return node;
  };
  const asset=path=>(W.config.assetBaseURL||'assets').replace(/\/$/,'')+'/'+path;
  function paint(g){
    const reader=g.comic, book=reader.book, i=reader.index, panel=book.panels[i], root=reader.element;
    root.replaceChildren();
    const page=element('article','comic-page'), header=element('header');
    header.append(element('h2','',book.title),element('span','comic-count',(i+1)+' / '+book.panels.length));
    const picture=element('div','comic-picture'), img=element('img');
    img.alt=panel.alt||'';img.src=asset(panel.art);
    if(panel.crop){
      const {cols,rows,col,row}=panel.crop;
      // ViewBox keeps the whole selected frame visible at every aspect ratio.
      const NS='http://www.w3.org/2000/svg', svg=document.createElementNS(NS,'svg'), sheet=document.createElementNS(NS,'image');
      const clip=document.createElementNS(NS,'clipPath'),bounds=document.createElementNS(NS,'rect');
      clip.id='comic-panel-bounds';clip.append(bounds);svg.append(clip);sheet.setAttribute('clip-path','url(#comic-panel-bounds)');
      svg.setAttribute('aria-label',img.alt);svg.setAttribute('role','img');
      const fit=()=>{
        const w=img.naturalWidth/cols,h=img.naturalHeight/rows;
        svg.setAttribute('viewBox',[col*w,row*h,w,h].join(' '));
        bounds.setAttribute('x',col*w);bounds.setAttribute('y',row*h);bounds.setAttribute('width',w);bounds.setAttribute('height',h);
        sheet.setAttribute('width',img.naturalWidth);sheet.setAttribute('height',img.naturalHeight);
      };
      sheet.setAttribute('href',img.src);svg.append(sheet);picture.append(svg);
      if(img.complete&&img.naturalWidth)fit();else img.onload=fit;
    }else{
      if(panel.artStyle?.objectPosition)img.style.objectPosition=panel.artStyle.objectPosition;
      picture.append(img);
    }
    const caption=element('p','comic-caption',panel.caption);caption.setAttribute('aria-live','polite');
    const actions=element('footer'), skip=element('button','','Skip strip'), next=element('button','primary',i===book.panels.length-1?'Continue':'Next panel');
    skip.onclick=()=>advance(g,true);next.onclick=()=>advance(g);
    const owner=g.ui.activeController||0;
    const confirm=g.input.glyph?.(owner,0)||'A',back=g.input.glyph?.(owner,1)||'B';
    actions.append(element('small','','Enter / '+confirm+' · Advance　 Esc / '+back+' · Skip'),skip,next);
    page.append(header,picture,caption,actions);root.append(page);
  }
  function show(g,book){
    if(!book?.panels?.length)return false;
    if(g.comic){g.comicQueue.push(book);return true;}
    const root=element('section','comic-reader');
    root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label',book.title);root.tabIndex=-1;
    g.comicQueue ||= [];
    g.comic={book,index:W.clamp(book.index||0,0,book.panels.length-1),element:root,paused:g.paused,focus:document.activeElement};
    g.input.clear();g.paused=true;document.body.append(root);document.body.classList.add('reading-comic');
    g.ui.root.inert=true;paint(g);root.focus();return true;
  }
  function close(g){
    const reader=g.comic;if(!reader)return;
    reader.element.remove();document.body.classList.remove('reading-comic');g.ui.root.inert=false;
    g.comic=null;g.input.clear();g.paused=reader.paused||g.ui.isOpen;
    (reader.focus?.isConnected?reader.focus:g.canvas).focus();
  }
  function advance(g,skip=false){
    const reader=g.comic;if(!reader)return false;
    if(!skip&&reader.index+1<reader.book.panels.length){
      reader.index++;paint(g);reader.book.onPage?.(reader.index);reader.element.focus();return true;
    }
    close(g);reader.book.onEnd?.();if(!g.comic&&g.comicQueue.length)show(g,g.comicQueue.shift());return true;
  }
  function reset(g){close(g);g.comicQueue=[];}
  const pad=U.handleCoopPadInput;
  U.handleCoopPadInput=function(input,device,edge,held,owner,blocked){
    if(!this.game.comic&&input.comicSnapshot!==input.snapshot)return pad.apply(this,arguments);
    held.forEach((v,i)=>{if(v)blocked.add(i);});
    if(this.game.comic&&input.comicSnapshot!==input.snapshot&&(edge[0]||edge[1])){
      input.comicSnapshot=input.snapshot;advance(this.game,edge[1]);
    }
    return true;
  };
  const keyboard=U.handleCoopKeyboardInput;
  U.handleCoopKeyboardInput=function(input){
    if(!this.game.comic&&input.comicSnapshot!==input.snapshot)return keyboard.apply(this,arguments);
    if(input.comicSnapshot===input.snapshot)return true;
    const keys=input.snapshot,skip=keys.has('Escape')||keys.has(input.bindings.pause);
    if(skip||keys.has('Enter')||keys.has('NumpadEnter')||keys.has('Space')){
      input.comicSnapshot=keys;advance(this.game,skip||document.activeElement?.textContent==='Skip strip');
    }
    return true;
  };
  window.addEventListener('keydown',event=>{
    if(W.game?.comic&&['Space','Enter','NumpadEnter','Escape'].includes(event.code))event.preventDefault();
  });
  W.Comics={show,advance,reset,asset};
})();
