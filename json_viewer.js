/**
 * COP4813 Assignment 6 - JSON External Data Viewer
 * Student: Dakota Freed
 * Features:
 *   - Asynchronous fetch() loading of external JSON files
 *   - Response parsing via response.json()
 *   - Real-time client-side search, filtering, and sorting
 *   - Dual human-readable views (interactive table & card grid)
 *   - Multi-dataset switcher and raw JSON payload inspector
 */

// Global Application State
let rawJsonString = '';
let currentDataset = null;
let filteredPlayers = [];
let sortConfig = { key: 'pointsPerGame', direction: 'desc' };
let activeView = 'table'; // 'table' or 'cards'

/**
 * Loads and parses external JSON file asynchronously via fetch()
 */
async function loadJsonData(filePath) {
    const errorElem = document.getElementById('json-error-message');
    const loadingElem = document.getElementById('loading-spinner');
    const headingElem = document.getElementById('dataset-heading');

    errorElem.textContent = '';
    loadingElem.style.display = 'block';

    try {
        const response = await fetch(filePath, { cache: 'no-cache' });
        if (!response.ok) {
            throw new Error(`HTTP Error ${response.status}: Unable to load ${filePath}`);
        }

        rawJsonString = await response.text();
        currentDataset = JSON.parse(rawJsonString);

        if (!currentDataset || !Array.isArray(currentDataset.players)) {
            throw new Error('Invalid JSON structure: missing "players" array.');
        }

        // Update dataset heading with season info
        if (headingElem && currentDataset.season) {
            headingElem.textContent = `${currentDataset.season} Season Summary (${currentDataset.league || 'NBA'})`;
        }

        // Populate raw JSON code viewer
        const rawCodeElem = document.getElementById('raw-json-code');
        if (rawCodeElem) {
            rawCodeElem.textContent = JSON.stringify(currentDataset, null, 2);
        }

        // Apply filters, sorting, and render
        applyFilters();

    } catch (err) {
        console.error('Failed to load external JSON:', err);
        errorElem.textContent = `Error loading JSON data: ${err.message}. Please verify the external file exists and is well-formed.`;
        clearDisplay();
    } finally {
        loadingElem.style.display = 'none';
    }
}

/**
 * Filters the dataset based on search term and position dropdown
 */
function applyFilters() {
    if (!currentDataset || !Array.isArray(currentDataset.players)) return;

    const searchTerm = document.getElementById('search-input').value.trim().toLowerCase();
    const positionFilter = document.getElementById('position-filter').value;

    filteredPlayers = currentDataset.players.filter(player => {
        const matchesSearch = !searchTerm || 
            player.playerName.toLowerCase().includes(searchTerm) || 
            player.team.toLowerCase().includes(searchTerm);

        const matchesPosition = positionFilter === 'all' || 
            player.position.toLowerCase() === positionFilter.toLowerCase();

        return matchesSearch && matchesPosition;
    });

    applySorting();
    updateSummaryStats();
    renderCurrentView();
}

/**
 * Sorts filtered players by currently selected key and direction
 */
function applySorting() {
    const { key, direction } = sortConfig;

    filteredPlayers.sort((a, b) => {
        let valA = a[key];
        let valB = b[key];

        if (typeof valA === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        } else {
            return direction === 'asc' ? (valA - valB) : (valB - valA);
        }
    });

    updateSortHeaderIndicators();
}

/**
 * Updates visual sort indicators (arrows) in table header
 */
function updateSortHeaderIndicators() {
    const headers = document.querySelectorAll('.sortable-th');
    headers.forEach(th => {
        const sortKey = th.getAttribute('data-sort');
        const iconSpan = th.querySelector('.sort-icon');
        if (sortKey === sortConfig.key) {
            iconSpan.innerHTML = sortConfig.direction === 'asc' ? '&#x25B2;' : '&#x25BC;';
            th.classList.add('active-sort');
        } else {
            iconSpan.innerHTML = '&#x21C5;';
            th.classList.remove('active-sort');
        }
    });
}

/**
 * Computes and renders summary metrics
 */
function updateSummaryStats() {
    const totalElem = document.getElementById('stat-total-players');
    const topScorerElem = document.getElementById('stat-top-scorer');
    const topPpgElem = document.getElementById('stat-top-ppg');
    const avgPpgElem = document.getElementById('stat-avg-ppg');
    const totalTeamsElem = document.getElementById('stat-total-teams');

    if (!filteredPlayers || filteredPlayers.length === 0) {
        totalElem.textContent = '0';
        topScorerElem.textContent = 'None';
        topPpgElem.textContent = '-- PPG';
        avgPpgElem.textContent = '0.0';
        totalTeamsElem.textContent = '0';
        return;
    }

    // Total Players
    totalElem.textContent = filteredPlayers.length.toString();

    // Top Scorer
    const topPlayer = filteredPlayers.reduce((max, p) => (p.pointsPerGame > max.pointsPerGame ? p : max), filteredPlayers[0]);
    topScorerElem.textContent = topPlayer.playerName;
    topPpgElem.textContent = `${topPlayer.pointsPerGame.toFixed(1)} PPG`;

    // Average PPG
    const totalPoints = filteredPlayers.reduce((sum, p) => sum + p.pointsPerGame, 0);
    const avgPoints = totalPoints / filteredPlayers.length;
    avgPpgElem.textContent = avgPoints.toFixed(1);

    // Distinct Teams
    const distinctTeams = new Set(filteredPlayers.map(p => p.team));
    totalTeamsElem.textContent = distinctTeams.size.toString();
}

/**
 * Renders data into active view container (Table or Card Grid)
 */
function renderCurrentView() {
    if (activeView === 'table') {
        renderTableView();
    } else {
        renderCardView();
    }
}

/**
 * Renders data as a structured HTML table
 */
function renderTableView() {
    const tbody = document.getElementById('players-table-body');
    tbody.innerHTML = '';

    if (filteredPlayers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="no-records-cell">No players match the current search or position filter.</td></tr>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    filteredPlayers.forEach((player, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${escapeHtml(player.playerName)}</strong></td>
            <td>${escapeHtml(player.team)}</td>
            <td><span class="position-badge badge-${player.position.toLowerCase()}">${escapeHtml(player.position)}</span></td>
            <td>${player.gamesPlayed}</td>
            <td class="highlight-stat"><strong>${player.pointsPerGame.toFixed(1)}</strong></td>
            <td>${player.reboundsPerGame.toFixed(1)}</td>
            <td>${player.assistsPerGame.toFixed(1)}</td>
            <td>${player.fieldGoalPercentage.toFixed(1)}%</td>
        `;
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
}

/**
 * Renders data as a responsive card grid
 */
function renderCardView() {
    const cardGrid = document.getElementById('players-card-grid');
    cardGrid.innerHTML = '';

    if (filteredPlayers.length === 0) {
        cardGrid.innerHTML = `<p class="no-records-cell">No players match the current search or position filter.</p>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    filteredPlayers.forEach((player, index) => {
        const card = document.createElement('div');
        card.className = 'player-card';
        card.innerHTML = `
            <div class="card-header">
                <span class="card-rank">#${index + 1}</span>
                <span class="position-badge badge-${player.position.toLowerCase()}">${escapeHtml(player.position)}</span>
            </div>
            <h4 class="card-name">${escapeHtml(player.playerName)}</h4>
            <p class="card-team">${escapeHtml(player.team)}</p>
            <div class="card-stats-grid">
                <div class="mini-stat">
                    <span class="mini-label">PPG</span>
                    <span class="mini-val highlight-stat">${player.pointsPerGame.toFixed(1)}</span>
                </div>
                <div class="mini-stat">
                    <span class="mini-label">RPG</span>
                    <span class="mini-val">${player.reboundsPerGame.toFixed(1)}</span>
                </div>
                <div class="mini-stat">
                    <span class="mini-label">APG</span>
                    <span class="mini-val">${player.assistsPerGame.toFixed(1)}</span>
                </div>
                <div class="mini-stat">
                    <span class="mini-label">FG%</span>
                    <span class="mini-val">${player.fieldGoalPercentage.toFixed(1)}%</span>
                </div>
            </div>
            <div class="card-footer">
                <span>Games Played: ${player.gamesPlayed}</span>
            </div>
        `;
        fragment.appendChild(card);
    });

    cardGrid.appendChild(fragment);
}

/**
 * Clears display in case of error
 */
function clearDisplay() {
    document.getElementById('players-table-body').innerHTML = '';
    document.getElementById('players-card-grid').innerHTML = '';
    updateSummaryStats();
}

/**
 * Safely escapes HTML special characters
 */
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Initializes all event listeners and loads default JSON dataset
 */
function initJsonViewer() {
    const datasetSelect = document.getElementById('dataset-select');
    const btnReload = document.getElementById('btn-reload-json');
    const searchInput = document.getElementById('search-input');
    const positionFilter = document.getElementById('position-filter');
    const btnViewTable = document.getElementById('btn-view-table');
    const btnViewCards = document.getElementById('btn-view-cards');
    const btnToggleRaw = document.getElementById('btn-toggle-raw');
    const rawDrawer = document.getElementById('raw-json-drawer');
    const tableViewContainer = document.getElementById('table-view-container');
    const cardViewContainer = document.getElementById('card-view-container');

    // Dataset Switcher Listener
    datasetSelect.addEventListener('change', () => {
        loadJsonData(datasetSelect.value);
    });

    // Reload Button Listener
    btnReload.addEventListener('click', () => {
        loadJsonData(datasetSelect.value);
    });

    // Search and Position Filter Listeners
    searchInput.addEventListener('input', applyFilters);
    positionFilter.addEventListener('change', applyFilters);

    // Table Header Sorting Listeners
    const sortHeaders = document.querySelectorAll('.sortable-th');
    sortHeaders.forEach(th => {
        th.addEventListener('click', () => {
            const key = th.getAttribute('data-sort');
            if (sortConfig.key === key) {
                // Toggle direction
                sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
            } else {
                sortConfig.key = key;
                sortConfig.direction = (key === 'playerName' || key === 'team' || key === 'position') ? 'asc' : 'desc';
            }
            applySorting();
            renderCurrentView();
        });
    });

    // View Mode Toggle Listeners
    btnViewTable.addEventListener('click', () => {
        activeView = 'table';
        btnViewTable.classList.add('active');
        btnViewTable.setAttribute('aria-pressed', 'true');
        btnViewCards.classList.remove('active');
        btnViewCards.setAttribute('aria-pressed', 'false');
        tableViewContainer.style.display = 'block';
        cardViewContainer.style.display = 'none';
        renderCurrentView();
    });

    btnViewCards.addEventListener('click', () => {
        activeView = 'cards';
        btnViewCards.classList.add('active');
        btnViewCards.setAttribute('aria-pressed', 'true');
        btnViewTable.classList.remove('active');
        btnViewTable.setAttribute('aria-pressed', 'false');
        tableViewContainer.style.display = 'none';
        cardViewContainer.style.display = 'block';
        renderCurrentView();
    });

    // Raw JSON Accordion Drawer Listener
    btnToggleRaw.addEventListener('click', () => {
        const isHidden = rawDrawer.style.display === 'none';
        if (isHidden) {
            rawDrawer.style.display = 'block';
            btnToggleRaw.textContent = 'Hide Raw JSON';
        } else {
            rawDrawer.style.display = 'none';
            btnToggleRaw.textContent = 'Show Raw JSON';
        }
    });

    // Initial Load of default dataset (players_2024.json)
    loadJsonData(datasetSelect.value);
}

// Attach initialization on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initJsonViewer);
} else {
    initJsonViewer();
}
