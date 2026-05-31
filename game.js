// ==========================================
// 1. ASSET CONFIGURATION
// ==========================================
const blobSprites = {
    idle: new Image(), walk1: new Image(), walk2: new Image(), 
    walk3: new Image(), walk4: new Image(), attack: new Image(), 
    knockback: new Image(), death: new Image()
};

// Image Paths
blobSprites.idle.src      = 'img/blob/basic-blob-idle.png';
blobSprites.walk1.src     = 'img/blob/basic-blob-walk1.png';
blobSprites.walk2.src     = 'img/blob/basic-blob-walk2.png';
blobSprites.walk3.src     = 'img/blob/basic-blob-walk3.png';
blobSprites.walk4.src     = 'img/blob/basic-blob-walk4.png';
blobSprites.attack.src    = 'img/blob/basic-bob-attack.png'; 
blobSprites.knockback.src = 'img/blob/basic-blob-knockback.png';
blobSprites.death.src     = 'img/blob/basic-blob-dead.png';

// ==========================================
// 2. HERO BLOB CLASS (Perfect Scale)
// ==========================================
class BasicBlob {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        
        // BIGGER SIZE: Fits the actual scale of your canvas and enemies perfectly
        this.width = 160;   
        this.height = 90;   
        
        this.hp = 100;
        this.maxHp = 100;
        this.damage = 25;
        this.speed = 1.5;
        this.attackRange = 15; // Requires him to stand directly in front of the target
        
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

        // Calculate the front visual edge of our blob (ignoring the invisible image padding)
        let visualFrontEdge = this.x + (this.width * 0.65);

        switch (this.state) {
            case 'WALKING':
                this.x += this.speed;

                if (this.animationTimer >= this.animationSpeed) {
                    this.currentFrameIndex = (this.currentFrameIndex + 1) % this.walkFrames.length;
                    this.animationTimer = 0;
                }

                // 1. Check for nearby enemy units
                let closestEnemy = enemies.filter(e => e.x > this.x && e.state !== 'DEAD')[0] || null;
                if (closestEnemy && (closestEnemy.x - visualFrontEdge) <= this.attackRange) {
                    this.state = 'ATTACKING';
                    this.stateTimer = 30;
                } 
                // 2. Check for enemy base
                else if (enemyBase && (enemyBase.x - visualFrontEdge) <= this.attackRange) {
                    this.state = 'ATTACKING';
                    this.stateTimer = 30;
                }
                break;

            case 'ATTACKING':
                this.stateTimer--;
                
                // Attack lunging momentum
                if (this.stateTimer > 15) {
                    this.x += 1.5;
                } else if (this.stateTimer <= 15 && this.stateTimer > 0) {
                    this.x -= 1.5;
                }

                // Hit frame right at the middle of the lunge animation
                if (this.stateTimer === 15) {
                    let target = enemies.filter(e => e.x > this.x && e.state !== 'DEAD')[0] || null;
                    if (target) {
                        target.takeDamage(this.damage);
                    } else if (enemyBase && (enemyBase.x - visualFrontEdge) <= this.attackRange + 40) {
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
        this.width = 80;  // Scaled up slightly to fit the world
        this.height = 80;
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
        this.width = 100;
        this.height = 150;
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
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px Arial';
        ctx.fillText(`HP: ${this.hp}`, this.x + 15, this.y - 15);
    }
}

// ==========================================
// 5. THE MAIN GAME SYSTEM LOOP
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Perfectly levels the feet of all assets onto the ground line
let playerBlobs = [new BasicBlob(120, 210)];
let enemyCubes = [new PinkCubeEnemy(550, 220)];
let playerBase = new Base(0, 150, '#34495e'); 
let enemyBase  = new Base(700, 150, '#c0392b'); 

function mainGameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Ground Line
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(canvas.width, 300); ctx.stroke();

    // Draw Bases
    playerBase.draw(ctx);
    enemyBase.draw(ctx);

    // Run Enemy Units
    for (let i = enemyCubes.length - 1; i >= 0; i--) {
        enemyCubes[i].runLogic();
        enemyCubes[i].draw(ctx);
        if (enemyCubes[i].state === 'DEAD') enemyCubes.splice(i, 1);
    }

    // Run Player Blobs
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

mainGameLoop();
