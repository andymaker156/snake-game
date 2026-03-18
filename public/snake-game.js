(function () {
  const { createInitialState, setDirection, step, togglePause } = window.SnakeLogic;
  const TICK_MS = 140;
  const board = document.getElementById('board');
  const score = document.getElementById('score');
  const status = document.getElementById('status');
  const restartButton = document.getElementById('restart-button');
  const pauseButton = document.getElementById('pause-button');
  const controlButtons = Array.from(document.querySelectorAll('[data-direction]'));

  let state = createInitialState();
  let timerId = null;

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

    if (state.isGameOver) {
      status.textContent = 'Game over. Restart to play again.';
    } else if (!state.isStarted) {
      status.textContent = 'Press any arrow key or WASD to start.';
    } else if (state.isPaused) {
      status.textContent = 'Paused.';
    } else {
      status.textContent = 'Use arrow keys or WASD to steer.';
    }

    pauseButton.textContent = state.isPaused ? 'Resume' : 'Pause';
    pauseButton.disabled = state.isGameOver || !state.isStarted;
  }

  function startLoop() {
    if (timerId !== null) {
      return;
    }

    timerId = window.setInterval(() => {
      state = step(state);
      render();

      if (state.isGameOver) {
        stopLoop();
      }
    }, TICK_MS);
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
    state = createInitialState();
    stopLoop();
    render();
  }

  function handlePause() {
    state = togglePause(state);
    render();
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
  controlButtons.forEach((button) => {
    button.addEventListener('click', () => updateDirection(button.dataset.direction));
  });

  render();
})();
