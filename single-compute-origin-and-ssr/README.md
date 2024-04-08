## React Server Components with a Single Fastly Compute service

This example illustrates setting up React 19 for React Server Components
using a single Fastly Compute service for both the origin and SSR roles. 

1. Single edge app ("global" + "region" in flight demo)
   * Responds to GET and RSC (POST)
     * Uses client manifest and server manifests to render the app
     * Generates a flight stream
     * If accept is for text/html then renders flight stream to html (SSR Bundle)
       * (SSR Manifest not needed for Edge because entire bundle is loaded already)
       * (Entrypoint Manifest is needed to tell SSR client where JS files are)
   * Responds to API endpoints
   * Serves public (/app/) files

2. Client app
   * This is the client bundle
   * Hydrates based on flight stream

This application builds three bundles that corresponds to each of the roles.
All files under the `src/` directory are bundled. The entry points of each bundle
are found at `src/entry.<role>.js`.
* The client bundle needs to be built for shipping the React application
   to the browser and to apply the React Server Components plugin for Webpack.
* The origin and SSR bundles are separately required because each bundle
   is built using different conditions (named exports).

The demo uses the `@h7/compute-js-rsc` npm package which wraps some common React
patterns used in React Server Components and groups them by role, as well as
provides some Webpack plugins that are used to build the application.
