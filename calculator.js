/**
 * COP4813 Assignment 4 - Creating Plots
 * Damped Harmonic Oscillation Calculator & Plotter
 * Student: Dakota Freed
 * Equation: y(x) = A * e^(-gamma * x) * cos(omega * x + phi)
 */

// Global state variables
let chartInstance = null;
let currentData = {
    xValues: [],
    yValues: [],
    upperEnvelope: [],
    lowerEnvelope: [],
    params: {}
};

// Preset configurations
const presets = {
    'underdamped': {
        amplitude: 10.0,
        damping: 0.2,
        omega: 2.5,
        phi: 0.0,
        xmin: 0.0,
        xmax: 15.0,
        xstep: 0.1
    },
    'lightly-damped': {
        amplitude: 10.0,
        damping: 0.05,
        omega: 3.0,
        phi: 0.0,
        xmin: 0.0,
        xmax: 25.0,
        xstep: 0.1
    },
    'high-freq': {
        amplitude: 8.0,
        damping: 0.35,
        omega: 8.0,
        phi: 0.0,
        xmin: 0.0,
        xmax: 12.0,
        xstep: 0.05
    },
    'undamped': {
        amplitude: 10.0,
        damping: 0.0,
        omega: 2.0,
        phi: 0.0,
        xmin: 0.0,
        xmax: 20.0,
        xstep: 0.1
    }
};

/**
 * Calculates a single y value for the damped harmonic oscillator
 * y(x) = A * exp(-gamma * x) * cos(omega * x + phi)
 */
function calculateY(A, gamma, omega, phi, x) {
    return A * Math.exp(-gamma * x) * Math.cos(omega * x + phi);
}

/**
 * Calculates the exponential envelope magnitude: A * exp(-gamma * x)
 */
function calculateEnvelope(A, gamma, x) {
    return Math.abs(A) * Math.exp(-gamma * x);
}

/**
 * Validates and reads form parameters
 */
function getFormParameters() {
    const errorElem = document.getElementById('calc-error');
    errorElem.textContent = '';

    const A = parseFloat(document.getElementById('amplitude').value);
    const gamma = parseFloat(document.getElementById('damping').value);
    const omega = parseFloat(document.getElementById('omega').value);
    const phi = parseFloat(document.getElementById('phi').value);
    const xmin = parseFloat(document.getElementById('xmin').value);
    const xmax = parseFloat(document.getElementById('xmax').value);
    const xstep = parseFloat(document.getElementById('xstep').value);
    const showEnvelope = document.getElementById('show-envelope').checked;

    // Validation checks
    if (isNaN(A) || isNaN(gamma) || isNaN(omega) || isNaN(phi) || isNaN(xmin) || isNaN(xmax) || isNaN(xstep)) {
        errorElem.textContent = 'Error: Please enter valid numbers for all parameters.';
        return null;
    }

    if (xmin >= xmax) {
        errorElem.textContent = 'Error: X Min must be strictly less than X Max.';
        return null;
    }

    if (xstep <= 0) {
        errorElem.textContent = 'Error: Step size (Δx) must be greater than zero.';
        return null;
    }

    if (gamma < 0) {
        errorElem.textContent = 'Error: Damping coefficient (γ) should be non-negative (≥ 0).';
        return null;
    }

    const estimatedPoints = Math.floor((xmax - xmin) / xstep) + 1;
    if (estimatedPoints > 3000) {
        errorElem.textContent = 'Error: Step size produces over 3,000 points. Please increase the step size for optimal browser performance.';
        return null;
    }

    return { A, gamma, omega, phi, xmin, xmax, xstep, showEnvelope };
}

/**
 * Generates data arrays across the requested x range
 */
function calculate() {
    const params = getFormParameters();
    if (!params) return false;

    const { A, gamma, omega, phi, xmin, xmax, xstep } = params;

    const xVals = [];
    const yVals = [];
    const upperEnv = [];
    const lowerEnv = [];

    // Loop through x range with floating point rounding safeguard
    const steps = Math.round((xmax - xmin) / xstep);
    for (let i = 0; i <= steps; i++) {
        const x = parseFloat((xmin + i * xstep).toFixed(6));
        const y = calculateY(A, gamma, omega, phi, x);
        const env = calculateEnvelope(A, gamma, x);

        xVals.push(x);
        yVals.push(parseFloat(y.toFixed(6)));
        upperEnv.push(parseFloat(env.toFixed(6)));
        lowerEnv.push(parseFloat((-env).toFixed(6)));
    }

    currentData = {
        xValues: xVals,
        yValues: yVals,
        upperEnvelope: upperEnv,
        lowerEnvelope: lowerEnv,
        params: params
    };

    displayValues();
    updateMetrics();
    return true;
}

/**
 * Updates the summary metrics card
 */
function updateMetrics() {
    const { omega } = currentData.params;
    const yVals = currentData.yValues;

    if (!yVals || yVals.length === 0) return;

    // Period T = 2*pi / omega
    const periodElem = document.getElementById('stat-period');
    const freqElem = document.getElementById('stat-frequency');
    if (Math.abs(omega) > 0.0001) {
        const T = (2 * Math.PI) / Math.abs(omega);
        const f = 1 / T;
        periodElem.textContent = T.toFixed(4) + ' s';
        freqElem.textContent = f.toFixed(4) + ' Hz';
    } else {
        periodElem.textContent = 'N/A (ω = 0)';
        freqElem.textContent = '0.0000 Hz';
    }

    // Extremes
    const maxY = Math.max(...yVals);
    const minY = Math.min(...yVals);
    document.getElementById('stat-max-y').textContent = maxY.toFixed(4);
    document.getElementById('stat-min-y').textContent = minY.toFixed(4);
    document.getElementById('stat-total-points').textContent = yVals.length.toLocaleString();
}

/**
 * Populates the solutions table and raw output text
 */
function displayValues() {
    const tableBody = document.getElementById('table-body');
    const rawOutput = document.getElementById('output-text');
    const { xValues, yValues, upperEnvelope, lowerEnvelope, params } = currentData;

    tableBody.innerHTML = '';

    // Build table rows
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < xValues.length; i++) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${i + 1}</td>
            <td>${xValues[i].toFixed(3)}</td>
            <td><strong>${yValues[i].toFixed(4)}</strong></td>
            <td>${upperEnvelope[i].toFixed(4)}</td>
            <td>${lowerEnvelope[i].toFixed(4)}</td>
        `;
        fragment.appendChild(tr);
    }
    tableBody.appendChild(fragment);

    // Also provide raw summary text (matching the instructor's sample output style)
    let rawText = `<strong>Equation:</strong> y(x) = ${params.A} &middot; e<sup>-${params.gamma}x</sup> &middot; cos(${params.omega}x + ${params.phi})<br/>`;
    rawText += `<strong>Sample Range:</strong> ${params.xmin} &le; x &le; ${params.xmax} (Step: ${params.xstep})<br/>`;
    rawText += `<strong>First 5 Solutions:</strong><br/>`;
    const previewCount = Math.min(5, xValues.length);
    for (let i = 0; i < previewCount; i++) {
        rawText += `&nbsp;&nbsp;x[${i}] = ${xValues[i].toFixed(3)} &rarr; y = ${yValues[i].toFixed(4)}<br/>`;
    }
    if (xValues.length > 5) {
        rawText += `&nbsp;&nbsp;... [${xValues.length - 5} more points in table above]`;
    }
    rawOutput.innerHTML = rawText;
}

/**
 * Plots the data using Highcharts
 */
function plotValues() {
    if (!calculate()) return;

    const { xValues, yValues, upperEnvelope, lowerEnvelope, params } = currentData;

    // Prepare coordinate pairs for Highcharts [x, y]
    const mainSeriesData = [];
    const upperEnvData = [];
    const lowerEnvData = [];

    for (let i = 0; i < xValues.length; i++) {
        mainSeriesData.push([xValues[i], yValues[i]]);
        if (params.showEnvelope) {
            upperEnvData.push([xValues[i], upperEnvelope[i]]);
            lowerEnvData.push([xValues[i], lowerEnvelope[i]]);
        }
    }

    const seriesConfig = [
        {
            name: 'y(x) Damped Wave',
            data: mainSeriesData,
            color: '#173f5f',
            lineWidth: 2.5,
            marker: {
                enabled: xValues.length <= 40,
                radius: 3,
                symbol: 'circle'
            },
            tooltip: {
                valueDecimals: 4
            }
        }
    ];

    if (params.showEnvelope) {
        seriesConfig.push({
            name: '+Envelope (+Ae^(-γx))',
            data: upperEnvData,
            color: '#d9534f',
            dashStyle: 'ShortDash',
            lineWidth: 1.5,
            marker: { enabled: false },
            tooltip: { valueDecimals: 4 }
        });
        seriesConfig.push({
            name: '-Envelope (-Ae^(-γx))',
            data: lowerEnvData,
            color: '#d9534f',
            dashStyle: 'ShortDash',
            lineWidth: 1.5,
            marker: { enabled: false },
            tooltip: { valueDecimals: 4 }
        });
    }

    // Render Highcharts chart
    chartInstance = Highcharts.chart('plot-container', {
        chart: {
            type: 'spline',
            zooming: {
                type: 'xy'
            },
            backgroundColor: '#ffffff'
        },
        title: {
            text: 'Damped Harmonic Motion: y(x) = A &middot; e<sup>-&gamma;x</sup> &middot; cos(&omega;x + &phi;)',
            useHTML: true,
            style: {
                color: '#173f5f',
                fontWeight: 'bold',
                fontSize: '16px'
            }
        },
        subtitle: {
            text: `A=${params.A}, &gamma;=${params.gamma}, &omega;=${params.omega} rad/s, &phi;=${params.phi} rad`,
            useHTML: true,
            style: {
                color: '#555555'
            }
        },
        xAxis: {
            title: {
                text: 'Independent Variable (x: Time or Distance)',
                style: { fontWeight: 'bold' }
            },
            gridLineWidth: 1,
            gridLineColor: '#eeeeee',
            crosshair: true
        },
        yAxis: {
            title: {
                text: 'Dependent Variable (y: Displacement)',
                style: { fontWeight: 'bold' }
            },
            gridLineColor: '#e0e0e0',
            plotLines: [{
                value: 0,
                width: 1.5,
                color: '#888888',
                dashStyle: 'Dot',
                zIndex: 3
            }]
        },
        tooltip: {
            shared: true,
            crosshairs: true,
            valueDecimals: 4
        },
        legend: {
            align: 'center',
            verticalAlign: 'bottom',
            layout: 'horizontal'
        },
        credits: {
            enabled: false
        },
        exporting: {
            enabled: true
        },
        series: seriesConfig
    });
}

/**
 * Loads a preset configuration into the form
 */
function applyPreset(presetKey) {
    const config = presets[presetKey];
    if (!config) return;

    document.getElementById('amplitude').value = config.amplitude;
    document.getElementById('damping').value = config.damping;
    document.getElementById('omega').value = config.omega;
    document.getElementById('phi').value = config.phi;
    document.getElementById('xmin').value = config.xmin;
    document.getElementById('xmax').value = config.xmax;
    document.getElementById('xstep').value = config.xstep;

    // Auto-calculate and replot with the new preset
    plotValues();
}

/**
 * Resets form to original default seed values
 */
function resetForm() {
    applyPreset('underdamped');
}

/**
 * Sets up all interactive event listeners
 */
function initCalculator() {
    // Action buttons
    const btnCalculate = document.getElementById('btn-calculate');
    const btnPlot = document.getElementById('btn-plot');
    const btnReset = document.getElementById('btn-reset');
    const showEnvelopeCheckbox = document.getElementById('show-envelope');
    const toggleTableBtn = document.getElementById('toggle-table-btn');
    const tableWrapper = document.getElementById('table-wrapper');

    if (btnCalculate) {
        btnCalculate.addEventListener('click', () => {
            if (calculate()) {
                // Ensure table is visible and visible feedback provided
                tableWrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }

    if (btnPlot) {
        btnPlot.addEventListener('click', () => {
            plotValues();
        });
    }

    if (btnReset) {
        btnReset.addEventListener('click', () => {
            resetForm();
        });
    }

    if (showEnvelopeCheckbox) {
        showEnvelopeCheckbox.addEventListener('change', () => {
            plotValues();
        });
    }

    if (toggleTableBtn) {
        toggleTableBtn.addEventListener('click', () => {
            if (tableWrapper.style.maxHeight === 'none') {
                tableWrapper.style.maxHeight = '280px';
                toggleTableBtn.textContent = 'Expand Full Table';
            } else {
                tableWrapper.style.maxHeight = 'none';
                toggleTableBtn.textContent = 'Collapse Table';
            }
        });
    }

    // Preset buttons
    const presetButtons = document.querySelectorAll('.preset-btn');
    presetButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const presetKey = e.target.getAttribute('data-preset');
            applyPreset(presetKey);

            // Visual feedback for active preset
            presetButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });
    });

    // Mark default preset as active initially
    const defaultBtn = document.querySelector('.preset-btn[data-preset="underdamped"]');
    if (defaultBtn) {
        defaultBtn.classList.add('active');
    }

    // Initial calculation and plot on load
    plotValues();
}

// Run initialization once the DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCalculator);
} else {
    initCalculator();
}
