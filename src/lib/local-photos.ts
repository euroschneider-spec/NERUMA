'use client';

const databaseName = 'vianorae-demo-media-v1';

async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('photos');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('storage-unavailable'));
  });
}

export async function saveLocalPhoto(id: string, blob: Blob): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('photos', 'readwrite');
      transaction.objectStore('photos').put(blob, id);
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => reject(transaction.error);
    });
  } finally { database.close(); }
}

export async function readLocalPhoto(id: string): Promise<Blob | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction('photos').objectStore('photos').get(id);
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
      request.onerror = () => reject(request.error);
    });
  } finally { database.close(); }
}

export async function preparePhoto(file: File): Promise<Blob> {
  if (file.size === 0 || file.size > 5 * 1024 * 1024) throw new Error('invalid-photo');
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const jpeg = file.type === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const png = file.type === 'image/png' && [137,80,78,71,13,10,26,10].every((value, i) => bytes[i] === value);
  const webp = file.type === 'image/webp' && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (!jpeg && !png && !webp) throw new Error('invalid-photo');
  let image: ImageBitmap;
  try { image = await createImageBitmap(file); } catch { throw new Error('invalid-photo'); }
  try {
    if (image.width * image.height > 25_000_000) throw new Error('invalid-photo');
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('storage-unavailable');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    // Raster re-encoding removes original EXIF metadata, including GPS coordinates.
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('invalid-photo')), 'image/webp', 0.85));
  } finally { image.close(); }
}

/** Forgets every photo kept in this browser (the demo's reset). */
export async function clearLocalPhotos(): Promise<void> {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
}
