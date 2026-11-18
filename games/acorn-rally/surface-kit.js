'use strict';
window.AcornSurfaces={
 glsl:`
 uniform sampler2D groundAtlas;
 vec3 materialGrain(vec3 wp, vec3 normal, float mat, float trackId) {
   float tile = trackId;
   vec2 dir = wp.xz * .34;
   if(mat > 1.5 && mat < 2.5){
     tile = abs(normal.y) > .71 ? 9. : (trackId == 1. ? 11. : 8.);
     dir = abs(normal.y) > .71 ? wp.xz*.38 : vec2(wp.x+wp.z,wp.y)*vec2(.47,.26);
   } else if(mat > 2.5 && mat < 3.5) {
     tile = (trackId == 0. || trackId == 6.) ? 10. : 12.;
     dir = (wp.xz + wp.y * .37) * .63;
   } else if(mat > 5.5 && mat < 6.5) {
     tile = (trackId == 7.) ? 15. : ((trackId == 3. || trackId == 5.) ? 14. : 6.);
     dir = abs(normal.y) > .5 ? wp.xz * .42 : vec2(wp.x+wp.z,wp.y)*.33;
   } else if(mat < .5 || mat > 1.5) { return vec3(1.); }
   vec2 cell = vec2(mod(tile,4.),floor(tile/4.));
   vec2 within = abs(fract(dir*.5)*2.-1.)*.991+.0045;
   vec3 sampleColor=texture2D(groundAtlas,(cell+within)*.25).rgb;
   return mix(vec3(1.),sampleColor*(255./128.),.75);
 }`,
 load(gl){
   const texture=gl.createTexture(),slot=gl.getParameter(gl.ACTIVE_TEXTURE);
   gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,texture);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,1,1,0,gl.RGB,gl.UNSIGNED_BYTE,new Uint8Array([128,128,128]));
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
   gl.activeTexture(slot);
   const img=new Image();
   img.onload=()=>{
     if(gl.isContextLost()||!gl.isTexture(texture))return;
     const previous=gl.getParameter(gl.ACTIVE_TEXTURE),flip=gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
     gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
     gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,img);
     gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
     const aniso=gl.getExtension('EXT_texture_filter_anisotropic');
     if(aniso)gl.texParameterf(gl.TEXTURE_2D,aniso.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(4,gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
     gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,flip);gl.activeTexture(previous);
   };
   img.src='art/trail-materials.webp';return texture;
 }
};
