// Blob + File
// blob-polyfill exports Blob + File and they needed to be made global
import { Blob, File, FileReader } from 'blob-polyfill';
Object.assign(globalThis, { Blob, File, FileReader });
