(function () {
  const { createInitialState, setDirection, step, togglePause } = window.SnakeLogic;
  const DEFAULT_TICK_MS = 140;
  const MAX_HISTORY_ENTRIES = 5;
  const MAX_LEADERBOARD_ENTRIES = 50;
  const SPEED_BOOST_MULTIPLIER = 0.7;

  const STORAGE_KEYS = {
    best: 'snake-best-score',
    grid: 'snake-grid-size',
    speed: 'snake-speed',
    sound: 'snake-sound-enabled',
    history: 'snake-score-history',
    games: 'snake-games-played',
    wins: 'snake-games-won',
    difficulty: 'snake-difficulty',
    leaderboard: 'snake-leaderboard',
    playerName: 'snake-player-name'
  };

  const DIFFICULTY_PRESETS = {
    custom: { label: 'Classic', speed: DEFAULT_TICK_MS, gridSize: 16 },
    easy: { label: 'Easy', speed: 180, gridSize: 12 },
    normal: { label: 'Normal', speed: 140, gridSize: 16 },
    hard: { label: 'Hard', speed: 100, gridSize: 20 },
    insane: { label: 'Insane', speed: 70, gridSize: 20 }
  };

  const KEY_TO_DIRECTION = {
    arrowup: 'up',
    w: 'up',
    arrowdown: 'down',
    s: 'down',
    arrowleft: 'left',
    a: 'left',
    arrowright: 'right',
    d: 'right'
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
  const difficultySelect = document.getElementById('difficulty-select');
  const soundToggle = document.getElementById('sound-toggle');
  const historyList = document.getElementById('score-history');
  const historyGamesPlayed = document.getElementById('history-games-played');
  const historyWins = document.getElementById('history-wins');
  const historyAverage = document.getElementById('history-average');
  const leaderboardForm = document.getElementById('leaderboard-form');
  const leaderboardList = document.getElementById('leaderboard-list');
  const leaderboardFilter = document.getElementById('leaderboard-filter');
  const saveLeaderboardButton = document.getElementById('save-leaderboard-button');
  const playerNameInput = document.getElementById('player-name');
  const controlButtons = Array.from(document.querySelectorAll('[data-direction]'));

  let difficulty = loadDifficulty();
  let tickMs = loadSpeed();
  let gridSize = loadGridSize();
  let storedBestScore = loadBestScore();
  let scoreHistory = loadScoreHistory();
  let leaderboardEntries = loadLeaderboardEntries();
  let totalGamesPlayed = loadNumber(STORAGE_KEYS.games, 0);
  let totalWins = loadNumber(STORAGE_KEYS.wins, 0);
  let cellGrid = null;
  let cachedW = 0;
  let cachedH = 0;
  let combo = 0;
  let comboTimer = null;
  let audioCtx = null;
  let gameOverRecorded = false;
  let lastCompletedGame = null;
  let timerId = null;

  applyPresetIfNeeded();

  let state = createGameState();

  function loadBestScore() {
    const raw = window.localStorage.getItem(STORAGE_KEYS.best);
    const value = Number.parseInt(raw || '0', 10);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }

  function saveBestScore(nextBestScore) {
    storedBestScore = nextBestScore;
    window.localStorage.setItem(STORAGE_KEYS.best, String(nextBestScore));
  }

  function loadNumber(key, defaultValue = 0) {
    const raw = window.localStorage.getItem(key);
    const value = Number.parseInt(raw || String(defaultValue), 10);
    return Number.isFinite(value) && value >= 0 ? value : defaultValue;
  }

  function saveNumber(key, value) {
    window.localStorage.setItem(key, String(value));
  }

  function loadSpeed() {
    const value = loadNumber(STORAGE_KEYS.speed, DEFAULT_TICK_MS);
    return [70, 100, 140, 180].includes(value) ? value : DEFAULT_TICK_MS;
  }

  function saveSpeed(value) {
    window.localStorage.setItem(STORAGE_KEYS.speed, String(value));
  }

  function loadGridSize() {
    const raw = window.localStorage.getItem(STORAGE_KEYS.grid);
    const value = Number.parseInt(raw || '16', 10);
    return [12, 16, 20].includes(value) ? value : 16;
  }

  function saveGridSize(value) {
    window.localStorage.setItem(STORAGE_KEYS.grid, String(value));
  }

  function loadDifficulty() {
    const raw = window.localStorage.getItem(STORAGE_KEYS.difficulty) || 'custom';
    return DIFFICULTY_PRESETS[raw] ? raw : 'custom';
  }

  function saveDifficulty(value) {
    difficulty = DIFFICULTY_PRESETS[value] ? value : 'custom';
    window.localStorage.setItem(STORAGE_KEYS.difficulty, difficulty);
  }

  function applyPresetIfNeeded() {
    if (difficulty === 'custom') {
      return;
    }
    const preset = DIFFICULTY_PRESETS[difficulty];
    tickMs = preset.speed;
    gridSize = preset.gridSize;
    saveSpeed(tickMs);
    saveGridSize(gridSize);
  }

  function createGameState() {
    return createInitialState({
      wrapWalls: wrapToggle.checked,
      width: gridSize,
      height: gridSize,
      difficulty
    });
  }

  function loadJsonArray(key) {
    try {
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function loadScoreHistory() {
    return loadJsonArray(STORAGE_KEYS.history);
  }

  function saveScoreHistory(history) {
    scoreHistory = history;
    window.localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
  }

  function loadLeaderboardEntries() {
    return loadJsonArray(STORAGE_KEYS.leaderboard);
  }

  function saveLeaderboardEntries(entries) {
    leaderboardEntries = entries
      .slice()
      .sort((a, b) => b.score - a.score || new Date(b.date) - new Date(a.date))
      .slice(0, MAX_LEADERBOARD_ENTRIES);
    window.localStorage.setItem(STORAGE_KEYS.leaderboard, JSON.stringify(leaderboardEntries));
  }

  function addLeaderboardEntry(playerName, completedGame) {
    const cleanName = (playerName || 'Player').trim().slice(0, 16) || 'Player';
    const entry = {
      playerName: cleanName,
      score: completedGame.score,
      difficulty: completedGame.difficulty,
      gridSize: completedGame.width,
      date: completedGame.date
    };
    saveLeaderboardEntries([...leaderboardEntries, entry]);
    window.localStorage.setItem(STORAGE_KEYS.playerName, cleanName);
    lastCompletedGame = { ...completedGame, saved: true };
    renderLeaderboard();
    renderSaveScoreState();
  }

  function getLeaderboardEntries(limit, filter) {
    const entries = filter && filter !== 'all'
      ? leaderboardEntries.filter((entry) => (entry.difficulty || 'custom') === filter)
      : leaderboardEntries;
    return entries.slice(0, limit);
  }

  function addScoreToHistory(scoreValue, width, didWin) {
    const entry = {
      score: scoreValue,
      width,
      difficulty,
      result: didWin ? 'Win' : 'Game over',
      date: new Date().toISOString()
    };
    lastCompletedGame = { ...entry, saved: false };
    saveScoreHistory([entry, ...scoreHistory]);
    if (didWin) {
      totalWins += 1;
      saveNumber(STORAGE_KEYS.wins, totalWins);
    }
    totalGamesPlayed += 1;
    saveNumber(STORAGE_KEYS.games, totalGamesPlayed);
    renderHistory();
    renderSaveScoreState();
  }

  function getRecentHistory() {
    return scoreHistory.slice(0, MAX_HISTORY_ENTRIES);
  }

  function loadSoundEnabled() {
    return window.localStorage.getItem(STORAGE_KEYS.sound) === '1';
  }

  function saveSoundEnabled(on) {
    window.localStorage.setItem(STORAGE_KEYS.sound, on ? '1' : '0');
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

  function playPowerUp() {
    playTone(740, 0.08, 'triangle', 0.05);
    window.setTimeout(() => playTone(980, 0.08, 'triangle', 0.05), 55);
  }

  function playGameOver() {
    playTone(180, 0.25, 'sawtooth', 0.06);
  }

  function playWin() {
    playTone(660, 0.1, 'square', 0.05);
    window.setTimeout(() => playTone(880, 0.12, 'square', 0.05), 90);
  }

  function playObstacle() {
    playTone(150, 0.15, 'sawtooth', 0.06);
  }

  function hasActiveEffect(effectType) {
    return state.activeEffects && state.activeEffects.some((effect) => effect.type === effectType);
  }

  function getEffectiveTickMs() {
    if (hasActiveEffect('speed-boost')) {
      return Math.max(45, Math.round(tickMs * SPEED_BOOST_MULTIPLIER));
    }
    return tickMs;
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
      comboEl.textContent = combo > 1 ? `x${combo}` : '-';
    }
  }

  function resetComboDisplay() {
    combo = 0;
    comboTimer = null;
    if (comboEl) {
      comboEl.textContent = '-';
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

  function getDifficultyLabel(value) {
    return DIFFICULTY_PRESETS[value] ? DIFFICULTY_PRESETS[value].label : DIFFICULTY_PRESETS.custom.label;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderHistory() {
    if (!historyList) {
      renderHistorySummary();
      return;
    }

    const recentHistory = getRecentHistory();
    historyList.innerHTML = '';

    if (recentHistory.length === 0) {
      const item = document.createElement('li');
      item.className = 'history-empty';
      item.textContent = 'No completed games yet. Play and score to populate history.';
      historyList.appendChild(item);
      renderHistorySummary();
      return;
    }

    recentHistory.forEach((entry) => {
      const item = document.createElement('li');
      item.className = 'history-item';
      const date = new Date(entry.date);
      item.innerHTML = `
        <span class="history-result">${entry.result}</span>
        <span class="history-score">${entry.score} pts</span>
        <span class="history-extra">${getDifficultyLabel(entry.difficulty || 'custom')} - ${entry.width}x${entry.width}</span>
        <span class="history-date">${date.toLocaleDateString()} ${date.toLocaleTimeString()}</span>
      `;
      historyList.appendChild(item);
    });
    renderHistorySummary();
  }

  function renderLeaderboard() {
    if (!leaderboardList) {
      return;
    }
    const entries = getLeaderboardEntries(10, leaderboardFilter ? leaderboardFilter.value : 'all');
    leaderboardList.innerHTML = '';

    if (entries.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'history-empty';
      empty.textContent = 'No leaderboard entries yet.';
      leaderboardList.appendChild(empty);
      return;
    }

    entries.forEach((entry, index) => {
      const item = document.createElement('li');
      item.className = 'leaderboard-item';
      const date = new Date(entry.date);
      item.innerHTML = `
        <span class="leaderboard-rank">#${index + 1}</span>
        <span>
          <span class="leaderboard-name">${escapeHtml(entry.playerName || 'Player')}</span>
          <span class="leaderboard-meta">${getDifficultyLabel(entry.difficulty || 'custom')} - ${entry.gridSize || 16}x${entry.gridSize || 16} - ${date.toLocaleDateString()}</span>
        </span>
        <span class="leaderboard-score">${entry.score}</span>
      `;
      leaderboardList.appendChild(item);
    });
  }

  function renderSaveScoreState() {
    const canSave = Boolean(lastCompletedGame && !lastCompletedGame.saved);
    if (saveLeaderboardButton) {
      saveLeaderboardButton.disabled = !canSave;
    }
    if (leaderboardForm) {
      const submit = leaderboardForm.querySelector('button[type="submit"]');
      if (submit) {
        submit.disabled = !canSave;
      }
    }
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

        if (state.obstacles && state.obstacles.has(key)) {
          cell.classList.add('obstacle');
          continue;
        }

        if (state.food && state.food.x === x && state.food.y === y) {
          if (state.food.isFood === false) {
            cell.classList.add('powerup-speed');
          } else {
            cell.classList.add('food');
            if (state.food.type === 'super') {
              cell.classList.add('food-super');
            } else if (state.food.bonus || state.food.type === 'bonus') {
              cell.classList.add('food-bonus');
            }
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
      status.textContent = state.hitObstacle
        ? 'Game over. The snake hit an obstacle.'
        : 'Game over. Restart to play again.';
    } else if (!state.isStarted) {
      status.textContent = state.wrapWalls
        ? 'Press any arrow key or WASD to start. Wrap mode is on.'
        : 'Press any arrow key or WASD to start.';
    } else if (state.isPaused) {
      status.textContent = 'Paused.';
    } else if (hasActiveEffect('speed-boost')) {
      status.textContent = 'Speed boost active. Blue power-ups briefly quicken the pace.';
    } else {
      status.textContent = state.wrapWalls
        ? 'Wrap mode on. Golden cells are +5. Chain quick eats for combo.'
        : 'Golden cells are +5. Ember cells are +15. Blue cells are speed boosts.';
    }

    pauseButton.textContent = state.isPaused ? 'Resume' : 'Pause';
    pauseButton.disabled = state.isGameOver || !state.isStarted;
    speedSelect.value = String(tickMs);
    wrapToggle.checked = state.wrapWalls;
    if (gridSelect) {
      gridSelect.value = String(state.width);
    }
    if (difficultySelect) {
      difficultySelect.value = difficulty;
    }
  }

  function afterStep(prevScore) {
    const grew = state.score > prevScore;
    const collectedPowerUp = Boolean(state.lastCollectedPowerUp);
    if (grew) {
      updateCombo(true);
      if (state.lastAteBonus) {
        playBonus();
      } else {
        playEat();
      }
    }

    if (collectedPowerUp) {
      playPowerUp();
    }

    if (state.isGameOver) {
      if (!gameOverRecorded) {
        addScoreToHistory(state.score, state.width, state.didWin);
        gameOverRecorded = true;
      }
      if (state.didWin) {
        playWin();
      } else if (state.hitObstacle) {
        playObstacle();
      } else {
        playGameOver();
      }
    }
  }

  function startLoop() {
    stopLoop();
    scheduleTick();
  }

  function scheduleTick() {
    timerId = window.setTimeout(runTick, getEffectiveTickMs());
  }

  function runTick() {
    timerId = null;
    const prevScore = state.score;
    state = step(state);
    afterStep(prevScore);
    render();

    if (state.isStarted && !state.isGameOver) {
      scheduleTick();
    }
  }

  function stopLoop() {
    if (timerId !== null) {
      window.clearTimeout(timerId);
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

  function resetGame(message) {
    state = createGameState();
    stopLoop();
    gameOverRecorded = false;
    lastCompletedGame = null;
    resetComboDisplay();
    cellGrid = null;
    cachedW = 0;
    cachedH = 0;
    render();
    renderSaveScoreState();
    if (message) {
      status.textContent = message;
    }
  }

  function restart() {
    resetGame();
  }

  function handlePause() {
    state = togglePause(state);
    render();
    if (state.isPaused) {
      stopLoop();
    } else if (state.isStarted && !state.isGameOver) {
      startLoop();
    }
  }

  function switchToCustomDifficulty() {
    if (difficulty === 'custom') {
      return;
    }
    saveDifficulty('custom');
    if (difficultySelect) {
      difficultySelect.value = 'custom';
    }
  }

  function handleSpeedChange() {
    tickMs = Number.parseInt(speedSelect.value, 10) || DEFAULT_TICK_MS;
    saveSpeed(tickMs);
    switchToCustomDifficulty();
    if (state.isStarted && !state.isGameOver && !state.isPaused) {
      startLoop();
    }
  }

  function handleWrapToggle() {
    const shouldExplainReset = state.isStarted || state.isPaused;
    resetGame(shouldExplainReset ? 'Mode changed. Board reset for a fair run.' : null);
  }

  function handleGridChange() {
    gridSize = Number.parseInt(gridSelect.value, 10) || 16;
    saveGridSize(gridSize);
    switchToCustomDifficulty();
    resetGame('Board size updated. Press arrows or WASD to start.');
  }

  function handleDifficultyChange() {
    saveDifficulty(difficultySelect.value);
    applyPresetIfNeeded();
    resetGame(`${getDifficultyLabel(difficulty)} difficulty selected. Press arrows or WASD to start.`);
  }

  document.addEventListener('keydown', (event) => {
    const tagName = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : '';
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || event.target.isContentEditable) {
      return;
    }

    const key = event.key.toLowerCase();
    const direction = KEY_TO_DIRECTION[key];

    if (key === ' ') {
      event.preventDefault();
      handlePause();
      return;
    }

    if (direction) {
      event.preventDefault();
      updateDirection(direction);
    }
  });

  restartButton.addEventListener('click', restart);
  pauseButton.addEventListener('click', handlePause);
  speedSelect.addEventListener('change', handleSpeedChange);
  wrapToggle.addEventListener('change', handleWrapToggle);
  if (gridSelect) {
    gridSelect.addEventListener('change', handleGridChange);
  }
  if (difficultySelect) {
    difficultySelect.addEventListener('change', handleDifficultyChange);
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
  if (leaderboardFilter) {
    leaderboardFilter.addEventListener('change', renderLeaderboard);
  }
  if (leaderboardForm) {
    playerNameInput.value = window.localStorage.getItem(STORAGE_KEYS.playerName) || '';
    leaderboardForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!lastCompletedGame || lastCompletedGame.saved) {
        return;
      }
      addLeaderboardEntry(playerNameInput.value, lastCompletedGame);
    });
  }
  if (saveLeaderboardButton) {
    saveLeaderboardButton.addEventListener('click', () => {
      if (leaderboardForm && typeof leaderboardForm.requestSubmit === 'function') {
        leaderboardForm.requestSubmit();
      }
    });
  }

  controlButtons.forEach((button) => {
    button.addEventListener('click', () => updateDirection(button.dataset.direction));
    button.addEventListener('touchstart', (event) => {
      event.preventDefault();
      updateDirection(button.dataset.direction);
    }, { passive: false });
  });

  if (gridSelect) {
    gridSelect.value = String(gridSize);
  }
  if (speedSelect) {
    speedSelect.value = String(tickMs);
  }
  if (difficultySelect) {
    difficultySelect.value = difficulty;
  }

  renderHistory();
  renderLeaderboard();
  renderSaveScoreState();
  render();
})();
