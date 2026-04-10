const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');

const gridSize = 32;
let snake = [];
let velocity = { x: 0, y: 0 };
let lastVelocity = { x: 0, y: 0 };
let food = null;
let score = 0;
let gameOver = false;
let gameLoopId;
let eatTimer = 0; // Pour garder la bouche ouverte quelques frames
let speed = 150; // Vitesse de base en ms

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

// --- LOGIQUE DU JEU ---
function initGame() {
    snake = [{ x: 10, y: 10 }];
    velocity = { x: 1, y: 0 }; // Départ vers la droite
    lastVelocity = { x: 1, y: 0 };
    score = 0;
    speed = 140;
    gameOver = false;
    scoreElement.innerText = score;
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('startScreen').classList.add('hidden');
    spawnFood();
}

function spawnFood() {
    let newX, newY;
    let isOnSnake = true;
    
    // Trouver une case vide
    while (isOnSnake) {
        newX = Math.floor(Math.random() * (canvas.width / gridSize));
        newY = Math.floor(Math.random() * (canvas.height / gridSize));
        isOnSnake = snake.some(segment => segment.x === newX && segment.y === newY);
    }

    // Calcul des probabilités de loot
    const rand = Math.random();
    let category, pool, points;

    if (rand < 0.70) {
        category = 'lettre'; pool = assets.lettres; points = 10;
    } else if (rand < 0.95) {
        category = 'colis'; pool = assets.colis; points = 30;
    } else {
        category = 'recommande'; pool = assets.recommande; points = 100;
    }

    // Choisir une image aléatoire dans la catégorie
    const img = pool[Math.floor(Math.random() * pool.length)];
    
    food = { x: newX, y: newY, img: img, points: points };
}

function update() {
    if (gameOver) return;

    // Mise à jour de lastVelocity pour éviter les demi-tours immédiats
    lastVelocity = { ...velocity };

    const head = { x: snake[0].x + velocity.x, y: snake[0].y + velocity.y };

    // --- GESTION DES MURS (Traversée) ---
    const maxCols = canvas.width / gridSize;
    const maxRows = canvas.height / gridSize;

    if (head.x < 0) head.x = maxCols - 1;
    else if (head.x >= maxCols) head.x = 0;
    
    if (head.y < 0) head.y = maxRows - 1;
    else if (head.y >= maxRows) head.y = 0;

    // --- GESTION DES COLLISIONS (Queue) ---
    // On ne vérifie pas le dernier segment car il va avancer (sauf si on mange)
    for (let i = 0; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            triggerGameOver();
            return;
        }
    }

    snake.unshift(head); // Ajoute la nouvelle tête

    // --- GESTION DE LA NOURRITURE ---
    if (head.x === food.x && head.y === food.y) {
        score += food.points;
        scoreElement.innerText = score;
        eatTimer = 3; // Laisse la bouche ouverte pendant 3 ticks
        spawnFood();
        
        // Accélérer très légèrement le jeu à chaque repas
        if (speed > 60) speed -= 1; 
    } else {
        snake.pop(); // Enlève la queue si on n'a rien mangé
    }

    if (eatTimer > 0) eatTimer--;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Dessin du corps du serpent (Fluide et arrondi)
    if (snake.length > 1) {
        ctx.beginPath();
        ctx.lineWidth = gridSize * 0.7; // Épaisseur du corps
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#ffcc00'; // Jaune Poste cartoon

        for (let i = 0; i < snake.length; i++) {
            let px = snake[i].x * gridSize + gridSize / 2;
            let py = snake[i].y * gridSize + gridSize / 2;

            if (i === 0) {
                ctx.moveTo(px, py);
            } else {
                let prev = snake[i - 1];
                // Si on a traversé un mur, on casse la ligne pour ne pas dessiner un trait en travers de l'écran
                if (Math.abs(snake[i].x - prev.x) > 1 || Math.abs(snake[i].y - prev.y) > 1) {
                    ctx.stroke(); 
                    ctx.beginPath(); 
                    ctx.moveTo(px, py);
                } else {
                    ctx.lineTo(px, py);
                }
            }
        }
        ctx.stroke();
    }

    // 2. Dessin de la nourriture
    if (food && food.img && food.img.complete) {
        // Animation légère de rebond (Optionnel mais cartoon)
        const bounce = Math.sin(Date.now() / 200) * 3;
        ctx.drawImage(food.img, food.x * gridSize + 2, food.y * gridSize + 2 + bounce, gridSize - 4, gridSize - 4);
    }

    // 3. Dessin de la tête de Niels
    const headX = snake[0].x * gridSize + gridSize / 2;
    const headY = snake[0].y * gridSize + gridSize / 2;
    const headImg = (eatTimer > 0) ? assets.headOpen : assets.headClosed;

    if (headImg && headImg.complete) {
        let angle = 0;
        if (lastVelocity.x === 1) angle = 0;
        else if (lastVelocity.x === -1) angle = Math.PI; // 180 deg
        else if (lastVelocity.y === 1) angle = Math.PI / 2; // 90 deg
        else if (lastVelocity.y === -1) angle = -Math.PI / 2; // -90 deg

        ctx.save();
        ctx.translate(headX, headY);
        ctx.rotate(angle);
        // On dessine la tête un peu plus grosse que le corps (Effet Bobblehead)
        const headSize = gridSize * 1.4; 
        ctx.drawImage(headImg, -headSize / 2, -headSize / 2, headSize, headSize);
        ctx.restore();
    }
}

function gameLoop() {
    update();
    draw();
    if (!gameOver) {
        setTimeout(gameLoop, speed);
    }
}

function triggerGameOver() {
    gameOver = true;
    document.getElementById('finalScore').innerText = score;
    document.getElementById('gameOverScreen').classList.remove('hidden');
}

function startGame() {
    initGame();
    gameLoop();
}

function resetGame() {
    initGame();
    gameLoop();
}

// --- CONTRÔLES ---
window.addEventListener('keydown', e => {
    // Empêcher le scrolling de la page avec les flèches
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(e.code) > -1) {
        e.preventDefault();
    }

    switch (e.key) {
        case 'ArrowUp':
            if (lastVelocity.y !== 1) velocity = { x: 0, y: -1 };
            break;
        case 'ArrowDown':
            if (lastVelocity.y !== -1) velocity = { x: 0, y: 1 };
            break;
        case 'ArrowLeft':
            if (lastVelocity.x !== 1) velocity = { x: -1, y: 0 };
            break;
        case 'ArrowRight':
            if (lastVelocity.x !== -1) velocity = { x: 1, y: 0 };
            break;
    }
});