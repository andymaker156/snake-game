(function () {
  const { createInitialState, setDirection, step, togglePause } = window.SnakeLogic;
  const DEFAULT_TICK_MS = 140;
  const STORAGE_KEYS = {
    best: 'snake-best-score',
    theme: 'snake-theme',
    grid: 'snake-grid-size',
    sound: 'snake-sound-enabled',
    history: 'snake-score-history',
    games: 'snake-games-played',
    wins: 'snake-games-won'
  };

  const board = document.getElementById('board');
  const score = document.getElementById('score');
  const bestScore = document.getElementById('best-score');
  const comboEl = document.getElementById('combo');
  const status = document.getElementById('status');
  const restartButton = document.getElementById('restart-button');
  const pauseButton = document.getElementById('pause-button');
  const speedSelect = document.getElementById('speed-select');
  const wrapToggle = document.getElementById('wrap-toggle');
  const gridSelect = document.getElementById('grid-select');
  const themeToggle = document.getElementById('theme-toggle');
  const soundToggle = document.getElementById('sound-toggle');
  const historyList = document.getElementById('score-history');
  const historyGamesPlayed = document.getElementById('history-games-played');
  const historyWins = document.getElementById('history-wins');
  const historyAverage = document.getElementById('history-average');
  const controlButtons = Array.from(document.querySelectorAll('[data-direction]'));

  let tickMs = DEFAULT_TICK_MS;
  let storedBestScore = loadBestScore();
  let gridSize = loadGridSize();
  let scoreHistory = loadScoreHistory();
  let totalGamesPlayed = loadGamesPlayed();
  let totalWins = loadWins();
  let cellGrid = null;
  let cachedW = 0;
  let cachedH = 0;
  let combo = 0;
  let comboTimer = null;
  let audioCtx = null;

  let state = createInitialState({ wrapWalls: wrapToggle.checked, width: gridSize, height: gridSize });
  let timerId = null;

  function loadBestScore() {
    const raw = window.localStorage.getItem(STORAGE_KEYS.best);
    const value = Number.parseInt(raw || '0', 10);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }

  function saveBestScore(nextBestScore) {
    storedBestScore = nextBestScore;
    window.localStorage.setItem(STORAGE_KEYS.best, String(nextBestScore));
  }

  function loadScoreHistory() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.history);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveScoreHistory(history) {
    scoreHistory = history;
    window.localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
  }

  function loadGamesPlayed() {
    const raw = window.localStorage.getItem(STORAGE_KEYS.games);
    const value = Number.parseInt(raw || '0', 10);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }

  function saveGamesPlayed(value) {
    totalGamesPlayed = value;
    window.localStorage.setItem(STORAGE_KEYS.games, String(value));
  }

  function loadWins() {
    const raw = window.localStorage.getItem(STORAGE_KEYS.wins);
    const value = Number.parseInt(raw || '0', 10);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }

  function saveWins(value) {
    totalWins = value;
    window.localStorage.setItem(STORAGE_KEYS.wins, String(value));
  }

  function addScoreToHistory(scoreValue, width, didWin) {
    const entry = {
      score: scoreValue,
      width,
      result: didWin ? 'Win' : 'Game over',
      date: new Date().toISOString()
    };
    const nextHistory = [entry, ...scoreHistory].slice(0, 5);
    saveScoreHistory(nextHistory);
    if (didWin) {
      saveWins(totalWins + 1);
    }
    saveGamesPlayed(totalGamesPlayed + 1);
    renderHistory();
  }

  function loadGridSize() {
    const raw = window.localStorage.getItem(STORAGE_KEYS.grid);
    const value = Number.parseInt(raw || '16', 10);
    if (value === 12 || value === 16 || value === 20) {
      return value;
    }
    return 16;
  }

  function loadSoundEnabled() {
    return window.localStorage.getItem(STORAGE_KEYS.sound) === '1';
  }

  function saveSoundEnabled(on) {
    window.localStorage.setItem(STORAGE_KEYS.sound, on ? '1' : '0');
  }

  function loadTheme() {
    return window.localStorage.getItem(STORAGE_KEYS.theme) === 'dark' ? 'dark' : 'light';
  }

  function saveTheme(mode) {
    window.localStorage.setItem(STORAGE_KEYS.theme, mode);
  }

  function applyTheme(mode) {
    document.documentElement.dataset.theme = mode === 'dark' ? 'dark' : 'light';
    if (themeToggle) {
      themeToggle.checked = mode === 'dark';
    }
  }

  function getAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
  }

  function playTone(freq, duration, type = 'square', gain = 0.06) {
    if (!soundToggle || !soundToggle.checked) {
      return;
    }
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  function playEat() {
    playTone(520, 0.06, 'square', 0.05);
  }

  function playBonus() {
    playTone(880, 0.08, 'square', 0.07);
    window.setTimeout(() => playTone(1100, 0.06, 'square', 0.05), 40);
  }

  function playGameOver() {
    playTone(180, 0.25, 'sawtooth', 0.06);
  }

  function playWin() {
    playTone(660, 0.1, 'square', 0.05);
    window.setTimeout(() => playTone(880, 0.12, 'square', 0.05), 90);
  }

  function syncBestScore() {
    if (state.score > storedBestScore) {
      saveBestScore(state.score);
    }

    bestScore.textContent = String(storedBestScore);
  }

  function updateCombo(grew) {
    if (!grew) {
      return;
    }
    const now = Date.now();
    if (comboTimer !== null && now - comboTimer < 450) {
      combo = Math.min(combo + 1, 99);
    } else {
      combo = 1;
    }
    comboTimer = now;
    if (comboEl) {
      comboEl.textContent = combo > 1 ? `×${combo}` : '—';
    }
  }

  function resetComboDisplay() {
    combo = 0;
    comboTimer = null;
    if (comboEl) {
      comboEl.textContent = '—';
    }
  }

  function ensureBoardBuilt() {
    if (cellGrid && cachedW === state.width && cachedH === state.height) {
      return;
    }

    board.innerHTML = '';
    board.style.gridTemplateColumns = `repeat(${state.width}, minmax(0, 1fr))`;
    cellGrid = [];
    for (let y = 0; y < state.height; y += 1) {
      cellGrid[y] = [];
      for (let x = 0; x < state.width; x += 1) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cellGrid[y][x] = cell;
        board.appendChild(cell);
      }
    }
    cachedW = state.width;
    cachedH = state.height;
  }

  function renderHistorySummary() {
    if (historyGamesPlayed) {
      historyGamesPlayed.textContent = String(totalGamesPlayed);
    }
    if (historyWins) {
      historyWins.textContent = String(totalWins);
    }
    if (historyAverage) {
      const average = scoreHistory.length > 0
        ? Math.round(scoreHistory.reduce((sum, entry) => sum + entry.score, 0) / scoreHistory.length)
        : 0;
      historyAverage.textContent = String(average);
    }
  }

  function renderHistory() {
    if (!historyList) {
      renderHistorySummary();
      return;
    }

    historyList.innerHTML = '';
    if (scoreHistory.length === 0) {
      const item = document.createElement('li');
      item.className = 'history-empty';
      item.textContent = 'No completed games yet. Play and score to populate history.';
      historyList.appendChild(item);
      renderHistorySummary();
      return;
    }

    scoreHistory.forEach((entry) => {
      const item = document.createElement('li');
      item.className = 'history-item';
      const date = new Date(entry.date);
      item.innerHTML = `
        <span class="history-result">${entry.result}</span>
        <span class="history-score">${entry.score} pts</span>
        <span class="history-extra">${entry.width}×${entry.width}</span>
        <span class="history-date">${date.toLocaleDateString()} ${date.toLocaleTimeString()}</span>
      `;
      historyList.appendChild(item);
    });
    renderHistorySummary();
  }

  function render() {
    ensureBoardBuilt();

    const snakeMap = new Map(
      state.snake.map((segment, index) => [`${segment.x},${segment.y}`, index])
    );
    const snakeLen = state.snake.length;

    for (let y = 0; y < state.height; y += 1) {
      for (let x = 0; x < state.width; x += 1) {
        const cell = cellGrid[y][x];
        const key = `${x},${y}`;
        cell.className = 'cell';

        if (state.food && state.food.x === x && state.food.y === y) {
          cell.classList.add('food');
          if (state.food.bonus) {
            cell.classList.add('food-bonus');
          }
        }

        if (snakeMap.has(key)) {
          const idx = snakeMap.get(key);
          cell.classList.add('snake');
          if (idx === 0) {
            cell.classList.add('head');
          } else if (idx === snakeLen - 1) {
            cell.classList.add('tail');
          } else {
            cell.classList.add('body');
          }
        }
      }
    }

    score.textContent = String(state.score);
    syncBestScore();

    if (state.didWin) {
      status.textContent = 'You filled the whole board. Nice run.';
    } else if (state.isGameOver) {
      status.textContent = 'Game over. Restart to play again.';
    } else if (!state.isStarted) {
      status.textContent = state.wrapWalls
        ? 'Press any arrow key or WASD to start. Wrap mode is on.'
        : 'Press any arrow key or WASD to start.';
    } else if (state.isPaused) {
      status.textContent = 'Paused.';
    } else {
      status.textContent = state.wrapWalls
        ? 'Wrap mode on. Golden cells are +5. Chain quick eats for combo.'
        : 'Golden cells are +5. Chain quick eats for combo.';
    }

    pauseButton.textContent = state.isPaused ? 'Resume' : 'Pause';
    pauseButton.disabled = state.isGameOver || !state.isStarted;
    speedSelect.value = String(tickMs);
    wrapToggle.checked = state.wrapWalls;
    if (gridSelect) {
      gridSelect.value = String(state.width);
    }
  }

  let gameOverRecorded = false;

  function afterStep(prevScore) {
    const grew = state.score > prevScore;
    if (grew) {
      updateCombo(true);
      if (state.lastAteBonus) {
        playBonus();
      } else {
        playEat();
      }
    }

    if (state.isGameOver) {
      if (!gameOverRecorded) {
        addScoreToHistory(state.score, state.width, state.didWin);
        gameOverRecorded = true;
      }
      if (state.didWin) {
        playWin();
      } else {
        playGameOver();
      }
    }
  }

  function startLoop() {
    stopLoop();
    timerId = window.setInterval(() => {
      const prevScore = state.score;
      state = step(state);
      afterStep(prevScore);
      render();

      if (state.isGameOver) {
        stopLoop();
      }
    }, tickMs);
  }

  function stopLoop() {
    if (timerId !== null) {
      window.clearInterval(timerId);
      timerId = null;
    }
  }

  function updateDirection(direction) {
    const nextState = setDirection(state, direction);
    const shouldStart = !state.isStarted && nextState.isStarted;

    state = nextState;
    render();

    if (shouldStart) {
      startLoop();
    }
  }

  function restart() {
    state = createInitialState({
      wrapWalls: wrapToggle.checked,
      width: gridSize,
      height: gridSize
    });
    stopLoop();
    gameOverRecorded = false;
    resetComboDisplay();
    render();
  }

  function handlePause() {
    state = togglePause(state);
    render();
  }

  function handleSpeedChange() {
    tickMs = Number.parseInt(speedSelect.value, 10) || DEFAULT_TICK_MS;

    if (state.isStarted && !state.isGameOver) {
      startLoop();
    }
  }

  function handleWrapToggle() {
    const shouldExplainReset = state.isStarted || state.isPaused;
    state = createInitialState({
      wrapWalls: wrapToggle.checked,
      width: gridSize,
      height: gridSize
    });
    stopLoop();
    resetComboDisplay();
    render();

    if (shouldExplainReset) {
      status.textContent = 'Mode changed. Board reset for a fair run.';
    }
  }

  function handleGridChange() {
    gridSize = Number.parseInt(gridSelect.value, 10) || 16;
    window.localStorage.setItem(STORAGE_KEYS.grid, String(gridSize));
    state = createInitialState({
      wrapWalls: wrapToggle.checked,
      width: gridSize,
      height: gridSize
    });
    stopLoop();
    resetComboDisplay();
    cellGrid = null;
    cachedW = 0;
    cachedH = 0;
    render();
    status.textContent = 'Board size updated. Press arrows or WASD to start.';
  }

  document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    const directionByKey = {
      arrowup: 'up',
      w: 'up',
      arrowdown: 'down',
      s: 'down',
      arrowleft: 'left',
      a: 'left',
      arrowright: 'right',
      d: 'right'
    };

    if (key === ' ') {
      event.preventDefault();
      handlePause();
      return;
    }

    if (directionByKey[key]) {
      event.preventDefault();
      updateDirection(directionByKey[key]);
    }
  });

  restartButton.addEventListener('click', restart);
  pauseButton.addEventListener('click', handlePause);
  speedSelect.addEventListener('change', handleSpeedChange);
  wrapToggle.addEventListener('change', handleWrapToggle);
  if (gridSelect) {
    gridSelect.addEventListener('change', handleGridChange);
  }
  if (themeToggle) {
    themeToggle.addEventListener('change', () => {
      const mode = themeToggle.checked ? 'dark' : 'light';
      saveTheme(mode);
      applyTheme(mode);
    });
  }
  if (soundToggle) {
    soundToggle.checked = loadSoundEnabled();
    soundToggle.addEventListener('change', () => {
      saveSoundEnabled(soundToggle.checked);
      if (soundToggle.checked) {
        getAudioContext().resume();
        playEat();
      }
    });
  }

  controlButtons.forEach((button) => {
    button.addEventListener('click', () => updateDirection(button.dataset.direction));
  });

  applyTheme(loadTheme());
  if (gridSelect) {
    gridSelect.value = String(gridSize);
  }

  renderHistory();
  render();
})();
