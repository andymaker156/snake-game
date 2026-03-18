(function (global) {
  const DIRECTIONS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };

  const OPPOSITES = {
    up: 'down',
    down: 'up',
    left: 'right',
    right: 'left'
  };

  function createInitialState(config = {}, randomFn = Math.random) {
    const width = config.width || 16;
    const height = config.height || 16;
    const start = {
      x: Math.floor(width / 2),
      y: Math.floor(height / 2)
    };
    const snake = [
      start,
      { x: start.x - 1, y: start.y },
      { x: start.x - 2, y: start.y }
    ];

    return {
      width,
      height,
      snake,
      direction: 'right',
      pendingDirection: 'right',
      food: placeFood(snake, width, height, randomFn),
      score: 0,
      isGameOver: false,
      isStarted: false,
      isPaused: false
    };
  }

  function setDirection(state, nextDirection) {
    if (!DIRECTIONS[nextDirection]) {
      return state;
    }

    const activeDirection = state.pendingDirection || state.direction;
    if (OPPOSITES[activeDirection] === nextDirection) {
      return state;
    }

    return {
      ...state,
      pendingDirection: nextDirection,
      isStarted: true
    };
  }

  function togglePause(state) {
    if (state.isGameOver || !state.isStarted) {
      return state;
    }

    return {
      ...state,
      isPaused: !state.isPaused
    };
  }

  function step(state, randomFn = Math.random) {
    if (state.isGameOver || state.isPaused || !state.isStarted) {
      return state;
    }

    const direction = state.pendingDirection || state.direction;
    const vector = DIRECTIONS[direction];
    const nextHead = {
      x: state.snake[0].x + vector.x,
      y: state.snake[0].y + vector.y
    };

    const grows = nextHead.x === state.food.x && nextHead.y === state.food.y;
    const nextSnake = [nextHead, ...state.snake];

    if (!grows) {
      nextSnake.pop();
    }

    if (hitsWall(nextHead, state.width, state.height) || hitsSelf(nextSnake)) {
      return {
        ...state,
        snake: nextSnake,
        direction,
        pendingDirection: direction,
        isGameOver: true
      };
    }

    return {
      ...state,
      snake: nextSnake,
      direction,
      pendingDirection: direction,
      food: grows ? placeFood(nextSnake, state.width, state.height, randomFn) : state.food,
      score: grows ? state.score + 1 : state.score
    };
  }

  function hitsWall(point, width, height) {
    return point.x < 0 || point.y < 0 || point.x >= width || point.y >= height;
  }

  function hitsSelf(snake) {
    const [head, ...body] = snake;
    return body.some((segment) => segment.x === head.x && segment.y === head.y);
  }

  function placeFood(snake, width, height, randomFn = Math.random) {
    const occupied = new Set(snake.map((segment) => `${segment.x},${segment.y}`));
    const openCells = [];

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const key = `${x},${y}`;
        if (!occupied.has(key)) {
          openCells.push({ x, y });
        }
      }
    }

    if (openCells.length === 0) {
      return null;
    }

    const index = Math.floor(randomFn() * openCells.length);
    return openCells[index];
  }

  const api = {
    createInitialState,
    setDirection,
    togglePause,
    step,
    placeFood
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  global.SnakeLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
