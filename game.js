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
const P_BASE_X   = 760;   // player base centre x
const E_BASE_X   = 40;    // enemy  base centre x
const P_BASE_MAX = 5000;
const E_BASE_MAX = 1500;

// ── Blob stats ────────────────────────────────────────────────
const BASIC_BLOB = {
  hp: 250, damage: 20,
  attackRate: 90,   // frames between attacks
  speed: 2,
  range: 72,        // px from front edge to target front edge
  cost: 50,
  spawnCooldown: 60,
  w: 90, h: 90,
};

// ── Cube stats ────────────────────────────────────────────────
const CUBE_DEF = {
  hp: 140, damage: 14,
  attackRate: 100,
  speed: 1.2,
  range: 64,
  reward: 25,
  size: 50,
};

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

// ── Game state ────────────────────────────────────────────────
let money, playerHp, enemyHp;
let blobs, cubes;
let frame, moneyTimer, enemySpawnTimer;
let blobCooldown;
let gameOver, result;   // result: 'WIN' | 'LOSE'

function initGame() {
  money          = 150;
  playerHp       = P_BASE_MAX;
  enemyHp        = E_BASE_MAX;
  blobs          = [];
  cubes          = [];
  frame          = 0;
  moneyTimer     = 0;
  enemySpawnTimer= 0;
  blobCooldown   = 0;
  gameOver       = false;
  result         = null;
  refreshHUD();
}

// =============================================================
//  BasicBlob  (player unit — moves LEFT)
// =============================================================
class BasicBlob {
  constructor() {
    const d = BASIC_BLOB;
    this.x  = P_BASE_X - 28 - d.w;
    this.y  = GROUND_Y - d.h;
    this.w  = d.w;
    this.h  = d.h;
    this.hp = d.hp;
    this.maxHp = d.hp;
    this.state  = 'WALK';  // WALK | ATTACK | KNOCKBACK | DEAD
    this.atkTimer   = 0;
    this.animFrame  = 0;
    this.animTimer  = 0;
    this.knockTimer = 0;
    this.deadTimer  = 0;
    this.opacity    = 1;
  }

  // leftmost edge — the "front" for a left-moving unit
  get front() { return this.x; }

  takeDamage(dmg) {
    if (this.state === 'DEAD') return;
    this.hp -= dmg;
    if (this.hp <= 0) { this.hp = 0; this.state = 'DEAD'; return; }
    if (dmg >= this.maxHp * 0.25) {
      this.state      = 'KNOCKBACK';
      this.knockTimer = 18;
    }
  }

  // Returns the nearest cube (or the string 'base') within attack range, else null.
  findTarget() {
    let best = null, bestGap = Infinity;
    for (const c of cubes) {
      if (c.state === 'DEAD') continue;
      const gap = this.front - (c.x + c.w);  // gap between my left and cube's right
      if (gap <= BASIC_BLOB.range && gap > -c.w) {
        if (gap < bestGap) { best = c; bestGap = gap; }
      }
    }
    if (!best && this.front - (E_BASE_X + 22) <= BASIC_BLOB.range) best = 'base';
    return best;
  }


  update() {
    if (this.state === 'DEAD') {
      this.deadTimer++;
      this.opacity = Math.max(0, 1 - this.deadTimer / 40);
      return;
    }

    if (this.state === 'KNOCKBACK') {
      this.knockTimer--;
      this.x += 2;
      if (this.knockTimer <= 0) this.state = 'WALK';
      return;
    }

    const target = this.findTarget();

    if (target) {
      this.state = 'ATTACK';
      this.atkTimer++;
      if (this.atkTimer >= BASIC_BLOB.attackRate) {
        this.atkTimer = 0;
        if (target === 'base') {
          enemyHp = Math.max(0, enemyHp - BASIC_BLOB.damage);
          refreshHUD();
        } else {
          target.takeDamage(BASIC_BLOB.damage);
        }
      }
    } else {
      this.state = 'WALK';
      this.x -= BASIC_BLOB.speed;
      this.animTimer++;
      if (this.animTimer >= 8) {
        this.animTimer = 0;
        this.animFrame = (this.animFrame + 1) % 4;
      }
    }
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.opacity;
    // Flip sprite horizontally so blob faces left
    ctx.translate(this.x + this.w, 0);
    ctx.scale(-1, 1);

    const WALK = [spr.walk1, spr.walk2, spr.walk3, spr.walk4];
    let img;
    if      (this.state === 'DEAD')      img = spr.dead;
    else if (this.state === 'KNOCKBACK') img = spr.knockback;
    else if (this.state === 'ATTACK')    img = spr.attack;
    else                                 img = WALK[this.animFrame];

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, 0, this.y, this.w, this.h);
    } else {
      ctx.fillStyle = '#6af';
      ctx.beginPath();
      ctx.ellipse(this.w / 2, this.y + this.h / 2,
                  this.w / 2, this.h / 2, 0, 0, Math.PI * 2);
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
    this.x      = E_BASE_X + 28;  // spawn just right of enemy base
    this.y      = GROUND_Y - s;
    this.hp     = CUBE_DEF.hp;
    this.maxHp  = CUBE_DEF.hp;
    this.state  = 'WALK';
    this.atkTimer = 0;
    this.deadTimer = 0;
    this.opacity   = 1;
  }

  // rightmost edge — the "front" for a right-moving unit
  get front() { return this.x + this.w; }

  takeDamage(dmg) {
    if (this.state === 'DEAD') return;
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = 'DEAD';
      money += CUBE_DEF.reward;
      refreshHUD();
    }
  }

  findTarget() {
    let best = null, bestGap = Infinity;
    for (const b of blobs) {
      if (b.state === 'DEAD') continue;
      const gap = b.front - this.front;    // gap between my right and blob's left
      if (gap <= CUBE_DEF.range && gap > -b.w) {
        if (gap < bestGap) { best = b; bestGap = gap; }
      }
    }
    if (!best && (P_BASE_X - 22) - this.front <= CUBE_DEF.range) best = 'base';
    return best;
  }


  update() {
    if (this.state === 'DEAD') {
      this.deadTimer++;
      this.opacity = Math.max(0, 1 - this.deadTimer / 30);
      return;
    }

    const target = this.findTarget();

    if (target) {
      this.state = 'ATTACK';
      this.atkTimer++;
      if (this.atkTimer >= CUBE_DEF.attackRate) {
        this.atkTimer = 0;
        if (target === 'base') {
          playerHp = Math.max(0, playerHp - CUBE_DEF.damage);
          refreshHUD();
        } else {
          target.takeDamage(CUBE_DEF.damage);
        }
      }
    } else {
      this.state = 'WALK';
      this.x += CUBE_DEF.speed;
    }
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.opacity;

    const { x, y, size: s, hp, maxHp, state } = this;

    if (state === 'DEAD') {
      // Shattered into four chunks
      ctx.fillStyle = '#b33';
      const half = s / 2 - 2;
      ctx.fillRect(x,          y,          half, half);
      ctx.fillRect(x + half + 4, y,          half, half);
      ctx.fillRect(x,          y + half + 4, half, half);
      ctx.fillRect(x + half + 4, y + half + 4, half, half);
    } else {
      const attacking = state === 'ATTACK';

      // Right face (darker)
      ctx.fillStyle = attacking ? '#922' : '#8a2222';
      ctx.beginPath();
      ctx.moveTo(x + s,      y);
      ctx.lineTo(x + s + 10, y - 10);
      ctx.lineTo(x + s + 10, y + s - 10);
      ctx.lineTo(x + s,      y + s);
      ctx.closePath();
      ctx.fill();

      // Top face (lighter)
      ctx.fillStyle = attacking ? '#e77' : '#d05050';
      ctx.beginPath();
      ctx.moveTo(x,      y);
      ctx.lineTo(x + 10, y - 10);
      ctx.lineTo(x + s + 10, y - 10);
      ctx.lineTo(x + s, y);
      ctx.closePath();
      ctx.fill();

      // Front face
      ctx.fillStyle = attacking ? '#d44' : '#b33';
      ctx.fillRect(x, y, s, s);

      // Angry eyes
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

      // Mouth (grimace when attacking)
      if (attacking) {
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 10, y + s - 14);
        ctx.lineTo(x + 18, y + s - 18);
        ctx.lineTo(x + 26, y + s - 14);
        ctx.lineTo(x + 34, y + s - 18);
        ctx.lineTo(x + s - 10, y + s - 14);
        ctx.stroke();
      }

    }

    ctx.restore();
  }
}

// =============================================================
//  Drawing helpers
// =============================================================

function drawBackground() {
  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, '#080818');
  sky.addColorStop(1, '#12294a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND_Y);

  // Ground
  ctx.fillStyle = '#162a16';
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

  // Ground highlight stripe
  ctx.fillStyle = '#1e3a1e';
  ctx.fillRect(0, GROUND_Y, W, 5);
}

function drawBase(cx, maxHp, currentHp, isPlayer) {
  const baseW = 44, baseH = 96;
  const bx = cx - baseW / 2;
  const by = GROUND_Y - baseH;

  // Tower body
  ctx.fillStyle = isPlayer ? '#2a2a55' : '#55202a';
  ctx.fillRect(bx, by, baseW, baseH);

  // Battlements (3 merlons)
  ctx.fillStyle = isPlayer ? '#3838 70' : '#6a2a38';
  // just use the tower colour + a shade
  ctx.fillStyle = isPlayer ? '#333366' : '#662233';
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(bx + i * 15, by - 14, 10, 14);
  }

  // Door arch
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(cx - 7, GROUND_Y - 28, 14, 28);
  ctx.beginPath();
  ctx.arc(cx, GROUND_Y - 28, 7, Math.PI, 0);
  ctx.fill();

  // HP text above tower
  ctx.fillStyle = isPlayer ? '#5af' : '#f55';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${currentHp}/${maxHp}`, cx, by - 6);
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
  if (blobCooldown > 0) {
    btn.classList.add('on-cooldown');
  } else if (money >= BASIC_BLOB.cost) {
    btn.classList.add('can-afford');
  } else {
    btn.classList.add('cant-afford');
  }
  // Cooldown overlay height
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

  // Sort all units by x so overlapping looks natural
  const all = [...blobs, ...cubes];
  all.sort((a, b) => (b.x + b.w / 2) - (a.x + a.w / 2));
  all.forEach(u => u.draw());

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

  // Update units
  blobs.forEach(b => b.update());
  cubes.forEach(c => c.update());

  // Remove fully faded dead units
  blobs = blobs.filter(b => !(b.state === 'DEAD' && b.opacity <= 0));
  cubes = cubes.filter(c => !(c.state === 'DEAD' && c.opacity <= 0));

  // Win / lose check
  if (enemyHp <= 0) { gameOver = true; result = 'WIN';  }
  if (playerHp <= 0) { gameOver = true; result = 'LOSE'; }
}

// =============================================================
//  Boot
// =============================================================
initGame();
gameLoop();
