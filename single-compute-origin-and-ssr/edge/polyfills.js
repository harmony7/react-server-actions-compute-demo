// Polyfills currently needed for Fastly Compute

// Blob + File
// blob-polyfill exports Blob + File and they needed to be made global
Object.assign(globalThis, await import('blob-polyfill'));

// FormData
await import('formdata-polyfill');

// Response.prototype.formData
await import('@h7/compute-js-formdata');

// Response.prototype.tee
/** @typedef {(UnderlyingSource<Uint8Array> & {chunks: Uint8Array[]})} ChunkedSource*/

/**
 * @param stream {ReadableStream<Uint8Array>}
 * @returns {ReadableStream<Uint8Array>[2]}
 */
function teeStream(stream) {
  const reader = stream.getReader();

  /** @var {ChunkedSource[]} */
  const sources = Array.from({length: 2}, () => {
    return {
      chunks: [],
      async pull(controller) {
        if (this.chunks.length === 0) {
          const result = await reader.read();
          const value = result.done ? false : result.value;
          for (const source of sources) {
            source.chunks.push(value);
          }
        }
        const entry = this.chunks.shift();
        if (entry === false) {
          controller.close();
          return;
        }
        controller.enqueue(entry);
      },
    };
  });

  return sources.map(source => new ReadableStream(source));
}

ReadableStream.prototype.tee = function() {
  return teeStream(this);
};
