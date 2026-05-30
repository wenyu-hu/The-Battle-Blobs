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
function spawnBlob(type) {
    if (type === "basic") {
        const cost = 50;
        if (money >= cost) {
            money -= cost;
            friendlyBlobs.push({
                type: "basic",
                x: playerBase.x,
                y: 480,
                width: 50,
                height: 50,
                speed: 1.5,
                hp: 100,
                damage: 25,
                state: "walking",
                animTimer: 0
            });
        }
    } else if (type === "tank") {
        const cost = 150;
        if (money >= cost) {
            money -= cost;
            friendlyBlobs.push({
                type: "tank",
                x: playerBase.x,
                y: 440, 
                width: 90,
                height: 90,
                speed: 0.5,
                hp: 400,
                damage: 10,
                state: "walking",
                animTimer: 0
            });
        }
    }
}

// Handle Spawning Enemy Cubes
function spawnEnemy() {
    enemyCubes.push({
        x: enemyBase.x + enemyBase.width,
        y: 480,
        width: 50,
        height: 50,
        speed: 1.0,
        hp: 120,
        damage: 20,
        state: "walking",
        animTimer: 0
    });
}

// Create Container for Buttons
const buttonContainer = document.createElement("div");
buttonContainer.style.position = "absolute";
buttonContainer.style.top = "20px";
buttonContainer.style.left = "20px";
buttonContainer.style.display = "flex";
buttonContainer.style.gap = "10px";
document.body.appendChild(buttonContainer);

// Button 1: Basic Blob
const basicBtn = document.createElement("button");
basicBtn.innerText = "Spawn Basic Blob ($50)";
basicBtn.style.padding = "10px";
basicBtn.onclick = () => spawnBlob("basic");
buttonContainer.appendChild(basicBtn);

// Button 2: Tank Blob
const tankBtn = document.createElement("button");
tankBtn.innerText = "Spawn Tank Blob ($150)";
tankBtn.style.padding = "10px";
tankBtn.onclick = () => spawnBlob("tank");
buttonContainer.appendChild(tankBtn);


// VIBRANT CARTOON VECTOR ART DRAWERS
function drawBasicBlob(x, y, w, h, frame) {
    ctx.save();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#000000";
    ctx.fillStyle = "#00FF66"; // Neon Green
    
    // Smooth bobbing walk animation simulation
    let bob = Math.sin(frame * 0.2) * 3;

    // Draw Main Body
    ctx.beginPath();
    ctx.arc(x + w/2, y + h/2 + bob, w/2 - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Glossy Highlight
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.beginPath();
    ctx.arc(x + w/2 - 8, y + h/2 - 8 + bob, 5, 0, Math.PI * 2);
    ctx.fill();

    // Cartoon Eyes
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(x + w/2 - 8, y + h/2 - 3 + bob, 7, 0, Math.PI * 2);
    ctx.arc(x + w/2 + 8, y + h/2 - 3 + bob, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Pupils looking left
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(x + w/2 - 11, y + h/2 - 3 + bob, 3, 0, Math.PI * 2);
    ctx.arc(x + w/2 + 5, y + h/2 - 3 + bob, 3, 0, Math.PI * 2);
    ctx.fill();

    // Happy Smile
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x + w/2 - 2, y + h/2 + 6 + bob, 5, 0, Math.PI);
    ctx.stroke();
    ctx.restore();
}

function drawTankBlob(x, y, w, h, frame) {
    ctx.save();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#000000";
    ctx.fillStyle = "#00BCFF"; // Shield Blue
    
    let bob = Math.sin(frame * 0.1) * 2;

    // Chunky Heavy Teardrop Body Shape
    ctx.beginPath();
    ctx.moveTo(x + 10, y + h - 5 + bob);
    ctx.quadraticCurveTo(x + 5, y + 10 + bob, x + w/2, y + 5 + bob);
    ctx.quadraticCurveTo(x + w - 5, y + 10 + bob, x + w - 10, y + h - 5 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Serious Eyes
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(x + w/2 - 14, y + h/2 - 8 + bob, 10, 0, Math.PI * 2);
    ctx.arc(x + w/2 + 14, y + h/2 - 8 + bob, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Pupils
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(x + w/2 - 17, y + h/2 - 8 + bob, 4, 0, Math.PI * 2);
    ctx.arc(x + w/2 + 11, y + h/2 - 8 + bob, 4, 0, Math.PI * 2);
    ctx.fill();

    // Slanted Angry Eyebrows
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + w/2 - 26, y + h/2 - 20 + bob);
    ctx.lineTo(x + w/2 - 4, y + h/2 - 14 + bob);
    ctx.moveTo(x + w/2 + 26, y + h/2 - 20 + bob);
    ctx.lineTo(x + w/2 + 4, y + h/2 - 14 + bob);
    ctx.stroke();
    ctx.restore();
}

function drawEnemyCube(x, y, w, h, frame) {
    ctx.save();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#000000";
    ctx.fillStyle = "#FF0066"; // Hot Magenta Pink
    
    // Aggressive side-to-side shuffle simulation
    let shift = Math.sin(frame * 0.2) * 2;

    ctx.fillRect(x, y + shift, w, h);
    ctx.strokeRect(x, y + shift, w, h);

    // Angry Diagonal Eyes
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 14 + shift);
    ctx.lineTo(x + 22, y + 24 + shift);
    ctx.moveTo(x + w - 10, y + 14 + shift);
    ctx.lineTo(x + w - 22, y + 24 + shift);
    ctx.stroke();

    // Scowl Mouth
    ctx.beginPath();
    ctx.moveTo(x + w/2 - 10, y + h - 14 + shift);
    ctx.quadraticCurveTo(x + w/2, y + h - 20 + shift, x + w/2 + 10, y + h - 14 + shift);
    ctx.stroke();
    ctx.restore();
}


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
            if (blob.x <= cube.x + cube.width && blob.x + blob.width >= cube.x) {
                blob.state = "fighting";
                cube.state = "fighting";
                cube.hp -= blob.damage * 0.02;
                blob.hp -= cube.damage * 0.02;
            }
        }
        if (blob.x <= enemyBase.x + enemyBase.width) {
            blob.state = "fighting";
            enemyBase.hp -= blob.damage * 0.02;
        }
    }

    for (let cube of enemyCubes) {
        if (cube.x + cube.width >= playerBase.x) {
            cube.state = "fighting";
            playerBase.hp -= cube.damage * 0.02;
        }
    }

    friendlyBlobs = friendlyBlobs.filter(blob => blob.hp > 0);
    enemyCubes = enemyCubes.filter(cube => cube.hp > 0);

    // RENDERING
    ctx.fillStyle = "#1a102f"; // Dark Retro Sky
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Ground Road
    ctx.fillStyle = "#3cd070"; 
    ctx.fillRect(0, 530, canvas.width, 70);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 530);
    ctx.lineTo(canvas.width, 530);
    ctx.stroke();

    // Cartoon Bases
    ctx.lineWidth = 5;
    ctx.fillStyle = "#FF6600";
    ctx.fillRect(enemyBase.x, enemyBase.y, enemyBase.width, enemyBase.height);
    ctx.strokeRect(enemyBase.x, enemyBase.y, enemyBase.width, enemyBase.height);
    
    ctx.fillStyle = "#00FFFF";
    ctx.fillRect(playerBase.x, playerBase.y, playerBase.width, playerBase.height);
    ctx.strokeRect(playerBase.x, playerBase.y, playerBase.width, playerBase.height);

    // UPDATE & RENDER FRIENDLY UNITS
    friendlyBlobs.forEach((blob) => {
        blob.animTimer++;
        if (blob.state === "walking") {
            blob.x -= blob.speed; 
        }
        if (blob.type === "basic") {
            drawBasicBlob(blob.x, blob.y, blob.width, blob.height, blob.animTimer);
        } else {
            drawTankBlob(blob.x, blob.y, blob.width, blob.height, blob.animTimer);
        }
    });

    // UPDATE & RENDER ENEMY UNITS
    enemyCubes.forEach((cube) => {
        cube.animTimer++;
        if (cube.state === "walking") {
            cube.x += cube.speed; 
        }
        drawEnemyCube(cube.x, cube.y, cube.width, cube.height, cube.animTimer);
    });

    // UI Display
    ctx.fillStyle = "#fff";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(`Wallet: $${money}`, 20, 80);

    if (playerBase.hp <= 0 || enemyBase.hp <= 0) {
        ctx.fillStyle = "#FFCC00";
        ctx.font = "bold 40px sans-serif";
        ctx.fillText("MATCH OVER", 280, 300);
        return;
    }

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
