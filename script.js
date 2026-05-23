// ============================================================
// Bimeh.com — Plus Bimeh Money Discovery — bb-150 v3
// 5 scenes · 22s loop · sinusoidal coverage: 12→5→38→50→15
// ============================================================

var BILL_W = 46;
var BILL_H = 100;

// 4 base bills — fan out from behind phone (phone moves to right at x:316)
var BILL_DATA = [
    { x:  8, y: 22, rot: -12, img: '06.jpg', z: 10 },
    { x: 30, y: 27, rot:  -4, img: '07.jpg', z: 11 },
    { x: 52, y: 19, rot:   5, img: '06.jpg', z: 12 },
    { x: 74, y: 25, rot:  12, img: '07.jpg', z: 13 },
];

// Extra bills that emerge from behind phone in S4 (interactive click)
var EXTRA_BILL_DATA = [
    { x: 18, y: 20, rot: -20 },
    { x: 40, y: 29, rot:  16 },
    { x: 60, y: 16, rot: -10 },
    { x: 32, y: 32, rot:  22 },
];

var btn03Pulse  = null;
var btn05Pulse  = null;
var extraCount  = 0;
var inScene4    = false;

// ── Create the 4 base bill elements ─────────────────────────
function createBills() {
    var c = document.getElementById('banner-content');
    BILL_DATA.forEach(function (b, i) {
        var img = document.createElement('img');
        img.src = b.img;
        img.id  = 'bill' + i;
        img.className = 'bill';
        img.style.cssText = [
            'width:'   + BILL_W + 'px',
            'height:'  + BILL_H + 'px',
            'left:316px',
            'top:'     + b.y + 'px',
            'z-index:' + b.z,
            'opacity:0'
        ].join(';');
        // Insert before phoneWrap so phone renders on top
        var phone = document.getElementById('phoneWrap');
        c.insertBefore(img, phone);
    });
}

// ── Extra bill on S4 tap ─────────────────────────────────────
function addExtraBill() {
    if (extraCount >= EXTRA_BILL_DATA.length) return;
    var b   = EXTRA_BILL_DATA[extraCount];
    var src = extraCount % 2 === 0 ? '07.jpg' : '06.jpg';
    var c   = document.getElementById('banner-content');

    var img = document.createElement('img');
    img.src = src;
    img.className = 'bill';
    // Phone in S4 is at left:100, width:64 — right edge ≈ 164
    img.style.cssText = [
        'width:'   + BILL_W + 'px',
        'height:'  + BILL_H + 'px',
        'left:164px',
        'top:'     + b.y + 'px',
        'z-index:14',
        'opacity:0'
    ].join(';');

    var phone = document.getElementById('phoneWrap');
    c.insertBefore(img, phone);

    gsap.fromTo(img,
        { left: 164, opacity: 0, scale: 0.82 },
        { left: b.x, rotation: b.rot, opacity: 1, scale: 1,
          duration: 0.72, ease: 'power3.out', immediateRender: false }
    );

    extraCount++;
}

// ── Reposition btn03 centered on phone in S4 ────────────────
// Phone S4: left:100, top:4, w:64, h:120
// Phone center x: 100 + 32 = 132
// btn03 w:106 → left = 132 - 53 = 79
// Place at phone lower-third: top ~82, h≈30 → bottom ~112 ✓
function showBtn03S4() {
    gsap.set('#btn03', { left: 79, top: 82, width: 106, scale: 0.85, opacity: 0 });
    gsap.to('#btn03', {
        opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.6)',
        onComplete: function () {
            btn03Pulse = gsap.to('#btn03', {
                scale: 1.07, duration: 0.72, ease: 'sine.inOut',
                yoyo: true, repeat: -1
            });
        }
    });
}

// ── Loop ─────────────────────────────────────────────────────
function onLoopComplete() {
    if (btn05Pulse) { btn05Pulse.kill(); btn05Pulse = null; }
    if (btn03Pulse) { btn03Pulse.kill(); btn03Pulse = null; }
    fire_tag(ALL_EVENT_TYPES.LOOP);
    setTimeout(function () { location.reload(); }, 100);
}

// ── Bootstrap ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
    fire_tag(ALL_EVENT_TYPES.VISIT_SLIDE01);

    createBills();

    // ── Initial GSAP states ──────────────────────────────────
    // S1: phone centered (400/2 - 70/2 = 165)
    gsap.set('#phoneWrap',   { left: 165, top: 5, width: 70, height: 134, opacity: 0 });
    gsap.set('#panel',       { opacity: 0 });
    gsap.set('#headlineText',{ opacity: 0, y: 10 });
    gsap.set('#subText',     { opacity: 0, y: 8  });
    gsap.set('#btn03',       { left: 147, top: 108, width: 106, opacity: 0, scale: 0.85 });
    gsap.set('#btn05',       { opacity: 0, scale: 0.85 });
    BILL_DATA.forEach(function (b, i) {
        gsap.set('#bill' + i, { scale: 0.85 });
    });

    // ── Master timeline ──────────────────────────────────────
    var tl = gsap.timeline({ onComplete: onLoopComplete });

    // ════════════════════════════════════════════════════════
    // S1 (0–3.5s): Brand Intro — phone fades in center, btn03 pulse
    // Coverage: ~12%
    // ════════════════════════════════════════════════════════

    // Phone enter
    tl.to('#phoneWrap', { opacity: 1, duration: 0.65, ease: 'power2.out' }, 0);

    // btn03 "کلیک کن!" pops in below phone
    tl.to('#btn03', {
        opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.6)'
    }, 0.9);

    // btn03 pulse begins
    tl.call(function () {
        btn03Pulse = gsap.to('#btn03', {
            scale: 1.07, duration: 0.72, ease: 'sine.inOut',
            yoyo: true, repeat: -1
        });
    }, null, 1.3);

    // ════════════════════════════════════════════════════════
    // S2 (3.5–6.5s): Money Teaser — phone moves right, 1st bill emerges
    // Coverage: ~5%
    // ════════════════════════════════════════════════════════

    tl.call(function () {
        if (btn03Pulse) { btn03Pulse.kill(); btn03Pulse = null; }
        fire_tag(ALL_EVENT_TYPES.VISIT_SLIDE02);
    }, null, 3.5);

    // btn03 fades out
    tl.to('#btn03', { opacity: 0, scale: 0.9, duration: 0.3, ease: 'power2.in' }, 3.5);

    // Phone glides right
    tl.to('#phoneWrap', {
        left: 316, top: 24, width: 54, height: 100,
        duration: 0.85, ease: 'power2.inOut'
    }, 3.5);

    // First bill emerges from behind phone
    tl.fromTo('#bill0',
        { left: 316, opacity: 0, scale: 0.85 },
        { left: BILL_DATA[0].x, rotation: BILL_DATA[0].rot, opacity: 1, scale: 1,
          duration: 0.78, ease: 'power3.out', immediateRender: false },
        4.5
    );

    // ════════════════════════════════════════════════════════
    // S3 (6.5–11.5s): Bills Cascade — 3 more bills + panel + headline
    // Coverage: ~38%
    // ════════════════════════════════════════════════════════

    tl.call(function () { fire_tag(ALL_EVENT_TYPES.VISIT_SLIDE03); }, null, 6.5);

    // Bills 1–3 cascade (staggered 1.5s apart)
    [1, 2, 3].forEach(function (i) {
        var b = BILL_DATA[i];
        tl.fromTo('#bill' + i,
            { left: 316, opacity: 0, scale: 0.85 },
            { left: b.x, rotation: b.rot, opacity: 1, scale: 1,
              duration: 0.78, ease: 'power3.out', immediateRender: false },
            6.5 + (i - 1) * 1.5
        );
    });

    // Panel fades in
    tl.to('#panel', { opacity: 1, duration: 0.55, ease: 'power2.out' }, 8.5);

    // Headline slides up
    tl.to('#headlineText', {
        opacity: 1, y: 0, duration: 0.4, ease: 'power2.out'
    }, 9.1);

    // Subtext slides up
    tl.to('#subText', {
        opacity: 1, y: 0, duration: 0.4, ease: 'power2.out'
    }, 9.5);

    // ════════════════════════════════════════════════════════
    // S4 (11.5–17.5s): Finale — phone pokes left, btn05 "شروع کن!"
    // Coverage: ~50%
    // ════════════════════════════════════════════════════════

    tl.call(function () {
        inScene4 = true;
        fire_tag(ALL_EVENT_TYPES.VISIT_SLIDE04);
    }, null, 11.5);

    // Phone moves to left poke-out position
    tl.to('#phoneWrap', {
        left: 100, top: 4, width: 64, height: 120,
        duration: 0.9, ease: 'power2.inOut'
    }, 11.5);

    // btn03 reappears centered on phone
    tl.call(showBtn03S4, null, 12.6);

    // btn05 "شروع کن!" slides in from bottom-right
    tl.to('#btn05', {
        opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.5)'
    }, 13.0);

    // btn05 pulse begins
    tl.call(function () {
        btn05Pulse = gsap.to('#btn05', {
            scale: 1.07, duration: 0.75, ease: 'sine.inOut',
            yoyo: true, repeat: -1
        });
        fire_tag(ALL_EVENT_TYPES.VISIT_SLIDE05);
    }, null, 13.4);

    // ════════════════════════════════════════════════════════
    // S5 (17.5–22s): Urgency — panel collapses to CTA strip, pulse
    // Coverage: ~15%
    // ════════════════════════════════════════════════════════

    tl.call(function () {
        inScene4 = false;
        fire_tag(ALL_EVENT_TYPES.VISIT_SLIDE06);
    }, null, 17.5);

    // Kill btn03 pulse before collapsing its parent zone
    tl.call(function () {
        if (btn03Pulse) { btn03Pulse.kill(); btn03Pulse = null; }
    }, null, 17.5);

    // btn03 fades out
    tl.to('#btn03', { opacity: 0, scale: 0.88, duration: 0.3, ease: 'power2.in' }, 17.5);

    // Headline + subtext fade out
    tl.to('#headlineText', { opacity: 0, y: -6, duration: 0.35, ease: 'power2.in' }, 17.5);
    tl.to('#subText',      { opacity: 0, y: -4, duration: 0.3,  ease: 'power2.in' }, 17.6);

    // Panel morphs to collapsed urgency strip (just behind CTA)
    tl.to('#panel', {
        top: 100, height: 42,
        borderRadius: 10,
        duration: 0.8, ease: 'power3.inOut'
    }, 17.8);

    // Hold → loop at 22s
    tl.to({}, { duration: 0.1 }, 22.0);

    // ── Click handlers ───────────────────────────────────────

    document.getElementById('btn03').addEventListener('click', function () {
        if (inScene4) {
            // S4: interactive bill spawn
            fire_tag(ALL_EVENT_TYPES.CLICK1);

            if (btn03Pulse) { btn03Pulse.kill(); btn03Pulse = null; }
            gsap.to('#btn03', { opacity: 0, scale: 0.88, duration: 0.22 });

            addExtraBill();

            if (extraCount < EXTRA_BILL_DATA.length) {
                setTimeout(function () {
                    gsap.to('#btn03', {
                        opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(1.5)',
                        onComplete: function () {
                            btn03Pulse = gsap.to('#btn03', {
                                scale: 1.07, duration: 0.72, ease: 'sine.inOut',
                                yoyo: true, repeat: -1
                            });
                        }
                    });
                }, 750);
            }
        } else {
            // S1: skip to S2
            if (tl.time() < 3.5) {
                if (btn03Pulse) { btn03Pulse.kill(); btn03Pulse = null; }
                fire_tag(ALL_EVENT_TYPES.CLICK1);
                tl.seek(3.5);
            }
        }
    });

    document.getElementById('btn05').addEventListener('click', function () {
        fire_tag(ALL_EVENT_TYPES.CLICK2);
    });
});
