let fuse = null;

function initializeSearch(members) {
    fuse = new Fuse(members, {
        keys: [
            { name: 'firstName', weight: 0.4 },
            { name: 'lastName', weight: 0.4 },
            { name: 'fullName', weight: 0.3 },
            { name: 'rollShort', weight: 0.3 },
            { name: 'roll', weight: 0.2 }
        ],
        threshold: 0.4,
        distance: 100,
        includeScore: true,
        minMatchCharLength: 2,
        shouldSort: true
    });
}

function performSearch(query) {
    if (!fuse || !query || query.trim().length < 2) return [];

    const trimmed = query.trim();
    const isNumericQuery = /^[\d\-]+$/.test(trimmed);

    if (isNumericQuery) {
        // For numeric queries, do a direct prefix search on roll numbers
        const normalized = trimmed.replace(/^214-0*/i, '').replace(/-/g, '');
        const rollFuse = new Fuse(fuse._docs, {
            keys: ['rollShort', 'roll'],
            threshold: 0.2,
            distance: 50,
            includeScore: true,
            minMatchCharLength: 1
        });
        return rollFuse.search(normalized).slice(0, 10);
    }

    return fuse.search(trimmed).slice(0, 10);
}

function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}
