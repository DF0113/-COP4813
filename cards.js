/**
 * COP4813 Assignment 7 - HTML5 Drag & Drop Card Deck & Discard Pile
 * Student: Dakota Freed
 * Features:
 *   - 52-card deck management with Fisher-Yates shuffle & duplicate prevention
 *   - Native HTML5 Drag and Drop API (dragstart, dragend, dragover, dragenter, dragleave, drop)
 *   - Drop target action triggering (discard pile placement, event alert, poker hand evaluation, action logging)
 *   - Optional auto-replacement card dealing and full event history log
 */

// Deck Configuration & Suit Metadata
const SUITS = {
    'S': { name: 'Spades', symbol: '♠', color: '#111827' },
    'H': { name: 'Hearts', symbol: '♥', color: '#dc2626' },
    'D': { name: 'Diamonds', symbol: '♦', color: '#dc2626' },
    'C': { name: 'Clubs', symbol: '♣', color: '#111827' }
};

const RANK_NAMES = {
    1: 'Ace', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven',
    8: 'Eight', 9: 'Nine', 10: 'Ten', 11: 'Jack', 12: 'Queen', 13: 'King'
};

// Application State
let deck = [];
let hand = [];
let discardPile = [];
let autoReplace = true;
let draggedCardCode = null;

/**
 * Builds a standard 52-card deck
 */
function createDeck() {
    const newDeck = [];
    for (const suitCode of ['S', 'H', 'D', 'C']) {
        for (let rankNum = 1; rankNum <= 13; rankNum++) {
            newDeck.push({
                code: `${suitCode}${rankNum}`,
                suit: suitCode,
                rank: rankNum,
                suitName: SUITS[suitCode].name,
                rankName: RANK_NAMES[rankNum],
                fullName: `${RANK_NAMES[rankNum]} of ${SUITS[suitCode].name}`,
                image: `images/cards/${suitCode}${rankNum}.svg`
            });
        }
    }
    return newDeck;
}

/**
 * Shuffles an array in place using Fisher-Yates algorithm
 */
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * Initializes and resets the game deck
 */
function resetDeck(logAction = true) {
    deck = shuffle(createDeck());
    hand = [];
    discardPile = [];
    draggedCardCode = null;

    updateUI();
    resetDiscardPileUI();

    if (logAction) {
        logEvent('Deck reshuffled (52 cards ready). Active hand and discard pile reset.');
        showAlertBanner('Deck reshuffled! Click "Deal Hand" to start.');
    }
}

/**
 * Deals a given number of cards to the player's hand
 */
function dealHand(count = 5) {
    if (deck.length < count) {
        showAlertBanner('Not enough cards remaining in deck! Reshuffling...');
        resetDeck(false);
    }

    hand = [];
    for (let i = 0; i < count; i++) {
        if (deck.length > 0) {
            hand.push(deck.pop());
        }
    }

    updateUI();
    logEvent(`Dealt ${hand.length} cards from deck to player hand.`);
    showAlertBanner(`Dealt a fresh hand of ${hand.length} cards. Drag any card to the Discard Pile!`);
}

/**
 * Deals a single card into the active hand
 */
function dealOneCard() {
    if (hand.length >= 5) {
        showAlertBanner('Your hand is already full (maximum 5 cards). Discard a card first!');
        return;
    }

    if (deck.length === 0) {
        showAlertBanner('The draw deck is empty! Please reset or reshuffle.');
        return;
    }

    const newCard = deck.pop();
    hand.push(newCard);
    updateUI();
    logEvent(`Dealt 1 card: ${newCard.fullName}.`);
    showAlertBanner(`Dealt ${newCard.fullName} to your hand.`);
}

/**
 * Renders the active cards in the hand with HTML5 Drag attributes and listeners
 */
function renderHand() {
    const container = document.getElementById('hand-container');
    container.innerHTML = '';

    if (hand.length === 0) {
        container.innerHTML = `
            <div class="empty-hand-prompt" id="empty-hand-msg">
                Your hand is empty. Click <strong>"Deal Hand"</strong> to draw cards.
            </div>
        `;
        return;
    }

    const fragment = document.createDocumentFragment();

    hand.forEach(card => {
        const cardWrapper = document.createElement('div');
        cardWrapper.className = 'card-wrapper';
        cardWrapper.setAttribute('data-card-code', card.code);

        const img = document.createElement('img');
        img.src = card.image;
        img.alt = card.fullName;
        img.className = 'card-image hand-card';
        img.title = `Drag to discard ${card.fullName}`;
        
        // Native HTML5 Drag and Drop Attributes
        img.setAttribute('draggable', 'true');
        img.setAttribute('data-card-code', card.code);

        // Attach Drag Events to each card image
        img.addEventListener('dragstart', handleDragStart);
        img.addEventListener('dragend', handleDragEnd);

        // Mobile / Click-to-discard alternative for accessibility
        img.addEventListener('dblclick', () => {
            discardCard(card.code, 'Double-Click');
        });

        cardWrapper.appendChild(img);
        fragment.appendChild(cardWrapper);
    });

    container.appendChild(fragment);
}

/**
 * HTML5 Drag Handler: dragstart
 */
function handleDragStart(e) {
    const cardCode = e.target.getAttribute('data-card-code');
    draggedCardCode = cardCode;

    // Set drag data
    e.dataTransfer.setData('text/plain', cardCode);
    e.dataTransfer.effectAllowed = 'move';

    // Visual feedback
    e.target.classList.add('is-dragging');

    const card = hand.find(c => c.code === cardCode);
    if (card) {
        logEvent(`[dragstart] Started dragging: ${card.fullName} (${card.code})`);
    }
}

/**
 * HTML5 Drag Handler: dragend
 */
function handleDragEnd(e) {
    e.target.classList.remove('is-dragging');
    draggedCardCode = null;

    // Remove any lingering drop highlights
    const dropTarget = document.getElementById('discard-drop-target');
    if (dropTarget) {
        dropTarget.classList.remove('drag-over-active');
    }
}

/**
 * HTML5 Drop Target Handler: dragover
 * Must prevent default to allow drop
 */
function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

/**
 * HTML5 Drop Target Handler: dragenter
 */
function handleDragEnter(e) {
    e.preventDefault();
    const dropTarget = document.getElementById('discard-drop-target');
    dropTarget.classList.add('drag-over-active');
}

/**
 * HTML5 Drop Target Handler: dragleave
 */
function handleDragLeave(e) {
    const dropTarget = document.getElementById('discard-drop-target');
    // Only remove class if leaving the drop target itself
    if (e.target === dropTarget) {
        dropTarget.classList.remove('drag-over-active');
    }
}

/**
 * HTML5 Drop Target Handler: drop
 * Primary required grading action trigger!
 */
function handleDrop(e) {
    e.preventDefault();

    const dropTarget = document.getElementById('discard-drop-target');
    dropTarget.classList.remove('drag-over-active');

    // Retrieve dragged card code from dataTransfer (fallback to tracked variable)
    const cardCode = e.dataTransfer.getData('text/plain') || draggedCardCode;

    if (!cardCode) {
        console.warn('Drop event received with no card data.');
        return;
    }

    discardCard(cardCode, 'Drag-and-Drop');
}

/**
 * Core Discard & Event Trigger Action
 */
function discardCard(cardCode, actionType = 'Drag-and-Drop') {
    const cardIndex = hand.findIndex(c => c.code === cardCode);
    if (cardIndex === -1) {
        console.warn(`Card ${cardCode} not found in active hand.`);
        return;
    }

    // Remove from hand and add to discard pile
    const [discardedCard] = hand.splice(cardIndex, 1);
    discardPile.push(discardedCard);

    // Update Discard Pile UI to show top card
    updateDiscardPileUI(discardedCard);

    // ACTION TRIGGER 1: Captured Event Toast Banner
    const alertMessage = `✓ Event Captured (${actionType}): Discarded ${discardedCard.fullName} (${discardedCard.code}) to the Discard Pile!`;
    showAlertBanner(alertMessage);

    // ACTION TRIGGER 2: Event History Log Entry
    logEvent(`[DROP EVENT] ${discardedCard.fullName} successfully discarded via ${actionType}.`);

    // Optional Auto-Replacement Card Dealing
    const autoReplaceCheckbox = document.getElementById('auto-replace-toggle');
    const shouldReplace = autoReplaceCheckbox ? autoReplaceCheckbox.checked : false;

    if (shouldReplace && deck.length > 0 && hand.length < 5) {
        const replacementCard = deck.pop();
        hand.push(replacementCard);
        logEvent(`[Auto-Replace] Dealt replacement card: ${replacementCard.fullName}.`);
    }

    updateUI();
}

/**
 * Updates visual representation of the Discard Pile drop target
 */
function updateDiscardPileUI(topCard) {
    const placeholder = document.getElementById('drop-zone-placeholder');
    const stack = document.getElementById('discard-stack');

    if (!topCard) {
        resetDiscardPileUI();
        return;
    }

    placeholder.style.display = 'none';
    stack.style.display = 'block';
    stack.innerHTML = `
        <div class="discarded-card-display">
            <img src="${topCard.image}" alt="${topCard.fullName}" class="card-image discard-top-card">
            <span class="discard-badge">Top Discard: ${topCard.rankName} of ${topCard.suitName}</span>
        </div>
    `;
}

/**
 * Resets discard pile UI to initial placeholder
 */
function resetDiscardPileUI() {
    const placeholder = document.getElementById('drop-zone-placeholder');
    const stack = document.getElementById('discard-stack');
    placeholder.style.display = 'block';
    stack.style.display = 'none';
    stack.innerHTML = '';
}

/**
 * Displays prominent event capture notification banner
 */
function showAlertBanner(message) {
    const banner = document.getElementById('event-alert-banner');
    const textElem = document.getElementById('event-alert-text');
    if (!banner || !textElem) return;

    textElem.textContent = message;
    banner.style.display = 'flex';

    // Trigger subtle pulse animation
    banner.classList.remove('pulse-animation');
    void banner.offsetWidth; // Trigger reflow
    banner.classList.add('pulse-animation');
}

/**
 * Appends timestamped log entry to event history list
 */
function logEvent(actionText) {
    const logList = document.getElementById('event-log-list');
    if (!logList) return;

    // Remove initial placeholder message on first log
    const initialLog = logList.querySelector('.initial-log');
    if (initialLog) {
        initialLog.remove();
    }

    const now = new Date();
    const timestamp = now.toLocaleTimeString();

    const li = document.createElement('li');
    li.className = 'log-item';
    li.innerHTML = `<span class="log-time">[${timestamp}]</span> <span class="log-text">${escapeHtml(actionText)}</span>`;

    logList.insertBefore(li, logList.firstChild);

    // Limit log entries to last 30
    while (logList.children.length > 30) {
        logList.removeChild(logList.lastChild);
    }
}

/**
 * Simple Poker Hand Evaluator (Rankings: Flush, Straight, Three of a Kind, Pairs, High Card)
 */
function evaluateHand(cards) {
    if (!cards || cards.length === 0) return 'No cards dealt';
    if (cards.length < 5) return `${cards.length} Card${cards.length > 1 ? 's' : ''} in hand`;

    const rankCounts = {};
    const suitCounts = {};
    const ranks = [];

    cards.forEach(card => {
        rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
        suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
        ranks.push(card.rank);
    });

    ranks.sort((a, b) => a - b);
    const counts = Object.values(rankCounts).sort((a, b) => b - a);
    const isFlush = Object.values(suitCounts).some(count => count === 5);

    // Check Straight
    let isStraight = false;
    const isStandardStraight = ranks[4] - ranks[0] === 4 && new Set(ranks).size === 5;
    const isAceLowStraight = JSON.stringify(ranks) === JSON.stringify([1, 2, 3, 4, 5]);
    const isBroadWayStraight = JSON.stringify(ranks) === JSON.stringify([1, 10, 11, 12, 13]);
    isStraight = isStandardStraight || isAceLowStraight || isBroadWayStraight;

    if (isFlush && isBroadWayStraight) return 'Royal Flush!';
    if (isFlush && isStraight) return 'Straight Flush!';
    if (counts[0] === 4) return 'Four of a Kind!';
    if (counts[0] === 3 && counts[1] === 2) return 'Full House!';
    if (isFlush) return 'Flush!';
    if (isStraight) return 'Straight!';
    if (counts[0] === 3) return 'Three of a Kind';
    if (counts[0] === 2 && counts[1] === 2) return 'Two Pair';
    if (counts[0] === 2) {
        const pairRank = Object.keys(rankCounts).find(r => rankCounts[r] === 2);
        return `One Pair (${RANK_NAMES[pairRank]}s)`;
    }

    const highRank = ranks.includes(1) ? 1 : ranks[ranks.length - 1];
    return `High Card (${RANK_NAMES[highRank]})`;
}

/**
 * Updates UI counters, hand display, and evaluations
 */
function updateUI() {
    // Counts
    document.getElementById('deck-count').textContent = deck.length;
    document.getElementById('hand-count').textContent = hand.length;
    document.getElementById('discard-count').textContent = discardPile.length;

    // Deck visual state (dim if empty)
    const deckVisual = document.getElementById('deck-visual');
    if (deckVisual) {
        deckVisual.style.opacity = deck.length === 0 ? '0.35' : '1.0';
    }

    // Evaluate Hand
    const handEvaluation = evaluateHand(hand);
    document.getElementById('hand-evaluation').textContent = handEvaluation;

    // Re-render hand cards
    renderHand();
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
 * Initializes all event listeners on page load
 */
function initCardsApp() {
    // Toolbar buttons
    document.getElementById('btn-deal-hand').addEventListener('click', () => dealHand(5));
    document.getElementById('btn-deal-one').addEventListener('click', dealOneCard);
    document.getElementById('btn-reset-deck').addEventListener('click', () => resetDeck(true));

    // Clear event log button
    const btnClearLog = document.getElementById('btn-clear-log');
    if (btnClearLog) {
        btnClearLog.addEventListener('click', () => {
            const logList = document.getElementById('event-log-list');
            if (logList) {
                logList.innerHTML = '<li class="log-item initial-log">Log cleared. Ready for new drag-and-drop events.</li>';
            }
        });
    }

    // Discard Pile Drop Target Listeners (Native HTML5 Drag and Drop)
    const dropTarget = document.getElementById('discard-drop-target');
    if (dropTarget) {
        dropTarget.addEventListener('dragover', handleDragOver);
        dropTarget.addEventListener('dragenter', handleDragEnter);
        dropTarget.addEventListener('dragleave', handleDragLeave);
        dropTarget.addEventListener('drop', handleDrop);
    }

    // Initialize game with fresh shuffled deck
    resetDeck(false);
}

// Attach initialization on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCardsApp);
} else {
    initCardsApp();
}
