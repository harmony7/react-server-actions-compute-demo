/*
 * Copyright Fastly, Inc.
 * Licensed under the MIT license. See LICENSE file for details.
 */

/** @type {import('@fastly/compute-js-static-publish').StaticPublisherConfig} */
module.exports = {
  rootDir: './',
  staticContentRootDir: './static-content/',
  excludeDirs: [ './node_modules', ],
  moduleAssetInclusionTest: function(path) {
    return false;
  },
  contentAssetInclusionTest: function(path) {
    if (path.startsWith('/build/')) { return true; }
    return false;
  }
};
