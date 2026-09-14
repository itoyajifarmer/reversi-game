const SIZE = 8;
const EMPTY = 0;
const BLACK = 1;
const WHITE = -1;

const DIRECTIONS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

const POSITION_WEIGHTS = [
  [120, -28, 18, 8, 8, 18, -28, 120],
  [-28, -52, -6, -6, -6, -6, -52, -28],
  [18, -6, 10, 4, 4, 10, -6, 18],
  [8, -6, 4, 2, 2, 4, -6, 8],
  [8, -6, 4, 2, 2, 4, -6, 8],
  [18, -6, 10, 4, 4, 10, -6, 18],
  [-28, -52, -6, -6, -6, -6, -52, -28],
  [120, -28, 18, 8, 8, 18, -28, 120],
];

const state = {
  board: createInitialBoard(),
  current: BLACK,
  mode: "cpu",
  difficulty: "normal",
  showHints: true,
  gameOver: false,
  locked: false,
  message: "黒の番です。",
  history: [],
  cpuTimer: null,
};

const boardElement = document.querySelector("#board");
const statusElement = document.querySelector("#status");
const blackScoreElement = document.querySelector("#black-score");
const whiteScoreElement = document.querySelector("#white-score");
const modeInputs = [...document.querySelectorAll("input[name='mode']")];
const difficultyElement = document.querySelector("#difficulty");
const cpuSection = document.querySelector("#cpu-section");
const showHintsElement = document.querySelector("#show-hints");
const newGameButton = document.querySelector("#new-game");
const undoButton = document.querySelector("#undo");

function createInitialBoard() {
  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
  board[3][3] = WHITE;
  board[3][4] = BLACK;
  board[4][3] = BLACK;
  board[4][4] = WHITE;
  return board;
}

function copyBoard(board) {
  return board.map((row) => [...row]);
}

function isInside(row, col) {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

function playerName(player) {
  return player === BLACK ? "黒" : "白";
}

function discClass(player) {
  return player === BLACK ? "black" : "white";
}

function getFlips(board, row, col, player) {
  if (!isInside(row, col) || board[row][col] !== EMPTY) {
    return [];
  }

  const opponent = -player;
  const flips = [];

  for (const [rowStep, colStep] of DIRECTIONS) {
    const line = [];
    let nextRow = row + rowStep;
    let nextCol = col + colStep;

    while (isInside(nextRow, nextCol) && board[nextRow][nextCol] === opponent) {
      line.push([nextRow, nextCol]);
      nextRow += rowStep;
      nextCol += colStep;
    }

    if (line.length > 0 && isInside(nextRow, nextCol) && board[nextRow][nextCol] === player) {
      flips.push(...line);
    }
  }

  return flips;
}

function getValidMoves(board, player) {
  const moves = [];

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const flips = getFlips(board, row, col, player);
      if (flips.length > 0) {
        moves.push({ row, col, flips });
      }
    }
  }

  return moves;
}

function countDiscs(board) {
  return board.flat().reduce(
    (scores, cell) => {
      if (cell === BLACK) {
        scores.black += 1;
      }
      if (cell === WHITE) {
        scores.white += 1;
      }
      return scores;
    },
    { black: 0, white: 0 }
  );
}

function saveHistory() {
  state.history.push({
    board: copyBoard(state.board),
    current: state.current,
    gameOver: state.gameOver,
    message: state.message,
  });
}

function restoreSnapshot(snapshot) {
  state.board = copyBoard(snapshot.board);
  state.current = snapshot.current;
  state.gameOver = snapshot.gameOver;
  state.message = snapshot.message;
  state.locked = false;
  clearCpuTimer();
  render();
  maybeRunCpu();
}

function applyMove(move, player) {
  state.board[move.row][move.col] = player;
  for (const [row, col] of move.flips) {
    state.board[row][col] = player;
  }
}

function playMove(row, col) {
  if (state.gameOver || state.locked) {
    return;
  }
  if (state.mode === "cpu" && state.current === WHITE) {
    return;
  }

  const move = getValidMoves(state.board, state.current).find(
    (candidate) => candidate.row === row && candidate.col === col
  );
  if (!move) {
    return;
  }

  saveHistory();
  applyMove(move, state.current);
  state.current *= -1;
  settleTurn(`${playerName(-state.current)}が置きました。`);
  render();
  maybeRunCpu();
}

function settleTurn(prefix = "") {
  const currentMoves = getValidMoves(state.board, state.current);
  const opponentMoves = getValidMoves(state.board, -state.current);

  if (currentMoves.length > 0) {
    state.message = `${prefix}${playerName(state.current)}の番です。`;
    return;
  }

  if (opponentMoves.length > 0) {
    const skippedPlayer = state.current;
    state.current *= -1;
    state.message = `${prefix}${playerName(skippedPlayer)}は置ける場所がないためパスです。${playerName(state.current)}の番です。`;
    return;
  }

  state.gameOver = true;
  const scores = countDiscs(state.board);
  if (scores.black === scores.white) {
    state.message = `ゲーム終了。引き分けです。${scores.black}対${scores.white}`;
  } else {
    const winner = scores.black > scores.white ? "黒" : "白";
    state.message = `ゲーム終了。${winner}の勝ちです。${scores.black}対${scores.white}`;
  }
}

function legalMoveKey(move) {
  return `${move.row}-${move.col}`;
}

function render() {
  const scores = countDiscs(state.board);
  const legalMoves = getValidMoves(state.board, state.current);
  const legalKeys = new Set(legalMoves.map(legalMoveKey));
  const humanTurn = state.mode === "two" || state.current === BLACK;

  blackScoreElement.textContent = scores.black;
  whiteScoreElement.textContent = scores.white;
  statusElement.textContent = state.message;
  undoButton.disabled = state.history.length === 0 || state.locked;
  difficultyElement.disabled = state.mode !== "cpu";
  cpuSection.classList.toggle("is-disabled", state.mode !== "cpu");

  boardElement.replaceChildren();

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const cellValue = state.board[row][col];
      const cell = document.createElement("button");
      const isLegal = legalKeys.has(`${row}-${col}`);
      const label = `${row + 1}行${col + 1}列`;

      cell.type = "button";
      cell.className = "cell";
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", cellValue === EMPTY ? `${label} 空き` : `${label} ${playerName(cellValue)}`);

      if (cellValue !== EMPTY) {
        const disc = document.createElement("span");
        disc.className = `disc ${discClass(cellValue)}`;
        cell.appendChild(disc);
      }

      if (!state.gameOver && humanTurn && state.showHints && isLegal) {
        cell.classList.add("legal");
      }

      cell.disabled = state.gameOver || state.locked || !humanTurn || !isLegal;
      cell.addEventListener("click", () => playMove(row, col));
      boardElement.appendChild(cell);
    }
  }
}

function chooseCpuMove(moves) {
  if (state.difficulty === "easy") {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const scoredMoves = moves.map((move) => {
    const nextBoard = copyBoard(state.board);
    applyMoveOnBoard(nextBoard, move, WHITE);
    return {
      move,
      score: scoreMove(nextBoard, move),
    };
  });

  scoredMoves.sort((a, b) => b.score - a.score);

  if (state.difficulty === "normal") {
    const topMoves = scoredMoves.slice(0, Math.min(3, scoredMoves.length));
    return topMoves[Math.floor(Math.random() * topMoves.length)].move;
  }

  return scoredMoves[0].move;
}

function applyMoveOnBoard(board, move, player) {
  board[move.row][move.col] = player;
  for (const [row, col] of move.flips) {
    board[row][col] = player;
  }
}

function scoreMove(board, move) {
  const scores = countDiscs(board);
  const mobility = getValidMoves(board, WHITE).length - getValidMoves(board, BLACK).length;
  const positionScore = POSITION_WEIGHTS[move.row][move.col];
  const flipScore = move.flips.length * 7;
  const pieceBalance = scores.white - scores.black;
  return positionScore + flipScore + mobility * 4 + pieceBalance;
}

function maybeRunCpu() {
  clearCpuTimer();
  if (state.gameOver || state.mode !== "cpu" || state.current !== WHITE) {
    return;
  }

  const moves = getValidMoves(state.board, WHITE);
  if (moves.length === 0) {
    settleTurn();
    render();
    return;
  }

  state.locked = true;
  state.message = "白が考えています。";
  render();

  state.cpuTimer = window.setTimeout(() => {
    const move = chooseCpuMove(moves);
    saveHistory();
    applyMove(move, WHITE);
    state.current = BLACK;
    state.locked = false;
    settleTurn("白が置きました。");
    render();
    maybeRunCpu();
  }, 480);
}

function clearCpuTimer() {
  if (state.cpuTimer) {
    window.clearTimeout(state.cpuTimer);
    state.cpuTimer = null;
  }
}

function resetGame() {
  clearCpuTimer();
  state.board = createInitialBoard();
  state.current = BLACK;
  state.gameOver = false;
  state.locked = false;
  state.message = "黒の番です。";
  state.history = [];
  render();
}

function undoMove() {
  if (state.locked || state.history.length === 0) {
    return;
  }

  const steps = state.mode === "cpu" ? Math.min(2, state.history.length) : 1;
  let snapshot = null;

  for (let index = 0; index < steps; index += 1) {
    snapshot = state.history.pop();
  }

  if (snapshot) {
    restoreSnapshot(snapshot);
  }
}

modeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    state.mode = input.value;
    resetGame();
  });
});

difficultyElement.addEventListener("change", () => {
  state.difficulty = difficultyElement.value;
});

showHintsElement.addEventListener("change", () => {
  state.showHints = showHintsElement.checked;
  render();
});

newGameButton.addEventListener("click", resetGame);
undoButton.addEventListener("click", undoMove);

render();
