// Resizing changes presentation only; no geometry or camera reset.
export function installResizers(main){
 const min=140,centerMin=240,desktop=()=>matchMedia("(min-width: 651px)").matches;
 const clamp=(side,width)=>{const other=main.querySelector(side==="left"?".right":".left").getBoundingClientRect().width;return Math.round(Math.min(Math.max(min,width),Math.max(min,main.clientWidth-other-centerMin)));};
 function set(side,width){const value=clamp(side,width);main.style.setProperty("--"+side+"-width",value+"px");main.querySelector("#resize-"+side).setAttribute("aria-valuenow",String(value));}
 for(const side of ["left","right"]){
  const handle=main.querySelector("#resize-"+side),panel=main.querySelector("."+side);let start=null;
  handle.addEventListener("pointerdown",e=>{if(!desktop()||e.button!==0)return;e.preventDefault();start={x:e.clientX,width:panel.getBoundingClientRect().width};handle.setPointerCapture(e.pointerId);main.classList.add("resizing");});
  handle.addEventListener("pointermove",e=>{if(start)set(side,start.width+(e.clientX-start.x)*(side==="left"?1:-1));});
  const end=()=>{start=null;main.classList.remove("resizing");};handle.addEventListener("pointerup",end);handle.addEventListener("pointercancel",end);handle.addEventListener("lostpointercapture",end);
  handle.addEventListener("keydown",e=>{if(!desktop()||!["ArrowLeft","ArrowRight"].includes(e.key))return;e.preventDefault();set(side,panel.getBoundingClientRect().width+(e.key==="ArrowRight"?1:-1)*(side==="left"?1:-1)*(e.shiftKey?40:10));});
  handle.addEventListener("dblclick",()=>{main.style.removeProperty("--"+side+"-width");});
 }
}
