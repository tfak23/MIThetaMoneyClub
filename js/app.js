document.addEventListener('DOMContentLoaded', init);

// Module-level members array for use by level click handlers
let allMembers = [];

async function init() {
    const searchInput = document.getElementById('search-input');
    const loadingEl = document.getElementById('loading-indicator');
    const errorEl = document.getElementById('error-message');
    const staleCacheEl = document.getElementById('stale-cache-warning');
    const resultsListEl = document.getElementById('results-list');
    const resultDetailTopEl = document.getElementById('result-detail-top');

    // Load data
    show(loadingEl);
    hide(errorEl);
    searchInput.disabled = true;

    try {
        const [memberResult, fundData] = await Promise.all([
            getMemberData(),
            fetchFundProgress().catch(() => null)
        ]);

        const { members, stale, cacheDate } = memberResult;
        allMembers = members;
        initializeSearch(members);
        renderLevelsGrid();
        renderTopDonorsCard();
        searchInput.disabled = false;
        searchInput.focus();

        if (fundData) {
            renderFundProgress(fundData);
        }

        if (stale) {
            const date = new Date(cacheDate).toLocaleDateString();
            staleCacheEl.textContent = `Showing data from ${date}. Unable to refresh from server.`;
            show(staleCacheEl);
        }
    } catch (error) {
        hide(loadingEl);
        if (error.message === 'API_KEY_NOT_CONFIGURED') {
            errorEl.innerHTML = '<strong>API key not configured.</strong> Open <code>js/config.js</code> and replace <code>YOUR_API_KEY_HERE</code> with your Google Sheets API key.';
        } else if (error.message === 'SHEET_NOT_SHARED') {
            errorEl.innerHTML = '<strong>Unable to access spreadsheet.</strong> Ensure it is shared with "Anyone with the link" set to Viewer.';
        } else {
            errorEl.innerHTML = '<strong>Unable to load data.</strong> Please check your internet connection and try again.';
        }
        show(errorEl);
        renderLevelsGrid();
        return;
    }

    hide(loadingEl);

    // Search handler - triggers on Enter key only
    function handleSearch() {
        const query = searchInput.value;
        hide(resultDetailTopEl);
        hide(resultsListEl);

        if (!query || query.trim().length < 2) {
            resultsListEl.innerHTML = '';
            return;
        }

        const results = performSearch(query);

        if (results.length === 0) {
            resultsListEl.innerHTML = '<p class="no-results">No members found matching your search.</p>';
            show(resultsListEl);
            return;
        }

        if (results.length === 1) {
            renderResultCard(results[0].item);
            return;
        }

        renderResultsList(results);
    }

    searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSearch();
        }
    });
}

function renderResultsList(results) {
    const container = document.getElementById('results-list');
    container.innerHTML = '';

    results.forEach(result => {
        const member = result.item;
        const el = document.createElement('button');
        el.className = 'result-list-item';
        const nameClass = getMemberNameClass(member);
        el.innerHTML = `
            <div class="result-list-info">
                <span class="result-list-name ${nameClass}">${escapeHtml(member.fullName)}</span>
                <span class="result-list-roll">#${escapeHtml(member.roll)}</span>
            </div>
        `;
        el.addEventListener('click', () => renderResultCard(member));
        container.appendChild(el);
    });

    show(container);
}

function renderResultCard(member) {
    const container = document.getElementById('result-detail-top');
    const resultsListEl = document.getElementById('results-list');
    const searchInput = document.getElementById('search-input');

    // Clear search input and hide results list for a clean look
    searchInput.value = '';
    resultsListEl.innerHTML = '';
    hide(resultsListEl);

    const level = getGivingLevel(member.totalDonations);
    const nextLevel = getNextLevel(member.totalDonations);

    let badgeHtml = '';
    if (level) {
        badgeHtml = `
            <div class="badge-container">
                <img src="assets/badges/${level.badge}"
                     alt="${level.name} badge"
                     class="badge-image"
                     onerror="this.style.display='none'" />
            </div>`;
    }

    let nextLevelHtml = '';
    if (nextLevel && member.totalDonations > 0) {
        const remaining = nextLevel.min - member.totalDonations;
        nextLevelHtml = `
            <div class="next-level-info">
                <p>${formatCurrency(remaining)} away from <strong>${nextLevel.name}</strong></p>
            </div>`;
    } else if (!nextLevel && level) {
        nextLevelHtml = `<div class="next-level-info"><p>Highest giving level achieved!</p></div>`;
    }

    let levelNameHtml = '';
    if (level) {
        levelNameHtml = `<p class="giving-level-name ${level.cssClass}">${level.name}</p>`;
    } else {
        levelNameHtml = `<p class="giving-level-name">No donations recorded</p>`;
    }

    const nameClass = getMemberNameClass(member);
    const inMemoryHtml = member.isDeceased
        ? `<p class="in-memory">In Loving Memory of Brother</p>`
        : '';

    container.innerHTML = `
        <div class="card result-card">
            ${badgeHtml}
            ${inMemoryHtml}
            <h2 class="member-name ${nameClass}">${escapeHtml(member.fullName)}</h2>
            <p class="member-roll">Roll #${escapeHtml(member.roll)}</p>
            <div class="accent-divider"></div>
            <p class="donation-amount">${formatCurrency(member.totalDonations)}</p>
            ${levelNameHtml}
            ${nextLevelHtml}
        </div>
    `;

    show(container);
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderLevelsGrid() {
    const grid = document.getElementById('levels-grid');
    if (!grid) return;

    grid.innerHTML = '';

    GIVING_LEVELS.forEach(level => {
        const rangeText = level.max === Infinity
            ? `${formatCurrency(level.min)}+`
            : `${formatCurrency(level.min)} – ${formatCurrency(level.max)}`;

        const card = document.createElement('div');
        card.className = `level-card ${level.cssClass}`;
        card.innerHTML = `
            <img src="assets/badges/${level.badge}"
                 alt="${level.name}"
                 class="level-card-badge"
                 onerror="this.style.display='none'" />
            <h3 class="level-card-name">${level.name}</h3>
            <p class="level-card-range">${rangeText}</p>
        `;
        card.addEventListener('click', () => renderLevelMembers(level));
        grid.appendChild(card);
    });
}

function renderLevelMembers(level) {
    const container = document.getElementById('level-members');
    if (!container) return;

    const membersInLevel = allMembers.filter(m => {
        const memberLevel = getGivingLevel(m.totalDonations);
        return memberLevel && memberLevel.name === level.name;
    });

    membersInLevel.sort((a, b) => a.lastName.localeCompare(b.lastName));

    const memberListHtml = membersInLevel.length > 0
        ? `<div class="level-members-list">
            ${membersInLevel.map(m => `
                <div class="level-member-item ${getMemberNameClass(m)}">${escapeHtml(m.fullName)}</div>
            `).join('')}
           </div>`
        : '<p class="no-results">No members at this giving level yet.</p>';

    container.innerHTML = `
        <div class="card level-members-card">
            <div class="level-members-header">
                <img src="assets/badges/${level.badge}"
                     alt="${level.name}"
                     class="level-members-badge"
                     onerror="this.style.display='none'" />
                <div>
                    <h2 class="level-members-title">${level.name}</h2>
                    <p class="level-members-count">${membersInLevel.length} member${membersInLevel.length !== 1 ? 's' : ''}</p>
                </div>
            </div>
            <div class="accent-divider"></div>
            ${memberListHtml}
        </div>
    `;

    show(container);
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderTopDonorsCard() {
    const container = document.getElementById('top-donors-btn');
    if (!container) return;

    container.innerHTML = `
        <div class="top-donors-card-btn">
            <div class="top-donors-icon">&#9733;</div>
            <h3 class="top-donors-btn-label">Top 10 Donors</h3>
        </div>
    `;
    container.addEventListener('click', () => showTopDonorsList());
    show(container);
}

function showTopDonorsList() {
    const container = document.getElementById('top-donors');
    if (!container) return;

    const topMembers = [...allMembers]
        .filter(m => m.totalDonations > 0)
        .sort((a, b) => b.totalDonations - a.totalDonations)
        .slice(0, 10);

    if (topMembers.length === 0) return;

    container.innerHTML = `
        <div class="card level-members-card">
            <div class="level-members-header">
                <div class="top-donors-icon-large">&#9733;</div>
                <div>
                    <h2 class="level-members-title">Top 10 Donors</h2>
                </div>
            </div>
            <div class="accent-divider"></div>
            <div class="top-donors-list">
                ${topMembers.map((m, i) => {
                    const level = getGivingLevel(m.totalDonations);
                    const levelName = level ? level.name : '';
                    const nameClass = getMemberNameClass(m);
                    return `
                        <div class="top-donor-item">
                            <span class="top-donor-rank">${i + 1}</span>
                            <span class="top-donor-name ${nameClass}">${escapeHtml(m.fullName)}</span>
                            <span class="top-donor-level">${levelName}</span>
                        </div>`;
                }).join('')}
            </div>
        </div>
    `;

    show(container);
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderFundProgress(fundData) {
    const container = document.getElementById('fund-progress');
    if (!container) return;

    const activeFunds = [
        { name: 'Balanced Man Scholarship', total: fundData.bms.total, goal: fundData.bms.goal, completed: false },
        { name: 'Leadership Fund', total: fundData.leadership.total, goal: fundData.leadership.goal, completed: false },
    ];

    const completedFunds = [
        { name: 'John Joseph Jurewicz II Burning Heart Scholarship', total: 25000, goal: 25000, completed: true },
        { name: 'Patrick J. Taggart Jr. Passion Scholarship', total: 62500, goal: 62500, completed: true },
    ];

    const allFunds = [...activeFunds, ...completedFunds];

    const asOfText = fundData.asOfDate ? `As of ${fundData.asOfDate}` : '';

    container.innerHTML = `
        <h2 class="section-title">Fund Progress</h2>
        <div class="accent-divider accent-divider-center"></div>
        ${asOfText ? `<p class="fund-as-of">${asOfText}</p>` : ''}
        <div class="fund-bars">
            ${allFunds.map(fund => {
                const pct = Math.min((fund.total / fund.goal) * 100, 100);
                const fillClass = fund.completed ? 'progress-bar-fill-completed' : 'progress-bar-fill';
                const label = fund.completed ? 'Completed' : `${Math.round(pct)}%`;
                return `
                    <div class="fund-bar-item">
                        <div class="fund-bar-header">
                            <span class="fund-bar-name">${fund.name}</span>
                            ${fund.completed ? '<span class="fund-completed-badge">Completed</span>' : ''}
                        </div>
                        <div class="progress-bar-track">
                            <div class="${fillClass}" style="width: ${pct}%">
                                <span class="progress-bar-label">${label}</span>
                            </div>
                        </div>
                        <div class="fund-bar-amounts">
                            <span>${formatCurrency(fund.total)} raised</span>
                            <span>Goal: ${formatCurrency(fund.goal)}</span>
                        </div>
                    </div>`;
            }).join('')}
        </div>
    `;

    show(container);
}

// Returns CSS class for member name styling (deceased takes priority over current-year donor)
function getMemberNameClass(member) {
    if (member.isDeceased) return 'deceased';
    if (member.isCurrentYearDonor) return 'current-year-donor';
    return '';
}

// Utility functions
function show(el) { if (el) el.classList.remove('hidden'); }
function hide(el) { if (el) el.classList.add('hidden'); }

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
