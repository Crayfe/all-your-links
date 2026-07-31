// js/utils.js

// ========== CONSTANTES ==========

export const GOOGLE_ICONS = {
  'mail.google.com': 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico',
  'drive.google.com': 'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png',
  'calendar.google.com': 'https://calendar.google.com/googlecalendar/images/favicons_2020q4/calendar_11.ico',
  'docs.google.com': 'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico',
  'sheets.google.com': 'https://ssl.gstatic.com/docs/spreadsheets/favicon3.ico',
  'slides.google.com': 'https://ssl.gstatic.com/docs/presentations/images/favicon5.ico',
  'photos.google.com': 'https://www.gstatic.com/images/branding/product/1x/photos_48dp.png',
  'keep.google.com': 'https://ssl.gstatic.com/keep/icon_2020q4v2_128.png',
  'meet.google.com': 'https://fonts.gstatic.com/s/i/productlogos/meet_2020q4/v6/web-512dp/logo_meet_2020q4_color_2x_web_512dp.png',
  'maps.google.com': 'https://www.google.com/images/branding/product/ico/maps_32dp.ico',
  'translate.google.com': 'https://ssl.gstatic.com/images/branding/product/1x/translate_24dp.png'
};

// ========== UTILIDADES ==========

export function getFavicon(url) {
  try {
    const { hostname } = new URL(url);
    if (GOOGLE_ICONS[hostname]) return GOOGLE_ICONS[hostname];
    return `https://www.google.com/s2/favicons?sz=128&domain=${hostname}`;
  } catch (e) {
    return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888"><circle cx="12" cy="12" r="10"/></svg>';
  }
}

export function normalizeUrl(url) {
  url = url.trim();
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('www.') || (url.includes('.') && !url.includes(' '))) return `https://${url}`;
  return `https://${url}`;
}

export function sanitize(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
