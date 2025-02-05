// Polyfills currently needed for Fastly Compute

// Blob + File
import './blob-polyfill.js';

// FormData
import 'formdata-polyfill';

// Response.prototype.formData()
import '@h7/compute-js-formdata';

// React depends on nonstandard FormData.prototype.forEach
if (FormData.prototype.forEach.length < 2) {
  /**
   * Iterate over all fields
   *
   * @param   {Function}  callback  Executed for each item with parameters (value, name, thisArg)
   * @param   {Object=}   thisArg   `this` context for callback function
   */
  FormData.prototype.forEach = function (callback, thisArg) {
    if (arguments.length < 1) {
      throw new TypeError(`1 argument required, but only ${arguments.length} present.`)
    }
    for (const [name, value] of this.entries()) {
      callback.call(thisArg, value, name, this)
    }
  };
}

// Response.prototype.tee
/** @typedef {(UnderlyingSource<Uint8Array> & {chunks: Uint8Array[]})} ChunkedSource*/

/**
 * @param stream {ReadableStream<Uint8Array>}
 * @returns {ReadableStream<Uint8Array>[2]}
 */
function teeStream(stream) {

  const reader = stream.getReader();

  // These will eventually hold the controllers for the two branches.
  /** @var {ReadableStreamController<Uint8Array> | null}*/
  let branch1Controller = null;
  /** @var {ReadableStreamController<Uint8Array> | null}*/
  let branch2Controller = null;

  // If a chunk arrives before a branch’s controller is ready, we buffer it here.
  /** @var {Uint8Array[]} */
  let branch1Queue = [];
  /** @var {Uint8Array[]} */
  let branch2Queue = [];

  // Cancellation flags.
  let canceled1 = false;
  let canceled2 = false;

  // Make sure we start pumping only once.
  let pumpingStarted = false;
  let storedError;

  // When a branch starts, if we already have buffered data, flush it.
  /**
   * @param controller {ReadableStreamController<Uint8Array>}
   * @param queue {Uint8Array[]}
   * */
  function flushQueue(controller, queue) {
    while (queue.length > 0) {
      controller.enqueue(queue.shift());
    }
  }

  // Read from the original stream and distribute chunks.
  function pump() {
    // If both branches have canceled, there’s nothing more to do.
    if (canceled1 && canceled2) {
      return;
    }

    reader.read().then(({ done, value }) => {
      if (done) {
        if (!canceled1 && branch1Controller) {
          branch1Controller.close();
        }
        if (!canceled2 && branch2Controller) {
          branch2Controller.close();
        }
        return;
      }
      // Send the chunk to branch 1.
      if (!canceled1) {
        if (branch1Controller) {
          branch1Controller.enqueue(value);
        } else {
          branch1Queue.push(value);
        }
      }
      // And to branch 2.
      if (!canceled2) {
        if (branch2Controller) {
          branch2Controller.enqueue(value);
        } else {
          branch2Queue.push(value);
        }
      }
      // Pump the next chunk.
      pump();
    }).catch((err) => {
      storedError = err;
      if (!canceled1 && branch1Controller) {
        branch1Controller.error(err);
      }
      if (!canceled2 && branch2Controller) {
        branch2Controller.error(err);
      }
    });
  }

  // Start the pumping process (only once).
  function startPump() {
    if (!pumpingStarted) {
      pumpingStarted = true;
      pump();
    }
  }

  // Create the first branch.
  const branch1 = new ReadableStream({
    start(controller) {
      branch1Controller = controller;
      // If an error has already occurred, immediately error this branch.
      if (storedError !== undefined) {
        controller.error(storedError);
        return;
      }
      flushQueue(controller, branch1Queue);
      startPump();
    },
    cancel(reason) {
      canceled1 = true;
      // Only cancel the underlying reader if both branches are canceled.
      if (canceled2) {
        return reader.cancel(reason);
      }
      return Promise.resolve();
    }
  });

  // Create the second branch.
  const branch2 = new ReadableStream({
    start(controller) {
      branch2Controller = controller;
      if (storedError !== undefined) {
        controller.error(storedError);
        return;
      }
      flushQueue(controller, branch2Queue);
      startPump();
    },
    cancel(reason) {
      canceled2 = true;
      if (canceled1) {
        return reader.cancel(reason);
      }
      return Promise.resolve();
    }
  });

  return [branch1, branch2];
}

ReadableStream.prototype.tee = function() {
  // It is an error to tee a locked stream.
  if (this.locked) {
    throw new TypeError("Cannot tee a locked stream");
  }
  return teeStream(this);
};
