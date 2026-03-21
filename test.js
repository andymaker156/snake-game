let totalFrames = 240;
let gridSize = 8;
let tileSize = 64;
let canvasSize = gridSize * tileSize;
let saveBtn;

function setup() {
  createCanvas(canvasSize, canvasSize);
  rectMode(CENTER);

  // Button for exporting the loop as a GIF.
  saveBtn = createButton("Save");
  saveBtn.position(10, height + 10);
  saveBtn.mousePressed(() => saveGif("loop", totalFrames));
}

function draw() {
  // Keep the frame number inside one full loop.
  let currentFrame = frameCount % totalFrames;
  
  // Convert the frame number into a progress value from 0 to 1.
  let loopProgress = currentFrame / (totalFrames - 1);

  // The animation has two phases:
  // phase 1: one checker pattern changes into the opposite one
  // phase 2: the opposite pattern changes back
  let phase;
  let phaseProgress;

  if (loopProgress < 0.5) {
    phase = 1;
    phaseProgress = loopProgress * 2;
  } else {
    phase = 2;
    phaseProgress = (loopProgress - 0.5) * 2;
  }

  // Easing makes the motion feel smoother than a constant speed.
  let easedProgress = easeInOutCubic(phaseProgress);
  background(0);

  noStroke();

  // Draw every tile in the checkerboard.
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      let centerX = col * tileSize + tileSize / 2;
      let centerY = row * tileSize + tileSize / 2;
      let startsBlack = isStartingBlackTile(row, col);
      let startColor = getTileStartColor(phase, startsBlack);
      let endColor = 255 - startColor;
      let currentSize = lerp(1, 0, easedProgress) * tileSize;

      push();
      translate(centerX, centerY);

      // First draw the color we are changing into.
      fill(endColor);
      rect(0, 0, tileSize, tileSize);

      // Then draw the current color on top and shrink it away.
      fill(startColor);
      rect(0, 0, currentSize, currentSize);

      pop();
    }
  }
}

function isStartingBlackTile(row, col) {
  if ((row + col) % 2 === 0) {
    return true;
  } else {
    return false;
  }
}

function getTileStartColor(phase, startsBlack) {
  if (phase === 1) {
    if (startsBlack) {
      return 0;
    } else {
      return 255;
    }
  } else {
    if (startsBlack) {
      return 255;
    } else {
      return 0;
    }
  }
}

function easeInOutCubic(t) {
  if (t < 0.5) {
    return 4 * t * t * t;
  } else {
    return 1 - pow(-2 * t + 2, 3) / 2;
  }
}
