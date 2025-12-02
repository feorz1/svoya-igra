// --- Данные игры ---
let gameRounds = [
    [{ category: "Тест системы", questions: [100, 200, 300, 400, 500].map(p => ({ p, q: `Вопрос за ${p}`, a: "Ответ" })) }]
];
let currentRoundIndex = 0;
let gameData = gameRounds[currentRoundIndex];

let players = [{ id: 1, name: "Игрок 1", score: 0, avatarSeed: Date.now() }, { id: 2, name: "Игрок 2", score: 0, avatarSeed: Date.now() + 1 }];

let activePlayerIndex = 0;
let answeringPlayerIndex = 0;
let currentQuestion = null;
let currentElement = null;

// --- АУДИО (АВТОМАТИКА) ---
const audioLibrary = {
    thinking: new Audio('sounds/thinking.mp3'),
    correct: new Audio('sounds/correct.mp3'),
    wrong: new Audio('sounds/wrong.mp3'),
    intro: new Audio('sounds/intro.mp3')
};
audioLibrary.thinking.loop = true;

function playSound(type) {
    const sound = audioLibrary[type];
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(e => console.log("Блокировка звука:", e));
    }
}
function stopSound(type) {
    const sound = audioLibrary[type];
    if (sound) { sound.pause(); sound.currentTime = 0; }
}

// --- DOM ---
const board = document.getElementById('game-board');
const playersList = document.getElementById('players-list');
const modal = document.getElementById('modal');
const sidebar = document.getElementById('sidebar');
const editorContent = document.getElementById('editor-content');
const roundTabsContainer = document.getElementById('round-tabs');

function initGame() {
    renderRoundTabs();
    renderBoard();
    renderPlayers();
    renderEditor();
}

// --- Раунды ---
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

function switchRound(index) {
    currentRoundIndex = index;
    gameData = gameRounds[currentRoundIndex];
    renderRoundTabs();
    renderBoard();
    renderEditor();
}

// --- Файлы ---
function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) { parseTxtToGame(e.target.result); };
    reader.readAsText(file);
    input.value = '';
}

function parseTxtToGame(text) {
    const lines = text.split('\n');
    const newRounds = [];
    let currentRoundData = [];
    let currentCategory = null;
    let currentQuestion = null;
    const themeRegex = /^Тема\s*\d*\.?\s*(.+)/i;
    const questionRegex = /^(\d+)\.\s*(.+)/;
    const answerRegex = /^Ответ:\s*(.+)/i;
    const roundSeparatorRegex = /^(\d+)$/;

    const pushRound = () => {
        if (currentRoundData.length > 0) {
            newRounds.push(currentRoundData);
            currentRoundData = [];
            currentCategory = null;
        }
    };

    lines.forEach(line => {
        line = line.trim();
        if (!line) return;
        const roundMatch = line.match(roundSeparatorRegex);
        if (roundMatch && line.length < 3) { pushRound(); return; }
        const themeMatch = line.match(themeRegex);
        if (themeMatch) {
            currentCategory = { category: themeMatch[1].trim(), questions: [] };
            currentRoundData.push(currentCategory);
            return;
        }
        const qMatch = line.match(questionRegex);
        if (qMatch && currentCategory) {
            currentQuestion = { p: parseInt(qMatch[1]), q: qMatch[2].trim(), a: "Ответ не указан", answered: false };
            currentCategory.questions.push(currentQuestion);
            return;
        }
        const aMatch = line.match(answerRegex);
        if (aMatch && currentQuestion) currentQuestion.a = aMatch[1].trim();
    });
    pushRound();

    if (newRounds.length > 0) {
        gameRounds = newRounds;
        switchRound(0);
        alert(`Загружено раундов: ${gameRounds.length}`);
        toggleSidebar();
    } else {
        alert("Ошибка формата файла.");
    }
}

function downloadGameData() {
    let textContent = "Вопросики (Экспорт)\n\n";
    gameRounds.forEach((roundData, rIndex) => {
        textContent += `${rIndex + 1}\n\n`;
        roundData.forEach((cat, cIndex) => {
            textContent += `Тема ${cIndex + 1}. ${cat.category}\n\n`;
            cat.questions.forEach(q => { textContent += `${q.p}. ${q.q}\nОтвет: ${q.a}\n`; });
            textContent += "\n";
        });
        textContent += "\n";
    });
    const blob = new Blob([textContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "СвояИгра_Полная.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// --- Рендер ---
function renderBoard() {
    board.innerHTML = '';
    if (!gameData || gameData.length === 0) return;
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
                    cell.onclick = () => openModal(cat.category, q, cell);
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
            if (!e.target.classList.contains('player-name-input') && 
                !e.target.classList.contains('delete-player-btn') && 
                !e.target.classList.contains('player-score') &&
                !e.target.classList.contains('player-avatar')) {
                activePlayerIndex = index;
                renderPlayers();
            }
        };
        playersList.appendChild(card);
    });
}

function changeAvatar(id) {
    const p = players.find(player => player.id === id);
    if (p) {
        p.avatarSeed = Math.random().toString(36).substring(7);
        renderPlayers();
    }
}

function editScore(id) {
    const p = players.find(player => player.id === id);
    const newScore = prompt(`Счет для ${p.name}:`, p.score);
    if (newScore !== null && !isNaN(newScore)) { p.score = parseInt(newScore); renderPlayers(); }
}
function updatePlayerName(id, val) { const p = players.find(player => player.id === id); if (p) p.name = val; renderPlayers(); }
function addPlayer() { players.push({ id: Date.now(), name: `Игрок ${players.length + 1}`, score: 0, avatarSeed: Date.now() }); renderPlayers(); }
function removePlayer(id) { if (confirm('Удалить?')) { players = players.filter(p => p.id !== id); if (activePlayerIndex >= players.length) activePlayerIndex = 0; renderPlayers(); } }

// --- Модальное окно ---
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
    if (isCorrect) {
        player.score += currentQuestion.p;
        activePlayerIndex = answeringPlayerIndex;
        playSound('correct'); 
        fireConfetti();
        finishQuestion();
    } else {
        player.score -= currentQuestion.p;
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

function renderEditor() {
    editorContent.innerHTML = '';
    if (!gameData) return;
    gameData.forEach((cat, catIdx) => {
        const group = document.createElement('div');
        group.className = 'edit-group';
        group.innerHTML = `<label class="edit-label">Тема</label><input class="edit-input" style="font-weight:bold; font-size:1.1em;" value="${cat.category}" onchange="updateData(${catIdx}, null, 'cat', this.value)"><div style="margin: 10px 0; border-bottom: 2px solid #ddd;"></div>`;
        cat.questions.forEach((q, qIdx) => {
             const row = document.createElement('div');
             row.className = 'edit-row';
             row.innerHTML = `<div style="display:flex; gap:10px;"><input class="edit-input" style="width:60px; font-weight:bold;" placeholder="Цена" value="${q.p}" onchange="updateData(${catIdx}, ${qIdx}, 'p', this.value)"><input class="edit-input" placeholder="Вопрос" value="${q.q}" onchange="updateData(${catIdx}, ${qIdx}, 'q', this.value)"></div><input class="edit-input" placeholder="Ответ" value="${q.a}" style="background:#f9fff9;" onchange="updateData(${catIdx}, ${qIdx}, 'a', this.value)">`;
             group.appendChild(row);
        });
        const delBtn = document.createElement('button');
        delBtn.className = 'delete-cat-btn';
        delBtn.textContent = 'Удалить тему';
        delBtn.onclick = () => deleteCategory(catIdx);
        group.appendChild(delBtn);
        editorContent.appendChild(group);
    });
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-secondary full-width';
    addBtn.textContent = '+ Добавить тему';
    addBtn.onclick = addCategory;
    editorContent.appendChild(addBtn);
}

function updateData(catIdx, qIdx, type, val) { if (type === 'cat') gameData[catIdx].category = val; else { if (type === 'p') val = parseInt(val) || 0; gameData[catIdx].questions[qIdx][type] = val; } }
function addCategory() { gameData.push({ category: "Новая тема", questions: [100, 200, 300, 400, 500].map(p => ({ p, q: "", a: "" })) }); renderEditor(); }
function deleteCategory(idx) { if(confirm('Удалить?')) { gameData.splice(idx, 1); renderEditor(); } }
function saveAndRefresh() { renderBoard(); toggleSidebar(); }
function resetToDefault() { if(confirm('Сбросить?')) { location.reload(); } }

initGame();