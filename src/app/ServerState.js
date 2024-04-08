'use server';

import { KVStore } from 'fastly:kv-store';

export async function setServerState(message) {
  const store = new KVStore('my-app-data');
  await store.put('serverState', String(message));
}

export async function getServerState() {
  const store = new KVStore('my-app-data');
  const kvValue = (await store.get('serverState')) ?? null;
  return kvValue != null ? await kvValue.text() : 'Hello, World!';
}
