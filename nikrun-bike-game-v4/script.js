/* ── State constants ───────────────────────────── */
var STATE_INTRO = 0, STATE_GAME = 1, STATE_DEMO = 2, STATE_OUTRO = 3;
var appState = STATE_INTRO;

/* ── DOM refs ──────────────────────────────────── */
var introEl   = document.getElementById('intro');
var gameEl    = document.getElementById('game');
var outroEl   = document.getElementById('outro');
var skyEl     = document.getElementById('sky');
var groundEl  = document.getElementById('ground');
var bgWrap    = document.getElementById('bg-wrap');
var bgTrack   = document.getElementById('bg-track');
var bgTileA   = document.getElementById('bg-a');
var bgTileB   = document.getElementById('bg-b');
var gameChar  = document.getElementById('game-char');
var charWrap  = document.getElementById('game-char-wrap');
var obsLayer  = document.getElementById('obstacles-layer');
var scoreVal  = document.getElementById('score-val');
var timerVal  = document.getElementById('timer-val');

/* ── Background scroll (JS-driven) ────────────── */
var bgScrollX       = 0;
var BG_SCROLL_SPEED = 5.64; /* px per frame  (4.9 × 1.15) */
var BG_TILE_W       = 400;

/* ── Game physics constants ────────────────────── */
var GROUND_Y    = 124;   /* y from top where characters stand */
var CHAR_LEFT   = 42;
var JUMP_FORCE  = 7.56;
var GRAVITY     = 0.42;
var OBS_SPEED   = 6.1;   /* px per 60fps frame  (5.3 × 1.15) */

/* delta-time: normalize all movement to 60 fps regardless of device refresh rate */
var TARGET_DT   = 1000 / 60;  /* ~16.67 ms */
var lastFrameTime = 0;

/* ── Game state vars ───────────────────────────── */
var gameChoice   = null;
var score        = 0;
var timeLeft     = 20;
var charOffsetY  = 0;    /* px upward from ground */
var velY         = 0;
var isJumping    = false;
var gameRunning  = false;
var isDemo       = false;
var animFrameId  = null;
var gameTimerIv  = null;
var introTimeout = null;
var obstacles    = [];
var nextSpawnFr  = 90;
var frameCt      = 0;
var lastObsIdx   = -1;   /* prevents same obstacle twice in a row */
var CHAR_W       = 72;
var CHAR_H       = 42;
var charRotation  = 0;   /* current tilt degrees */
var landingFrames = 0;   /* counts frames in landing settle */

/* ── Engine sound ─────────────────────────────── */
var _engAudio = null;

function startEngineSound() {
  try {
    if (_engAudio) { try { _engAudio.pause(); } catch(e){} }
    var a = new Audio('kimsa-kimsa-big-motorcycle-sound-394700.mp3');
    a.loop   = true;
    a.volume = 0;
    _engAudio = a;
    var prom = a.play();
    if (prom && prom.then) {
      prom.then(function() { _fadeInEngine(a); }).catch(function(){});
    } else {
      _fadeInEngine(a);
    }
  } catch (e) {}
}

function _fadeInEngine(a) {
  var start = null;
  (function tick(ts) {
    if (_engAudio !== a) return;   /* اگر stop شده، قطع کن */
    if (!start) start = ts;
    var p = Math.min((ts - start) / 800, 1);
    a.volume = p * 0.63;
    if (p < 1) requestAnimationFrame(tick);
  })(performance.now());
}

function stopEngineSound() {
  var a = _engAudio;
  _engAudio = null;
  if (!a) return;
  var start = null;
  var vol = a.volume;
  (function tick(ts) {
    if (!start) start = ts;
    var p = Math.min((ts - start) / 500, 1);
    a.volume = vol * (1 - p);
    if (p < 1) requestAnimationFrame(tick);
    else { try { a.pause(); } catch(e){} }
  })(performance.now());
}

var _sfxCtx = null;
function _getSfxCtx() {
  if (!_sfxCtx) _sfxCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _sfxCtx;
}

/* صدای امتیاز — دو نت صعودی شاد */
function playScoreSound() {
  try {
    var ctx = _getSfxCtx();
    [{ f: 880, t: 0 }, { f: 1320, t: 0.1 }].forEach(function (n) {
      var osc  = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.f, ctx.currentTime + n.t);
      gain.gain.setValueAtTime(0, ctx.currentTime + n.t);
      gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + n.t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.t + 0.18);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(ctx.currentTime + n.t);
      osc.stop(ctx.currentTime + n.t + 0.2);
    });
  } catch (e) {}
}

/* صدای برخورد — نت نزولی کوتاه */
function playHitSound() {
  try {
    var ctx  = _getSfxCtx();
    var osc  = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(380, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.22);
  } catch (e) {}
}

/* ── Obstacle definitions ──────────────────────── */
var OBS_RED = [
  { src: 'obs-cone.png', w: 18, h: 27 }
];
var OBS_GREEN = [
  { src: 'obs-bush1.png', w: 29, h: 21 },
  { src: 'obs-rock1.png', w: 31, h: 23 },
  { src: 'obs-rock2.png', w: 23, h: 17 },
  { src: 'obs-bush2.png', w: 31, h: 15 }
];

/* ════════════════════════════════════════════════
   INTRO
   ════════════════════════════════════════════════ */
function startIntro() {
  fire_tag(ALL_EVENT_TYPES.VISIT_SLIDE01);

  var gw = document.getElementById('bike-green-wrap');
  var rw = document.getElementById('bike-red-wrap');
  var it = document.getElementById('intro-text');

  var mn_g = gw.querySelector('.model-name');
  var mn_r = rw.querySelector('.model-name');

  gsap.set(gw,   { x:  220, opacity: 0 });
  gsap.set(rw,   { x: -220, opacity: 0 });
  gsap.set(it,   { opacity: 0, xPercent: -50, yPercent: -50, y: -10 });
  gsap.set(mn_g, { opacity: 0, y: 12, scale: 0.75 });
  gsap.set(mn_r, { opacity: 0, y: 12, scale: 0.75 });

  gsap.timeline()
    .to(gw,   { x: 0, opacity: 1, duration: 0.75, ease: 'power3.out' },    0)
    .to(rw,   { x: 0, opacity: 1, duration: 0.75, ease: 'power3.out' },    0)
    .to(it,   { opacity: 1, y: 0, duration: 0.5,  ease: 'power2.out' },    0.35)
    .to(mn_g, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(2.8)' }, 0.82)
    .to(mn_r, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(2.8)' }, 0.94);

  introTimeout = setTimeout(function () {
    if (appState === STATE_INTRO) startDemo();
  }, 10000);
}

/* ════════════════════════════════════════════════
   SCENE SETUP (sky / ground / background strip)
   ════════════════════════════════════════════════ */
function setupScene(choice) {
  bgScrollX = 0;
  bgTrack.style.transform = 'translateX(0px)';

  if (choice === 'red') {
    groundEl.style.background     = '#504030';
    bgTrack.style.backgroundImage = "url('33pol-loop.png')";
  } else {
    groundEl.style.background     = '#3c4228';
    bgTrack.style.backgroundImage = "url('forest-loop.png')";
  }
}

/* ════════════════════════════════════════════════
   START GAME
   ════════════════════════════════════════════════ */
function startGame(choice) {
  if (appState !== STATE_INTRO && appState !== STATE_DEMO) return;
  appState = STATE_GAME;
  gameChoice = choice;
  clearTimeout(introTimeout);

  fire_tag(ALL_EVENT_TYPES.VISIT_SLIDE02);
  if (choice === 'green') fire_tag(ALL_EVENT_TYPES.CLICK1);
  else                    fire_tag(ALL_EVENT_TYPES.CLICK2);

  var mbg = document.getElementById('model-badge-game');
  var mig = document.getElementById('model-img-game');
  if (choice === 'green') {
    mbg.style.background = 'rgba(20,55,15,0.82)';
    mbg.style.border     = '1px solid rgba(80,220,60,0.35)';
    mig.src = 'model-green.png';
  } else {
    mbg.style.background = 'rgba(60,15,15,0.82)';
    mbg.style.border     = '1px solid rgba(220,60,60,0.35)';
    mig.src = 'model-red.png';
  }
  mbg.style.display = 'flex';

  resetGameVars();

  gsap.to(introEl, {
    opacity: 0, duration: 0.4, overwrite: 'auto',
    onComplete: function () {
      introEl.style.display = 'none';
      document.getElementById('banner-content').classList.add('game-active');
      setupScene(choice);

      if (choice === 'green') {
        gameChar.src = 'char-green.png';
        CHAR_W = 95; CHAR_H = 66;
        gameChar.style.width = '95px';
      } else {
        gameChar.src = 'char-red.png';
        CHAR_W = 86; CHAR_H = 60;
        gameChar.style.width = '86px';
      }

      gameEl.style.display  = 'block';
      gameEl.style.opacity  = '0';
      startBgScroll();

      gsap.to(gameEl, {
        opacity: 1, duration: 0.4,
        onComplete: function () {
          beginGameLoop();
          startTimer(20);
        }
      });
    }
  });
}

/* ════════════════════════════════════════════════
   GAME LOOP
   ════════════════════════════════════════════════ */
function resetGameVars() {
  score         = 0;
  timeLeft      = 20;
  charOffsetY   = 0;
  velY          = 0;
  isJumping     = false;
  gameRunning   = false;
  obstacles     = [];
  nextSpawnFr   = 90;
  frameCt       = 0;
  lastFrameTime = 0;
  lastObsIdx    = -1;
  obsLayer.innerHTML = '';
  scoreVal.textContent = '0';
  timerVal.textContent = '20';
  charWrap.style.transform = 'translateY(0px) rotate(0deg)';
  charRotation  = 0;
  landingFrames = 0;
}

function beginGameLoop() {
  gameRunning   = true;
  lastFrameTime = 0;
  startEngineSound();

  (function loop(timestamp) {
    if (!gameRunning) return;

    /* ─ Delta-time: normalise to 60 fps ─ */
    if (!lastFrameTime) lastFrameTime = timestamp;
    var dt      = timestamp - lastFrameTime;
    lastFrameTime = timestamp;
    /* cap at 3 frames to avoid giant jumps after tab-blur or slow start */
    var dtScale = Math.min(dt / TARGET_DT, 3);

    frameCt += dtScale;   /* virtual frame counter — same rate on all devices */

    /* ─ Physics ─ */
    if (isJumping || charOffsetY > 0) {
      velY        -= GRAVITY * dtScale;
      charOffsetY += velY * dtScale;
      if (charOffsetY > 82) { charOffsetY = 82; velY = 0; }
      if (charOffsetY <= 0) {
        charOffsetY   = 0; velY = 0; isJumping = false;
        landingFrames = 1;           /* begin landing settle */
      }
    }

    /* ─ Rotation physics ─ */
    if (isJumping || charOffsetY > 0) {
      /* airborne: nose-up on ascent, nose-down on descent */
      landingFrames = 0;
      var targetRot = velY > 0 ? -45 : 15;
      charRotation += (targetRot - charRotation) * 0.14 * dtScale;
    } else if (landingFrames > 0) {
      /* landing settle: front wheel already down, rear wheel flattens */
      charRotation += (0 - charRotation) * 0.28 * dtScale;
      landingFrames += dtScale;
      if (Math.abs(charRotation) < 0.4) { charRotation = 0; landingFrames = 0; }
    } else {
      charRotation = 0;
    }

    charWrap.style.transform =
      'translateY(-' + charOffsetY + 'px) rotate(' + charRotation.toFixed(1) + 'deg)';

    /* ─ Obstacles ─ */
    var alive = [];
    for (var i = 0; i < obstacles.length; i++) {
      var o = obstacles[i];
      o.x -= OBS_SPEED * dtScale;
      o.el.style.left = Math.round(o.x) + 'px';

      /* score */
      if (!o.scored && o.x + o.w < CHAR_LEFT + 15) {
        o.scored = true;
        score++;
        scoreVal.textContent = score;
        playScoreSound();
      }

      /* collision flash — red tint + opacity blink */
      if (!o.hit && checkHit(o)) {
        o.hit = true;
        playHitSound();
        gsap.killTweensOf(gameChar);
        gsap.set(gameChar, { filter: 'brightness(2) saturate(0) sepia(1) hue-rotate(-20deg)' });
        gsap.to(gameChar, {
          opacity: 0.15, duration: 0.07, yoyo: true, repeat: 7, ease: 'none',
          onComplete: function () {
            gsap.set(gameChar, { opacity: 1, filter: 'none' });
          }
        });
      }

      if (o.x > -120) alive.push(o);
      else o.el.remove();
    }
    obstacles = alive;

    /* ─ Spawn ─ */
    if (frameCt >= nextSpawnFr) {
      spawnObstacle();
      var gaps = gameChoice === 'red'
        ? [40, 50, 60, 75, 90, 110]
        : [45, 55, 65, 80, 95, 110];
      nextSpawnFr = frameCt + gaps[Math.floor(Math.random() * gaps.length)];
    }

    /* ─ Background scroll (GPU-composited via transform) ─ */
    bgScrollX -= BG_SCROLL_SPEED * dtScale;
    if (bgScrollX <= -207) bgScrollX += 207;   /* seamless: tile width = 207px (1000×600 @ h124) */
    bgTrack.style.transform = 'translateX(' + bgScrollX + 'px)';

    /* ─ Demo auto-jump ─ */
    if (isDemo && !isJumping) {
      for (var j = 0; j < obstacles.length; j++) {
        var dist = obstacles[j].x - (CHAR_LEFT + CHAR_W);
        if (dist > 0 && dist < 86) { doJump(); break; }
      }
    }

    animFrameId = requestAnimationFrame(loop);
  })(performance.now());
}

function checkHit(o) {
  var cL = CHAR_LEFT + Math.round(CHAR_W * 0.18);
  var cR = CHAR_LEFT + Math.round(CHAR_W * 0.82);
  var oL = o.x + 2;
  var oR = o.x + o.w - 2;
  /* Y: collision when character hasn't jumped above obstacle */
  return (cR > oL && cL < oR && charOffsetY < o.h - 4);
}

function spawnObstacle() {
  var pool = gameChoice === 'red' ? OBS_RED : OBS_GREEN;
  var idx;
  if (pool.length > 1) {
    do { idx = Math.floor(Math.random() * pool.length); } while (idx === lastObsIdx);
  } else {
    idx = 0;
  }
  lastObsIdx = idx;
  var t  = pool[idx];
  var el = document.createElement('img');
  el.src       = t.src;
  el.className = 'obstacle' + (gameChoice === 'green' ? ' obs-forest' : '');
  el.style.width  = t.w + 'px';
  el.style.height = t.h + 'px';
  el.style.left   = '410px';
  obsLayer.appendChild(el);
  obstacles.push({ x: 410, w: t.w, h: t.h, el: el, scored: false, hit: false });
}

function doJump() {
  if (!isJumping && charOffsetY <= 1) {
    velY      = JUMP_FORCE;
    isJumping = true;
  }
}

/* ── Scrolling background (driven by game loop) ── */
function startBgScroll() { /* scroll now runs inside beginGameLoop */ }
function stopBgScroll()  { /* scroll stops when gameRunning=false  */ }

/* ── Timer ─────────────────────────────────────── */
function startTimer(seconds) {
  timeLeft = seconds;
  timerVal.textContent = timeLeft;
  clearInterval(gameTimerIv);
  gameTimerIv = setInterval(function () {
    timeLeft--;
    timerVal.textContent = timeLeft < 0 ? 0 : timeLeft;
    if (timeLeft <= 0) {
      clearInterval(gameTimerIv);
      endGame();
    }
  }, 1000);
}

function endGame() {
  gameRunning = false;
  cancelAnimationFrame(animFrameId);
  clearInterval(gameTimerIv);
  stopBgScroll();
  isDemo = false;
  startOutro();
}

/* ════════════════════════════════════════════════
   DEMO MODE
   ════════════════════════════════════════════════ */
function startDemo() {
  if (appState !== STATE_INTRO) return;
  appState = STATE_DEMO;
  isDemo   = true;
  fire_tag(ALL_EVENT_TYPES.CLICK_AUTOPLAY);

  resetGameVars();
  setupScene('red');
  gameChar.src = 'char-red.png';
  CHAR_W = 72; CHAR_H = 50;
  gameChoice = 'red';

  gsap.to(introEl, {
    opacity: 0, duration: 0.4, overwrite: 'auto',
    onComplete: function () {
      introEl.style.display = 'none';
      document.getElementById('banner-content').classList.add('game-active');
      gameEl.style.display  = 'block';
      gameEl.style.opacity  = '0';
      startBgScroll();
      gsap.to(gameEl, {
        opacity: 1, duration: 0.35,
        onComplete: function () {
          beginGameLoop();
          startTimer(10);
        }
      });
    }
  });
}

/* ════════════════════════════════════════════════
   OUTRO
   ════════════════════════════════════════════════ */
function launchConfetti() {
  var layer = document.getElementById('confetti-layer');
  layer.innerHTML = '';
  var colors = ['#f0c840','#ff3030','#30ff80','#3080ff','#ff50ff','#50ffee','#ffffff','#ffaa20','#ff6090','#a0ff30','#ffe080','#60ffb0'];
  for (var i = 0; i < 130; i++) {
    var p   = document.createElement('div');
    var sz  = 5 + Math.floor(Math.random() * 10);
    var col = colors[i % colors.length];
    var br  = Math.random() > 0.45 ? '50%' : '2px';
    var dx  = Math.round((Math.random() - 0.5) * 320);
    var dur = (0.5 + Math.random() * 1.1).toFixed(2);
    var del = (Math.random() * 0.3).toFixed(2);
    var lft = Math.floor(Math.random() * 390);
    p.style.cssText =
      'position:absolute;width:' + sz + 'px;height:' + sz + 'px;' +
      'left:' + lft + 'px;top:-6px;' +
      'background:' + col + ';border-radius:' + br + ';' +
      '--dx:' + dx + 'px;' +
      'animation:confettiFall ' + dur + 's ease-out ' + del + 's forwards;';
    layer.appendChild(p);
  }
}

function buildLeaderboard(userScore) {
  var base = Math.max(userScore, 2);
  var fakeRows = [
    { name: 'ارشیا', score: base + 5 },
    { name: 'پارسا', score: base + 2 }
  ];
  var allRows = [
    fakeRows[0], fakeRows[1],
    { name: 'شما', score: userScore, me: true }
  ];
  allRows.sort(function(a, b) { return b.score - a.score; });

  var lbRows = document.getElementById('lb-rows');
  lbRows.innerHTML = '';
  allRows.forEach(function(r, idx) {
    var div = document.createElement('div');
    div.className = 'lb-row' + (r.me ? ' me' : '');
    div.innerHTML =
      '<span class="lb-rank">' + (idx + 1) + '</span>' +
      '<span class="lb-name">'  + r.name + (r.me ? ' ◀' : '') + '</span>' +
      '<span class="lb-score">' + r.score + '</span>';
    lbRows.appendChild(div);
  });
}

function startOutro() {
  appState = STATE_OUTRO;
  stopEngineSound();
  fire_tag(ALL_EVENT_TYPES.VISIT_SLIDE03);

  document.getElementById('model-badge-game').style.display = 'none';

  gsap.to(gameEl, {
    opacity: 0, duration: 0.6,
    onComplete: function () {
      gameEl.style.display  = 'none';
      outroEl.style.display = 'flex';
      outroEl.style.opacity = '1';

      document.getElementById('score-card-val').textContent = score;

      /* bg شروع از پایین */
      gsap.set('#outro-bg',   { y: 134 });
      gsap.set('#outro-logo', { opacity: 0, y: 10 });
      gsap.set('#score-card', { opacity: 0, scale: 0.35, y: 12 });
      gsap.set('#play-again', { opacity: 0, y: 8 });

      gsap.timeline({
        onComplete: function () {
          fire_tag(ALL_EVENT_TYPES.LOOP);
          setTimeout(function () { location.reload(); }, 100);
        }
      })
        .to('#outro-bg',   { y: 0, duration: 0.55, ease: 'power3.out' },                  0)
        .call(launchConfetti, [],                                                            0.52)
        .to('#outro-logo', { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' },       0.65)
        .to('#score-card', { opacity: 1, scale: 1, y: 0, duration: 0.7, ease: 'back.out(2.5)' }, 0.7)
        .to('#play-again', { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' },       1.2)
        .to({},            { duration: 7 })
        .to(outroEl,       { opacity: 0, duration: 0.5 });
    }
  });
}

/* play-again button */
(function () {
  var btn = document.getElementById('play-again');
  if (btn) btn.addEventListener('click', function (e) {
    e.stopPropagation();
    location.reload();
  });
})();

/* ════════════════════════════════════════════════
   GLOBAL CLICK HANDLER
   ════════════════════════════════════════════════ */
document.addEventListener('click', function (e) {
  if (appState === STATE_INTRO || appState === STATE_GAME || appState === STATE_DEMO) {
    e.stopImmediatePropagation();
  }
  if (appState === STATE_INTRO) {
    var bc   = document.getElementById('banner-content').getBoundingClientRect();
    var scaleX = bc.width / 400;
    var nx   = (e.clientX - bc.left) / scaleX;
    clearTimeout(introTimeout);
    if (nx < 200) startGame('red');
    else          startGame('green');
    return;
  }
  if (appState === STATE_GAME) {
    doJump();
  }
});

document.addEventListener('touchstart', function (e) {
  if (appState === STATE_GAME) doJump();
}, { passive: true });

/* spacebar / arrow-up for desktop testing */
document.addEventListener('keydown', function (e) {
  var code = e.code || e.key;
  if (code === 'Space' || code === ' ' || code === 'ArrowUp') {
    e.preventDefault();
    if (appState === STATE_GAME || appState === STATE_DEMO) { doJump(); return; }
    if (appState === STATE_INTRO) {
      clearTimeout(introTimeout);
      startGame('green');
    }
  }
});

/* ════════════════════════════════════════════════
   SPEED PARTICLES
   ════════════════════════════════════════════════ */
(function createSpeedParticles() {
  var layer = document.getElementById('speed-particles');
  var cols  = ['rgba(255,255,255,', 'rgba(180,210,255,', 'rgba(255,220,140,'];
  for (var i = 0; i < 26; i++) {
    var el   = document.createElement('div');
    el.className = 'sp-line';
    var top  = Math.floor(Math.random() * 127);
    var len  = 12 + Math.floor(Math.random() * 68);
    var dur  = (0.16 + Math.random() * 0.38).toFixed(2);
    var del  = (Math.random() * 3).toFixed(2);
    var op   = (0.07 + Math.random() * 0.26).toFixed(2);
    var col  = cols[Math.floor(Math.random() * cols.length)];
    el.style.cssText =
      'top:'    + top  + 'px;' +
      'width:'  + len  + 'px;' +
      'opacity:'+ op   + ';'   +
      'animation-duration:' + dur + 's;' +
      'animation-delay:-'   + del + 's;' +
      'background:linear-gradient(to right,transparent 0%,' + col + '0.8) 45%,transparent 100%);';
    layer.appendChild(el);
  }
})();

/* ════════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════════ */

/* force both bg PNGs into browser cache before game starts */
(function () {
  var pre = [new Image(), new Image()];
  pre[0].src = 'forest-loop.png';
  pre[1].src = '33pol-loop.png';
})();

startIntro();

/* ── fitBB — responsive fit for all devices & slot sizes ── */
function fitBB() {
  var vw = window.innerWidth  || 400;
  var vh = window.innerHeight || 150;

  /* primary: fill width — secondary: clamp so banner never overflows slot height */
  var scale = Math.min(vw / 400, vh / 134);

  /* center horizontally on wide slots (tablet / landscape) */
  var scaledW    = 400 * scale;
  var leftOffset = Math.round(Math.max(0, (vw - scaledW) / 2));

  var el = document.getElementById('banner-content');
  el.style.transformOrigin = 'top left';
  el.style.transform = 'scale(' + scale + ')';
  el.style.left = leftOffset + 'px';
  el.style.top  = '0px';
}
fitBB();
window.addEventListener('resize', fitBB);
