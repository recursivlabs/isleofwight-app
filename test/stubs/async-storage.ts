// In-memory AsyncStorage stub for unit tests.
const mem = new Map<string, string>();
export default {
  getItem: async (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: async (k: string, v: string) => { mem.set(k, v); },
  removeItem: async (k: string) => { mem.delete(k); },
  clear: async () => { mem.clear(); },
};
