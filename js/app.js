document.addEventListener('DOMContentLoaded', init);

// Module-level members array for use by level click handlers
let allMembers = [];
// Track which panel is currently open for toggle behavior
let openLevelName = null;
let topDonorsOpen = false;
let scholarshipData = null;
let openScholarshipKey = null;
let decadeOpen = false;
let decadeData = null;

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
        const [memberResult, fundData, decData] = await Promise.all([
            getMemberData(),
            fetchFundProgress().catch(() => null),
            fetchDecadeData().catch(() => null)
        ]);

        const { members, stale, cacheDate } = memberResult;
        allMembers = members;
        decadeData = decData;
        initializeSearch(members);
        renderLevelsGrid();
        renderTopDonorsCard();
        renderDecadeCard();
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
                <span class="result-list-roll">#${escapeHtml(member.rollShort)}</span>
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

    let ctaHtml = '';
    if (member.totalDonations === 0) {
        const is2020s = member.decade && member.decade.toLowerCase().includes('2020');
        const ctaText = is2020s
            ? 'The 2020s haven\'t made it on the Donations by Decade board yet — be the first to represent your era!'
            : 'Make a difference today! Support your chapter by donating to one of our scholarship endowments below.';
        ctaHtml = `
            <div class="donate-cta">
                <p class="donate-cta-text">${ctaText}</p>
                <div class="donate-cta-buttons">
                    <a href="https://give.sigep.org/give/211213/?_ga=2.62207717.837129945.1670203913-1808852390.1670203913#!/donation/checkout?designation=155554"
                       class="donate-cta-btn" target="_blank" rel="noopener noreferrer">Support BMS Fund</a>
                    <a href="https://give.sigep.org/give/211213/?_ga=2.62207717.837129945.1670203913-1808852390.1670203913#!/donation/checkout?designation=155555"
                       class="donate-cta-btn donate-cta-btn-alt" target="_blank" rel="noopener noreferrer">Support Leadership Fund</a>
                </div>
            </div>`;
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
            <p class="member-roll">Chapter Roll #${escapeHtml(member.rollShort)}</p>
            <div class="accent-divider"></div>
            <p class="donation-amount">${formatCurrency(member.totalDonations)}</p>
            ${levelNameHtml}
            ${nextLevelHtml}
            ${ctaHtml}
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

    // Toggle: clicking the same level again closes it
    if (openLevelName === level.name && !container.classList.contains('hidden')) {
        hide(container);
        openLevelName = null;
        return;
    }
    openLevelName = level.name;

    // Close top donors if open
    topDonorsOpen = false;
    hide(document.getElementById('top-donors'));

    // Close decade leaderboard if open
    decadeOpen = false;
    hide(document.getElementById('decade-leaderboard'));

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

    // Toggle: clicking again closes it
    if (topDonorsOpen && !container.classList.contains('hidden')) {
        hide(container);
        topDonorsOpen = false;
        return;
    }
    topDonorsOpen = true;

    // Close level members if open
    openLevelName = null;
    hide(document.getElementById('level-members'));

    // Close decade leaderboard if open
    decadeOpen = false;
    hide(document.getElementById('decade-leaderboard'));

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

function renderDecadeCard() {
    const container = document.getElementById('decade-btn');
    if (!container || !decadeData) return;

    container.innerHTML = `
        <div class="decade-card-btn">
            <div class="decade-icon">&#9876;&#65039;</div>
            <h3 class="decade-btn-label">Decades Battle</h3>
        </div>
    `;
    container.addEventListener('click', () => showDecadeLeaderboard());
    show(container);
}

function showDecadeLeaderboard() {
    const container = document.getElementById('decade-leaderboard');
    if (!container || !decadeData) return;

    // Toggle: clicking again closes it
    if (decadeOpen && !container.classList.contains('hidden')) {
        hide(container);
        decadeOpen = false;
        return;
    }
    decadeOpen = true;

    // Close other panels
    topDonorsOpen = false;
    openLevelName = null;
    hide(document.getElementById('top-donors'));
    hide(document.getElementById('level-members'));

    // Sort decades by total descending for ranking
    const sorted = [...decadeData].sort((a, b) => b.total - a.total);
    const maxTotal = sorted.length > 0 ? sorted[0].total : 1;

    // Calculate grand total for percentages
    const grandTotal = sorted.reduce((sum, d) => sum + d.total, 0);
    const maxPct = grandTotal > 0 ? (sorted[0].total / grandTotal) * 100 : 0;

    container.innerHTML = `
        <div class="card level-members-card">
            <div class="level-members-header">
                <div class="decade-icon-large">&#9876;&#65039;</div>
                <div>
                    <h2 class="level-members-title">Decades Battle</h2>
                </div>
            </div>
            <div class="accent-divider"></div>
            <div class="banner-field">
                <div class="banner-row">
                    ${sorted.map((d, i) => {
                        const sharePct = grandTotal > 0 ? ((d.total / grandTotal) * 100).toFixed(1) : '0.0';
                        const heightPct = maxPct > 0 && d.total > 0 ? (parseFloat(sharePct) / maxPct) * 100 : 0;
                        const isZero = d.total === 0;
                        const donorCount = d.donors || 0;
                        return `
                            <div class="banner-column">
                                <div class="banner-pole">
                                    <div class="banner-flag${isZero ? ' banner-flag-zero' : ''}" style="height: ${isZero ? 0 : heightPct}%">
                                        <span class="banner-flag-pct">${isZero ? '' : sharePct + '%'}</span>
                                        <div class="banner-flag-tip"></div>
                                    </div>
                                </div>
                                <div class="banner-base">
                                    <span class="banner-decade-name">${escapeHtml(d.label)}</span>
                                    ${isZero
                                        ? '<span class="banner-cta">Rally the<br>troops!</span>'
                                        : `<span class="banner-donors">${donorCount} Donor${donorCount !== 1 ? 's' : ''}</span>`
                                    }
                                </div>
                            </div>`;
                    }).join('')}
                </div>
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
        { name: 'John Jurewicz II Burning Heart Scholarship', total: 25000, goal: 25000, completed: true, scholarshipKey: 'jurewicz' },
        { name: 'Patrick J. Taggart Jr. Passion Scholarship', total: 62500, goal: 62500, completed: true, scholarshipKey: 'taggart' },
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
                const clickableClass = fund.completed ? ' fund-bar-clickable' : '';
                return `
                    <div class="fund-bar-item${clickableClass}" ${fund.scholarshipKey ? `data-scholarship="${fund.scholarshipKey}"` : ''}>
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
                        ${fund.completed ? '<p class="fund-bar-hint">Click to view scholarship details</p>' : ''}
                    </div>`;
            }).join('')}
        </div>
    `;

    // Add click listeners to completed fund bars
    container.querySelectorAll('.fund-bar-clickable').forEach(el => {
        el.addEventListener('click', () => {
            const key = el.getAttribute('data-scholarship');
            if (key) showScholarshipDetail(key);
        });
    });

    show(container);
}

async function showScholarshipDetail(key) {
    const container = document.getElementById('scholarship-detail');
    if (!container) return;

    // Toggle: clicking same scholarship again closes it
    if (openScholarshipKey === key && !container.classList.contains('hidden')) {
        hide(container);
        openScholarshipKey = null;
        return;
    }
    openScholarshipKey = key;

    // Lazy load scholarship data
    if (!scholarshipData) {
        container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading scholarship data...</p></div>';
        show(container);
        try {
            scholarshipData = await fetchScholarshipData();
        } catch (err) {
            container.innerHTML = '<p class="no-results">Unable to load scholarship data.</p>';
            show(container);
            return;
        }
    }

    const info = scholarshipData[key];
    if (!info) return;

    const title = key === 'jurewicz'
        ? 'John Jurewicz II Burning Heart Scholarship'
        : 'Patrick J. Taggart Jr. Passion Scholarship';

    container.innerHTML = `
        <div class="card scholarship-card">
            <h2 class="scholarship-title">${title}</h2>
            <div class="accent-divider"></div>
            <p class="scholarship-purpose">${escapeHtml(info.purpose)}</p>
            <h3 class="scholarship-recipients-heading">Past Recipients</h3>
            <div class="scholarship-recipients">
                ${info.recipients.map(r => `
                    <div class="scholarship-recipient">
                        <span class="recipient-name">${escapeHtml(r.name)}</span>
                        ${r.year ? `<span class="recipient-year">${escapeHtml(r.year)}</span>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    show(container);
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Returns CSS class for member name styling (deceased takes priority over current-year donor)
function getMemberNameClass(member) {
    if (member.isDeceased) return 'deceased';
    if (member.isCurrentYearDonor) return 'current-year-donor';
    if (member.isPreviousYearDonor) return 'previous-year-donor';
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
