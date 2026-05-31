// ==========================================
// 1. ASSET CONFIGURATION & DEBUGGING LOGS
// ==========================================
const blobSprites = {
    idle: new Image(), walk1: new Image(), walk2: new Image(), 
    walk3: new Image(), walk4: new Image(), attack: new Image(), 
    knockback: new Image(), death: new Image()
};

// !!! EDIT THESE PATHS TO MATCH YOUR EXACT FINDER FOLDER !!!
// If your images are in the exact same folder as game.js, remove 'img/blob/'
blobSprites.idle.src      = 'img/blob/basic-blob-idle.png';
blobSprites.walk1.src     = 'img/blob/basic-blob-walk1.png';
blobSprites.walk2.src     = 'img/blob/basic-blob-walk2.png';
blobSprites.walk3.src     = 'img/blob/basic-blob-walk3.png';
blobSprites.walk4.src     = 'img/blob/basic-blob-walk4.png';
blobSprites.attack.src    = 'img/blob/basic-bob-attack.png'; 
blobSprites.knockback.src = 'img/blob/basic-blob-knockback.png';
blobSprites.death.src     = 'img/blob/basic-blob-dead.png';

// Console tracker to alert you if the path is wrong
Object.keys(blobSprites).forEach(key => {
    blobSprites[key].onerror = function() {
        console.error(`❌ ERROR: Could not find image at path: ${this.src}. Check your folder structure!`);
    };
});

const enemySprites = { idle: new Image() }; 
enemySprites.idle.src = 'img/enemy/pink_cube.png';

// ==========================================
// 2. HERO BLOB CLASS (With Visual Fallbacks)
// ==========================================
class BasicBlob {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 64;   
        this.height = 64;
        
        this.hp = 100;
        this.maxHp = 100;
        this.damage = 25;
        this.speed = 1.5;
        this.attackRange = 40; 
        
        this.state = 'WALKING'; 
        this.stateTimer = 0;
        
        this.walkFrames = [blobSprites.walk1, blobSprites.walk2, blobSprites.walk3, blobSprites.walk4];
        this.currentFrameIndex = 0;
        this.animationTimer = 0;
        this.animationSpeed = 8; 
        this.opacity = 1.0;
    }

    update(enemies) {
        this.animationTimer++;

        switch (this.state) {
            case 'WALKING':
                this.x += this.speed;

                if (this.animationTimer >= this.animationSpeed) {
                    this.currentFrameIndex = (this.currentFrameIndex + 1) % this.walkFrames.length;
                    this.animationTimer = 0;
                }

                let closestEnemy = this.getClosestEnemy(enemies);
                if (closestEnemy && (closestEnemy.x - (this.x + this.width)) <= this.attackRange) {
                    this.state = 'ATTACKING';
                    this.stateTimer = 30; 
                    this.animationTimer = 0;
                }
                break;

            case 'ATTACKING':
                this.stateTimer--;
                
                // Lunge forward dynamically
                if (this.stateTimer === 15) {
                    this.x += 20; 
                    let target = this.getClosestEnemy(enemies);
                    if (target) target.takeDamage(this.damage);
                }

                if (this.stateTimer <= 0) this.state = 'WALKING';
                break;

            case 'KNOCKBACK':
                this.stateTimer--;
                this.x -= 4; 

                if (this.stateTimer <= 0) this.state = 'WALKING';
                break;

            case 'DEAD':
                if (this.opacity > 0) this.opacity -= 0.02; 
                break;
        }
    }

    takeDamage(amount) {
        if (this.state === 'DEAD') return;
        this.hp -= amount;

        if (this.hp <= 0) {
            this.hp = 0;
            this.state = 'DEAD';
            return;
        }

        if (amount >= this.maxHp * 0.2) { 
            this.state = 'KNOCKBACK';
            this.stateTimer = 15; 
        }
    }

    getClosestEnemy(enemies) {
        return enemies.filter(e => e.x > this.x && e.state !== 'DEAD')[0] || null;
    }

    draw(ctx) {
        let sprite;
        if (this.state === 'WALKING') sprite = this.walkFrames[this.currentFrameIndex];
        else if (this.state === 'ATTACKING') sprite = blobSprites.attack;
        else if (this.state === 'KNOCKBACK') sprite = blobSprites.knockback;
        else if (this.state === 'DEAD') sprite = blobSprites.death;

        ctx.save();
        ctx.globalAlpha = Math.max(0, this.opacity);

        // Check if the sprite image successfully loaded
        if (sprite && sprite.complete && sprite.naturalWidth !== 0) {
            ctx.drawImage(sprite, this.x, this.y, this.width, this.height);
        } else {
            // IF IMAGES FAILS, DRAW THIS TEMPORARY EMERGENCY BLOB
            ctx.fillStyle = this.state === 'DEAD' ? '#27ae60' : '#2ecc71'; 
            if (this.state === 'DEAD') {
                // Melted puddle shape fallback
                ctx.fillRect(this.x, this.y + this.height/2, this.width, this.height/2);
            } else {
                // Normal round blob shape fallback
                ctx.beginPath();
                ctx.arc(this.x + this.width/2, this.y + this.height/2, this.width/2, 0, Math.PI * 2);
                ctx.fill();
                
                // Attack indicator lines overlay
                if (this.state === 'ATTACKING') {
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 4;
                    ctx.stroke();
                }
            }
        }
        ctx.restore();
    }
}

// ==========================================
// 3. ENEMY CUBE CLASS
// ==========================================
class PinkCubeEnemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 64;
        this.height = 64;
        this.hp = 100;
        this.state = 'ALIVE';
        this.attackTimer = 0;
    }
    update(blobs) {
        if (this.state === 'DEAD') return;
        
        this.x -= 0.5; // Constant slow march left

        // Simple counter-attack logic so the blob takes damage too
        this.attackTimer++;
        if (this.attackTimer % 90 === 0) { 
            let target = blobs.filter(b => b.x < this.x && b.state !== 'DEAD').pop();
            if (target && (this.x - target.x) < 80) {
                target.takeDamage(35); // Triggers blob knockback
            }
        }
    }
    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) this.state = 'DEAD';
    }
    draw(ctx) {
        if (this.state === 'DEAD') return;
        if (enemySprites.idle.complete && enemySprites.idle.naturalWidth !== 0) {
             ctx.drawImage(enemySprites.idle, this.x, this.y, this.width, this.height);
        } else {
             ctx.fillStyle = '#ffb6c1';
             ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }
}

// ==========================================
// 4. MAIN RUNNER LOOP
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let playerBlobs = [new BasicBlob(50, 180)];
let enemyCubes = [new PinkCubeEnemy(600, 180)];

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Floor line backdrop
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 244); ctx.lineTo(canvas.width, 244); ctx.stroke();

    for (let i = enemyCubes.length - 1; i >= 0; i--) {
        enemyCubes[i].update(playerBlobs);
        enemyCubes[i].draw(ctx);
        if (enemyCubes[i].state === 'DEAD') enemyCubes.splice(i, 1);
    }

    for (let i = playerBlobs.length - 1; i >= 0; i--) {
        let blob = playerBlobs[i];
        blob.update(enemyCubes);
        blob.draw(ctx);
        if (blob.state === 'DEAD' && blob.opacity <= 0) playerBlobs.splice(i, 1);
    }

    requestAnimationFrame(gameLoop);
}

// Fire up engine automatically
gameLoop();
