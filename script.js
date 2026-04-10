const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const targetElement = document.getElementById('targetScore');
const levelDisplay = document.getElementById('levelDisplay');

const BASE_SIZE = 48; 
const BASE_SPEED = 4; 
const MAX_LEVELS = 20;

let snakePath = [];
let snakeLength = 40; 
let head = { x: 350, y: 350 };
let velocity = { x: 1, y: 0 };
let currentDir = 'RIGHT';

let food = null;
let speedBonusItem = null;
let obstacles = [];
let score = 0;
let currentLevel = 1;
let targetScore = 1000;
let maxLevelUnlocked = 1;

let isPlaying = false;
let animationId;
let eatTimer = 0;

let currentSpeed = BASE_SPEED;
let speedBoostTimer = 0;

// --- CHARGEMENT DES ASSETS ---
function loadImage(src) {
    const img = new Image();
    img.src = src;
    return img;
}

const assets = {
    headClosed: loadImage('assets/niels_ferme.png'),
    headOpen: loadImage('assets/niels_ouvert.png'),
    lettres: [loadImage('assets/lettre_1.png'), loadImage('assets/lettre_2.png'), loadImage('assets/lettre_3.png'), loadImage('assets/lettre_4.png')],
    colis: [loadImage('assets/colis_1.png'), loadImage('assets/colis_2.png'), loadImage('assets/colis_3.png')],
    recommande: [loadImage('assets/recommande.jpg')],
    obstacles: [loadImage('assets/banane.png'), loadImage('assets/caca.png')],
    bonusVitesse: loadImage('assets/stabi_bonus.png')
};

// --- MOTEUR PHYSIQUE ÉCRAN TITRE ---
const titleCanvas = document.getElementById('titleCanvas');
const tCtx = titleCanvas.getContext('2d');
let titleAnimId;
let bouncers = [];
let mouse = { x: -1000, y: -1000 };

function initTitlePhysics() {
    bouncers = [];
    // Combine lettres et colis pour l'animation
    const pools = [...assets.lettres, ...assets.colis];
    
    // Crée 15 objets rebondissants
    for(let i=0; i<15; i++) {
        bouncers.push({
            x: Math.random() * (titleCanvas.width - 100) + 50,
            y: Math.random() * (titleCanvas.height - 100) + 50,
            vx: (Math.random() - 0.5) * 6, // Vitesse X aléatoire
            vy: (Math.random() - 0.5) * 6, // Vitesse Y aléatoire
            size: 40 + Math.random() * 30, // Taille aléatoire
            img: pools[Math.floor(Math.random() * pools.length)],
            rot: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.1
        });
    }
    
    if(!titleAnimId) titleLoop();
}

function titleLoop() {
    tCtx.clearRect(0, 0, titleCanvas.width, titleCanvas.height);
    
    for(let b of bouncers) {
        b.x += b.vx;
        b.y += b.vy;
        b.rot += b.rotSpeed;

        // Rebond sur les murs
        if(b.x - b.size/2 < 0 || b.x + b.size/2 > titleCanvas.width) b.vx *= -1;
        if(b.y - b.size/2 < 0 || b.y + b.size/2 > titleCanvas.height) b.vy *= -1;

        // Interaction avec la souris (Répulsion)
        let dx = b.x - mouse.x;
        let dy = b.y - mouse.y;
        let dist = Math.hypot(dx, dy);
        
        if(dist < 120) { // Si la souris est proche
            let force = (120 - dist) / 120; // Plus c'est proche, plus la force est grande
            b.vx += (dx / dist) * force * 2;
            b.vy += (dy / dist) * force * 2;
        }

        // Friction douce pour ne pas qu'ils accélèrent à l'infini avec la souris
        let speed = Math.hypot(b.vx, b.vy);
        if(speed > 5) {
            b.vx *= 0.98;
            b.vy *= 0.98;
        }

        // Dessin
        if(b.img && b.img.complete) {
            tCtx.save();
            tCtx.translate(b.x, b.y);
            tCtx.rotate(b.rot);
            tCtx.drawImage(b.img, -b.size/2, -b.size/2, b.size, b.size);
            tCtx.restore();
        }
    }
    titleAnimId = requestAnimationFrame(titleLoop);
}

// Suivi de la souris sur l'écran titre
document.getElementById('titleScreen').addEventListener('mousemove', (e) => {
    const rect = titleCanvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
});
document.getElementById('titleScreen').addEventListener('mouseleave', () => {
    mouse.x = -1000;
    mouse.y = -1000;
});


function getSavedLevel() {
    try {
        let saved = localStorage.getItem('facteurSnakeurLevel');
        let level = parseInt(saved);
        return (isNaN(level) || level < 1) ? 1 : level;
    } catch (e) {
        return 1; 
    }
}

// --- GESTION DES MENUS ---
function showTitleScreen() {
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('titleScreen').classList.remove('hidden');
    // On relance la physique de l'écran titre
    initTitlePhysics(); 
}

function enterLevelSelect() {
    document.getElementById('titleScreen').classList.add('hidden');
    // On arrête la physique pour économiser les perfs
    cancelAnimationFrame(titleAnimId);
    titleAnimId = null;
    showMainMenu();
}

function showMainMenu() {
    isPlaying = false;
    cancelAnimationFrame(animationId);
    
    canvas.classList.remove('speed-boost');
    
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('levelCompleteScreen').classList.add('hidden');
    document.getElementById('mainMenu').classList.remove('hidden');
    
    maxLevelUnlocked = getSavedLevel(); 
    const grid = document.getElementById('levelGrid');
    if (!grid) return; 
    grid.innerHTML = '';
    
    for (let i = 1; i <= MAX_LEVELS; i++) {
        const btn = document.createElement('button');
        btn.innerText = i;
        btn.classList.add('level-btn');
        if (i > maxLevelUnlocked) {
            btn.classList.add('locked');
            btn.disabled = true; 
        } else {
            btn.onclick = () => startGame(i);
        }
        grid.appendChild(btn);
    }
}

// --- LOGIQUE DU JEU ---
function startGame(level) {
    currentLevel = level;
    targetScore = 1000 + ((level - 1) * 500); 
    score = 0;
    snakeLength = 40;
    head = { x: canvas.width / 2, y: canvas.height / 2 };
    velocity = { x: 1, y: 0 };
    currentDir = 'RIGHT';
    snakePath = [];
    currentSpeed = BASE_SPEED;
    speedBoostTimer = 0;
    speedBonusItem = null;
    canvas.classList.remove('speed-boost');
    
    scoreElement.innerText = score;
    targetElement.innerText = targetScore;
    levelDisplay.innerText = `Niveau: ${currentLevel}`;
    
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('levelCompleteScreen').classList.add('hidden');
    
    spawnObstacles();
    spawnFood();
    
    isPlaying = true;
    gameLoop();
}

function spawnObstacles() {
    obstacles = [];
    const numObstacles = (currentLevel - 1) * 2; 
    
    for (let i = 0; i < numObstacles; i++) {
        const obsImg = assets.obstacles[Math.floor(Math.random() * assets.obstacles.length)];
        obstacles.push({
            x: Math.random() * (canvas.width - BASE_SIZE * 2) + BASE_SIZE,
            y: Math.random() * (canvas.height - BASE_SIZE * 2) + BASE_SIZE,
            img: obsImg
        });
    }
}

function spawnFood() {
    let newX, newY, safe;
    do {
        safe = true;
        newX = Math.random() * (canvas.width - BASE_SIZE * 2) + BASE_SIZE;
        newY = Math.random() * (canvas.height - BASE_SIZE * 2) + BASE_SIZE;
        for (let obs of obstacles) {
            if (Math.hypot(obs.x - newX, obs.y - newY) < BASE_SIZE * 2) safe = false;
        }
    } while (!safe);

    const rand = Math.random();
    let pool, points, growth;

    if (rand < 0.70) { pool = assets.lettres; points = 50; growth = 10; } 
    else if (rand < 0.95) { pool = assets.colis; points = 150; growth = 20; } 
    else { pool = assets.recommande; points = 500; growth = 40; }

    const img = pool[Math.floor(Math.random() * pool.length)];
    food = { x: newX, y: newY, img: img, points: points, growth: growth };

    if (Math.random() < 0.20 && !speedBonusItem) {
        speedBonusItem = {
            x: Math.random() * (canvas.width - BASE_SIZE * 2) + BASE_SIZE,
            y: Math.random() * (canvas.height - BASE_SIZE * 2) + BASE_SIZE,
            img: assets.bonusVitesse
        };
    }
}

function update() {
    if (!isPlaying) return;

    if (speedBoostTimer > 0) {
        speedBoostTimer--;
        if (speedBoostTimer <= 0) {
            currentSpeed = BASE_SPEED;
            canvas.classList.remove('speed-boost');
        }
    }

    head.x += velocity.x * currentSpeed;
    head.y += velocity.y * currentSpeed;

    if (head.x < 0) head.x = canvas.width;
    if (head.x > canvas.width) head.x = 0;
    if (head.y < 0) head.y = canvas.height;
    if (head.y > canvas.height) head.y = 0;

    snakePath.unshift({ x: head.x, y: head.y });
    if (snakePath.length > snakeLength) snakePath.pop();

    if (Math.hypot(head.x - food.x, head.y - food.y) < BASE_SIZE) {
        score += food.points;
        snakeLength += food.growth;
        scoreElement.innerText = score;
        eatTimer = 10;
        
        if (score >= targetScore) { triggerLevelComplete(); return; }
        spawnFood();
    }

    if (speedBonusItem && Math.hypot(head.x - speedBonusItem.x, head.y - speedBonusItem.y) < BASE_SIZE) {
        currentSpeed = BASE_SPEED * 1.5;
        speedBoostTimer = 300; 
        speedBonusItem = null; 
        canvas.classList.add('speed-boost'); 
        eatTimer = 10;
    }

    for (let obs of obstacles) {
        if (Math.hypot(head.x - obs.x, head.y - obs.y) < BASE_SIZE * 0.7) {
            triggerGameOver();
            return;
        }
    }

    for (let i = 25; i < snakePath.length; i++) {
        if (Math.hypot(head.x - snakePath[i].x, head.y - snakePath[i].y) < BASE_SIZE * 0.5) {
            triggerGameOver();
            return;
        }
    }

    if (eatTimer > 0) eatTimer--;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let obs of obstacles) {
        if (obs.img && obs.img.complete) {
            ctx.drawImage(obs.img, obs.x - BASE_SIZE/2, obs.y - BASE_SIZE/2, BASE_SIZE, BASE_SIZE);
        }
    }

    if (snakePath.length > 1) {
        ctx.beginPath();
        ctx.lineWidth = BASE_SIZE * 0.8; 
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = speedBoostTimer > 0 ? '#14b8a6' : '#f8db02'; 

        ctx.moveTo(snakePath[0].x, snakePath[0].y);
        for (let i = 1; i < snakePath.length; i++) {
            let pt = snakePath[i];
            let prevPt = snakePath[i - 1];
            if (Math.hypot(pt.x - prevPt.x, pt.y - prevPt.y) > BASE_SIZE * 2) {
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(pt.x, pt.y);
            } else {
                ctx.lineTo(pt.x, pt.y);
            }
        }
        ctx.stroke();
    }

    // Dessin du Bonus de vitesse (Effet néon + flottement, sans rotation)
    if (speedBonusItem && speedBonusItem.img && speedBonusItem.img.complete) {
        ctx.save();
        // Effet lumineux/Glow
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#14b8a6'; 
        
        // Flottement haut/bas
        const floatY = Math.sin(Date.now() / 150) * 5; 
        
        ctx.drawImage(speedBonusItem.img, speedBonusItem.x - BASE_SIZE/2, speedBonusItem.y - BASE_SIZE/2 + floatY, BASE_SIZE, BASE_SIZE);
        ctx.restore();
    }

    if (food && food.img && food.img.complete) {
        const bounce = Math.sin(Date.now() / 150) * 5;
        ctx.drawImage(food.img, food.x - BASE_SIZE/2, food.y - BASE_SIZE/2 + bounce, BASE_SIZE, BASE_SIZE);
    }

    const headImg = (eatTimer > 0) ? assets.headOpen : assets.headClosed;
    if (headImg && headImg.complete) {
        let angle = 0;
        if (currentDir === 'RIGHT') angle = 0;
        if (currentDir === 'LEFT') angle = Math.PI;
        if (currentDir === 'DOWN') angle = Math.PI / 2;
        if (currentDir === 'UP') angle = -Math.PI / 2;

        ctx.save();
        ctx.translate(head.x, head.y);
        ctx.rotate(angle);
        const drawSize = BASE_SIZE * 1.5; 
        ctx.drawImage(headImg, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
        ctx.restore();
    }
}

function gameLoop() {
    update();
    draw();
    if (isPlaying) {
        animationId = requestAnimationFrame(gameLoop);
    }
}

function triggerGameOver() {
    isPlaying = false;
    document.getElementById('finalScore').innerText = score;
    document.getElementById('gameOverScreen').classList.remove('hidden');
}

function triggerLevelComplete() {
    isPlaying = false;
    if (currentLevel >= maxLevelUnlocked && currentLevel < MAX_LEVELS) {
        maxLevelUnlocked = currentLevel + 1;
        localStorage.setItem('facteurSnakeurLevel', maxLevelUnlocked);
    }
    if(currentLevel === MAX_LEVELS) {
        document.getElementById('nextLevelBtn').style.display = 'none';
        document.querySelector('#levelCompleteScreen p').innerText = "INCROYABLE ! Tu as fini le jeu entier !";
    } else {
        document.getElementById('nextLevelBtn').style.display = 'inline-block';
    }
    document.getElementById('levelCompleteScreen').classList.remove('hidden');
}

window.addEventListener('keydown', e => {
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(e.code) > -1) {
        e.preventDefault();
    }
    switch (e.key) {
        case 'ArrowUp':
            if (currentDir !== 'DOWN') { velocity = { x: 0, y: -1 }; currentDir = 'UP'; }
            break;
        case 'ArrowDown':
            if (currentDir !== 'UP') { velocity = { x: 0, y: 1 }; currentDir = 'DOWN'; }
            break;
        case 'ArrowLeft':
            if (currentDir !== 'RIGHT') { velocity = { x: -1, y: 0 }; currentDir = 'LEFT'; }
            break;
        case 'ArrowRight':
            if (currentDir !== 'LEFT') { velocity = { x: 1, y: 0 }; currentDir = 'RIGHT'; }
            break;
    }
});

// Lance l'animation de l'écran titre au démarrage de la page
window.onload = () => {
    initTitlePhysics();
};