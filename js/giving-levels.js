const GIVING_LEVELS = [
    { name: "The Chairman's Senate", min: 50000, max: Infinity, badge: 'chairmans-senate.jpg', cssClass: 'level-chairmans' },
    { name: "The Passion Pact",      min: 25000, max: 49999,    badge: 'passion-pact.jpg',     cssClass: 'level-passion' },
    { name: "Founders Club",         min: 10000, max: 24999,    badge: 'founders-club.jpg',    cssClass: 'level-founders' },
    { name: "The 1971 Society",      min: 2500,  max: 9999,     badge: 'the-1971-society.jpg', cssClass: 'level-1971' },
    { name: "Ducal Crown Club",      min: 1000,  max: 2499,     badge: 'ducal-crown-club.jpg', cssClass: 'level-ducal' },
    { name: "TIPO's Trust",          min: 500,   max: 999,      badge: 'tipos-trust.jpg',      cssClass: 'level-tipos' },
    { name: "SigEp Sam Club",        min: 200,   max: 499,      badge: 'sigep-sam-club.jpg',   cssClass: 'level-sigep-sam' },
    { name: "Alpha/Beta Club",       min: 100,   max: 199,      badge: 'alpha-beta-club.jpg',  cssClass: 'level-alpha-beta' },
    { name: "Red Door Club",         min: 50,    max: 99,       badge: 'red-door-club.jpg',    cssClass: 'level-red-door' },
    { name: "The Sigma Circle",      min: 1,     max: 49,       badge: 'sigma-circle.jpg',     cssClass: 'level-sigma' },
];

function getGivingLevel(amount) {
    if (!amount || amount <= 0) return null;
    return GIVING_LEVELS.find(level => amount >= level.min) || null;
}

function getNextLevel(amount) {
    if (!amount || amount <= 0) return GIVING_LEVELS[GIVING_LEVELS.length - 1];
    for (let i = GIVING_LEVELS.length - 1; i >= 0; i--) {
        if (amount < GIVING_LEVELS[i].min) {
            return GIVING_LEVELS[i];
        }
    }
    return null; // Already at highest level
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}
