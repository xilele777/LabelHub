const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'labelhub.db');

// ─── Initialize SQLite database ────────────────────────────
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

// ─── Migration: add columns for older databases ─────────────
const migrations = [
  { table: 'annotation_items', column: 'version',   type: 'INTEGER NOT NULL DEFAULT 1' },
  { table: 'annotation_items', column: 'lockedBy',  type: 'TEXT' },
  { table: 'annotation_items', column: 'lockedAt',  type: 'TEXT' },
  { table: 'tasks', column: 'assignmentConfig', type: "TEXT DEFAULT '{}'" },
  { table: 'tasks', column: 'archived', type: "INTEGER NOT NULL DEFAULT 0" },
  { table: 'tasks', column: 'archivedAt', type: "TEXT" },
  { table: 'tasks', column: 'startsAt', type: "TEXT" },
  { table: 'tasks', column: 'dueAt', type: "TEXT" },
  { table: 'tasks', column: 'reminderHours', type: "INTEGER NOT NULL DEFAULT 24" },
  { table: 'tasks', column: 'overdueStrategy', type: "TEXT NOT NULL DEFAULT 'remind_only'" },
  { table: 'tasks', column: 'reviewStartsAt', type: "TEXT" },
  { table: 'tasks', column: 'reviewDueAt', type: "TEXT" },
  { table: 'tasks', column: 'reviewReminderHours', type: "INTEGER NOT NULL DEFAULT 24" },
  { table: 'tasks', column: 'reviewOverdueStrategy', type: "TEXT NOT NULL DEFAULT 'remind_only'" },
  { table: 'tasks', column: 'annotationDueSoonNotifiedAt', type: "TEXT" },
  { table: 'tasks', column: 'reviewDueSoonNotifiedAt', type: "TEXT" },
  { table: 'tasks', column: 'annotationTimeoutHours', type: "INTEGER NOT NULL DEFAULT 24" },
  { table: 'tasks', column: 'reviewTimeoutHours', type: "INTEGER NOT NULL DEFAULT 24" },
  { table: 'tasks', column: 'taskEndedNotifiedAt', type: "TEXT" },
  { table: 'annotation_items', column: 'archived', type: "INTEGER NOT NULL DEFAULT 0" },
  { table: 'annotation_items', column: 'archivedAt', type: "TEXT" },
];

for (const mig of migrations) {
  try {
    // Check if column already exists
    const cols = db.pragma(`table_info(${mig.table})`);
    const exists = cols.some(c => c.name === mig.column);
    if (!exists) {
      db.exec(`ALTER TABLE ${mig.table} ADD COLUMN ${mig.column} ${mig.type}`);
      console.log(`[DB Migration] Added column ${mig.column} to ${mig.table}`);
    }
  } catch (err) {
    console.warn(`[DB Migration] Skipped ${mig.table}.${mig.column}: ${err.message}`);
  }
}

// ─── Create tables ─────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    username    TEXT NOT NULL UNIQUE,
    password    TEXT NOT NULL,
    avatar      TEXT,
    role        TEXT NOT NULL DEFAULT 'annotator',
    createdAt   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS templates (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    type        TEXT NOT NULL,
    fieldCount  INTEGER DEFAULT 0,
    creator     TEXT,
    createdAt   TEXT DEFAULT (datetime('now')),
    fields      TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    description   TEXT,
    type          TEXT NOT NULL,
    owner         TEXT,
    templateId    TEXT,
    templateName  TEXT,
    instructions  TEXT,
    status        TEXT NOT NULL DEFAULT 'draft',
    createdAt     TEXT DEFAULT (datetime('now')),
    assignmentConfig TEXT DEFAULT '{}',
    archived      INTEGER NOT NULL DEFAULT 0,
    archivedAt    TEXT,
    startsAt      TEXT,
    dueAt         TEXT,
    reminderHours INTEGER NOT NULL DEFAULT 24,
    overdueStrategy TEXT NOT NULL DEFAULT 'remind_only',
    reviewStartsAt TEXT,
    reviewDueAt   TEXT,
    reviewReminderHours INTEGER NOT NULL DEFAULT 24,
    reviewOverdueStrategy TEXT NOT NULL DEFAULT 'remind_only',
    annotationDueSoonNotifiedAt TEXT,
    reviewDueSoonNotifiedAt TEXT,
    annotationTimeoutHours INTEGER NOT NULL DEFAULT 24,
    reviewTimeoutHours INTEGER NOT NULL DEFAULT 24,
    taskEndedNotifiedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS annotation_items (
    id              TEXT PRIMARY KEY,
    taskId          TEXT NOT NULL,
    rawData         TEXT DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'pending',
    annotationData  TEXT,
    annotator       TEXT,
    submittedAt     TEXT,
    reviewer        TEXT,
    reviewedAt      TEXT,
    rejectReason    TEXT,
    auditHistory    TEXT DEFAULT '[]',
    createdAt       TEXT DEFAULT (datetime('now')),
    version         INTEGER NOT NULL DEFAULT 1,
    lockedBy        TEXT,
    lockedAt        TEXT,
    FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id            TEXT PRIMARY KEY,
    dataItemId    TEXT NOT NULL,
    taskId        TEXT NOT NULL,
    templateId    TEXT,
    reviewStatus  TEXT NOT NULL DEFAULT 'pending',
    score         INTEGER DEFAULT 0,
    summary       TEXT,
    matchedRules  TEXT DEFAULT '[]',
    fieldWarnings TEXT DEFAULT '[]',
    suggestions   TEXT DEFAULT '[]',
    reviewedAt    TEXT,
    modelVersion  TEXT,
    FOREIGN KEY (dataItemId) REFERENCES annotation_items(id) ON DELETE CASCADE,
    FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id                TEXT PRIMARY KEY,
    recipientUserId   TEXT,
    recipientUsername TEXT NOT NULL,
    type              TEXT NOT NULL,
    title             TEXT NOT NULL,
    message           TEXT NOT NULL,
    priority          TEXT NOT NULL DEFAULT 'low',
    data              TEXT DEFAULT '{}',
    sender            TEXT,
    targetUsers       TEXT DEFAULT '[]',
    timestamp         TEXT NOT NULL,
    read              INTEGER NOT NULL DEFAULT 0,
    readAt            TEXT,
    deleted           INTEGER NOT NULL DEFAULT 0,
    deletedAt         TEXT
  );

  -- Indexes for common queries
  CREATE INDEX IF NOT EXISTS idx_annotation_items_taskId ON annotation_items(taskId);
  CREATE INDEX IF NOT EXISTS idx_annotation_items_status ON annotation_items(status);
  CREATE INDEX IF NOT EXISTS idx_annotation_items_annotator ON annotation_items(annotator);
  CREATE INDEX IF NOT EXISTS idx_annotation_items_lockedBy ON annotation_items(lockedBy);
  CREATE INDEX IF NOT EXISTS idx_reviews_dataItemId ON reviews(dataItemId);
  CREATE INDEX IF NOT EXISTS idx_reviews_taskId ON reviews(taskId);
  CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipientUsername);
  CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON notifications(recipientUsername, read);
  CREATE INDEX IF NOT EXISTS idx_notifications_timestamp ON notifications(timestamp);
  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
`);

// ─── Prepared statements (for performance) ─────────────────
const stmts = {
  users: {
    getAll:    db.prepare('SELECT * FROM users'),
    getById:   db.prepare('SELECT * FROM users WHERE id = ?'),
    findByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
    insert:    db.prepare('INSERT INTO users (id, username, password, avatar, role, createdAt) VALUES (?, ?, ?, ?, ?, ?)'),
    update:    db.prepare('UPDATE users SET username = @username, password = @password, avatar = @avatar, role = @role WHERE id = @id'),
    delete:    db.prepare('DELETE FROM users WHERE id = ?'),
    count:     db.prepare('SELECT COUNT(*) AS total FROM users'),
  },
  templates: {
    getAll:    db.prepare('SELECT * FROM templates'),
    getById:   db.prepare('SELECT * FROM templates WHERE id = ?'),
    insert:    db.prepare('INSERT INTO templates (id, name, description, type, fieldCount, creator, createdAt, fields) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
    update:    db.prepare('UPDATE templates SET name = @name, description = @description, type = @type, fieldCount = @fieldCount, creator = @creator, fields = @fields WHERE id = @id'),
    delete:    db.prepare('DELETE FROM templates WHERE id = ?'),
    count:     db.prepare('SELECT COUNT(*) AS total FROM templates'),
  },
  tasks: {
    getAll:    db.prepare('SELECT * FROM tasks'),
    getById:   db.prepare('SELECT * FROM tasks WHERE id = ?'),
    insert:    db.prepare('INSERT INTO tasks (id, name, description, type, owner, templateId, templateName, instructions, status, createdAt, assignmentConfig, archived, archivedAt, startsAt, dueAt, reminderHours, overdueStrategy, reviewStartsAt, reviewDueAt, reviewReminderHours, reviewOverdueStrategy, annotationDueSoonNotifiedAt, reviewDueSoonNotifiedAt, annotationTimeoutHours, reviewTimeoutHours, taskEndedNotifiedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    update:    db.prepare('UPDATE tasks SET name = @name, description = @description, type = @type, owner = @owner, templateId = @templateId, templateName = @templateName, instructions = @instructions, status = @status, assignmentConfig = @assignmentConfig, archived = @archived, archivedAt = @archivedAt, startsAt = @startsAt, dueAt = @dueAt, reminderHours = @reminderHours, overdueStrategy = @overdueStrategy, reviewStartsAt = @reviewStartsAt, reviewDueAt = @reviewDueAt, reviewReminderHours = @reviewReminderHours, reviewOverdueStrategy = @reviewOverdueStrategy, annotationDueSoonNotifiedAt = @annotationDueSoonNotifiedAt, reviewDueSoonNotifiedAt = @reviewDueSoonNotifiedAt, annotationTimeoutHours = @annotationTimeoutHours, reviewTimeoutHours = @reviewTimeoutHours, taskEndedNotifiedAt = @taskEndedNotifiedAt WHERE id = @id'),
    delete:    db.prepare('DELETE FROM tasks WHERE id = ?'),
    count:     db.prepare('SELECT COUNT(*) AS total FROM tasks'),
  },
  annotation_items: {
    getAll:    db.prepare('SELECT * FROM annotation_items'),
    getById:   db.prepare('SELECT * FROM annotation_items WHERE id = ?'),
    findByTask: db.prepare('SELECT * FROM annotation_items WHERE taskId = ?'),
    findFiltered: db.prepare('SELECT * FROM annotation_items WHERE taskId = ? AND status = ?'),
    insert:    db.prepare('INSERT INTO annotation_items (id, taskId, rawData, status, annotationData, annotator, submittedAt, reviewer, reviewedAt, rejectReason, auditHistory, createdAt, version, lockedBy, lockedAt, archived, archivedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    update:    db.prepare(`UPDATE annotation_items SET taskId = @taskId, rawData = @rawData, status = @status, annotationData = @annotationData, annotator = @annotator, submittedAt = @submittedAt, reviewer = @reviewer, reviewedAt = @reviewedAt, rejectReason = @rejectReason, auditHistory = @auditHistory, version = @version, lockedBy = @lockedBy, lockedAt = @lockedAt, archived = @archived, archivedAt = @archivedAt WHERE id = @id`),
    patch:     db.prepare(`UPDATE annotation_items SET taskId = COALESCE(@taskId, taskId), rawData = COALESCE(@rawData, rawData), status = COALESCE(@status, status), annotationData = COALESCE(@annotationData, annotationData), annotator = COALESCE(@annotator, annotator), submittedAt = COALESCE(@submittedAt, submittedAt), reviewer = COALESCE(@reviewer, reviewer), reviewedAt = COALESCE(@reviewedAt, reviewedAt), rejectReason = COALESCE(@rejectReason, rejectReason), auditHistory = COALESCE(@auditHistory, auditHistory), version = COALESCE(@version, version), lockedBy = COALESCE(@lockedBy, lockedBy), lockedAt = COALESCE(@lockedAt, lockedAt), archived = COALESCE(@archived, archived), archivedAt = COALESCE(@archivedAt, archivedAt) WHERE id = @id`),
    delete:    db.prepare('DELETE FROM annotation_items WHERE id = ?'),
    count:     db.prepare('SELECT COUNT(*) AS total FROM annotation_items'),
    countByTask: db.prepare('SELECT COUNT(*) AS total FROM annotation_items WHERE taskId = ?'),
    countByStatus: db.prepare('SELECT COUNT(*) AS total FROM annotation_items WHERE status = ?'),
  },
  reviews: {
    getAll:    db.prepare('SELECT * FROM reviews'),
    getById:   db.prepare('SELECT * FROM reviews WHERE id = ?'),
    findByItem: db.prepare('SELECT * FROM reviews WHERE dataItemId = ?'),
    findByTask: db.prepare('SELECT * FROM reviews WHERE taskId = ?'),
    insert:    db.prepare('INSERT INTO reviews (id, dataItemId, taskId, templateId, reviewStatus, score, summary, matchedRules, fieldWarnings, suggestions, reviewedAt, modelVersion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    update:    db.prepare(`UPDATE reviews SET dataItemId = @dataItemId, taskId = @taskId, templateId = @templateId, reviewStatus = @reviewStatus, score = @score, summary = @summary, matchedRules = @matchedRules, fieldWarnings = @fieldWarnings, suggestions = @suggestions, reviewedAt = @reviewedAt, modelVersion = @modelVersion WHERE id = @id`),
    patch:     db.prepare(`UPDATE reviews SET dataItemId = COALESCE(@dataItemId, dataItemId), taskId = COALESCE(@taskId, taskId), templateId = COALESCE(@templateId, templateId), reviewStatus = COALESCE(@reviewStatus, reviewStatus), score = COALESCE(@score, score), summary = COALESCE(@summary, summary), matchedRules = COALESCE(@matchedRules, matchedRules), fieldWarnings = COALESCE(@fieldWarnings, fieldWarnings), suggestions = COALESCE(@suggestions, suggestions), reviewedAt = COALESCE(@reviewedAt, reviewedAt), modelVersion = COALESCE(@modelVersion, modelVersion) WHERE id = @id`),
    delete:    db.prepare('DELETE FROM reviews WHERE id = ?'),
    count:     db.prepare('SELECT COUNT(*) AS total FROM reviews'),
  },
  notifications: {
    insert: db.prepare(`INSERT INTO notifications (id, recipientUserId, recipientUsername, type, title, message, priority, data, sender, targetUsers, timestamp, read, readAt, deleted, deletedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    getForUser: db.prepare(`SELECT * FROM notifications WHERE recipientUsername = ? AND deleted = 0 ORDER BY timestamp DESC LIMIT ?`),
    getForUserByType: db.prepare(`SELECT * FROM notifications WHERE recipientUsername = ? AND type = ? AND deleted = 0 ORDER BY timestamp DESC LIMIT ?`),
    countForUser: db.prepare(`SELECT COUNT(*) AS total FROM notifications WHERE recipientUsername = ? AND deleted = 0`),
    countForUserByType: db.prepare(`SELECT COUNT(*) AS total FROM notifications WHERE recipientUsername = ? AND type = ? AND deleted = 0`),
    unreadCountForUser: db.prepare(`SELECT COUNT(*) AS total FROM notifications WHERE recipientUsername = ? AND deleted = 0 AND read = 0`),
    unreadCountForUserByType: db.prepare(`SELECT COUNT(*) AS total FROM notifications WHERE recipientUsername = ? AND type = ? AND deleted = 0 AND read = 0`),
    markRead: db.prepare(`UPDATE notifications SET read = 1, readAt = COALESCE(readAt, ?) WHERE id = ? AND recipientUsername = ? AND deleted = 0`),
    markAllRead: db.prepare(`UPDATE notifications SET read = 1, readAt = COALESCE(readAt, ?) WHERE recipientUsername = ? AND deleted = 0 AND read = 0`),
    markAllReadByType: db.prepare(`UPDATE notifications SET read = 1, readAt = COALESCE(readAt, ?) WHERE recipientUsername = ? AND type = ? AND deleted = 0 AND read = 0`),
    softDelete: db.prepare(`UPDATE notifications SET deleted = 1, deletedAt = ? WHERE id = ? AND recipientUsername = ?`),
    clearForUser: db.prepare(`UPDATE notifications SET deleted = 1, deletedAt = ? WHERE recipientUsername = ? AND deleted = 0`),
    clearForUserByType: db.prepare(`UPDATE notifications SET deleted = 1, deletedAt = ? WHERE recipientUsername = ? AND type = ? AND deleted = 0`),
    clearForUserExceptType: db.prepare(`UPDATE notifications SET deleted = 1, deletedAt = ? WHERE recipientUsername = ? AND type <> ? AND deleted = 0`),
    count: db.prepare('SELECT COUNT(*) AS total FROM notifications'),
  },
};

// ─── JSON parse helper ──────────────────────────────────────
function safeParse(jsonStr) {
  if (jsonStr === null || jsonStr === undefined) return null;
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

// ─── Row-to-object transformers ─────────────────────────────
// Convert SQLite row (with JSON text columns) to JS object
function transformUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    password: row.password,
    avatar: row.avatar,
    role: row.role,
    createdAt: row.createdAt,
  };
}

function transformTemplate(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    fieldCount: row.fieldCount,
    creator: row.creator,
    createdAt: row.createdAt,
    fields: safeParse(row.fields) || [],
  };
}

function transformTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    owner: row.owner,
    templateId: row.templateId,
    templateName: row.templateName,
    instructions: row.instructions,
    status: row.status,
    createdAt: row.createdAt,
    startsAt: row.startsAt || null,
    dueAt: row.dueAt || null,
    reminderHours: Number(row.reminderHours ?? 24),
    overdueStrategy: row.overdueStrategy || 'remind_only',
    reviewStartsAt: row.reviewStartsAt || null,
    reviewDueAt: row.reviewDueAt || null,
    reviewReminderHours: Number(row.reviewReminderHours ?? 24),
    reviewOverdueStrategy: row.reviewOverdueStrategy || 'remind_only',
    annotationDueSoonNotifiedAt: row.annotationDueSoonNotifiedAt || null,
    reviewDueSoonNotifiedAt: row.reviewDueSoonNotifiedAt || null,
    annotationTimeoutHours: Number(row.annotationTimeoutHours ?? row.reminderHours ?? 24),
    reviewTimeoutHours: Number(row.reviewTimeoutHours ?? row.reviewReminderHours ?? 24),
    taskEndedNotifiedAt: row.taskEndedNotifiedAt || null,
    assignmentConfig: safeParse(row.assignmentConfig) || {},
    archived: row.archived ? Boolean(row.archived) : false,
    archivedAt: row.archivedAt || null,
  };
}

function transformAnnotationItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    taskId: row.taskId,
    rawData: safeParse(row.rawData) || {},
    status: row.status,
    annotationData: safeParse(row.annotationData),
    annotator: row.annotator,
    submittedAt: row.submittedAt,
    reviewer: row.reviewer,
    reviewedAt: row.reviewedAt,
    rejectReason: row.rejectReason,
    auditHistory: safeParse(row.auditHistory) || [],
    createdAt: row.createdAt,
    version: row.version,
    lockedBy: row.lockedBy,
    lockedAt: row.lockedAt,
    archived: row.archived ? Boolean(row.archived) : false,
    archivedAt: row.archivedAt || null,
  };
}

function transformReview(row) {
  if (!row) return null;
  return {
    id: row.id,
    dataItemId: row.dataItemId,
    taskId: row.taskId,
    templateId: row.templateId,
    reviewStatus: row.reviewStatus,
    score: row.score,
    summary: row.summary,
    matchedRules: safeParse(row.matchedRules) || [],
    fieldWarnings: safeParse(row.fieldWarnings) || [],
    suggestions: safeParse(row.suggestions) || [],
    reviewedAt: row.reviewedAt,
    modelVersion: row.modelVersion,
  };
}

function transformNotification(row) {
  if (!row) return null;
  return {
    id: row.id,
    recipientUserId: row.recipientUserId,
    recipientUsername: row.recipientUsername,
    type: row.type,
    title: row.title,
    message: row.message,
    priority: row.priority,
    data: safeParse(row.data) || {},
    sender: row.sender,
    targetUsers: safeParse(row.targetUsers) || [],
    timestamp: row.timestamp,
    read: Boolean(row.read),
    readAt: row.readAt || null,
    deleted: Boolean(row.deleted),
    deletedAt: row.deletedAt || null,
  };
}

// ─── Collection config map ──────────────────────────────────
const COLLECTIONS = {
  'users': {
    stmts: stmts.users,
    transform: transformUser,
    insertFields: (item) => [item.id, item.username, item.password, item.avatar || null, item.role, item.createdAt || new Date().toISOString()],
    updateFields: (item) => ({ id: item.id, username: item.username, password: item.password, avatar: item.avatar, role: item.role }),
  },
  'templates': {
    stmts: stmts.templates,
    transform: transformTemplate,
    insertFields: (item) => [item.id, item.name, item.description || '', item.type, item.fieldCount || 0, item.creator || '', item.createdAt || new Date().toISOString(), JSON.stringify(item.fields || [])],
    updateFields: (item) => ({ id: item.id, name: item.name, description: item.description, type: item.type, fieldCount: item.fieldCount, creator: item.creator, fields: JSON.stringify(item.fields || []) }),
  },
  'tasks': {
    stmts: stmts.tasks,
    transform: transformTask,
    insertFields: (item) => [item.id, item.name, item.description || '', item.type, item.owner || '', item.templateId || null, item.templateName || null, item.instructions || '', item.status || 'draft', item.createdAt || new Date().toISOString(), JSON.stringify(item.assignmentConfig || {}), item.archived ? 1 : 0, item.archivedAt || null, item.startsAt || null, item.dueAt || null, Number(item.reminderHours ?? 24), item.overdueStrategy || 'remind_only', item.reviewStartsAt || null, item.reviewDueAt || null, Number(item.reviewReminderHours ?? 24), item.reviewOverdueStrategy || 'remind_only', item.annotationDueSoonNotifiedAt || null, item.reviewDueSoonNotifiedAt || null, Number(item.annotationTimeoutHours ?? item.reminderHours ?? 24), Number(item.reviewTimeoutHours ?? item.reviewReminderHours ?? 24), item.taskEndedNotifiedAt || null],
    updateFields: (item) => ({ id: item.id, name: item.name, description: item.description, type: item.type, owner: item.owner, templateId: item.templateId, templateName: item.templateName, instructions: item.instructions, status: item.status, assignmentConfig: JSON.stringify(item.assignmentConfig || {}), archived: item.archived ? 1 : 0, archivedAt: item.archivedAt || null, startsAt: item.startsAt || null, dueAt: item.dueAt || null, reminderHours: Number(item.reminderHours ?? 24), overdueStrategy: item.overdueStrategy || 'remind_only', reviewStartsAt: item.reviewStartsAt || null, reviewDueAt: item.reviewDueAt || null, reviewReminderHours: Number(item.reviewReminderHours ?? 24), reviewOverdueStrategy: item.reviewOverdueStrategy || 'remind_only', annotationDueSoonNotifiedAt: item.annotationDueSoonNotifiedAt || null, reviewDueSoonNotifiedAt: item.reviewDueSoonNotifiedAt || null, annotationTimeoutHours: Number(item.annotationTimeoutHours ?? item.reminderHours ?? 24), reviewTimeoutHours: Number(item.reviewTimeoutHours ?? item.reviewReminderHours ?? 24), taskEndedNotifiedAt: item.taskEndedNotifiedAt || null }),
  },
  'annotation-items': {
    stmts: stmts.annotation_items,
    transform: transformAnnotationItem,
    insertFields: (item) => [item.id, item.taskId, JSON.stringify(item.rawData || {}), item.status || 'pending', item.annotationData ? JSON.stringify(item.annotationData) : null, item.annotator || null, item.submittedAt || null, item.reviewer || null, item.reviewedAt || null, item.rejectReason || null, JSON.stringify(item.auditHistory || []), item.createdAt || new Date().toISOString(), item.version || 1, item.lockedBy || null, item.lockedAt || null, item.archived ? 1 : 0, item.archivedAt || null],
    updateFields: (item) => ({
      id: item.id,
      taskId: item.taskId,
      rawData: JSON.stringify(item.rawData || {}),
      status: item.status,
      annotationData: item.annotationData ? JSON.stringify(item.annotationData) : null,
      annotator: item.annotator,
      submittedAt: item.submittedAt,
      reviewer: item.reviewer,
      reviewedAt: item.reviewedAt,
      rejectReason: item.rejectReason,
      auditHistory: JSON.stringify(item.auditHistory || []),
      version: item.version,
      lockedBy: item.lockedBy,
      lockedAt: item.lockedAt,
      archived: item.archived ? 1 : 0,
      archivedAt: item.archivedAt || null,
    }),
  },
  'reviews': {
    stmts: stmts.reviews,
    transform: transformReview,
    insertFields: (item) => [item.id, item.dataItemId, item.taskId, item.templateId || null, item.reviewStatus || 'pending', item.score || 0, item.summary || '', JSON.stringify(item.matchedRules || []), JSON.stringify(item.fieldWarnings || []), JSON.stringify(item.suggestions || []), item.reviewedAt || null, item.modelVersion || null],
    updateFields: (item) => ({
      id: item.id,
      dataItemId: item.dataItemId,
      taskId: item.taskId,
      templateId: item.templateId,
      reviewStatus: item.reviewStatus,
      score: item.score,
      summary: item.summary,
      matchedRules: JSON.stringify(item.matchedRules || []),
      fieldWarnings: JSON.stringify(item.fieldWarnings || []),
      suggestions: JSON.stringify(item.suggestions || []),
      reviewedAt: item.reviewedAt,
      modelVersion: item.modelVersion,
    }),
  },
};

function getCollection(name) {
  const coll = COLLECTIONS[name];
  if (!coll) throw new Error(`Unknown collection: ${name}`);
  return coll;
}

function getAllowedColumns(name) {
  const tableName = getTableName(name);
  return new Set(db.pragma(`table_info(${tableName})`).map((column) => column.name));
}

function assertSafeFilter(name, filter = {}) {
  const allowedColumns = getAllowedColumns(name);
  for (const key of Object.keys(filter)) {
    if (!allowedColumns.has(key)) {
      throw new Error(`Unsupported filter field: ${key}`);
    }
  }
}

function buildWhereClause(name, filter = {}) {
  assertSafeFilter(name, filter);

  const clauses = [];
  const params = [];
  for (const [key, value] of Object.entries(filter)) {
    clauses.push(`${key} = ?`);
    params.push(value);
  }

  return {
    where: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

function assertSafeSortField(name, sortField) {
  if (!sortField) return;
  const allowedColumns = getAllowedColumns(name);
  if (!allowedColumns.has(sortField)) {
    throw new Error(`Unsupported sort field: ${sortField}`);
  }
}

// ─── Generic CRUD API (compatible with old db.js interface) ──

/**
 * Get all items from a collection.
 */
function getAll(name) {
  const coll = getCollection(name);
  const rows = coll.stmts.getAll.all();
  return rows.map(coll.transform);
}

/**
 * Get a single item by id.
 */
function getById(name, id) {
  const coll = getCollection(name);
  const row = coll.stmts.getById.get(id);
  return coll.transform(row);
}

/**
 * Find items matching a filter object (key-value pairs).
 * Only supports simple equality filters on top-level scalar fields.
 */
function find(name, filter = {}) {
  const coll = getCollection(name);
  const { where, params } = buildWhereClause(name, filter);
  const stmt = db.prepare(`SELECT * FROM ${getTableName(name)} ${where}`);
  const rows = stmt.all(...params);
  return rows.map(coll.transform);
}

/**
 * List items with database-level filtering, sorting, and pagination.
 */
function list(name, options = {}) {
  const coll = getCollection(name);
  const filter = options.filter || {};
  const { where, params } = buildWhereClause(name, filter);
  const tableName = getTableName(name);
  const total = db.prepare(`SELECT COUNT(*) AS total FROM ${tableName} ${where}`).get(...params).total;

  const sortField = options.sort || null;
  assertSafeSortField(name, sortField);
  const order = String(options.order || '').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const orderClause = sortField ? `ORDER BY ${sortField} ${order}` : '';

  const limit = Number(options.limit) > 0 ? Math.floor(Number(options.limit)) : 0;
  const page = Number(options.page) > 0 ? Math.floor(Number(options.page)) : 1;
  const offset = (page - 1) * limit;
  const limitClause = limit > 0 ? 'LIMIT ? OFFSET ?' : '';
  const listParams = limit > 0 ? [...params, limit, offset] : params;

  const stmt = db.prepare(`SELECT * FROM ${tableName} ${where} ${orderClause} ${limitClause}`);
  const items = stmt.all(...listParams).map(coll.transform);
  return { items, total, page, limit: limit || total };
}

/**
 * Find one item matching a filter.
 */
function findOne(name, filter = {}) {
  const results = find(name, filter);
  return results.length > 0 ? results[0] : null;
}

/**
 * Insert an item into a collection.
 */
function insert(name, item) {
  const coll = getCollection(name);
  coll.stmts.insert.run(...coll.insertFields(item));
  return item;
}

/**
 * Update an item by id (partial merge).
 * Reads the existing row, merges updates, then writes back.
 */
function updateById(name, id, updates) {
  const coll = getCollection(name);
  const existing = getById(name, id);
  if (!existing) return null;

  const merged = { ...existing, ...updates };
  // Prevent id from being changed
  merged.id = id;

  // For annotation-items, auto-increment version on every update
  if (name === 'annotation-items' && !updates._skipVersionIncrement) {
    merged.version = (existing.version || 1) + 1;
  }
  // Clean internal flags before persistence
  delete merged._skipVersionIncrement;

  const updateData = coll.updateFields(merged);
  coll.stmts.update.run(updateData);
  return getById(name, id);
}

/**
 * Optimistic-lock aware update for annotation-items.
 * Returns { conflict: true, currentVersion, serverItem } on version mismatch,
 * or { conflict: false, updatedItem } on success.
 */
function updateWithVersionCheck(id, updates, clientVersion) {
  const existing = getById('annotation-items', id);
  if (!existing) return { conflict: false, updatedItem: null };

  // Optimistic lock: check version
  if (clientVersion !== undefined && clientVersion !== null && existing.version !== clientVersion) {
    return {
      conflict: true,
      currentVersion: existing.version,
      serverItem: existing,
    };
  }

  // Version matches (or not provided for non-annotator ops), proceed with update
  const updatedItem = updateById('annotation-items', id, updates);
  return { conflict: false, updatedItem };
}

/**
 * Claim (pessimistic lock) an annotation item for editing.
 * Returns { claimed: true, item } on success, or { claimed: false, lockedBy, lockedAt } if already locked.
 * Auto-expires stale locks older than lockTimeoutMs.
 */
function claimItem(id, username, lockTimeoutMs = 30 * 60 * 1000) {
  const existing = getById('annotation-items', id);
  if (!existing) return { claimed: false, notFound: true };

  // Check if already locked by someone else (and lock hasn't expired)
  if (existing.lockedBy && existing.lockedBy !== username && existing.lockedAt) {
    const lockAge = Date.now() - new Date(existing.lockedAt).getTime();
    if (lockAge < lockTimeoutMs) {
      return {
        claimed: false,
        lockedBy: existing.lockedBy,
        lockedAt: existing.lockedAt,
      };
    }
    // Lock expired → allow re-claim
  }

  const now = new Date().toISOString();
  const updatedItem = updateById('annotation-items', id, {
    lockedBy: username,
    lockedAt: now,
    _skipVersionIncrement: true, // 锁操作不改变数据内容，不增加版本号
  });
  return { claimed: true, item: updatedItem };
}

/**
 * Release (unlock) an annotation item.
 * Only the lock owner (or owner role) can release.
 */
function releaseItem(id, username) {
  const existing = getById('annotation-items', id);
  if (!existing) return { released: false, notFound: true };

  if (existing.lockedBy && existing.lockedBy !== username) {
    return { released: false, lockedBy: existing.lockedBy };
  }

  const updatedItem = updateById('annotation-items', id, {
    lockedBy: null,
    lockedAt: null,
    _skipVersionIncrement: true, // 锁操作不改变数据内容，不增加版本号
  });
  return { released: true, item: updatedItem };
}

/**
 * Release all locks held by a specific user (e.g., on logout).
 */
function releaseAllByUser(username) {
  const items = getAll('annotation-items');
  let count = 0;
  for (const item of items) {
    if (item.lockedBy === username) {
      updateById('annotation-items', item.id, { lockedBy: null, lockedAt: null, _skipVersionIncrement: true });
      count++;
    }
  }
  return count;
}

/**
 * Clean up expired locks across all annotation items.
 */
function cleanExpiredLocks(lockTimeoutMs = 30 * 60 * 1000) {
  const items = getAll('annotation-items');
  let count = 0;
  const now = Date.now();
  for (const item of items) {
    if (item.lockedBy && item.lockedAt) {
      const lockAge = now - new Date(item.lockedAt).getTime();
      if (lockAge >= lockTimeoutMs) {
        updateById('annotation-items', item.id, { lockedBy: null, lockedAt: null, _skipVersionIncrement: true });
        count++;
      }
    }
  }
  return count;
}

/**
 * Replace an item by id (full replace).
 */
function replaceById(name, id, newItem) {
  const coll = getCollection(name);
  newItem.id = id;
  const updateData = coll.updateFields(newItem);
  coll.stmts.update.run(updateData);
  return getById(name, id);
}

/**
 * Delete an item by id.
 */
function deleteById(name, id) {
  const coll = getCollection(name);
  const result = coll.stmts.delete.run(id);
  return result.changes > 0;
}

/**
 * Count items in a collection, optionally filtered.
 */
function count(name, filter = {}) {
  if (Object.keys(filter).length === 0) {
    const coll = getCollection(name);
    const row = coll.stmts.count.get();
    return row.total;
  }
  const { where, params } = buildWhereClause(name, filter);
  const stmt = db.prepare(`SELECT COUNT(*) AS total FROM ${getTableName(name)} ${where}`);
  const row = stmt.get(...params);
  return row.total;
}

/**
 * Bulk seed: replace entire collection.
 * Uses a transaction for atomicity.
 */
function seed(name, data) {
  const coll = getCollection(name);
  const tableName = getTableName(name);

  const truncateAndInsert = db.transaction((items) => {
    db.exec(`DELETE FROM ${tableName}`);
    for (const item of items) {
      coll.stmts.insert.run(...coll.insertFields(item));
    }
  });

  truncateAndInsert(data);
}

/**
 * Map collection name to SQL table name.
 */
function getTableName(collectionName) {
  // 'annotation-items' -> 'annotation_items'
  return collectionName.replace(/-/g, '_');
}

/**
 * Run a function inside a transaction.
 */
function transaction(fn) {
  return db.transaction(fn)();
}

/**
 * Check if the database has been seeded (has any data).
 */
function isSeeded() {
  const row = db.prepare('SELECT COUNT(*) AS total FROM users').get();
  return row.total > 0;
}

function insertNotification(notification) {
  const item = {
    ...notification,
    data: notification.data || {},
    targetUsers: notification.targetUsers || [],
    timestamp: notification.timestamp || new Date().toISOString(),
    read: notification.read ? 1 : 0,
    deleted: notification.deleted ? 1 : 0,
  };

  stmts.notifications.insert.run(
    item.id,
    item.recipientUserId || null,
    item.recipientUsername,
    item.type,
    item.title,
    item.message,
    item.priority || 'low',
    JSON.stringify(item.data),
    item.sender || null,
    JSON.stringify(item.targetUsers),
    item.timestamp,
    item.read,
    item.readAt || null,
    item.deleted,
    item.deletedAt || null,
  );
  return transformNotification({
    ...item,
    data: JSON.stringify(item.data),
    targetUsers: JSON.stringify(item.targetUsers),
  });
}

function getOwnerPublishedNotificationRows(sender = null, options = {}) {
  const limit = Math.max(1, Math.min(Number(options.limit) || 200, 500));
  const rows = sender
    ? db.prepare(
      `SELECT * FROM notifications
       WHERE type = 'owner_message' AND sender = ?
       ORDER BY timestamp DESC
       LIMIT ?`
    ).all(sender, limit)
    : db.prepare(
      `SELECT * FROM notifications
       WHERE type = 'owner_message'
       ORDER BY timestamp DESC
       LIMIT ?`
    ).all(limit);
  return rows.map(transformNotification);
}

function getPublishedNotificationRowsByPublishId(sender = null, publishId) {
  const rows = sender
    ? db.prepare(
      `SELECT * FROM notifications
       WHERE type = 'owner_message' AND sender = ?
       ORDER BY timestamp DESC`
    ).all(sender)
    : db.prepare(
      `SELECT * FROM notifications
       WHERE type = 'owner_message'
       ORDER BY timestamp DESC`
    ).all();
  return rows
    .map(transformNotification)
    .filter((item) => item.data?.publishId === publishId);
}

function updatePublishedNotificationData(sender = null, publishId, updater) {
  const rows = getPublishedNotificationRowsByPublishId(sender, publishId);
  if (rows.length === 0) return 0;

  const stmt = db.prepare(
    `UPDATE notifications
     SET data = @data,
         deleted = @deleted,
         deletedAt = @deletedAt
     WHERE id = @id`
  );

  const updateRows = db.transaction((items) => {
    let updated = 0;
    for (const item of items) {
      const next = updater(item);
      stmt.run({
        id: item.id,
        data: JSON.stringify(next.data || {}),
        deleted: next.deleted ? 1 : 0,
        deletedAt: next.deletedAt || null,
      });
      updated += 1;
    }
    return updated;
  });

  return updateRows(rows);
}

function getNotificationsForUser(username, options = {}) {
  const limit = Math.max(1, Math.min(Number(options.limit) || 100, 200));
  return stmts.notifications.getForUser
    .all(username, limit)
    .map(transformNotification);
}

function getNotificationsForUserByType(username, type, options = {}) {
  const limit = Math.max(1, Math.min(Number(options.limit) || 100, 200));
  return stmts.notifications.getForUserByType
    .all(username, type, limit)
    .map(transformNotification);
}

function getNotificationsForUserByTypes(username, types, options = {}) {
  const safeTypes = [...new Set((types || []).filter(Boolean))];
  if (safeTypes.length === 0) return [];
  const limit = Math.max(1, Math.min(Number(options.limit) || 100, 200));
  const placeholders = safeTypes.map(() => '?').join(', ');
  const stmt = db.prepare(
    `SELECT * FROM notifications WHERE recipientUsername = ? AND type IN (${placeholders}) AND deleted = 0 ORDER BY timestamp DESC LIMIT ?`
  );
  return stmt.all(username, ...safeTypes, limit).map(transformNotification);
}

function getNotificationCountForUser(username) {
  return stmts.notifications.countForUser.get(username).total;
}

function getNotificationCountForUserByType(username, type) {
  return stmts.notifications.countForUserByType.get(username, type).total;
}

function getNotificationCountForUserByTypes(username, types) {
  const safeTypes = [...new Set((types || []).filter(Boolean))];
  if (safeTypes.length === 0) return 0;
  const placeholders = safeTypes.map(() => '?').join(', ');
  const stmt = db.prepare(
    `SELECT COUNT(*) AS total FROM notifications WHERE recipientUsername = ? AND type IN (${placeholders}) AND deleted = 0`
  );
  return stmt.get(username, ...safeTypes).total;
}

function getUnreadNotificationCountForUser(username) {
  return stmts.notifications.unreadCountForUser.get(username).total;
}

function getUnreadNotificationCountForUserByType(username, type) {
  return stmts.notifications.unreadCountForUserByType.get(username, type).total;
}

function getUnreadNotificationCountForUserByTypes(username, types) {
  const safeTypes = [...new Set((types || []).filter(Boolean))];
  if (safeTypes.length === 0) return 0;
  const placeholders = safeTypes.map(() => '?').join(', ');
  const stmt = db.prepare(
    `SELECT COUNT(*) AS total FROM notifications WHERE recipientUsername = ? AND type IN (${placeholders}) AND deleted = 0 AND read = 0`
  );
  return stmt.get(username, ...safeTypes).total;
}

function markNotificationReadForUser(username, notificationId) {
  const now = new Date().toISOString();
  return stmts.notifications.markRead.run(now, notificationId, username).changes > 0;
}

function markAllNotificationsReadForUser(username) {
  const now = new Date().toISOString();
  return stmts.notifications.markAllRead.run(now, username).changes;
}

function markAllNotificationsReadForUserByType(username, type) {
  const now = new Date().toISOString();
  return stmts.notifications.markAllReadByType.run(now, username, type).changes;
}

function markAllNotificationsReadForUserByTypes(username, types) {
  const safeTypes = [...new Set((types || []).filter(Boolean))];
  if (safeTypes.length === 0) return 0;
  const now = new Date().toISOString();
  const placeholders = safeTypes.map(() => '?').join(', ');
  const stmt = db.prepare(
    `UPDATE notifications SET read = 1, readAt = COALESCE(readAt, ?) WHERE recipientUsername = ? AND type IN (${placeholders}) AND deleted = 0 AND read = 0`
  );
  return stmt.run(now, username, ...safeTypes).changes;
}

function deleteNotificationForUser(username, notificationId) {
  const now = new Date().toISOString();
  return stmts.notifications.softDelete.run(now, notificationId, username).changes > 0;
}

function clearNotificationsForUser(username) {
  const now = new Date().toISOString();
  return stmts.notifications.clearForUser.run(now, username).changes;
}

function clearNotificationsForUserByType(username, type) {
  const now = new Date().toISOString();
  return stmts.notifications.clearForUserByType.run(now, username, type).changes;
}

function clearNotificationsForUserExceptType(username, type) {
  const now = new Date().toISOString();
  return stmts.notifications.clearForUserExceptType.run(now, username, type).changes;
}

function clearNotificationsForUserByTypes(username, types) {
  const safeTypes = [...new Set((types || []).filter(Boolean))];
  if (safeTypes.length === 0) return 0;
  const now = new Date().toISOString();
  const placeholders = safeTypes.map(() => '?').join(', ');
  const stmt = db.prepare(
    `UPDATE notifications SET deleted = 1, deletedAt = ? WHERE recipientUsername = ? AND type IN (${placeholders}) AND deleted = 0`
  );
  return stmt.run(now, username, ...safeTypes).changes;
}

function clearNotificationsForUserExceptTypes(username, types) {
  const safeTypes = [...new Set((types || []).filter(Boolean))];
  if (safeTypes.length === 0) return clearNotificationsForUser(username);
  const now = new Date().toISOString();
  const placeholders = safeTypes.map(() => '?').join(', ');
  const stmt = db.prepare(
    `UPDATE notifications SET deleted = 1, deletedAt = ? WHERE recipientUsername = ? AND type NOT IN (${placeholders}) AND deleted = 0`
  );
  return stmt.run(now, username, ...safeTypes).changes;
}

module.exports = {
  getAll,
  getById,
  find,
  list,
  findOne,
  insert,
  updateById,
  updateWithVersionCheck,
  claimItem,
  releaseItem,
  releaseAllByUser,
  cleanExpiredLocks,
  replaceById,
  deleteById,
  count,
  seed,
  transaction,
  isSeeded,
  insertNotification,
  getNotificationsForUser,
  getNotificationsForUserByType,
  getNotificationsForUserByTypes,
  getNotificationCountForUser,
  getNotificationCountForUserByType,
  getNotificationCountForUserByTypes,
  getUnreadNotificationCountForUser,
  getUnreadNotificationCountForUserByType,
  getUnreadNotificationCountForUserByTypes,
  markNotificationReadForUser,
  markAllNotificationsReadForUser,
  markAllNotificationsReadForUserByType,
  markAllNotificationsReadForUserByTypes,
  deleteNotificationForUser,
  clearNotificationsForUser,
  clearNotificationsForUserByType,
  clearNotificationsForUserByTypes,
  clearNotificationsForUserExceptType,
  clearNotificationsForUserExceptTypes,
  getOwnerPublishedNotificationRows,
  getPublishedNotificationRowsByPublishId,
  updatePublishedNotificationData,
  // Export db instance for advanced use
  _db: db,
};
