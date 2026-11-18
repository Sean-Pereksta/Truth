'use strict';
window.AcornHorizon={
 glsl:`
 uniform sampler2D viewHorizon;
 vec3 backdrop(vec2 uv, float heading, float aspect, vec3 fallback){
   float horizontal = atan((uv.x-.5)*1.08*aspect);
   float longitude = (heading-horizontal)*.318309886+.48;
   float u=1.-abs(fract(longitude*.5)*2.-1.);
   float v=clamp(.55-(uv.y-.55)*.87,.003,.997);
   vec4 sampleHorizon=texture2D(viewHorizon,vec2(u,v));
   return mix(fallback,mix(sampleHorizon.rgb,fallback,.16),sampleHorizon.a);
 }`,
 load(gl,i){
   const texture=gl.createTexture(),slot=gl.getParameter(gl.ACTIVE_TEXTURE);
   gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,texture);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([128,128,128,0]));
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
   gl.activeTexture(slot);
   const image=new Image();
   image.onload=()=>{
     if(gl.isContextLost()||!gl.isTexture(texture))return;
     const previous=gl.getParameter(gl.ACTIVE_TEXTURE),flip=gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
     gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,texture);
     gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
     gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,flip);gl.activeTexture(previous);
   };
   image.src='art/horizon-'+i+'.webp';return texture;
 }
};
