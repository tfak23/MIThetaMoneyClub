const CACHE_KEY = 'moneyclub_data';
const CACHE_TS_KEY = 'moneyclub_cache_timestamp';

function getCacheTTL() {
    return CONFIG.CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
}

function buildApiUrl() {
    const cols = CONFIG.COLUMNS;
    const sheet = CONFIG.SHEET_NAME;
    const ranges = [
        `${sheet}!${cols.ROLL_NUMBER}:${cols.ROLL_NUMBER}`,
        `${sheet}!${cols.FIRST_NAME}:${cols.FIRST_NAME}`,
        `${sheet}!${cols.LAST_NAME}:${cols.LAST_NAME}`,
        `${sheet}!${cols.TOTAL_DONATIONS}:${cols.TOTAL_DONATIONS}`
    ];
    const rangeParams = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
    return `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values:batchGet?${rangeParams}&valueRenderOption=UNFORMATTED_VALUE&key=${CONFIG.API_KEY}`;
}

function parseSheetResponse(data) {
    if (!data.valueRanges || data.valueRanges.length < 4) {
        throw new Error('Unexpected API response format');
    }

    const [rollData, firstNameData, lastNameData, donationData] = data.valueRanges.map(
        vr => vr.values || []
    );

    const members = [];
    const maxRows = Math.max(rollData.length, firstNameData.length, lastNameData.length, donationData.length);

    // Start at index 1 to skip header row
    for (let i = 1; i < maxRows; i++) {
        const rollRaw = String(rollData[i]?.[0] || '').trim();
        const firstName = String(firstNameData[i]?.[0] || '').trim();
        const lastName = String(lastNameData[i]?.[0] || '').trim();
        const donationRaw = donationData[i]?.[0];
        const donation = typeof donationRaw === 'number' ? donationRaw : parseFloat(donationRaw) || 0;

        if (!firstName && !lastName) continue;

        members.push({
            roll: rollRaw,
            rollShort: rollRaw.replace(/^214-0*/i, ''),
            firstName: firstName,
            lastName: lastName,
            fullName: `${firstName} ${lastName}`.trim(),
            totalDonations: donation
        });
    }

    return members;
}

async function fetchFromSheetsAPI() {
    if (!CONFIG.API_KEY || CONFIG.API_KEY === 'YOUR_API_KEY_HERE') {
        throw new Error('API_KEY_NOT_CONFIGURED');
    }

    const url = buildApiUrl();
    const response = await fetch(url);

    if (!response.ok) {
        if (response.status === 403) {
            throw new Error('SHEET_NOT_SHARED');
        }
        throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    return parseSheetResponse(data);
}

const FUND_CACHE_KEY = 'moneyclub_fund_data';
const FUND_CACHE_TS_KEY = 'moneyclub_fund_cache_timestamp';

async function fetchFundProgress() {
    // Check cache first
    const cachedData = localStorage.getItem(FUND_CACHE_KEY);
    const cachedTimestamp = localStorage.getItem(FUND_CACHE_TS_KEY);

    if (cachedData && cachedTimestamp) {
        const age = Date.now() - new Date(cachedTimestamp).getTime();
        if (age < getCacheTTL()) {
            return JSON.parse(cachedData);
        }
    }

    if (!CONFIG.API_KEY || CONFIG.API_KEY === 'YOUR_API_KEY_HERE') {
        throw new Error('API_KEY_NOT_CONFIGURED');
    }

    const s = CONFIG.SUMMARY;
    const ranges = [
        `${s.SHEET_NAME}!${s.AS_OF_DATE}`,
        `${s.SHEET_NAME}!${s.LEADERSHIP_TOTAL}`,
        `${s.SHEET_NAME}!${s.LEADERSHIP_GOAL}`,
        `${s.SHEET_NAME}!${s.BMS_TOTAL}`,
        `${s.SHEET_NAME}!${s.BMS_GOAL}`
    ];
    const rangeParams = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values:batchGet?${rangeParams}&valueRenderOption=FORMATTED_VALUE&key=${CONFIG.API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Fund data fetch failed: ${response.status}`);

    const data = await response.json();
    const vals = data.valueRanges.map(vr => (vr.values && vr.values[0] && vr.values[0][0]) || '');

    const parseNum = (v) => {
        if (typeof v === 'number') return v;
        return parseFloat(String(v).replace(/[$,]/g, '')) || 0;
    };

    const fundData = {
        asOfDate: vals[0],
        leadership: { total: parseNum(vals[1]), goal: parseNum(vals[2]) },
        bms: { total: parseNum(vals[3]), goal: parseNum(vals[4]) }
    };

    const now = new Date().toISOString();
    localStorage.setItem(FUND_CACHE_KEY, JSON.stringify(fundData));
    localStorage.setItem(FUND_CACHE_TS_KEY, now);

    return fundData;
}

async function getMemberData() {
    const cachedData = localStorage.getItem(CACHE_KEY);
    const cachedTimestamp = localStorage.getItem(CACHE_TS_KEY);

    // Use cache if fresh
    if (cachedData && cachedTimestamp) {
        const age = Date.now() - new Date(cachedTimestamp).getTime();
        if (age < getCacheTTL()) {
            return { members: JSON.parse(cachedData), fromCache: true, cacheDate: cachedTimestamp };
        }
    }

    // Fetch fresh data
    try {
        const members = await fetchFromSheetsAPI();
        const now = new Date().toISOString();
        localStorage.setItem(CACHE_KEY, JSON.stringify(members));
        localStorage.setItem(CACHE_TS_KEY, now);
        return { members, fromCache: false, cacheDate: now };
    } catch (error) {
        // Fall back to stale cache if available
        if (cachedData) {
            return { members: JSON.parse(cachedData), fromCache: true, stale: true, cacheDate: cachedTimestamp };
        }
        throw error;
    }
}
