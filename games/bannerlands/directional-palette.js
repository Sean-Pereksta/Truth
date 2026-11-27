// Painted uniforms reuse the same mask across every house. Keep compact frames
// together so a crowded battlefield can draw thousands of colors and poses
// without reading pixels back or allocating a canvas for each soldier.
const PAGE_SIZE=1024, MAX_PAGES=16;
export class DirectionalPalette {
  constructor(){
    this.sources=new WeakMap();
    this.pages=[];
    this.clock=0;
    this.scratch=document.createElement('canvas');
    this.reader=this.scratch.getContext('2d',{willReadFrequently:true});
  }
  source(row,col,angle){
    let cells=this.sources.get(row);
    if(!cells){cells=[];this.sources.set(row,cells);}
    const index=angle*row.columns.size+col;
    if(cells[index])return cells[index];
    const w=row.w,h=row.h,ctx=this.reader;
    if(this.scratch.width<w)this.scratch.width=w;
    if(this.scratch.height<h)this.scratch.height=h;
    ctx.clearRect(0,0,w,h);
    ctx.drawImage(row.img,col*w,angle*h,w,h,0,0,w,h);
    const raw=ctx.getImageData(0,0,w,h).data;
    let left=w,top=h,right=-1,bottom=-1;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      if(!raw[(y*w+x)*4+3])continue;
      if(x<left)left=x;if(x>right)right=x;if(y<top)top=y;if(y>bottom)bottom=y;
    }
    if(right<left){left=top=right=bottom=0;}
    const width=right-left+1,height=bottom-top+1;
    const cell={left,top,width,height,colors:new Map(),smallColors:new Map()};
    cells[index]=cell;
    if(!row.tint)return cell;
    const pixels=ctx.createImageData(width,height),mask=[];
    for(let y=0;y<height;y++){
      const start=((top+y)*w+left)*4;
      pixels.data.set(raw.subarray(start,start+width*4),y*width*4);
    }
    const data=pixels.data;
    for(let i=0;i<data.length;i+=4){
      if(data[i+3]&&data[i+2]>data[i]*1.8&&data[i+2]>data[i+1]*1.28)mask.push(i);
    }
    cell.pixels=pixels;cell.mask=mask;return cell;
  }
  allocate(width,height){
    let page=this.pages.at(-1);
    if(page&&page.x+width+1>PAGE_SIZE){page.x=1;page.y+=page.line+2;page.line=0;}
    if(!page||page.y+height+1>PAGE_SIZE){
      if(this.pages.length===MAX_PAGES){
        page=this.pages.reduce((oldest,p)=>p.last<oldest.last?p:oldest);
        this.pages.splice(this.pages.indexOf(page),1);
        for(const [colors,color] of page.entries)colors.delete(color);
        page.ctx.clearRect(0,0,PAGE_SIZE,PAGE_SIZE);
      }else{
        const canvas=document.createElement('canvas');canvas.width=canvas.height=PAGE_SIZE;
        page={canvas,ctx:canvas.getContext('2d')};
      }
      page.x=1;page.y=1;page.line=0;page.entries=[];this.pages.push(page);
    }
    return page;
  }
  frame(row,col,angle,color,small){
    const cell=this.source(row,col,angle),colors=small?cell.smallColors:cell.colors,cached=colors.get(color);
    if(cached){cached.page.last=++this.clock;return cached;}
    const w=small?Math.ceil(cell.width/2):cell.width,h=small?Math.ceil(cell.height/2):cell.height;
    const page=this.allocate(w,h);
    if(color===null){
      page.ctx.drawImage(row.img,col*row.w+cell.left,angle*row.h+cell.top,cell.width,cell.height,page.x,page.y,w,h);
    }else{
      const pixels=this.reader.createImageData(cell.width,cell.height);
      pixels.data.set(cell.pixels.data);
      const rgb=parseInt(color.slice(1),16),red=rgb>>16,green=(rgb>>8)&255,blue=rgb&255;
      for(const i of cell.mask){
        const shade=cell.pixels.data[i+2]/186;
        pixels.data[i]=red*shade;pixels.data[i+1]=green*shade;pixels.data[i+2]=blue*shade;
      }
      if(small){
        // The authored sheets have two source pixels per world pixel. At lower
        // zoom, keep the filtered result that will actually reach the display.
        this.reader.putImageData(pixels,0,0);
        page.ctx.drawImage(this.scratch,0,0,cell.width,cell.height,page.x,page.y,w,h);
      }else page.ctx.putImageData(pixels,page.x,page.y);
    }
    const frame={page,x:page.x,y:page.y,w,h,cell};
    colors.set(color,frame);page.entries.push([colors,color]);
    page.x+=w+2;page.line=Math.max(page.line,h);page.last=++this.clock;
    return frame;
  }
}
