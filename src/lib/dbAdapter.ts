// src/lib/dbAdapter.ts
/**
 * Database Adapter for Firebase Realtime Database (100% Free on Spark Plan).
 * Supports Realtime Database as primary persistence layer with Firestore fallback if desired.
 */
import { rtdb, db } from './firebaseConfig';
import { 
  ref, 
  get, 
  set, 
  update, 
  remove, 
  onValue, 
  push, 
  query as rtdbQuery, 
  orderByChild, 
  equalTo 
} from 'firebase/database';
import { 
  doc, 
  getDoc as fsGetDoc, 
  setDoc as fsSetDoc, 
  updateDoc as fsUpdateDoc, 
  deleteDoc as fsDeleteDoc,
  collection as fsCollection,
  getDocs as fsGetDocs,
  onSnapshot as fsOnSnapshot,
  query as fsQuery,
  where as fsWhere
} from 'firebase/firestore';
import { auth } from './firebaseConfig';

const localSubscribers = new Map<string, Set<(dataList: any[]) => void>>();

const isBrowserStorageAvailable = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const getLocalCacheKey = () => {
  const uid = auth.currentUser?.uid || 'anonymous';
  return `smart-school-saas:db-cache:v1:${uid}`;
};

const cloneValue = <T,>(value: T): T => {
  try {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
  } catch {}

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
};

const loadLocalCache = (): Record<string, any> => {
  if (!isBrowserStorageAvailable()) return {};
  try {
    const raw = window.localStorage.getItem(getLocalCacheKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveLocalCache = (cache: Record<string, any>): void => {
  if (!isBrowserStorageAvailable()) return;
  try {
    window.localStorage.setItem(getLocalCacheKey(), JSON.stringify(cache));
  } catch {}
};

const getPathSegments = (path: string) => path.split('/').filter(Boolean);

const isPlainObject = (value: unknown): value is Record<string, any> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const readFromCache = (path: string): any => {
  const segments = getPathSegments(path);
  if (segments.length === 0) return undefined;

  let node: any = loadLocalCache();
  for (const segment of segments) {
    if (!isPlainObject(node) || !(segment in node)) return undefined;
    node = node[segment];
  }
  return node;
};

const writeToCache = (path: string, value: any): void => {
  const segments = getPathSegments(path);
  if (segments.length === 0) return;

  const cache = loadLocalCache();
  let node: Record<string, any> = cache;

  segments.forEach((segment, index) => {
    const isLeaf = index === segments.length - 1;
    if (isLeaf) {
      node[segment] = cloneValue(value);
      return;
    }

    if (!isPlainObject(node[segment])) {
      node[segment] = {};
    }
    node = node[segment];
  });

  saveLocalCache(cache);
};

const mergeIntoCache = (path: string, updates: any): void => {
  const current = readFromCache(path);
  if (isPlainObject(current) && isPlainObject(updates)) {
    writeToCache(path, { ...current, ...cloneValue(updates) });
    return;
  }

  writeToCache(path, cloneValue(updates));
};

const deleteFromCache = (path: string): void => {
  const segments = getPathSegments(path);
  if (segments.length === 0) return;

  const cache = loadLocalCache();
  let node: Record<string, any> = cache;

  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    if (!isPlainObject(node[segment])) return;
    node = node[segment];
  }

  delete node[segments[segments.length - 1]];
  saveLocalCache(cache);
};

const snapshotValueToList = (path: string, value: any): any[] => {
  if (value === undefined || value === null) return [];
  if (isPlainObject(value)) {
    return Object.keys(value).map(key => {
      const item = value[key];
      return {
        id: key,
        ...(isPlainObject(item) ? item : { value: item })
      };
    });
  }

  return [{ id: path, value }];
};

const getCachedList = (path: string): any[] => snapshotValueToList(path, readFromCache(path));

const notifyLocalSubscribers = (path: string): void => {
  const list = getCachedList(path);
  const subscribers = localSubscribers.get(path);
  if (!subscribers || subscribers.size === 0) return;
  subscribers.forEach(callback => callback(list));
};

const notifyPathAndParents = (path: string): void => {
  const segments = getPathSegments(path);
  if (segments.length === 0) return;

  for (let i = segments.length; i >= 1; i--) {
    notifyLocalSubscribers(segments.slice(0, i).join('/'));
  }
};

export const dbAdapter = {
  /**
   * Set a document/node at a specific path.
   */
  setDoc: async (path: string, data: any): Promise<void> => {
    let rtdbError: unknown = null;
    try {
      // 1. Write to Realtime Database (Spark plan free tier)
      await set(ref(rtdb, path), data);
    } catch (err) {
      rtdbError = err;
      console.warn(`[RTDB] setDoc failed at ${path}, trying Firestore:`, err);
    }
    // Also sync to Firestore if possible for dual durability
    try {
      const parts = path.split('/');
      if (parts.length % 2 === 0) {
        const docRef = doc(db, parts[0], ...parts.slice(1));
        await fsSetDoc(docRef, data);
      }
    } catch (err) {
      // Firestore missing/quota limit on Spark is safely swallowed
    }

    writeToCache(path, data);
    notifyPathAndParents(path);

    if (rtdbError) {
      return;
    }
  },

  /**
   * Get a document/node at a specific path.
   */
  getDoc: async (path: string): Promise<{ exists: boolean; data: any }> => {
    try {
      const snap = await get(ref(rtdb, path));
      if (snap.exists()) {
        return { exists: true, data: snap.val() };
      }
    } catch (rtdbErr) {
      console.warn(`[RTDB] getDoc failed at ${path}, trying Firestore:`, rtdbErr);
    }

    try {
      const parts = path.split('/');
      if (parts.length % 2 === 0) {
        const docRef = doc(db, parts[0], ...parts.slice(1));
        const fsSnap = await fsGetDoc(docRef);
        if (fsSnap.exists()) {
          return { exists: true, data: fsSnap.data() };
        }
      }
    } catch (fsErr) {
      // Ignore Firestore failure on Spark
    }

    const cached = readFromCache(path);
    if (cached !== undefined) {
      return { exists: true, data: cached };
    }

    return { exists: false, data: null };
  },

  /**
   * Update fields in a document/node.
   */
  updateDoc: async (path: string, updates: any): Promise<void> => {
    let rtdbError: unknown = null;
    try {
      await update(ref(rtdb, path), updates);
    } catch (err) {
      rtdbError = err;
      console.warn(`[RTDB] updateDoc failed at ${path}:`, err);
    }

    try {
      const parts = path.split('/');
      if (parts.length % 2 === 0) {
        const docRef = doc(db, parts[0], ...parts.slice(1));
        await fsUpdateDoc(docRef, updates);
      }
    } catch (err) {
      // Ignore
    }

    mergeIntoCache(path, updates);
    notifyPathAndParents(path);

    if (rtdbError) {
      return;
    }
  },

  /**
   * Delete a node/document.
   */
  deleteDoc: async (path: string): Promise<void> => {
    let rtdbError: unknown = null;
    try {
      await remove(ref(rtdb, path));
    } catch (err) {
      rtdbError = err;
      console.warn(`[RTDB] deleteDoc failed at ${path}:`, err);
    }

    try {
      const parts = path.split('/');
      if (parts.length % 2 === 0) {
        const docRef = doc(db, parts[0], ...parts.slice(1));
        await fsDeleteDoc(docRef);
      }
    } catch (err) {
      // Ignore
    }

    deleteFromCache(path);
    notifyPathAndParents(path);

    if (rtdbError) {
      return;
    }
  },

  /**
   * Push a new auto-keyed node to a collection path.
   */
  pushDoc: async (collectionPath: string, data: any): Promise<string> => {
    const newRef = push(ref(rtdb, collectionPath));
    const key = newRef.key || `id_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fullData = { ...data, id: key };
    let rtdbError: unknown = null;
    try {
      await set(newRef, fullData);
    } catch (err) {
      rtdbError = err;
    }

    try {
      const docRef = doc(db, collectionPath, key);
      await fsSetDoc(docRef, fullData);
    } catch (err) {
    }

    const current = readFromCache(collectionPath);
    const nextCollection = isPlainObject(current) ? { ...current, [key]: cloneValue(fullData) } : { [key]: cloneValue(fullData) };
    writeToCache(collectionPath, nextCollection);
    notifyPathAndParents(collectionPath);

    if (rtdbError) {
      return key;
    }

    return key;
  },

  /**
   * Subscribe to real-time updates for a collection or node path.
   */
  subscribeToPath: (path: string, onUpdate: (dataList: any[]) => void): (() => void) => {
    let unsubscribed = false;

    if (!localSubscribers.has(path)) {
      localSubscribers.set(path, new Set());
    }
    localSubscribers.get(path)!.add(onUpdate);

    const cachedList = getCachedList(path);
    if (cachedList.length > 0) {
      onUpdate(cachedList);
    }

    // Realtime Database listener
    const rtdbRef = ref(rtdb, path);
    const rtdbUnsub = onValue(rtdbRef, (snapshot) => {
      if (unsubscribed) return;
      if (snapshot.exists()) {
        const val = snapshot.val();
        writeToCache(path, val);
        if (typeof val === 'object' && val !== null) {
          const list = Object.keys(val).map(key => ({
            id: key,
            ...(typeof val[key] === 'object' && val[key] !== null ? val[key] : { value: val[key] })
          }));
          onUpdate(list);
        } else {
          onUpdate([{ id: path, value: val }]);
        }
      } else {
        if (cachedList.length > 0) {
          onUpdate(cachedList);
          return;
        }
        onUpdate([]);
      }
    }, (err) => {
      console.warn(`[RTDB] subscribeToPath failed for ${path}, falling back to Firestore listener:`, err);
      // Fallback to Firestore listener if RTDB errors out
      try {
        const parts = path.split('/');
        if (parts.length % 2 === 1) {
          const fsCol = fsCollection(db, parts[0], ...parts.slice(1));
          fsOnSnapshot(fsCol, (snap) => {
            const list: any[] = [];
            snap.forEach(d => list.push({ ...d.data(), id: d.id }));
            onUpdate(list);
          });
        }
      } catch (e) {}
    });

    return () => {
      unsubscribed = true;
      const callbacks = localSubscribers.get(path);
      if (callbacks) {
        callbacks.delete(onUpdate);
        if (callbacks.size === 0) {
          localSubscribers.delete(path);
        }
      }
      rtdbUnsub();
    };
  },

  /**
   * Query items in a collection by child property value.
   */
  getDocsByQuery: async (path: string, childKey: string, equalValue: any): Promise<any[]> => {
    try {
      const q = rtdbQuery(ref(rtdb, path), orderByChild(childKey), equalTo(equalValue));
      const snap = await get(q);
      if (snap.exists()) {
        const val = snap.val();
        return Object.keys(val).map(key => ({ id: key, ...val[key] }));
      }
    } catch (rtdbErr) {
      console.warn(`[RTDB] Query failed for ${path}.${childKey}==${equalValue}:`, rtdbErr);
    }

    const cached = getCachedList(path);
    if (cached.length > 0) {
      return cached.filter(item => item && item[childKey] === equalValue);
    }

    try {
      const parts = path.split('/');
      if (parts.length % 2 === 1) {
        const colRef = fsCollection(db, parts[0], ...parts.slice(1));
        const q = fsQuery(colRef, fsWhere(childKey, '==', equalValue));
        const fsSnap = await fsGetDocs(q);
        const list: any[] = [];
        fsSnap.forEach(docSnap => list.push({ ...docSnap.data(), id: docSnap.id }));
        return list;
      }
    } catch (e) {}

    return [];
  }
};
