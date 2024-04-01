Object.assign(globalThis, await import('blob-polyfill'));
await import('formdata-polyfill');
await import('@h7/compute-js-formdata');
