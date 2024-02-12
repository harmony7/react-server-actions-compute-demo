const rscClient = require('@h7/compute-js-rsc/client');

// * CLIENT *
// Hydrate the app. This process uses the flight data in a script tag in the HTML,
// or if it's not present, makes a call to the flight endpoint to obtain it.

// noinspection JSIgnoredPromiseFromCall
rscClient.hydrateApp();
