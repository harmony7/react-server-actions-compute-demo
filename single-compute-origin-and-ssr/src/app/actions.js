'use server';

import { setServerState } from './ServerState.js';

export async function like() {
  await setServerState('Liked!');
  return new Promise((resolve, reject) => resolve('Liked'));
}

export async function greet(formData) {
  const name = formData.get('name') || 'you';
  await setServerState('Hi ' + name);
  const file = formData.get('file');
  if (file) {
    return `Ok, ${name}, here is ${file.name}:
      ${(await file.text()).toUpperCase()}
    `;
  }
  return 'Hi ' + name + '!';
}

export async function increment(n) {
  return n + 1;
}
