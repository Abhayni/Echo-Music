const DATABASE_NAME = "echo-local-audio";
const STORE_NAME = "files";
const DATABASE_VERSION = 1;

type LocalAudioRecord = {
  id: string;
  file: Blob;
};

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(`Could not open local audio storage: ${request.error?.message || "unknown error"}`));
  });
}

export async function saveLocalAudio(id: string, file: Blob) {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({ id, file } satisfies LocalAudioRecord);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error(`Could not save local audio: ${transaction.error?.message || "unknown error"}`));
      transaction.onabort = () => reject(new Error(`Could not save local audio: ${transaction.error?.message || "transaction aborted"}`));
    });
  } finally {
    database.close();
  }
}

export async function restoreLocalAudio(id: string) {
  const database = await openDatabase();
  try {
    const record = await new Promise<LocalAudioRecord | undefined>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result as LocalAudioRecord | undefined);
      request.onerror = () => reject(new Error(`Could not restore local audio: ${request.error?.message || "unknown error"}`));
    });
    if (!record?.file) throw new Error("The saved local audio file is missing. Please select it again.");
    return URL.createObjectURL(record.file);
  } finally {
    database.close();
  }
}
