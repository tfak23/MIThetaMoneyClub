// ===========================
// Google Sheets API Integration
// ===========================

const CACHE_KEY = 'mitheta_moneyclub_cache';

// Build a Google Sheets API URL for a given spreadsheet, sheet and range
function sheetsUrl(spreadsheetId, sheetName, range) {
    const fullRange = `${sheetName}!${range}`;
    return `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(fullRange)}?key=${CONFIG.API_KEY}`;
}

// Batch-get multiple ranges in one call
function sheetsBatchUrl(spreadsheetId, ranges) {
    const params = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
    return `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${params}&key=${CONFIG.API_KEY}`;
}

// ===========================
// Member Data
// ===========================

async function getMemberData() {
    if (!CONFIG.API_KEY || CONFIG.API_KEY === 'YOUR_API_KEY_HERE') {
        throw new Error('API_KEY_NOT_CONFIGURED');
    }

    // Check cache first
    const cached = loadCache();
    if (cached && !cached.expired) {
        return { members: cached.members, stale: false, cacheDate: cached.cacheDate };
    }

    try {
        const members = await fetchMembersFromSheet();
        saveCache(members);
        return { members, stale: false, cacheDate: new Date().toISOString() };
    } catch (err) {
        // If we have stale cache, use it
        if (cached && cached.members) {
            return { members: cached.members, stale: true, cacheDate: cached.cacheDate };
        }
        if (err.message && err.message.includes('403')) {
            throw new Error('SHEET_NOT_SHARED');
        }
        throw err;
    }
}

async function fetchMembersFromSheet() {
    const { SPREADSHEET_ID, SHEET_NAME, COLUMNS } = CONFIG;

    const currentYearCol = getCurrentYearDonorColumn();
    const previousYearCol = getPreviousYearDonorColumn();

    // Fetch all needed columns in one batch request
    const ranges = [
        `${SHEET_NAME}!${COLUMNS.DESIGNATION}2:${COLUMNS.DESIGNATION}`,
        `${SHEET_NAME}!${COLUMNS.ROLL_NUMBER}2:${COLUMNS.ROLL_NUMBER}`,
        `${SHEET_NAME}!${COLUMNS.FIRST_NAME}2:${COLUMNS.FIRST_NAME}`,
        `${SHEET_NAME}!${COLUMNS.LAST_NAME}2:${COLUMNS.LAST_NAME}`,
        `${SHEET_NAME}!${COLUMNS.TOTAL_DONATIONS}2:${COLUMNS.TOTAL_DONATIONS}`,
        `${SHEET_NAME}!${currentYearCol}2:${currentYearCol}`,
        `${SHEET_NAME}!${previousYearCol}2:${previousYearCol}`,
        `${SHEET_NAME}!${COLUMNS.DECADE}2:${COLUMNS.DECADE}`
    ];

    const url = sheetsBatchUrl(SPREADSHEET_ID, ranges);
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const valueRanges = data.valueRanges || [];

    const designations = valueRanges[0]?.values || [];
    const rollNumbers = valueRanges[1]?.values || [];
    const firstNames = valueRanges[2]?.values || [];
    const lastNames = valueRanges[3]?.values || [];
    const totalDonations = valueRanges[4]?.values || [];
    const currentYearDonations = valueRanges[5]?.values || [];
    const previousYearDonations = valueRanges[6]?.values || [];
    const decades = valueRanges[7]?.values || [];

    const maxRows = Math.max(
        designations.length,
        rollNumbers.length,
        firstNames.length,
        lastNames.length,
        totalDonations.length
    );

    const members = [];

    for (let i = 0; i < maxRows; i++) {
        let firstName = String(firstNames[i]?.[0] || '').trim();
        let lastName = String(lastNames[i]?.[0] || '').trim();

        if (!firstName && !lastName) continue;

        // Detect ** suffix on either name as deceased marker and strip it
        let deceasedByMarker = false;
        if (firstName.endsWith('**')) {
            firstName = firstName.slice(0, -2).trim();
            deceasedByMarker = true;
        }
        if (lastName.endsWith('**')) {
            lastName = lastName.slice(0, -2).trim();
            deceasedByMarker = true;
        }

        const roll = String(rollNumbers[i]?.[0] || '').trim();
        const rollShort = roll.replace(/^214-0*/i, '').replace(/-/g, '');
        const designation = String(designations[i]?.[0] || '').trim().toLowerCase();
        const donation = parseFloat(String(totalDonations[i]?.[0] || '0').replace(/[$,]/g, '')) || 0;
        const currentYearAmt = parseFloat(String(currentYearDonations[i]?.[0] || '0').replace(/[$,]/g, '')) || 0;
        const previousYearAmt = parseFloat(String(previousYearDonations[i]?.[0] || '0').replace(/[$,]/g, '')) || 0;
        const decade = String(decades[i]?.[0] || '').trim();

        members.push({
            firstName,
            lastName,
            fullName: `${firstName} ${lastName}`,
            roll,
            rollShort,
            totalDonations: donation,
            isDeceased: deceasedByMarker || designation === 'deceased' || designation === 'd',
            isCurrentYearDonor: currentYearAmt > 0,
            isPreviousYearDonor: previousYearAmt > 0,
            decade
        });
    }

    return members;
}

// ===========================
// Cache Management
// ===========================

function loadCache() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;

        const cache = JSON.parse(raw);

        // Check version
        if (cache.version !== CONFIG.CACHE_VERSION) return null;

        const age = Date.now() - new Date(cache.cacheDate).getTime();
        const ttl = CONFIG.CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
        const expired = age > ttl;

        return { members: cache.members, cacheDate: cache.cacheDate, expired };
    } catch {
        return null;
    }
}

function saveCache(members) {
    try {
        const cache = {
            version: CONFIG.CACHE_VERSION,
            cacheDate: new Date().toISOString(),
            members
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
        // Storage full or unavailable — silently ignore
    }
}

// ===========================
// Fund Progress
// ===========================

async function fetchFundProgress() {
    const { SPREADSHEET_ID, SUMMARY } = CONFIG;

    const ranges = [
        `${SUMMARY.SHEET_NAME}!${SUMMARY.AS_OF_DATE}`,
        `${SUMMARY.SHEET_NAME}!${SUMMARY.LEADERSHIP_TOTAL}`,
        `${SUMMARY.SHEET_NAME}!${SUMMARY.LEADERSHIP_GOAL}`,
        `${SUMMARY.SHEET_NAME}!${SUMMARY.BMS_TOTAL}`,
        `${SUMMARY.SHEET_NAME}!${SUMMARY.BMS_GOAL}`
    ];

    const url = sheetsBatchUrl(SPREADSHEET_ID, ranges);
    const response = await fetch(url);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const vr = data.valueRanges || [];

    const asOfDate = String(vr[0]?.values?.[0]?.[0] || '').trim();
    const leadershipTotal = parseFloat(String(vr[1]?.values?.[0]?.[0] || '0').replace(/[$,]/g, '')) || 0;
    const leadershipGoal = parseFloat(String(vr[2]?.values?.[0]?.[0] || '0').replace(/[$,]/g, '')) || 0;
    const bmsTotal = parseFloat(String(vr[3]?.values?.[0]?.[0] || '0').replace(/[$,]/g, '')) || 0;
    const bmsGoal = parseFloat(String(vr[4]?.values?.[0]?.[0] || '0').replace(/[$,]/g, '')) || 0;

    return {
        asOfDate,
        leadership: { total: leadershipTotal, goal: leadershipGoal },
        bms: { total: bmsTotal, goal: bmsGoal }
    };
}

// ===========================
// Scholarship Data
// ===========================

async function fetchScholarshipData() {
    const { SCHOLARSHIPS } = CONFIG;
    const spreadsheetId = SCHOLARSHIPS.SPREADSHEET_ID;
    const sheet = SCHOLARSHIPS.SHEET_NAME;

    const ranges = [
        `${sheet}!${SCHOLARSHIPS.JUREWICZ.PURPOSE}`,
        `${sheet}!${SCHOLARSHIPS.JUREWICZ.NAMES}`,
        `${sheet}!${SCHOLARSHIPS.JUREWICZ.YEARS}`,
        `${sheet}!${SCHOLARSHIPS.TAGGART.PURPOSE}`,
        `${sheet}!${SCHOLARSHIPS.TAGGART.NAMES}`,
        `${sheet}!${SCHOLARSHIPS.TAGGART.YEARS}`
    ];

    const url = sheetsBatchUrl(spreadsheetId, ranges);
    const response = await fetch(url);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const vr = data.valueRanges || [];

    function parseRecipients(namesRange, yearsRange) {
        const names = namesRange?.values || [];
        const years = yearsRange?.values || [];
        const recipients = [];

        const maxLen = Math.max(names.length, years.length);
        for (let i = 0; i < maxLen; i++) {
            const name = String(names[i]?.[0] || '').trim();
            const year = String(years[i]?.[0] || '').trim();
            if (name) {
                recipients.push({ name, year });
            }
        }
        return recipients;
    }

    return {
        jurewicz: {
            purpose: String(vr[0]?.values?.[0]?.[0] || '').trim(),
            recipients: parseRecipients(vr[1], vr[2])
        },
        taggart: {
            purpose: String(vr[3]?.values?.[0]?.[0] || '').trim(),
            recipients: parseRecipients(vr[4], vr[5])
        }
    };
}

// ===========================
// Decade Data
// ===========================

async function fetchDecadeData() {
    const { SPREADSHEET_ID, SUMMARY } = CONFIG;

    const ranges = [
        `${SUMMARY.SHEET_NAME}!${SUMMARY.DECADE_LABELS}`,
        `${SUMMARY.SHEET_NAME}!${SUMMARY.DECADE_TOTALS}`,
        `${SUMMARY.SHEET_NAME}!${SUMMARY.DECADE_DONORS}`
    ];

    const url = sheetsBatchUrl(SPREADSHEET_ID, ranges);
    const response = await fetch(url);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const vr = data.valueRanges || [];

    const labels = vr[0]?.values || [];
    const totals = vr[1]?.values || [];
    const donors = vr[2]?.values || [];

    const decades = [];
    const maxLen = Math.max(labels.length, totals.length);

    for (let i = 0; i < maxLen; i++) {
        const label = String(labels[i]?.[0] || '').trim();
        const total = parseFloat(String(totals[i]?.[0] || '0').replace(/[$,]/g, '')) || 0;
        const donorCount = parseInt(String(donors[i]?.[0] || '0').replace(/,/g, ''), 10) || 0;
        if (label) {
            decades.push({ label, total, donors: donorCount });
        }
    }

    return decades;
}