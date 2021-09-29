/**
 * Parsers for handling common file formats used by LocusZoom plots. Each parser is intended to be used on one line of
 *  text from the specified file.
 * @module
 */

import makeUcscBedParser from './lz-parsers/bed';

// // Slight build quirk: we use a single webpack config for all modules, but `libraryTarget` expects the entire
// //  module to be exported as `default` in <script> tag mode.
const all = { makeUcscBedParser };

export default all;
