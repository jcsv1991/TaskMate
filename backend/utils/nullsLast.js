/**
 * MongoDB sorts missing/null values *first* in ascending order, which would put
 * every task without a due date above the one due tomorrow. This runs the query
 * as "dated documents first, then undated" while keeping skip/limit pagination
 * correct across the two groups.
 */
async function findNullsLast(Model, filter, { field, order = 'asc', skip, limit, populate, tiebreak = { _id: 1 } }) {
  const direction = order === 'desc' ? -1 : 1;
  const build = (f) => {
    let q = Model.find(f);
    if (populate) q = q.populate(populate);
    return q;
  };

  // Descending already puts nulls last.
  if (direction === -1) {
    const [items, total] = await Promise.all([
      build(filter).sort({ [field]: -1, ...tiebreak }).skip(skip).limit(limit).lean(),
      Model.countDocuments(filter),
    ]);
    return { items, total };
  }

  const dated = { ...filter, [field]: { ...(filter[field] || {}), $ne: null } };
  const undated = { ...filter, [field]: null };
  // When the caller already filters by a date range, undated documents cannot match it.
  const rangeFiltered = Boolean(filter[field]);
  const [datedCount, undatedCount] = await Promise.all([
    Model.countDocuments(dated),
    rangeFiltered ? 0 : Model.countDocuments(undated),
  ]);

  let items = [];
  if (skip < datedCount) {
    items = await build(dated).sort({ [field]: 1, ...tiebreak }).skip(skip).limit(limit).lean();
  }
  if (items.length < limit && undatedCount > 0) {
    const undatedSkip = Math.max(0, skip - datedCount);
    const rest = await build(undated)
      .sort(tiebreak)
      .skip(undatedSkip)
      .limit(limit - items.length)
      .lean();
    items = items.concat(rest);
  }
  return { items, total: datedCount + undatedCount };
}

module.exports = findNullsLast;
