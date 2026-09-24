/**
 * COP4813 Assignment 5 - HTML5 Canvas Spirograph
 * Student: Dakota Freed
 * Equations:
 *   x = (R + r) * cos(t) - (r + O) * cos(((R + r) / r) * t)
 *   y = (R + r) * sin(t) - (r + O) * sin(((R + r) / r) * t)
 */

// Canvas & Drawing State
let canvas, ctx;
let animationFrameId = null;
let isDrawing = false;
let isPaused = false;

// Drawing Parameters
let R = 140;
let r = 56;
let O = 42;
let stepSize = 0.05;
let t = 0;
let maxT = 0;
let pointCount = 0;
let prevX = null;
let prevY = null;
let drawSpeed = 15;
let colorMode = 'rainbow';
let isDrunk = false;

// Presets mapping
const presets = {
    'star-flower': { R: 140, r: 56, O: 42, step: 0.05, speed: '15', color: 'rainbow' },
    'delicate-rose': { R: 150, r: 60, O: 30, step: 0.04, speed: '15', color: 'rainbow' },
    'intricate-lace': { R: 160, r: 96, O: 64, step: 0.03, speed: '50', color: 'rainbow' },
    'hypo-blossom': { R: 165, r: 45, O: 30, step: 0.05, speed: '15', color: 'random-segment' },
    'starburst': { R: 175, r: 25, O: 50, step: 0.04, speed: '15', color: 'rainbow' }
};

/**
 * Calculates greatest common divisor (GCD) to determine exact closure period
 */
function gcd(a, b) {
    a = Math.abs(Math.round(a));
    b = Math.abs(Math.round(b));
    while (b) {
        const temp = b;
        b = a % b;
        a = temp;
    }
    return a || 1;
}

/**
 * Calculates (x, y) coordinates for a given angle t using the required Spirograph equations
 */
function getSpirographPosition(currentR, currentr, currentO, currentT) {
    const sum = currentR + currentr;
    const ratio = sum / currentr;
    const x = sum * Math.cos(currentT) - (currentr + currentO) * Math.cos(ratio * currentT);
    const y = sum * Math.sin(currentT) - (currentr + currentO) * Math.sin(ratio * currentT);
    return { x, y };
}

/**
 * Reads and validates user inputs from the configuration form
 */
function validateInputs() {
    const errorElem = document.getElementById('spiro-error');
    errorElem.textContent = '';

    const inputR = parseFloat(document.getElementById('radius-r-large').value);
    const inputr = parseFloat(document.getElementById('radius-r-small').value);
    const inputO = parseFloat(document.getElementById('offset-o').value);
    const inputStep = parseFloat(document.getElementById('step-size').value);

    if (isNaN(inputR) || isNaN(inputr) || isNaN(inputO) || isNaN(inputStep)) {
        errorElem.textContent = 'Error: All radius and offset fields must be valid numbers.';
        return null;
    }

    if (inputR <= 0) {
        errorElem.textContent = 'Error: Outer Radius (R) must be greater than zero.';
        return null;
    }

    if (inputr <= 0) {
        errorElem.textContent = 'Error: Inner Radius (r) must be greater than zero.';
        return null;
    }

    // Required constraint from assignment: r cannot be greater than R
    if (inputr > inputR) {
        errorElem.textContent = 'Error: Inner Radius (r) cannot be greater than Outer Radius (R) [r ≤ R].';
        return null;
    }

    if (inputO < 0) {
        errorElem.textContent = 'Error: Pen Offset (O) cannot be negative.';
        return null;
    }

    if (inputStep <= 0) {
        errorElem.textContent = 'Error: Angle increment (Δt) must be positive.';
        return null;
    }

    // Maximum geometric boundary check for canvas (600x600, center at 300,300)
    const maxReach = (inputR + inputr) + (inputr + inputO);
    if (maxReach > 295) {
        // Warning if pattern might slightly clip the edge
        errorElem.textContent = 'Note: The chosen radii may extend near the canvas border. Drawing will proceed.';
    }

    return {
        R: inputR,
        r: inputr,
        O: inputO,
        stepSize: inputStep
    };
}

/**
 * Picks stroke color based on current color mode
 */
function getStrokeStyle(currentT) {
    if (colorMode === 'rainbow') {
        // Smoothly cycle through HSL hues
        const hue = Math.floor((currentT * 45) % 360);
        return `hsl(${hue}, 85%, 50%)`;
    } else if (colorMode === 'random-segment') {
        // Instructor's randomized segment color snippet
        return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    } else {
        // Custom single color
        const customColor = document.getElementById('pen-color').value || '#173f5f';
        return customColor;
    }
}

/**
 * Draws a single step from previous coordinate to current coordinate
 */
function drawSingleStep() {
    // Drunk Spirograph option from the assignment:
    // r += 2*Math.random()-1; R += 2*Math.random()-1;
    if (isDrunk) {
        r += (2 * Math.random() - 1) * 0.8;
        R += (2 * Math.random() - 1) * 0.8;
        // Keep r positive and bounded
        if (r < 5) r = 5;
        if (R < 20) R = 20;
    }

    const pos = getSpirographPosition(R, r, O, t);
    const canvasCenterX = canvas.width / 2;
    const canvasCenterY = canvas.height / 2;
    const screenX = canvasCenterX + pos.x;
    const screenY = canvasCenterY + pos.y;

    if (prevX !== null && prevY !== null) {
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(screenX, screenY);
        ctx.strokeStyle = getStrokeStyle(t);
        ctx.lineWidth = 1.4;
        ctx.stroke();
    }

    prevX = screenX;
    prevY = screenY;
    t += stepSize;
    pointCount++;
}

/**
 * Main animation loop driven by requestAnimationFrame
 */
function animate() {
    if (!isDrawing || isPaused) return;

    const speedSelect = document.getElementById('draw-speed').value;
    const stepsThisFrame = (speedSelect === 'instant') ? 500 : parseInt(speedSelect, 10) || 15;

    for (let i = 0; i < stepsThisFrame; i++) {
        drawSingleStep();

        // Check for curve closure in normal (non-drunk) mode
        if (!isDrunk && maxT > 0 && t >= maxT) {
            finishDrawing();
            return;
        }
    }

    updateStats();
    animationFrameId = requestAnimationFrame(animate);
}

/**
 * Completes the drawing when the mathematical pattern closes
 */
function finishDrawing() {
    isDrawing = false;
    isPaused = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    updateControls();
    document.getElementById('canvas-status').textContent = 'Status: Complete! Pattern closed.';
    updateStats();
}

/**
 * Updates stats in the UI
 */
function updateStats() {
    const statsElem = document.getElementById('canvas-stats');
    statsElem.textContent = `Points: ${pointCount.toLocaleString()} | t: ${t.toFixed(2)} rad`;
}

/**
 * Starts or restarts drawing with current parameters
 */
function startDrawing() {
    const validated = validateInputs();
    if (!validated) return;

    // Read form values
    R = validated.R;
    r = validated.r;
    O = validated.O;
    stepSize = validated.stepSize;
    colorMode = document.getElementById('color-mode').value;
    isDrunk = document.getElementById('drunk-mode').checked;
    drawSpeed = document.getElementById('draw-speed').value;

    // Reset counters and canvas coordinates
    t = 0;
    pointCount = 0;
    prevX = null;
    prevY = null;

    // Calculate maximum closure angle: 2 * PI * (r / gcd(R, r))
    const divisor = gcd(R, r);
    const loops = Math.round(r / divisor);
    // Ensure at least 1 full loop, maximum 50 full rotations for complex ratios
    maxT = Math.min(2 * Math.PI * loops, 100 * Math.PI);

    // Clear canvas before drawing
    clearCanvas(false);

    // Cancel any existing animation frame
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    isDrawing = true;
    isPaused = false;
    updateControls();
    document.getElementById('canvas-status').textContent = isDrunk ? 'Status: Drawing (Drunk Mode)...' : 'Status: Drawing Spirograph...';

    // If instant drawing is requested, execute in a synchronous loop
    if (drawSpeed === 'instant') {
        const totalSteps = isDrunk ? 3000 : Math.ceil(maxT / stepSize);
        for (let i = 0; i <= totalSteps; i++) {
            drawSingleStep();
        }
        finishDrawing();
    } else {
        animate();
    }
}

/**
 * Toggles pause and resume
 */
function togglePause() {
    if (!isDrawing) return;

    isPaused = !isPaused;
    const btnPause = document.getElementById('btn-pause');

    if (isPaused) {
        btnPause.textContent = 'Resume';
        document.getElementById('canvas-status').textContent = 'Status: Paused';
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    } else {
        btnPause.textContent = 'Pause';
        document.getElementById('canvas-status').textContent = 'Status: Resumed drawing...';
        animate();
    }
}

/**
 * Clears the canvas
 */
function clearCanvas(resetUI = true) {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    isDrawing = false;
    isPaused = false;

    // Clear canvas rectangle
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw subtle origin center dot
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 2, 0, 2 * Math.PI);
    ctx.fillStyle = '#cccccc';
    ctx.fill();

    prevX = null;
    prevY = null;
    t = 0;
    pointCount = 0;

    if (resetUI) {
        updateControls();
        document.getElementById('canvas-status').textContent = 'Status: Canvas cleared (Ready)';
        updateStats();
    }
}

/**
 * Updates button enable/disable states
 */
function updateControls() {
    const btnPause = document.getElementById('btn-pause');
    const btnStart = document.getElementById('btn-start');

    if (isDrawing && !isPaused) {
        btnPause.disabled = false;
        btnPause.textContent = 'Pause';
        btnStart.textContent = 'Restart Drawing';
    } else if (isDrawing && isPaused) {
        btnPause.disabled = false;
        btnPause.textContent = 'Resume';
        btnStart.textContent = 'Restart Drawing';
    } else {
        btnPause.disabled = true;
        btnPause.textContent = 'Pause';
        btnStart.textContent = 'Start Drawing';
    }
}

/**
 * Applies a preset configuration
 */
function applyPreset(presetKey) {
    const config = presets[presetKey];
    if (!config) return;

    document.getElementById('radius-r-large').value = config.R;
    document.getElementById('radius-r-small').value = config.r;
    document.getElementById('offset-o').value = config.O;
    document.getElementById('step-size').value = config.step;
    document.getElementById('draw-speed').value = config.speed;
    document.getElementById('color-mode').value = config.color;

    // Check color row visibility
    toggleColorRow();

    // Auto-draw preset
    startDrawing();
}

/**
 * Generates valid random values for R, r, and O and starts drawing
 */
function randomizeValues() {
    // Generate R between 80 and 180
    const randomR = Math.floor(Math.random() * (180 - 80 + 1)) + 80;
    // Generate r such that 15 <= r <= randomR (satisfies r <= R)
    const randomr = Math.floor(Math.random() * (randomR - 15 + 1)) + 15;
    // Generate O between 10 and 120
    const randomO = Math.floor(Math.random() * (120 - 10 + 1)) + 10;

    document.getElementById('radius-r-large').value = randomR;
    document.getElementById('radius-r-small').value = randomr;
    document.getElementById('offset-o').value = randomO;

    // Highlight preset buttons cleanup
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));

    startDrawing();
}

/**
 * Toggles single color picker visibility
 */
function toggleColorRow() {
    const colorModeSelect = document.getElementById('color-mode');
    const singleColorRow = document.getElementById('single-color-row');
    if (colorModeSelect.value === 'single') {
        singleColorRow.style.display = 'flex';
    } else {
        singleColorRow.style.display = 'none';
    }
}

/**
 * Initializes the page and attaches event listeners
 */
function initSpirograph() {
    canvas = document.getElementById('spiro-canvas');
    if (!canvas || !canvas.getContext) return;

    ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Clear and draw center indicator
    clearCanvas(true);

    // Event Listeners for primary buttons
    document.getElementById('btn-start').addEventListener('click', startDrawing);
    document.getElementById('btn-pause').addEventListener('click', togglePause);
    document.getElementById('btn-clear').addEventListener('click', () => clearCanvas(true));
    document.getElementById('btn-random').addEventListener('click', randomizeValues);

    // Color mode change listener
    document.getElementById('color-mode').addEventListener('change', () => {
        colorMode = document.getElementById('color-mode').value;
        toggleColorRow();
    });

    // Preset buttons listeners
    const presetButtons = document.querySelectorAll('.preset-btn');
    presetButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const key = e.target.getAttribute('data-preset');
            presetButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            applyPreset(key);
        });
    });

    // Initial draw of the default preset
    startDrawing();
}

// Initialize on DOM load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSpirograph);
} else {
    initSpirograph();
}
