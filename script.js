// --- Глобальные переменные и Состояние ---
let gameRounds = [
    // Дефолтный раунд-заглушка, если файл не загрузится
    [{ 
        category: "Загрузка...", 
        questions: [100, 200, 300, 400, 500].map(p => ({ p, q: "Нет файла questions.txt", a: "..." })) 
    }]
];
let currentRoundIndex = 0;
let gameData = gameRounds[currentRoundIndex];

let players = [
    { id: 1, name: "Игрок 1", score: 0, avatarSeed: Date.now() }, 
    { id: 2, name: "Игрок 2", score: 0, avatarSeed: Date.now() + 1 }
];

let activePlayerIndex = 0;
let answeringPlayerIndex = 0;
let currentQuestion = null;
let currentElement = null;

// --- АУДИО СИСТЕМА (АВТОМАТИЧЕСКАЯ) ---
// Браузер сам найдет файлы в папке sounds рядом с index.html
const audioLibrary = {
    thinking: new Audio('sounds/thinking.mp3'),
    correct: new Audio('sounds/correct.mp3'),
    wrong: new Audio('sounds/wrong.mp3'),
    intro: new Audio('sounds/intro.mp3')
};

// Музыка "Думает" должна играть по кругу
audioLibrary.thinking.loop = true;

function playSound(type) {
    const sound = audioLibrary[type];
    if (sound) {
        sound.currentTime = 0;
        // catch нужен, чтобы не было ошибки, если пользователь еще не кликнул по сайту
        sound.play().catch(e => console.log("Браузер блокирует авто-звук до первого клика:", e));
    }
}

function stopSound(type) {
    const sound = audioLibrary[type];
    if (sound) {
        sound.pause();
        sound.currentTime = 0;
    }
}

// --- DOM Элементы ---
const board = document.getElementById('game-board');
const playersList = document.getElementById('players-list');
const modal = document.getElementById('modal');
const sidebar = document.getElementById('sidebar');
const editorContent = document.getElementById('editor-content');
const roundTabsContainer = document.getElementById('round-tabs');

// --- Инициализация (Старт) ---
function initGame() {
    // Пытаемся автоматически скачать questions.txt (работает на GitHub/Сервере)
    fetch('questions.txt')
        .then(response => {
            if (!response.ok) {
                throw new Error("Файл questions.txt не найден");
            }
            return response.text();
        })
        .then(text => {
            console.log("questions.txt успешно загружен!");
            parseTxtToGame(text, true); // true = без всплывающего окна
        })
        .catch(error => {
            console.log("Автозагрузка не сработала (локальный запуск или нет файла):", error);
            // Если не вышло загрузить, рисуем то, что есть (пустую игру)
            renderAll();
        });
}

function renderAll() {
    renderRoundTabs();
    renderBoard();
    renderPlayers();
    renderEditor();
}

// --- Логика Раундов ---
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
    renderAll();
}

// --- Парсинг и Файлы ---

// Ручная загрузка через кнопку (резервный вариант)
function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) { parseTxtToGame(e.target.result); };
    reader.readAsText(file);
    input.value = '';
}

// Главная функция: Превращает Текст в Игру
function parseTxtToGame(text, silent = false) {
    const lines = text.split('\n');
    const newRounds = [];
    let currentRoundData = [];
    let currentCategory = null;
    let currentQuestion = null;

    // Регулярные выражения
    const themeRegex = /^Тема\s*\d*\.?\s*(.+)/i;   // "Тема 1. Название"
    const questionRegex = /^(\d+)\.\s*(.+)/;       // "100. Текст вопроса"
    const answerRegex = /^Ответ:\s*(.+)/i;         // "Ответ: Текст"
    const roundSeparatorRegex = /^(\d+)$/;         // Просто цифра "1" или "2" на строке

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

        // 1. Новый раунд
        const roundMatch = line.match(roundSeparatorRegex);
        if (roundMatch && line.length < 3) { 
            pushRound(); 
            return; 
        }

        // 2. Новая тема
        const themeMatch = line.match(themeRegex);
        if (themeMatch) {
            currentCategory = { category: themeMatch[1].trim(), questions: [] };
            currentRoundData.push(currentCategory);
            return;
        }

        // 3. Вопрос
        const qMatch = line.match(questionRegex);
        if (qMatch && currentCategory) {
            currentQuestion = { 
                p: parseInt(qMatch[1]), 
                q: qMatch[2].trim(), 
                a: "Ответ не указан", 
                answered: false 
            };
            currentCategory.questions.push(currentQuestion);
            return;
        }

        // 4. Ответ
        const aMatch = line.match(answerRegex);
        if (aMatch && currentQuestion) {
            currentQuestion.a = aMatch[1].trim();
        }
    });

    pushRound(); // Сохраняем последний раунд

    if (newRounds.length > 0) {
        gameRounds = newRounds;
        // Сбрасываем на первый раунд
        switchRound(0); 
        
        if (!silent) {
            alert(`Загружено раундов: ${gameRounds.length}`);
            toggleSidebar();
        }
    } else if (!silent) {
        alert("Ошибка! Не удалось найти вопросы в файле.");
    }
}

function downloadGameData() {
    let textContent = "Вопросики (Экспорт)\n\n";
    gameRounds.forEach((roundData, rIndex) => {
        textContent += `${rIndex + 1}\n\n`; // Номер раунда
        roundData.forEach((cat, cIndex) => {
            textContent += `Тема ${cIndex + 1}. ${cat.category}\n\n`;
            cat.questions.forEach(q => { 
                textContent += `${q.p}. ${q.q}\nОтвет: ${q.a}\n`; 
            });
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

// --- Отрисовка Игрового Поля ---
function renderBoard() {
    board.innerHTML = '';
    
    if (!gameData || gameData.length === 0) {
        board.innerHTML = '<div style="color:white; margin:auto;">Нет вопросов</div>';
        return;
    }

    gameData.forEach(cat => {
        // Ячейка категории
        const catCell = document.createElement('div');
        catCell.className = 'cell category';
        catCell.textContent = cat.category;
        board.appendChild(catCell);

        // Ячейки вопросов (всегда 5 штук в ряд)
        for (let i = 0; i < 5; i++) {
            if (cat.questions[i]) {
                const q = cat.questions[i];
                const cell = document.createElement('div');
                cell.className = 'cell question';
                
                if (q.answered) {
                    cell.classList.add('disabled');
                    cell.textContent = ''; 
                } else {
                    cell.textContent = q.p;
                    cell.onclick = () => openModal(cat.category, q, cell);
                }
                board.appendChild(cell);
            } else {
                // Пустая ячейка, если вопросов меньше 5
                const empty = document.createElement('div');
                empty.className = 'cell disabled';
                board.appendChild(empty);
            }
        }
    });
}

// --- Отрисовка Игроков ---
function renderPlayers() {
    playersList.innerHTML = '';
    players.forEach((player, index) => {
        const isActive = (index === activePlayerIndex);
        const card = document.createElement('div');
        card.className = `player-card ${isActive ? 'active-turn' : ''}`;
        
        // Генерация аватара (используем seed для смены)
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

        // Клик по карточке передает ход (но не при клике на инпуты/кнопки)
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

// Смена аватара
function changeAvatar(id) {
    const p = players.find(player => player.id === id);
    if (p) {
        p.avatarSeed = Math.random().toString(36).substring(7); // Случайная строка
        renderPlayers();
    }
}

// Редактирование счета
function editScore(id) {
    const p = players.find(player => player.id === id);
    const newScore = prompt(`Введите счет для ${p.name}:`, p.score);
    if (newScore !== null && !isNaN(newScore)) {
        p.score = parseInt(newScore);
        renderPlayers();
    }
}

function updatePlayerName(id, val) {
    const p = players.find(player => player.id === id);
    if (p) p.name = val;
    renderPlayers(); // Не перерисовываем всё, чтобы фокус не слетел? Нет, лучше перерисовать для надежности
}

function addPlayer() {
    players.push({ id: Date.now(), name: `Игрок ${players.length + 1}`, score: 0, avatarSeed: Date.now() });
    renderPlayers();
}

function removePlayer(id) {
    if (confirm('Удалить игрока?')) {
        players = players.filter(p => p.id !== id);
        if (activePlayerIndex >= players.length) activePlayerIndex = 0;
        renderPlayers();
    }
}

// --- Модальное Окно (Вопрос) ---
function openModal(category, qObj, element) {
    currentQuestion = qObj;
    currentElement = element;
    answeringPlayerIndex = activePlayerIndex; // Отвечает тот, чей сейчас ход

    // Заполняем данные
    document.getElementById('modal-category').textContent = category;
    document.getElementById('modal-points').textContent = qObj.p;
    document.getElementById('question-text').textContent = qObj.q;
    document.getElementById('answer-text').textContent = qObj.a;

    // Сбрасываем интерфейс (скрываем ответ)
    document.getElementById('answer-container').classList.add('hidden');
    document.getElementById('scoring-controls').classList.add('hidden');
    document.getElementById('close-modal-btn').classList.add('hidden');
    document.getElementById('decision-controls').classList.remove('hidden');
    
    updateModalPlayerName();
    modal.classList.remove('hidden');

    playSound('thinking'); // Музыка
}

function updateModalPlayerName() {
    if(players.length > 0) {
        const name = players[answeringPlayerIndex].name;
        document.getElementById('modal-player-name-decision').textContent = name;
        document.getElementById('modal-player-name-scoring').textContent = name;
    }
}

// Кнопка "Ответить"
function revealAnswer() {
    stopSound('thinking'); // Останавливаем музыку
    document.getElementById('decision-controls').classList.add('hidden');
    document.getElementById('answer-container').classList.remove('hidden');
    document.getElementById('scoring-controls').classList.remove('hidden');
}

// Кнопка "Пас"
function handlePass() {
    // Передаем ход следующему
    answeringPlayerIndex = (answeringPlayerIndex + 1) % players.length;
    // Показываем кнопку закрытия на всякий случай
    document.getElementById('close-modal-btn').classList.remove('hidden');
    updateModalPlayerName();
}

// Кнопки "Верно" / "Неверно"
function handleScore(isCorrect) {
    if (!players.length) return;
    const player = players[answeringPlayerIndex];

    if (isCorrect) {
        player.score += currentQuestion.p;
        activePlayerIndex = answeringPlayerIndex; // Право хода победителю
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
    renderPlayers(); // Обновляем счет
    closeModal();
}

function closeModal() {
    stopSound('thinking');
    modal.classList.add('hidden');
    
    // Если закрыли окно, вопрос считается сыгранным
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

// --- Сайдбар (Редактор) ---
function toggleSidebar() { sidebar.classList.toggle('open'); }

function renderEditor() {
    editorContent.innerHTML = '';
    if (!gameData) return;

    gameData.forEach((cat, catIdx) => {
        const group = document.createElement('div');
        group.className = 'edit-group';
        group.innerHTML = `
            <label class="edit-label">Тема</label>
            <input class="edit-input" style="font-weight:bold; font-size:1.1em;" value="${cat.category}" onchange="updateData(${catIdx}, null, 'cat', this.value)">
            <div style="margin: 10px 0; border-bottom: 2px solid #ddd;"></div>
        `;
        
        cat.questions.forEach((q, qIdx) => {
             const row = document.createElement('div');
             row.className = 'edit-row';
             row.innerHTML = `
                <div style="display:flex; gap:10px;">
                    <input class="edit-input" style="width:60px; font-weight:bold;" placeholder="Цена" value="${q.p}" onchange="updateData(${catIdx}, ${qIdx}, 'p', this.value)">
                    <input class="edit-input" placeholder="Вопрос" value="${q.q}" onchange="updateData(${catIdx}, ${qIdx}, 'q', this.value)">
                </div>
                <input class="edit-input" placeholder="Ответ" value="${q.a}" style="background:#f9fff9;" onchange="updateData(${catIdx}, ${qIdx}, 'a', this.value)">
             `;
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

function updateData(catIdx, qIdx, type, val) {
    if (type === 'cat') gameData[catIdx].category = val;
    else {
        if (type === 'p') val = parseInt(val) || 0;
        gameData[catIdx].questions[qIdx][type] = val;
    }
}

function addCategory() {
    gameData.push({ category: "Новая тема", questions: [100, 200, 300, 400, 500].map(p => ({ p, q: "", a: "" })) });
    renderEditor();
}

function deleteCategory(idx) {
    if(confirm('Удалить тему?')) {
        gameData.splice(idx, 1);
        renderEditor();
    }
}

function saveAndRefresh() { renderBoard(); toggleSidebar(); }
function resetToDefault() { if(confirm('Сбросить игру?')) { location.reload(); } }

// ЗАПУСК
initGame();
