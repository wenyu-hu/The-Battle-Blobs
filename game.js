// =============================================================
//  THE BATTLE BLOBS — game.js
//  Level 1: Goopton Plains  (blobs vs cubes)
// =============================================================

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const W = canvas.width;   // 800
const H = canvas.height;  // 380

// ── Layout ────────────────────────────────────────────────────
const GROUND_Y   = 290;   // y where units stand
const P_BASE_X   = 760;   // player base centre x  (right)
const E_BASE_X   = 40;    // enemy  base centre x  (left)
const P_BASE_MAX = 5000;
const E_BASE_MAX = 1500;

// ── Blob stats ────────────────────────────────────────────────
//  Battle-Cats-style attack timing, in frames @60fps:
//    foreswing  — wind-up before the hit lands
//    strikeHold — how long the lunge / attack pose is shown
//    attackCycle— total time between the start of two attacks
const BASIC_BLOB = {
  hp: 250, damage: 20,
  range: 74,
  speed: 2,
  cost: 50,
  spawnCooldown: 60,
  w: 90, h: 96,            // logical hitbox
  attackCycle: 76,
  foreswing:   14,
  strikeHold:  12,
  lunge:       18,         // px the body lunges toward the enemy on strike
  kb: 1,                   // knockback count spread across its HP
};

// ── Cube stats ────────────────────────────────────────────────
const CUBE_DEF = {
  hp: 140, damage: 14,
  range: 64,
  speed: 1.2,
  reward: 25,
  size: 50,
  attackCycle: 92,
  foreswing:   18,
  strikeHold:  12,
  lunge:       12,
  kb: 1,
};

const UNIT_GAP = 26;       // min spacing so same-side units queue up (stacking)
const SPAWN_POP = 12;      // frames of the spawn pop-in

// ── Blob sprite body boxes ────────────────────────────────────
//  Each sprite is drawn so its *green body* (bx,by,bw,bh inside the
//  iw×ih source image) maps to a constant on-screen width with its
//  feet on the ground.  This keeps every frame the same size — the
//  attack frame's motion lines flare OUTWARD instead of shrinking
//  the blob.  Boxes were measured from the PNG alpha/colour data.
const BLOB_BODY = {
  idle:      { bx:21,  by:19,  bw:318, bh:334, iw:358, ih:370 },
  walk1:     { bx:19,  by:18,  bw:297, bh:336, iw:334, ih:371 },
  walk2:     { bx:19,  by:18,  bw:297, bh:334, iw:334, ih:385 },
  walk3:     { bx:19,  by:18,  bw:305, bh:336, iw:343, ih:371 },
  walk4:     { bx:19,  by:18,  bw:297, bh:338, iw:334, ih:373 },
  attack:    { bx:356, by:145, bw:406, bh:426, iw:888, ih:761 },
  knockback: { bx:24,  by:24,  bw:391, bh:415, iw:439, ih:460 },
  dead:      { bx:5,   by:5,   bw:340, bh:120, iw:350, ih:130 },
};
const BODY_W = 88;         // on-screen target width of the blob body
const WALK_FRAMES = ['walk1', 'walk2', 'walk3', 'walk4'];

// ── Sprite loading ────────────────────────────────────────────
const spr = {};
const SPRITE_SRCS = {
  idle:      'img/blob/basic-blob-idle.png',
  walk1:     'img/blob/basic-blob-walk1.png',
  walk2:     'img/blob/basic-blob-walk2.png',
  walk3:     'img/blob/basic-blob-walk3.png',
  walk4:     'img/blob/basic-blob-walk4.png',
  attack:    'img/blob/basic-bob-attack.png',
  knockback: 'img/blob/basic-blob-knockback.png',
  dead:      'img/blob/basic-blob-dead.png',
};
for (const [k, src] of Object.entries(SPRITE_SRCS)) {
  const img = new Image();
  img.src = src;
  spr[k] = img;
}

// ── Small easing helper for spawn pop-in ──────────────────────
function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// ── Game state ────────────────────────────────────────────────
let money, playerHp, enemyHp;
let blobs, cubes, effects;
let frame, moneyTimer, enemySpawnTimer;
let blobCooldown;
let gameOver, result;   // result: 'WIN' | 'LOSE'

function initGame() {
  money          = 150;
  playerHp       = P_BASE_MAX;
  enemyHp        = E_BASE_MAX;
  blobs          = [];
  cubes          = [];
  effects        = [];
  frame          = 0;
  moneyTimer     = 0;
  enemySpawnTimer= 0;
  blobCooldown   = 0;
  gameOver       = false;
  result         = null;
  refreshHUD();
  if (window.Music) Music.startBattle();
}

// =============================================================
//  Hit / pickup effects  (sparks + floating text)
// =============================================================

function spawnImpact(x, y, color = '#fff') {
  effects.push({ type: 'spark', x, y, life: 0, max: 14, color, rot: Math.random() * Math.PI });
}
function spawnText(x, y, text, color) {
  effects.push({ type: 'text', x, y, life: 0, max: 46, color, text });
}

function updateEffects() {
  effects.forEach(e => e.life++);
  effects = effects.filter(e => e.life < e.max);
}

function drawEffects() {
  for (const e of effects) {
    const p = e.life / e.max;          // 0 → 1
    ctx.save();
    if (e.type === 'spark') {
      const r = 6 + p * 22;
      ctx.globalAlpha = 1 - p;
      ctx.translate(e.x, e.y);
      ctx.rotate(e.rot);
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 3 * (1 - p) + 1;
      ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4);
        ctx.lineTo(Math.cos(a) * r,       Math.sin(a) * r);
        ctx.stroke();
      }
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, (1 - p) * 5 + 1, 0, Math.PI * 2);
      ctx.fill();
    } else { // floating text
      ctx.globalAlpha = 1 - p * p;
      ctx.fillStyle = e.color;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(e.text, e.x, e.y - p * 26);
    }
    ctx.restore();
  }
}

// =============================================================
//  BasicBlob  (player unit — moves LEFT)
// =============================================================
class BasicBlob {
  constructor() {
    const d = BASIC_BLOB;
    this.x  = P_BASE_X - 28 - d.w;
    this.w  = d.w;
    this.h  = d.h;
    this.hp = d.hp;
    this.maxHp = d.hp;
    this.state  = 'WALK';      // WALK | ATTACK | KNOCKBACK | DEAD
    this.atkTimer   = 0;
    this.animFrame  = 0;
    this.animTimer  = 0;
    this.knockTimer = 0;
    this.knockVx    = 0;
    this.deadTimer  = 0;
    this.opacity    = 1;
    this.spawnT     = 0;
    this.hitPop     = 0;
    this.kbLeft     = d.kb;
  }

  get cx()    { return this.x + this.w / 2; }
  get front() { return this.x; }            // leftmost edge faces the enemy

  takeDamage(dmg) {
    if (this.state === 'DEAD') return;
    this.hp -= dmg;
    this.hitPop = 6;
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = 'DEAD';
      this.deadTimer = 0;
      return;
    }
    // Knockback once per HP threshold (Battle-Cats style)
    if (this.kbLeft > 0 && this.hp <= this.maxHp * this.kbLeft / (BASIC_BLOB.kb + 1)) {
      this.kbLeft--;
      this.state = 'KNOCKBACK';
      this.knockTimer = 20;
      this.knockVx = 3.4;       // pushed back toward own base (right, +x)
    }
  }

  // Nearest cube (or 'base') within attack range, else null.
  findTarget() {
    let best = null, bestGap = Infinity;
    for (const c of cubes) {
      if (c.state === 'DEAD') continue;
      const gap = this.front - (c.x + c.w);   // my left → cube's right
      if (gap <= BASIC_BLOB.range && gap > -c.w && gap < bestGap) {
        best = c; bestGap = gap;
      }
    }
    if (!best && this.front - (E_BASE_X + 22) <= BASIC_BLOB.range) best = 'base';
    return best;
  }

  // True if a friendly blob is right in front (so we queue up behind it).
  blockedAhead() {
    for (const o of blobs) {
      if (o === this || o.state === 'DEAD') continue;
      if (o.x < this.x && this.x - o.x < UNIT_GAP) return true;
    }
    return false;
  }

  strike(target) {
    if (target === 'base') {
      enemyHp = Math.max(0, enemyHp - BASIC_BLOB.damage);
      refreshHUD();
      spawnImpact(E_BASE_X + 26, GROUND_Y - 46, '#9ef');
    } else {
      target.takeDamage(BASIC_BLOB.damage);
      spawnImpact(this.front - 4, GROUND_Y - this.h * 0.42, '#fff');
    }
    window.Music?.hit?.();
  }

  update() {
    if (this.spawnT < SPAWN_POP) this.spawnT++;
    if (this.hitPop > 0) this.hitPop--;

    if (this.state === 'DEAD') {
      this.deadTimer++;
      this.opacity = Math.max(0, 1 - this.deadTimer / 40);
      return;
    }

    if (this.state === 'KNOCKBACK') {
      this.knockTimer--;
      this.x += this.knockVx;
      this.knockVx *= 0.9;
      if (this.knockTimer <= 0) { this.state = 'WALK'; this.atkTimer = 0; }
      return;
    }

    const target = this.findTarget();

    if (target) {
      if (this.state !== 'ATTACK') { this.state = 'ATTACK'; this.atkTimer = 0; }
      this.atkTimer++;
      if (this.atkTimer === BASIC_BLOB.foreswing) this.strike(target);   // hit lands
      if (this.atkTimer >= BASIC_BLOB.attackCycle) this.atkTimer = 0;    // reload
      return;
    }

    // No target → walk left, queuing behind friendlies.
    this.state = 'WALK';
    this.atkTimer = 0;
    if (!this.blockedAhead()) this.x -= BASIC_BLOB.speed;
    this.animTimer++;
    if (this.animTimer >= 7) { this.animTimer = 0; this.animFrame = (this.animFrame + 1) % 4; }
  }

  // Choose sprite + per-phase transforms, then draw normalized.
  draw() {
    let key, lunge = 0, sx = 1, sy = 1;

    if (this.state === 'DEAD')           key = 'dead';
    else if (this.state === 'KNOCKBACK') key = 'knockback';
    else if (this.state === 'WALK')      key = WALK_FRAMES[this.animFrame];
    else {  // ATTACK — idle → strike → recover within one cycle
      const t = this.atkTimer, f = BASIC_BLOB.foreswing, s = BASIC_BLOB.strikeHold;
      if (t >= f && t < f + s) {
        key = 'attack';
        lunge = Math.sin((t - f) / s * Math.PI) * BASIC_BLOB.lunge;   // pop forward & back
      } else {
        key = 'idle';
        if (t < f && t >= f - 6) { sx = 1.06; sy = 0.92; }            // wind-up crouch
      }
    }

    // spawn pop-in + hit pop, applied as feet-anchored scale
    const pop = 0.4 + 0.6 * easeOutBack(Math.min(1, this.spawnT / SPAWN_POP));
    const hit = 1 + 0.06 * (this.hitPop / 6);
    sx *= pop * hit;
    sy *= pop * hit;

    this.drawSprite(key, lunge, sx, sy);
  }

  drawSprite(key, lunge, sx, sy) {
    const m = BLOB_BODY[key];
    const img = spr[key];
    const scale = BODY_W / m.bw;

    ctx.save();
    ctx.globalAlpha = this.opacity;
    // Mirror around the body centre so the blob faces left; lunge shifts it forward.
    ctx.translate(this.cx - lunge, 0);
    ctx.scale(-1, 1);

    if (img && img.complete && img.naturalWidth > 0) {
      const dw = m.iw * scale * sx;
      const dh = m.ih * scale * sy;
      const bodyCx     = (m.bx + m.bw / 2) * scale * sx;   // body centre from image left
      const bodyBottom = (m.by + m.bh)     * scale * sy;   // body bottom from image top
      ctx.drawImage(img, -bodyCx, GROUND_Y - bodyBottom, dw, dh);
    } else {
      ctx.fillStyle = '#42d742';
      ctx.beginPath();
      ctx.ellipse(0, GROUND_Y - BODY_W / 2 * sy, BODY_W / 2 * sx, BODY_W / 2 * sy, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// =============================================================
//  Cube  (enemy unit — moves RIGHT)
// =============================================================
class Cube {
  constructor() {
    const s = CUBE_DEF.size;
    this.size   = s;
    this.w      = s;
    this.h      = s;
    this.x      = E_BASE_X + 28;       // spawn just right of enemy base
    this.hp     = CUBE_DEF.hp;
    this.maxHp  = CUBE_DEF.hp;
    this.state  = 'WALK';
    this.atkTimer  = 0;
    this.knockTimer= 0;
    this.knockVx   = 0;
    this.spin      = 0;
    this.deadTimer = 0;
    this.opacity   = 1;
    this.spawnT    = 0;
    this.hitPop    = 0;
    this.kbLeft    = CUBE_DEF.kb;
  }

  get cx()    { return this.x + this.w / 2; }
  get front() { return this.x + this.w; }    // rightmost edge faces the player

  takeDamage(dmg) {
    if (this.state === 'DEAD') return;
    this.hp -= dmg;
    this.hitPop = 6;
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = 'DEAD';
      this.deadTimer = 0;
      money += CUBE_DEF.reward;
      refreshHUD();
      spawnImpact(this.cx, GROUND_Y - this.size / 2, '#f88');
      spawnText(this.cx, GROUND_Y - this.size - 6, `+${CUBE_DEF.reward}`, '#ffd700');
      window.Music?.coin?.();
      return;
    }
    if (this.kbLeft > 0 && this.hp <= this.maxHp * this.kbLeft / (CUBE_DEF.kb + 1)) {
      this.kbLeft--;
      this.state = 'KNOCKBACK';
      this.knockTimer = 20;
      this.knockVx = -3.4;       // pushed back toward own base (left, -x)
    }
  }

  findTarget() {
    let best = null, bestGap = Infinity;
    for (const b of blobs) {
      if (b.state === 'DEAD') continue;
      const gap = b.front - this.front;     // my right → blob's left
      if (gap <= CUBE_DEF.range && gap > -b.w && gap < bestGap) {
        best = b; bestGap = gap;
      }
    }
    if (!best && (P_BASE_X - 22) - this.front <= CUBE_DEF.range) best = 'base';
    return best;
  }

  blockedAhead() {
    for (const o of cubes) {
      if (o === this || o.state === 'DEAD') continue;
      if (o.x > this.x && o.x - this.x < UNIT_GAP) return true;
    }
    return false;
  }

  strike(target) {
    if (target === 'base') {
      playerHp = Math.max(0, playerHp - CUBE_DEF.damage);
      refreshHUD();
      spawnImpact(P_BASE_X - 26, GROUND_Y - 46, '#f99');
    } else {
      target.takeDamage(CUBE_DEF.damage);
      spawnImpact(this.front + 4, GROUND_Y - this.size * 0.5, '#fff');
    }
    window.Music?.hit?.();
  }

  update() {
    if (this.spawnT < SPAWN_POP) this.spawnT++;
    if (this.hitPop > 0) this.hitPop--;

    if (this.state === 'DEAD') {
      this.deadTimer++;
      this.opacity = Math.max(0, 1 - this.deadTimer / 30);
      return;
    }

    if (this.state === 'KNOCKBACK') {
      this.knockTimer--;
      this.x += this.knockVx;
      this.knockVx *= 0.9;
      this.spin += 0.25;
      if (this.knockTimer <= 0) { this.state = 'WALK'; this.atkTimer = 0; this.spin = 0; }
      return;
    }

    const target = this.findTarget();

    if (target) {
      if (this.state !== 'ATTACK') { this.state = 'ATTACK'; this.atkTimer = 0; }
      this.atkTimer++;
      if (this.atkTimer === CUBE_DEF.foreswing) this.strike(target);
      if (this.atkTimer >= CUBE_DEF.attackCycle) this.atkTimer = 0;
      return;
    }

    this.state = 'WALK';
    this.atkTimer = 0;
    if (!this.blockedAhead()) this.x += CUBE_DEF.speed;
  }

  draw() {
    const s = this.size;
    const y = GROUND_Y - s;

    // ── death: shatter into four chunks that drift apart ──
    if (this.state === 'DEAD') {
      ctx.save();
      ctx.globalAlpha = this.opacity;
      ctx.fillStyle = '#b33';
      const half = s / 2 - 2, sp = this.deadTimer * 0.6;
      ctx.fillRect(this.x - sp,            y - sp,            half, half);
      ctx.fillRect(this.x + half + 4 + sp, y - sp,            half, half);
      ctx.fillRect(this.x - sp,            y + half + 4 + sp, half, half);
      ctx.fillRect(this.x + half + 4 + sp, y + half + 4 + sp, half, half);
      ctx.restore();
      return;
    }

    // ── attack phase transforms ──
    let dx = 0, bright = false;
    if (this.state === 'ATTACK') {
      const t = this.atkTimer, f = CUBE_DEF.foreswing, sH = CUBE_DEF.strikeHold;
      if (t >= f && t < f + sH) {                       // strike: lunge forward (+x)
        dx = Math.sin((t - f) / sH * Math.PI) * CUBE_DEF.lunge;
        bright = true;
      } else if (t < f && t >= f - 6) {                 // wind-up: pull back (-x)
        dx = -3 * ((t - (f - 6)) / 6);
      }
    }

    const pop = 0.4 + 0.6 * easeOutBack(Math.min(1, this.spawnT / SPAWN_POP));
    const hit = 1 + 0.08 * (this.hitPop / 6);

    ctx.save();
    ctx.globalAlpha = this.opacity;
    // feet-anchored pop / hit scale, lunge offset, and knockback spin
    ctx.translate(this.cx + dx, GROUND_Y);
    ctx.scale(pop * hit, pop * hit);
    if (this.state === 'KNOCKBACK') ctx.rotate(this.spin);
    ctx.translate(-this.cx, -GROUND_Y);

    this.drawBody(this.x, y, s, bright, this.hitPop > 0);
    ctx.restore();
  }

  drawBody(x, y, s, bright, flash) {
    // Right face (darker)
    ctx.fillStyle = bright ? '#a22' : '#8a2222';
    ctx.beginPath();
    ctx.moveTo(x + s,      y);
    ctx.lineTo(x + s + 10, y - 10);
    ctx.lineTo(x + s + 10, y + s - 10);
    ctx.lineTo(x + s,      y + s);
    ctx.closePath();
    ctx.fill();

    // Top face (lighter)
    ctx.fillStyle = bright ? '#f88' : '#d05050';
    ctx.beginPath();
    ctx.moveTo(x,          y);
    ctx.lineTo(x + 10,     y - 10);
    ctx.lineTo(x + s + 10, y - 10);
    ctx.lineTo(x + s,      y);
    ctx.closePath();
    ctx.fill();

    // Front face (white flash on the frame a hit lands)
    ctx.fillStyle = flash ? '#fff' : (bright ? '#d44' : '#b33');
    ctx.fillRect(x, y, s, s);

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 8,      y + 12, 13, 11);
    ctx.fillRect(x + s - 21, y + 12, 13, 11);
    ctx.fillStyle = '#111';
    ctx.fillRect(x + 12,     y + 14,  7,  8);
    ctx.fillRect(x + s - 17, y + 14,  7,  8);

    // Angry brows
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + 6,      y + 10);
    ctx.lineTo(x + 22,     y + 14);
    ctx.moveTo(x + s - 6,  y + 10);
    ctx.lineTo(x + s - 22, y + 14);
    ctx.stroke();

    // Mouth — grimace on strike, flat otherwise
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (bright) {
      ctx.moveTo(x + 10,     y + s - 14);
      ctx.lineTo(x + 18,     y + s - 18);
      ctx.lineTo(x + 26,     y + s - 14);
      ctx.lineTo(x + 34,     y + s - 18);
      ctx.lineTo(x + s - 10, y + s - 14);
    } else {
      ctx.moveTo(x + 12,     y + s - 15);
      ctx.lineTo(x + s - 12, y + s - 15);
    }
    ctx.stroke();
  }
}

// =============================================================
//  Drawing helpers
// =============================================================

function drawBackground() {
  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, '#0a0a1e');
  sky.addColorStop(1, '#16335a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND_Y);

  // Distant hills (two parallax layers)
  ctx.fillStyle = '#13284a';
  hill(120, 250, 180, 90);
  hill(420, 250, 240, 110);
  hill(700, 250, 200, 80);
  ctx.fillStyle = '#16345e';
  hill(250, 290, 260, 70);
  hill(560, 290, 300, 86);

  // Ground
  ctx.fillStyle = '#162a16';
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  ctx.fillStyle = '#1e3a1e';
  ctx.fillRect(0, GROUND_Y, W, 5);

  // Grass tufts
  ctx.strokeStyle = '#27492a';
  ctx.lineWidth = 2;
  for (let gx = 16; gx < W; gx += 46) {
    ctx.beginPath();
    ctx.moveTo(gx, GROUND_Y + 16); ctx.lineTo(gx - 3, GROUND_Y + 9);
    ctx.moveTo(gx, GROUND_Y + 16); ctx.lineTo(gx,     GROUND_Y + 7);
    ctx.moveTo(gx, GROUND_Y + 16); ctx.lineTo(gx + 3, GROUND_Y + 9);
    ctx.stroke();
  }
}

function hill(cx, baseY, w, h) {
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, baseY);
  ctx.quadraticCurveTo(cx, baseY - h, cx + w / 2, baseY);
  ctx.closePath();
  ctx.fill();
}

// Soft shadow under a unit, before its sprite is drawn.
function drawShadow(cx, r) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(cx, GROUND_Y + 3, r, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBase(cx, maxHp, currentHp, isPlayer) {
  const baseW = 50, baseH = 104;
  const bx = cx - baseW / 2;
  const by = GROUND_Y - baseH;
  const dark   = isPlayer ? '#23234d' : '#4d1c26';
  const body   = isPlayer ? '#2f2f63' : '#6a2330';
  const trim   = isPlayer ? '#4a4a9c' : '#9c3346';
  const accent = isPlayer ? '#6fa8ff' : '#ff6f7a';

  // Tower body with a little shading
  ctx.fillStyle = dark;
  ctx.fillRect(bx, by, baseW, baseH);
  ctx.fillStyle = body;
  ctx.fillRect(bx + 5, by, baseW - 10, baseH);

  // Crenellations
  ctx.fillStyle = trim;
  for (let i = 0; i < 4; i++) ctx.fillRect(bx + i * 13 + 1, by - 12, 9, 12);

  // Door arch
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(cx - 9, GROUND_Y - 30, 18, 30);
  ctx.beginPath();
  ctx.arc(cx, GROUND_Y - 30, 9, Math.PI, 0);
  ctx.fill();

  // Flag pole + pennant (points away from the battlefield)
  ctx.strokeStyle = trim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, by - 12); ctx.lineTo(cx, by - 30);
  ctx.stroke();
  ctx.fillStyle = accent;
  const fdir = isPlayer ? 1 : -1;
  ctx.beginPath();
  ctx.moveTo(cx, by - 30);
  ctx.lineTo(cx + fdir * 16, by - 26);
  ctx.lineTo(cx, by - 22);
  ctx.closePath();
  ctx.fill();

  // HP bar above tower
  const barW = 56, barH = 6, barX = cx - barW / 2, barY = by - 30;
  ctx.fillStyle = '#000';
  ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
  ctx.fillStyle = '#333';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = accent;
  ctx.fillRect(barX, barY, barW * Math.max(0, currentHp) / maxHp, barH);

  // HP text
  ctx.fillStyle = accent;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${currentHp}/${maxHp}`, cx, barY - 4);
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = result === 'WIN' ? '#6f6' : '#f66';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText(result === 'WIN' ? '🎉 Victory!' : '💀 Defeated!', W / 2, H / 2 - 16);

  ctx.fillStyle = '#aaa';
  ctx.font = '18px sans-serif';
  ctx.fillText('Press R to retry', W / 2, H / 2 + 22);
}

// =============================================================
//  HUD
// =============================================================

function refreshHUD() {
  document.getElementById('money').textContent = money;
  document.getElementById('p-hp').textContent = `${playerHp}/${P_BASE_MAX}`;
  document.getElementById('e-hp').textContent = `${enemyHp}/${E_BASE_MAX}`;
  updateBlobButton();
}

function updateBlobButton() {
  const btn = document.getElementById('btn-basic');
  btn.classList.remove('can-afford', 'cant-afford', 'on-cooldown');
  if (blobCooldown > 0)              btn.classList.add('on-cooldown');
  else if (money >= BASIC_BLOB.cost) btn.classList.add('can-afford');
  else                               btn.classList.add('cant-afford');
  const pct = blobCooldown > 0 ? (blobCooldown / BASIC_BLOB.spawnCooldown * 100) : 0;
  document.getElementById('cd-basic').style.height = pct + '%';
}

// =============================================================
//  Spawning
// =============================================================

function trySpawnBlob() {
  if (gameOver) return;
  if (money < BASIC_BLOB.cost) return;
  if (blobCooldown > 0) return;
  money -= BASIC_BLOB.cost;
  blobs.push(new BasicBlob());
  blobCooldown = BASIC_BLOB.spawnCooldown;
  refreshHUD();
  window.Music?.spawn?.();
}

// =============================================================
//  Input
// =============================================================

document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.key === '1') { e.preventDefault(); trySpawnBlob(); }
  if ((e.key === 'r' || e.key === 'R') && gameOver) initGame();
});

// =============================================================
//  Main loop
// =============================================================

function gameLoop() {
  requestAnimationFrame(gameLoop);

  // ── Draw ──────────────────────────────────────────────────
  drawBackground();
  drawBase(P_BASE_X, P_BASE_MAX, playerHp, true);
  drawBase(E_BASE_X, E_BASE_MAX, enemyHp,  false);

  const all = [...blobs, ...cubes];

  // Shadows first (under everyone)
  for (const u of all) {
    if (u.state === 'DEAD') continue;
    const r = (u instanceof Cube ? u.size : BODY_W) / 2 * 0.82;
    drawShadow(u.cx, r);
  }

  // Units, sorted by x so overlapping reads naturally
  all.sort((a, b) => b.cx - a.cx);
  all.forEach(u => u.draw());

  drawEffects();

  if (gameOver) { drawGameOver(); return; }

  // ── Update ────────────────────────────────────────────────
  frame++;

  // Passive money trickle: +10 every 2.5 s
  moneyTimer++;
  if (moneyTimer >= 150) { moneyTimer = 0; money += 10; refreshHUD(); }

  // Blob spawn cooldown
  if (blobCooldown > 0) { blobCooldown--; updateBlobButton(); }

  // Enemy cube spawning — one cube every ~3 s (180 frames)
  enemySpawnTimer++;
  if (enemySpawnTimer >= 180) { enemySpawnTimer = 0; cubes.push(new Cube()); }

  blobs.forEach(b => b.update());
  cubes.forEach(c => c.update());
  updateEffects();

  // Remove fully faded dead units
  blobs = blobs.filter(b => !(b.state === 'DEAD' && b.opacity <= 0));
  cubes = cubes.filter(c => !(c.state === 'DEAD' && c.opacity <= 0));

  // Win / lose check
  if (enemyHp  <= 0) { gameOver = true; result = 'WIN';  if (window.Music) Music.victory(); }
  if (playerHp <= 0) { gameOver = true; result = 'LOSE'; if (window.Music) Music.defeat();  }
}

// =============================================================
//  Boot
// =============================================================
initGame();
gameLoop();
