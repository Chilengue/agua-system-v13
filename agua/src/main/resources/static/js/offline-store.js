/* ============================================================
   Armazenamento local (IndexedDB) do modo leitura:
   - "cache": lista de clientes descarregada para trabalhar sem rede
   - "queue": leituras feitas e ainda não enviadas ao servidor
   Os dados ficam no telemóvel até serem enviados com sucesso.
   ============================================================ */
(function () {
  const DB = 'agua-reader', VERSION = 1;
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache');
        if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'client_uuid' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  async function tx(store, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      const out = fn(s);
      t.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
      t.onerror = () => reject(t.error);
    });
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  window.OfflineStore = {
    uuid,
    saveCustomers: (companyId, rows) => tx('cache', 'readwrite', s => s.put({ rows, at: new Date().toISOString(), companyId }, 'customers')),
    getCustomers: () => tx('cache', 'readonly', s => s.get('customers')),
    queueAll: () => tx('queue', 'readonly', s => s.getAll()),
    enqueue: (item) => tx('queue', 'readwrite', s => s.put(item)),
    remove: (id) => tx('queue', 'readwrite', s => s.delete(id)),
    clearAll: () => Promise.all([tx('queue', 'readwrite', s => s.clear()), tx('cache', 'readwrite', s => s.clear())])
  };
})();
