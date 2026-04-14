// Шейдерный вариант с контролем толщины линий + GPU text mask

let theShader;
let rx1, rx2, rx3;
let ry1, ry2, ry3;
let x1, x2, x3;
let y1, y2, y3;
let angle;
let time;
let spacingSlider, stepSlider, frequencyMultiplierSlider, frequencySlider, amplitudeSlider, thicknessSlider;
let warpSlider;
let maskSmoothnessSlider;
let flickerSlider;
let sound, fft;

let maskInp, fontSzSlider, maskOnBtn;
let maskOn = true;
let maskCanvas, maskCtx;
let maskG;

// color sliders
let coolR, coolG, coolB;
let warmR, warmG, warmB;
let coolSwatch, warmSwatch;

// random mode
let randomOn = false;
let randomBtn;
let randomPhases = {};   // per-parameter phase offsets so each moves independently
let randomSpeeds = {};   // per-parameter sinusoid speed
let randomAmps   = {};   // per-parameter amplitude of drift

function createSliderWithLabel(min, max, val, step, x, y, labelTxt) {
  let slider = createSlider(min, max, val, step);
  slider.position(x, y);
  slider.style('width', '140px');
  let lbl = createSpan(labelTxt);
  lbl.position(x + 150, y + 2);
  lbl.style('color', 'white');
  lbl.style('font-size', '13px');
  lbl.style('font-family', 'monospace');
  lbl.style('position', 'absolute');
  lbl.style('white-space', 'nowrap');
  return slider;
}

function createColorSlider(x, y, label, val, color) {
  let lbl = createSpan(label);
  lbl.position(x, y + 2);
  lbl.style('color', color);
  lbl.style('font-size', '11px');
  lbl.style('font-family', 'monospace');
  lbl.style('position', 'absolute');
  lbl.style('width', '10px');

  let sl = createSlider(0, 1, val, 0.001);
  sl.position(x + 14, y);
  sl.style('width', '90px');
  sl.style('accent-color', color);
  return sl;
}

function preload() {
  theShader = new p5.Shader(this.renderer,
    `
    precision highp float;
    attribute vec3 aPosition;
    attribute vec2 aTexCoord;
    varying vec2 vTexCoord;
    void main() {
      vTexCoord = aTexCoord;
      vec4 positionVec4 = vec4(aPosition, 1.0);
      positionVec4.xy = positionVec4.xy * 2.0 - 1.0;
      gl_Position = positionVec4;
    }
    `,
    `
    precision highp float;
    varying vec2 vTexCoord;
    uniform float u_time;
    uniform vec2  u_resolution;
    uniform float u_rx1; uniform float u_ry1;
    uniform float u_rx2; uniform float u_ry2;
    uniform float u_rx3; uniform float u_ry3;
    uniform float u_x1;  uniform float u_y1;
    uniform float u_x2;  uniform float u_y2;
    uniform float u_x3;  uniform float u_y3;
    uniform float u_angle;
    uniform float u_spacing;
    uniform float u_step;
    uniform float u_frequency;
    uniform float u_amplitude;
    uniform float u_thickness;
    uniform float u_warp;
    uniform float u_frequencyMultiplier;
    uniform float u_maskSmoothness;
    uniform float u_flicker;
    uniform sampler2D u_mask;
    uniform float u_useMask;
    uniform vec3 u_cool;
    uniform vec3 u_warm;

    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }
    vec2 hash2(vec2 p) {
      p = vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3)));
      return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
    }
    float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      float a = dot(hash2(i + vec2(0.0,0.0)), f - vec2(0.0,0.0));
      float b = dot(hash2(i + vec2(1.0,0.0)), f - vec2(1.0,0.0));
      float c = dot(hash2(i + vec2(0.0,1.0)), f - vec2(0.0,1.0));
      float d = dot(hash2(i + vec2(1.0,1.0)), f - vec2(1.0,1.0));
      return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
    }
    float fbm(vec2 p) {
      float value = 0.0; float amplitude = 0.5; float frequency = 1.0;
      float multiplier = u_frequencyMultiplier;
      for (int i = 0; i < 4; i++) {
        value += amplitude * noise(p * frequency);
        amplitude *= 0.5; frequency *= multiplier;
      }
      return value;
    }

    void main() {
      vec2 fragCoord = gl_FragCoord.xy;
      vec2 res = u_resolution;

      vec2 maskUV = vec2(fragCoord.x / res.x, 1.0 - fragCoord.y / res.y);
      float maskVal = texture2D(u_mask, maskUV).r;
      float maskEdgeLow = 0.1;
      float maskEdgeHigh = maskEdgeLow + u_maskSmoothness;
      float maskAlpha = u_useMask > 0.5
        ? smoothstep(maskEdgeLow, maskEdgeHigh, maskVal)
        : 1.0;
      if (maskAlpha < 0.01) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
        return;
      }

      vec3 fields_x  = vec3(u_x1, u_x2, u_x3) * res.x;
      vec3 fields_y  = vec3(u_y1, u_y2, u_y3) * res.y;
      vec3 fields_rx = vec3(u_rx1, u_rx2, u_rx3);
      vec3 fields_ry = vec3(u_ry1, u_ry2, u_ry3);

      float angleValue = 3.14159 / u_angle;
      float nx = cos(angleValue + 1.5708);
      float ny = sin(angleValue + 1.5708);
      float baseY = fragCoord.y - fragCoord.x * tan(angleValue);
      float lineThickness = u_step * u_thickness;
      float baseIndex1 = floor(baseY / u_spacing);
      float baseLine1  = baseIndex1 * u_spacing;
      float baseLine2  = (baseIndex1 + 1.0) * u_spacing;
      float weight1 = max(0.0, 1.0 - abs(baseY - baseLine1) / lineThickness);
      float weight2 = max(0.0, 1.0 - abs(baseY - baseLine2) / lineThickness);
      float totalWeight = weight1 + weight2;
      if (totalWeight < 0.01) { gl_FragColor = vec4(0.0,0.0,0.0,0.0); return; }

      vec2 noiseCoord = fragCoord / res * 3.0;
      vec2 warp = vec2(
        fbm(noiseCoord + vec2(u_time * 0.1, 0.0)),
        fbm(noiseCoord + vec2(0.0, u_time * 0.13))
      );
      vec2 point = fragCoord + warp * u_warp;

      float waveSum = 0.0;
      for (int i = 0; i < 3; i++) {
        float fx  = fields_x[i];  float fy  = fields_y[i];
        float frx = fields_rx[i]; float fry = fields_ry[i];
        vec2 diff = point - vec2(fx, fy);
        float dx = diff.x / frx; float dy = diff.y / fry;
        float distWaves = dx*dx + dy*dy;
        float noisyPhase = fbm(noiseCoord * 1.5 + float(i) * 1.7 + u_time * 0.05);
        waveSum += sin(distWaves * u_frequency * 10.0 - u_time + noisyPhase * 3.14159);
      }

      float offset = waveSum * u_amplitude;
      vec2 displacedPoint = point + vec2(nx * offset, ny * offset);
      float pointSize   = 0.05 * u_thickness;
      float distToPoint = length(fragCoord - displacedPoint);
      float brightness  = smoothstep(pointSize * 1.5, 0.0, distToPoint);
      brightness = brightness * brightness * 1.5;
      float flicker = u_flicker;
      float finalAlpha = brightness * totalWeight * 0.9 * maskAlpha;

      vec3 baseColor  = mix(u_cool, u_warm, waveSum * 0.5 + 0.5);
      vec3 finalColor = baseColor * brightness * flicker * totalWeight * maskAlpha;

      gl_FragColor = vec4(finalColor, finalAlpha);
    }
    `
  );

  sound = loadSound('music3.mp3');
}

function rebuildMask() {
  let raw      = maskInp.elt.value || 'WA\nVE';
  let lines    = raw.split('\n').filter(l => l.trim().length > 0);
  let fontSize = fontSzSlider.value();
  let ctx      = maskG.drawingContext;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, maskG.width, maskG.height);
  ctx.fillStyle    = '#fff';
  ctx.font         = `bold ${fontSize}px "Arial Black", Impact, Arial`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.filter       = 'blur(2px)';

  let lineHeight = fontSize * 1.15;
  let totalH     = lineHeight * lines.length;
  let startY     = (maskG.height - totalH) / 2 + lineHeight / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], maskG.width / 2, startY + i * lineHeight);
  }
  ctx.filter = 'none';
}

// ── Random mode helpers ──────────────────────────────────────────────────────

// Each animated parameter gets its own sinusoid:
//   value(t) = center + amp * sin(speed * t + phase)
// center = the slider's current value at the moment RANDOM is turned ON.
// amp    = fraction of the slider's range (different per param type)
// speed  = slow, randomised per param so they all drift at different rates

let randomCenters = {};  // snapshot of slider values when random mode is enabled

// Descriptors for the 12 parameters we animate
const RANDOM_PARAMS = [
  { key: 'rx1', slider: () => rx1, min: 50,   max: 400,  ampFrac: 0.12 },
  { key: 'rx2', slider: () => rx2, min: 50,   max: 400,  ampFrac: 0.12 },
  { key: 'rx3', slider: () => rx3, min: 50,   max: 400,  ampFrac: 0.12 },
  { key: 'ry1', slider: () => ry1, min: 50,   max: 400,  ampFrac: 0.12 },
  { key: 'ry2', slider: () => ry2, min: 50,   max: 400,  ampFrac: 0.12 },
  { key: 'ry3', slider: () => ry3, min: 50,   max: 400,  ampFrac: 0.12 },
  { key: 'x1',  slider: () => x1,  min: 0.01, max: 0.99, ampFrac: 0.08 },
  { key: 'x2',  slider: () => x2,  min: 0.01, max: 0.99, ampFrac: 0.08 },
  { key: 'x3',  slider: () => x3,  min: 0.01, max: 0.99, ampFrac: 0.08 },
  { key: 'y1',  slider: () => y1,  min: 0.01, max: 0.99, ampFrac: 0.08 },
  { key: 'y2',  slider: () => y2,  min: 0.01, max: 0.99, ampFrac: 0.08 },
  { key: 'y3',  slider: () => y3,  min: 0.01, max: 0.99, ampFrac: 0.08 },
];

function startRandom() {
  // Snapshot current slider values as centers, assign random phases & speeds
  for (let p of RANDOM_PARAMS) {
    let sl = p.slider();
    randomCenters[p.key] = sl.value();
    randomPhases[p.key]  = random(TWO_PI);
    // speed in radians per frame — between ~0.003 and ~0.012 (very slow drift)
    randomSpeeds[p.key]  = random(0.003, 0.012);
    randomAmps[p.key]    = (p.max - p.min) * p.ampFrac;
  }
}

// Returns the animated value for a parameter at the current frame
function randomValue(key, min, max) {
  let center = randomCenters[key];
  let amp    = randomAmps[key];
  let v      = center + 0.6*amp * sin(randomSpeeds[key] * frameCount + randomPhases[key]); //0.45 процент амплитуды изменения рандомизированных параметров в функции startRandom, оптимально 0.3-0.6
  return constrain(v, min, max);
}

// ── Setup ────────────────────────────────────────────────────────────────────

function setup() {
  let cnv = createCanvas(600, 600, WEBGL);
  pixelDensity(1);
  cnv.position(0, 0);

  maskG = createGraphics(600, 600);
  maskG.pixelDensity(1);

  fft = new p5.FFT(0.8, 1024);
  cnv.mousePressed(() => {
    if (sound.isPlaying()) { sound.pause(); }
    else { sound.loop(); fft.setInput(sound); }
  });

  document.body.style.margin = '0';
  document.body.style.overflow = 'visible';
  document.body.style.backgroundColor = '#000';

  angleMode(RADIANS);
  noStroke();

  let sx = width + 20;
  rx1 = createSliderWithLabel(50, 400, 220, 1,        sx, 20,  'rx1');
  ry1 = createSliderWithLabel(50, 400, 160, 1,        sx, 50,  'ry1');
  rx2 = createSliderWithLabel(50, 400, 200, 1,        sx, 80,  'rx2');
  ry2 = createSliderWithLabel(50, 400, 150, 1,        sx, 110, 'ry2');
  rx3 = createSliderWithLabel(50, 400, 260, 1,        sx, 140, 'rx3');
  ry3 = createSliderWithLabel(50, 400, 180, 1,        sx, 170, 'ry3');
  x1  = createSliderWithLabel(0.01, 0.99, 0.28, 0.01, sx, 210, 'x1');
  y1  = createSliderWithLabel(0.01, 0.99, 0.45, 0.01, sx, 240, 'y1');
  x2  = createSliderWithLabel(0.01, 0.99, 0.76, 0.01, sx, 270, 'x2');
  y2  = createSliderWithLabel(0.01, 0.99, 0.34, 0.01, sx, 300, 'y2');
  x3  = createSliderWithLabel(0.01, 0.99, 0.67, 0.01, sx, 330, 'x3');
  y3  = createSliderWithLabel(0.01, 0.99, 0.23, 0.01, sx, 360, 'y3');
  angle     = createSliderWithLabel(0.1, 6,    1,    0.01,   sx, 400, 'angle');
  time      = createSliderWithLabel(0.001, 0.2, 0.05, 0.001, sx, 430, 'time');
  spacingSlider            = createSliderWithLabel(0.5, 50,  0.5,    0.01,   sx, 470, 'space');
  stepSlider               = createSliderWithLabel(1, 30,    10,     0.5,    sx, 500, 'step');
  frequencyMultiplierSlider= createSliderWithLabel(0.5, 10,  3,      0.1,    sx, 530, 'distort');
  frequencySlider          = createSliderWithLabel(0.001, 2, 0.01,   0.0001, sx, 560, 'freq');
  amplitudeSlider          = createSliderWithLabel(0.01, 1,  0.1,    0.01,   sx, 590, 'amp');
  thicknessSlider          = createSliderWithLabel(0.1, 5,   1.5,    0.1,    sx, 620, 'thick');
  warpSlider               = createSliderWithLabel(0, 3,     1,      0.1,    sx, 650, 'warp');
  maskSmoothnessSlider     = createSliderWithLabel(0.01, 1,  0.1,    0.01,   sx, 680, 'mask edge');
  flickerSlider            = createSliderWithLabel(0.3, 2,   0.7,    0.01,   sx, 710, 'smooth');

  let hint = createSpan('▶ click canvas to play / pause');
  hint.position(sx, 754);
  hint.style('color', '#888'); hint.style('font-size', '12px');
  hint.style('font-family', 'monospace'); hint.style('position', 'absolute');

  // ── mask controls — below canvas LEFT ────────────────────────────────
  let bx = 0;
  let by = 620;

  let maskLbl = createSpan('— text mask —');
  maskLbl.position(bx, by);
  maskLbl.style('color', '#999'); maskLbl.style('font-size', '11px');
  maskLbl.style('font-family', 'monospace'); maskLbl.style('position', 'absolute');

  maskInp = createElement('textarea');
  maskInp.position(bx, by + 20);
  maskInp.style('font-size', '18px'); maskInp.style('font-weight', 'bold');
  maskInp.style('width', '140px');    maskInp.style('height', '80px');
  maskInp.style('padding', '4px 6px'); maskInp.style('resize', 'vertical');
  maskInp.style('background', '#111'); maskInp.style('color', '#fff');
  maskInp.style('border', '1px solid #555'); maskInp.style('font-family', 'monospace');
  maskInp.style('line-height', '1.2');
  maskInp.elt.value = 'WA\nVE';
  maskInp.input(rebuildMask);

  maskOnBtn = createButton('ON/OFF');
  maskOnBtn.position(bx + 158, by + 20);
  maskOnBtn.style('font-family', 'monospace'); maskOnBtn.style('font-size', '12px');
  maskOnBtn.style('background', '#1a1a1a'); maskOnBtn.style('color', '#0df');
  maskOnBtn.style('border', '1px solid #0df'); maskOnBtn.style('padding', '4px 8px');
  maskOnBtn.style('cursor', 'pointer'); maskOnBtn.style('white-space', 'nowrap');
  maskOnBtn.mousePressed(() => {
    maskOn = !maskOn;
    maskOnBtn.html(maskOn ? 'ON!' : 'OFF');
    maskOnBtn.style('color',  maskOn ? '#0df' : '#888');
    maskOnBtn.style('border', maskOn ? '1px solid #0df' : '1px solid #555');
  });

  fontSzSlider = createSliderWithLabel(30, 400, 200, 1, bx, by + 115, 'font size');
  fontSzSlider.input(rebuildMask);

  // ── RANDOM button ─────────────────────────────────────────────────────
  randomBtn = createButton('RANDOM');
  randomBtn.position(bx + 158, by + 55);
  randomBtn.style('font-family', 'monospace'); randomBtn.style('font-size', '12px');
  randomBtn.style('background', '#1a1a1a'); randomBtn.style('color', '#888');
  randomBtn.style('border', '1px solid #555'); randomBtn.style('padding', '4px 8px');
  randomBtn.style('cursor', 'pointer'); randomBtn.style('white-space', 'nowrap');
  randomBtn.mousePressed(() => {
    randomOn = !randomOn;
    if (randomOn) startRandom();   // snapshot centers + randomise phases/speeds
    randomBtn.style('color',  randomOn ? '#ff0' : '#888');
    randomBtn.style('border', randomOn ? '1px solid #ff0' : '1px solid #555');
  });

  // ── color sliders ─────────────────────────────────────────────────────
  let cx = bx + 258;
  let cy = by + 50;
  let colGap = 120;

  coolSwatch = document.createElement('canvas');
  coolSwatch.width = 40; coolSwatch.height = 16;
  coolSwatch.style.position = 'absolute';
  coolSwatch.style.left = cx + 'px';
  coolSwatch.style.top  = (cy - 20) + 'px';
  coolSwatch.style.borderRadius = '3px';
  coolSwatch.style.border = '1px solid #444';
  document.body.appendChild(coolSwatch);

  warmSwatch = document.createElement('canvas');
  warmSwatch.width = 40; warmSwatch.height = 16;
  warmSwatch.style.position = 'absolute';
  warmSwatch.style.left = (cx + colGap) + 'px';
  warmSwatch.style.top  = (cy - 20) + 'px';
  warmSwatch.style.borderRadius = '3px';
  warmSwatch.style.border = '1px solid #444';
  document.body.appendChild(warmSwatch);

  coolR = createColorSlider(cx,          cy,      'R', 0.016, '#f55');
  coolG = createColorSlider(cx,          cy + 22, 'G', 0.851, '#5f5');
  coolB = createColorSlider(cx,          cy + 44, 'B', 1.0,   '#55f');

  warmR = createColorSlider(cx + colGap, cy,      'R', 0.047, '#f55');
  warmG = createColorSlider(cx + colGap, cy + 22, 'G', 0.011, '#5f5');
  warmB = createColorSlider(cx + colGap, cy + 44, 'B', 0.8,   '#55f');

  rebuildMask();
}

// ── Draw ─────────────────────────────────────────────────────────────────────

function draw() {
  background(255);
  shader(theShader);

  theShader.setUniform('u_resolution', [width * pixelDensity(), height * pixelDensity()]);
  theShader.setUniform('u_time', frameCount * time.value());

  // In random mode use animated values; otherwise read sliders normally
  let rv = (key, sl, mn, mx) => randomOn ? randomValue(key, mn, mx) : sl.value();

  theShader.setUniform('u_rx1', rv('rx1', rx1, 50,   400));
  theShader.setUniform('u_ry1', rv('ry1', ry1, 50,   400));
  theShader.setUniform('u_rx2', rv('rx2', rx2, 50,   400));
  theShader.setUniform('u_ry2', rv('ry2', ry2, 50,   400));
  theShader.setUniform('u_rx3', rv('rx3', rx3, 50,   400));
  theShader.setUniform('u_ry3', rv('ry3', ry3, 50,   400));
  theShader.setUniform('u_x1',  rv('x1',  x1,  0.01, 0.99));
  theShader.setUniform('u_y1',  rv('y1',  y1,  0.01, 0.99));
  theShader.setUniform('u_x2',  rv('x2',  x2,  0.01, 0.99));
  theShader.setUniform('u_y2',  rv('y2',  y2,  0.01, 0.99));
  theShader.setUniform('u_x3',  rv('x3',  x3,  0.01, 0.99));
  theShader.setUniform('u_y3',  rv('y3',  y3,  0.01, 0.99));

  theShader.setUniform('u_angle',               angle.value());
  theShader.setUniform('u_spacing',             spacingSlider.value());
  theShader.setUniform('u_step',                stepSlider.value());
  theShader.setUniform('u_frequencyMultiplier', frequencyMultiplierSlider.value());
  theShader.setUniform('u_frequency',           frequencySlider.value());
  theShader.setUniform('u_thickness',           thicknessSlider.value());
  theShader.setUniform('u_maskSmoothness',      maskSmoothnessSlider.value());
  theShader.setUniform('u_flicker',             flickerSlider.value());

  let bassOffset = 0, trebleOffset = 0;
  if (sound && sound.isPlaying()) {
    fft.analyze();
    bassOffset   = map(fft.getEnergy('lowMid'), 200, 255, -0.4,  0.4);
    trebleOffset = map(fft.getEnergy('treble'), 10,  20, -0.02, 0.02);
  }
  theShader.setUniform('u_warp',      warpSlider.value() + bassOffset);
  theShader.setUniform('u_amplitude', amplitudeSlider.value() + trebleOffset);

  theShader.setUniform('u_mask',    maskG);
  theShader.setUniform('u_useMask', maskOn ? 1.0 : 0.0);

  theShader.setUniform('u_cool', [coolR.value(), coolG.value(), coolB.value()]);
  theShader.setUniform('u_warm', [warmR.value(), warmG.value(), warmB.value()]);

  // update color swatches
  let cctx = coolSwatch.getContext('2d');
  cctx.fillStyle = `rgb(${Math.round(coolR.value()*255)},${Math.round(coolG.value()*255)},${Math.round(coolB.value()*255)})`;
  cctx.fillRect(0, 0, coolSwatch.width, coolSwatch.height);

  let wctx = warmSwatch.getContext('2d');
  wctx.fillStyle = `rgb(${Math.round(warmR.value()*255)},${Math.round(warmG.value()*255)},${Math.round(warmB.value()*255)})`;
  wctx.fillRect(0, 0, warmSwatch.width, warmSwatch.height);

  rect(0, 0, width, height);
}