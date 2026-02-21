document.addEventListener('DOMContentLoaded', () => {
    init();
    initShareButton();
});

function initShareButton() {
    const btn = document.getElementById('share-btn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        const shareData = {
            title: 'MI Theta Money Club',
            text: 'Check out the MI Theta Money Club — look up giving levels and support our chapter!',
            url: window.location.href
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                // User cancelled or share failed — ignore
            }
        } else {
            // Fallback: copy link to clipboard
            try {
                await navigator.clipboard.writeText(window.location.href);
                btn.classList.add('share-copied');
                btn.setAttribute('aria-label', 'Link copied!');
                setTimeout(() => {
                    btn.classList.remove('share-copied');
                    btn.setAttribute('aria-label', 'Share this page');
                }, 2000);
            } catch (err) {
                // Last resort: prompt with mailto/sms options
                const subject = encodeURIComponent('Check out MI Theta Money Club');
                const body = encodeURIComponent('Check out the MI Theta Money Club: ' + window.location.href);
                window.location.href = 'mailto:?subject=' + subject + '&body=' + body;
            }
        }
    });
}

// Module-level members array for use by level click handlers
let allMembers = [];
// Track which panel is currently open for toggle behavior
let openLevelName = null;
let topDonorsOpen = false;
let scholarshipData = null;
let openScholarshipKey = null;
let decadeOpen = false;
let decadeData = null;
let monthlyDonorsOpen = false;
let monthlyDonorsData = null;

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
        const [memberResult, fundData, decData, monthlyData] = await Promise.all([
            getMemberData(),
            fetchFundProgress().catch(() => null),
            fetchDecadeData().catch(() => null),
            fetchMonthlyDonors().catch(() => null)
        ]);

        const { members, stale, cacheDate } = memberResult;
        allMembers = members;
        decadeData = decData;
        monthlyDonorsData = monthlyData;
        initializeSearch(members);
        renderLevelsGrid();
        renderTopDonorsCard();
        renderDecadeCard();
        renderMonthlyDonorsCard();
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

    // Progress bar toward next level
    let progressBarHtml = '';
    if (nextLevel && level && member.totalDonations > 0) {
        const remaining = nextLevel.min - member.totalDonations;
        const range = nextLevel.min - level.min;
        const progress = ((member.totalDonations - level.min) / range) * 100;
        const pct = Math.min(Math.max(progress, 2), 100);
        progressBarHtml = `
            <div class="level-progress">
                <div class="level-progress-header">
                    <span>${level.name} (${formatCurrency(level.min)})</span>
                    <span><strong>${nextLevel.name} (${formatCurrency(nextLevel.min)})</strong></span>
                </div>
                <div class="level-progress-track">
                    <div class="level-progress-fill" style="width: ${pct.toFixed(1)}%"></div>
                </div>
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

    // Donor messaging: thank you, previous year nudge, lapsed nudge, or zero-donor CTA
    const bmsFundUrl = 'https://give.sigep.org/give/211213/?_ga=2.62207717.837129945.1670203913-1808852390.1670203913#!/donation/checkout?designation=155554';
    const leadershipFundUrl = 'https://give.sigep.org/give/211213/?_ga=2.62207717.837129945.1670203913-1808852390.1670203913#!/donation/checkout?designation=155555';

    let donorMessageHtml = '';
    if (member.isDeceased) {
        // No messaging for deceased brothers
    } else if (member.isCurrentYearDonor) {
        // Current year donor: thank you
        donorMessageHtml = `
            <div class="thank-you-banner">
                <div class="thank-you-icon">&#9829;</div>
                <p>Thank you for your generous contribution this year, Brother! Your support keeps MI Theta strong.</p>
            </div>`;
    } else if (member.isPreviousYearDonor) {
        // Previous year donor: thank + gentle nudge with CTA
        const nudgeText = nextLevel && member.totalDonations > 0
            ? `Thank you for donating last year! Keep the momentum going — you're only <strong>${formatCurrency(nextLevel.min - member.totalDonations)}</strong> away from <strong>${nextLevel.name}</strong>.`
            : 'Thank you for donating last year! Keep the momentum going — make your impact again this year.';
        donorMessageHtml = `
            <div class="previous-year-banner">
                <div class="previous-year-icon">&#128170;</div>
                <p>${nudgeText}</p>
                <div class="previous-year-cta-buttons">
                    <a href="${bmsFundUrl}" class="previous-year-cta-btn" target="_blank" rel="noopener noreferrer">Support BMS Fund</a>
                    <a href="${leadershipFundUrl}" class="previous-year-cta-btn previous-year-cta-btn-alt" target="_blank" rel="noopener noreferrer">Support Leadership Fund</a>
                </div>
            </div>`;
    } else if (member.totalDonations > 0) {
        // Lapsed donor: has donated before but not in current or previous year
        const lapsedText = nextLevel
            ? `It's been a while since your last donation. You're only <strong>${formatCurrency(nextLevel.min - member.totalDonations)}</strong> away from the next level — pick up where you left off!`
            : 'It\'s been a while since your last donation — pick up where you left off and keep MI Theta strong!';
        donorMessageHtml = `
            <div class="lapsed-cta">
                <p>${lapsedText}</p>
                <div class="lapsed-cta-buttons">
                    <a href="${bmsFundUrl}" class="lapsed-cta-btn" target="_blank" rel="noopener noreferrer">Support BMS Fund</a>
                    <a href="${leadershipFundUrl}" class="lapsed-cta-btn lapsed-cta-btn-alt" target="_blank" rel="noopener noreferrer">Support Leadership Fund</a>
                </div>
            </div>`;
    } else {
        // Zero donor CTA
        const is2020s = member.decade && member.decade.toLowerCase().includes('2020');
        const ctaText = is2020s
            ? 'The 2020s haven\'t made it on the Donations by Decade board yet — be the first to represent your era!'
            : 'Make a difference today! Support your chapter by donating to one of our scholarship endowments below.';
        donorMessageHtml = `
            <div class="donate-cta">
                <p class="donate-cta-text">${ctaText}</p>
                <div class="donate-cta-buttons">
                    <a href="${bmsFundUrl}" class="donate-cta-btn" target="_blank" rel="noopener noreferrer">Support BMS Fund</a>
                    <a href="${leadershipFundUrl}" class="donate-cta-btn donate-cta-btn-alt" target="_blank" rel="noopener noreferrer">Support Leadership Fund</a>
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
            ${progressBarHtml}
            ${nextLevelHtml}
            ${donorMessageHtml}
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

    // Close monthly donors if open
    monthlyDonorsOpen = false;
    hide(document.getElementById('monthly-donors-leaderboard'));

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

    // Close monthly donors if open
    monthlyDonorsOpen = false;
    hide(document.getElementById('monthly-donors-leaderboard'));

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
    monthlyDonorsOpen = false;
    hide(document.getElementById('top-donors'));
    hide(document.getElementById('level-members'));
    hide(document.getElementById('monthly-donors-leaderboard'));

    // Sort decades by total descending, exclude Friends of SigEp
    const sorted = [...decadeData]
        .filter(d => d.label.toLowerCase() !== 'friends of sigep')
        .sort((a, b) => b.total - a.total);
    const maxTotal = sorted.length > 0 ? sorted[0].total : 1;

    // Calculate grand total for percentages
    const grandTotal = sorted.reduce((sum, d) => sum + d.total, 0);

    // Find max values for scaling
    const maxPct = grandTotal > 0 ? (sorted[0].total / grandTotal) * 100 : 1;
    const maxDonors = Math.max(...sorted.map(d => d.donors || 0), 1);

    container.innerHTML = `
        <div class="card level-members-card">
            <div class="level-members-header">
                <div class="decade-icon-large">&#9876;&#65039;</div>
                <div>
                    <h2 class="level-members-title">Decades Battle</h2>
                </div>
            </div>
            <div class="accent-divider"></div>
            <div class="chart-legend">
                <span class="chart-legend-item"><span class="chart-legend-swatch chart-legend-pct"></span>% of Donations</span>
                <span class="chart-legend-item"><span class="chart-legend-swatch chart-legend-donors"></span># of Donors</span>
            </div>
            <div class="chart-container">
                ${sorted.map((d, i) => {
                    const sharePct = grandTotal > 0 ? ((d.total / grandTotal) * 100).toFixed(1) : '0.0';
                    const pctHeight = grandTotal > 0 && d.total > 0 ? (parseFloat(sharePct) / maxPct) * 100 : 0;
                    const donorCount = d.donors || 0;
                    const donorHeight = donorCount > 0 ? (donorCount / maxDonors) * 100 : 0;
                    const isZero = d.total === 0;
                    return `
                        <div class="chart-group">
                            <div class="chart-bars">
                                <div class="chart-bar-wrapper">
                                    <span class="chart-bar-value chart-val-pct">${isZero ? '0%' : sharePct + '%'}</span>
                                    <div class="chart-bar chart-bar-pct" style="height: ${pctHeight}%"></div>
                                </div>
                                <div class="chart-bar-wrapper">
                                    <span class="chart-bar-value chart-val-donors">${donorCount}</span>
                                    <div class="chart-bar chart-bar-donors" style="height: ${donorHeight}%"></div>
                                </div>
                            </div>
                            <span class="chart-label">${escapeHtml(d.label)}</span>
                        </div>`;
                }).join('')}
            </div>
            <p class="decade-chart-subtext">Organized by join date</p>
        </div>
    `;

    show(container);
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderMonthlyDonorsCard() {
    const container = document.getElementById('monthly-donors-btn');
    if (!container || !monthlyDonorsData || monthlyDonorsData.length === 0) return;

    container.innerHTML = `
        <div class="monthly-donors-card-btn">
            <div class="monthly-donors-icon">&#128293;</div>
            <h3 class="monthly-donors-btn-label">Monthly Donors</h3>
        </div>
    `;
    container.addEventListener('click', () => showMonthlyDonors());
    show(container);
}

function showMonthlyDonors() {
    const container = document.getElementById('monthly-donors-leaderboard');
    if (!container || !monthlyDonorsData) return;

    // Toggle: clicking again closes it
    if (monthlyDonorsOpen && !container.classList.contains('hidden')) {
        hide(container);
        monthlyDonorsOpen = false;
        return;
    }
    monthlyDonorsOpen = true;

    // Close other panels
    topDonorsOpen = false;
    decadeOpen = false;
    openLevelName = null;
    hide(document.getElementById('top-donors'));
    hide(document.getElementById('decade-leaderboard'));
    hide(document.getElementById('level-members'));

    function getStreakTier(streak) {
        if (streak >= 60) return { cls: 'legendary', label: '5yr+' };
        if (streak >= 36) return { cls: 'epic', label: '3yr+' };
        if (streak >= 24) return { cls: 'gold', label: '2yr+' };
        if (streak >= 12) return { cls: 'silver', label: '1yr+' };
        if (streak >= 6) return { cls: 'bronze', label: '6mo+' };
        return { cls: '', label: '' };
    }

    function fundBadges(fund) {
        const bms = '<img src="assets/badges/balanced-man.jpg" alt="BMS" class="monthly-fund-badge" />';
        const lead = '<img src="assets/badges/leadership.jpg" alt="Leadership" class="monthly-fund-badge" />';
        if (fund === 'Both') return bms + lead;
        if (fund === 'BMS') return bms;
        return lead;
    }

    const rows = monthlyDonorsData.map((d, i) => {
        const tier = getStreakTier(d.streak);
        const tierClass = tier.cls ? ` monthly-tier-${tier.cls}` : '';
        const milestoneHtml = tier.label ? `<span class="monthly-milestone">${tier.label}</span>` : '';
        return `
            <div class="monthly-donor-item${tierClass}">
                <span class="monthly-rank">${i + 1}</span>
                <span class="monthly-name">${escapeHtml(d.name)}</span>
                <span class="monthly-badges">${fundBadges(d.fund)}</span>
                <span class="monthly-streak">&#128293; ${d.streak}${milestoneHtml}</span>
            </div>`;
    }).join('');

    container.innerHTML = `
        <div class="card level-members-card">
            <div class="level-members-header">
                <div class="monthly-donors-icon-large">&#128293;</div>
                <div>
                    <h2 class="level-members-title">Monthly Donors</h2>
                    <p class="level-members-count">${monthlyDonorsData.length} active streak${monthlyDonorsData.length !== 1 ? 's' : ''}</p>
                </div>
            </div>
            <div class="accent-divider"></div>
            <div class="monthly-donors-list">
                ${rows}
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
        { name: 'Balanced Man Scholarship', total: fundData.bms.total, goal: fundData.bms.goal, completed: false, fundKey: 'bms' },
        { name: 'Leadership Fund', total: fundData.leadership.total, goal: fundData.leadership.goal, completed: false, fundKey: 'leadership' },
    ];

    const completedFunds = [
        { name: 'John Jurewicz II Burning Heart Scholarship', total: 25000, goal: 25000, completed: true, scholarshipKey: 'jurewicz' },
        { name: 'Patrick J. Taggart Jr. Passion Scholarship', total: 62500, goal: 62500, completed: true, scholarshipKey: 'taggart' },
    ];

    const memorialFund = [
        { name: 'Campus Memorial', total: 25000, goal: null, memorial: true },
    ];

    const allFunds = [...activeFunds, ...completedFunds, ...memorialFund];

    const asOfText = fundData.asOfDate ? `As of ${fundData.asOfDate}` : '';

    container.innerHTML = `
        <h2 class="section-title">Fund Progress</h2>
        <div class="accent-divider accent-divider-center"></div>
        ${asOfText ? `<p class="fund-as-of">${asOfText}</p>` : ''}
        <div class="fund-bars">
            ${allFunds.map(fund => {
                if (fund.memorial) {
                    return `
                    <div class="fund-bar-item fund-bar-clickable fund-bar-memorial" data-memorial="true">
                        <div class="fund-bar-header">
                            <span class="fund-bar-name">${fund.name}</span>
                            <span class="fund-onhold-badge">Help Needed</span>
                        </div>
                        <div class="progress-bar-track">
                            <div class="progress-bar-fill-memorial" style="width: 100%">
                                <span class="progress-bar-label">Fundraising On Hold</span>
                            </div>
                        </div>
                        <div class="fund-bar-amounts">
                            <span>${formatCurrency(fund.total)} raised</span>
                            <span>Goal: TBD</span>
                        </div>
                        <p class="fund-bar-hint">Click to view more</p>
                    </div>`;
                }
                const pct = Math.min((fund.total / fund.goal) * 100, 100);
                const fillClass = fund.completed ? 'progress-bar-fill-completed' : 'progress-bar-fill';
                const label = fund.completed ? 'Completed' : `${Math.round(pct)}%`;
                const clickableClass = (fund.completed || fund.fundKey) ? ' fund-bar-clickable' : '';
                const dataAttr = fund.scholarshipKey ? `data-scholarship="${fund.scholarshipKey}"` : (fund.fundKey ? `data-fund="${fund.fundKey}"` : '');
                const hintText = (fund.completed || fund.fundKey) ? 'Click to view more' : '';
                return `
                    <div class="fund-bar-item${clickableClass}" ${dataAttr}>
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
                        ${hintText ? `<p class="fund-bar-hint">${hintText}</p>` : ''}
                    </div>`;
            }).join('')}
        </div>
    `;

    // Add click listeners to clickable fund bars
    container.querySelectorAll('.fund-bar-clickable').forEach(el => {
        el.addEventListener('click', () => {
            const key = el.getAttribute('data-scholarship');
            const fundKey = el.getAttribute('data-fund');
            if (key) showScholarshipDetail(key);
            if (el.getAttribute('data-memorial')) showMemorialDetail();
            if (fundKey) showActiveFundDetail(fundKey);
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
    openActiveFundKey = null;

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
            ${key === 'jurewicz' ? '<p class="scholarship-campaign-note">The JJ Scholarship and Campus Memorial efforts were launched together in 2009 as one campaign.</p>' : ''}
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

let openActiveFundKey = null;

function showActiveFundDetail(key) {
    const container = document.getElementById('scholarship-detail');
    if (!container) return;

    // Toggle
    if (openActiveFundKey === key && !container.classList.contains('hidden')) {
        hide(container);
        openActiveFundKey = null;
        return;
    }
    openActiveFundKey = key;
    openScholarshipKey = null;

    const DONATE_BMS = 'https://give.sigep.org/give/211213/?_ga=2.62207717.837129945.1670203913-1808852390.1670203913#!/donation/checkout?designation=155554';
    const DONATE_LEADERSHIP = 'https://give.sigep.org/give/211213/?_ga=2.62207717.837129945.1670203913-1808852390.1670203913#!/donation/checkout?designation=155555';

    let html = '';

    if (key === 'bms') {
        html = `
        <div class="card scholarship-card active-fund-card">
            <h2 class="scholarship-title">Balanced Man Scholarship Endowment</h2>
            <div class="accent-divider"></div>
            <p class="active-fund-goal-note">Goal: $125,000 &mdash; fully funds a <strong>$5,000 annual scholarship</strong> matched by Lawrence Tech for a combined <strong>$10,000 award</strong></p>
            <div class="active-fund-section">
                <h3 class="active-fund-heading">What This Fund Does</h3>
                <p>The Balanced Man Scholarship Endowment supports the recruitment of the best men on campus at Lawrence Technological University by offering a competitive scholarship to outstanding incoming male freshman students. Once fully funded at $125,000, the endowment will generate $5,000 annually — and Lawrence Tech has committed to matching that award dollar-for-dollar, bringing the total scholarship to $10,000 for potential new members.</p>
            </div>
            <div class="active-fund-section">
                <h3 class="active-fund-heading">Why It Matters</h3>
                <p>The Balanced Man Scholarship is one of the most powerful recruitment tools in the SigEp playbook. It introduces high-achieving freshman students to the chapter with no obligation to join, creating meaningful relationships with the best men on campus right from the start. SigEp offers this scholarship at over 140 universities nationally, and MI Theta's endowment ensures our chapter can compete for top talent at Lawrence Tech year after year.</p>
            </div>
            <div class="active-fund-donate">
                <a href="${DONATE_BMS}" class="active-fund-donate-btn" target="_blank" rel="noopener noreferrer">Support the BMS Fund</a>
            </div>
        </div>`;
    } else if (key === 'leadership') {
        html = `
        <div class="card scholarship-card active-fund-card">
            <h2 class="scholarship-title">Leadership Fund Endowment</h2>
            <div class="accent-divider"></div>
            <p class="active-fund-goal-note">Once fully funded, the endowment will produce <strong>$3,000 annually</strong> to support sending undergraduates to the Leadership Continuum</p>
            <div class="active-fund-section">
                <h3 class="active-fund-heading">What This Fund Does</h3>
                <p>The Leadership Fund supports active undergraduate members by covering registration and travel costs to attend the National Fraternity's premier leadership development events. These programs are transformative experiences that shape the next generation of leaders — and our endowment ensures no brother misses out due to cost.</p>
            </div>
            <div class="active-fund-section">
                <h3 class="active-fund-heading">Leadership Continuum</h3>
                <div class="active-fund-programs">
                    <div class="active-fund-program-item">
                        <span class="active-fund-program-name"><a href="https://sigep.org/the-sigep-experience/events/ruck/" target="_blank" rel="noopener noreferrer">Ruck Leadership Institute</a></span>
                        <span class="active-fund-program-desc">SigEp's landmark leadership program, held annually in Richmond, VA. Scholars are selected competitively and work with executive-level alumni mentors to develop real leadership skills. MI Theta has sent at least one brother to Ruck every year since 2005.</span>
                    </div>
                    <div class="active-fund-program-item">
                        <span class="active-fund-program-name"><a href="https://sigep.org/the-sigep-experience/events/tragos-quest-to-greece/" target="_blank" rel="noopener noreferrer">Tragos Quest to Greece</a></span>
                        <span class="active-fund-program-desc">An unmatched study abroad experience exploring the Greek origins of SigEp's values, philosophy, and the Balanced Man ideal — visiting Athens, Delphi, Olympia, and more. MI Theta has produced five Tragos Scholars since 2012.</span>
                    </div>
                    <div class="active-fund-program-item">
                        <span class="active-fund-program-name"><a href="https://sigep.org/the-sigep-experience/events/carlson/" target="_blank" rel="noopener noreferrer">Carlson Leadership Academies</a></span>
                        <span class="active-fund-program-desc">Each winter, new executive board officers attend Carlson to step confidently into their roles with clear goals and skills tailored to their position — from President to VP of Recruitment. Countless MI Theta brothers have been sponsored to attend.</span>
                    </div>
                    <div class="active-fund-program-item">
                        <span class="active-fund-program-name"><a href="https://sigep.org/the-sigep-experience/events/grand-chapter-conclave/" target="_blank" rel="noopener noreferrer">Grand Chapter Conclave</a></span>
                        <span class="active-fund-program-desc">SigEp's biennial national gathering where brothers celebrate chapter success, including the prestigious Buchanan Cup, while developing leadership and life skills alongside brothers from across the country.</span>
                    </div>
                </div>
            </div>
            <div class="active-fund-donate">
                <a href="${DONATE_LEADERSHIP}" class="active-fund-donate-btn active-fund-donate-btn-alt" target="_blank" rel="noopener noreferrer">Support the Leadership Fund</a>
            </div>
        </div>`;
    }

    container.innerHTML = html;
    show(container);
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

let memorialOpen = false;

function showMemorialDetail() {
    const container = document.getElementById('memorial-detail');
    if (!container) return;

    // Toggle: clicking again closes it
    if (memorialOpen && !container.classList.contains('hidden')) {
        hide(container);
        memorialOpen = false;
        return;
    }
    memorialOpen = true;

    // Close scholarship detail if open
    openScholarshipKey = null;
    hide(document.getElementById('scholarship-detail'));

    const emailTo = 'sigepsam@gmail.com,rrochon1901@gmail.com,sigep.mitheta.alumni@gmail.com';
    const emailSubject = encodeURIComponent('Campus Memorial - Volunteer Interest');
    const emailBody = encodeURIComponent('Hello,\n\nI am interested in volunteering to help support the MI Theta On Campus Memorial project at Lawrence Tech. Please let me know how I can get involved.\n\nThank you!');
    const mailtoLink = `mailto:${emailTo}?subject=${emailSubject}&body=${emailBody}`;

    container.innerHTML = `
        <div class="card memorial-card">
            <h2 class="memorial-title">Campus Memorial</h2>
            <div class="accent-divider"></div>
            <div class="memorial-image-container">
                <img src="assets/badges/memorial.jpg" alt="On Campus Memorial Design Concept" class="memorial-image" />
            </div>
            <div class="memorial-status-badge">Project On Hold — Volunteers Needed</div>
            <div class="memorial-context">
                <h3 class="memorial-section-heading">Background</h3>
                <p>In 2009, MI Theta brothers launched a combined campaign to establish the John Jurewicz II Burning Heart Scholarship and build an on-campus memorial honoring the fallen brothers of our chapter. The memorial effort ultimately raised $25,000, closing out its fundraising in 2017.</p>
                <h3 class="memorial-section-heading">What Happened</h3>
                <p>In 2019, a design concept was developed and site approvals were secured from Lawrence Tech as we planned to have the site completed before our chapter's 50th anniversary celebration in 2021. Unfortunately, in 2020 construction costs increased significantly and much uncertainty for campus arose, and the project was put on hold.</p>
                <h3 class="memorial-section-heading">Where We Are Now</h3>
                <p>The funds are still earmarked and the vision remains intact, but we need help from brothers who can volunteer their time, expertise, or connections to work with Lawrence Tech and get this project back on track. Whether you have experience in construction, project management, university relations, or simply want to lend a hand — we want to hear from you.</p>
            </div>
            <div class="memorial-cta">
                <p class="memorial-cta-text">Interested in helping bring this memorial to life?</p>
                <a href="${mailtoLink}" class="memorial-volunteer-btn">I Am Interested</a>
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
