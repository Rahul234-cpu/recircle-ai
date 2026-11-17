function getPagination(query, { defaultLimit = 12, maxLimit = 100 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

function paginated(items, total, { page, limit }) {
  return {
    items,
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

module.exports = { getPagination, paginated };
