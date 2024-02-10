"use server";

import { KVStore } from "fastly:kv-store";


export async function getLikes() {
  const store = new KVStore('my-app-data');
  const kvValue = (await store.get('likeCount')) ?? null;
  return kvValue != null ? parseInt(await kvValue.text(), 10) : 0;
}

export async function putLikes(value) {
  const store = new KVStore('my-app-data');
  await store.put('likeCount', String(value));
}

export async function incrementLike() {

  let value = await getLikes();
  value = value + 1;
  await putLikes(value);

  return value;
}

export async function updateCart(formData) {
  const productId = formData.get('productId')
  console.log('Added item', productId);
}
