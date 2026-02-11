const CONFIG = {
    SPREADSHEET_ID: '1COGTThZLcbrNPafAuqjLTgNus_DN3rzJN8F3QPhg_dg',
    SHEET_NAME: 'Master',
    API_KEY: 'AIzaSyBzYC2v7ohVusXLKIxa3kKf-pJ0eLTDx3M', // Replace with your Google Sheets API key
    COLUMNS: {
        DESIGNATION: 'C',
        ROLL_NUMBER: 'D',
        FIRST_NAME: 'E',
        LAST_NAME: 'F',
        TOTAL_DONATIONS: 'EV' // Update this if the column moves
    },
    // Dynamic year-based donor column: 2026=CW (col 101), each year +6 columns
    YEAR_DONOR_BASE_YEAR: 2026,
    YEAR_DONOR_BASE_COL: 101, // CW = column 101
    YEAR_DONOR_COL_STEP: 6,
    CACHE_TTL_DAYS: 7,
    CACHE_VERSION: 4, // Increment to force cache refresh when data structure changes
    SUMMARY: {
        SHEET_NAME: 'Summary',
        AS_OF_DATE: 'J2',
        LEADERSHIP_TOTAL: 'J4',
        LEADERSHIP_GOAL: 'K4',
        BMS_TOTAL: 'J5',
        BMS_GOAL: 'K5'
    },
    SCHOLARSHIPS: {
        SPREADSHEET_ID: '1VxjgaGdfaXiYrRh21u2SaKgHMkrrgaehFLUH_ZEqGxE',
        SHEET_NAME: 'Merit Scholarships',
        JUREWICZ: {
            PURPOSE: 'A4',
            RECIPIENTS: 'A7:A33'
        },
        TAGGART: {
            PURPOSE: 'A36',
            RECIPIENTS: 'A38:A58'
        }
    }
};

// Convert a column number (1-based) to spreadsheet letter (e.g. 101 -> "CW")
function columnNumberToLetter(n) {
    let result = '';
    while (n > 0) {
        n--;
        result = String.fromCharCode(65 + (n % 26)) + result;
        n = Math.floor(n / 26);
    }
    return result;
}

// Get the column letter for a given year's donor data
function getYearDonorColumn(year) {
    const yearOffset = year - CONFIG.YEAR_DONOR_BASE_YEAR;
    const colNumber = CONFIG.YEAR_DONOR_BASE_COL + (yearOffset * CONFIG.YEAR_DONOR_COL_STEP);
    return columnNumberToLetter(colNumber);
}

// Get the column letter for the current year's donor data
function getCurrentYearDonorColumn() {
    return getYearDonorColumn(new Date().getFullYear());
}

// Get the column letter for the previous year's donor data
function getPreviousYearDonorColumn() {
    return getYearDonorColumn(new Date().getFullYear() - 1);
}
