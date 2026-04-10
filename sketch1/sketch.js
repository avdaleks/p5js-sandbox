let x, y, vx, vy;
const W = 600, H = 600;
const R = 0;
const SPEED = 3;
let angleStep = 30;

let stepSlider, countSlider, lengthSlider, radiusSlider, dampingSlider, blinkSlider;
let maskInp, fontSzSlider, maskBtn, colorBtn;
let ctx;
let maskOn = true;
let colorOn = false;

let SWARM_COUNT = 1000;
let HISTORY_LEN = 100;
let SWARM_RADIUS = 50;
let DAMPING = 0.02;
let BLINK_SPEED = 0.1;

let swarm = [];
let history = [];
let mouseWasIn = false;
let STAR_COLORS = [];

// Mask color palette — two colors blended across 7 steps
const MASK_COLOR_A = hexToRgb('#ff11ff');   // warm red
const MASK_COLOR_B = hexToRgb('#ff1170');  // warm yellow

function mixColor(c1, c2, t) {
  return [
    Math.floor(c1[0] + (c2[0] - c1[0]) * t),
    Math.floor(c1[1] + (c2[1] - c1[1]) * t),
    Math.floor(c1[2] + (c2[2] - c1[2]) * t)
  ];
}

function hexToRgb(h) {
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16)
  ];
}

function buildSwarm() {
  swarm = [];
  for (let i = 0; i < SWARM_COUNT; i++) {
    let offsetDist = random(1, SWARM_RADIUS);
    let col = [...STAR_COLORS[floor(random(STAR_COLORS.length))]];
    let colTarget = STAR_COLORS[floor(random(STAR_COLORS.length))];
    // mask color: random blend between MASK_COLOR_A and MASK_COLOR_B
    let mt = Math.random();
    let maskCol = mixColor(MASK_COLOR_A, MASK_COLOR_B, mt);
    swarm.push({
      delay: floor(map(offsetDist, 1, SWARM_RADIUS, 1, HISTORY_LEN)),
      offsetAngle: random(TWO_PI),
      offsetDist: offsetDist,
      r: random(0.5, 1),
      rotSpeed: random(0.0005, 0.0002),
      speed: random(0.0002, 0.0008),
      col: col,
      colTarget: colTarget,
      maskCol: maskCol,
      brightness: random(0.3, 1),
      brightnessTarget: random(0.3, 0.9)
    });
  }
}

function makeLabel(txt, x, y) {
  let l = createP(txt);
  l.position(x, y);
  l.style('color', '#ccc');
  l.style('font-family', 'sans-serif');
  l.style('font-size', '12px');
  l.style('margin', '0');
  return l;
}

function setup() {
  let canvas = createCanvas(W, H);
  canvas.position(0, 0);
  ctx = drawingContext;

  let COLD_A = hexToRgb('#06b8ff');
  let COLD_B = hexToRgb('#06f7ff');
  let WARM_A = hexToRgb('#bf00ff');
  let WARM_B = hexToRgb('#7f00ff');
  for (let i = 0; i < 7; i++) {
    let t = i / 6;
    STAR_COLORS.push(mixColor(COLD_A, COLD_B, t));
    STAR_COLORS.push(mixColor(WARM_A, WARM_B, t));
  }

  let sx = W + 16;
  let sw = '140px';
  let gap = 44;
  let top = 10;

  radiusSlider = createSlider(20, 1000, 50, 5);
  radiusSlider.position(sx, top + 18);
  radiusSlider.style('width', sw);
  var lRadius = makeLabel('Radius: 50', sx, top);
  radiusSlider.input(() => lRadius.html('Radius: ' + radiusSlider.value()));

  countSlider = createSlider(100, 10000, 1000, 100);
  countSlider.position(sx, top + gap + 18);
  countSlider.style('width', sw);
  var lCount = makeLabel('Count: 1000', sx, top + gap);
  countSlider.input(() => lCount.html('Count: ' + countSlider.value()));

  lengthSlider = createSlider(50, 1000, 100, 50);
  lengthSlider.position(sx, top + gap * 2 + 18);
  lengthSlider.style('width', sw);
  var lLength = makeLabel('Length: 100', sx, top + gap * 2);
  lengthSlider.input(() => lLength.html('Length: ' + lengthSlider.value()));

  dampingSlider = createSlider(1, 1000, 20, 1);
  dampingSlider.position(sx, top + gap * 3 + 18);
  dampingSlider.style('width', sw);
  var lDamping = makeLabel('Damping: 0.020', sx, top + gap * 3);
  dampingSlider.input(() => lDamping.html('Damping: ' + (dampingSlider.value() / 1000).toFixed(3)));

  blinkSlider = createSlider(1, 100, 10, 1);
  blinkSlider.position(sx, top + gap * 4 + 18);
  blinkSlider.style('width', sw);
  var lBlink = makeLabel('Blink: 0.10', sx, top + gap * 4);
  blinkSlider.input(() => lBlink.html('Blink: ' + (blinkSlider.value() / 100).toFixed(2)));

  stepSlider = createSlider(5, 90, 30, 5);
  stepSlider.position(sx, top + gap * 5 + 18);
  stepSlider.style('width', sw);
  var lStep = makeLabel('Angle step: 30', sx, top + gap * 5);
  stepSlider.input(() => lStep.html('Angle step: ' + stepSlider.value()));

  makeLabel('Mask text', sx, top + gap * 6);

  maskInp = createElement('textarea');
maskInp.attribute('rows', '3');
maskInp.value('π');
maskInp.position(sx, top + gap * 6 + 16);
maskInp.style('width', '68px');
maskInp.style('font-size', '14px');
maskInp.style('font-weight', 'bold');
maskInp.style('padding', '2px 4px');
maskInp.style('background', '#222');
maskInp.style('color', '#ccc');
maskInp.style('border', '1px solid #555');
maskInp.style('resize', 'none');
maskInp.style('line-height', '1.3');

  maskBtn = createButton('ON');
  maskBtn.position(sx + 76, top + gap * 6 + 16);
  maskBtn.style('background', '#222');
  maskBtn.style('color', '#0f0');
  maskBtn.style('border', '1px solid #555');
  maskBtn.style('padding', '2px 5px');
  maskBtn.style('cursor', 'pointer');
  maskBtn.style('font-size', '12px');
  maskBtn.style('height', '23px');
  maskBtn.mousePressed(() => {
    maskOn = !maskOn;
    maskBtn.html(maskOn ? 'ON' : 'OFF');
    maskBtn.style('color', maskOn ? '#0f0' : '#f44');
  });

  colorBtn = createButton('color');
  colorBtn.position(sx + 112, top + gap * 6 + 16);
  colorBtn.style('background', '#222');
  colorBtn.style('color', '#888');
  colorBtn.style('border', '1px solid #555');
  colorBtn.style('padding', '2px 5px');
  colorBtn.style('cursor', 'pointer');
  colorBtn.style('font-size', '12px');
  colorBtn.style('height', '23px');
  colorBtn.mousePressed(() => {
    colorOn = !colorOn;
    colorBtn.style('color', colorOn ? '#fa0' : '#888');
  });

  fontSzSlider = createSlider(20, 400, 200, 1);
  fontSzSlider.position(sx, top + gap * 7 + 68);
  fontSzSlider.style('width', sw);
  var lFont = makeLabel('Font size: 200', sx, top + gap * 7+50);
  fontSzSlider.input(() => lFont.html('Font size: ' + fontSzSlider.value()));

  x = W / 2;
  y = H / 2;
  let angle = radians(45);
  vx = SPEED * cos(angle);
  vy = SPEED * sin(angle);

  buildSwarm();
}

function snapAngle(angle) {
  let deg = degrees(angle);
  deg = ((deg % 360) + 360) % 360;
  let snapped = round(deg / angleStep) * angleStep;
  return radians(snapped);
}

function reflectAndSnap(vx, vy, axis) {
  let angle = atan2(vy, vx);
  let speed = sqrt(vx * vx + vy * vy);
  let newAngle;
  if (axis === 'x') {
    newAngle = PI - angle;
  } else {
    newAngle = -angle;
  }
  newAngle = snapAngle(newAngle);
  let deg = ((degrees(newAngle) % 360) + 360) % 360;
  if (deg % 90 === 0) {
    newAngle += radians(angleStep / 2);
  }
  return {
    vx: speed * cos(newAngle),
    vy: speed * sin(newAngle)
  };
}

function mouseInCanvas() {
  return mouseX >= 0 && mouseX <= W && mouseY >= 0 && mouseY <= H;
}

// Build text mask canvas — returns ImageData for pixel lookup
function buildTextMask(maskText, fontSize) {
  let txtCnv = document.createElement('canvas');
  txtCnv.width  = W;
  txtCnv.height = H;
  let tctx = txtCnv.getContext('2d');
  let lines = maskText.split('\n');
  let lineHeight = fontSize * 1.1;
  let startY = H / 2 - (lines.length * lineHeight) / 2 + lineHeight / 2;
  tctx.fillStyle    = '#fff';
  tctx.font         = `bold ${fontSize}px Arial`;
  tctx.textAlign    = 'center';
  tctx.textBaseline = 'middle';
  for (let i = 0; i < lines.length; i++) {
    tctx.fillText(lines[i], W / 2, startY + i * lineHeight);
  }
  return tctx.getImageData(0, 0, W, H);
}

function isInsideMask(imageData, px, py) {
  let ix = Math.floor(px);
  let iy = Math.floor(py);
  if (ix < 0 || ix >= W || iy < 0 || iy >= H) return false;
  // check alpha channel
  return imageData.data[(iy * W + ix) * 4 + 3] > 128;
}

function drawSwarmToCanvas(targetCtx, maskImageData) {
  for (let s of swarm) {
    s.speed += (s.rotSpeed - s.speed) * DAMPING;
    s.offsetAngle += s.speed;

    s.brightness += (s.brightnessTarget - s.brightness) * BLINK_SPEED;
    if (abs(s.brightness - s.brightnessTarget) < 0.02) {
      s.brightnessTarget = random(0.3, 0.9);
    }

    s.col[0] += (s.colTarget[0] - s.col[0]) * BLINK_SPEED;
    s.col[1] += (s.colTarget[1] - s.col[1]) * BLINK_SPEED;
    s.col[2] += (s.colTarget[2] - s.col[2]) * BLINK_SPEED;
    if (abs(s.col[0] - s.colTarget[0]) < 1 &&
        abs(s.col[1] - s.colTarget[1]) < 1 &&
        abs(s.col[2] - s.colTarget[2]) < 1) {
      s.colTarget = STAR_COLORS[floor(random(STAR_COLORS.length))];
    }

    let idx = max(0, history.length - s.delay);
    let pos = history[idx];
    let sx = pos.x + cos(s.offsetAngle) * s.offsetDist;
    let sy = pos.y + sin(s.offsetAngle) * s.offsetDist;

    let b = s.brightness+0.75;
    let r, g, bl;

    // if color mode on and mask provided, check if inside letter
    if (colorOn && maskImageData && isInsideMask(maskImageData, sx, sy)) {
      let mc = s.maskCol;
      r  = mc[0] * b;
      g  = mc[1] * b;
      bl = mc[2] * b;
    } else {
      r  = s.col[0] * b;
      g  = s.col[1] * b;
      bl = s.col[2] * b;
    }

    targetCtx.beginPath();
    targetCtx.arc(sx, sy, s.r, 0, Math.PI * 2);
    targetCtx.fillStyle = `rgb(${r}, ${g}, ${bl})`;
    targetCtx.fill();
  }
}

function draw() {
  angleStep = stepSlider.value();
  DAMPING = dampingSlider.value() / 1000;
  BLINK_SPEED = blinkSlider.value() / 100;

  let newCount  = countSlider.value();
  let newLen    = lengthSlider.value();
  let newRadius = radiusSlider.value();

  if (newCount !== SWARM_COUNT || newLen !== HISTORY_LEN || newRadius !== SWARM_RADIUS) {
    SWARM_COUNT  = newCount;
    HISTORY_LEN  = newLen;
    SWARM_RADIUS = newRadius;
    buildSwarm();
  }

  if (mouseInCanvas()) {
    if (!mouseWasIn) {
      for (let s of swarm) s.speed = random(0.01, 0.04);
    }
    mouseWasIn = true;
    x = lerp(x, mouseX, 0.12);
    y = lerp(y, mouseY, 0.12);
  } else {
    mouseWasIn = false;
    x += vx;
    y += vy;
    if (x - R < 0) {
      x = R;
      ({ vx, vy } = reflectAndSnap(vx, vy, 'x'));
    } else if (x + R > W) {
      x = W - R;
      ({ vx, vy } = reflectAndSnap(vx, vy, 'x'));
    }
    if (y - R < 0) {
      y = R;
      ({ vx, vy } = reflectAndSnap(vx, vy, 'y'));
    } else if (y + R > H) {
      y = H - R;
      ({ vx, vy } = reflectAndSnap(vx, vy, 'y'));
    }
  }

  history.push({ x, y });
  if (history.length > HISTORY_LEN) history.shift();

  let maskText = maskInp.elt.value || 'БАЙ';
  let fontSize = fontSzSlider.value();

  // Build text mask image data once per frame (needed for color mode)
  let maskImageData = (maskOn || colorOn) ? buildTextMask(maskText, fontSize) : null;

  // Draw swarm to offscreen canvas, passing mask for color detection
  let swarmCnv = document.createElement('canvas');
  swarmCnv.width  = W;
  swarmCnv.height = H;
  let sctx = swarmCnv.getContext('2d');
  sctx.fillStyle = '#000';
  sctx.fillRect(0, 0, W, H);
  drawSwarmToCanvas(sctx, maskImageData);

  if (maskOn) {
    // Redraw text mask onto composite canvas
    let txtCnv = document.createElement('canvas');
    txtCnv.width  = W;
    txtCnv.height = H;
    let tctx = txtCnv.getContext('2d');
    let lines = maskText.split('\n');
    let lineHeight = fontSize * 1.1;
    let startY = H / 2 - (lines.length * lineHeight) / 2 + lineHeight / 2;
    tctx.fillStyle    = '#fff';
    tctx.font         = `bold ${fontSize}px Arial`;
    tctx.textAlign    = 'center';
    tctx.textBaseline = 'middle';
    for (let i = 0; i < lines.length; i++) {
      tctx.fillText(lines[i], W / 2, startY + i * lineHeight);
    }
    tctx.globalCompositeOperation = 'source-in';
    tctx.drawImage(swarmCnv, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(txtCnv, 0, 0);
  } else {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(swarmCnv, 0, 0);
  }
}