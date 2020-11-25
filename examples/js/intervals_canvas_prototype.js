'use strict';
/* global d3 */

// A simple prototype of drawing the intervals track via canvas rendering

const keyfield = 'intervals_1606149097681_13_src:state_name';
const start_field = 'intervals_1606149097681_13_src:start';
const end_field = 'intervals_1606149097681_13_src:end';
const color_field = 'intervals_1606149097681_13_src:itemRgb';

const REGION_START = 21940000;
const REGION_END = 22190000;


function _detectHit(grouped_data, x, y) {
    // Detect whether a given item overlaps a given interval
    y = Math.floor(y);
    const search_row = grouped_data[y];
    if (!search_row) {
        return null;
    }

    for (let i = 0; i < search_row.length; i++) {
        const item = search_row[i];
        if (item[start_field] <= x && item[end_field] >= x) {
            return item;
        }
    }
}


function _arrangeTrackSplit(data) {
    // Split data into tracks such that anything with a common grouping field is in the same track
    const result = {};
    data.forEach((item) => {
        const item_key = item[keyfield];
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
    data.sort((a, b) => a[start_field] - b[start_field]);

    const grouped_data = [[]]; // Prevent two items from colliding by rendering them to different rows, like genes
    data.forEach((item, index) => {
        for (let i = 0; i < grouped_data.length; i++) {
            // Iterate over all rows of the
            const row_to_test = grouped_data[i];
            const last_item = row_to_test[row_to_test.length - 1];
            const has_overlap = last_item && (item[start_field] <= last_item[end_field]) && (last_item[start_field] <= item[end_field]);
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


/**
 * Draw the intervals track in a canvas
 * @param selector_id
 * @param data
 * @param split_tracks
 */
// eslint-disable-next-line no-unused-vars
function draw_intervals(selector_id, data, split_tracks = true) {
    const canvas = document.getElementById(selector_id);
    const context = canvas.getContext('2d');

    let grouped_data = split_tracks ? _arrangeTrackSplit(data) : _arrangeTracksLinear(data);
    const n_rows = grouped_data.length;

    const ROW_HEIGHT = 10;
    const ROW_SPACING = 5;

    const target_height = n_rows * ROW_HEIGHT + (n_rows + 1) * ROW_SPACING;
    // Set scales
    const x_scale = d3.scaleLinear()
        .domain([REGION_START, REGION_END])
        .range([0, canvas.width]);

    const y_scale = d3.scaleLinear()
        .domain([0, n_rows])
        .range([0, target_height]);

    // Rescale canvas to accommodate the data. Adjust for high res on retina screens
    const scale = window.devicePixelRatio; // Change to 1 on retina screens to see blurry canvas.
    canvas.style.width = `800px`;
    canvas.style.height = `${target_height}px`;

    canvas.width = Math.floor(800 * scale);
    canvas.height = Math.floor(target_height * scale);

    // Normalize coordinate system to use css pixels.
    context.scale(scale, scale);

    canvas.height = target_height;
    context.clearRect(0, 0, canvas.width, canvas.height);

    grouped_data.forEach((group, row_index) => {
        group.forEach((item) => {
            context.fillStyle = `rgb(${item[color_field]})`;
            context.fillRect(
                x_scale(item[start_field]),
                y_scale(row_index) + ROW_SPACING,
                x_scale(item[end_field]) - x_scale(item[start_field]),
                ROW_HEIGHT
            );
        });
    });

    canvas.addEventListener('mousemove', (event) => {
        const {offsetX: x, offsetY: y} = event;
        // Convert the x and y coordinates to data x and y
        const dataX = x_scale.invert(x);
        const dataY = y_scale.invert(y - ROW_SPACING);

        const hit_data = _detectHit(grouped_data, dataX, dataY);
        console.log('hit found!', hit_data);
    });
}
