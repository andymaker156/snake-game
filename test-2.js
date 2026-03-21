
let totalFrames = 240;
let tileSize = 64;
let saveBtn;

function setup() {
  createCanvas(512, 512);
  rectMode(CENTER);

  // create save button for exporting as a gif
  saveBtn = createButton("Save");
  saveBtn.position(10, height + 10);
  saveBtn.mousePressed(() => saveGif("loop", totalFrames));
}

function draw() {
  background(255);

  // loop frame count
  let frame = frameCount % totalFrames;
  
  // converts frame count to percentage of the loop
  let t = frame / totalFrames;

  // split into two parts
  let phase;
  
  // easing needs 0-1
  // use to remap each phrase itself to 0-1  for easing
  let progress;

  if (t < 0.5) { // 0% to 49%
    phase = 1;
    progress = t * 2;
  } else { // 50% to 100%
    phase = 2;
    progress = (t - 0.5) * 2;
  }

  // to apply easing
  let eased = easeInOutCubic(progress);

  noStroke();

  // loop through each square
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {

      let cx = col * tileSize + tileSize / 2;
      let cy = row * tileSize + tileSize / 2;

      let isBlack = (row + col) % 2 === 0;

      push();
      translate(cx, cy);

      if (phase === 1) {
        if (isBlack) {
          // black squares shrink
          fill(0);
          let s = lerp(1, 0, eased);
          rect(0, 0, tileSize * s, tileSize * s);

        } else {
          // white squares grow from dot
          fill(0);
          let s = lerp(0, 1, eased);
          rect(0, 0, tileSize * s, tileSize * s);
        }

      } else {
        if (isBlack) {
          // black squares grow back but flipped color
          fill(0);
          let s = lerp(0, 1, eased);
          rect(0, 0, tileSize * s, tileSize * s);

        } else {
          // white squares shrink away
          fill(0);
          let s = lerp(1, 0, eased);
          rect(0, 0, tileSize * s, tileSize * s);
        }
      }

      pop();
    }
  }
}

function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - pow(-2 * t + 2, 3) / 2;
}



