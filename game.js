// ==========================================
// 1. ASSET CONFIGURATION
// ==========================================
const blobSprites = {
    idle: new Image(), walk1: new Image(), walk2: new Image(), 
    walk3: new Image(), walk4: new Image(), attack: new Image(), 
    knockback: new Image(), death: new Image()
};

// If your images are in the exact same folder as game.js, change 'img/blob/' to ''
blobSprites.idle.src      = 'img/blob/basic-blob-idle.png';
blobSprites.walk1.src     = 'img/blob/basic-blob-walk1.png';
blobSprites.walk2.src     = 'img/blob/basic-blob-walk2.png';
blobSprites.walk3.src     = 'img/blob/basic-blob-walk3.png';
blobSprites.walk4.src     = 'img/blob/basic-blob-walk4.png';
blobSprites.attack.src    = 'img/blob/basic-bob-attack.png'; 
blobSprites.knockback.src = 'img/blob/basic-blob-knockback.png';
blobSprites.death.src     = 'img/blob/basic-blob-dead.png';

// ==========================================
// 2. HERO BLOB CLASS
// ==========================================
class BasicBlob {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 128; // Prevents the thin/squished look   
        this.height = 64;   
        
        this.hp = 100;
        this.maxHp = 100;
        this.damage = 25;
        this.speed = 2;
        this.attackRange = 30; 
        
        this.state = 'WALKING'; 
        this.stateTimer = 0;
        
        this.walkFrames = [blobSprites.walk1, blobSprites.walk2, blobSprites.walk3, blobSprites.walk4];
        this.currentFrameIndex = 0;
        this.animationTimer = 0;
        this.animationSpeed = 8; 
        this.opacity = 1.0;
    }

    runLogic(enemies, enemyBase) {
        this.animationTimer++;

        switch (this.state) {
            case 'WALKING':
                this.x += this.speed;

                if (this.animationTimer >= this.animationSpeed) {
                    this.currentFrameIndex = (this.currentFrameIndex + 1) % this.walkFrames.length;
                    this.animationTimer = 0;
                }

                // Check for enemies first
                let closestEnemy = enemies.filter(e => e.x > this.x && e.state !== 'DEAD')[0] || null;
                if (closestEnemy && (closestEnemy.x - (this.x + this.width)) <= this.attackRange) {
                    this.state = 'ATTACKING';
                    this.stateTimer = 30;
                } 
                // Check for enemy base second
                else if (enemyBase && (enemyBase.x - (this.x + this.width)) <= this.attackRange) {
                    this.state = 'ATTACKING';
                    this.stateTimer = 30;
                }
                break;

            case 'ATTACKING':
                this.stateTimer--;
                
                if (this.stateTimer === 15) {
                    this.x += 25; // Lunge forward
                    
                    let target = enemies.filter(e => e.x > this.x && e.state !== 'DEAD')[0] || null;
                    if (target) {
                        target.takeDamage(this.damage);
                    } else if (enemyBase && (enemyBase.x - (this.x + this.width)) <= this.attackRange + 40) {
                        enemyBase.takeDamage(this.damage);
                    }
                }

                if (this.stateTimer <= 0) this.state = 'WALKING';
                break;

            case 'KNOCKBACK':
                this.stateTimer--;
                this.x -= 3;
                if (this.stateTimer <= 0) this.state = 'WALKING';
                break;

            case 'DEAD':
                if (this.opacity > 0) this.opacity -= 0.016;
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
        if (amount >= this.maxHp * 0.3) { 
            this.state = 'KNOCKBACK';
            this.stateTimer = 20; 
        }
    }

    draw(ctx) {
        let sprite;
        if (this.state === 'WALKING') sprite = this.walkFrames[this.currentFrameIndex];
        else if (this.state === 'ATTACKING') sprite = blobSprites.attack;
        else if (this.state === 'KNOCKBACK') sprite = blobSprites.knockback;
        else if (this.state === 'DEAD') sprite = blobSprites.death;

        ctx.save();
        ctx.globalAlpha = Math.max(0, this.opacity);
        if (sprite && sprite.complete && sprite.naturalWidth !== 0) {
            ctx.drawImage(sprite, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(this.x, this.y, 64, 64);
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
    }
    runLogic() {
        if (this.state !== 'DEAD') this.x -= 0.5; 
    }
    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) this.state = 'DEAD';
    }
    draw(ctx) {
        if (this.state === 'DEAD') return;
        ctx.fillStyle = '#ffb6c1';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

// ==========================================
// 4. BASE CLASSES
// ==========================================
class Base {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.width = 80;
        this.height = 120;
        this.hp = 500;
        this.color = color;
    }
    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) this.hp = 0;
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Health bar display
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.fillText(`HP: ${this.hp}`, this.x + 10, this.y - 10);
    }
}

// ==========================================
// 5. THE MAIN GAME SYSTEM LOOP
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let playerBlobs = [new BasicBlob(100, 236)];
let enemyCubes = [new PinkCubeEnemy(600, 236)];
let playerBase = new Base(20, 180, '#34495e'); // Blue-grey home base
let enemyBase  = new Base(700, 180, '#c0392b'); // Red enemy base

function mainGameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Ground Line
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(canvas.width, 300); ctx.stroke();

    // Draw Bases
    playerBase.draw(ctx);
    enemyBase.draw(ctx);

    // Run Enemy Logic
    for (let i = enemyCubes.length - 1; i >= 0; i--) {
        enemyCubes[i].runLogic();
        enemyCubes[i].draw(ctx);
        if (enemyCubes[i].state === 'DEAD') enemyCubes.splice(i, 1);
    }

    // Run Player Blob Logic (Wired perfectly to enemies and bases)
    for (let i = playerBlobs.length - 1; i >= 0; i--) {
        let blob = playerBlobs[i];
        blob.runLogic(enemyCubes, enemyBase); 
        blob.draw(ctx);

        if (blob.state === 'DEAD' && blob.opacity <= 0) {
            playerBlobs.splice(i, 1);
        }
    }

    requestAnimationFrame(mainGameLoop);
}

// Start everything up automatically
mainGameLoop();
