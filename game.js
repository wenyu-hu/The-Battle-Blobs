const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Game State
let money = 0;
const moneyRate = 10; 
let lastMoneyTick = 0;
let lastEnemySpawn = 0;

// Entities arrays
let friendlyBlobs = [];
let enemyCubes = [];

// Base stats
const playerBase = { x: 50, y: 430, width: 60, height: 100, hp: 1000 };
const enemyBase  = { x: 690, y: 430, width: 60, height: 100, hp: 1000 };

// Handle Spawning Friendly Blobs
function spawnBlob() {
    const blobCost = 50;
    if (money >= blobCost) {
        money -= blobCost;
        friendlyBlobs.push({
            x: playerBase.x + playerBase.width,
            y: 510,
            radius: 15,
            speed: 1.5,
            color: "#00FFCC"
        });
    }
}

// Handle Spawning Enemy Cubes (AI-driven)
function spawnEnemy() {
    enemyCubes.push({
        x: enemyBase.x,
        y: 495, // Positioned to look like it's on the ground
        size: 30,
        speed: 1.0, // A bit slower than the player
        color: "#FF3366"
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
    // 1. ECONOMY TICK (Every 1 second)
    if (timestamp - lastMoneyTick >= 1000) {
        money += moneyRate;
        lastMoneyTick = timestamp;
    }

    // 2. ENEMY AI SPAWN TICK (Every 4 seconds)
    if (timestamp - lastEnemySpawn >= 4000) {
        spawnEnemy();
        lastEnemySpawn = timestamp;
    }

    // 3. CLEAR SCREEN
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 4. DRAW ENVIRONMENT (Ground)
    ctx.fillStyle = "#333";
    ctx.fillRect(0, 530, canvas.width, 70);

    // 5. DRAW BASES
    ctx.fillStyle = "#4444ff"; // Blue Player Base
    ctx.fillRect(playerBase.x, playerBase.y, playerBase.width, playerBase.height);
    
    ctx.fillStyle = "#ff4444"; // Red Enemy Base
    ctx.fillRect(enemyBase.x, enemyBase.y, enemyBase.width, enemyBase.height);

    // 6. UPDATE & DRAW FRIENDLY BLOBS
    friendlyBlobs.forEach((blob) => {
        blob.x += blob.speed; // Move right
        
        ctx.beginPath();
        ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
        ctx.fillStyle = blob.color;
        ctx.fill();
        ctx.closePath();
    });

    // 7. UPDATE & DRAW ENEMY CUBES
    enemyCubes.forEach((cube) => {
        cube.x -= cube.speed; // Move left
        
        ctx.fillStyle = cube.color;
        ctx.fillRect(cube.x, cube.y, cube.size, cube.size);
    });

    // 8. DRAW UI
    ctx.fillStyle = "#fff";
    ctx.font = "20px sans-serif";
    ctx.fillText(`Money: $${money}`, 20, 80);

    requestAnimationFrame(gameLoop);
}

// Start the game loop
requestAnimationFrame(gameLoop);
