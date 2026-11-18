(function(root){
  'use strict';
  const sim=root.AcornSim;
  const colors=['#beaa77','#45d9ff','#ffab36','#fa67f2'];
  const maxTracks=2304, floatsPerTrack=60, life=20;
  const rear=[[-.526,.29,-.61],[.526,.29,-.61]];
  function wheelAxes(kart,road){
    const yaw=Math.atan2(road.tx,road.tz)+(kart.yaw||0);
    return {cos:Math.cos(yaw),sin:Math.sin(yaw)};
  }
  function wheelPoint(kart,road,axes,index){
    const pivot=root.AcornKartModels?.[kart.driverIndex]?.pivots?.[index+1]||rear[index];
    return {x:road.x+axes.cos*pivot[0]+axes.sin*pivot[2],z:road.z-axes.sin*pivot[0]+axes.cos*pivot[2]};
  }
  class SkidMarks{
    constructor(course){
      this.course=course;this.time=-1;this.lastAdded=-life;this.next=0;this.count=0;this.dirty=0;
      this.vertices=new Float32Array(maxTracks*floatsPerTrack);
      this.progress=new Float64Array(maxTracks);this.last=new Map();
    }
    update(st){
      if(st.time<this.time-.25){
        this.last.clear();this.next=0;this.count=0;this.dirty=0;this.time=-1;
      }
      if(st.time<=this.time)return;
      this.time=st.time;
      if(this.count&&st.time-this.lastAdded>=life){this.next=0;this.count=0;this.dirty=0;}
      for(const kart of st.racers){
        if(!kart.prevDrift||!(kart.driftSlip>=.52)||kart.v<7||kart.air>0||kart.flight||kart.fall||
            kart.ghost>0||kart.finish||(kart.driverIndex===7&&kart.active>0)){
          this.last.delete(kart.seat);continue;
        }
        const old=this.last.get(kart.seat),course=this.course,road=sim.sample(course,kart.s,kart.x,kart.branch);
        const distance=old?Math.hypot(road.x-old.x,road.z-old.z):0;
        const age=old?st.time-old.time:0;
        const continuous=old&&kart.branch===old.branch&&age<.24&&Math.abs(kart.s-old.s)<5&&distance<4;
        if(continuous&&distance<.54)continue;
        const axes=wheelAxes(kart,road),tires=[];
        for(let i=0;i<2;i++){
          const at=wheelPoint(kart,road,axes,i),lane=sim.projectRoute(course,kart.s,at.x,at.z,kart.branch);
          const width=.112+.042*kart.driftSlip;
          if(Math.abs(lane.x)+width>lane.road.w||Math.hypot(lane.road.x-at.x,lane.road.z-at.z)>.10){
            tires.push(null);continue;
          }
          // An underspeed kart on the lower catch shelf is beneath the ramp mesh.
          const shelf=kart.catchShelf&&lane.s>=kart.catchShelf.start-.06&&lane.s<kart.catchShelf.end;
          const y=shelf?sim.sample(course,lane.s,lane.x,kart.branch).y:lane.road.y;
          const point={x:at.x,y:y+(kart.branch?.082:.055),z:at.z,wx:axes.cos*width,wz:-axes.sin*width,load:kart.driftSlip};
          tires.push(point);
          const previous=continuous&&old.tires[i];
          if(previous&&Math.abs(previous.y-point.y)<.17+distance*.7)this.add(previous,point,lane.s);
        }
        this.last.set(kart.seat,{x:road.x,z:road.z,s:kart.s,time:st.time,branch:kart.branch,tires});
      }
    }
    add(a,b,s){
      const slot=this.next;this.next=(slot+1)%maxTracks;
      this.lastAdded=this.time;
      this.count=Math.min(maxTracks,this.count+1);this.dirty=Math.min(maxTracks,this.dirty+1);
      this.progress[slot]=s;
      let at=slot*floatsPerTrack;
      const vertex=(point,edge)=>{
        const v=this.vertices;
        v[at]=point.x+edge*point.wx;v[at+1]=point.y;v[at+2]=point.z+edge*point.wz;
        v[at+4]=1;v[at+6]=this.time;v[at+7]=edge;v[at+8]=point.load;v[at+9]=20;
        at+=10;
      };
      vertex(a,-1);vertex(a,1);vertex(b,1);vertex(a,-1);vertex(b,1);vertex(b,-1);
    }
    upload(gl,mesh){
      mesh.n=this.count*6;
      if(!this.dirty)return;
      gl.bindBuffer(gl.ARRAY_BUFFER,mesh.b);
      const start=(this.next-this.dirty+maxTracks)%maxTracks;
      const send=(a,b)=>{if(b>a)gl.bufferSubData(gl.ARRAY_BUFFER,a*floatsPerTrack*4,this.vertices.subarray(a*floatsPerTrack,b*floatsPerTrack));};
      if(start<this.next)send(start,this.next);else{send(start,maxTracks);send(0,this.next);}
      this.dirty=0;
    }
    canvasRows(st,progress,direction,worldPoint){
      const rows=new Map(),v=this.vertices,length=this.course.length;
      for(let slot=0;slot<this.count;slot++){
        const offset=slot*floatsPerTrack,age=st.time-v[offset+6];
        if(age>=life)continue;
        const gap=root.AcornSignatures.gap(progress,this.progress[slot],length)*direction,row=Math.floor(gap/1.35);
        if(row< -3||row>72)continue;
        const corners=[0,10,20,50].map(index=>worldPoint(v[offset+index],v[offset+index+1],v[offset+index+2]));
        if(corners.some(p=>p.z<.5))continue;
        if(!rows.has(row))rows.set(row,[]);
        rows.get(row).push({corners,opacity:(.42+.30*v[offset+8])*Math.min(1,(life-age)/5)});
      }
      return rows;
    }
  }
  function charge(kart,time){
    if(kart.fall||kart.flight||kart.air>0||kart.ghost>0||kart.finish)return 0;
    const elapsed=time-(kart.driftReleaseAt??-10);
    if(kart.driftReleaseTier>0&&elapsed>=0&&elapsed<.31)return kart.driftReleaseTier;
    return kart.prevDrift?sim.driftTier(kart.drift):0;
  }
  function meshes(Mesh){
    const result={};
    for(let tier=1;tier<=3;tier++){
      const m=new Mesh(),t=[0,.025,-.42],a=[-.05,0,0],b=[0,.075,.025],c=[.05,0,0],d=[0,-.03,0];
      m.tri(a,b,t,colors[tier],5);m.tri(b,c,t,'#fffae2',5);m.tri(c,d,t,colors[tier],5);m.tri(d,a,t,colors[tier],5);
      result['driftSpark'+tier]=m;
    }
    return result;
  }
  function sparks(kart,road,floor,time,stamp){
    const tier=charge(kart,time);if(!tier)return;
    const axes=wheelAxes(kart,road),yaw=Math.atan2(axes.sin,axes.cos);
    const burst=!kart.prevDrift,rate=burst?6.2:4.7;
    for(let i=0;i<2;i++){
      const wheel=wheelPoint(kart,road,axes,i),side=i?1:-1;
      for(let j=0;j<tier+1;j++){
        const phase=(time*rate+j*.317+i*.47)%1;
        const trail=.1+phase*(burst?1.55:.82),spread=(.12+phase*(.17+j*.13))*side;
        const x=wheel.x+axes.cos*spread-axes.sin*trail,z=wheel.z-axes.sin*spread-axes.cos*trail;
        const y=road.y+floor+.13+Math.sin(phase*Math.PI)*(.15+.07*j);
        stamp('driftSpark'+tier,[x,y,z],yaw-side*(.27+j*.15),(.9+.12*tier)*(1-.56*phase),1,0,.15);
      }
    }
  }
  root.AcornDriftArt={SkidMarks,charge,colors,meshes,sparks};
})(window);
