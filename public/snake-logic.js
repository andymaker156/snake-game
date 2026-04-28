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
    const wrapWalls = Boolean(config.wrapWalls);
    const difficulty = config.difficulty || 'normal';
    const start = {
      x: Math.floor(width / 2),
      y: Math.floor(height / 2)
    };
    const snake = [
      start,
      { x: start.x - 1, y: start.y },
      { x: start.x - 2, y: start.y }
    ];
    const obstacles = placeObstacles(width, height, difficulty, randomFn);

    return {
      width,
      height,
      wrapWalls,
      difficulty,
      snake,
      direction: 'right',
      pendingDirection: 'right',
      food: placeFood(snake, width, height, randomFn, obstacles),
      obstacles,
      score: 0,
      isGameOver: false,
      isStarted: false,
      isPaused: false,
      didWin: false,
      lastAteBonus: false,
      lastCollectedPowerUp: null,
      hitObstacle: false,
      activeEffects: []
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

    let updatedState = updateEffects(state);

    const direction = updatedState.pendingDirection || updatedState.direction;
    const vector = DIRECTIONS[direction];
    const nextHead = moveHead(updatedState.snake[0], vector, updatedState.width, updatedState.height, updatedState.wrapWalls);
    const atFood = updatedState.food && nextHead.x === updatedState.food.x && nextHead.y === updatedState.food.y;
    
    const grows = atFood && updatedState.food.isFood !== false;
    const foodType = grows && updatedState.food ? updatedState.food.type : 'normal';
    const points = grows ? (foodType === 'super' ? 15 : foodType === 'bonus' ? 5 : 1) : 0;
    const ateBonus = grows && (foodType === 'bonus' || foodType === 'super');
    const collectedPowerUp = atFood && updatedState.food.isFood === false;
    
    const nextSnake = [nextHead, ...updatedState.snake];

    if (!grows) {
      nextSnake.pop();
    }

    const obstacles = updatedState.obstacles || new Set();
    const hitObstacle = obstacles.has(`${nextHead.x},${nextHead.y}`);

    if ((!updatedState.wrapWalls && hitsWall(nextHead, updatedState.width, updatedState.height)) || hitsSelf(nextSnake) || hitObstacle) {
      return {
        ...updatedState,
        snake: nextSnake,
        direction,
        pendingDirection: direction,
        isGameOver: true,
        lastAteBonus: false,
        lastCollectedPowerUp: null,
        hitObstacle
      };
    }

    let nextState = {
      ...updatedState,
      snake: nextSnake,
      direction,
      pendingDirection: direction,
      lastAteBonus: grows ? ateBonus : false,
      lastCollectedPowerUp: collectedPowerUp ? updatedState.food.type : null,
      hitObstacle: false
    };

    if (collectedPowerUp) {
      if (updatedState.food.type === 'powerup-speed') {
        nextState = activateEffect(nextState, 'speed-boost', 4000);
      }
    }

    if (grows || collectedPowerUp) {
      nextState.food = placeFood(nextSnake, updatedState.width, updatedState.height, randomFn, updatedState.obstacles);
      const didWin = grows && nextState.food === null;
      nextState.isGameOver = didWin;
      nextState.didWin = didWin;
      nextState.score = nextState.score + points;
    }

    return nextState;
  }

  function moveHead(head, vector, width, height, wrapWalls) {
    const nextHead = {
      x: head.x + vector.x,
      y: head.y + vector.y
    };

    if (!wrapWalls) {
      return nextHead;
    }

    return {
      x: (nextHead.x + width) % width,
      y: (nextHead.y + height) % height
    };
  }

  function hitsWall(point, width, height) {
    return point.x < 0 || point.y < 0 || point.x >= width || point.y >= height;
  }

  function hitsSelf(snake) {
    const [head, ...body] = snake;
    return body.some((segment) => segment.x === head.x && segment.y === head.y);
  }

  function activateEffect(state, effectType, durationMs) {
    const expiresAt = Date.now() + durationMs;
    return {
      ...state,
      activeEffects: [...(state.activeEffects || []), { type: effectType, expiresAt }]
    };
  }

  function updateEffects(state) {
    const now = Date.now();
    const nextEffects = (state.activeEffects || []).filter((effect) => effect.expiresAt > now);
    return {
      ...state,
      activeEffects: nextEffects
    };
  }

  function getActiveEffectByType(state, effectType) {
    return (state.activeEffects || []).find((effect) => effect.type === effectType);
  }

  function getLevelConfig(difficulty) {
    const configs = {
      custom: { speed: 140, gridSize: 16, obstacleCount: 0, powerUpRate: 0.08 },
      easy: { speed: 180, gridSize: 12, obstacleCount: 0, powerUpRate: 0.08 },
      normal: { speed: 140, gridSize: 16, obstacleCount: 5, powerUpRate: 0.08 },
      hard: { speed: 100, gridSize: 20, obstacleCount: 10, powerUpRate: 0.08 },
      insane: { speed: 70, gridSize: 20, obstacleCount: 15, powerUpRate: 0.08 }
    };
    return configs[difficulty] || configs.custom;
  }

  function placeObstacles(width, height, difficulty, randomFn = Math.random) {
    const obstacles = new Set();
    const obstacleCount = getLevelConfig(difficulty).obstacleCount;
    const startX = Math.floor(width / 2);
    const startY = Math.floor(height / 2);
    const startingSnake = new Set([
      `${startX},${startY}`,
      `${startX - 1},${startY}`,
      `${startX - 2},${startY}`
    ]);
    
    let attempts = 0;
    while (obstacles.size < obstacleCount && attempts < obstacleCount * 10) {
      const x = Math.floor(randomFn() * width);
      const y = Math.floor(randomFn() * height);
      const key = `${x},${y}`;
      
      if (!obstacles.has(key) && !startingSnake.has(key)) {
        obstacles.add(key);
      }
      attempts += 1;
    }

    if (obstacles.size < obstacleCount) {
      for (let y = 0; y < height && obstacles.size < obstacleCount; y += 1) {
        for (let x = 0; x < width && obstacles.size < obstacleCount; x += 1) {
          const key = `${x},${y}`;
          if (!obstacles.has(key) && !startingSnake.has(key)) {
            obstacles.add(key);
          }
        }
      }
    }
    
    return obstacles;
  }

  function placeFood(snake, width, height, randomFn = Math.random, obstacles = new Set()) {
    const occupied = new Set([...snake.map((segment) => `${segment.x},${segment.y}`), ...obstacles]);
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
    const picked = openCells[index];
    const rand = randomFn();
    let type = 'normal';
    let bonus = false;
    let isFood = true;
    
    if (rand < 0.08) {
      type = 'powerup-speed';
      isFood = false;
    } else if (rand < 0.10) {
      type = 'super';
    } else if (rand < 0.17) {
      type = 'bonus';
      bonus = true;
    }
    
    return { x: picked.x, y: picked.y, bonus, type, isFood };
  }

  const api = {
    createInitialState,
    setDirection,
    togglePause,
    step,
    placeFood,
    placeObstacles,
    getLevelConfig,
    getActiveEffectByType
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  global.SnakeLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
