
(function(){
  function enable(id){
    var b=document.getElementById(id);
    if(!b) return;
    b.disabled=false;
    b.style.pointerEvents="auto";
    b.style.opacity="1";
  }
  function boot(){
    [
      "loginBtn","guestBtn","startBtn","createRoomBtn","joinRoomBtn",
      "readyBtn","leaveRoomBtn","backTitleBtn","backLobbyBtn"
    ].forEach(enable);
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
