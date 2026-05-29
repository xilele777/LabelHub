const crypto = require('crypto');
const db = require('../store/db');

const MAX_PAGE_LIMIT = Number(process.env.MAX_PAGE_LIMIT || 200);
const CONTROL_QUERY_KEYS = new Set(['_page', '_limit', '_sort', '_order']);

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function isSafeFieldName(field) {
  return typeof field === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(field);
}

function buildFilter(query) {
  const filter = {};
  for (const [key, rawValue] of Object.entries(query)) {
    if (CONTROL_QUERY_KEYS.has(key)) continue;
    if (!isSafeFieldName(key)) {
      return { error: `Unsupported filter field: ${key}` };
    }

    const value = firstQueryValue(rawValue);
    if (value !== undefined) {
      filter[key] = value;
    }
  }
  return { filter };
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(firstQueryValue(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createCrudRouter(collection, opts = {}) {
  const router = require('express').Router();

  router.get('/', (req, res) => {
    const { filter, error } = buildFilter(req.query);
    if (error) {
      return res.fail(error);
    }

    const page = parsePositiveInt(req.query._page, 1);
    const requestedLimit = parsePositiveInt(req.query._limit, 0);
    const limit = requestedLimit > 0 ? Math.min(requestedLimit, MAX_PAGE_LIMIT) : 0;
    const sortField = firstQueryValue(req.query._sort);
    const sortOrder = firstQueryValue(req.query._order);

    let items;
    let total;
    if (opts.filterList) {
      items = db.getAll(collection);
      items = opts.filterList(items, req);

      if (sortField) {
        if (!isSafeFieldName(sortField)) {
          return res.fail(`Unsupported sort field: ${sortField}`);
        }

        const order = sortOrder === 'desc' ? -1 : 1;
        items = [...items].sort((a, b) => {
          if (a[sortField] < b[sortField]) return -1 * order;
          if (a[sortField] > b[sortField]) return 1 * order;
          return 0;
        });
      }

      total = items.length;
      if (limit > 0) {
        const start = (page - 1) * limit;
        items = items.slice(start, start + limit);
      }
    } else {
      try {
        const result = db.list(collection, {
          filter,
          sort: sortField,
          order: sortOrder,
          page,
          limit,
        });
        items = result.items;
        total = result.total;
      } catch (err) {
        return res.fail(err.message || 'Invalid list query');
      }
    }

    if (opts.afterRead) {
      items = items.map((item) => opts.afterRead(item, req));
    }

    res.success({ items, total, page, limit: limit || total });
  });

  router.get('/:id', (req, res) => {
    const item = db.getById(collection, req.params.id);
    if (!item) {
      return res.notFound(`${collection} not found`);
    }
    const result = opts.afterRead ? opts.afterRead(item, req) : item;
    res.success(result);
  });

  router.post('/', (req, res) => {
    let item = { ...req.body };

    if (!item.id) {
      item.id = `${collection[0]}${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;
    }

    if (!item.createdAt) {
      item.createdAt = new Date().toISOString();
    }

    if (opts.beforeCreate) {
      item = opts.beforeCreate(item, req);
      if (typeof item === 'string') {
        return res.fail(item, 403);
      }
      if (!item) {
        return res.fail('Create failed: validation did not pass');
      }
    }

    try {
      var created = db.insert(collection, item);
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
        return res.fail('Create failed: id conflict, please retry');
      }
      return res.fail(`Create failed: ${err.message || 'database error'}`);
    }

    const result = opts.afterRead ? opts.afterRead(created, req) : created;
    res.success(result, 'Created', 201);
  });

  router.put('/:id', (req, res) => {
    const existing = db.getById(collection, req.params.id);
    if (!existing) {
      return res.notFound(`${collection} not found`);
    }

    const updates = { ...req.body };
    delete updates.id;

    if (opts.beforeUpdate) {
      const validated = opts.beforeUpdate(existing, updates, req);
      if (typeof validated === 'string') {
        return res.fail(validated);
      }
      if (validated && typeof validated === 'object') {
        Object.assign(updates, validated);
      }
    }

    const updated = db.updateById(collection, req.params.id, updates);
    const result = opts.afterRead ? opts.afterRead(updated, req) : updated;
    res.success(result, 'Updated');
  });

  router.delete('/:id', (req, res) => {
    const existing = db.getById(collection, req.params.id);
    if (!existing) {
      return res.notFound(`${collection} not found`);
    }

    if (opts.beforeDelete) {
      const denied = opts.beforeDelete(existing, req);
      if (typeof denied === 'string') {
        return res.fail(denied, 403);
      }
    }

    db.deleteById(collection, req.params.id);
    res.success(null, 'Deleted');
  });

  return router;
}

module.exports = createCrudRouter;
