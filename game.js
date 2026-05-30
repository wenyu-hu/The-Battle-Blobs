const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Game State
let money = 0;
const moneyRate = 15; 
let lastMoneyTick = 0;
let lastEnemySpawn = 0;

// Entities arrays
let friendlyBlobs = [];
let enemyCubes = [];

// Base stats
const enemyBase  = { x: 50, y: 410, width: 70, height: 120, hp: 500 };
const playerBase = { x: 680, y: 410, width: 70, height: 120, hp: 500 };

// Handle Spawning Friendly Blobs
function spawnBlob() {
    const cost = 50;
    if (money >= cost) {
        money -= cost;
        friendlyBlobs.push({
            x: playerBase.x,
            y: 505,
            radius: 18,
            speed: 1.5,
            hp: 100,
            damage: 25,
            color: "#00FF66", // Vibrant Neon Green
            state: "walking" 
        });
    }
}

// Handle Spawning Enemy Cubes
function spawnEnemy() {
    enemyCubes.push({
        x: enemyBase.x + enemyBase.width,
        y: 490,
        size: 35,
        speed: 1.0,
        hp: 120,
        damage: 20,
        color: "#FF0066", // Hot Magenta Pink
        state: "walking"
    });
}

// Create the Spawn Button
const spawnBtn = document.createElement("button");
spawnBtn.innerText = "Spawn Basic Blob ($50)";
spawnBtn.style.position = "absolute";
spawnBtn.style.top = "20px";
spawnBtn.style.left = "20px";
spawnBtn.style.padding = "10px";
spawnBtn.onclick = spawnBlob;
document.body.appendChild(spawnBtn);

// Main Game Loop
function gameLoop(timestamp) {
    if (timestamp - lastMoneyTick >= 1000) {
        money += moneyRate;
        lastMoneyTick = timestamp;
    }

    if (timestamp - lastEnemySpawn >= 4000) {
        spawnEnemy();
        lastEnemySpawn = timestamp;
    }

    // COMBAT LOGIC
    friendlyBlobs.forEach(b => b.state = "walking");
    enemyCubes.forEach(c => c.state = "walking");

    for (let blob of friendlyBlobs) {
        for (let cube of enemyCubes) {
            if (blob.x - blob.radius <= cube.x + cube.size && blob.x + blob.radius >= cube.x) {
                blob.state = "fighting";
                cube.state = "fighting";
                cube.hp -= blob.damage * 0.02;
                blob.hp -= cube.damage * 0.02;
            }
        }
        if (blob.x - blob.radius <= enemyBase.x + enemyBase.width) {
            blob.state = "fighting";
            enemyBase.hp -= blob.damage * 0.02;
        }
    }

    for (let cube of enemyCubes) {
        if (cube.x + cube.size >= playerBase.x) {
            cube.state = "fighting";
            playerBase.hp -= cube.damage * 0.02;
        }
    }

    friendlyBlobs = friendlyBlobs.filter(blob => blob.hp > 0);
    enemyCubes = enemyCubes.filter(cube => cube.hp > 0);

    // ----------------------------------------------------------------
    // RENDER / DRAWING SECTION (Where the art happens!)
    // ----------------------------------------------------------------
    
    // 1. BACKGROUND (A nice retro dark purple sky instead of plain black)
    ctx.fillStyle = "#1a102f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. GROUND (Pastel Yellow/Green road with a thick cartoon border)
    ctx.fillStyle = "#3cd070"; // Vibrant pastel green
    ctx.fillRect(0, 530, canvas.width, 70);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 530);
    ctx.lineTo(canvas.width, 530);
    ctx.stroke();

    // 3. DRAW BASES (With thick cartoon outlines)
    ctx.lineWidth = 5;
    
    // Enemy Base (Left - Cyberpunk Orange)
    ctx.fillStyle = "#FF6600";
    ctx.fillRect(enemyBase.x, enemyBase.y, enemyBase.width, enemyBase.height);
    ctx.strokeRect(enemyBase.x, enemyBase.y, enemyBase.width, enemyBase.height);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText(`HP: ${Math.max(0, Math.floor(enemyBase.hp))}`, enemyBase.x, enemyBase.y - 15);

    // Player Base (Right - Neon Cyan Blue)
    ctx.fillStyle = "#00FFFF";
    ctx.fillRect(playerBase.x, playerBase.y, playerBase.width, playerBase.height);
    ctx.strokeRect(playerBase.x, playerBase.y, playerBase.width, playerBase.height);
    ctx.fillStyle = "#fff";
    ctx.fillText(`HP: ${Math.max(0, Math.floor(playerBase.hp))}`, playerBase.x, playerBase.y - 15);

    // 4. DRAW CARTOON FRIENDLY BLOBS
    friendlyBlobs.forEach((blob) => {
        if (blob.state === "walking") {
            blob.x -= blob.speed; 
        }
        
        ctx.lineWidth = 4;
        
        // Body
        ctx.beginPath();
        ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
        ctx.fillStyle = blob.color;
        ctx.fill();
        ctx.strokeStyle = "#000";
        ctx.stroke();
        ctx.closePath();

        // Goofy Cartoon Eyes (Left Eye, Right Eye)
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(blob.x - 5, blob.y - 2, 3, 0, Math.PI * 2); // Left eye
        ctx.arc(blob.x + 3, blob.y - 2, 3, 0, Math.PI * 2); // Right eye
        ctx.fill();
        ctx.closePath();
    });

    // 5. DRAW CARTOON ENEMY CUBES
    enemyCubes.forEach((cube) => {
        if (cube.state === "walking") {
            cube.x += cube.speed; 
        }
        
        ctx.lineWidth = 4;
        
        // Body
        ctx.fillStyle = cube.color;
        ctx.fillRect(cube.x, cube.y, cube.size, cube.size);
        ctx.strokeRect(cube.x, cube.y, cube.size, cube.size);

        // Angry Cartoon Eyes (\ / style lines)
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3;
        
        // Left angry eyebrow/eye
        ctx.beginPath();
        ctx.moveTo(cube.x + 6, cube.y + 8);
        ctx.lineTo(cube.x + 14, cube.y + 14);
        ctx.stroke();

        // Right angry eyebrow/eye
        ctx.beginPath();
        ctx.moveTo(cube.x + 28, cube.y + 8);
        ctx.lineTo(cube.x + 20, cube.y + 14);
        ctx.stroke();
    });

    // 6. DRAW UI
    ctx.fillStyle = "#fff";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(`Wallet: $${money}`, 20, 80);

    // Win/Loss
    if (playerBase.hp <= 0) {
        ctx.fillStyle = "#FF0033";
        ctx.font = "bold 40px sans-serif";
        ctx.fillText("GAME OVER 😢", 250, 300);
        return;
    }
    if (enemyBase.hp <= 0) {
        ctx.fillStyle = "#FFCC00";
        ctx.font = "bold 40px sans-serif";
        ctx.fillText("VICTORY! 🎉", 280, 300);
        return;
    }

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
