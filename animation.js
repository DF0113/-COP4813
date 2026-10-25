/**
 * COP4813 Assignment 9 - Canvas Animation & Interactivity
 * Student: Dakota Freed
 * Features:
 *   - Part 1: Real-time 2D canvas object animation starting diagonally across the screen (45° when dx == dy)
 *   - Part 1: Bounded arena with elastic reflection, random angle deflection, wall stopping, or mathematical path
 *   - Part 1: Timer-based animation engine (setInterval) following professor recommendations, plus requestAnimationFrame toggle
 *   - Part 2: Interactive mouse click response: Particle explosion (professor's favorite!), color shift, morph, or shockwave
 *   - Full telemetry dashboard (coordinates, velocity, angle, bounces, direct hits, FPS) and event history log
 */

// =========================================================
// Global Application State & Configuration
// =========================================================

let canvas = null;
let ctx = null;

// Animation Engine State
let isRunning = false;
let isPaused = false;
let animationEngine = 'timer'; // 'timer' or 'raf'
let timerIntervalId = null;
let rafId = null;
let timerIntervalMs = 16; // Default ~62 FPS
let lastFrameTimestamp = performance.now();
let fpsCounter = 60;
let frameCount = 0;
let lastFpsUpdateTime = performance.now();

// Object Physics & Visual State
const ball = {
    x: 80,
    y: 80,
    radius: 24,
    dx: 3.535,
    dy: 3.535,
    speed: 5,
    angleDeg: 45,
    color: '#ed553b',
    shape: 'ball', // 'ball', 'star', 'emoji', 'hand', 'card'
    isAlive: true,
    respawnTimer: 0,
    rotation: 0,
    spinRate: 0.03
};

// Mode Configurations
let bounceMode = 'reflect'; // 'reflect', 'random', 'stop', 'path'
let clickEffect = 'explode'; // 'explode', 'color-deflect', 'morph', 'repel'
let boundaryInsetMode = 'full'; // 'full' or 'inner'
let enableMotionTrail = false;
let soundEnabled = false;

// Path / Parametric Equation State
let pathT = 0;

// Particle System, Ripples, and Floating Feedback Text
let particles = [];
let ripples = [];
let floatingTexts = [];
let motionTrail = [];

// Performance / Telemetry Counters
const metrics = {
    bounces: 0,
    directHits: 0,
    totalClicks: 0
};

// Preloaded Images
const preloadedImages = {
    hand: { img: new Image(), loaded: false, src: 'waving-hand.png' },
    card: { img: new Image(), loaded: false, src: 'images/cards/S1.svg' }
};

// Web Audio API Context (Lazy-Initialized)
let audioCtx = null;

// Presets Mapping
const PRESETS = {
    'classic-45': {
        shape: 'ball',
        color: '#ed553b',
        size: 24,
        speed: 5,
        angle: 45,
        bounceMode: 'reflect',
        boundary: 'full',
        clickEffect: 'explode',
        trail: false,
        engine: 'timer'
    },
    'random-bounce': {
        shape: 'ball',
        color: '#20639b',
        size: 24,
        speed: 6,
        angle: 45,
        bounceMode: 'random',
        boundary: 'full',
        clickEffect: 'color-deflect',
        trail: false,
        engine: 'timer'
    },
    'dakota-hand': {
        shape: 'hand',
        color: '#ed553b',
        size: 28,
        speed: 5,
        angle: 45,
        bounceMode: 'reflect',
        boundary: 'full',
        clickEffect: 'morph',
        trail: false,
        engine: 'timer'
    },
    'playing-card': {
        shape: 'card',
        color: '#111827',
        size: 32,
        speed: 4,
        angle: 30,
        bounceMode: 'reflect',
        boundary: 'full',
        clickEffect: 'explode',
        trail: false,
        engine: 'timer'
    },
    'neon-star': {
        shape: 'star',
        color: '#f6d55c',
        size: 26,
        speed: 7,
        angle: 60,
        bounceMode: 'reflect',
        boundary: 'full',
        clickEffect: 'color-deflect',
        trail: true,
        engine: 'timer'
    },
    'equation-path': {
        shape: 'ball',
        color: '#3caea3',
        size: 22,
        speed: 5,
        angle: 45,
        bounceMode: 'path',
        boundary: 'full',
        clickEffect: 'explode',
        trail: true,
        engine: 'timer'
    }
};

// =========================================================
// Initialization
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('anim-canvas');
    if (!canvas || !canvas.getContext) {
        console.error('HTML5 Canvas is not supported by your browser.');
        return;
    }
    ctx = canvas.getContext('2d');

    // Preload image assets
    preloadImages();

    // Attach event listeners
    setupEventListeners();

    // Initialize ball physics to 45° diagonal launch
    resetBallPhysics(45, 5);

    // Start timer-based animation loop
    startAnimation();

    // Initial telemetry display
    updateTelemetryDisplay();

    // Initial log message
    addLog('Animation engine started with 45° diagonal launch trajectory.');
});

/**
 * Preloads external image assets for image-based canvas rendering
 */
function preloadImages() {
    for (const key in preloadedImages) {
        const item = preloadedImages[key];
        item.img.onload = () => {
            item.loaded = true;
        };
        item.img.onerror = () => {
            console.warn(`Failed to preload image: ${item.src}. Falling back to geometric shape.`);
            item.loaded = false;
        };
        item.img.src = item.src;
    }
}

/**
 * Attaches DOM and canvas event listeners
 */
function setupEventListeners() {
    // Canvas click & touch interactions
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('touchstart', handleCanvasTouch, { passive: false });

    // Action Toolbar buttons
    document.getElementById('btn-toggle-play').addEventListener('click', togglePlayPause);
    document.getElementById('btn-step').addEventListener('click', stepOneFrame);
    document.getElementById('btn-reset').addEventListener('click', () => {
        resetBallPhysics();
        addLog('Object reset to starting diagonal coordinates (80, 80).');
    });
    document.getElementById('btn-trigger-effect').addEventListener('click', triggerManualClickReaction);
    document.getElementById('btn-clear-log').addEventListener('click', clearLog);

    // Presets buttons
    const presetButtons = document.querySelectorAll('.preset-btn');
    presetButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            presetButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyPreset(btn.dataset.preset);
        });
    });

    // Appearance Inputs
    const shapeSelect = document.getElementById('object-type');
    shapeSelect.addEventListener('change', (e) => {
        ball.shape = e.target.value;
        const colorWrapper = document.getElementById('color-param-wrapper');
        colorWrapper.style.display = (ball.shape === 'hand' || ball.shape === 'card') ? 'none' : 'block';
        addLog(`Object shape changed to: ${e.target.options[e.target.selectedIndex].text}`);
    });

    document.getElementById('object-color').addEventListener('input', (e) => {
        ball.color = e.target.value;
    });

    const sizeSlider = document.getElementById('object-size');
    const valSize = document.getElementById('val-size');
    sizeSlider.addEventListener('input', (e) => {
        ball.radius = parseInt(e.target.value, 10);
        valSize.textContent = `${ball.radius} px`;
    });

    document.getElementById('toggle-trail').addEventListener('change', (e) => {
        enableMotionTrail = e.target.checked;
        if (!enableMotionTrail) motionTrail = [];
    });

    // Movement & Boundary Inputs
    const speedSlider = document.getElementById('anim-speed');
    const valSpeed = document.getElementById('val-speed');
    speedSlider.addEventListener('input', (e) => {
        ball.speed = parseInt(e.target.value, 10);
        valSpeed.textContent = `${ball.speed} px / tick`;
        recalculateVelocityFromAngle();
    });

    const angleSelect = document.getElementById('launch-angle');
    const customAngleWrapper = document.getElementById('custom-angle-wrapper');
    const customAngleSlider = document.getElementById('custom-angle');
    const valAngle = document.getElementById('val-angle');

    angleSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'custom') {
            customAngleWrapper.style.display = 'block';
            setBallAngle(parseInt(customAngleSlider.value, 10));
        } else if (val === 'random') {
            customAngleWrapper.style.display = 'none';
            setBallAngle(Math.floor(Math.random() * 360));
        } else {
            customAngleWrapper.style.display = 'none';
            setBallAngle(parseInt(val, 10));
        }
    });

    customAngleSlider.addEventListener('input', (e) => {
        const angle = parseInt(e.target.value, 10);
        valAngle.textContent = `${angle}°`;
        setBallAngle(angle);
    });

    document.getElementById('bounce-mode').addEventListener('change', (e) => {
        bounceMode = e.target.value;
        addLog(`Boundary bounce behavior set to: ${e.target.options[e.target.selectedIndex].text}`);
    });

    document.getElementById('boundary-inset').addEventListener('change', (e) => {
        boundaryInsetMode = e.target.value;
        addLog(`Bounded area type set to: ${e.target.options[e.target.selectedIndex].text}`);
    });

    // Click & Engine Inputs
    document.getElementById('click-effect').addEventListener('change', (e) => {
        clickEffect = e.target.value;
        addLog(`Mouse click response set to: ${e.target.options[e.target.selectedIndex].text}`);
    });

    const engineSelect = document.getElementById('anim-engine');
    const timerSpeedWrapper = document.getElementById('timer-speed-wrapper');
    engineSelect.addEventListener('change', (e) => {
        animationEngine = e.target.value;
        timerSpeedWrapper.style.display = (animationEngine === 'timer') ? 'block' : 'none';
        restartAnimationEngine();
        addLog(`Animation loop engine switched to: ${animationEngine === 'timer' ? 'Timer-Based (setInterval)' : 'requestAnimationFrame'}`);
    });

    const timerIntervalSlider = document.getElementById('timer-interval');
    const valTimer = document.getElementById('val-timer');
    timerIntervalSlider.addEventListener('input', (e) => {
        timerIntervalMs = parseInt(e.target.value, 10);
        const estFps = Math.round(1000 / timerIntervalMs);
        valTimer.textContent = `${timerIntervalMs} ms (~${estFps} FPS)`;
        if (animationEngine === 'timer' && isRunning) {
            restartAnimationEngine();
        }
    });

    document.getElementById('toggle-sound').addEventListener('change', (e) => {
        soundEnabled = e.target.checked;
        if (soundEnabled && !audioCtx) {
            initAudioContext();
        }
        addLog(soundEnabled ? 'Synthesized audio enabled (gentle office-friendly chimes).' : 'Audio muted.');
    });
}

// =========================================================
// Presets Logic
// =========================================================

function applyPreset(presetKey) {
    const config = PRESETS[presetKey];
    if (!config) return;

    ball.shape = config.shape;
    document.getElementById('object-type').value = config.shape;

    ball.color = config.color;
    document.getElementById('object-color').value = config.color;
    document.getElementById('color-param-wrapper').style.display =
        (config.shape === 'hand' || config.shape === 'card') ? 'none' : 'block';

    ball.radius = config.size;
    document.getElementById('object-size').value = config.size;
    document.getElementById('val-size').textContent = `${config.size} px`;

    ball.speed = config.speed;
    document.getElementById('anim-speed').value = config.speed;
    document.getElementById('val-speed').textContent = `${config.speed} px / tick`;

    bounceMode = config.bounceMode;
    document.getElementById('bounce-mode').value = config.bounceMode;

    boundaryInsetMode = config.boundary;
    document.getElementById('boundary-inset').value = config.boundary;

    clickEffect = config.clickEffect;
    document.getElementById('click-effect').value = config.clickEffect;

    enableMotionTrail = config.trail;
    document.getElementById('toggle-trail').checked = config.trail;
    motionTrail = [];

    animationEngine = config.engine;
    document.getElementById('anim-engine').value = config.engine;
    document.getElementById('timer-speed-wrapper').style.display =
        (config.engine === 'timer') ? 'block' : 'none';

    document.getElementById('launch-angle').value = String(config.angle);
    document.getElementById('custom-angle-wrapper').style.display = 'none';

    resetBallPhysics(config.angle, config.speed);

    if (!isRunning) {
        startAnimation();
    } else {
        restartAnimationEngine();
    }

    addLog(`Preset "${presetKey}" applied successfully.`);
}

// =========================================================
// Physics & Motion Mechanics (Part 1)
// =========================================================

/**
 * Resets the ball to the starting diagonal position and velocity
 */
function resetBallPhysics(angleDeg = 45, speed = ball.speed) {
    const bounds = getArenaBounds();
    ball.x = bounds.left + ball.radius + 20;
    ball.y = bounds.top + ball.radius + 20;
    ball.speed = speed;
    ball.isAlive = true;
    ball.respawnTimer = 0;
    pathT = 0;
    motionTrail = [];
    particles = [];
    ripples = [];
    floatingTexts = [];

    setBallAngle(angleDeg);
    updateTelemetryDisplay();
}

/**
 * Sets object angle in degrees and calculates vector components dx and dy
 * Note: At 45 degrees, dx and dy are mathematically equal!
 */
function setBallAngle(degrees) {
    ball.angleDeg = ((degrees % 360) + 360) % 360;
    const rad = ball.angleDeg * (Math.PI / 180);
    ball.dx = ball.speed * Math.cos(rad);
    ball.dy = ball.speed * Math.sin(rad);

    // If angle is 45°, enforce strict floating equality for demonstration
    if (Math.round(ball.angleDeg) === 45) {
        const component = Number((ball.speed * Math.SQRT1_2).toFixed(3));
        ball.dx = component;
        ball.dy = component;
    }
}

function recalculateVelocityFromAngle() {
    setBallAngle(ball.angleDeg);
}

/**
 * Returns current arena boundaries accounting for full canvas or inner rectangle
 */
function getArenaBounds() {
    if (boundaryInsetMode === 'inner') {
        const marginX = 50;
        const marginY = 40;
        return {
            left: marginX,
            top: marginY,
            right: canvas.width - marginX,
            bottom: canvas.height - marginY,
            width: canvas.width - marginX * 2,
            height: canvas.height - marginY * 2
        };
    }
    return {
        left: 0,
        top: 0,
        right: canvas.width,
        bottom: canvas.height,
        width: canvas.width,
        height: canvas.height
    };
}

/**
 * Core Physics update step executed every animation tick
 */
function updatePhysics() {
    // Handle respawn timer when ball has exploded
    if (!ball.isAlive) {
        ball.respawnTimer--;
        if (ball.respawnTimer <= 0) {
            respawnBall();
        }
        return;
    }

    const bounds = getArenaBounds();

    // 1. Follow Calculated Coordinate Path Mode (Lissajous Curve)
    if (bounceMode === 'path') {
        pathT += ball.speed * 0.006;
        const centerX = bounds.left + bounds.width / 2;
        const centerY = bounds.top + bounds.height / 2;
        const radiusX = bounds.width / 2 - ball.radius - 15;
        const radiusY = bounds.height / 2 - ball.radius - 15;

        const nextX = centerX + radiusX * Math.sin(pathT);
        const nextY = centerY + radiusY * Math.sin(2 * pathT) * 0.85;

        ball.dx = nextX - ball.x;
        ball.dy = nextY - ball.y;
        ball.x = nextX;
        ball.y = nextY;
        ball.angleDeg = ((Math.atan2(ball.dy, ball.dx) * 180 / Math.PI) + 360) % 360;
        return;
    }

    // 2. Standard Cartesian Vector Motion: x = x + dx, y = y + dy
    ball.x += ball.dx;
    ball.y += ball.dy;
    ball.rotation += ball.spinRate;

    // 3. Boundary Collision Detection & Bounding Physics
    let collidedWall = null;

    // Check Left Wall
    if (ball.x - ball.radius <= bounds.left) {
        ball.x = bounds.left + ball.radius;
        collidedWall = 'Left';
    }
    // Check Right Wall
    else if (ball.x + ball.radius >= bounds.right) {
        ball.x = bounds.right - ball.radius;
        collidedWall = 'Right';
    }

    // Check Top Wall
    if (ball.y - ball.radius <= bounds.top) {
        ball.y = bounds.top + ball.radius;
        collidedWall = collidedWall ? `${collidedWall}-Top` : 'Top';
    }
    // Check Bottom Wall
    else if (ball.y + ball.radius >= bounds.bottom) {
        ball.y = bounds.bottom - ball.radius;
        collidedWall = collidedWall ? `${collidedWall}-Bottom` : 'Bottom';
    }

    // Handle Wall Collision Behavior
    if (collidedWall) {
        handleBoundaryCollision(collidedWall, bounds);
    }
}

/**
 * Handles collision against a bounded wall
 */
function handleBoundaryCollision(wall, bounds) {
    metrics.bounces++;
    playTone(180, 0.05, 'sine');
    spawnWallRipple(ball.x, ball.y, wall);

    if (bounceMode === 'stop') {
        ball.dx = 0;
        ball.dy = 0;
        pauseAnimation();
        addLog(`Object reached ${wall} boundary and stopped.`);
        updateTelemetryDisplay();
        return;
    }

    if (bounceMode === 'random') {
        // Calculate a new inward deflection angle using trigonometry
        let minAngle = 0;
        let maxAngle = 360;

        if (wall.includes('Right')) {
            minAngle = 110;
            maxAngle = 250;
        } else if (wall.includes('Left')) {
            minAngle = -70;
            maxAngle = 70;
        } else if (wall.includes('Bottom')) {
            minAngle = 200;
            maxAngle = 340;
        } else if (wall.includes('Top')) {
            minAngle = 20;
            maxAngle = 160;
        }

        const newAngle = (Math.random() * (maxAngle - minAngle) + minAngle + 360) % 360;
        setBallAngle(newAngle);
        addLog(`Wall impact (${wall}): deflected to random angle ${Math.round(newAngle)}°.`);
    } else {
        // Standard Elastic Reflection (dx = -dx or dy = -dy)
        if (wall.includes('Left') || wall.includes('Right')) {
            ball.dx = -ball.dx;
        }
        if (wall.includes('Top') || wall.includes('Bottom')) {
            ball.dy = -ball.dy;
        }
        ball.angleDeg = ((Math.atan2(ball.dy, ball.dx) * 180 / Math.PI) + 360) % 360;
        addLog(`Wall bounce (${wall}): new heading ${Math.round(ball.angleDeg)}° [dx=${ball.dx.toFixed(2)}, dy=${ball.dy.toFixed(2)}].`);
    }

    updateTelemetryDisplay();
}

/**
 * Respawns the ball after an explosion event
 */
function respawnBall() {
    const bounds = getArenaBounds();
    ball.x = bounds.left + bounds.width / 2;
    ball.y = bounds.top + bounds.height / 2;
    ball.isAlive = true;
    setBallAngle(Math.random() > 0.5 ? 45 : 135);

    // Visual respawn ripple & chime
    spawnRipple(ball.x, ball.y, '#38bdf8', 45);
    addFloatingText('RESPAWNED!', ball.x, ball.y - 30, '#38bdf8');
    playTone(520, 0.12, 'triangle');
    addLog('Object reconstituted and respawned at center arena.');
}

// =========================================================
// Mouse Click Interactivity (Part 2)
// =========================================================

/**
 * Handles canvas mouse click events
 */
function handleCanvasClick(e) {
    if (!audioCtx && soundEnabled) {
        initAudioContext();
    }

    metrics.totalClicks++;
    const coords = getCanvasPointerCoordinates(e);
    processInteractionAtPoint(coords.x, coords.y);
}

/**
 * Handles touch events on mobile/tablets
 */
function handleCanvasTouch(e) {
    e.preventDefault();
    if (!audioCtx && soundEnabled) {
        initAudioContext();
    }

    if (e.touches.length > 0) {
        metrics.totalClicks++;
        const touch = e.touches[0];
        const coords = getCanvasPointerCoordinates(touch);
        processInteractionAtPoint(coords.x, coords.y);
    }
}

/**
 * Accurately maps screen viewport mouse/touch coordinates to internal canvas resolution
 */
function getCanvasPointerCoordinates(pointerEvent) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (pointerEvent.clientX - rect.left) * scaleX,
        y: (pointerEvent.clientY - rect.top) * scaleY
    };
}

/**
 * Evaluates Euclidean distance to perform hit-testing on the moving object
 */
function processInteractionAtPoint(clickX, clickY) {
    if (!ball.isAlive) {
        // Ball is currently exploded/reconstituting; show ambient click
        spawnRipple(clickX, clickY, '#94a3b8', 25);
        return;
    }

    // Distance calculation: d = sqrt((x2 - x1)^2 + (y2 - y1)^2)
    const distance = Math.hypot(clickX - ball.x, clickY - ball.y);
    const hitTolerance = ball.radius + 6; // Slight forgiving hitbox margin

    if (distance <= hitTolerance) {
        // DIRECT HIT!
        triggerDirectHit(clickX, clickY);
    } else {
        // Ambient Click on Canvas
        triggerAmbientClick(clickX, clickY, distance);
    }

    updateTelemetryDisplay();
}

/**
 * Executes response when user clicks directly on the moving object
 */
function triggerDirectHit(clickX, clickY) {
    metrics.directHits++;

    // Visual ripple and floating text
    spawnRipple(ball.x, ball.y, '#f59e0b', 55);

    switch (clickEffect) {
        case 'explode':
            // The Professor's Favorite Effect: Exploding Ball!
            triggerExplosionEffect();
            break;

        case 'color-deflect':
            // Change color and deflect direction with speed boost
            triggerColorDeflectEffect();
            break;

        case 'morph':
            // Morph object shape/image
            triggerMorphEffect();
            break;

        case 'repel':
            // Shockwave repel: knock object away from click
            triggerRepelEffect(clickX, clickY);
            break;

        default:
            triggerExplosionEffect();
    }
}

/**
 * Professor's Favorite Effect: Detonates object into 50 colorful particles
 */
function triggerExplosionEffect() {
    ball.isAlive = false;
    ball.respawnTimer = Math.max(35, Math.round(750 / timerIntervalMs)); // ~0.75 seconds

    createParticleExplosion(ball.x, ball.y, ball.color, 50);
    playExplosionSound();
    addFloatingText('BOOM! DIRECT HIT', ball.x, ball.y - 20, '#ef4444');
    addLog(`DIRECT HIT: Object exploded into 50 particles! Respawning shortly...`);
}

/**
 * Changes color to random neon hue, deflects direction by 90°, and adds speed boost
 */
function triggerColorDeflectEffect() {
    const randomHue = Math.floor(Math.random() * 360);
    ball.color = `hsl(${randomHue}, 90%, 55%)`;
    document.getElementById('object-color').value = hslToHex(randomHue, 90, 55);

    // Deflect by roughly 90 degrees
    const deflectedAngle = (ball.angleDeg + 90 + (Math.random() * 30 - 15) + 360) % 360;
    setBallAngle(deflectedAngle);

    // Small celebratory burst
    createParticleExplosion(ball.x, ball.y, ball.color, 18);
    playTone(660, 0.15, 'sawtooth');
    addFloatingText('DEFLECTED & RE-COLORED!', ball.x, ball.y - 20, ball.color);
    addLog(`DIRECT HIT: Color transformed to HSL(${randomHue}, 90%, 55%) and deflected to ${Math.round(deflectedAngle)}°!`);
}

/**
 * Morphs object through available canvas shapes and external images
 */
function triggerMorphEffect() {
    const shapeSequence = ['ball', 'star', 'emoji', 'hand', 'card'];
    const currentIndex = shapeSequence.indexOf(ball.shape);
    const nextShape = shapeSequence[(currentIndex + 1) % shapeSequence.length];

    ball.shape = nextShape;
    document.getElementById('object-type').value = nextShape;
    document.getElementById('color-param-wrapper').style.display =
        (nextShape === 'hand' || nextShape === 'card') ? 'none' : 'block';

    createParticleExplosion(ball.x, ball.y, '#38bdf8', 16);
    playTone(587, 0.12, 'triangle');
    addFloatingText(`MORPHED TO ${nextShape.toUpperCase()}!`, ball.x, ball.y - 20, '#38bdf8');
    addLog(`DIRECT HIT: Object morphed into ${nextShape}.`);
}

/**
 * Knocks the ball in the direction away from the mouse click
 */
function triggerRepelEffect(clickX, clickY) {
    const repelAngleRad = Math.atan2(ball.y - clickY, ball.x - clickX);
    const repelAngleDeg = ((repelAngleRad * 180 / Math.PI) + 360) % 360;

    setBallAngle(repelAngleDeg);

    createParticleExplosion(clickX, clickY, '#f59e0b', 12);
    playTone(320, 0.1, 'square');
    addFloatingText('SHOCKWAVE REPEL!', ball.x, ball.y - 20, '#f59e0b');
    addLog(`DIRECT HIT: Repelled object away from click at angle ${Math.round(repelAngleDeg)}°.`);
}

/**
 * Handles clicks elsewhere on the canvas: emits acoustic shockwave ring
 */
function triggerAmbientClick(clickX, clickY, distance) {
    spawnRipple(clickX, clickY, '#38bdf8', 40);
    playTone(240, 0.04, 'sine');

    // If within shockwave range (120px), slightly deflect ball trajectory
    if (distance < 120 && bounceMode !== 'path') {
        const shockAngle = Math.atan2(ball.y - clickY, ball.x - clickX);
        ball.dx += Math.cos(shockAngle) * 1.5;
        ball.dy += Math.sin(shockAngle) * 1.5;
        ball.angleDeg = ((Math.atan2(ball.dy, ball.dx) * 180 / Math.PI) + 360) % 360;
        addLog(`Ambient click at (${Math.round(clickX)}, ${Math.round(clickY)}) nudged object via shockwave.`);
    } else {
        addLog(`Ambient click registered at (${Math.round(clickX)}, ${Math.round(clickY)}).`);
    }
}

/**
 * Button to manually trigger click reaction for testing
 */
function triggerManualClickReaction() {
    if (!ball.isAlive) {
        respawnBall();
    } else {
        triggerDirectHit(ball.x, ball.y);
    }
}

// =========================================================
// Particle System & Visual FX
// =========================================================

/**
 * Spawns explosive particles radiating from a central point
 */
function createParticleExplosion(originX, originY, baseColor, count) {
    const colors = [
        baseColor,
        '#f59e0b',
        '#ef4444',
        '#10b981',
        '#3b82f6',
        '#ec4899',
        '#ffffff'
    ];

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * 6.5 + 2.0;
        particles.push({
            x: originX,
            y: originY,
            vx: Math.cos(angle) * velocity,
            vy: Math.sin(angle) * velocity,
            size: Math.random() * 5 + 3,
            color: colors[Math.floor(Math.random() * colors.length)],
            alpha: 1.0,
            decay: Math.random() * 0.025 + 0.015,
            rotation: Math.random() * Math.PI * 2,
            spin: (Math.random() - 0.5) * 0.25,
            shape: Math.random() > 0.4 ? 'circle' : 'square'
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12; // Gentle downward gravity
        p.vx *= 0.985; // Air drag
        p.alpha -= p.decay;
        p.rotation += p.spin;

        if (p.alpha <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawParticles() {
    for (const p of particles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        if (p.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(0, 0, p.size, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        }
        ctx.restore();
    }
}

// Ripples System
function spawnRipple(x, y, color = '#38bdf8', maxRadius = 40) {
    ripples.push({
        x,
        y,
        radius: 4,
        maxRadius,
        alpha: 0.85,
        color
    });
}

function spawnWallRipple(x, y, wall) {
    spawnRipple(x, y, '#e2e8f0', 25);
}

function updateRipples() {
    for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.radius += 2.2;
        r.alpha -= 0.035;
        if (r.alpha <= 0 || r.radius >= r.maxRadius) {
            ripples.splice(i, 1);
        }
    }
}

function drawRipples() {
    for (const r of ripples) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, r.alpha);
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

// Floating Texts System
function addFloatingText(text, x, y, color = '#f6d55c') {
    floatingTexts.push({
        text,
        x,
        y,
        alpha: 1.0,
        color
    });
}

function updateFloatingTexts() {
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y -= 1.0;
        ft.alpha -= 0.022;
        if (ft.alpha <= 0) {
            floatingTexts.splice(i, 1);
        }
    }
}

function drawFloatingTexts() {
    for (const ft of floatingTexts) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 14px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
    }
}

// Motion Trail System
function updateMotionTrail() {
    if (!enableMotionTrail || !ball.isAlive) return;

    motionTrail.push({
        x: ball.x,
        y: ball.y,
        radius: ball.radius * 0.75,
        color: ball.color,
        alpha: 0.5
    });

    if (motionTrail.length > 15) {
        motionTrail.shift();
    }

    for (const t of motionTrail) {
        t.alpha -= 0.03;
    }
}

function drawMotionTrail() {
    if (!enableMotionTrail) return;
    for (const t of motionTrail) {
        if (t.alpha <= 0) continue;
        ctx.save();
        ctx.globalAlpha = Math.max(0, t.alpha);
        ctx.fillStyle = t.color;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// =========================================================
// Rendering Pipeline
// =========================================================

/**
 * Main draw routine executing on every frame
 */
function draw() {
    // 1. Clear background
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2. Draw arena court background & borders
    drawArenaBackground();

    // 3. Draw motion trail
    drawMotionTrail();

    // 4. Draw shockwave ripples
    drawRipples();

    // 5. Draw the animated object (if alive)
    if (ball.isAlive) {
        drawObject();
    }

    // 6. Draw particle explosion
    drawParticles();

    // 7. Draw floating text notifications
    drawFloatingTexts();
}

/**
 * Draws arena court with coordinates grid and bounded border
 */
function drawArenaBackground() {
    const bounds = getArenaBounds();

    // Fill dark navy court background
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#1e293b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw subtle grid lines
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 50; x < canvas.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 50; y < canvas.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
    ctx.restore();

    // Draw bounded arena rectangle
    ctx.save();
    ctx.strokeStyle = (boundaryInsetMode === 'inner') ? '#38bdf8' : '#334155';
    ctx.lineWidth = (boundaryInsetMode === 'inner') ? 2 : 1;
    if (boundaryInsetMode === 'inner') {
        ctx.setLineDash([6, 4]);
    }
    ctx.strokeRect(bounds.left, bounds.top, bounds.width, bounds.height);
    ctx.restore();

    // If inner arena, highlight clearance margin
    if (boundaryInsetMode === 'inner') {
        ctx.save();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
        ctx.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px Arial, sans-serif';
        ctx.fillText('INNER BOUNDED ARENA', bounds.left + 10, bounds.top + 16);
        ctx.restore();
    }
}

/**
 * Renders the chosen object shape or image on the canvas
 */
function drawObject() {
    ctx.save();
    ctx.translate(ball.x, ball.y);

    switch (ball.shape) {
        case 'ball':
            drawShadedBall();
            break;
        case 'star':
            drawNeonStar();
            break;
        case 'emoji':
            drawSmileyEmoji();
            break;
        case 'hand':
            drawImageObject(preloadedImages.hand, drawShadedBall);
            break;
        case 'card':
            drawImageObject(preloadedImages.card, drawShadedBall);
            break;
        default:
            drawShadedBall();
    }

    ctx.restore();
}

/**
 * Renders 3D shaded sphere with radial highlight and specular reflection
 */
function drawShadedBall() {
    // Drop shadow
    ctx.beginPath();
    ctx.arc(4, 5, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();

    // Radial gradient for 3D sphere shading
    const grad = ctx.createRadialGradient(
        -ball.radius * 0.35,
        -ball.radius * 0.35,
        ball.radius * 0.1,
        0,
        0,
        ball.radius
    );
    grad.addColorStop(0, '#ffffff'); // Specular highlight
    grad.addColorStop(0.35, ball.color); // Base color
    grad.addColorStop(1, shadeColor(ball.color, -40)); // Rim shadow

    ctx.beginPath();
    ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Specular shine glint
    ctx.beginPath();
    ctx.ellipse(
        -ball.radius * 0.35,
        -ball.radius * 0.35,
        ball.radius * 0.28,
        ball.radius * 0.16,
        -Math.PI / 4,
        0,
        Math.PI * 2
    );
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fill();
}

/**
 * Renders a neon 5-pointed geometric star using polar trigonometry
 */
function drawNeonStar() {
    ctx.rotate(ball.rotation);

    const points = 5;
    const outerRadius = ball.radius;
    const innerRadius = ball.radius * 0.45;

    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
        const radius = (i % 2 === 0) ? outerRadius : innerRadius;
        const angle = (i * Math.PI) / points - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();

    ctx.fillStyle = ball.color;
    ctx.shadowColor = ball.color;
    ctx.shadowBlur = 15;
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
}

/**
 * Renders a silly smiley emoji face with winking animation
 */
function drawSmileyEmoji() {
    // Face circle
    ctx.beginPath();
    ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24'; // Golden yellow
    ctx.fill();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Eyes
    const eyeOffsetX = ball.radius * 0.35;
    const eyeOffsetY = -ball.radius * 0.2;
    const eyeRadius = ball.radius * 0.14;

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(-eyeOffsetX, eyeOffsetY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(eyeOffsetX, eyeOffsetY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();

    // Big smile
    ctx.beginPath();
    ctx.arc(0, ball.radius * 0.05, ball.radius * 0.55, 0.2 * Math.PI, 0.8 * Math.PI, false);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#1e293b';
    ctx.stroke();
}

/**
 * Draws image object (Dakota's Waving Hand or Playing Card) centered at object position
 */
function drawImageObject(imgObj, fallbackRenderer) {
    if (!imgObj || !imgObj.loaded) {
        fallbackRenderer();
        return;
    }

    ctx.rotate(Math.sin(ball.rotation * 1.5) * 0.15); // Subtle wobble tilt
    const diameter = ball.radius * 2.2;
    ctx.drawImage(imgObj.img, -diameter / 2, -diameter / 2, diameter, diameter);
}

// =========================================================
// Animation Engine: Timer-Based vs requestAnimationFrame
// =========================================================

/**
 * Advances a single simulation step and renders frame
 */
function tick() {
    updatePhysics();
    updateMotionTrail();
    updateParticles();
    updateRipples();
    updateFloatingTexts();
    draw();
    calculateFPS();
}

function startAnimation() {
    isRunning = true;
    isPaused = false;
    updateStatusPill('RUNNING', 'running', 'Object is moving diagonally');
    document.getElementById('btn-toggle-play').textContent = 'Pause Animation';

    if (animationEngine === 'timer') {
        if (timerIntervalId) clearInterval(timerIntervalId);
        timerIntervalId = setInterval(tick, timerIntervalMs);
    } else {
        lastFrameTimestamp = performance.now();
        rafLoop(lastFrameTimestamp);
    }
}

function pauseAnimation() {
    isRunning = false;
    isPaused = true;
    updateStatusPill('PAUSED', 'paused', 'Animation is currently paused');
    document.getElementById('btn-toggle-play').textContent = 'Resume Animation';

    if (timerIntervalId) {
        clearInterval(timerIntervalId);
        timerIntervalId = null;
    }
    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
}

function togglePlayPause() {
    if (isRunning) {
        pauseAnimation();
        addLog('Animation paused by user.');
    } else {
        startAnimation();
        addLog('Animation resumed.');
    }
}

function stepOneFrame() {
    if (isRunning) {
        pauseAnimation();
    }
    tick();
    addLog('Advanced single frame step.');
}

function restartAnimationEngine() {
    if (timerIntervalId) clearInterval(timerIntervalId);
    if (rafId) cancelAnimationFrame(rafId);
    timerIntervalId = null;
    rafId = null;

    if (isRunning) {
        if (animationEngine === 'timer') {
            timerIntervalId = setInterval(tick, timerIntervalMs);
        } else {
            lastFrameTimestamp = performance.now();
            rafLoop(lastFrameTimestamp);
        }
    }
}

function rafLoop(timestamp) {
    if (!isRunning || animationEngine !== 'raf') return;
    tick();
    rafId = requestAnimationFrame(rafLoop);
}

function calculateFPS() {
    frameCount++;
    const now = performance.now();
    if (now - lastFpsUpdateTime >= 500) {
        fpsCounter = Math.round((frameCount * 1000) / (now - lastFpsUpdateTime));
        frameCount = 0;
        lastFpsUpdateTime = now;
        updateEngineMetric();
    }
}

// =========================================================
// Telemetry & UI Dashboard
// =========================================================

function updateTelemetryDisplay() {
    const coordsElem = document.getElementById('metric-coords');
    if (coordsElem) {
        coordsElem.textContent = `X: ${Math.round(ball.x)} | Y: ${Math.round(ball.y)}`;
    }

    const velElem = document.getElementById('metric-velocity');
    if (velElem) {
        const signX = ball.dx >= 0 ? '+' : '';
        const signY = ball.dy >= 0 ? '+' : '';
        velElem.textContent = `dx: ${signX}${ball.dx.toFixed(2)} | dy: ${signY}${ball.dy.toFixed(2)}`;
    }

    const speedSub = document.getElementById('metric-speed');
    if (speedSub) {
        speedSub.textContent = `Speed: ${ball.speed.toFixed(1)} px/tick`;
    }

    const angleElem = document.getElementById('metric-angle');
    if (angleElem) {
        angleElem.textContent = `${Math.round(ball.angleDeg * 10) / 10}°`;
    }

    const bouncesElem = document.getElementById('metric-bounces');
    if (bouncesElem) {
        bouncesElem.textContent = metrics.bounces;
    }

    const hitsElem = document.getElementById('metric-hits');
    if (hitsElem) {
        hitsElem.textContent = metrics.directHits;
    }

    const accElem = document.getElementById('metric-accuracy');
    if (accElem) {
        const accuracy = metrics.totalClicks > 0
            ? Math.round((metrics.directHits / metrics.totalClicks) * 100)
            : 0;
        accElem.textContent = `Accuracy: ${accuracy}% (${metrics.directHits}/${metrics.totalClicks})`;
    }

    updateEngineMetric();
}

function updateEngineMetric() {
    const fpsElem = document.getElementById('metric-fps');
    const engineSub = document.getElementById('metric-engine-sub');
    if (fpsElem) {
        fpsElem.textContent = `${fpsCounter} FPS`;
    }
    if (engineSub) {
        if (animationEngine === 'timer') {
            engineSub.textContent = `setInterval (${timerIntervalMs}ms)`;
        } else {
            engineSub.textContent = 'requestAnimationFrame';
        }
    }
}

function updateStatusPill(label, statusClass, statusText) {
    const pill = document.getElementById('canvas-status-pill');
    const text = document.getElementById('canvas-status-text');
    if (pill) {
        pill.textContent = `● ${label}`;
        pill.className = `status-pill ${statusClass}`;
    }
    if (text) {
        text.textContent = statusText;
    }
}

// =========================================================
// Event Log System
// =========================================================

function addLog(message) {
    const logList = document.getElementById('event-log-list');
    if (!logList) return;

    const initialItem = logList.querySelector('.initial-log');
    if (initialItem) {
        initialItem.remove();
    }

    const now = new Date();
    const timeString = now.toTimeString().split(' ')[0];

    const li = document.createElement('li');
    li.className = 'log-item';
    li.innerHTML = `<span class="log-time">[${timeString}]</span> ${escapeHtml(message)}`;

    logList.insertBefore(li, logList.firstChild);

    // Keep log trimmed to 100 entries max
    while (logList.children.length > 100) {
        logList.removeChild(logList.lastChild);
    }
}

function clearLog() {
    const logList = document.getElementById('event-log-list');
    if (logList) {
        logList.innerHTML = '<li class="log-item initial-log">Event log cleared. Ready to capture animation and interaction events.</li>';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// =========================================================
// Audio Synthesizer (Web Audio API)
// =========================================================

function initAudioContext() {
    try {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (AudioCtxClass) {
            audioCtx = new AudioCtxClass();
        }
    } catch (e) {
        console.warn('Web Audio API not supported on this browser.');
    }
}

function playTone(freq, duration, type = 'sine') {
    if (!soundEnabled || !audioCtx) return;
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
        // Suppress audio failure
    }
}

function playExplosionSound() {
    if (!soundEnabled || !audioCtx) return;
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    try {
        // Synthesize short retro noise burst pop
        const bufferSize = audioCtx.sampleRate * 0.2;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        const whiteNoise = audioCtx.createBufferSource();
        whiteNoise.buffer = buffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, audioCtx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.2);

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

        whiteNoise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        whiteNoise.start();
    } catch (e) {
        // Suppress audio error
    }
}

// =========================================================
// Color Utilities
// =========================================================

function shadeColor(color, percent) {
    let R = parseInt(color.substring(1, 3), 16);
    let G = parseInt(color.substring(3, 5), 16);
    let B = parseInt(color.substring(5, 7), 16);

    R = Math.min(255, Math.max(0, parseInt(R * (100 + percent) / 100, 10)));
    G = Math.min(255, Math.max(0, parseInt(G * (100 + percent) / 100, 10)));
    B = Math.min(255, Math.max(0, parseInt(B * (100 + percent) / 100, 10)));

    const RR = (R.toString(16).length === 1) ? `0${R.toString(16)}` : R.toString(16);
    const GG = (G.toString(16).length === 1) ? `0${G.toString(16)}` : G.toString(16);
    const BB = (B.toString(16).length === 1) ? `0${B.toString(16)}` : B.toString(16);

    return `#${RR}${GG}${BB}`;
}

function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}
