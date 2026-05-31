// ==========================================
// 1. ASSET CONFIGURATION
// ==========================================
const blobSprites = {
    idle: new Image(),
    walk1: new Image(),
    walk2: new Image(),
    walk3: new Image(),
    walk4: new Image(),
    attack: new Image(),
    knockback: new Image(),
    death: new Image()
};

// Maps exactly to the filenames in your folder
blobSprites.idle.src      = 'img/blob/basic-blob-idle.png';
blobSprites.walk1.src     = 'img/blob/basic-blob-walk1.png';
blobSprites.walk2.src     = 'img/blob/basic-blob-walk2.png';
blobSprites.walk3.src     = 'img/blob/basic-blob-walk3.png';
blobSprites.walk4.src     = 'img/blob/basic-blob-walk4.png';
blobSprites.attack.src    = 'img/blob/basic-bob-attack.png'; // Matched your typo "bob" here!
blobSprites.knockback.src = 'img/blob/basic-blob-knockback.png';
blobSprites.death.src     = 'img/blob/basic-blob-dead.png';

// Placeholder for your Pink Cube Enemy
const enemySprites = { idle: new Image() }; 
enemySprites.idle.src = 'img/enemy/pink_cube.png';

// ==========================================
// 2. HERO BLOB CLASS
// ==========================================
class BasicBlob {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 64;   
        this.height = 64;
        
        // Stats
        this.hp = 100;
        this.maxHp = 100;
        this.damage = 25;
        this.speed = 2;
        this.attackRange = 40; 
        
        // State Machine
        this.state = 'WALKING'; // 'IDLE', 'WALKING', 'ATTACKING', 'KNOCKBACK', 'DEAD'
        this.stateTimer = 0;
        
        // Animation
        this.walkFrames = [blobSprites.walk1, blobSprites.walk2, blobSprites.walk3, blobSprites.walk4];
        this.currentFrameIndex = 0;
        this.animationTimer = 0;
        this.animationSpeed = 8; 
        
        // Death Fade Effect
        this.opacity = 1.0;
    }

    update(enemies) {
        this.animationTimer++;

        switch (this.state) {
            case 'IDLE':
                // Stand still, wait for instructions or enemies
                break;

            case 'WALKING':
                this.x += this.speed;

                // Animate legs
                if (this.animationTimer >= this.animationSpeed) {
                    this.currentFrameIndex = (this.currentFrameIndex + 1) % this.walkFrames.length;
                    this.animationTimer = 0;
                }

                // SCAN FOR ENEMIES
                let closestEnemy = this.getClosestEnemy(enemies);
                if (closestEnemy && (closestEnemy.x - (this.x + this.width)) <= this.attackRange) {
                    this.state = 'ATTACKING';
                    this.stateTimer = 30; 
                    this.animationTimer = 0;
                }
                break;

            case 'ATTACKING':
                this.stateTimer--;
                
                // Lunge violently forward halfway through the attack animation
                if (this.stateTimer === 15) {
                    this.x += 25; 
                    let target = this.getClosestEnemy(enemies);
                    if (target) {
                        target.takeDamage(this.damage);
                    }
                }

                if (this.stateTimer <= 0) {
                    this.state = 'WALKING';
                }
                break;

            case 'KNOCKBACK':
                this.stateTimer--;
                this.x -= 3; 

                if (this.stateTimer <= 0) {
                    this.state = 'WALKING';
                }
                break;

            case 'DEAD':
                // Fade the puddle out
                if (this.opacity > 0) {
                    this.opacity -= 0.016; 
                }
                break;
        }
    }

    takeDamage(amount) {
        if (this.state === 'DEAD') return;

        this.hp -= amount;

        // Check for Death -> Goo Puddle
        if (this.hp <= 0) {
            this.hp = 0;
            this.state = 'DEAD';
            return;
        }

        // Knockback triggers at health milestones
        if (amount >= this.maxHp * 0.3) { 
            this.state = 'KNOCKBACK';
            this.stateTimer = 20; 
        }
    }

    getClosestEnemy(enemies) {
        return enemies.filter(e => e.x > this.x && e.state !== 'DEAD')[0] || null;
    }

    draw(ctx) {
        let sprite;

        // Pick frame based on exact state
        if (this.state === 'IDLE') sprite = blobSprites.idle;
        else if (this.state === 'WALKING') sprite = this.walkFrames[this.currentFrameIndex];
        else if (this.state === 'ATTACKING') sprite = blobSprites.attack;
        else if (this.state === 'KNOCKBACK') sprite = blobSprites.knockback;
        else if (this.state === 'DEAD') sprite = blobSprites.death;

        // Apply global alpha for death fading
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.opacity);
        // Fallback in case image hasn't loaded yet
        if (sprite.complete && sprite.naturalWidth !== 0) {
            ctx.drawImage(sprite, this.x, this.y, this.width, this.height);
        }
        ctx.restore();
    }
}

// ==========================================
// 3. ENEMY CUBE CLASS (Target Dummy)
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
    update() {
        if (this.state !== 'DEAD') this.x -= 0.5; 
    }
    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) this.state = 'DEAD';
    }
    draw(ctx) {
        if (this.state === 'DEAD') return;
        // Fallback rectangle if enemy sprite is missing
        if (enemySprites.idle.complete && enemySprites.idle.naturalWidth !== 0) {
             ctx.drawImage(enemySprites.idle, this.x, this.y, this.width, this.height);
        } else {
             ctx.fillStyle = 'pink';
             ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }
}

// ==========================================
// 4. MAIN GAME LOOP
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let playerBlobs = [new BasicBlob(50, 200)];
let enemyCubes = [new PinkCubeEnemy(500, 200)];

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = enemyCubes.length - 1; i >= 0; i--) {
        enemyCubes[i].update();
        enemyCubes[i].draw(ctx);
        if (enemyCubes[i].state === 'DEAD') enemyCubes.splice(i, 1);
    }

    for (let i = playerBlobs.length - 1; i >= 0; i--) {
        let blob = playerBlobs[i];
        blob.update(enemyCubes);
        blob.draw(ctx);

        if (blob.state === 'DEAD' && blob.opacity <= 0) {
            playerBlobs.splice(i, 1);
        }
    }

    requestAnimationFrame(gameLoop);
}

// Ensure you have an HTML canvas element with id="gameCanvas" before calling gameLoop()
gameLoop();
