
const socket = io();

const magicianRabbitImage = new Image();
magicianRabbitImage.src = "/assets/magician_rabbit_clean.png";


const skillSprites = {};
[
  "rabbit_idle","rabbit_hat","rabbit_hat_front","rabbit_magic","rabbit_doves","rabbit_end",
  "dove_white","dove_black","gift_box","box_burst","clown","candy","bomb"
].forEach(name=>{
  const img = new Image();
  img.src = "/assets/" + name + ".png";
  skillSprites[name] = img;
});


const $ = id => document.getElementById(id);

const screens = {
  title:$("titleScreen"),
  login:$("loginScreen"),
  select:$("selectScreen"),
  room:$("roomScreen"),
  battle:$("battleScreen")
};

function showScreen(name){
  Object.values(screens).forEach(s => s.classList.remove("active"));
  screens[name].classList.add("active");
}

const CHARACTERS = {
  magician_rabbit:{label:"マジシャンラビット",desc:"杖・鳩・びっくり箱・玉乗りで戦う奇術師。",color:"#fff1c9",accent:"#d71920",skin:"#fff1c9",hair:"#111",image:"/assets/magician_rabbit_clean.png"}
};

const STAGES = [
  {name:"クラシック",desc:"中央が広い基本ステージ。",bg:"#101631",floor:"#25314f",platforms:[{x:65,y:320,w:570,h:26},{x:185,y:235,w:160,h:16},{x:355,y:235,w:160,h:16},{x:285,y:165,w:130,h:16}]},
  {name:"ツインタワー",desc:"左右の高台で空中戦。",bg:"#17102b",floor:"#432a68",platforms:[{x:90,y:305,w:520,h:24},{x:115,y:230,w:140,h:16},{x:445,y:230,w:140,h:16},{x:290,y:160,w:120,h:16}]},
  {name:"ロングブリッジ",desc:"横に長く吹っ飛ばし勝負。",bg:"#10251e",floor:"#245a44",platforms:[{x:75,y:312,w:550,h:22},{x:185,y:236,w:95,h:14},{x:420,y:236,w:95,h:14}]},
  {name:"スカイリング",desc:"足場が小さく落下しやすい。",bg:"#102635",floor:"#2d6f88",platforms:[{x:180,y:300,w:340,h:22},{x:105,y:230,w:100,h:14},{x:495,y:230,w:100,h:14},{x:305,y:170,w:90,h:14}]}
];

let profile = null;
let selectedCharacter = "magician_rabbit";

const rabbitImage = new Image();
rabbitImage.src = "/assets/magician_rabbit_cutout.png";
let selectedStage = 0;
let currentRoom = null;
let mySlot = null;
let roomState = null;

const canvas = $("game");
const ctx = canvas.getContext("2d");

const input = {left:false,right:false,moveLeft:false,moveRight:false,dirLeft:false,dirRight:false,up:false,down:false,jump:false,attack:false,special:false,skillE:false,skillQ:false,smash:false,guard:false};

let audioCtx = null;
function initAudio(){
  if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function tone(f,d,t="square",v=.04){
  if(!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = t;
  o.frequency.value = f;
  g.gain.setValueAtTime(v,audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+d);
  o.connect(g);
  g.connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime+d);
}

function sfx(type){
  if(type==="hit"){tone(110,.08,"sawtooth",.07);setTimeout(()=>tone(75,.08,"sawtooth",.05),45);}
  if(type==="attack")tone(650,.05,"square",.035);
  if(type==="burst")tone(80,.18,"sawtooth",.09);
  if(type==="win"){tone(523,.1);setTimeout(()=>tone(659,.1),120);setTimeout(()=>tone(784,.16),240);}
  if(type==="magic")tone(440,.08,"triangle",.04);
}

$("toLoginBtn").onclick = () => showScreen("login");
$("toRoomBtn").onclick = () => showScreen("room");
$("backSelectBtn").onclick = () => showScreen("select");
$("leaveBtn").onclick = () => showScreen("select");

function miniFighter(c){
  if(c.image){
    return `<img class="miniFighter" src="${c.image}" style="object-fit:contain;width:76px;height:96px;left:52px;bottom:2px;">`;
  }
  return `<svg class="miniFighter" viewBox="0 0 42 62">
    <rect x="14" y="2" width="14" height="10" fill="${c.hair}"/>
    <rect x="12" y="10" width="18" height="14" fill="${c.skin}"/>
    <rect x="8" y="24" width="26" height="22" fill="${c.color}"/>
    <rect x="12" y="30" width="18" height="5" fill="${c.accent}"/>
    <rect x="2" y="25" width="8" height="20" fill="${c.skin}"/>
    <rect x="32" y="25" width="8" height="20" fill="${c.skin}"/>
    <rect x="11" y="46" width="8" height="14" fill="${c.accent}"/>
    <rect x="23" y="46" width="8" height="14" fill="${c.accent}"/>
    <rect x="23" y="15" width="4" height="4" fill="white"/>
  </svg>`;
}

function stagePreview(s){
  const plats = s.platforms.map(p => `<div class="miniPlat" style="left:${p.x/4}px;top:${p.y/4}px;width:${p.w/4}px;height:${Math.max(3,p.h/4)}px;background:${s.floor}"></div>`).join("");
  return `<div class="preview" style="background:${s.bg}">${plats}</div>`;
}

function renderCharacterCards(targetId, onClick){
  const wrap = $(targetId);
  wrap.innerHTML = "";
  Object.entries(CHARACTERS).forEach(([key,c]) => {
    const d = document.createElement("div");
    d.className = "card" + (selectedCharacter === key ? " selected" : "");
    d.innerHTML = `<b>${c.label}</b><div class="preview">${miniFighter(c)}</div><div class="small">${c.desc}</div>`;
    d.onclick = () => {
      initAudio();
      selectedCharacter = key;
      renderAllCards();
      if(onClick) onClick(key);
    };
    wrap.appendChild(d);
  });
}

function renderStageCards(targetId, onClick){
  const wrap = $(targetId);
  wrap.innerHTML = "";
  STAGES.forEach((s,i) => {
    const d = document.createElement("div");
    d.className = "card" + (selectedStage === i ? " selected" : "");
    d.innerHTML = `<b>${s.name}</b>${stagePreview(s)}<div class="small">${s.desc}</div>`;
    d.onclick = () => {
      initAudio();
      selectedStage = i;
      renderAllCards();
      if(onClick) onClick(i);
    };
    wrap.appendChild(d);
  });
}

function renderAllCards(){
  renderCharacterCards("charCards", key => socket.emit("selectInRoom", {code:currentRoom, character:key, stageVote:selectedStage}));
  renderStageCards("stageCards", i => socket.emit("selectInRoom", {code:currentRoom, character:selectedCharacter, stageVote:i}));

  renderCharacterCards("roomCharCards", key => {
    if(currentRoom) socket.emit("selectInRoom", {code:currentRoom, character:key, stageVote:selectedStage});
  });
  renderStageCards("roomStageCards", i => {
    if(currentRoom) socket.emit("selectInRoom", {code:currentRoom, character:selectedCharacter, stageVote:i});
  });
}

function updateProfile(){
  const txt = profile
    ? (profile.guest ? `${profile.username}（ゲスト）` : `${profile.username} 勝ち:${profile.wins} 負け:${profile.losses} コイン:${profile.coins}`)
    : "未ログイン";

  $("profile").textContent = txt;
  $("profile2").textContent = txt;
}

function updatePlayerList(){
  const list = $("playerList");
  list.innerHTML = "";

  if(!roomState) return;

  for(const p of roomState.players){
    const charName = CHARACTERS[p.character]?.label || p.character;
    const stageName = STAGES[p.stageVote]?.name || "未選択";
    const host = p.id === roomState.hostId ? "（ホスト）" : (p.isCPU ? "（CPU）" : "");

    const box = document.createElement("div");
    box.className = "playerBox";
    box.innerHTML = `<b>${p.name}${host}</b><br>キャラ：${charName}<br>ステージ候補：${stageName}`;
    list.appendChild(box);
  }

  $("startBtn").style.display = roomState.hostId === socket.id ? "inline-block" : "none";
  const cpuSel = $("cpuLevelSelect");
  const cpuCountSel = $("cpuCountSelect");
  if(cpuSel && roomState.hostId === socket.id) {
    cpuSel.disabled = false;
    cpuSel.value = String(roomState.cpuLevel ?? cpuSel.value ?? 5);
  } else if(cpuSel) {
    cpuSel.disabled = true;
  }
  if(cpuCountSel && roomState.hostId === socket.id) {
    cpuCountSel.disabled = false;
    cpuCountSel.value = String(roomState.cpuCount ?? cpuCountSel.value ?? 1);
  } else if(cpuCountSel) {
    cpuCountSel.disabled = true;
  }
  if(roomState.spectators){
    const box = document.createElement("div");
    box.className = "playerBox";
    box.innerHTML = `<b>観戦者</b><br>${roomState.spectators}人`;
    list.appendChild(box);
  }
}

$("registerBtn").onclick = () => {
  initAudio();
  socket.emit("register", {username:$("usernameInput").value, password:$("passwordInput").value});
};

$("loginBtn").onclick = () => {
  initAudio();
  socket.emit("login", {username:$("usernameInput").value, password:$("passwordInput").value});
};

$("guestBtn").onclick = () => {
  initAudio();
  socket.emit("guest", {guestName:$("usernameInput").value || "Guest", character:selectedCharacter});
};

$("createBtn").onclick = () => {
  initAudio();
  socket.emit("createRoom", {
    guestName:$("usernameInput").value || "Guest",
    character:selectedCharacter,
    stageVote:selectedStage,
    cpuLevel:Number(document.getElementById("cpuLevelSelect")?.value ?? 5),
    cpuCount:Number(document.getElementById("cpuCountSelect")?.value ?? 1)
  });
};

$("joinBtn").onclick = () => {
  initAudio();
  socket.emit("joinRoom", {
    code:$("codeInput").value,
    guestName:$("usernameInput").value || "Guest",
    character:selectedCharacter,
    stageVote:selectedStage
  });
};

function emitCPUSetting(){
  initAudio();
  if(currentRoom) socket.emit("setCPU", {
    code:currentRoom,
    level:Number($("cpuLevelSelect")?.value ?? 5),
    count:Number($("cpuCountSelect")?.value ?? 1)
  });
}
$("cpuLevelSelect").onchange = emitCPUSetting;
$("cpuCountSelect").onchange = emitCPUSetting;

$("startBtn").onclick = () => {
  initAudio();
  if(currentRoom) socket.emit("startBattle", currentRoom);
};

$("restartBtn").onclick = () => {
  initAudio();
  if(currentRoom) socket.emit("restart", currentRoom);
};

socket.on("profile", data => {
  profile = data;
  selectedCharacter = "magician_rabbit";
  updateProfile();
  renderAllCards();
  showScreen("select");
});

socket.on("authError", msg => alert(msg));
socket.on("errorMessage", msg => alert(msg));

socket.on("joinedRoom", data => {
  currentRoom = data.code;
  mySlot = data.slot;
  roomState = data.room;
  $("roomCode").textContent = data.code;
  updatePlayerList();
  if($("cpuLevelSelect") && roomState) $("cpuLevelSelect").value = String(roomState.cpuLevel ?? 5);
  if($("cpuCountSelect") && roomState) $("cpuCountSelect").value = String(roomState.cpuCount ?? 1);
  renderAllCards();
  showScreen(data.spectator ? "battle" : "room");
});

let seenEffects = new Set();

socket.on("roomState", data => {
  roomState = data;

  $("message").textContent = data.message + " / " + (data.stageName || "");
  $("battleInfo").textContent = `部屋:${data.code} / ステージ:${data.stageName || ""} / 観戦:${data.spectators || 0}`;

  updatePlayerList();

  if(data.status === "playing") showScreen("battle");
  if(data.status === "lobby") showScreen("room");

  if(data.effects){
    for(const e of data.effects){
      const k = e.type + Math.round(e.x) + Math.round(e.y) + e.life;
      if(!seenEffects.has(k)){
        sfx(e.type);
        seenEffects.add(k);
      }
    }
  }

  if(seenEffects.size > 120){
    seenEffects = new Set(Array.from(seenEffects).slice(-60));
  }
});

renderAllCards();

document.addEventListener("keydown", e => {
  initAudio();

  // Movement is A/D only
  if(e.key === "a" || e.key === "A") input.moveLeft = true;
  if(e.key === "d" || e.key === "D") input.moveRight = true;

  // Arrow keys are skill directions only
  if(e.key === "ArrowLeft") input.dirLeft = true;
  if(e.key === "ArrowRight") input.dirRight = true;
  if(e.key === "ArrowUp") input.up = true;
  if(e.key === "ArrowDown" || e.key === "s" || e.key === "S") input.down = true;

  if(e.key === "w" || e.key === "W" || e.key === " ") input.jump = true;

  // E = direction attack, Q = direction special
  if(e.key === "e" || e.key === "E") input.skillE = true;
  if(e.key === "q" || e.key === "Q") input.skillQ = true;

  // U = smash
  if(e.key === "u" || e.key === "U") input.smash = true;
  if(e.key === "Shift" || e.key === "1") input.guard = true;

  input.attack = input.skillE;
  input.special = input.skillQ;
});

document.addEventListener("keyup", e => {
  if(e.key === "a" || e.key === "A") input.moveLeft = false;
  if(e.key === "d" || e.key === "D") input.moveRight = false;

  if(e.key === "ArrowLeft") input.dirLeft = false;
  if(e.key === "ArrowRight") input.dirRight = false;
  if(e.key === "ArrowUp") input.up = false;
  if(e.key === "ArrowDown" || e.key === "s" || e.key === "S") input.down = false;

  if(e.key === "w" || e.key === "W" || e.key === " ") input.jump = false;

  if(e.key === "e" || e.key === "E") input.skillE = false;
  if(e.key === "q" || e.key === "Q") input.skillQ = false;

  if(e.key === "u" || e.key === "U") input.smash = false;
  if(e.key === "Shift" || e.key === "1") input.guard = false;

  input.attack = input.skillE;
  input.special = input.skillQ;
});

const buttons = [
  {key:"moveLeft",x:24,y:316,w:46,h:46,text:"A"},
  {key:"moveRight",x:76,y:316,w:46,h:46,text:"D"},
  {key:"down",x:50,y:366,w:46,h:28,text:"S"},

  {key:"dirLeft",x:140,y:322,w:42,h:42,text:"←"},
  {key:"dirRight",x:230,y:322,w:42,h:42,text:"→"},
  {key:"up",x:185,y:278,w:42,h:42,text:"↑"},
  {key:"down",x:185,y:344,w:42,h:42,text:"↓"},

  {key:"jump",x:480,y:322,w:54,h:52,text:"JMP"},
  {key:"skillE",x:540,y:322,w:50,h:52,text:"E"},
  {key:"skillQ",x:595,y:322,w:48,h:52,text:"Q"},
  {key:"smash",x:648,y:322,w:44,h:52,text:"U"},
  {key:"guard",x:540,y:270,w:110,h:44,text:"GUARD"}
];

function screenToGame(x,y){
  const r = canvas.getBoundingClientRect();
  return {x:(x-r.left)*canvas.width/r.width, y:(y-r.top)*canvas.height/r.height};
}

function touchUpdate(touches){
  for(const k of Object.keys(input)) input[k] = false;

  for(const t of touches){
    const p = screenToGame(t.clientX, t.clientY);

    for(const b of buttons){
      if(p.x >= b.x && p.x <= b.x+b.w && p.y >= b.y && p.y <= b.y+b.h){
        input[b.key] = true;
      }
    }
  }

  // movement
  input.left = !!input.moveLeft;
  input.right = !!input.moveRight;

  // attack buttons
  input.attack = !!input.skillE;
  input.special = !!input.skillQ;
  if(input.guard){ input.moveLeft=false; input.moveRight=false; input.left=false; input.right=false; input.jump=false; input.attack=false; input.special=false; input.skillE=false; input.skillQ=false; input.smash=false; }

  // direction only applies to skills/smash, not movement
  if((input.skillE || input.skillQ || input.smash) && input.dirLeft) input.left = true;
  if((input.skillE || input.skillQ || input.smash) && input.dirRight) input.right = true;
}

canvas.addEventListener("touchstart", e => {e.preventDefault(); initAudio(); touchUpdate(e.touches);}, {passive:false});
canvas.addEventListener("touchmove", e => {e.preventDefault(); touchUpdate(e.touches);}, {passive:false});
canvas.addEventListener("touchend", e => {e.preventDefault(); touchUpdate(e.touches);}, {passive:false});

setInterval(() => {
  if(currentRoom && roomState && roomState.status === "playing"){
    const sendInput = {...input};
    sendInput.left = !!input.moveLeft;
    sendInput.right = !!input.moveRight;
    if((input.skillE || input.skillQ || input.smash) && input.dirLeft) sendInput.left = true;
    if((input.skillE || input.skillQ || input.smash) && input.dirRight) sendInput.right = true;
    sendInput.attack = !!input.skillE;
    sendInput.special = !!input.skillQ;
    sendInput.guard = !!input.guard;
    if(input.guard){
      sendInput.left = false;
      sendInput.right = false;
      sendInput.moveLeft = false;
      sendInput.moveRight = false;
      sendInput.jump = false;
      sendInput.attack = false;
      sendInput.special = false;
      sendInput.skillE = false;
      sendInput.skillQ = false;
      sendInput.smash = false;
    }
    socket.emit("input", {code:currentRoom, input:sendInput});
  }
}, 1000 / 60);


function safeNum(v, fallback){ return Number.isFinite(v) ? v : fallback; }

function drawRabbitFallbackPixel(x,y,f,p){
  ctx.save();
  ctx.translate(x+18,y+30);
  ctx.scale(f===1?1:-1,1);

  // pixel rabbit fallback, only used if image/effect fails
  ctx.fillStyle = "#fff1c9";
  ctx.fillRect(-9,-52,6,28);
  ctx.fillRect(5,-52,6,28);
  ctx.fillStyle = "#ffb7d5";
  ctx.fillRect(-7,-47,2,18);
  ctx.fillRect(7,-47,2,18);

  ctx.fillStyle = "#111";
  ctx.fillRect(-17,-36,34,8);
  ctx.fillRect(-10,-52,20,17);
  ctx.fillStyle = "#d71920";
  ctx.fillRect(-10,-39,20,5);

  ctx.fillStyle = "#fff1c9";
  ctx.fillRect(-14,-28,28,22);
  ctx.fillRect(-16,-5,32,32);

  ctx.fillStyle = "#111";
  ctx.fillRect(5,-20,4,4);
  ctx.fillStyle = "#ff9ebd";
  ctx.fillRect(8,-11,4,3);

  ctx.fillStyle = "#d71920";
  ctx.fillRect(-13,0,26,8);
  ctx.fillStyle = "#111";
  ctx.fillRect(-6,5,12,22);

  ctx.fillStyle = "#fff1c9";
  ctx.fillRect(-24,-2,8,25);
  ctx.fillRect(16,-2,8,25);
  ctx.fillRect(-12,27,8,18);
  ctx.fillRect(4,27,8,18);
  ctx.restore();
}

function drawDoveSafe(x,y,dir,isBlack=false,scale=1){
  ctx.save();
  ctx.translate(x,y);
  ctx.scale(dir < 0 ? -scale : scale, scale);
  ctx.fillStyle = isBlack ? "#151515" : "white";
  ctx.beginPath();
  ctx.ellipse(0,0,14,8,0,0,Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-7,-7,13,5,-0.5,0,Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-7,7,13,5,0.5,0,Math.PI*2);
  ctx.fill();
  ctx.fillStyle = isBlack ? "#7b2cff" : "#ffd84d";
  ctx.beginPath();
  ctx.moveTo(14,-2);
  ctx.lineTo(23,3);
  ctx.lineTo(14,7);
  ctx.fill();
  ctx.restore();
}

function drawGiftBoxSafe(x,y,w=34,h=30){
  ctx.fillStyle = "#ffcc33";
  ctx.fillRect(x,y,w,h);
  ctx.fillStyle = "#1976ff";
  ctx.fillRect(x+4,y+5,w-8,h-10);
  ctx.fillStyle = "#ff3333";
  ctx.fillRect(x+w/2-3,y-5,6,h+10);
  ctx.fillRect(x+4,y+h/2-3,w-8,6);
  ctx.strokeStyle = "#111";
  ctx.strokeRect(x,y,w,h);
}

function drawJackboxWobbleSafe(x,y,life){
  const wob = Math.sin((life||10) * 0.35) * 9;
  drawGiftBoxSafe(x-24,y+18,48,38);
  ctx.strokeStyle = "#dddddd";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y+18);
  ctx.bezierCurveTo(x+wob, y+4, x-wob, y-10, x+wob, y-24);
  ctx.stroke();

  ctx.save();
  ctx.translate(x+wob, y-42);
  ctx.rotate(Math.sin((life||10)*0.25)*0.35);
  ctx.fillStyle = "white";
  ctx.fillRect(-18,-12,36,24);
  ctx.fillStyle = "#ff3333";
  ctx.fillRect(-16,6,32,10);
  ctx.fillStyle = "#111";
  ctx.fillRect(-8,-6,4,4);
  ctx.fillRect(5,-6,4,4);
  ctx.fillStyle = "#ff3333";
  ctx.beginPath();
  ctx.arc(0,1,4,0,Math.PI*2);
  ctx.fill();
  ctx.restore();
}

function drawMagicSparkSafe(x,y,life,color="#bb44ff"){
  const r = Math.max(8, 28 - (life||10)*0.3);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x,y,r,0,Math.PI*2);
  ctx.stroke();
}

function drawStage(){
  const stage = (roomState && roomState.stage) ? roomState.stage : STAGES[selectedStage || 0];

  ctx.fillStyle = stage.bg || "#101631";
  ctx.fillRect(0,0,700,400);

  ctx.fillStyle = "rgba(255,255,255,.05)";
  for(let x=0;x<700;x+=35) ctx.fillRect(x,0,1,400);
  for(let y=0;y<400;y+=35) ctx.fillRect(0,y,700,1);

  for(let i=0;i<(stage.platforms || []).length;i++){
    const p = stage.platforms[i];
    ctx.fillStyle = stage.floor || "#25314f";
    ctx.fillRect(p.x,p.y,p.w,p.h);
    ctx.fillStyle = i === 0 ? "rgba(255,255,255,.25)" : "rgba(160,220,255,.22)";
    ctx.fillRect(p.x,p.y,p.w,5);
    ctx.strokeStyle = "rgba(0,0,0,.45)";
    ctx.strokeRect(p.x,p.y,p.w,p.h);
    if(i > 0){
      ctx.fillStyle = "rgba(255,255,255,.45)";
      ctx.font = "10px Arial";
      ctx.fillText("S↓ですり抜け", p.x + 4, p.y - 3);
    }
  }
}



function drawStaffArc(x,y,f,kind="normal",life=10){
  ctx.save();
  ctx.translate(x,y);
  ctx.scale(f===1?1:-1,1);
  const big = kind.includes("smash");
  ctx.strokeStyle = big ? "#ffcc33" : "#ffffff";
  ctx.lineWidth = big ? 9 : 5;
  ctx.beginPath();
  ctx.arc(18, 0, big ? 62 : 42, -0.9, 0.85);
  ctx.stroke();

  ctx.strokeStyle = "#8b4b16";
  ctx.lineWidth = 5;
  const swing = Math.sin((20-life)*0.35) * 12;
  ctx.beginPath();
  ctx.moveTo(5, 8);
  ctx.lineTo(big ? 86 : 62, -8 + swing);
  ctx.stroke();

  ctx.fillStyle = big ? "#ffcc33" : "#ffffff";
  for(let i=0;i<6+(big?5:0);i++){
    const a = -0.8 + i*0.32;
    const r = big ? 62 : 42;
    ctx.fillRect(18+Math.cos(a)*r, Math.sin(a)*r-2, 5, 5);
  }
  ctx.restore();
}

function drawSparkBurst(x,y,life,color1="#ff8844",color2="#4488ff"){
  const t = Math.max(0, life || 10);
  for(let side=-1; side<=1; side+=2){
    for(let i=0;i<8;i++){
      const a = (i/8)*Math.PI*2;
      const r = 16 + (24-t)*1.2;
      ctx.strokeStyle = i%2 ? color1 : color2;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + side*24, y);
      ctx.lineTo(x + side*24 + Math.cos(a)*r, y + Math.sin(a)*r);
      ctx.stroke();
    }
  }
}

function drawHatDoveUp(x,y,life){
  ctx.fillStyle="#111";
  ctx.fillRect(x-20,y+8,40,12);
  ctx.fillRect(x-12,y-8,24,22);
  ctx.fillStyle="#d71920";
  ctx.fillRect(x-12,y+2,24,5);
  drawDoveSafe(x-10,y-26,1,false,0.8);
  drawDoveSafe(x+12,y-38,1,false,0.8);
  drawMagicSparkSafe(x,y,life || 10,"#bb44ff");
}

function drawDownBind(x,y,life){
  ctx.strokeStyle="#bb44ff";
  ctx.lineWidth=5;
  ctx.beginPath();
  ctx.moveTo(x,y);
  ctx.lineTo(x,y+70);
  ctx.stroke();
  for(let i=0;i<4;i++){
    ctx.strokeStyle=i%2?"#ffffff":"#bb44ff";
    ctx.beginPath();
    ctx.arc(x,y+30+i*9,18+i*2,0,Math.PI*2);
    ctx.stroke();
  }
}


function drawGuardBubbleFixed(p,x,y){
  const sh = Math.max(0, Math.min(100, p.shield ?? 100));
  const t = p.guardTimer || 0;
  const r = 34 + sh * 0.20 + Math.sin(t * 0.35) * 2;
  ctx.save();

  // brace/crouch pose overlay
  ctx.globalAlpha = 0.30;
  ctx.fillStyle = "#7cc8ff";
  ctx.fillRect(x+2,y+10,32,34);

  // circular shield
  ctx.globalAlpha = 0.30 + sh / 180;
  ctx.fillStyle = p.shieldBroken ? "rgba(255,70,255,.45)" : "rgba(80,160,255,.45)";
  ctx.beginPath();
  ctx.arc(x+18,y+24,r,0,Math.PI*2);
  ctx.fill();

  ctx.globalAlpha = 0.95;
  ctx.strokeStyle = p.shieldBroken ? "#ff66ff" : "#99ddff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x+18,y+24,r,0,Math.PI*2);
  ctx.stroke();

  // small shine
  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = 0.75;
  ctx.fillRect(x+18-r*0.35,y+24-r*0.65,7,7);

  ctx.restore();
  ctx.globalAlpha = 1;
}



function drawConfusionBreakMotion(p,x,y){
  const t = p.stunTimer || 0;
  const wob = Math.sin(t * 0.28) * 7;
  ctx.save();

  // body purple confusion aura
  ctx.globalAlpha = 0.38;
  ctx.fillStyle = "rgba(190,80,255,.55)";
  ctx.fillRect(x + 2 + wob, y + 8, 32, 42);

  // dizzy spiral over head
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#ff66ff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for(let i=0;i<28;i++){
    const a = i * 0.45 + t * 0.08;
    const r = i * 0.55;
    const sx = x + 18 + Math.cos(a) * r;
    const sy = y - 25 + Math.sin(a) * r;
    if(i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  // stars
  const stars = [[x+0,y-36],[x+20,y-48],[x+42,y-35]];
  ctx.fillStyle = "#ffe45c";
  for(const [sx,sy] of stars){
    ctx.beginPath();
    for(let i=0;i<10;i++){
      const a = -Math.PI/2 + i*Math.PI/5 + t*0.03;
      const r = i%2===0 ? 8 : 3.5;
      ctx.lineTo(sx + Math.cos(a)*r, sy + Math.sin(a)*r);
    }
    ctx.closePath();
    ctx.fill();
  }

  // sweat/confusion marks
  ctx.fillStyle = "#9ee7ff";
  ctx.fillRect(x + 36 - wob, y - 8, 6, 12);
  ctx.fillRect(x - 8 + wob, y + 2, 5, 10);

  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawGuardBubbleAlways(p,x,y){
  const sh = Math.max(0, Math.min(100, p.shield ?? 100));
  const t = p.guardTimer || 0;
  const r = 34 + sh * 0.22 + Math.sin(t * 0.35) * 2;
  ctx.save();

  // ガード構え：少ししゃがんだ青い影
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#7cc8ff";
  ctx.fillRect(x+2,y+12,32,32);

  // 円シールド
  ctx.globalAlpha = 0.32 + sh / 170;
  ctx.fillStyle = p.shieldBroken ? "rgba(255,80,255,.48)" : "rgba(70,155,255,.50)";
  ctx.beginPath();
  ctx.arc(x+18,y+24,r,0,Math.PI*2);
  ctx.fill();

  ctx.globalAlpha = 0.95;
  ctx.strokeStyle = p.shieldBroken ? "#ff66ff" : "#a5e7ff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x+18,y+24,r,0,Math.PI*2);
  ctx.stroke();

  // 光
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x+18-r*0.35,y+24-r*0.65,7,7);

  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawFighter(p){
  try{
    if(!p || !p.alive) return;

    const x = safeNum(p.x,350);
    const y = safeNum(p.y,120);
    const f = p.facing === -1 ? -1 : 1;
    const run = Math.abs(p.vx || 0) > 1 && p.onGround;
    const atk = p.move || null;

    if(p.invincible > 0 && Math.floor(p.invincible/6)%2===0) ctx.globalAlpha = .45;

    if(p.character === "magician_rabbit"){
      // keep the rabbit image look if it is loaded, fallback only if it fails
      let drewImage = false;
      try{
        if(typeof magicianRabbitImage !== "undefined" && magicianRabbitImage && magicianRabbitImage.complete && magicianRabbitImage.naturalWidth > 0){
          ctx.save();
          const bob = run ? Math.sin(Date.now()/80)*3 : Math.sin(Date.now()/350)*1.5;
          let sx = 1, sy = 1, rot = 0;
          if(atk === "magic_poppo"){ rot = f * -0.12; sx = 1.04; }
          if(atk === "random_box"){ rot = f * 0.10; sx = 1.06; }
          if(atk === "rabbit_smash" || atk === "smash"){ rot = f * -0.22; sx = 1.16; sy = 1.08; }

          ctx.translate(x + 18, y + 30 + bob);
          ctx.scale((f === 1 ? 1 : -1) * sx, sy);
          ctx.rotate(rot);
          ctx.drawImage(magicianRabbitImage, -36, -52, 72, 92);
          ctx.restore();
          drewImage = true;
        }
      }catch(e){
        drewImage = false;
      }

      if(!drewImage) drawRabbitFallbackPixel(x,y,f,p);
      ctx.globalAlpha = 1;

      if(atk === "magic_poppo"){
        drawMagicSparkSafe(x + (f===1 ? 54 : -18), y+20, p.moveTimer || 10, "#bb44ff");
        ctx.fillStyle = "#111";
        ctx.fillRect(x + (f===1 ? 38 : -34), y+24, 38, 12);
        ctx.fillStyle = "#d71920";
        ctx.fillRect(x + (f===1 ? 43 : -29), y+29, 28, 5);
        drawDoveSafe(x + (f===1 ? 82 : -46), y+14, f, false, 0.75);
      }

      if(atk === "random_box"){
        drawGiftBoxSafe(x + (f===1 ? 43 : -50), y+32, 42, 36);
      }

      if(atk === "cloth_teleport"){
        ctx.fillStyle = "rgba(230,230,255,.55)";
        ctx.fillRect(x-8,y-8,50,64);
        drawMagicSparkSafe(x+18,y+24,p.moveTimer || 10,"#eeeeff");
      }

      if(atk === "magic_ball"){
        // 玉はprojectile側で描画する。キャラ本体には重ねない。
      }

      if(atk === "tilt" || atk === "rabbit_smash_side" || atk === "air_forward" || atk === "air_back" || atk === "air"){
        ctx.strokeStyle = atk === "rabbit_smash_side" ? "#ffcc33" : "#ffffff";
        ctx.lineWidth = atk === "rabbit_smash_side" ? 8 : 5;
        ctx.beginPath();
        ctx.arc(x + (f===1 ? 54 : -18), y+24, atk === "rabbit_smash_side" ? 54 : 38, -0.8, 0.8);
        ctx.stroke();
      }

      if(atk === "up" || atk === "rabbit_smash_up"){
        ctx.fillStyle = "#fff1c9";
        ctx.fillRect(x+8,y-30,22,32);
        ctx.fillStyle = "#ffcc33";
        ctx.beginPath();
        ctx.arc(x+19,y-34, atk === "rabbit_smash_up" ? 24 : 16, 0, Math.PI*2);
        ctx.fill();
      }

      if(atk === "down" || atk === "rabbit_smash_down"){
        drawMagicSparkSafe(x-28,y+38,p.moveTimer || 10,"#ff8844");
        drawMagicSparkSafe(x+64,y+38,p.moveTimer || 10,"#4488ff");
      }

      if(atk === "air_up"){
        drawDoveSafe(x+8,y-34,1,false,0.8);
        drawDoveSafe(x+28,y-42,1,false,0.8);
      }

      if(atk === "air_down"){
        ctx.strokeStyle = "#bb44ff";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x+18,y+48);
        ctx.lineTo(x+18,y+92);
        ctx.stroke();
        drawMagicSparkSafe(x+18,y+76,p.moveTimer || 10,"#bb44ff");
      }

      if(atk === "rabbit_smash" || atk === "smash"){
        drawMagicSparkSafe(x + (f===1 ? 70 : -34), y+16, p.moveTimer || 10, "#ffcc33");
        drawJackboxWobbleSafe(x + (f===1 ? 92 : -58), y+26, p.moveTimer || 10);
      }

      ctx.fillStyle = "white";
      ctx.font = "12px Arial";
      

      if(atk === "dash_attack"){
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(x + (f===1 ? -22 : 58), y+38);
        ctx.lineTo(x + (f===1 ? 62 : -26), y+24);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,.35)";
        ctx.fillRect(x + (f===1 ? -38 : 44), y+20, 48, 18);
      }

      if(atk === "jab"){
        drawStaffArc(x+20,y+24,f,"normal",p.moveTimer||10);
      }

      if(atk === "tilt" || atk === "air_forward" || atk === "air_back" || atk === "air"){
        drawStaffArc(x+20,y+24,f,"normal",p.moveTimer||10);
      }

      if(atk === "rabbit_smash_side"){
        drawStaffArc(x+24,y+24,f,"smash",p.moveTimer||10);
      }

      if(atk === "up" || atk === "rabbit_smash_up"){
        ctx.fillStyle = "#fff1c9";
        ctx.fillRect(x+8,y-34,22,36);
        ctx.fillStyle = "#ffcc33";
        ctx.beginPath();
        ctx.arc(x+19,y-36, atk === "rabbit_smash_up" ? 28 : 18, 0, Math.PI*2);
        ctx.fill();
        drawMagicSparkSafe(x+19,y-42,p.moveTimer||10,"#ffcc33");
      }

      if(atk === "down" || atk === "rabbit_smash_down"){
        drawSparkBurst(x+18,y+48,p.moveTimer||10);
      }

      if(atk === "air_up"){
        drawHatDoveUp(x+18,y-6,p.moveTimer||10);
      }

      if(atk === "air_down"){
        drawDownBind(x+18,y+48,p.moveTimer||10);
      }

      ctx.fillText(p.name || "P", x-8, y-12);
      return;
    }

    // other fighters
    ctx.fillStyle = p.hair || "#222";
    ctx.fillRect(x+10,y,16,8);
    ctx.fillStyle = p.skin || "#ffd6a5";
    ctx.fillRect(x+8,y+8,20,14);
    ctx.fillStyle = "white";
    ctx.fillRect(x+(f===1?22:10),y+13,4,4);
    ctx.fillStyle = p.color || "#00eaff";
    ctx.fillRect(x+6,y+22,24,22);
    ctx.fillStyle = p.accent || "#0066ff";
    ctx.fillRect(x+10,y+30,16,5);
    ctx.fillStyle = p.skin || "#ffd6a5";
    if(atk){
      ctx.fillRect(x+(f===1?28:-18),y+24,28,8);
      ctx.fillRect(x+(f===1?52:-28),y+21,12,14);
    }else{
      ctx.fillRect(x-2,y+24,8,20);
      ctx.fillRect(x+30,y+24,8,20);
    }
    ctx.fillStyle = p.accent || "#0066ff";
    ctx.fillRect(x+9,y+44,8,16);
    ctx.fillRect(x+21,y+44,8,16);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "white";
    ctx.font = "12px Arial";
    ctx.fillText(p.name || "P",x-4,y-10);
  }catch(err){
    // never allow one draw error to erase all characters
    ctx.globalAlpha = 1;
    const x = safeNum(p && p.x,350);
    const y = safeNum(p && p.y,120);
    drawRabbitFallbackPixel(x,y,1,p||{});
  }
}


function shortHudName(p){
  if(p.isCPU || /^CPU/.test(p.name || "")){
    const lv = p.cpuLevel || String(p.name || "").replace(/\D/g,"") || "";
    return "CPU" + lv;
  }
  const n = p.name || "P";
  if(n.length > 7) return n.slice(0,7);
  return n;
}

function damageColor(d){
  d = Number(d || 0);
  if(d >= 200) return "#ff4040";
  if(d >= 150) return "#ff8c2b";
  if(d >= 100) return "#ffe45c";
  return "#ffffff";
}

function drawCompactHud(){
  if(!roomState || !roomState.players) return true;
  const spots = [
    {x:8,y:8},
    {x:182,y:8},
    {x:356,y:8},
    {x:530,y:8}
  ];
  ctx.save();
  ctx.font = "13px Arial";
  for(let i=0;i<roomState.players.length && i<4;i++){
    const p = roomState.players[i];
    const sp = spots[i];
    const dmg = Math.min(999, Math.floor(p.damage || 0));
    ctx.fillStyle = "rgba(0,0,0,.62)";
    ctx.fillRect(sp.x, sp.y, 162, 48);
    ctx.strokeStyle = p.isCPU ? "#ffcc33" : "#ffffff";
    ctx.strokeRect(sp.x, sp.y, 162, 48);

    ctx.fillStyle = p.isCPU ? "#ffec80" : "#ffffff";
    ctx.fillText(shortHudName(p), sp.x+8, sp.y+17);

    ctx.fillStyle = damageColor(dmg);
    ctx.font = "bold 20px Arial";
    ctx.fillText(dmg + "%", sp.x+72, sp.y+25);

    ctx.font = "12px Arial";
    ctx.fillStyle = "#cde7ff";
    ctx.fillText("残機 " + (p.stocks ?? 0), sp.x+8, sp.y+39);

    if(p.shield !== undefined){
      ctx.fillStyle = "rgba(255,255,255,.2)";
      ctx.fillRect(sp.x+70, sp.y+34, 72, 6);
      ctx.fillStyle = p.shieldBroken ? "#ff66ff" : "#66aaff";
      ctx.fillRect(sp.x+70, sp.y+34, Math.max(0, Math.min(72, (p.shield||0)*0.72)), 6);
    }
    ctx.font = "13px Arial";
  }
  ctx.restore();
  return true;
}

function drawGuardBreakStars(x,y,t){
  ctx.save();
  const wob = Math.sin((t||0)*0.25) * 5;
  ctx.translate(wob,0);
  const pts = [
    [x+2,y-35],
    [x+22,y-42],
    [x+42,y-32]
  ];
  ctx.fillStyle = "#ffe45c";
  for(const [sx,sy] of pts){
    ctx.beginPath();
    for(let i=0;i<10;i++){
      const a = -Math.PI/2 + i*Math.PI/5;
      const r = i%2===0 ? 8 : 3.5;
      ctx.lineTo(sx+Math.cos(a)*r, sy+Math.sin(a)*r);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawSimpleGuardBubble(p,x,y){
  const sh = Math.max(0, Math.min(100, p.shield ?? 100));
  const r = 30 + sh * 0.22;
  ctx.save();
  ctx.globalAlpha = 0.35 + sh/250;
  ctx.fillStyle = p.shieldBroken ? "rgba(255,80,255,.45)" : "rgba(80,160,255,.42)";
  ctx.beginPath();
  ctx.arc(x+18,y+22,r,0,Math.PI*2);
  ctx.fill();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = p.shieldBroken ? "#ff66ff" : "#99ddff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x+18,y+22,r,0,Math.PI*2);
  ctx.stroke();
  ctx.restore();
}

function drawHud(){
  drawCompactHud();
}

function drawEffects(){
  if(!roomState) return;
  try{
    for(const e of roomState.effects || []){
      const x = safeNum(e.x,0);
      const y = safeNum(e.y,0);
      ctx.globalAlpha = Math.max(0, Math.min(1, (e.life || 10) / 30));

      if(e.type === "guard" || e.type === "just_guard" || e.type === "shield_break" || e.type === "stun_clear"){
      ctx.strokeStyle = e.type === "just_guard" ? "#66ffff" : e.type === "shield_break" ? "#ff66ff" : e.type === "stun_clear" ? "#99ffcc" : "#6688ff";
      ctx.lineWidth = e.type === "shield_break" ? 6 : e.type === "stun_clear" ? 5 : 4;
      ctx.beginPath();
      ctx.arc(x,y,e.type === "shield_break" ? 42 : e.type === "stun_clear" ? 36 : 28,0,Math.PI*2);
      ctx.stroke();
    }

    if(e.type === "hit"){
        ctx.fillStyle = e.color || "yellow";
        ctx.beginPath();
        ctx.arc(x,y,Math.max(4,30-(e.life || 10)),0,Math.PI*2);
        ctx.fill();
      }

      if(e.type === "hat_magic" || e.type === "throw_box" || e.type === "magic" || e.type === "attack" || e.type === "box_magic_burst" || e.type === "box_burst_sprite"){
        drawMagicSparkSafe(x,y,e.life || 10,e.color || "#bb44ff");
      }

      if(e.type === "clown_wobble" || e.type === "clown_sprite" || e.type === "jackbox"){
        drawMagicSparkSafe(x,y,e.life || 10,"#ffcc33");
        drawJackboxWobbleSafe(x,y,e.life || 10);
      }

      if(e.type === "candy_heal" || e.type === "candy_sprite"){
        ctx.fillStyle = "#ff66cc";
        ctx.beginPath();
        ctx.arc(x,y,18,0,Math.PI*2);
        ctx.fill();
        ctx.fillStyle = "white";
        ctx.fillRect(x-8,y-4,16,8);
      }

      if(e.type === "bomb_explosion" || e.type === "bomb_sprite"){
        ctx.fillStyle = "rgba(255,130,0,.70)";
        ctx.beginPath();
        ctx.arc(x,y,Math.max(8,54-(e.life || 10)*0.35),0,Math.PI*2);
        ctx.fill();
      }

      if(e.type === "burst"){
        ctx.fillStyle = e.color || "white";
        for(let i=0;i<10;i++){
          const a = i*Math.PI*2/10;
          const r = 45-(e.life || 10);
          ctx.fillRect(x+Math.cos(a)*r,y+Math.sin(a)*r,8,8);
        }
      }
      ctx.globalAlpha = 1;
    }
  }catch(err){
    ctx.globalAlpha = 1;
  }
}

function drawProjectiles(){
  if(!roomState) return;
  try{
    for(const p of roomState.projectiles || []){
      const x = safeNum(p.x,0);
      const y = safeNum(p.y,0);
      if(p.kind === "dove" || p.kind === "black_dove"){
        drawDoveSafe(x+(p.w||32)/2, y+(p.h||20)/2, p.vx || 1, p.kind === "black_dove", 1);
        continue;
      }
      if(p.kind === "random_box"){
        drawGiftBoxSafe(x-4,y-8,46,40);
        continue;
      }
      ctx.fillStyle = p.color || "white";
      ctx.fillRect(x,y,p.w || 20,p.h || 14);
    }
  }catch(err){}
}

function drawButtons(){
  ctx.globalAlpha = .72;

  for(const b of buttons){
    ctx.fillStyle = "rgba(255,255,255,.15)";
    ctx.fillRect(b.x,b.y,b.w,b.h);

    ctx.strokeStyle = "white";
    ctx.strokeRect(b.x,b.y,b.w,b.h);

    ctx.fillStyle = "white";
    ctx.font = "13px Arial";
    ctx.fillText(b.text,b.x+7,b.y+33);
  }

  ctx.globalAlpha = 1;
}


function drawGuardOverlayForAll(){
  if(!roomState || !roomState.players) return;
  for(const p of roomState.players){
    const guarding = (p.guardTimer || 0) > 0 || p.shieldBroken || ((p.shield ?? 100) < 100 && (p.guardTimer || 0) > 0);
    if(guarding){
      drawGuardBubbleAlways(p, Number.isFinite(p.x)?p.x:350, Number.isFinite(p.y)?p.y:120);
    }
  }
}


function drawGuardBreakConfusionForAll(){
  if(!roomState || !roomState.players) return;
  for(const p of roomState.players){
    if((p.stunTimer || 0) > 0 || p.shieldBroken){
      drawConfusionBreakMotion(p, Number.isFinite(p.x)?p.x:350, Number.isFinite(p.y)?p.y:120);
    }
  }
}

function loop(){
  try{
    ctx.clearRect(0,0,700,400);

    // Ver3.0.9: ステージを大きめに見せつつ全体も見えるカメラ
    ctx.save();
    ctx.translate(350, 205);
    ctx.scale(0.94, 0.94);
    ctx.translate(-350, -205);

    try{ drawStage(); }catch(e){ ctx.fillStyle="#101631"; ctx.fillRect(0,0,700,400); }

    if(roomState){
      try{ drawProjectiles(); }catch(e){}
      for(const p of roomState.players || []){
        try{ drawFighter(p); }catch(e){}
      }
      try{ drawEffects(); }catch(e){}
      try{ drawGuardOverlayForAll(); }catch(e){}
      try{ drawGuardBreakConfusionForAll(); }catch(e){}

      if(roomState.status === "finished"){
        ctx.fillStyle = "rgba(0,0,0,.65)";
        ctx.fillRect(0,0,700,400);
        ctx.fillStyle = "yellow";
        ctx.font = "46px Arial";
        ctx.fillText(roomState.message,185,175);
      }
    }

    ctx.restore();

    try{ drawHud(); }catch(e){}
    try{ drawButtons(); }catch(e){}
  }catch(e){
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle="#101631";
    ctx.fillRect(0,0,700,400);
  }
  requestAnimationFrame(loop);
}

loop();
