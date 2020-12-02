'use strict';
/* global d3 */

// A simple prototype of drawing the intervals track via canvas rendering

const KEY_FIELD = 'intervals_1606149097681_13_src:state_name';
const START_FIELD = 'intervals_1606149097681_13_src:start';
const END_FIELD = 'intervals_1606149097681_13_src:end';
const COLOR_FIELD = 'intervals_1606149097681_13_src:itemRgb';

const REGION_START = 21940000;
const REGION_END = 22190000;

// Layout options
const ROW_HEIGHT = 10;
const ROW_SPACING = 5;
const HITAREA_SIZE = 3;

// Coordinates (start, end) are cached to facilitate hit detection
const XCS = Symbol.for('lzXCS');
const YCS = Symbol.for('lzYCS');
const XCE = Symbol.for('lzXCE');
const YCE = Symbol.for('lzYCE');

function _detectHit(grouped_data, x, y) {
    // Detect whether a given item overlaps a given interval
    let search_row;
    for (let i = 0; i < grouped_data.length; i++) {
        // All y values are the same for a given row, so we only need to compare y coords to the first item
        const row = grouped_data[i];
        const item = row[0];
        if (item[YCS] <= y && item[YCE] >= y) {
            search_row = row;
            break;
        }
    }

    if (!search_row) {
        return null;
    }

    for (let i = 0; i < search_row.length; i++) {
        // Once we've found a row, scan all items and return the first one that overlaps the mouse position.
        const item = search_row[i];
        if (item[XCS] <= x && item[XCE] >= x) {
            return item;
        }
    }
    return null;
}


function _arrangeTrackSplit(data) {
    // Split data into tracks such that anything with a common grouping field is in the same track
    const result = {};
    data.forEach((item) => {
        const item_key = item[KEY_FIELD];
        if (!Object.prototype.hasOwnProperty.call(result, item_key)) {
            result[item_key] = [];
        }
        result[item_key].push(item);
    });
    return Object.values(result);
}


function _arrangeTracksLinear(data) {
    // Split data into tracks using a simple greedy algorithm such that no two items overlap (share same interval)
    // Assumes that the data are sorted so item1.start always <= item2.start.

    // Data is sorted by start position to facilitate grouping
    data.sort((a, b) => a[START_FIELD] - b[START_FIELD]);

    const grouped_data = [[]]; // Prevent two items from colliding by rendering them to different rows, like genes
    data.forEach((item, index) => {
        for (let i = 0; i < grouped_data.length; i++) {
            // Iterate over all rows of the
            const row_to_test = grouped_data[i];
            const last_item = row_to_test[row_to_test.length - 1];
            const has_overlap = last_item && (item[START_FIELD] <= last_item[END_FIELD]) && (last_item[START_FIELD] <= item[END_FIELD]);
            if (!has_overlap) {
                // If there is no overlap, add item to current row, and move on to the next item
                row_to_test.push(item);
                return;
            }
        }
        // If this item would collide on all existing rows, create a new row
        grouped_data.push([item]);
    });
    return grouped_data;
}


// eslint-disable-next-line no-unused-vars
class IntervalPlot {
    constructor(selector_id, data, split_tracks = true) {
        this.canvas = document.getElementById(selector_id);
        this.context = this.canvas.getContext('2d');

        this.data = data;

        this.split_tracks = split_tracks;
    }

    render() {
        const { data, canvas, context } = this;

        let grouped_data = this.split_tracks ? _arrangeTrackSplit(data) : _arrangeTracksLinear(data);
        const n_rows = grouped_data.length;
        const target_height = n_rows * ROW_HEIGHT + (n_rows + 1) * ROW_SPACING;

        // Set scales
        const x_scale = d3.scaleLinear()
            .domain([REGION_START, REGION_END])
            .range([0, canvas.width]);

        const y_scale = d3.scaleLinear()
            .domain([0, n_rows])
            .range([0, target_height]);

        // Rescale canvas to fit the data. Adjust for high res on retina screens
        // Auto-scaling is disabled for now, because some datasets have too many rows for FF.
        // See: https://bugzilla.mozilla.org/show_bug.cgi?id=1485730
        const scale = 1; // window.devicePixelRatio;
        canvas.style.width = `800px`;
        canvas.style.height = `${target_height}px`;

        canvas.width = Math.floor(800 * scale);
        canvas.height = Math.floor(target_height * scale);

        // Normalize coordinate system to use css pixels.
        context.scale(scale, scale);

        canvas.height = target_height;
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Iterate through the data and render it
        grouped_data.forEach((group, row_index) => {
            group.forEach((item) => {
                // Prior to rendering, cache the x/y coords so they can be used later for hit detection
                item[XCS] = x_scale(item[START_FIELD]);
                item[XCE] = x_scale(item[END_FIELD]);
                item[YCS] = y_scale(row_index) + ROW_SPACING; // TODO: this one is the problem
                item[YCE] = item[YCS] + ROW_HEIGHT;
                this._render_row(item);
            });
        });

        // One mousemove event listener for entire canvas
        let last_hit = {};
        canvas.addEventListener('mousemove', (event) => {
            const {offsetX: x, offsetY: y} = event;
            const hit_data = _detectHit(grouped_data, x, y);

            if (hit_data && last_hit[KEY_FIELD] !== hit_data[KEY_FIELD]) {
                // Deduplicate events by only warning on unique ones
                last_hit = hit_data;
                console.log('hit found!', hit_data);
            }
        });
    }

    _render_row(item) {
        const { context } = this;
        context.fillStyle = `rgb(${item[COLOR_FIELD]})`;
        context.fillRect(
            item[XCS],
            item[YCS],
            item[XCE] - item[XCS],
            ROW_HEIGHT
        );
    }

    // Returns null or the data object for the given row
    detect_hit(grouped_data, x, y) {
        // First find the row where it matches
        let target_row;
        for (let i = 0; i < grouped_data.length; i++) {
            const first_item = grouped_data[i][0]; // all items in a row have the same y coordinates by definition
            if (first_item[YCS] <= y && first_item[YCE] >= y) {
                target_row = grouped_data[i];
                break;
            }
        }
        if (!target_row) {
            return null;
        }

        // Allow hit regions to be slightly wider than the box, rightmost element "wins" analogous to svg
        // TODO: implement hit areas. Make sure that the "almost match" does not override a true "best match"
        for (let i = target_row.length - 1; i >= 0; i--) {
            const item = target_row[i];
            if (item[XCS] <= x && item[XCE] >= x) {
                return item;
            }
        }
        // If no match found, explicitly return null
        return null;
    }
}
