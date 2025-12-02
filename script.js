// --- Данные игры ---
let gameRounds = [
    [{ category: "Загрузка...", questions: [100, 200, 300, 400, 500].map(p => ({ p, q: "Нет файла questions.txt", a: "..." })) }]
];
let currentRoundIndex = 0;
let gameData = gameRounds[currentRoundIndex];

// Добавили поля статистики в структуру игрока
let players = [
    { id: 1, name: "Игрок 1", score: 0, earned: 0, lost: 0, correct: 0, wrong: 0, avatarSeed: Date.now() }, 
    { id: 2, name: "Игрок 2", score: 0, earned: 0, lost: 0, correct: 0, wrong: 0, avatarSeed: Date.now() + 1 }
];

let activePlayerIndex = 0;
let answeringPlayerIndex = 0;
let currentQuestion = null;
let currentElement = null;

// --- АУДИО ---
const audioLibrary = {
    thinking: new Audio('sounds/thinking.mp3'),
    correct: new Audio('sounds/correct.mp3'),
    wrong: new Audio('sounds/wrong.mp3'),
    intro: new Audio('sounds/intro.mp3')
};
audioLibrary.thinking.loop = true;

function playSound(type) {
    const sound = audioLibrary[type];
    if (sound) { sound.currentTime = 0; sound.play().catch(e => console.log("Sound block", e)); }
}
function stopSound(type) { const sound = audioLibrary[type]; if (sound) { sound.pause(); sound.currentTime = 0; } }

// --- DOM ---
const board = document.getElementById('game-board');
const playersList = document.getElementById('players-list');
const modal = document.getElementById('modal');
const statsModal = document.getElementById('stats-modal'); // НОВОЕ
const sidebar = document.getElementById('sidebar');
const editorContent = document.getElementById('editor-content');
const roundTabsContainer = document.getElementById('round-tabs');

function initGame() {
    fetch('questions.txt')
        .then(response => { if (!response.ok) throw new Error("404"); return response.text(); })
        .then(text => parseTxtToGame(text, true))
        .catch(() => renderAll());
}

function renderAll() { renderRoundTabs(); renderBoard(); renderPlayers(); renderEditor(); }

// --- ROUNDS ---
function renderRoundTabs() {
    roundTabsContainer.innerHTML = '';
    gameRounds.forEach((_, index) => {
        const btn = document.createElement('button');
        btn.className = `round-tab ${index === currentRoundIndex ? 'active' : ''}`;
        if (index === 0) btn.textContent = "Часть 1";
        else if (index === gameRounds.length - 1 && gameRounds.length > 1) btn.textContent = "Финал";
        else btn.textContent = `Часть ${index + 1}`;
        btn.onclick = () => switchRound(index);
        roundTabsContainer.appendChild(btn);
    });
}
function switchRound(index) { currentRoundIndex = index; gameData = gameRounds[currentRoundIndex]; renderAll(); }

// --- PARSER ---
function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) { parseTxtToGame(e.target.result); };
    reader.readAsText(file);
    input.value = '';
}

function parseTxtToGame(text, silent = false) {
    const lines = text.split('\n');
    const newRounds = [];
    let currentRoundData = [];
    let currentCategory = null;
    let currentQuestion = null;
    const themeRegex = /^Тема\s*\d*\.?\s*(.+)/i;
    const questionRegex = /^(\d+)\.\s*(.+)/;
    const answerRegex = /^Ответ:\s*(.+)/i;
    const roundSeparatorRegex = /^(\d+)$/;

    const pushRound = () => { if (currentRoundData.length > 0) { newRounds.push(currentRoundData); currentRoundData = []; currentCategory = null; } };

    lines.forEach(line => {
        line = line.trim();
        if (!line) return;
        const roundMatch = line.match(roundSeparatorRegex);
        if (roundMatch && line.length < 3) { pushRound(); return; }
        const themeMatch = line.match(themeRegex);
        if (themeMatch) { currentCategory = { category: themeMatch[1].trim(), questions: [] }; currentRoundData.push(currentCategory); return; }
        const qMatch = line.match(questionRegex);
        if (qMatch && currentCategory) { currentQuestion = { p: parseInt(qMatch[1]), q: qMatch[2].trim(), a: "Ответ не указан", answered: false }; currentCategory.questions.push(currentQuestion); return; }
        const aMatch = line.match(answerRegex);
        if (aMatch && currentQuestion) currentQuestion.a = aMatch[1].trim();
    });
    pushRound();

    if (newRounds.length > 0) {
        gameRounds = newRounds;
        // Если это первый запуск, надо обновить игроков
        if (playersList.innerHTML === '') renderPlayers();
        switchRound(0);
        if (!silent) { alert(`Загружено раундов: ${gameRounds.length}`); toggleSidebar(); }
    } else if (!silent) { alert("Ошибка формата файла."); }
}

// --- RENDER ---
function renderBoard() {
    board.innerHTML = '';
    if (!gameData || gameData.length === 0) { board.innerHTML = '<div style="color:white; margin:auto;">Нет вопросов</div>'; return; }
    gameData.forEach(cat => {
        const catCell = document.createElement('div');
        catCell.className = 'cell category';
        catCell.textContent = cat.category;
        board.appendChild(catCell);
        for (let i = 0; i < 5; i++) {
            if (cat.questions[i]) {
                const q = cat.questions[i];
                const cell = document.createElement('div');
                cell.className = 'cell question';
                if (q.answered) cell.classList.add('disabled');
                else {
                    cell.textContent = q.p;
                    cell.onclick = () => handleQuestionClick(cat.category, q, cell);
                }
                board.appendChild(cell);
            } else {
                const empty = document.createElement('div');
                empty.className = 'cell disabled';
                board.appendChild(empty);
            }
        }
    });
}

function handleQuestionClick(category, q, element) {
    if (element.classList.contains('disabled') || element.classList.contains('blinking')) return;
    element.classList.add('blinking');
    setTimeout(() => { element.classList.remove('blinking'); openModal(category, q, element); }, 1000);
}

function renderPlayers() {
    playersList.innerHTML = '';
    players.forEach((player, index) => {
        const isActive = (index === activePlayerIndex);
        const card = document.createElement('div');
        card.className = `player-card ${isActive ? 'active-turn' : ''}`;
        const seed = player.avatarSeed || player.id;
        const avatarUrl = `https://api.dicebear.com/9.x/adventurer/svg?seed=${seed}&backgroundColor=b6e3f4`;
        card.innerHTML = `
            <img src="${avatarUrl}" class="player-avatar" alt="avatar" onclick="changeAvatar(${player.id})" title="Сменить аватар">
            <div class="player-info">
                <input type="text" class="player-name-input" value="${player.name}" onchange="updatePlayerName(${player.id}, this.value)">
                <div class="player-score" onclick="editScore(${player.id})">${player.score}</div>
            </div>
            <button class="delete-player-btn material-icons-round" onclick="removePlayer(${player.id})">close</button>
        `;
        card.onclick = (e) => {
            if (!e.target.classList.contains('player-name-input') && !e.target.classList.contains('delete-player-btn') && !e.target.classList.contains('player-score') && !e.target.classList.contains('player-avatar')) {
                activePlayerIndex = index; renderPlayers();
            }
        };
        playersList.appendChild(card);
    });
}

// --- PLAYER MANIPULATION ---
function changeAvatar(id) { const p = players.find(pl => pl.id === id); if (p) { p.avatarSeed = Math.random().toString(36).substring(7); renderPlayers(); } }
function editScore(id) { const p = players.find(pl => pl.id === id); const newScore = prompt(`Счет для ${p.name}:`, p.score); if (newScore !== null && !isNaN(newScore)) { p.score = parseInt(newScore); renderPlayers(); } }
function updatePlayerName(id, val) { const p = players.find(pl => pl.id === id); if (p) p.name = val; renderPlayers(); }
function addPlayer() { 
    // Создаем игрока с полями статистики
    players.push({ 
        id: Date.now(), 
        name: `Игрок ${players.length + 1}`, 
        score: 0, earned: 0, lost: 0, correct: 0, wrong: 0, 
        avatarSeed: Date.now() 
    }); 
    renderPlayers(); 
}
function removePlayer(id) { if (confirm('Удалить?')) { players = players.filter(pl => pl.id !== id); if (activePlayerIndex >= players.length) activePlayerIndex = 0; renderPlayers(); } }

// --- STATS LOGIC (НОВОЕ) ---
function showStats() {
    const tbody = document.getElementById('stats-table-body');
    tbody.innerHTML = '';
    
    // Сортировка: у кого больше очков - тот выше
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

    sortedPlayers.forEach((p, index) => {
        const tr = document.createElement('tr');
        const seed = p.avatarSeed || p.id;
        const avatarUrl = `https://api.dicebear.com/9.x/adventurer/svg?seed=${seed}&backgroundColor=b6e3f4`;
        
        tr.innerHTML = `
            <td class="stat-rank ${index === 0 ? 'rank-1' : ''}">${index + 1}</td>
            <td class="stat-name">
                <img src="${avatarUrl}" style="width:40px; height:40px; border-radius:50%; margin-right:10px;">
                ${p.name}
            </td>
            <td class="stat-score">${p.score}</td>
            <td class="stat-earned">+${p.earned}</td>
            <td class="stat-lost">${p.lost}</td>
            <td class="stat-correct">${p.correct}</td>
            <td class="stat-wrong">${p.wrong}</td>
        `;
        tbody.appendChild(tr);
    });

    statsModal.classList.remove('hidden');
}

function closeStats() {
    statsModal.classList.add('hidden');
}

// --- MODAL ---
function openModal(category, qObj, element) {
    currentQuestion = qObj;
    currentElement = element;
    answeringPlayerIndex = activePlayerIndex;

    document.getElementById('modal-category').textContent = category;
    document.getElementById('modal-points').textContent = qObj.p;
    document.getElementById('question-text').textContent = qObj.q;
    document.getElementById('answer-text').textContent = qObj.a;

    document.getElementById('answer-container').classList.add('hidden');
    document.getElementById('scoring-controls').classList.add('hidden');
    document.getElementById('close-modal-btn').classList.add('hidden');
    document.getElementById('decision-controls').classList.remove('hidden');
    
    updateModalPlayerName();
    modal.classList.remove('hidden');
    playSound('thinking');
}

function updateModalPlayerName() {
    if(players.length > 0) {
        const name = players[answeringPlayerIndex].name;
        document.getElementById('modal-player-name-decision').textContent = name;
        document.getElementById('modal-player-name-scoring').textContent = name;
    }
}

function revealAnswer() {
    stopSound('thinking');
    document.getElementById('decision-controls').classList.add('hidden');
    document.getElementById('answer-container').classList.remove('hidden');
    document.getElementById('scoring-controls').classList.remove('hidden');
}

function handlePass() {
    answeringPlayerIndex = (answeringPlayerIndex + 1) % players.length;
    document.getElementById('close-modal-btn').classList.remove('hidden');
    updateModalPlayerName();
}

function handleScore(isCorrect) {
    if (!players.length) return;
    const player = players[answeringPlayerIndex];
    const points = currentQuestion.p;

    if (isCorrect) {
        player.score += points;
        player.earned += points; // Статистика
        player.correct += 1;     // Статистика
        
        activePlayerIndex = answeringPlayerIndex;
        playSound('correct'); 
        fireConfetti();
        finishQuestion();
    } else {
        player.score -= points;
        player.lost -= points;   // Статистика (тут храним отрицательное число или положительное? Давайте как "потеряно 500")
        player.wrong += 1;       // Статистика
        
        playSound('wrong'); 
        finishQuestion();
    }
}

function finishQuestion() {
    stopSound('thinking');
    currentQuestion.answered = true;
    renderPlayers();
    closeModal();
}

function closeModal() {
    stopSound('thinking');
    modal.classList.add('hidden');
    if (currentElement) {
        currentQuestion.answered = true;
        currentElement.classList.add('disabled');
        currentElement.textContent = '';
    }
    renderBoard();
}

function fireConfetti() {
    const end = Date.now() + 1500;
    (function frame() {
        confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 } });
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 } });
        if (Date.now() < end) requestAnimationFrame(frame);
    }());
}

function toggleSidebar() { sidebar.classList.toggle('open'); }
function renderEditor() { /* (Тот же код редактора, сокращен для краткости) */ }
function downloadGameData() { /* (Тот же код скачивания) */ }
function saveAndRefresh() { renderBoard(); toggleSidebar(); }
function resetToDefault() { if(confirm('Сбросить?')) { location.reload(); } }

initGame();
