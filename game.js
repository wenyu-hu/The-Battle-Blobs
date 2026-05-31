// ==========================================
// 1. ASSET CONFIGURATION
// ==========================================
const blobSprites = {
    idle: new Image(), walk1: new Image(), walk2: new Image(), 
    walk3: new Image(), walk4: new Image(), attack: new Image(), 
    knockback: new Image(), death: new Image()
};

blobSprites.idle.src      = 'img/blob/basic-blob-idle.png';
blobSprites.walk1.src     = 'img/blob/basic-blob-walk1.png';
blobSprites.walk2.src     = 'img/blob/basic-blob-walk2.png';
blobSprites.walk3.src     = 'img/blob/basic-blob-walk3.png';
blobSprites.walk4.src     = 'img/blob/basic-blob-walk4.png';
blobSprites.attack.src    = 'img/blob/basic-bob-attack.png'; 
blobSprites.knockback.src = 'img/blob/basic-blob-knockback.png';
blobSprites.death.src     = 'img/blob/basic-blob-dead.png';

// ==========================================
// 2. REVERTED HERO BLOB CLASS (Top-Left System)
// ==========================================
class BasicBlob {
    constructor(x, y) {
        // Back to classic top-left corner positioning
        this.x = x;
        this.y = y;
        
        // 128 width accounts for the image padding so he stays perfectly round!
        this.width = 128;   
        this.height = 64;   
        
        // Stats
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

    // Updated to accept both your enemy units array and the enemy base object
    update(enemies, enemyBase) {
        this.animationTimer++;

        switch (this.state) {
            case 'WALKING':
                this.x += this.speed;

                // Handle walk cycle animation frames
                if (this.animationTimer >= this.animationSpeed) {
                    this.currentFrameIndex = (this.currentFrameIndex + 1) % this.walkFrames.length;
                    this.animationTimer = 0;
                }

                // 1. Check for nearby enemy units first
                let closestEnemy = this.getClosestEnemy(enemies);
                if (closestEnemy && (closestEnemy.x - (this.x + this.width)) <= this.attackRange) {
                    this.state = 'ATTACKING';
                    this.stateTimer = 30;
                    this.animationTimer = 0;
                } 
                // 2. If no enemy units, check if in range of the Enemy Base
                else if (enemyBase && (enemyBase.x - (this.x + this.width)) <= this.attackRange) {
                    this.state = 'ATTACKING';
                    this.stateTimer = 30;
                    this.animationTimer = 0;
                }
                break;

            case 'ATTACKING':
                this.stateTimer--;
                
                // Classic forward lunging push
                if (this.stateTimer === 15) {
                    this.x += 25; 
                    
                    // Apply attack damage to unit or base
                    let target = this.getClosestEnemy(enemies);
                    if (target) {
                        target.takeDamage(this.damage);
                    } else if (enemyBase && (enemyBase.x - (this.x + this.width)) <= this.attackRange + 40) {
                        enemyBase.takeDamage(this.damage);
                    }
                }

                if (this.stateTimer <= 0) {
                    this.state = 'WALKING';
                }
                break;

            case 'KNOCKBACK':
                this.stateTimer--;
                this.x -= 3; // Flinch backward

                if (this.stateTimer <= 0) {
                    this.state = 'WALKING';
                }
                break;

            case 'DEAD':
                // Smoothly melt away the goo puddle
                if (this.opacity > 0) {
                    this.opacity -= 0.016;
                }
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

        if (sprite && sprite.complete && sprite.naturalWidth !== 0) {
            // Standard top-left rectangle renderer
            ctx.drawImage(sprite, this.x, this.y, this.width, this.height);
        } else {
            // Default square emergency fill
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
        ctx.restore();
    }
}
