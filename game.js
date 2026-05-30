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

// Base stats (SWAPPED COORDINTATES: Player is now on the right, Enemy on the left)
const enemyBase  = { x: 50, y: 430, width: 60, height: 100, hp: 500 };
const playerBase = { x: 690, y: 430, width: 60, height: 100, hp: 500 };

// Handle Spawning Friendly Blobs
function spawnBlob() {
    const blobCost = 50;
    if (money >= blobCost) {
        money -= blobCost;
        friendlyBlobs.push({
            x: playerBase.x, // Spawns at the right base
            y: 510,
            radius: 15,
            speed: 1.5, // Moving left means subtracting from X, speed stays positive
            hp: 100,
            damage: 25,
            color: "#00FFCC",
            state: "walking" 
        });
    }
}

// Handle Spawning Enemy Cubes
function spawnEnemy() {
    enemyCubes.push({
        x: enemyBase.x + enemyBase.width, // Spawns at the left base edge
        y: 495,
        size: 30,
        speed: 1.0,
        hp: 120,
        damage: 20,
        color: "#FF3366",
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
    // 1. ECONOMY TICK
    if (timestamp - lastMoneyTick >= 1000) {
        money += moneyRate;
        lastMoneyTick = timestamp;
    }

    // 2. ENEMY AI SPAWN TICK
    if (timestamp - lastEnemySpawn >= 4000) {
        spawnEnemy();
        lastEnemySpawn = timestamp;
    }

    // 3. COLLISION & COMBAT LOGIC
    friendlyBlobs.forEach(b => b.state = "walking");
    enemyCubes.forEach(c => c.state = "walking");

    for (let blob of friendlyBlobs) {
        for (let cube of enemyCubes) {
            // Check if the circle (blob) is touching the square (cube)
            // Modified for right-to-left movement collision
            if (blob.x - blob.radius <= cube.x + cube.size && blob.x + blob.radius >= cube.x) {
                blob.state = "fighting";
                cube.state = "fighting";
                
                cube.hp -= blob.damage * 0.02;
                blob.hp -= cube.damage * 0.02;
            }
        }
        
        // Check if blob is hitting enemy base (on the left)
        if (blob.x - blob.radius <= enemyBase.x + enemyBase.width) {
            blob.state = "fighting";
            enemyBase.hp -= blob.damage * 0.02;
        }
    }

    // Check if enemies are hitting player base (on the right)
    for (let cube of enemyCubes) {
        if (cube.x + cube.size >= playerBase.x) {
            cube.state = "fighting";
            playerBase.hp -= cube.damage * 0.02;
        }
    }

    // Clean up dead entities
    friendlyBlobs = friendlyBlobs.filter(blob => blob.hp > 0);
    enemyCubes = enemyCubes.filter(cube => cube.hp > 0);

    // 4. CLEAR SCREEN
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 5. DRAW ENVIRONMENT
    ctx.fillStyle = "#333";
    ctx.fillRect(0, 530, canvas.width, 70);

    // 6. DRAW BASES & HP
    ctx.fillStyle = "#ff4444"; // Red Enemy Base on Left
    ctx.fillRect(enemyBase.x, enemyBase.y, enemyBase.width, enemyBase.height);
    ctx.fillStyle = "#fff";
    ctx.fillText(`HP: ${Math.max(0, Math.floor(enemyBase.hp))}`, enemyBase.x, enemyBase.y - 10);

    ctx.fillStyle = "#4444ff"; // Blue Player Base on Right
    ctx.fillRect(playerBase.x, playerBase.y, playerBase.width, playerBase.height);
    ctx.fillStyle = "#fff";
    ctx.fillText(`HP: ${Math.max(0, Math.floor(playerBase.hp))}`, playerBase.x, playerBase.y - 10);

    // 7. UPDATE & DRAW FRIENDLY BLOBS (Now moving LEFT)
    friendlyBlobs.forEach((blob) => {
        if (blob.state === "walking") {
            blob.x -= blob.speed; // Subtracting moves it left
        }
        ctx.beginPath();
        ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
        ctx.fillStyle = blob.color;
        ctx.fill();
        ctx.closePath();
    });

    // 8. UPDATE & DRAW ENEMY CUBES (Now moving RIGHT)
    enemyCubes.forEach((cube) => {
        if (cube.state === "walking") {
            cube.x += cube.speed; // Adding moves it right
        }
        ctx.fillStyle = cube.color;
        ctx.fillRect(cube.x, cube.y, cube.size, cube.size);
    });

    // 9. DRAW UI
    ctx.fillStyle = "#fff";
    ctx.font = "20px sans-serif";
    ctx.fillText(`Money: $${money}`, 20, 80);

    // Check Win/Loss conditions
    if (playerBase.hp <= 0) {
        ctx.fillStyle = "red";
        ctx.font = "40px sans-serif";
        ctx.fillText("GAME OVER! Your base fell. 😢", 150, 300);
        return;
    }
    if (enemyBase.hp <= 0) {
        ctx.fillStyle = "gold";
        ctx.font = "40px sans-serif";
        ctx.fillText("VICTORY! Enemy base destroyed! 🎉", 120, 300);
        return;
    }

    requestAnimationFrame(gameLoop);
}

// Start the game loop
requestAnimationFrame(gameLoop);
