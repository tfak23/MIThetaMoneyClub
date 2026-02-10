const CONFIG = {
    SPREADSHEET_ID: '1COGTThZLcbrNPafAuqjLTgNus_DN3rzJN8F3QPhg_dg',
    SHEET_NAME: 'Master',
    API_KEY: 'AIzaSyBzYC2v7ohVusXLKIxa3kKf-pJ0eLTDx3M', // Replace with your Google Sheets API key
    COLUMNS: {
        ROLL_NUMBER: 'D',
        FIRST_NAME: 'E',
        LAST_NAME: 'F',
        TOTAL_DONATIONS: 'EV', // Update this if the column moves
        CURRENT_YEAR_DONOR: 'CW'
    },
    CACHE_TTL_DAYS: 7,
    SUMMARY: {
        SHEET_NAME: 'Summary',
        AS_OF_DATE: 'J2',
        LEADERSHIP_TOTAL: 'J4',
        LEADERSHIP_GOAL: 'K4',
        BMS_TOTAL: 'J5',
        BMS_GOAL: 'K5'
    }
};
