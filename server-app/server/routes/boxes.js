// server/routes/boxes.js

const express = require('express');
const db = require('../db/init.js');

const router = express.Router();

function toClient(row) {
  return {
    id: row.id,
    workspaceId: row.dashboard_id, // se mantiene el nombre de campo del frontend
    title: row.title,
    layout: row.layout,
    colSpan: row.col_span,
    titleAlign: row.title_align,
    titleColor: row.title_color,
    titleFont: row.title_font,
    showTitle: !!row.show_title,
    linkColor: row.link_color,
    linkFontSize: row.link_font_size,
    bgColor: row.bg_color,
    bgOpacity: row.bg_opacity,
    gridCols: row.grid_cols,
    orbSize: row.orb_size,
    listRowHeight: row.list_row_height,
    statsLimit: row.stats_limit,
    rssFeedUrl: row.rss_feed_url,
    rssCount: row.rss_count,
    calendarView: row.calendar_view,
    noteId: row.note_id,
    bulletStyle: row.bullet_style,
    parentBoxId: row.parent_box_id,
    containerConfig: row.container_config ? JSON.parse(row.container_config) : null,
    order: row.order_index,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// GET /api/boxes?dashboardId=xxx — lista cajas (opcionalmente filtradas)
router.get('/', (req, res) => {
  const { dashboardId } = req.query;
  const rows = dashboardId
    ? db.prepare('SELECT * FROM boxes WHERE dashboard_id = ? ORDER BY order_index').all(dashboardId)
    : db.prepare('SELECT * FROM boxes ORDER BY order_index').all();
  res.json(rows.map(toClient));
});

// POST /api/boxes — crear
router.post('/', (req, res) => {
  const b = req.body;
  if (!b.id || !b.workspaceId || !b.title) {
    return res.status(400).json({ error: 'id, workspaceId y title son obligatorios' });
  }
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO boxes (
      id, dashboard_id, title, layout, col_span, title_align, title_color, title_font,
      show_title, link_color, link_font_size, bg_color, bg_opacity, grid_cols, orb_size,
      list_row_height, stats_limit, rss_feed_url, rss_count, calendar_view, note_id, bullet_style, parent_box_id, container_config, order_index,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    b.id, b.workspaceId, b.title, b.layout || 'grid', b.colSpan || 1,
    b.titleAlign || 'left', b.titleColor || '#f3f4f6', b.titleFont || 'Inter',
    b.showTitle !== false ? 1 : 0, b.linkColor || '#ffffff', b.linkFontSize || 14,
    b.bgColor || '#000000', b.bgOpacity ?? 0.7, b.gridCols || 2, b.orbSize || 80,
    b.listRowHeight || 'normal', b.statsLimit || 5, b.rssFeedUrl || null, b.rssCount || 8,
    b.calendarView || 'month', b.noteId || null, b.bulletStyle || 'disc', b.parentBoxId || null, b.containerConfig ? JSON.stringify(b.containerConfig) : null, b.order || 0, now, now
  );

  const row = db.prepare('SELECT * FROM boxes WHERE id = ?').get(b.id);
  res.status(201).json(toClient(row));
});

// PUT /api/boxes/:id — actualizar
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM boxes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Caja no encontrada' });

  const b = req.body;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE boxes SET
      dashboard_id = ?, title = ?, layout = ?, col_span = ?, title_align = ?, title_color = ?,
      title_font = ?, show_title = ?, link_color = ?, link_font_size = ?, bg_color = ?,
      bg_opacity = ?, grid_cols = ?, orb_size = ?, list_row_height = ?, stats_limit = ?,
      rss_feed_url = ?, rss_count = ?, calendar_view = ?, note_id = ?, bullet_style = ?, parent_box_id = ?, container_config = ?, order_index = ?, updated_at = ?
    WHERE id = ?
  `).run(
    b.workspaceId ?? existing.dashboard_id,
    b.title ?? existing.title,
    b.layout ?? existing.layout,
    b.colSpan ?? existing.col_span,
    b.titleAlign ?? existing.title_align,
    b.titleColor ?? existing.title_color,
    b.titleFont ?? existing.title_font,
    b.showTitle !== undefined ? (b.showTitle ? 1 : 0) : existing.show_title,
    b.linkColor ?? existing.link_color,
    b.linkFontSize ?? existing.link_font_size,
    b.bgColor ?? existing.bg_color,
    b.bgOpacity ?? existing.bg_opacity,
    b.gridCols ?? existing.grid_cols,
    b.orbSize ?? existing.orb_size,
    b.listRowHeight ?? existing.list_row_height,
    b.statsLimit ?? existing.stats_limit,
    b.rssFeedUrl ?? existing.rss_feed_url,
    b.rssCount ?? existing.rss_count,
    b.calendarView ?? existing.calendar_view,
    b.noteId !== undefined ? b.noteId : existing.note_id,
    b.bulletStyle ?? existing.bullet_style,
    b.parentBoxId !== undefined ? b.parentBoxId : existing.parent_box_id,
    b.containerConfig !== undefined ? (b.containerConfig ? JSON.stringify(b.containerConfig) : null) : existing.container_config,
    b.order ?? existing.order_index,
    now,
    req.params.id
  );

  const row = db.prepare('SELECT * FROM boxes WHERE id = ?').get(req.params.id);
  res.json(toClient(row));
});

// DELETE /api/boxes/:id — cascada elimina sus items
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM boxes WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Caja no encontrada' });
  res.status(204).send();
});

module.exports = router;
