const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const MAX_PAGE = 100000;

const toPositiveInt = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
};

/**
 * Reads ?page and ?limit and returns safe numbers for a database query.
 * Missing, non-numeric, zero or negative values fall back to the defaults,
 * and limit can never exceed maxLimit, so one request cannot pull a whole collection.
 */
const parsePagination = (query = {}, { defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT } = {}) => {
    const page = Math.min(toPositiveInt(query.page, 1), MAX_PAGE);
    const limit = Math.min(toPositiveInt(query.limit, defaultLimit), maxLimit);

    return { page, limit, skip: (page - 1) * limit };
};

// Makes user text safe to put inside new RegExp(...) so it is matched literally
const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

module.exports = {
    parsePagination,
    escapeRegex,
    DEFAULT_LIMIT,
    MAX_LIMIT,
    MAX_PAGE
};
