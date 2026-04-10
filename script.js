const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const targetElement = document.getElementById('targetScore');
const levelDisplay = document.getElementById('levelDisplay');

// Constantes d'échelle et de physique
const BASE_SIZE = 48; // Les assets sont plus gros
const SPEED = 4; // Vitesse de déplacement au pixel par frame
const MAX_LEVELS = 20;

let snakePath = []; // Enregistre l'historique des positions {x, y}
let snakeLength = 40; // Longueur initiale (en nombre de frames enregistrées)
let head = { x: 350, y: 350 };
let velocity = { x: 1, y: 0 };
let currentDir = 'RIGHT';

let food = null;
let obstacles = []; // Les chiens !
let score = 0;
let currentLevel = 1;
let targetScore = 1000;
// Remplace l'ancienne déclaration de maxLevelUnlocked (vers la ligne 18)
let maxLevelUnlocked = 1;

let isPlaying = false;
let animationId;
let eatTimer = 0;

// --- CHARGEMENT DES ASSETS ---
function loadImage(src) {
    const img = new Image();
    img.src = src;
    return img;
}

const assets = {
    headClosed: loadImage('assets/niels_ferme.png'),
    headOpen: loadImage('assets/niels_ouvert.png'),
    lettres: [
        loadImage('assets/lettre_1.png'), loadImage('assets/lettre_2.png'),
        loadImage('assets/lettre_3.png'), loadImage('assets/lettre_4.png')
    ],
    colis: [
        loadImage('assets/colis_1.png'), loadImage('assets/colis_2.png'),
        loadImage('assets/colis_3.png')
    ],
    recommande: [loadImage('assets/recommande.jpg')]
};

// --- FONCTION DE SÉCURITÉ POUR LA SAUVEGARDE ---
function getSavedLevel() {
    try {
        let saved = localStorage.getItem('facteurSnakeurLevel');
        let level = parseInt(saved);
        // Si c'est un nombre valide on le retourne, sinon on force le Niveau 1
        return (isNaN(level) || level < 1) ? 1 : level;
    } catch (e) {
        console.warn("Lecture de sauvegarde impossible, on débloque le niveau 1 :", e);
        return 1; 
    }
}

// --- MENU & NIVEAUX ---
function initMenu() {
    maxLevelUnlocked = getSavedLevel(); // Utilise la fonction sécurisée
    const grid = document.getElementById('levelGrid');
    
    if (!grid) return; // Sécurité supplémentaire
    
    grid.innerHTML = '';
    
    for (let i = 1; i <= MAX_LEVELS; i++) {
        const btn = document.createElement('button');
        btn.innerText = i;
        btn.classList.add('level-btn');
        
        if (i > maxLevelUnlocked) {
            btn.classList.add('locked');
            btn.disabled = true; // Empêche le clic physiquement
        } else {
            btn.onclick = () => startGame(i);
        }
        grid.appendChild(btn);
    }
}

function showMainMenu() {
    isPlaying = false;
    cancelAnimationFrame(animationId);
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('levelCompleteScreen').classList.add('hidden');
    document.getElementById('mainMenu').classList.remove('hidden');
    initMenu();
}

// --- LOGIQUE DU JEU ---
function startGame(level) {
    currentLevel = level;
    targetScore = 1000 + ((level - 1) * 500); // +500 pts requis par niveau
    score = 0;
    snakeLength = 40;
    head = { x: canvas.width / 2, y: canvas.height / 2 };
    velocity = { x: 1, y: 0 };
    currentDir = 'RIGHT';
    snakePath = [];
    
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
    const numObstacles = (currentLevel - 1) * 2; // Ajoute 2 chiens par niveau
    
    for (let i = 0; i < numObstacles; i++) {
        obstacles.push({
            x: Math.random() * (canvas.width - BASE_SIZE * 2) + BASE_SIZE,
            y: Math.random() * (canvas.height - BASE_SIZE * 2) + BASE_SIZE
        });
    }
}

function spawnFood() {
    let newX, newY, safe;
    // S'assure que la nourriture n'apparait pas sur un obstacle
    do {
        safe = true;
        newX = Math.random() * (canvas.width - BASE_SIZE * 2) + BASE_SIZE;
        newY = Math.random() * (canvas.height - BASE_SIZE * 2) + BASE_SIZE;
        
        for (let obs of obstacles) {
            if (Math.hypot(obs.x - newX, obs.y - newY) < BASE_SIZE * 2) safe = false;
        }
    } while (!safe);

    const rand = Math.random();
    let category, pool, points, growth;

    if (rand < 0.70) {
        pool = assets.lettres; points = 50; growth = 10;
    } else if (rand < 0.95) {
        pool = assets.colis; points = 150; growth = 20;
    } else {
        pool = assets.recommande; points = 500; growth = 40;
    }

    const img = pool[Math.floor(Math.random() * pool.length)];
    food = { x: newX, y: newY, img: img, points: points, growth: growth };
}

function update() {
    if (!isPlaying) return;

    // Déplacement fluide continu
    head.x += velocity.x * SPEED;
    head.y += velocity.y * SPEED;

    // Gestion de la traversée des murs (Wrap)
    if (head.x < 0) head.x = canvas.width;
    if (head.x > canvas.width) head.x = 0;
    if (head.y < 0) head.y = canvas.height;
    if (head.y > canvas.height) head.y = 0;

    // Enregistrement de la trajectoire
    snakePath.unshift({ x: head.x, y: head.y });
    if (snakePath.length > snakeLength) snakePath.pop();

    // Collisions avec la nourriture (Basé sur la distance / Rayon)
    if (Math.hypot(head.x - food.x, head.y - food.y) < BASE_SIZE) {
        score += food.points;
        snakeLength += food.growth;
        scoreElement.innerText = score;
        eatTimer = 10;
        
        if (score >= targetScore) {
            triggerLevelComplete();
            return;
        }
        spawnFood();
    }

    // Collisions avec les obstacles (Chiens)
    for (let obs of obstacles) {
        if (Math.hypot(head.x - obs.x, head.y - obs.y) < BASE_SIZE * 0.8) {
            triggerGameOver();
            return;
        }
    }

    // Collisions avec sa propre queue (On ignore les 20 premières frames pour ne pas mourir en tournant)
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

    // 1. Dessin des Obstacles (Chiens)
    ctx.font = `${BASE_SIZE}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let obs of obstacles) {
        ctx.fillText("🐕", obs.x, obs.y);
    }

    // 2. Dessin du corps du serpent (Ligne continue très lisse)
    if (snakePath.length > 1) {
        ctx.beginPath();
        ctx.lineWidth = BASE_SIZE * 0.8; 
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        /* --- NOUVELLE COULEUR DU CORPS: DORÉ CHBK.FUN --- */
        ctx.strokeStyle = '#f8db02'; 

        ctx.moveTo(snakePath[0].x, snakePath[0].y);
        for (let i = 1; i < snakePath.length; i++) {
            let pt = snakePath[i];
            let prevPt = snakePath[i - 1];
            // Si le point saute d'un bord à l'autre, on casse la ligne
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

    // 3. Dessin de la nourriture
    if (food && food.img && food.img.complete) {
        const bounce = Math.sin(Date.now() / 150) * 5;
        ctx.drawImage(food.img, food.x - BASE_SIZE/2, food.y - BASE_SIZE/2 + bounce, BASE_SIZE, BASE_SIZE);
    }

    // 4. Dessin de la tête de Niels (Scale up)
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
        const drawSize = BASE_SIZE * 1.5; // Tête encore plus grosse (effet Cartoon)
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
    
    // Gère la fin du jeu si on bat le niveau 20
    if(currentLevel === MAX_LEVELS) {
        document.getElementById('nextLevelBtn').style.display = 'none';
        document.querySelector('#levelCompleteScreen p').innerText = "INCROYABLE ! Tu as fini le jeu entier !";
    } else {
        document.getElementById('nextLevelBtn').style.display = 'inline-block';
    }
    
    document.getElementById('levelCompleteScreen').classList.remove('hidden');
}

// --- CONTRÔLES ---
window.addEventListener('keydown', e => {
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(e.code) > -1) {
        e.preventDefault();
    }

    // Empêche les demi-tours immédiats
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

// Lance le menu au démarrage
initMenu();