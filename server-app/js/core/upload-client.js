// js/core/upload-client.js
// Sube un archivo al servidor (multipart/form-data) y devuelve la URL
// donde quedó accesible. Usado por el fondo personalizado, y pensado
// para reutilizarse en cualquier otra imagen que el proyecto necesite.

/**
 * @param {File} file
 * @returns {Promise<string>} URL relativa del archivo subido (ej: /uploads/abc123.jpg)
 */
export async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/uploads', {
    method: 'POST',
    credentials: 'include',
    body: formData
    // Sin Content-Type manual: el navegador lo pone solo con el boundary
    // correcto de multipart/form-data al usar FormData.
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error al subir el archivo');
  return data.url;
}
