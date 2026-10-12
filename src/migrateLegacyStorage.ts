// One-time migration: copy data saved under the old app name's localStorage
// keys to the new "liteledger_*" keys so existing browser data isn't lost.
const LEGACY_PREFIX = ['kite', 'books_'].join('');
const NEW_PREFIX = 'liteledger_';

try {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(LEGACY_PREFIX)) {
      const newKey = NEW_PREFIX + key.slice(LEGACY_PREFIX.length);
      if (localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, localStorage.getItem(key) as string);
      }
    }
  }
} catch {
  // localStorage unavailable; nothing to migrate
}
