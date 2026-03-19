(function () {
  const { createInitialState, setDirection, step, togglePause } = window.SnakeLogic;
  const DEFAULT_TICK_MS = 140;
  const STORAGE_KEY = 'snake-best-score';
  const board = document.getElementById('board');
  const score = document.getElementById('score');
  const bestScore = document.getElementById('best-score');
  const status = document.getElementById('status');
  const restartButton = document.getElementById('restart-button');
  const pauseButton = document.getElementById('pause-button');
  const speedSelect = document.getElementById('speed-select');
  const wrapToggle = document.getElementById('wrap-toggle');
  const controlButtons = Array.from(document.querySelectorAll('[data-direction]'));

  let tickMs = DEFAULT_TICK_MS;
  let storedBestScore = loadBestScore();
  let state = createInitialState({ wrapWalls: wrapToggle.checked });
  let timerId = null;

  function loadBestScore() {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const value = Number.parseInt(raw || '0', 10);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }

  function saveBestScore(nextBestScore) {
    storedBestScore = nextBestScore;
    window.localStorage.setItem(STORAGE_KEY, String(nextBestScore));
  }

  function syncBestScore() {
    if (state.score > storedBestScore) {
      saveBestScore(state.score);
    }

    bestScore.textContent = String(storedBestScore);
  }

  function render() {
    board.innerHTML = '';
    board.style.gridTemplateColumns = `repeat(${state.width}, minmax(0, 1fr))`;

    const snakeMap = new Map(
      state.snake.map((segment, index) => [`${segment.x},${segment.y}`, index])
    );

    for (let y = 0; y < state.height; y += 1) {
      for (let x = 0; x < state.width; x += 1) {
        const cell = document.createElement('div');
        const key = `${x},${y}`;
        cell.className = 'cell';

        if (state.food && state.food.x === x && state.food.y === y) {
          cell.classList.add('food');
        }

        if (snakeMap.has(key)) {
          cell.classList.add('snake');
          if (snakeMap.get(key) === 0) {
            cell.classList.add('head');
          }
        }

        board.appendChild(cell);
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
        ? 'Wrap mode on. Use arrow keys or WASD to steer.'
        : 'Use arrow keys or WASD to steer.';
    }

    pauseButton.textContent = state.isPaused ? 'Resume' : 'Pause';
    pauseButton.disabled = state.isGameOver || !state.isStarted;
    speedSelect.value = String(tickMs);
    wrapToggle.checked = state.wrapWalls;
  }

  function startLoop() {
    stopLoop();
    timerId = window.setInterval(() => {
      state = step(state);
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
    state = createInitialState({ wrapWalls: wrapToggle.checked });
    stopLoop();
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
    state = createInitialState({ wrapWalls: wrapToggle.checked });
    stopLoop();
    render();

    if (shouldExplainReset) {
      status.textContent = 'Mode changed. Board reset for a fair run.';
    }
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
  controlButtons.forEach((button) => {
    button.addEventListener('click', () => updateDirection(button.dataset.direction));
  });

  render();
})();
