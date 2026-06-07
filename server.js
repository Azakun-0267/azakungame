
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcryptjs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static("public"));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;

if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  console.log("Supabase connected");
} else {
  console.log("No Supabase env. Guest play works.");
}

const MAX_PLAYERS = 4;
const rooms = {};
const TEAM_COLORS = {1:"#ff3b3b",2:"#3b8cff",3:"#39d353",4:"#ffd33d"};

const CHARACTERS = {
  magician_rabbit: {
    label: "マジシャンラビット",
    desc: "杖・鳩・びっくり箱・玉乗りで戦う奇術師。",
    color: "#fff1c9",
    accent: "#d71920",
    skin: "#fff1c9",
    hair: "#111111",
    speed: 4.65,
    accel: 0.82,
    jump: 12.4,
    weight: 0.78,
    damageMul: 1.0,
    knockMul: 1.08
  }
,
  ryzen: {
    label: "ライゼン",
    desc: "雷を纏う孤高の武闘家。素早い突進と雷撃で戦う。",
    color: "#1e9bff",
    accent: "#ff9d22",
    skin: "#c07846",
    hair: "#15171d",
    speed: 5.15,
    accel: 0.9,
    jump: 12.8,
    weight: 0.92,
    damageMul: 1.05,
    knockMul: 1.08
  }};

const MOVES = {
  jab:   { name:"ステッキ突き", damage:6,  base:4.5, scale:5.2, x:34, y:15, w:50, h:28, cd:70, timer:28, angle:"side" },
  tilt:  { name:"マジックスイング", damage:11, base:6.0, scale:8.0, x:38, y:0, w:88, h:48, cd:76, timer:32, angle:"side" },
  dash_attack: { name:"ダッシュアタック", damage:10, base:6.4, scale:7.6, x:34, y:8, w:82, h:42, cd:76, timer:32, angle:"side" },
  up:    { name:"ヘッドバット", damage:9, base:4.6, scale:6.0, x:-8, y:-58, w:56, h:72, cd:72, timer:30, angle:"up" },
  down:  { name:"マジックスパーク", damage:12, base:6.0, scale:8.2, x:-44, y:16, w:122, h:50, cd:78, timer:34, angle:"low" },
  smash: { name:"スマッシュ", damage:21, base:9.0, scale:15.0, x:50, y:4, w:88, h:44, cd:92, timer:42, angle:"smash" },
  rabbit_smash_side: { name:"横スマ・マジックスイング", damage:34, base:26.0, scale:58.0, x:46, y:-4, w:128, h:64, cd:100, timer:46, angle:"smash" },
  rabbit_smash_up: { name:"上スマ・ヘッドバット", damage:12, base:6.2, scale:8.5, x:-12, y:-76, w:62, h:88, cd:92, timer:42, angle:"up" },
  rabbit_smash_down: { name:"下スマ・マジックスパーク", damage:12, base:7.4, scale:11.2, x:-68, y:18, w:170, h:54, cd:96, timer:44, angle:"low" },
  air:   { name:"空N・ステッキ回転", damage:8, base:5.0, scale:6.8, x:-30, y:-8, w:98, h:66, cd:60, timer:28, angle:"air" },
  air_forward: { name:"空前・薙ぎ払い", damage:11, base:6.1, scale:8.4, x:32, y:0, w:88, h:54, cd:62, timer:30, angle:"side" },
  air_back: { name:"空後・振り向き薙ぎ払い", damage:12, base:6.6, scale:8.8, x:32, y:0, w:90, h:54, cd:66, timer:30, angle:"side" },
  air_up: { name:"空上・帽子鳩", damage:4, base:4.0, scale:4.8, x:-6, y:-70, w:54, h:76, cd:64, timer:30, angle:"up" },
  air_down: { name:"空下・拘束落下", damage:14, base:8.0, scale:11.0, x:-10, y:36, w:58, h:66, cd:76, timer:34, angle:"low" },
  ledge_attack: { name:"崖上がり攻撃", damage:4, base:2.4, scale:2.8, x:20, y:-8, w:42, h:34, cd:48, timer:18, angle:"side" },
  projectile: { name:"魔法弾", damage:8, base:5.0, scale:5.6, cd:70 },
  magic_poppo: { name:"マジックポッポ", damage:4, blackDamage:10, base:4.3, scale:5.0, cd:72 },
  random_box: { name:"ランダムボックス", damage:0, cd:82 },
  rabbit_smash: { name:"巨大びっくり箱スマッシュ", damage:24, base:10.0, scale:16.0, x:48, y:0, w:102, h:58, cd:92, timer:42, angle:"smash" },
  cloth_teleport: { name:"物体移動マジック", cd:72 },
  magic_ball: { name:"玉乗り", cd:78 }
,
  ryzen_jab: { name:"雷拳", damage:7, base:5.2, scale:6.2, x:28, y:8, w:76, h:42, cd:14, timer:12, angle:"side" },
  ryzen_tilt: { name:"嵐脚砕", damage:11, base:6.2, scale:8.0, x:34, y:0, w:108, h:52, cd:20, timer:16, angle:"side" },
  ryzen_dash: { name:"雷砕ダッシュ", damage:12, base:7.2, scale:9.0, x:34, y:4, w:120, h:48, cd:24, timer:18, angle:"side" },
  ryzen_smash_side: { name:"横スマ・雷拳撃", damage:27, base:16.0, scale:28.0, x:40, y:-8, w:158, h:70, cd:42, timer:28, angle:"smash" },
  ryzen_smash_up: { name:"上スマ・天雷波断", damage:19, base:11.5, scale:19.0, x:-18, y:-96, w:86, h:120, cd:40, timer:28, angle:"up" },
  ryzen_smash_down: { name:"下スマ・雷陣脚", damage:16, base:9.0, scale:15.0, x:-82, y:14, w:210, h:64, cd:38, timer:26, angle:"low" },
  ryzen_air: { name:"空N・雷回し", damage:9, base:5.5, scale:7.2, x:-28, y:-8, w:100, h:66, cd:19, timer:16, angle:"air" },
  ryzen_air_forward: { name:"空前・雷飛び蹴り", damage:12, base:7.0, scale:9.5, x:28, y:-4, w:118, h:62, cd:22, timer:17, angle:"side" },
  ryzen_air_up: { name:"空上・昇雷拳", damage:11, base:7.0, scale:9.0, x:-16, y:-92, w:82, h:110, cd:21, timer:17, angle:"up" },
  ryzen_air_down: { name:"空下・落雷踏み", damage:15, base:8.8, scale:12.5, x:-18, y:30, w:86, h:96, cd:28, timer:21, angle:"low" },
  ryzen_nb: { name:"NB・雷牙穿", damage:9, base:5.4, scale:6.5, cd:34 },
  ryzen_sideb: { name:"横B・迅雷突", damage:13, base:8.0, scale:10.0, cd:42 },
  ryzen_upb: { name:"上B・昇雷拳", damage:11, base:7.0, scale:9.0, cd:50 },
  ryzen_downb: { name:"下B・雷鳴の構え", damage:0, cd:70 },
  ryzen_down_tilt: { name:"下強・雷掃脚", damage:9, base:5.2, scale:7.4, x:-48, y:18, w:142, h:44, cd:19, timer:15, angle:"low" },
  ryzen_air_back: { name:"空後・雷裏拳", damage:13, base:7.4, scale:10.5, x:28, y:-2, w:124, h:60, cd:23, timer:18, angle:"side" },
  ryzen_grab: { name:"掴み・雷縛", damage:4, base:3.5, scale:4.0, x:28, y:0, w:78, h:54, cd:32, timer:20, angle:"side" }};

const STAGES = [
  {
    name:"クラシック",
    desc:"中央が広い基本ステージ。",
    bg:"#101631",
    floor:"#25314f",
    platforms:[{x:65,y:320,w:570,h:26},{x:185,y:235,w:160,h:16},{x:355,y:235,w:160,h:16},{x:285,y:165,w:130,h:16}]
  },
  {
    name:"ツインタワー",
    desc:"左右の高台で空中戦。",
    bg:"#17102b",
    floor:"#432a68",
    platforms:[{x:55,y:322,w:590,h:26},{x:95,y:240,w:170,h:16},{x:435,y:240,w:170,h:16},{x:275,y:175,w:150,h:16}]
  },
  {
    name:"ロングブリッジ",
    desc:"横に長く吹っ飛ばし勝負。",
    bg:"#10251e",
    floor:"#245a44",
    platforms:[{x:45,y:325,w:610,h:24},{x:160,y:245,w:130,h:14},{x:410,y:245,w:130,h:14}]
  },
  {
    name:"スカイリング",
    desc:"足場が小さく落下しやすい。",
    bg:"#102635",
    floor:"#2d6f88",
    platforms:[{x:145,y:315,w:410,h:24},{x:85,y:240,w:135,h:14},{x:480,y:240,w:135,h:14},{x:290,y:180,w:120,h:14}]
  }
];

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms[code] ? makeRoomCode() : code;
}

function spawnPoint(slot) {
  const points = [
    {x:160,y:185},
    {x:500,y:185},
    {x:285,y:92},
    {x:405,y:92}
  ];
  return points[Math.max(0, Math.min(points.length - 1, Number(slot) || 0))] || points[0];
}

function charData(key) {
  return CHARACTERS[key] || CHARACTERS.magician_rabbit;
}

function profilePublic(row) {
  return {
    id: row.id,
    username: row.username,
    wins: row.wins || 0,
    losses: row.losses || 0,
    coins: row.coins || 0,
    selected_character: row.selected_character || "magician_rabbit",
    unlocked_characters: row.unlocked_characters || "magician_rabbit"
  };
}

async function getProfileById(id) {
  if (!supabase || !id) return null;
  const { data, error } = await supabase
    .from("players")
    .select("id, username, wins, losses, coins, selected_character, unlocked_characters")
    .eq("id", id)
    .single();
  if (error) return null;
  return profilePublic(data);
}

function makeGuest(socket, data = {}) {
  const name = String(data.guestName || data.name || "").trim().slice(0,16) || ("Guest" + socket.id.slice(0,4));
  const character = CHARACTERS[data.character] ? data.character : "magician_rabbit";
  return {
    id: null,
    username: name,
    wins: 0,
    losses: 0,
    coins: 0,
    selected_character: character,
    guest: true
  };
}

function defaultPlayer(socket, slot) {
  const acc = socket.account || makeGuest(socket);
  const character = CHARACTERS[acc.selected_character] ? acc.selected_character : "magician_rabbit";
  const ch = charData(character);
  const sp = spawnPoint(slot);

  return {
    id: socket.id,
    accountId: acc.id || null,
    slot,
    name: acc.username || ("P" + (slot + 1)),
    character,
    stageVote: 0,
    x: sp.x,
    y: sp.y,
    vx: 0,
    vy: 0,
    w: 34,
    h: 48,
    facing: slot === 1 ? -1 : 1,
    damage: 0,
    stocks: 3,
    alive: true,
    respawnTimer: 0,
    onGround: false,
    jumpsLeft: 2, recoveryUsed:false,
    jumpHeld: false,
    move: null,
    moveTimer: 0,
    attackCooldown: 0,
    invincible: 90,
    hitCooldown: 0,
    shield:100,
    shieldBroken:false,
    stunTimer:0,
    guardTimer:0,
    justGuardTimer:0,
    ledgeGrabCooldown:0,
    team: (slot % 2) + 1,
    color: ch.color,
    accent: ch.accent,
    skin: ch.skin,
    hair: ch.hair,
    input: {left:false,right:false,up:false,down:false,jump:false,attack:false,special:false,smash:false}
  };
}

function publicPlayer(p) {
  return {
    id:p.id, slot:p.slot, name:p.name, character:p.character, stageVote:p.stageVote, team:p.team||((p.slot%2)+1), isCPU:!!p.isCPU, cpuLevel:p.cpuLevel||0,
    x:Number.isFinite(p.x)?p.x:350, y:Number.isFinite(p.y)?p.y:120, vx:Number.isFinite(p.vx)?p.vx:0, vy:Number.isFinite(p.vy)?p.vy:0, w:p.w||34, h:p.h||48, facing:p.facing||1,
    damage:Math.min(999, Math.max(0, p.damage || 0)), stocks:p.stocks, alive:p.alive, respawnTimer:p.respawnTimer,
    onGround:p.onGround, move:p.move, moveTimer:p.moveTimer,
    invincible:p.invincible, shield:p.shield, guardTimer:p.guardTimer, ryzenCharge:p.ryzenCharge||0, shieldBroken:p.shieldBroken, stunTimer:p.stunTimer, guardLockTimer:p.guardLockTimer||0, ledgeHang:!!p.ledgeHang, ledgeTimer:p.ledgeTimer||0, ledgeSide:p.ledgeSide||0, color:p.color, accent:p.accent, skin:p.skin, hair:p.hair
  };
}

function publicRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    stageIndex: room.stageIndex,
    stageName: STAGES[room.stageIndex].name,
    stage: STAGES[room.stageIndex],
    selectedStageFinal: room.selectedStageFinal,
    cpuLevel: room.cpuLevel || 0,
    cpuCharacter: room.cpuCharacter || "ryzen",
    cpuLevels: room.cpuLevels || [room.cpuLevel||0,room.cpuLevel||0,room.cpuLevel||0],
    cpuTeams: room.cpuTeams || [2,3,4],
    cpuCount: room.cpuCount || 0,
    teamMode: !!room.teamMode,
    spectators: room.spectators ? Object.keys(room.spectators).length : 0,
    players: Object.values(room.players).map(publicPlayer),
    effects: room.effects,
    projectiles: room.projectiles,
    message: room.message,
    winner: room.winner
  };
}

function assignSlot(room) {
  const used = new Set(Object.values(room.players).map(p => p.slot));
  for (let i = 0; i < MAX_PLAYERS; i++) if (!used.has(i)) return i;
  return -1;
}

function resetFighterState(p) {
  const ch = charData(p.character);
  const sp = spawnPoint(p.slot);
  p.x = sp.x; p.y = sp.y; p.vx = 0; p.vy = 0;
  p.damage = 0; p.stocks = 3; p.alive = true; p.respawnTimer = 0;
  p.onGround = false; p.jumpsLeft = 2; p.recoveryUsed = false; p.jumpHeld = false;
  p.move = null; p.moveTimer = 0; p.attackCooldown = 0;
  p.invincible = 90; p.hitCooldown = 0;
  p.shield = 100; p.shieldBroken = false; p.stunTimer = 0; p.guardTimer = 0; p.justGuardTimer = 0; p.guardLockTimer = 0; p.ledgeHang = false; p.ledgeTimer = 0; p.ledgeSide = 0; p.ledgeGrabCooldown = 25;
  p.color = ch.color; p.accent = ch.accent; p.skin = ch.skin; p.hair = ch.hair;
}

function selectRandomStageFromVotes(room) {
  const votes = Object.values(room.players)
    .map(p => Number.isInteger(p.stageVote) ? p.stageVote : 0)
    .filter(v => v >= 0 && v < STAGES.length);

  if (votes.length === 0) return 0;
  return votes[Math.floor(Math.random() * votes.length)];
}

function startBattle(room) {
  if (!room) return;
  ensureCPU(room);

  let players = Object.values(room.players || {}).filter(p => p && p.stocks !== 0);
  if (players.length < 2) {
    room.message = "CPUをONにするか、2人目を待ってください";
    if (room.code) io.to(room.code).emit("roomState", publicRoom(room));
    return;
  }

  // CPU is always ready. Humans should be ready, but host start can force start for CPU match.
  for (const p of players) {
    if (p.isCPU) p.ready = true;
  }

  room.status = "playing";
  room.message = "FIGHT!";
  room.resultsSaved = false;
  room.projectiles = [];
  room.effects = [];

  // Decide final stage from host vote / selected stage; keep existing stage index safe
  if (!Number.isFinite(room.stageIndex)) room.stageIndex = 0;
  room.stageIndex = Math.max(0, Math.min(STAGES.length - 1, Number(room.stageIndex || 0)));

  players = Object.values(room.players || {}).sort((a,b)=>(a.slot||0)-(b.slot||0));
  let i = 0;
  for (const p of players) {
    p.slot = Number.isInteger(p.slot) ? p.slot : i;
    resetFighterState(p);
    const sp = spawnPoint(i);
    p.x = sp.x;
    p.y = sp.y;
    p.facing = p.x < 350 ? 1 : -1;
    p.ready = !!p.isCPU;
    p.team = p.team || ((i % 2) + 1);
    i++;
  }

  if (room.code) {
    io.to(room.code).emit("roomState", publicRoom(room));
    io.to(room.code).emit("startGame", publicRoom(room));
  }
}

function rectsOverlap(a,b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function platformCollision(p, plat, index = 0) {
  const prevBottom = p.y + p.h - p.vy;
  const nowBottom = p.y + p.h;
  const insideX = p.x + p.w > plat.x + 2 && p.x < plat.x + plat.w - 2;
  const wantsDrop = !!(p.input && p.input.down) || (p.dropTimer || 0) > 0;

  if (index > 0 && wantsDrop) return;

  if (p.vy >= 0 && insideX && prevBottom <= plat.y + 6 && nowBottom >= plat.y && nowBottom <= plat.y + 24) {
    p.y = plat.y - p.h;
    p.vy = 0;
    p.onGround = true;
    p.jumpsLeft = 2;
    p.recoveryUsed = false;
    p.ledgeHang = false;
    p.ledgeTimer = 0;
  }
}

function tryLedgeGrab(p, stage) {
  if (!p || !stage || p.onGround || p.vy < -1 || p.ledgeHang || (p.ledgeGrabCooldown||0) > 0) return false;
  const main = stage.platforms && stage.platforms[0];
  if (!main) return false;
  const centerY = p.y + p.h / 2;
  const nearY = centerY > main.y - 34 && centerY < main.y + 30;
  const leftEdge = Math.abs((p.x + p.w) - main.x) < 18;
  const rightEdge = Math.abs(p.x - (main.x + main.w)) < 18;
  if (!nearY || (!leftEdge && !rightEdge)) return false;
  p.ledgeHang = true;
  p.ledgeTimer = 150;
  p.vx = 0;
  p.vy = 0;
  p.y = main.y - p.h + 10;
  p.x = leftEdge ? main.x - p.w + 2 : main.x + main.w - 2;
  p.ledgeSide = leftEdge ? -1 : 1;
  p.facing = leftEdge ? 1 : -1;
  p.jumpsLeft = 2;
  p.recoveryUsed = false;
  return true;
}


function respawn(p) {
  if (p.stocks <= 0) return;
  const sp = spawnPoint(p.slot);
  p.x = sp.x; p.y = sp.y; p.vx = 0; p.vy = 0;
  p.damage = 0; p.alive = true; p.respawnTimer = 0; p.invincible = 130; p.jumpsLeft = 2; p.recoveryUsed = false;
  p.move = null; p.moveTimer = 0;
  p.ledgeHang = false; p.ledgeTimer = 0; p.ledgeSide = 0; p.ledgeGrabCooldown = 25; p.guardLockTimer = 0;
}

function loseStock(p, room) {
  p.stocks--;
  room.effects.push({type:"burst", x:p.x+p.w/2, y:p.y+p.h/2, color:p.color, life:45});
  if (p.stocks <= 0) {
    p.alive = false;
    p.respawnTimer = 999999;
  } else {
    p.alive = false;
    p.respawnTimer = 90;
  }
}

async function saveMatchResult(room) {
  if (!supabase || room.resultsSaved) return;
  room.resultsSaved = true;

  const players = Object.values(room.players);
  const winner = players.find(p => p.stocks > 0);
  if (!winner || !winner.accountId) return;

  const wp = await getProfileById(winner.accountId);
  if (wp) await supabase.from("players").update({wins:wp.wins+1, coins:wp.coins+70}).eq("id", winner.accountId);

  for (const loser of players.filter(p => p.id !== winner.id && p.accountId)) {
    const lp = await getProfileById(loser.accountId);
    if (lp) await supabase.from("players").update({losses:lp.losses+1, coins:lp.coins+15}).eq("id", loser.accountId);
  }

  for (const p of players) {
    if (p.accountId) io.to(p.id).emit("profile", await getProfileById(p.accountId));
  }
}

function checkWinner(room) {
  const alive = Object.values(room.players).filter(p => p.stocks > 0);
  if (room.status !== "playing" || Object.keys(room.players).length < 2) return;
  if (room.teamMode) {
    const teamsAlive = [...new Set(alive.map(p => p.team || ((p.slot % 2) + 1)))];
    if (teamsAlive.length === 1) {
      room.status = "finished";
      room.winner = "TEAM " + teamsAlive[0];
      room.message = "TEAM " + teamsAlive[0] + " WIN!";
      const wp = alive[0];
      room.effects.push({type:"win", x:350, y:200, color:(wp && wp.color) || "#fff", life:120});
      saveMatchResult(room);
    }
    return;
  }
  if (alive.length === 1) {
    room.status = "finished";
    room.winner = alive[0].name;
    room.message = alive[0].name + " WIN!";
    room.effects.push({type:"win", x:350, y:200, color:alive[0].color, life:120});
    saveMatchResult(room);
  }
}

function chooseMove(p) {
  const i = p.input || {};
  if (p.stunTimer > 0 || p.ledgeGrab) return null;
  if (p.attackCooldown > 0) return null;
  if (i.guard) return null;

  const ePressed = !!i.skillE || !!i.attack;
  const qPressed = !!i.skillQ || !!i.special;

  if (!ePressed && !qPressed && !i.smash) return null;

  if (p.character === "ryzen") {
    if (qPressed) {
      if (i.up) return "ryzen_upb";
      if (i.left || i.right) return "ryzen_sideb";
      if (i.down) return "ryzen_downb";
      return "ryzen_nb";
    }

    if (i.smash) {
      if (i.up) return "ryzen_smash_up";
      if (i.down) return "ryzen_smash_down";
      return "ryzen_smash_side";
    }

    if (ePressed) {
      const moving = Math.abs(p.vx || 0) > 1.3 || i.moveLeft || i.moveRight;
      if (p.onGround && moving && !i.up && !i.down) return "ryzen_dash";

      if (!p.onGround) {
        if (i.up) return "ryzen_air_up";
        if (i.down) return "ryzen_air_down";
        if (i.left || i.right) {
          const dir = i.left ? -1 : 1;
          return dir === p.facing ? "ryzen_air_forward" : "ryzen_air_back";
        }
        return "ryzen_air";
      }

      if (i.up) return "ryzen_tilt";
      if (i.down) return "ryzen_down_tilt";
      if (i.left || i.right) return "ryzen_tilt";
      return "ryzen_jab";
    }
  }

  if (p.character === "magician_rabbit") {
    if (qPressed) {
      if (i.up) return "cloth_teleport";
      if (i.left || i.right) return "magic_ball";
      if (i.down) return "random_box";
      return "magic_poppo";
    }

    if (i.smash) {
      if (i.up) return "rabbit_smash_up";
      if (i.down) return "rabbit_smash_down";
      return "rabbit_smash_side";
    }

    if (ePressed) {
      const moving = Math.abs(p.vx || 0) > 1.2 || i.moveLeft || i.moveRight;
      if (p.onGround && moving && !i.up && !i.down) return "dash_attack";

      if (!p.onGround) {
        if (i.up) return "air_up";
        if (i.down) return "air_down";
        if (i.left || i.right) {
          const dir = i.left ? -1 : 1;
          return dir === p.facing ? "air_forward" : "air_back";
        }
        return "air";
      }

      if (i.up) return "up";
      if (i.down) return "down";
      if (i.left || i.right) return "tilt";
      return "jab";
    }
  }

  if (qPressed && p.character === "mage") return "projectile";
  if (i.smash) return "smash";
  if (!p.onGround && ePressed) return "air";
  if (i.up && ePressed) return "up";
  if (i.down && ePressed) return "down";
  if ((i.left || i.right) && ePressed) return "tilt";
  if (ePressed) return "jab";
  return null;
}

function startMove(p, moveKey, room) {
  if (moveKey === "ryzen_nb") {
    const mv = MOVES.ryzen_nb;
    p.move = "ryzen_nb";
    p.moveTimer = 18;
    p.attackCooldown = mv.cd;
    room.projectiles = room.projectiles.filter(pr => !(pr.owner === p.id && pr.kind === "ryzen_lightning"));
    room.projectiles.push({
      owner:p.id, kind:"ryzen_lightning",
      x:p.x + (p.facing === 1 ? p.w + 8 : -34),
      y:p.y + 18,
      vx:p.facing * 10.5,
      vy:0,
      w:64, h:26,
      damage:mv.damage, base:mv.base, scale:mv.scale,
      color:"#1e9bff",
      life:38
    });
    room.effects.push({type:"ryzen_fx", x:p.x+p.w/2, y:p.y+p.h/2, color:"#1e9bff", life:10});
    return;
  }

  if (moveKey === "ryzen_sideb") {
    const mv = MOVES.ryzen_sideb;
    p.move = "ryzen_sideb";
    p.moveTimer = 22;
    p.attackCooldown = mv.cd;
    p.vx = p.facing * 13.5;
    p.vy = -0.5;
    room.effects.push({type:"ryzen_fx", x:p.x+p.w/2, y:p.y+p.h/2, color:"#1e9bff", life:10});
    return;
  }

  if (moveKey === "ryzen_upb") {
    const mv = MOVES.ryzen_upb;
    if (!p.onGround && p.recoveryUsed) return;
    if (!p.onGround) p.recoveryUsed = true;
    p.move = "ryzen_upb";
    p.moveTimer = 26;
    p.attackCooldown = mv.cd;
    p.vy = -16.5;
    p.vx = p.facing * 3.8;
    room.effects.push({type:"ryzen_fx", x:p.x+p.w/2, y:p.y+p.h/2, color:"#1e9bff", life:10});
    return;
  }

  if (moveKey === "ryzen_downb") {
    const mv = MOVES.ryzen_downb;
    p.move = "ryzen_downb";
    p.moveTimer = 34;
    p.attackCooldown = mv.cd;
    p.ryzenCharge = 180;
    p.vx = 0;
    room.effects.push({type:"ryzen_fx", x:p.x+p.w/2, y:p.y+p.h/2, color:"#1e9bff", life:10});
    return;
  }


  if (!p || !p.alive) return;
  if ((p.attackCooldown || 0) > 0 || (p.moveTimer || 0) > 0) return;
  if (moveKey === "dash_attack") {
    const mv = MOVES.dash_attack;
    p.move = "dash_attack";
    p.moveTimer = mv.timer;
    p.attackCooldown = mv.cd;
    p.vx = p.facing * Math.max(6.2, Math.abs(p.vx || 0));
    room.effects.push({type:"dash_attack", x:p.x+p.w/2, y:p.y+p.h/2, color:"#ffffff", life:16});
    return;
  }

  if (["jab","tilt","up","down","air","air_forward","air_back","air_up","air_down","smash","rabbit_smash_side","rabbit_smash_up","rabbit_smash_down"].includes(moveKey)) p.vx = 0;

  if (moveKey === "air_down") {
    p.vy = 10.5; // 拘束落下っぽく急降下
  }

  if (moveKey === "air_up") {
    const mv = MOVES.air_up;
    p.move = "air_up";
    p.moveTimer = mv.timer;
    p.attackCooldown = mv.cd;
    for (let i=0;i<2;i++){
      room.projectiles.push({
        owner:p.id, kind:"dove",
        x:p.x + p.w/2 - 10 + i*16,
        y:p.y - 16,
        vx:(i===0?-0.6:0.6),
        vy:-7.4,
        w:30, h:18,
        damage:4, base:4.2, scale:4.8, color:"#ffffff", life:70
      });
    }
    room.effects.push({type:"hat_magic", x:p.x+p.w/2, y:p.y-8, color:"#bb44ff", life:18});
    return;
  }

  if (moveKey === "cloth_teleport") {
    const mv = MOVES.cloth_teleport;
    if (!p.onGround && p.recoveryUsed) return;
    if (!p.onGround) p.recoveryUsed = true;
    p.move = "cloth_teleport";
    p.moveTimer = 16;
    p.attackCooldown = mv.cd;

    const i = p.input || {};
    let dx = 0, dy = 0;
    if (i.left) dx -= 1;
    if (i.right) dx += 1;
    if (i.up) dy -= 1;
    if (i.down) dy += 1;
    if (dx === 0 && dy === 0) dy = -1;
    const len = Math.max(1, Math.hypot(dx, dy));
    dx /= len; dy /= len;
    const dist = 245;
    p.x = Math.max(20, Math.min(650, p.x + dx * dist));
    p.y = Math.max(20, Math.min(330, p.y + dy * dist));
    p.vx = dx * 5.2;
    p.vy = Math.max(-15, dy * 5.2);
    room.effects.push({type:"cloth_poof", x:p.x+p.w/2, y:p.y+p.h/2, color:"#eeeeff", life:28});
    return;
  }

  if (moveKey === "magic_ball") {
    const mv = MOVES.magic_ball;
    p.move = "magic_ball";
    p.moveTimer = 24;
    p.attackCooldown = mv.cd;

    const bombRide = Math.random() < 0.03;
    const dir = p.facing || 1;

    room.projectiles.push({
      owner:p.id, kind:bombRide ? "bomb_ball" : "magic_ball",
      x:p.x + (dir === 1 ? p.w + 2 : -34),
      y:p.y + p.h - 28,
      vx:dir * 7.2, vy:-1.0, w:34, h:34,
      damage:bombRide ? 18 : 10,
      base:bombRide ? 8.5 : 5.2,
      scale:bombRide ? 10.5 : 6.0,
      color:bombRide ? "#111111" : "#36d7ff",
      life:bombRide ? 360 : 150,
      timer:bombRide ? 360 : 150,
      rider:p.id, mounted:true, bomb:bombRide
    });

    p.vx = dir * 6.2;
    p.vy = -1.2;
    room.effects.push({type:bombRide ? "bomb_ball_start" : "ball_start", x:p.x+p.w/2, y:p.y+p.h, color:bombRide ? "#ff8800" : "#36d7ff", life:18});
    return;
  }

  if (moveKey === "magic_poppo") {
    const mv = MOVES.magic_poppo;
    p.move = "magic_poppo";
    p.moveTimer = 16;
    p.attackCooldown = mv.cd;
    const rareBlack = Math.random() < 0.04;
    const count = rareBlack ? 1 : (1 + Math.floor(Math.random() * 2));
    for (let i=0;i<count;i++){
      const spread = (i - (count - 1) / 2) * 0.85;
      room.projectiles.push({
        owner:p.id, kind: rareBlack ? "black_dove" : "dove",
        x:p.x + (p.facing === 1 ? p.w + 10 : -34),
        y:p.y + 9 + i * 8,
        vx:p.facing * (5.8 + Math.random() * 0.8),
        vy:spread, w:32, h:20,
        damage: rareBlack ? mv.blackDamage : mv.damage,
        base: rareBlack ? 4.2 : mv.base,
        scale: rareBlack ? 4.8 : mv.scale,
        color: rareBlack ? "#111111" : "#ffffff",
        life:95
      });
    }
    room.effects.push({type:"hat_magic", x:p.x+p.w/2, y:p.y+20, color:"#bb44ff", life:18});
    return;
  }

  if (moveKey === "random_box") {
    const mv = MOVES.random_box;
    p.move = "random_box";
    p.moveTimer = 16;
    p.attackCooldown = mv.cd;
    const r = Math.random();
    let result = "jackbox";
    if (r < 0.50) result = "jackbox";
    else if (r < 0.80) result = "doves";
    else if (r < 0.95) result = "candy";
    else result = "bomb";
    room.projectiles = room.projectiles.filter(pr => !(pr.owner === p.id && pr.kind === "random_box"));
    room.projectiles.push({
      owner:p.id, kind:"random_box", result,
      x:p.x + (p.facing === 1 ? p.w + 8 : -42),
      y:p.y + p.h - 30,
      vx:p.facing * 3.8, vy:-4.8,
      w:40, h:34, damage:0, base:0, scale:0,
      color:"#ffcc33", life:130, timer:82
    });
    room.effects.push({type:"throw_box", x:p.x+p.w/2, y:p.y+p.h-16, color:"#ffcc33", life:20});
    return;
  }

  if (moveKey === "projectile") {
    const mv = MOVES.projectile;
    p.move = "projectile";
    p.moveTimer = 14;
    p.attackCooldown = mv.cd;
    room.projectiles.push({
      owner:p.id, kind:"magic", x:p.x + (p.facing === 1 ? p.w + 8 : -20), y:p.y + 22,
      vx:p.facing * 7.4, vy:0, w:20, h:14,
      damage:mv.damage, base:mv.base, scale:mv.scale, color:p.color, life:95
    });
    room.effects.push({type:"magic", x:p.x+p.w/2, y:p.y+24, color:p.color, life:14});
    return;
  }

  const mv = MOVES[moveKey] || MOVES.jab;
  p.move = MOVES[moveKey] ? moveKey : "jab";
  p.moveTimer = mv.timer || 12;
  p.attackCooldown = Math.round((mv.cd || 24) * (p.character === "speed" ? 0.85 : 1));
  room.effects.push({type:"attack", x:p.x + (p.facing === 1 ? p.w + 26 : -26), y:p.y + 25, color:p.color, life:14, move:p.move});
}

function getAttackBox(p) {
  if (!p || !p.move || p.moveTimer <= 0) return null;

  // Projectile / non-contact specials
  if (["magic_poppo","random_box","projectile","teleport","cloth_teleport","magic_ball","ryzen_nb","ryzen_downb"].includes(p.move)) return null;

  // Contact specials for Ryzen
  if (p.move === "ryzen_sideb") {
    return {
      x: p.facing === 1 ? p.x + 18 : p.x - 112,
      y: p.y + 4,
      w: 128,
      h: 52,
      move: "ryzen_sideb"
    };
  }

  if (p.move === "ryzen_upb") {
    return {
      x: p.x - 24,
      y: p.y - 82,
      w: 92,
      h: 132,
      move: "ryzen_upb"
    };
  }

  const mv = MOVES[p.move];
  if (!mv || mv.x === undefined || mv.y === undefined || mv.w === undefined || mv.h === undefined) return null;

  const sideX = p.facing === 1 ? p.x + mv.x : p.x + p.w - mv.x - mv.w;
  return {
    x: (p.move === "up" || p.move === "down" || p.move === "rabbit_smash_up" || p.move === "rabbit_smash_down" || p.move === "air_up" || p.move === "air_down" || p.move === "ryzen_smash_up" || p.move === "ryzen_smash_down" || p.move === "ryzen_air_up" || p.move === "ryzen_air_down") ? p.x + mv.x : sideX,
    y: p.y + mv.y,
    w: mv.w,
    h: mv.h,
    move: p.move
  };
}

function applyKnockback(attacker, defender, moveKey, room, projectile = null) {

  if (!defender || !attacker) return;
  const ac = charData(attacker.character);
  const dc = charData(defender.character);
  const mv = projectile || MOVES[moveKey] || MOVES.jab;

  // Ver3.0.9: ガードブレイクの混乱中に攻撃を受けたら即復帰。
  // その攻撃自体のダメージ/吹っ飛びは下で通常通り入れる。
  if (defender.stunTimer > 0 || defender.shieldBroken === true) {
    clearGuardBreakStun(defender);
    room.effects.push({type:"stun_clear", x:defender.x+defender.w/2, y:defender.y+defender.h/2, color:"#99ffcc", life:22});
  }

  if (defender.input && defender.input.guard && defender.shieldBroken !== true) {
    const just = defender.justGuardTimer > 0;
    const shieldDamage = just ? 2 : Math.max(6, (mv.damage || 5) * 1.8);
    defender.shield = Math.max(0, (defender.shield ?? 100) - shieldDamage);
    defender.vx = just ? 0 : attacker.facing * 1.4;
    defender.vy = 0;
    defender.hitCooldown = just ? 6 : 14;
    room.effects.push({type:just ? "just_guard" : "guard", x:defender.x+defender.w/2, y:defender.y+defender.h/2, color:just ? "#66ffff" : "#6688ff", life:18});
    if (defender.shield <= 0) {
      defender.shieldBroken = true;
      defender.shield = 0;
      defender.invincible = 0;
      defender.hitCooldown = 0;
      defender.stunTimer = 300;
      defender.guardTimer = 0;
      defender.justGuardTimer = 0;
      defender.input.guard = false;
      defender.guardLockTimer = 45;
      room.effects.push({type:"shield_break", x:defender.x+defender.w/2, y:defender.y+defender.h/2, color:"#ff66ff", life:80});
    }
    return;
  }

  defender.damage += (mv.damage || 0) * ac.damageMul * (attacker.ryzenCharge > 0 ? 1.18 : 1);
  defender.damage = Math.min(999, defender.damage);

  const rate = defender.damage / 100;
  const highBonus = Math.max(0, defender.damage - 90) / 35;
  let total = ((mv.base || 5) + (mv.scale || 6) * rate + highBonus * 3.4) * ac.knockMul / dc.weight;
  total = Math.min(total, 80);

  let kx = attacker.facing * total;
  let ky = -total * 0.45;

  const angle = mv.angle || "side";
  if (angle === "up") { kx = attacker.facing * total * 0.22; ky = -total * 1.05; }
  if (angle === "low") { kx = attacker.facing * total * 0.9; ky = total * 0.14; }
  if (angle === "smash") { kx = attacker.facing * total * 1.5; ky = -total * 0.15; }
  if (angle === "air") { kx = attacker.facing * total * 0.75; ky = -total * 0.75; }
  if (projectile) { kx = Math.sign(projectile.vx || attacker.facing) * total * 0.85; ky = -total * 0.25; }

  if (moveKey === "rabbit_smash_side") { kx = attacker.facing * total * 7.2; ky = -total * 0.005; }
  if (moveKey === "up") { kx *= 0.75; ky *= 0.75; }
  if (moveKey === "rabbit_smash_up") { kx *= 0.72; ky *= 0.72; }

  defender.vx = Math.max(-145, Math.min(145, kx));
  defender.vy = Math.max(-34, Math.min(22, ky));
  defender.hitCooldown = 22;
  defender.invincible = defender.stunTimer > 0 ? 0 : 10;
  room.effects.push({type:"hit", x:defender.x+defender.w/2, y:defender.y+defender.h/2, color:attacker.color, life:18});
}


function clearGuardBreakStun(p) {
  if (!p) return;
  p.stunTimer = 0;
  p.shieldBroken = false;
  p.shield = 100;
  p.guardTimer = 0;
  p.justGuardTimer = 0;
  p.hitCooldown = 0;
  p.invincible = 0;
  if (p.input) p.input.guard = false;
  p.guardLockTimer = 20;
}

function triggerRandomBox(room, box) {
  if (!room || !box || box.opened) return;
  box.opened = true;
  const players = Object.values(room.players || {});
  const owner = players.find(p => p.id === box.owner);
  const cx = (box.x || 0) + (box.w || 40) / 2;
  const cy = (box.y || 0) + (box.h || 34) / 2;
  const result = box.result || "jackbox";

  if (result === "candy") {
    if (owner && owner.alive) {
      owner.damage = Math.max(0, (owner.damage || 0) - 15);
      room.effects.push({type:"candy_heal", x:owner.x+owner.w/2, y:owner.y+owner.h/2, color:"#ff77cc", life:46});
    } else {
      room.effects.push({type:"candy", x:cx, y:cy, color:"#ff77cc", life:42});
    }
    return;
  }

  if (result === "doves") {
    const dir = owner ? (owner.facing || Math.sign(box.vx || 1) || 1) : (Math.sign(box.vx || 1) || 1);
    for (let i = 0; i < 3; i++) {
      room.projectiles.push({
        owner:box.owner, kind:"dove",
        x:cx - 12, y:cy - 8 + i * 10,
        vx:dir * (5.2 + i * 0.35), vy:(i - 1) * 0.9,
        w:32, h:20, damage:4, base:4.2, scale:5.0,
        color:"#ffffff", life:90
      });
    }
    room.effects.push({type:"box_burst", x:cx, y:cy, color:"#ffffff", life:38});
    return;
  }

  const hit = {x:cx - 58, y:cy - 58, w:116, h:116};
  const isBomb = result === "bomb";
  const payload = isBomb
    ? {damage:20, base:8.8, scale:12.5, angle:"smash", vx:box.vx || (owner ? owner.facing : 1)}
    : {damage:12, base:7.0, scale:8.8, angle:"up", vx:box.vx || (owner ? owner.facing : 1)};

  for (const target of players) {
    if (!target.alive) continue;
    if (target.id === box.owner && !isBomb) continue;
    if (room.teamMode && owner && target.team && owner.team && target.team === owner.team) continue;
    if (target.stunTimer <= 0 && (target.invincible > 0 || target.hitCooldown > 0)) continue;
    if (rectsOverlap(hit, target)) applyKnockback(owner || target, target, "projectile", room, payload);
  }
  room.effects.push({type:isBomb ? "bomb_explosion" : "jackbox", x:cx, y:cy, color:isBomb ? "#ff8800" : "#ffcc33", life:isBomb ? 56 : 44});
}

function updateProjectiles(room) {
  const players = Object.values(room.players);
  const stage = STAGES[room.stageIndex];

  for (const pr of room.projectiles) {
    if (pr.kind === "random_box") {
      pr.vy += 0.22;
      pr.vx *= 0.985;

      for (const plat of stage.platforms) {
        if (pr.vy >= 0 && pr.x + pr.w > plat.x && pr.x < plat.x + plat.w && pr.y + pr.h >= plat.y && pr.y + pr.h <= plat.y + 24) {
          pr.y = plat.y - pr.h;
          pr.vy = 0;
          pr.vx *= 0.90;
        }
      }

      pr.x += pr.vx;
      pr.y += pr.vy;
      pr.timer--;

      if (pr.timer <= 0) {
        triggerRandomBox(room, pr);
        pr.life = 0;
        continue;
      }
    } else if (pr.kind === "magic_ball" || pr.kind === "bomb_ball") {
      pr.vy += 0.35;
      pr.vx *= 0.992;

      for (const plat of stage.platforms) {
        if (pr.vy >= 0 && pr.x + pr.w > plat.x && pr.x < plat.x + plat.w && pr.y + pr.h >= plat.y && pr.y + pr.h <= plat.y + 26) {
          pr.y = plat.y - pr.h;
          pr.vy = -Math.abs(pr.vy) * 0.25;
          if (Math.abs(pr.vx) < 0.7 && !pr.bomb) pr.life = Math.min(pr.life, 120);
        }
      }

      pr.x += pr.vx;
      pr.y += pr.vy;
      pr.timer--;

      const rider = players.find(p => p.id === pr.rider);
      if (rider && pr.mounted && rider.alive) {
        // ボールに乗ってる間はキャラをボールの上に置く
        rider.x = pr.x + pr.w / 2 - rider.w / 2;
        rider.y = pr.y - rider.h - 8;

        // ジャンプで解除
        if (rider.input && rider.input.jump) {
          pr.mounted = false;
          pr.rider = null;
          rider.vy = -9;
        }
      }

      if (pr.bomb && pr.timer <= 0) {
        const owner = players.find(p => p.id === pr.owner) || rider;
        const hit = {x:pr.x-48, y:pr.y-48, w:130, h:130};
        for (const p of players) {
          if (!p.alive || (p.stunTimer <= 0 && (p.invincible > 0 || p.hitCooldown > 0))) continue;
          if (room.teamMode && owner && p.team && owner.team && p.team === owner.team) continue;
          if (rectsOverlap(hit, p)) applyKnockback(owner || p, p, "magic_ball", room, {damage:18, base:8.5, scale:11.5, angle:"smash", vx:pr.vx});
        }
        room.effects.push({type:"bomb_explosion", x:pr.x+pr.w/2, y:pr.y+pr.h/2, color:"#ff8800", life:54});
        pr.life = 0;
        continue;
      }

      if (!pr.bomb && Math.abs(pr.vx) < 0.35) pr.life = Math.min(pr.life, 120);
    } else {
      pr.x += pr.vx;
      pr.y += pr.vy;
    }

    pr.life--;

    const owner = players.find(p => p.id === pr.owner);
    for (const p of players) {
      if (!owner || p.id === pr.owner || !p.alive || (p.stunTimer <= 0 && (p.invincible > 0 || p.hitCooldown > 0))) continue;
      if (room.teamMode && p.team && owner.team && p.team === owner.team) continue;
      if (pr.kind === "random_box") continue;
      if (pr.kind === "magic_ball" || pr.kind === "bomb_ball") {
        if (p.id === pr.rider) continue;
      }
      if (rectsOverlap(pr, p)) {
        applyKnockback(owner, p, pr.kind === "bomb_ball" ? "magic_ball" : "projectile", room, pr);
        if (pr.kind === "bomb_ball") {
          room.effects.push({type:"bomb_explosion", x:pr.x+pr.w/2, y:pr.y+pr.h/2, color:"#ff8800", life:54});
          pr.life = 0;
        }
      }
    }
  }

  room.projectiles = room.projectiles.slice(-24);
  room.projectiles = room.projectiles.filter(p => p.life > 0 && p.x > -160 && p.x < 860 && p.y > -160 && p.y < 620);
}

function updateEffects(room) {
  room.effects = room.effects.filter(e => {
    e.life--;
    return e.life > 0;
  });
}


function makeCPUPlayer(room, level = 5, index = 1, team = null) {
  const cpuId = "CPU_" + room.code + "_" + index;
  const fakeSocket = {
    id: cpuId,
    account: {
      id: cpuId,
      username: "CPU" + index + " Lv" + level,
      selected_character: "magician_rabbit",
      unlocked_characters: "magician_rabbit",
      guest: true
    }
  };

  let p;
  try {
    p = defaultPlayer(fakeSocket, assignSlot(room));
  } catch (e) {
    p = {
      id: cpuId, slot: assignSlot(room), name: "CPU" + index + " Lv" + level,
      character: "magician_rabbit", x: 560, y: 120, vx: 0, vy: 0, w: 34, h: 48,
      facing: -1, damage: 0, stocks: 3, alive: true, onGround: false, jumpsLeft: 2,
      input: {}, move: null, moveTimer: 0, attackCooldown: 0, hitCooldown: 0, invincible: 60,
      team: team || ((index % 4) + 1), color: TEAM_COLORS[(team || ((index % 4) + 1))] || "#fff1c9", accent: TEAM_COLORS[(team || ((index % 4) + 1))] || "#d71920", skin: "#fff1c9", hair: "#111",
      shield: 100, shieldBroken: false, stunTimer: 0, guardTimer: 0, justGuardTimer: 0,
      recoveryUsed: false, stageVote: room.stageIndex || 0
    };
  }

  p.id = cpuId;
  p.name = "CPU" + index + " Lv" + level;
  p.isCPU = true;
  p.cpuIndex = index;
  p.cpuLevel = Math.max(1, Math.min(9, Number(level) || 5));
  p.team = team || p.team || ((p.slot % 4) + 1);
  p.color = TEAM_COLORS[p.team] || p.color;
  p.accent = TEAM_COLORS[p.team] || p.accent;
  p.character = room.cpuCharacter || "magician_rabbit";
  p.facing = -1;
  p.input = p.input || {};
  p.alive = true;
  p.guardLockTimer = p.guardLockTimer || 0;
  p.ledgeHang = false;
  if (!Number.isFinite(p.x)) p.x = 560;
  if (!Number.isFinite(p.y)) p.y = 120;
  if (!Number.isFinite(p.w)) p.w = 34;
  if (!Number.isFinite(p.h)) p.h = 48;
  if (!Number.isFinite(p.stocks)) p.stocks = 3;
  if (!Number.isFinite(p.damage)) p.damage = 0;
  if (!Number.isFinite(p.jumpsLeft)) p.jumpsLeft = 2;
  return p;
}

function ensureCPU(room) {
  if (!room) return;
  room.players = room.players || {};
  room.cpuLevels = Array.isArray(room.cpuLevels) ? room.cpuLevels : [room.cpuLevel || 5, room.cpuLevel || 5, room.cpuLevel || 5];
  room.cpuTeams = Array.isArray(room.cpuTeams) ? room.cpuTeams.slice(0,3).map(v=>Math.max(1, Math.min(4, Number(v)||1))) : [2,3,4];
  while (room.cpuTeams.length < 3) room.cpuTeams.push((room.cpuTeams.length%4)+1);
  room.cpuLevels = room.cpuLevels.slice(0,3).map(v => Math.max(0, Math.min(9, Number(v) || 0)));
  room.cpuCount = Math.max(0, Math.min(3, Number(room.cpuCount ?? room.cpuLevels.filter(v=>v>0).length) || 0));
  while (room.cpuLevels.length < 3) room.cpuLevels.push(0);

  for (const id of Object.keys(room.players)) {
    if (id.startsWith("CPU_" + room.code + "_") || id === "CPU_" + room.code) delete room.players[id];
  }

  for (let n = 1; n <= room.cpuCount; n++) {
    const lv = Math.max(0, Math.min(9, Number(room.cpuLevels[n-1]) || 0));
    if (lv <= 0) continue;
    if (assignSlot(room) === -1) break;
    const cpu = makeCPUPlayer(room, lv, n, room.cpuTeams[n-1]);
    room.players[cpu.id] = cpu;
  }
  room.cpuLevel = room.cpuLevels.find(v=>v>0) || 0;
}

function getNearestEnemy(bot, players) {
  let best = null;
  let bestD = Infinity;
  for (const p of players) {
    if (p.id === bot.id || !p.alive || p.stocks <= 0) continue;
    if (p.team && bot.team && p.team === bot.team) continue;
    const d = Math.abs((p.x + p.w/2) - (bot.x + bot.w/2)) + Math.abs((p.y + p.h/2) - (bot.y + bot.h/2)) * 0.8;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

function cpuInputFor(bot, target, stage) {
  const lv = Math.max(1, Math.min(9, bot.cpuLevel || 5));
  const input = {left:false,right:false,up:false,down:false,jump:false,attack:false,special:false,smash:false,skillE:false,skillQ:false,guard:false,moveLeft:false,moveRight:false};
  if (!target) return input;

  const bx = bot.x + bot.w/2;
  const by = bot.y + bot.h/2;
  const tx = target.x + target.w/2;
  const ty = target.y + target.h/2;
  const dx = tx - bx;
  const dy = ty - by;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  const dirRight = dx > 0;

  const mainPlat = stage.platforms && stage.platforms[0] ? stage.platforms[0] : {x:60,y:320,w:580,h:26};
  const offStage = bot.y > 315 || bot.x < mainPlat.x - 45 || bot.x > mainPlat.x + mainPlat.w + 45;
  const dangerEdge = bot.x < mainPlat.x + 34 || bot.x > mainPlat.x + mainPlat.w - 34;

  // Recovery first
  if (offStage) {
    if (bot.x < mainPlat.x + mainPlat.w/2) input.right = input.moveRight = true;
    else input.left = input.moveLeft = true;

    if (bot.jumpsLeft > 0 && bot.vy > -4 && lv >= 2) input.jump = true;

    if (lv >= 4 && (bot.y > 245 || bot.vy > 1 || Math.abs(bot.x - (mainPlat.x + mainPlat.w/2)) > mainPlat.w/2)) {
      input.special = input.skillQ = true;
      input.up = true; // Rabbit UpB / Ryzen UpB
      if (bot.x < mainPlat.x + mainPlat.w/2) input.right = true;
      else input.left = true;
    }
    return input;
  }

  if (dangerEdge) {
    if (bot.x < mainPlat.x + 55) input.right = input.moveRight = true;
    if (bot.x > mainPlat.x + mainPlat.w - 55) input.left = input.moveLeft = true;
    if (lv < 7) return input;
  }

  if (adx > 82) {
    if (dirRight) input.right = input.moveRight = true;
    else input.left = input.moveLeft = true;
  } else {
    bot.facing = dirRight ? 1 : -1;
  }

  const targetAttacking = !!target.move || target.attackCooldown > 0;
  if (lv >= 4 && adx < 82 && ady < 58 && targetAttacking && (bot.shield ?? 100) > 28) {
    if (Math.random() < (0.12 + lv * 0.035)) {
      input.guard = true;
      return input;
    }
  }

  if (lv >= 5 && dy < -70 && adx < 110 && bot.onGround && Math.random() < 0.30) input.jump = true;

  if (bot.attackCooldown <= 0) {
    const killPercent = Math.max(70, 125 - lv * 6);

    // Character-specific smarter decisions
    if (bot.character === "ryzen") {
      // Kill with side smash
      if (target.damage >= killPercent && adx < 165 && ady < 62 && lv >= 3 && !dangerEdge) {
        input.smash = true;
        if (dirRight) input.right = true; else input.left = true;
        return input;
      }

      // Anti-air with up smash/up air
      if (ty < by - 55 && adx < 84 && lv >= 4) {
        if (bot.onGround && target.damage > 85 && lv >= 6) input.smash = true;
        else input.attack = input.skillE = true;
        input.up = true;
        return input;
      }

      // Mid range: sideB approach
      if (lv >= 5 && adx > 115 && adx < 245 && ady < 75 && Math.random() < 0.45) {
        input.special = input.skillQ = true;
        if (dirRight) input.right = true; else input.left = true;
        return input;
      }

      // Far range: NB lightning
      if (lv >= 3 && adx > 155 && adx < 360 && ady < 90 && Math.random() < (0.25 + lv * 0.035)) {
        input.special = input.skillQ = true;
        return input;
      }

      // DownB charge if safe
      if (lv >= 7 && adx > 180 && adx < 360 && ady < 85 && Math.random() < 0.10) {
        input.special = input.skillQ = true;
        input.down = true;
        return input;
      }

      // Close range: down tilt sometimes, jab/tilt otherwise
      if (adx < 64 && ady < 52) {
        input.attack = input.skillE = true;
        if (lv >= 6 && Math.random() < 0.28) input.down = true;
        else if (dx > 10) input.right = true;
        else if (dx < -10) input.left = true;
        return input;
      }

      // Dash attack
      if (lv >= 4 && adx >= 64 && adx < 170 && ady < 70) {
        input.attack = input.skillE = true;
        if (dirRight) input.right = input.moveRight = true;
        else input.left = input.moveLeft = true;
        return input;
      }

      return input;
    }

    // Rabbit existing behavior
    if (target.damage >= killPercent && adx < 145 && ady < 56 && lv >= 3 && !dangerEdge) {
      input.smash = true;
      if (dirRight) input.right = true; else input.left = true;
      return input;
    }

    if (lv >= 5 && adx > 95 && adx < 245 && ady < 80 && bot.onGround && Math.random() < (0.12 + lv * 0.025)) {
      input.special = input.skillQ = true;
      input.down = true;
      return input;
    }

    if (lv >= 3 && adx > 150 && adx < 330 && ady < 90 && Math.random() < (0.18 + lv * 0.035)) {
      input.special = input.skillQ = true;
      return input;
    }

    if (ty < by - 55 && adx < 74 && lv >= 4) {
      if (target.damage > 100 && lv >= 7) input.smash = true;
      else input.attack = input.skillE = true;
      input.up = true;
      return input;
    }

    if (adx < 58 && ady < 48) {
      input.attack = input.skillE = true;
      if (dx > 10) input.right = true;
      if (dx < -10) input.left = true;
      return input;
    }

    if (lv >= 5 && adx >= 58 && adx < 165 && ady < 66) {
      input.attack = input.skillE = true;
      if (dirRight) input.right = input.moveRight = true;
      else input.left = input.moveLeft = true;
      return input;
    }
  }

  return input;
}

function updateCPUInputs(room) {
  if (!room || room.status !== "playing") return;
  const players = Object.values(room.players);
  const stage = STAGES[room.stageIndex];
  for (const bot of players) {
    if (!bot.isCPU || !bot.alive || bot.stocks <= 0) continue;
    const target = getNearestEnemy(bot, players);
    bot.input = cpuInputFor(bot, target, stage);
  }
}

function updateRoom(room) {
  updateEffects(room);
  updateProjectiles(room);

  if (room.status !== "playing") return;
  room.effects = (room.effects || []).slice(-24);
  room.projectiles = (room.projectiles || []).slice(-24);
  room.effects = (room.effects || []).slice(-24);
  room.projectiles = (room.projectiles || []).slice(-24);

  updateCPUInputs(room);

  const players = Object.values(room.players);
  const stage = STAGES[room.stageIndex];

  for (const p of players) {
    const ch = charData(p.character);

    if (p.stocks <= 0) continue;

    if (!p.alive) {
      p.respawnTimer--;
      if (p.respawnTimer <= 0) respawn(p);
      continue;
    }

    const i = p.input || {};

    if ((p.ledgeGrabCooldown||0) > 0) p.ledgeGrabCooldown--;
    if ((p.dropTimer||0) > 0) p.dropTimer--;

    if (p.guardLockTimer > 0) {
      if (i.guard) i.guard = false;
      else p.guardLockTimer = 0;
      p.guardLockTimer = Math.max(0, p.guardLockTimer - 1);
    }

    if (p.ledgeHang) {
      p.ledgeTimer = Math.max(0, (p.ledgeTimer || 0) - 1);
      p.vx = 0; p.vy = 0; p.move = null; p.moveTimer = 0;
      const ledgeAttack = !!i.skillE;
      i.attack = false; i.special = false; i.smash = false; i.skillQ = false; i.skillE = false;
      if (p.ledgeTimer <= 0) {
        p.ledgeHang = false; p.ledgeTimer = 0; p.ledgeGrabCooldown = 55; p.vy = 2.8;
        continue;
      }
      const climbRight = (p.ledgeSide === -1) && (i.right || i.moveRight);
      const climbLeft = (p.ledgeSide === 1) && (i.left || i.moveLeft);
      if (ledgeAttack) {
        p.ledgeHang = false;
        p.ledgeGrabCooldown = 45;
        p.y -= 18;
        p.x += (p.ledgeSide === -1 ? 24 : -24);
        p.vx = (p.ledgeSide === -1 ? 2.2 : -2.2);
        p.vy = -4.2;
        p.invincible = 0;
        p.jumpsLeft = 1;
        startMove(p, "ledge_attack", room);
      }
      else if (climbRight || climbLeft) {
        p.ledgeHang = false;
        p.ledgeGrabCooldown = 45;
        p.y -= 22;
        p.x += (p.ledgeSide === -1 ? 32 : -32);
        p.vx = (p.ledgeSide === -1 ? 2.8 : -2.8);
        p.vy = -5.8;
        p.invincible = 0;
        p.jumpsLeft = 1;
      }
      else if (i.jump || i.up) { p.ledgeHang = false; p.ledgeGrabCooldown = 45; p.vy = -9.8; p.invincible = 0; p.jumpsLeft = 1; }
      else if (i.down || p.ledgeTimer <= 0) { p.ledgeHang = false; p.ledgeTimer = 0; p.ledgeGrabCooldown = 55; }
      else { continue; }
    }

    if (i.guard && !p.shieldBroken && (p.shield ?? 100) > 0) {
      i.left = false;
      i.right = false;
      i.moveLeft = false;
      i.moveRight = false;
      i.jump = false;
      i.attack = false;
      i.special = false;
      i.skillE = false;
      i.skillQ = false;
      i.smash = false;
    }
    if (p.stunTimer > 0) {
      p.hitCooldown = 0; // stunned can be hit
      p.invincible = 0;
      p.stunTimer--;
      p.vx *= 0.78;
      p.vy += 0.35;
      if (p.stunTimer <= 0) {
        p.shieldBroken = false;
        p.shield = 100;
        p.guardTimer = 0;
        p.justGuardTimer = 0;
      }
      continue;
    }

    if (i.guard && !p.shieldBroken && (p.shield ?? 100) > 0) {
      p.guardTimer = (p.guardTimer || 0) + 1;
      p.justGuardTimer = Math.max(0, 4 - p.guardTimer);
      p.shield = Math.max(0, (p.shield ?? 100) - 0.18);
      p.vx = 0;
      if (p.shield <= 0) {
        p.shield = 0;
        p.shieldBroken = true;
        p.shield = 0;
        p.invincible = 0;
        p.hitCooldown = 0;
        p.stunTimer = 300;
        p.guardTimer = 0;
        p.justGuardTimer = 0;
        if (p.input) p.input.guard = false;
        p.guardLockTimer = 45;
        room.effects.push({type:"shield_break", x:p.x+p.w/2, y:p.y+p.h/2, color:"#ff66ff", life:80});
        continue;
      }
    } else {
      p.guardTimer = 0;
      p.justGuardTimer = 0;
      if (!p.shieldBroken) {
        p.shield = Math.min(100, (p.shield ?? 100) + 0.45);
      }
    }
    const attackingLock = p.moveTimer > 0;
    const movementLock = attackingLock && ["jab","tilt","up","down","air","air_forward","air_back","air_up","air_down","smash","rabbit_smash_side","rabbit_smash_up","rabbit_smash_down"].includes(p.move);
    const friction = p.onGround ? 0.82 : 0.94;
    const airControl = p.onGround ? 1 : 0.62;

    if (!movementLock && i.left) { p.vx -= ch.accel * airControl; p.facing = -1; }
    if (!movementLock && i.right) { p.vx += ch.accel * airControl; p.facing = 1; }
    if (movementLock && p.onGround) p.vx = 0;

    p.vx *= friction;
    p.vx = Math.max(-ch.speed, Math.min(ch.speed, p.vx));

    if (i.jump && !p.jumpHeld && p.jumpsLeft > 0) {
      p.vy = -ch.jump;
      p.jumpsLeft--;
      p.onGround = false;
    }
    p.jumpHeld = i.jump;

    if (p.attackCooldown > 0) p.attackCooldown--;
    if (p.ryzenCharge > 0) p.ryzenCharge--;

    const move = chooseMove(p);
    if (move) startMove(p, move, room);

    if (p.moveTimer > 0) p.moveTimer--;
    else p.move = null;

    if ((p.stunTimer <= 0 && p.invincible > 0)) p.invincible--;

    p.vy += 0.42;
    p.vy = Math.min(p.vy, 9.2);

    p.x += p.vx;
    p.y += p.vy;
    p.onGround = false;

    for (let pi=0; pi<stage.platforms.length; pi++) platformCollision(p, stage.platforms[pi], pi);
    if (!p.onGround) tryLedgeGrab(p, stage);

    if (p.x < -190 || p.x > 890 || p.y > 530 || p.y < -230) loseStock(p, room);
  }

  for (const attacker of players) {
    if (!attacker.alive || !attacker.move || attacker.moveTimer <= 0) continue;
    const mvDef = MOVES[attacker.move] || {};
    const startupFrames = attacker.move === "ledge_attack" ? 10 : 15;
    if (attacker.moveTimer > Math.max(4, (mvDef.timer || 24) - startupFrames)) continue;
    if (attacker.moveTimer < 4) continue;

    const box = getAttackBox(attacker);
    if (!box) continue;

    for (const defender of players) {
      if (defender.id === attacker.id || !defender.alive || defender.invincible > 0 || defender.hitCooldown > 0) continue;
      if (room.teamMode && (defender.team || 0) === (attacker.team || 0)) continue;
      if (rectsOverlap(box, defender)) applyKnockback(attacker, defender, attacker.move, room);
    }
  }

  for (const p of players) if (p.hitCooldown > 0) p.hitCooldown--;

  for (const p of players) sanitizePlayerState(p);
  checkWinner(room);
}


function sanitizePlayerState(p) {
  if (!p) return;
  if (!Number.isFinite(p.x)) p.x = 350;
  if (!Number.isFinite(p.y)) p.y = 120;
  if (!Number.isFinite(p.vx)) p.vx = 0;
  if (!Number.isFinite(p.vy)) p.vy = 0;
  if (!Number.isFinite(p.damage)) p.damage = 0;
  if (!p.character || !CHARACTERS[p.character]) p.character = room.cpuCharacter || "magician_rabbit";
  if (!p.input) p.input = {};
  if (p.y > 900 || p.y < -500 || p.x < -600 || p.x > 1300) {
    p.x = 350;
    p.y = 120;
    p.vx = 0;
    p.vy = 0;
  }
}

io.on("connection", socket => {
  socket.account = null;

  socket.on("register", async ({username, password}) => {
    try {
      if (!supabase) return socket.emit("authError", "DB設定がないのでゲストで遊んでください");
      username = String(username || "").trim();
      password = String(password || "");

      if (username.length < 3 || username.length > 16) return socket.emit("authError", "名前は3〜16文字");
      if (password.length < 4) return socket.emit("authError", "パスワードは4文字以上");

      const hash = await bcrypt.hash(password, 10);

      const {data, error} = await supabase
        .from("players")
        .insert({
          username,
          password: hash,
          wins: 0,
          losses: 0,
          coins: 0,
          selected_character: "magician_rabbit",
          unlocked_characters: "magician_rabbit"
        })
        .select("id, username, wins, losses, coins, selected_character, unlocked_characters")
        .single();

      if (error) return socket.emit("authError", "その名前は使われています");

      socket.account = profilePublic(data);
      socket.emit("profile", socket.account);
    } catch (e) {
      console.error(e);
      socket.emit("authError", "登録エラー");
    }
  });

  socket.on("login", async ({username, password}) => {
    try {
      if (!supabase) return socket.emit("authError", "DB設定がないのでゲストで遊んでください");
      username = String(username || "").trim();
      password = String(password || "");

      const {data, error} = await supabase.from("players").select("*").eq("username", username).single();

      if (error || !data) return socket.emit("authError", "名前かパスワードが違います");

      const ok = await bcrypt.compare(password, data.password);
      if (!ok) return socket.emit("authError", "名前かパスワードが違います");

      socket.account = profilePublic(data);
      socket.emit("profile", socket.account);
    } catch (e) {
      console.error(e);
      socket.emit("authError", "ログインエラー");
    }
  });

  socket.on("guest", data => {
    socket.account = makeGuest(socket, data);
    socket.emit("profile", socket.account);
  });

  socket.on("createRoom", data => {
    data = data || {};
    if (!socket.account) socket.account = makeGuest(socket, data);

    const code = makeRoomCode();
    const room = {
      code,
      hostId: socket.id,
      players: {},
      status: "lobby",
      stageIndex: 0,
      selectedStageFinal: false,
      effects: [],
      projectiles: [],
      message: "ロビー：キャラとステージを選んで開始",
      winner: null,
      resultsSaved: false,
      cpuLevel: Math.max(0, Math.min(9, Number(data.cpuLevel ?? 5))),
      cpuLevels: Array.isArray(data.cpuLevels) ? data.cpuLevels.slice(0,3).map(v=>Math.max(0,Math.min(9,Number(v)||0))) : [Math.max(0, Math.min(9, Number(data.cpuLevel ?? 5))),0,0],
      cpuTeams: Array.isArray(data.cpuTeams||data.teams) ? (data.cpuTeams||data.teams).slice(0,3).map(v=>Math.max(1,Math.min(4,Number(v)||1))) : [2,3,4],
      cpuCount: Math.max(0, Math.min(3, Number(data.cpuCount ?? (Number(data.cpuLevel ?? 5) > 0 ? 1 : 0)))),
      teamMode: !!data.teamMode
    };

    rooms[code] = room;
    room.cpuLevel = Math.max(0, Math.min(9, Number(data.cpuLevel ?? 5)));
    room.cpuLevels = Array.isArray(data.cpuLevels) ? data.cpuLevels.slice(0,3).map(v=>Math.max(0,Math.min(9,Number(v)||0))) : [room.cpuLevel,0,0];
    room.cpuTeams = Array.isArray(data.cpuTeams||data.teams) ? (data.cpuTeams||data.teams).slice(0,3).map(v=>Math.max(1,Math.min(4,Number(v)||1))) : [2,3,4];
    room.cpuCount = Math.max(0, Math.min(3, Number(data.cpuCount ?? room.cpuLevels.filter(v=>v>0).length)));
    room.teamMode = !!data.teamMode;
    socket.join(code);

    const slot = assignSlot(room);
    const p = defaultPlayer(socket, slot);
    p.character = CHARACTERS[data.character] ? data.character : socket.account.selected_character;
    p.stageVote = Number.isInteger(data.stageVote) ? data.stageVote : 0;
    room.players[socket.id] = p;

    socket.emit("joinedRoom", {code, slot, room: publicRoom(room)});
    io.to(code).emit("roomState", publicRoom(room));
  });

  socket.on("spectateRoom", data => {
    data = data || {};
    if (!socket.account) socket.account = makeGuest(socket, data);

    const code = String(data.code || "").trim().toUpperCase();
    const room = rooms[code];
    if (!room) return socket.emit("errorMessage", "部屋が見つかりません");

    socket.join(code);
    if (room.players && room.players[socket.id]) delete room.players[socket.id];
    room.spectators = room.spectators || {};
    room.spectators[socket.id] = {id:socket.id, name:(socket.account && socket.account.username) || "Spectator"};
    socket.emit("joinedRoom", {code, slot:-1, spectator:true, room: publicRoom(room)});
    if (room.status === "playing") socket.emit("startGame", publicRoom(room));
    io.to(code).emit("roomState", publicRoom(room));
  });

  socket.on("joinRoom", data => {
    data = data || {};
    if (!socket.account) socket.account = makeGuest(socket, data);

    const code = String(data.code || "").trim().toUpperCase();
    const room = rooms[code];
    if (!room) return socket.emit("errorMessage", "部屋が見つかりません");
    if (room.status !== "lobby") {
      socket.join(code);
      room.spectators = room.spectators || {};
      room.spectators[socket.id] = {id:socket.id, name:(socket.account && socket.account.username) || "Spectator"};
      socket.emit("joinedRoom", {code, slot:-1, spectator:true, room: publicRoom(room)});
      socket.emit("startGame", publicRoom(room));
      io.to(code).emit("roomState", publicRoom(room));
      return;
    }

    const slot = assignSlot(room);
    if (slot === -1) return socket.emit("errorMessage", "部屋が満員です");

    socket.join(code);

    const p = defaultPlayer(socket, slot);
    p.character = CHARACTERS[data.character] ? data.character : socket.account.selected_character;
    p.stageVote = Number.isInteger(data.stageVote) ? data.stageVote : 0;
    room.players[socket.id] = p;

    socket.emit("joinedRoom", {code, slot, room: publicRoom(room)});
    io.to(code).emit("roomState", publicRoom(room));
  });

  socket.on("selectInRoom", data => {
    data = data || {};
    const room = rooms[data.code];
    if (!room || !room.players[socket.id]) return;

    const p = room.players[socket.id];

    if (CHARACTERS[data.character]) {
      p.character = data.character;
      const ch = charData(data.character);
      p.color = ch.color; p.accent = ch.accent; p.skin = ch.skin; p.hair = ch.hair;

      if (socket.account) socket.account.selected_character = data.character;

      if (socket.account && socket.account.id && supabase) {
        supabase.from("players").update({selected_character:data.character}).eq("id", socket.account.id).then(() => {});
      }
    }

    if (Number.isInteger(data.stageVote) && data.stageVote >= 0 && data.stageVote < STAGES.length) {
      p.stageVote = data.stageVote;
    }

    room.message = "ロビー：キャラとステージを選んで開始";
    io.to(room.code).emit("roomState", publicRoom(room));
  });

  
  socket.on("setTeamMode", data => {
    data = data || {};
    const room = rooms[data.code];
    if (!room || room.hostId !== socket.id || room.status !== "lobby") return;
    room.teamMode = !!data.teamMode;
    for (const p of Object.values(room.players || {})) {
      p.team = p.team || ((p.slot % 4) + 1);
    }
    room.message = room.teamMode ? "チーム戦ON：各プレイヤーのチームを自由に選択できます" : "チーム戦OFF";
    io.to(room.code).emit("roomState", publicRoom(room));
  });


  socket.on("setPlayerTeam", data => {
    data = data || {};
    const room = rooms[data.code];
    if (!room || room.status !== "lobby") return;
    const targetId = String(data.playerId || socket.id);
    if (room.hostId !== socket.id && targetId !== socket.id) return;
    const p = room.players[targetId];
    if (!p) return;
    p.team = Math.max(1, Math.min(4, Number(data.team) || 1));
    p.color = TEAM_COLORS[p.team] || p.color; p.accent = TEAM_COLORS[p.team] || p.accent;
    if (p.isCPU && p.cpuIndex) { room.cpuTeams = room.cpuTeams || [2,3,4]; room.cpuTeams[p.cpuIndex-1] = p.team; }
    room.teamMode = true;
    room.message = "チーム変更：自由チーム";
    io.to(room.code).emit("roomState", publicRoom(room));
  });

  
  socket.on("setCPUCharacter", data => {
    data = data || {};
    const room = rooms[data.code];
    if (!room || room.hostId !== socket.id || room.status !== "lobby") return;
    const ch = data.character === "ryzen" ? "ryzen" : "magician_rabbit";
    room.cpuCharacter = ch;
    const cpuId = "CPU_" + room.code;
    if (room.players[cpuId]) {
      room.players[cpuId].character = ch;
      room.players[cpuId].name = ch === "ryzen" ? ("CPU" + (room.cpuLevel || 5) + " ライゼン") : ("CPU" + (room.cpuLevel || 5));
    }
    io.to(room.code).emit("roomState", publicRoom(room));
  });

socket.on("setCPU", data => {
    data = data || {};
    const room = rooms[data.code];
    if (!room || room.hostId !== socket.id || room.status !== "lobby") return;
    const levels = Array.isArray(data.levels) ? data.levels.slice(0,3).map(v=>Math.max(0,Math.min(9,Number(v)||0))) : [Math.max(0, Math.min(9, Number(data.level) || 0)),0,0];
    room.cpuCount = Math.max(0, Math.min(3, Number(data.count ?? levels.filter(v=>v>0).length) || 0));
    for (let i=0;i<room.cpuCount;i++) if (!levels[i]) levels[i] = 5;
    room.cpuLevels = levels;
    if (Array.isArray(data.teams || data.cpuTeams)) room.cpuTeams = (data.teams || data.cpuTeams).slice(0,3).map(v=>Math.max(1,Math.min(4,Number(v)||1)));
    else room.cpuTeams = room.cpuTeams || [2,3,4];
    if (room.cpuCount <= 0) room.cpuLevels = [0,0,0];
    ensureCPU(room);
    room.message = room.cpuCount > 0 ? ("CPU設定：Lv " + room.cpuLevels.slice(0,room.cpuCount).join(" / ") + " チーム " + (room.cpuTeams||[]).slice(0,room.cpuCount).join(" / ")) : "CPU OFF";
    io.to(room.code).emit("roomState", publicRoom(room));
  });
  socket.on("startBattle", data => {
    const code = typeof data === "string" ? data : (data && data.code);
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;
    ensureCPU(room);
    startBattle(room);
  });


  socket.on("input", data => {
    const room = rooms[data.code];
    if (!room || !room.players[socket.id]) return;
    if (room.players[socket.id].isCPU) return;
    room.players[socket.id].input = data.input;
  });

  socket.on("restart", code => {
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;

    room.status = "lobby";
    room.selectedStageFinal = false;
    room.stageIndex = 0;
    room.effects = [];
    room.projectiles = [];
    room.winner = null;
    room.message = "ロビー：キャラとステージを選んで開始";
    ensureCPU(room);
    for (const p of Object.values(room.players)) resetFighterState(p);
    io.to(code).emit("roomState", publicRoom(room));
  });

  
  socket.on("start-game", data => {
    const code = typeof data === "string" ? data : (data && data.code);
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;
    ensureCPU(room);
    startBattle(room);
  });

socket.on("disconnect", () => {
    for (const code of Object.keys(rooms)) {
      const room = rooms[code];
      if (!room.players[socket.id]) {
        if (room.spectators && room.spectators[socket.id]) { delete room.spectators[socket.id]; io.to(code).emit("roomState", publicRoom(room)); }
        continue;
      }

      delete room.players[socket.id];

      if (Object.keys(room.players).length === 0) {
        delete rooms[code];
      } else {
        if (room.hostId === socket.id) {
          room.hostId = Object.keys(room.players)[0];
        }
        if (room.status === "playing" && Object.keys(room.players).length < 2) {
          room.status = "lobby";
          room.message = "相手が抜けました";
          room.selectedStageFinal = false;
        }
        io.to(code).emit("roomState", publicRoom(room));
      }
    }
  });
});

setInterval(() => {
  for (const code of Object.keys(rooms)) {
    updateRoom(rooms[code]);
    io.to(code).emit("roomState", publicRoom(rooms[code]));
  }
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Azakun Smash Online v3.3.5 Ryzen stable visual fix" + PORT));
