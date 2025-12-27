const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

/* ===== DEVICE CHECK ===== */
const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;

/* ===== MOBILE LOCK ===== */
document.body.style.touchAction = "none";
document.body.style.userSelect = "none";

/* ===== VIEW SIZE ===== */
let vw = 0, vh = 0;

/* ===== DPR SAFE RESIZE ===== */
function resize() {
    const dpr = window.devicePixelRatio || 1;
    vw = Math.min(window.innerWidth, 420);
    vh = Math.min(window.innerHeight, 720);

    canvas.style.width = vw + "px";
    canvas.style.height = vh + "px";
    canvas.width = vw * dpr;
    canvas.height = vh * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
window.addEventListener("resize", resize);

/* ===== DRAW HELPERS ===== */
function neonText(text, x, y, size = 18, color = "#00f7ff") {
    ctx.save();
    ctx.font = `${size}px Arial`;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 25;
    ctx.fillText(text, x, y);
    ctx.restore();
}
function drawNeonImage(img, x, y, w, h, glow = "#00f7ff") {
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = 20;
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
}

/* ===== ASSETS ===== */
const bgImg = new Image(); bgImg.src = "assets/background.png";
const birdImg = new Image(); birdImg.src = "assets/bird.png";
const pipeImg = new Image(); pipeImg.src = "assets/pipe.png";
const pipeTwoImg = new Image(); pipeTwoImg.src = "assets/pipetwo.png";
const wallImg = new Image(); wallImg.src = "assets/wall.png";
const voteImg = new Image(); voteImg.src = "assets/coin.png";
const storeImg = new Image(); storeImg.src = "assets/store.png";
const looseImg = new Image(); looseImg.src = "assets/loose.png";

/* ===== SOUND ===== */
const bgSound = new Audio("assets/bg.mp3");
bgSound.loop = true;
bgSound.volume = 0.4;
let musicStarted = false;
let soundOn = true;

/* ===== STORAGE ===== */
let votes = +localStorage.getItem("votes") || 0;
let reviveStock = +localStorage.getItem("reviveStock") || 0;
let highDistance = +localStorage.getItem("highDistance") || 0;

/* ===== GAME STATE ===== */
let started = false;
let storeOpen = false;
let gameOver = false;

/* ===== PHYSICS ===== */
const gravity = 0.5;
const jump = -8;
let score = 0;
let distance = 0;

/* ===== BIRD ===== */
let bird = { x: 150, y: 0, w: 34, h: 34, vy: 0 };

/* ===== PIPES ===== */
let pipes = [];
const pipeWidth = 150;
const pipeGap = 250;
const pipeSpeed = 4;
const pipeDistance = 350;
let pipeSpawnCounter = 0;

/* ===== CLEAR NEXT 25 PIPES ===== */
let clearPipesActive = false;
let clearedPipesRemaining = 0;
let clearPipeCounter = 0;

/* ===== REVIVE SAFE ZONE ===== */
let reviveSafePipes = 0;
let revivePipeCounter = 0;

/* ===== STORE COSTS ===== */
const revivePrice = 30;
const clearPipesCost = 50;

/* ===== WALL TASK ===== */
let wallActive = false;
let wallHits = 0;
const wallHitsRequired = 10;
let nextWallScore = 10;

/* ===== CAMERA ===== */
let camY = 0, camTargetY = 0;

/* ===== START GAME ===== */
function startGame() {
    pipes = [];
    bird.y = vh / 2;
    bird.vy = jump;
    score = 0;
    distance = 0;
    nextWallScore = 10;
    wallActive = false;
    storeOpen = false;
    gameOver = false;
    pipeSpawnCounter = 0;
}

/* ===== REVIVE ===== */
function revivePlayer() {
    if (reviveStock <= 0) return;

    reviveStock--;
    localStorage.setItem("reviveStock", reviveStock);

    gameOver = false;
    pipes = [];
    bird.y = vh / 2;
    bird.vy = jump;

    reviveSafePipes = 2;
    revivePipeCounter = 0;
}

/* ===== END GAME ===== */
function endGame() {
    gameOver = true;
    if (distance > highDistance) {
        highDistance = Math.floor(distance);
        localStorage.setItem("highDistance", highDistance);
    }
}

/* ===== PIPE SPAWN ===== */
function maybeCreatePipe() {

    if (reviveSafePipes > 0) {
        revivePipeCounter += pipeSpeed;
        if (revivePipeCounter >= pipeDistance) {
            revivePipeCounter = 0;
            reviveSafePipes--;
        }
        return;
    }

    if (clearPipesActive) {
        clearPipeCounter += pipeSpeed;
        if (clearPipeCounter >= pipeDistance) {
            clearPipeCounter = 0;
            clearedPipesRemaining--;
            score++;
            votes++;
            localStorage.setItem("votes", votes);
            if (clearedPipesRemaining <= 0) {
                clearPipesActive = false;
            }
        }
        return;
    }

    if (!pipes.length || pipes[pipes.length - 1].x <= vw - pipeDistance) {

        pipeSpawnCounter++;

        let useSpecialPipe = false;

        if (pipeSpawnCounter >= 3) {
            useSpecialPipe = Math.random() < 0.35;
            if (useSpecialPipe) pipeSpawnCounter = 0;
        }

        let top = Math.random() * (vh - pipeGap - 120) + 60;

        pipes.push({
            x: vw,
            top,
            bottom: vh - top - pipeGap,
            passed: false,
            special: useSpecialPipe
        });
    }
}

/* ===== INPUT ===== */
function handleInput(x, y) {
    if (!musicStarted) {
        bgSound.play().catch(()=>{});
        musicStarted = true;
    }

    if (!started) {
        started = true;
        startGame();
        return;
    }

    if (storeOpen) {

        if (y > 140 && y < 180 && votes >= revivePrice) {
            votes -= revivePrice;
            reviveStock++;
        }

        if (y > 200 && y < 240 && votes >= clearPipesCost && !clearPipesActive) {
            votes -= clearPipesCost;
            clearPipesActive = true;
            clearedPipesRemaining = 25;
            clearPipeCounter = 0;
            pipes = [];
        }

        if (y > 260 && y < 300) storeOpen = false;
        if (y > 320 && y < 360) startGame();
        if (y > 380 && y < 420) { storeOpen = false; endGame(); }
        if (y > 440 && y < 480) {
            soundOn = !soundOn;
            bgSound.muted = !soundOn;
        }

        localStorage.setItem("votes", votes);
        localStorage.setItem("reviveStock", reviveStock);
        return;
    }

    if (x > vw - 55 && y < 55) {
        storeOpen = true;
        return;
    }

    if (wallActive) {
        wallHits++;
        if (wallHits >= wallHitsRequired) {
            wallActive = false;
            wallHits = 0;
            nextWallScore += 10;
        }
        return;
    }

    if (gameOver) {
        reviveStock > 0 ? revivePlayer() : startGame();
        return;
    }

    bird.vy = jump;
}

/* ===== INPUT LISTENERS ===== */
canvas.addEventListener("touchstart", e => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const t = e.touches[0];
    handleInput(t.clientX - r.left, t.clientY - r.top);
}, { passive:false });

if (!isTouchDevice) {
    canvas.addEventListener("mousedown", e => {
        const r = canvas.getBoundingClientRect();
        handleInput(e.clientX - r.left, e.clientY - r.top);
    });
}

/* ===== UPDATE ===== */
function update() {
    if (!started || storeOpen || wallActive || gameOver) return;

    distance += pipeSpeed * 0.1;
    bird.vy += gravity;
    bird.y += bird.vy;

    if (bird.y < 0 || bird.y + bird.h > vh) return endGame();

    pipes.forEach(p => {
        p.x -= pipeSpeed;

        if (!p.passed && p.x + pipeWidth < bird.x) {
            p.passed = true;
            score++;
            votes++;
            localStorage.setItem("votes", votes);
            if (score === nextWallScore) wallActive = true;
        }

        if (
            bird.x < p.x + pipeWidth &&
            bird.x + bird.w > p.x &&
            (bird.y < p.top || bird.y + bird.h > vh - p.bottom)
        ) endGame();
    });

    pipes = pipes.filter(p => p.x + pipeWidth > 0);
    maybeCreatePipe();

    camTargetY = vh / 2 - bird.y;
    camY += (camTargetY - camY) * 0.08;
}

/* ===== DRAW ===== */
function draw() {
    ctx.clearRect(0,0,vw,vh);

    ctx.save();
    ctx.translate(0, Math.round(camY));
    drawNeonImage(bgImg, 0, 0, vw, vh);
    drawNeonImage(birdImg, bird.x, bird.y, bird.w, bird.h, "#00ff66");

    pipes.forEach(p => {
        const img = p.special ? pipeTwoImg : pipeImg;
        const glow = p.special ? "#ffd700" : "#ff0033";

        drawNeonImage(img, p.x, vh - p.bottom, pipeWidth, p.bottom, glow);
        ctx.save(); ctx.scale(1,-1);
        drawNeonImage(img, p.x, -p.top, pipeWidth, p.top, glow);
        ctx.restore();
    });
    ctx.restore();

    if (!started) {
        neonText("TAP TO START", vw/2 - 80, vh/2, 24);
        return;
    }

    neonText(`Distance: ${Math.floor(distance)} m`, 10, 25);
    neonText(`Best: ${highDistance} m`, 10, 45, 14);
    neonText(`Score: ${score}`, 10, 70);

    drawNeonImage(voteImg, 10, 85, 22, 22);
    neonText(votes, 40, 103);

    drawNeonImage(storeImg, vw-55, 10, 40, 40);

    if (wallActive) {
        ctx.fillStyle="rgba(0,0,0,.6)";
        ctx.fillRect(0,0,vw,vh);
        drawNeonImage(wallImg, vw/2-110, vh/2-110, 220,220);
        neonText(`TAPS ${wallHits}/${wallHitsRequired}`, vw/2-75, vh/2+150, 20);
    }

    if (storeOpen) {
        ctx.fillStyle="rgba(0,0,0,.85)";
        ctx.fillRect(0,0,vw,vh);
        neonText("STORE", vw/2-40, 80, 30);
        neonText("Buy Revive (30 votes)", vw/2-120, 160, 18);
        neonText("Clear Next 25 Pipes (50 votes)", vw/2-170, 220, 18);
        neonText("Resume", vw/2-40, 280, 20, "#00ff00");
        neonText("Restart", vw/2-40, 340, 20, "#ffd700");
        neonText("Quit", vw/2-40, 400, 20, "#ff0033");
        neonText(`Sound: ${soundOn ? "ON" : "OFF"}`, vw/2-80, 460, 20);
    }

    if (gameOver) {
        ctx.fillStyle = "rgba(0,0,0,.6)";
        ctx.fillRect(0,0,vw,vh);

        const w = 260;
        const h = 120;

        drawNeonImage(
            looseImg,
            vw/2 - w/2,
            vh/2 - h/2,
            w,
            h,
            "#ff0033"
        );
    }
}

/* ===== LOOP ===== */
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}
loop();
