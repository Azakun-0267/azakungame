
(function(){
  function $(id){ return document.getElementById(id); }
  function cpuLevel(){
    const sel = $("cpuLevelSelect");
    return Math.max(0, Math.min(9, Number(sel ? sel.value : 5)));
  }
  function cpuCount(){
    const sel = $("cpuCountSelect");
    return Math.max(0, Math.min(3, Number(sel ? sel.value : 1)));
  }
  function bindCPUFix(){
    const sel = $("cpuLevelSelect");
    if(sel && !sel.__cpuFixBound){
      sel.__cpuFixBound = true;
      sel.addEventListener("change", function(){
        try{
          if(window.socket && window.currentRoom) socket.emit("setCPU", {code:currentRoom, level:cpuLevel(), count:cpuCount()});
        }catch(e){ console.warn(e); }
      });
    }

    const start = $("startBtn");
    if(start && !start.__cpuStartFixBound){
      start.__cpuStartFixBound = true;
      start.addEventListener("click", function(){
        try{
          if(window.socket && window.currentRoom){
            socket.emit("setCPU", {code:currentRoom, level:cpuLevel(), count:cpuCount()});
            setTimeout(()=>socket.emit("startBattle", {code:currentRoom}), 80);
          }
        }catch(e){ console.warn(e); }
      }, true);
    }

    const create = $("createBtn");
    if(create && !create.__cpuCreateFixBound){
      create.__cpuCreateFixBound = true;
      create.addEventListener("click", function(){
        try{
          window.__pendingCpuLevel = cpuLevel(); window.__pendingCpuCount = cpuCount();
        }catch(e){}
      }, true);
    }
  }
  setInterval(bindCPUFix, 500);
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindCPUFix);
  else bindCPUFix();
})();
