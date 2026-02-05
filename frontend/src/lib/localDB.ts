const DB_NAME = 'SolarAppDB';
const STORE_NAME = 'user_files';
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

export const saveFileLocal = async (userId: string, fileType: string, file: File) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const key = `${userId}_${fileType}`;
    const request = tx.objectStore(STORE_NAME).put(file, key);
    request.onsuccess = () => resolve(undefined);
    request.onerror = () => reject(request.error);
  });
};

export const getFileLocal = async (userId: string, fileType: string): Promise<File | undefined> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(`${userId}_${fileType}`);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const removeFileLocal = async (userId: string, fileType: string) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const request = tx.objectStore(STORE_NAME).delete(`${userId}_${fileType}`);
    request.onsuccess = () => resolve(undefined);
    request.onerror = () => reject(request.error);
  });
};