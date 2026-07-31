// server/routes/import-export.js
// Migración de datos: exporta/importa el mismo formato JSON que ya
// generaba la app en localStorage (botones Exportar/Importar de
// Configuración), para que migrar sea tan simple como:
//   1. Exportar desde la app (ya funciona, sin tocar nada)
//   2. POST ese JSON a /api/import

const express = require('express');
const db = require('../db/init.js');

const router = express.Router();

// ========== EXPORT ==========

router.get('/export', (req, res) => {
  const workspaces = db.prepare('SELECT * FROM dashboards ORDER BY order_index').all().map(w => ({
    id: w.id, name: w.name, type: w.type,
    layoutConfig: w.layout_config ? JSON.parse(w.layout_config) : null,
    backgroundUrl: w.background_url || null,
    active: !!w.active, pinned: !!w.pinned,
    order: w.order_index, createdAt: w.created_at, updatedAt: w.updated_at
  }));

  const boxes = db.prepare('SELECT * FROM boxes ORDER BY order_index').all().map(b => ({
    id: b.id, workspaceId: b.dashboard_id, title: b.title, layout: b.layout,
    colSpan: b.col_span, titleAlign: b.title_align, titleColor: b.title_color,
    titleFont: b.title_font, showTitle: !!b.show_title, linkColor: b.link_color,
    linkFontSize: b.link_font_size, bgColor: b.bg_color, bgOpacity: b.bg_opacity,
    gridCols: b.grid_cols, orbSize: b.orb_size, listRowHeight: b.list_row_height,
    statsLimit: b.stats_limit, rssFeedUrl: b.rss_feed_url, rssCount: b.rss_count,
    calendarView: b.calendar_view, noteId: b.note_id, bulletStyle: b.bullet_style,
    parentBoxId: b.parent_box_id, containerConfig: b.container_config ? JSON.parse(b.container_config) : null,
    order: b.order_index,
    createdAt: b.created_at, updatedAt: b.updated_at
  }));

  const items = db.prepare('SELECT * FROM items ORDER BY order_index').all().map(i => ({
    id: i.id, boxId: i.box_id, type: i.type, order: i.order_index,
    data: JSON.parse(i.data), metadata: JSON.parse(i.metadata)
  }));

  const calendarEvents = db.prepare('SELECT * FROM calendar_events ORDER BY date, time').all().map(e => ({
    id: e.id, title: e.title, date: e.date, time: e.time,
    allDay: !!e.all_day, source: 'native', createdAt: e.created_at
  }));

  const settingsRows = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  settingsRows.forEach(r => { settings[r.key] = r.value; });

  const notes = db.prepare('SELECT * FROM notes ORDER BY updated_at DESC').all().map(n => ({
    id: n.id, type: n.type, title: n.title, content: n.content,
    properties: JSON.parse(n.properties || '{}'),
    createdAt: n.created_at, updatedAt: n.updated_at
  }));

  res.json({
    version: '2.0',
    workspaces,
    boxes,
    items,
    calendarEvents,
    settings,
    notes,
    exportedAt: new Date().toISOString()
  });
});

// ========== IMPORT ==========
// Sustituye TODO el contenido de la base de datos por el del JSON recibido.
// Pensado para una migración inicial desde localStorage, no para fusionar
// datos existentes — si ya tienes datos en el servidor, se sobrescriben.

router.post('/import', (req, res) => {
  const { workspaces, boxes, items, calendarEvents, settings, notes } = req.body;

  if (!Array.isArray(workspaces) || !Array.isArray(boxes) || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Formato inválido: se esperan workspaces, boxes e items como arrays' });
  }

  const now = new Date().toISOString();

  const clearAll = db.transaction(() => {
    // Borrar en orden inverso a las FK para no violar restricciones
    db.prepare('DELETE FROM items').run();
    db.prepare('DELETE FROM boxes').run();
    db.prepare('DELETE FROM dashboards').run();
  });

  const insertDashboard = db.prepare(`
    INSERT INTO dashboards (id, name, type, layout_config, background_url, active, pinned, order_index, created_at, updated_at)
    VALUES (@id, @name, @type, @layoutConfig, @backgroundUrl, @active, @pinned, @order, @createdAt, @updatedAt)
  `);

  const insertBox = db.prepare(`
    INSERT INTO boxes (
      id, dashboard_id, title, layout, col_span, title_align, title_color, title_font,
      show_title, link_color, link_font_size, bg_color, bg_opacity, grid_cols, orb_size,
      list_row_height, stats_limit, rss_feed_url, rss_count, calendar_view, note_id, bullet_style,
      parent_box_id, container_config, order_index,
      created_at, updated_at
    ) VALUES (
      @id, @dashboardId, @title, @layout, @colSpan, @titleAlign, @titleColor, @titleFont,
      @showTitle, @linkColor, @linkFontSize, @bgColor, @bgOpacity, @gridCols, @orbSize,
      @listRowHeight, @statsLimit, @rssFeedUrl, @rssCount, @calendarView, @noteId, @bulletStyle,
      @parentBoxId, @containerConfig, @order,
      @createdAt, @updatedAt
    )
  `);

  const insertItem = db.prepare(`
    INSERT INTO items (id, box_id, type, order_index, data, metadata)
    VALUES (@id, @boxId, @type, @order, @data, @metadata)
  `);

  const insertCalendarEvent = db.prepare(`
    INSERT INTO calendar_events (id, title, date, time, all_day, created_at)
    VALUES (@id, @title, @date, @time, @allDay, @createdAt)
  `);

  const upsertSetting = db.prepare(`
    INSERT INTO settings (key, value) VALUES (@key, @value)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  const insertNote = db.prepare(`
    INSERT INTO notes (id, type, title, content, properties, created_at, updated_at)
    VALUES (@id, @type, @title, @content, @properties, @createdAt, @updatedAt)
  `);

  const insertAll = db.transaction(() => {
    clearAll();

    workspaces.forEach(w => insertDashboard.run({
      id: w.id, name: w.name, type: w.type || 'links',
      layoutConfig: w.layoutConfig ? JSON.stringify(w.layoutConfig) : null,
      backgroundUrl: w.backgroundUrl || null,
      active: w.active ? 1 : 0, pinned: w.pinned ? 1 : 0, order: w.order || 0,
      createdAt: w.createdAt || now, updatedAt: w.updatedAt || now
    }));

    boxes.forEach(b => insertBox.run({
      id: b.id, dashboardId: b.workspaceId, title: b.title, layout: b.layout || 'grid',
      colSpan: b.colSpan || 1, titleAlign: b.titleAlign || 'left',
      titleColor: b.titleColor || '#f3f4f6', titleFont: b.titleFont || 'Inter',
      showTitle: b.showTitle !== false ? 1 : 0, linkColor: b.linkColor || '#ffffff',
      linkFontSize: b.linkFontSize || 14, bgColor: b.bgColor || '#000000',
      bgOpacity: b.bgOpacity ?? 0.7, gridCols: b.gridCols || 2, orbSize: b.orbSize || 80,
      listRowHeight: b.listRowHeight || 'normal', statsLimit: b.statsLimit || 5,
      rssFeedUrl: b.rssFeedUrl || null, rssCount: b.rssCount || 8,
      calendarView: b.calendarView || 'month', noteId: b.noteId || null, bulletStyle: b.bulletStyle || 'disc',
      parentBoxId: b.parentBoxId || null,
      containerConfig: b.containerConfig ? JSON.stringify(b.containerConfig) : null,
      order: b.order || 0,
      createdAt: b.createdAt || now, updatedAt: b.updatedAt || now
    }));

    items.forEach(i => insertItem.run({
      id: i.id, boxId: i.boxId, type: i.type || 'link', order: i.order || 0,
      data: JSON.stringify(i.data || {}),
      metadata: JSON.stringify(i.metadata || { clickCount: 0, lastAccessed: null, createdAt: now, tags: [] })
    }));

    // Eventos de calendario y settings son opcionales en el JSON recibido
    // (los backups antiguos, de antes de este fix, no los incluían).
    // Solo se tocan sus tablas si vienen presentes en el import, para no
    // borrar accidentalmente eventos/configuración al importar un backup viejo.
    if (Array.isArray(calendarEvents)) {
      db.prepare('DELETE FROM calendar_events').run();
      calendarEvents.forEach(e => insertCalendarEvent.run({
        id: e.id, title: e.title, date: e.date,
        time: e.allDay ? null : (e.time || null),
        allDay: e.allDay ? 1 : 0,
        createdAt: e.createdAt || now
      }));
    }

    if (settings && typeof settings === 'object') {
      Object.entries(settings).forEach(([key, value]) => {
        upsertSetting.run({ key, value: value ?? '' });
      });
    }

    if (Array.isArray(notes)) {
      db.prepare('DELETE FROM notes').run();
      notes.forEach(n => insertNote.run({
        id: n.id, type: n.type || 'quick', title: n.title || '', content: n.content || '',
        properties: JSON.stringify(n.properties || {}),
        createdAt: n.createdAt || now, updatedAt: n.updatedAt || now
      }));
    }
  });

  insertAll();

  res.json({
    ok: true,
    imported: {
      workspaces: workspaces.length,
      boxes: boxes.length,
      items: items.length,
      calendarEvents: Array.isArray(calendarEvents) ? calendarEvents.length : 0,
      settings: settings ? Object.keys(settings).length : 0,
      notes: Array.isArray(notes) ? notes.length : 0
    }
  });
});

module.exports = router;
