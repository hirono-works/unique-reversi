const ROWS = 9;
const COLS = 9;

const P1 = 1; // 〇
const P2 = 2; // □
const P3 = 3; // ×

const SYMBOLS = {
    [P1]: '〇',
    [P2]: '□',
    [P3]: '×'
};

const NAMES = {
    [P1]: 'プレイヤー 1',
    [P2]: 'プレイヤー 2',
    [P3]: 'プレイヤー 3'
};

let board = [];
let currentPlayer = P3;
let passCount = 0;
let validMoves = [];
let isAnimating = false;
let historyStack = [];
let playerType = { [P1]: 'human', [P2]: 'human', [P3]: 'human' };

function isCPU(player) {
    return playerType[player] !== 'human';
}

const DIRS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
];

// DOM Elements
const boardEl = document.getElementById('board');
const turnText = document.getElementById('turn-text');
const turnIndicator = document.getElementById('turn-indicator');
const resetBtn = document.getElementById('reset-btn');

function initGame() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

    // Initial setup around center (4,4)
    board[3][3] = P2; board[3][4] = P3; board[3][5] = P1;
    board[4][3] = P3; board[4][4] = P1; board[4][5] = P2;
    board[5][3] = P1; board[5][4] = P2; board[5][5] = P3;

    currentPlayer = P1;
    passCount = 0;
    isAnimating = false;
    historyStack = [];
    const undoBtn = document.getElementById('undo-btn');
    if (undoBtn) undoBtn.disabled = true;

    setupColors();
    updateValidMoves();
    renderBoard();
    updateUI();
    hideModal();

    if (isCPU(currentPlayer)) {
        setTimeout(playCPUMove, 600);
    }
}

function setupColors() {
    const root = document.documentElement;
    [1, 2, 3].forEach(id => {
        const input = document.getElementById(`color-${id}`);
        root.style.setProperty(`--p${id}-color`, input.value);

        input.addEventListener('input', (e) => {
            root.style.setProperty(`--p${id}-color`, e.target.value);
            // Updating active turn color if needed
            updateTurnColor();
        });
    });
}

function updateTurnColor() {
    const colorVar = `var(--p${currentPlayer}-color)`;
    turnIndicator.style.boxShadow = `0 0 5px ${colorVar}`;
    turnIndicator.style.borderColor = colorVar;
    turnIndicator.style.color = colorVar;

    [1, 2, 3].forEach(id => {
        const card = document.getElementById(`card-${id}`);
        if (id === currentPlayer) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });
}

function renderBoard() {
    boardEl.innerHTML = '';

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.r = r;
            cell.dataset.c = c;

            const cellColorVar = `var(--p${currentPlayer}-color)`;

            // Check if valid move
            const isValid = validMoves.some(m => m.r === r && m.c === c);
            if (isValid) {
                cell.classList.add('valid-move');
                cell.style.color = cellColorVar;
            }

            // Add piece if exists
            const val = board[r][c];
            if (val !== 0) {
                const piece = document.createElement('div');
                piece.className = 'piece';
                piece.id = `piece-${r}-${c}`;
                piece.style.backgroundColor = `var(--p${val}-color)`;
                piece.innerText = SYMBOLS[val];
                cell.appendChild(piece);
            }

            cell.addEventListener('click', () => handleCellClick(r, c));
            boardEl.appendChild(cell);
        }
    }
}

function handleCellClick(r, c, isFromCPU = false) {
    if (isAnimating) return;
    if (isCPU(currentPlayer) && !isFromCPU) return;

    const isValid = validMoves.some(m => m.r === r && m.c === c);
    if (!isValid) return;

    isAnimating = true;
    saveState();
    const piecesToFlip = getPiecesToFlip(r, c, currentPlayer);

    // Place new piece
    board[r][c] = currentPlayer;
    const newCell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
    newCell.classList.remove('valid-move');

    const piece = document.createElement('div');
    piece.className = 'piece';
    piece.id = `piece-${r}-${c}`;
    piece.style.backgroundColor = `var(--p${currentPlayer}-color)`;
    piece.innerText = SYMBOLS[currentPlayer];
    newCell.appendChild(piece);

    // Flip other pieces
    piecesToFlip.forEach((p, index) => {
        board[p.r][p.c] = currentPlayer;
    });

    // Trigger animations
    animateFlipping(piecesToFlip, () => {
        nextTurn();
    });

    updateScore();
}

function animateFlipping(pieces, callback) {
    if (pieces.length === 0) {
        callback();
        return;
    }

    let completed = 0;
    pieces.forEach((p, i) => {
        setTimeout(() => {
            const pieceEl = document.getElementById(`piece-${p.r}-${p.c}`);
            if (pieceEl) {
                pieceEl.classList.add('flip');
                setTimeout(() => {
                    pieceEl.style.backgroundColor = `var(--p${currentPlayer}-color)`;
                    pieceEl.innerText = SYMBOLS[currentPlayer];
                }, 250); // halfway through the 0.5s animation

                setTimeout(() => {
                    pieceEl.classList.remove('flip');
                    completed++;
                    if (completed === pieces.length) {
                        callback();
                    }
                }, 500);
            } else {
                completed++;
                if (completed === pieces.length) {
                    callback();
                }
            }
        }, i * 100); // stagger animation
    });
}

function nextTurn() {
    passCount = 0;

    // Try to find next player with valid moves
    for (let i = 0; i < 3; i++) {
        currentPlayer = (currentPlayer % 3) + 1;
        updateValidMoves();

        if (validMoves.length > 0) {
            isAnimating = false;
            renderBoard();
            updateUI();
            
            if (isCPU(currentPlayer)) {
                setTimeout(playCPUMove, 600);
            }
            return;
        }
        passCount++;
    }

    // If we passed 3 times, game over
    if (passCount >= 3) {
        handleGameOver();
    }
}

function checkDirection(r, c, dr, dc, player) {
    let toFlip = [];
    let nr = r + dr;
    let nc = c + dc;

    while (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
        let val = board[nr][nc];
        if (val === 0) break; // empty space
        if (val === player) {
            return toFlip; // found anchor
        }
        // It's another player's piece
        toFlip.push({ r: nr, c: nc });
        nr += dr;
        nc += dc;
    }
    return []; // No anchor found
}

function getPiecesToFlip(r, c, player) {
    let allFlipped = [];
    for (let [dr, dc] of DIRS) {
        let flipped = checkDirection(r, c, dr, dc, player);
        allFlipped.push(...flipped);
    }
    return allFlipped;
}

function updateValidMoves() {
    validMoves = [];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c] === 0) {
                let toFlip = getPiecesToFlip(r, c, currentPlayer);
                if (toFlip.length > 0) {
                    validMoves.push({ r, c });
                }
            }
        }
    }
}

function updateUI() {
    turnText.innerText = `${NAMES[currentPlayer]} (${SYMBOLS[currentPlayer]}) の番です`;
    updateTurnColor();
    updateScore();
}

function updateScore() {
    let scores = { [P1]: 0, [P2]: 0, [P3]: 0 };
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c] !== 0) {
                scores[board[r][c]]++;
            }
        }
    }

    document.getElementById(`score-1`).innerText = scores[P1];
    document.getElementById(`score-2`).innerText = scores[P2];
    document.getElementById(`score-3`).innerText = scores[P3];

    return scores;
}

function handleGameOver() {
    isAnimating = true; // prevent further clicks
    const scores = updateScore();

    // Find winners
    let maxScore = -1;
    let winners = [];

    for (let p of [P1, P2, P3]) {
        if (scores[p] > maxScore) {
            maxScore = scores[p];
            winners = [p];
        } else if (scores[p] === maxScore) {
            winners.push(p);
        }
    }

    const modal = document.getElementById('result-modal');
    const title = document.getElementById('result-title');
    const details = document.getElementById('result-details');

    if (winners.length === 1) {
        title.innerText = `${NAMES[winners[0]]} の勝利！`;
        title.style.background = `linear-gradient(to right, var(--p${winners[0]}-color), #ffffff)`;
        title.style.webkitBackgroundClip = 'text';
    } else {
        title.innerText = '引き分け！';
        title.style.background = `linear-gradient(to right, #fbbf24, #f59e0b)`;
        title.style.webkitBackgroundClip = 'text';
    }

    details.innerHTML = '';

    // Sort players by score
    const sortedPlayers = [P1, P2, P3].sort((a, b) => scores[b] - scores[a]);

    sortedPlayers.forEach(p => {
        const row = document.createElement('div');
        row.className = 'result-row';
        if (winners.includes(p)) row.classList.add('winner');

        row.innerHTML = `
            <span style="color: var(--p${p}-color); font-weight: bold;">${NAMES[p]} (${SYMBOLS[p]})</span>
            <span>${scores[p]} 枚</span>
        `;
        details.appendChild(row);
    });

    modal.classList.remove('hidden');
}

function hideModal() {
    document.getElementById('result-modal').classList.add('hidden');
}

resetBtn.addEventListener('click', () => {
    if (confirm('ゲームをリセットしてもよろしいですか？')) {
        initGame();
    }
});

document.getElementById('modal-close-btn').addEventListener('click', initGame);

function saveState() {
    historyStack.push({
        board: JSON.parse(JSON.stringify(board)),
        currentPlayer: currentPlayer,
        passCount: passCount
    });
    const undoBtn = document.getElementById('undo-btn');
    if (undoBtn) undoBtn.disabled = false;
}

function undoMove() {
    if (historyStack.length === 0 || isAnimating) return;
    
    let prevState;
    do {
       prevState = historyStack.pop();
       board = prevState.board;
       currentPlayer = prevState.currentPlayer;
       passCount = prevState.passCount;
       validMoves = [];
    } while (isCPU(currentPlayer) && historyStack.length > 0);

    const undoBtn = document.getElementById('undo-btn');
    if (historyStack.length === 0 && undoBtn) {
        undoBtn.disabled = true;
    }

    updateValidMoves();
    renderBoard();
    updateUI();
    
    if (isCPU(currentPlayer)) {
        setTimeout(playCPUMove, 600);
    }
}

const undoBtn = document.getElementById('undo-btn');
if (undoBtn) {
    undoBtn.addEventListener('click', undoMove);
}

function playCPUMove() {
    const type = playerType[currentPlayer];
    if (type === 'human' || isAnimating || validMoves.length === 0) return;
    
    let bestMoves = [];
    let maxScore = -Infinity;
    
    const evalQuadrant = [
        [ 30, -20,   0,  -1,  -1],
        [-20, -40,  -3,  -3,  -3],
        [  0,  -3,   0,  -1,  -1],
        [ -1,  -3,  -1,  -1,  -1],
        [ -1,  -3,  -1,  -1,  -1]
    ];
    
    function getBoardScoreDelta(r, c) {
        if (type === 'cpu-weak') {
            return getPiecesToFlip(r, c, currentPlayer).length;
        } else if (type === 'cpu-medium') {
            let piecesToFlip = getPiecesToFlip(r, c, currentPlayer);
            let scoreDelta = 0;
            
            const getWeight = (row, col) => {
                let qr = row < 5 ? row : 8 - row;
                let qc = col < 5 ? col : 8 - col;
                return evalQuadrant[qr][qc];
            };
            
            scoreDelta += getWeight(r, c);
            for (let p of piecesToFlip) {
                scoreDelta += getWeight(p.r, p.c);
            }
            return scoreDelta;
        }
        return 0;
    }
    
    for (const move of validMoves) {
        const score = getBoardScoreDelta(move.r, move.c);
        if (score > maxScore) {
            maxScore = score;
            bestMoves = [move];
        } else if (score === maxScore) {
            bestMoves.push(move);
        }
    }
    
    const chosenMove = bestMoves[Math.floor(Math.random() * bestMoves.length)];
    handleCellClick(chosenMove.r, chosenMove.c, true);
}

[1, 2, 3].forEach(id => {
    const select = document.getElementById(`type-${id}`);
    if (select) {
        select.addEventListener('change', (e) => {
            playerType[id] = e.target.value;
            if (currentPlayer === id && isCPU(id) && !isAnimating) {
                setTimeout(playCPUMove, 300);
            }
        });
    }
});

// Start
initGame();
