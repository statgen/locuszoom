/**
 Helper functions targeted at rendering operations
*/

/**
 * Coalesce a large array of points based on available screen space
 *  Rules:
 *   - Only coalesce points for which the (x|y) values are BOTH inside the specified bounds
 *       AND when the points are close together (distance between the (x|y) min/max coordinates is <= the specified gap)
 *   - Always add nodes that are flagged "of interest" (eg lz_highlight_match = true) (TODO)
 *   - Always add points that are outside the "region to coalesce" (eg, variants above the line of GWAS significance
 *     are biologically interesting; render them all!)
 */
function coalesce_points(coords, x_field, y_field, xgap, xmin, xmax, ygap, ymin, ymax, make_point) {
    function _bbox_fits_all(c_min, c_max, gap_max) {
        // Does the combination of points create a region of max size = gap?
        return (c_max - c_min) <= gap_max;
    }
    function _in_bounds(c, region_min, region_max) {
        return c >= region_min && c <= region_max;
    }

    make_point = make_point || function (item, xvalue, yvalue, weight) {
        item = {}; // Default function ignores prior data
        if (weight !== 1) {
            item.lz_weight = weight;
        }
        item[x_field] = xvalue;
        item[y_field] = yvalue;
        return item;
    };

    var new_coords = [];
    if (!coords.length) {
        return new_coords;
    }

    // Accumulators: track "combination of n nearby points"
    var x_low, x_high, x_sum, y_low, y_high, y_sum, lz_weight;
    x_sum = y_sum = lz_weight = 0;
    var pushed_item = true;
    coords.forEach(function (item) {
        var current_x = item[x_field];
        var current_y = item[y_field];
        if (pushed_item) {
            // Reset the accumulators to start a bounding box at the current value
            x_sum = y_sum = 0;
            x_low = x_high = current_x;
            y_low = y_high = current_y;
            lz_weight = 0;
        }

        // In order to decide whether this point can be coalesced with previous, we need to update the bounding box
        //  formed by all known points
        x_low = Math.min(x_low, current_x);
        x_high = Math.max(x_high, current_x);
        y_low = Math.min(y_low, current_y);
        y_high = Math.max(y_high, current_y);

        // If the current point is not significant: ask if it can be coalesced with the previous point.
        // If not, flush the previous point, and reset the accumulators to use this new value as a starting point.
        var flush_acc = false;
        var flush_current = false;
        var is_significant = !_in_bounds(current_x, xmin, xmax) || !_in_bounds(current_y, ymin, ymax);
        if (!is_significant) {
            var bbox_ok = _bbox_fits_all(x_low, x_high, xgap) && _bbox_fits_all(y_low, y_high, ygap);
            if (bbox_ok) {
                x_sum += current_x;
                y_sum += current_y;
                lz_weight += 1;
                pushed_item = false;
            } else {
                // For an insignificant point that can't be coalesced: the accumulators should be based on this item
                //  (not the next pass of loop; TODO DRY similar code)
                flush_acc = true;
            }
        } else {
            // If the current point is significant by itself: 1) flush any existing accumulators, and 2) push that item
            // In this cas the accumulators are based on the next point
            flush_acc = flush_current = true;
            pushed_item = true;
        }

        if (flush_acc) {
            var last_item = make_point(item, x_sum / lz_weight, y_sum / lz_weight, lz_weight);
            new_coords.push(last_item);
            x_sum = x_low = x_high = current_x;
            y_sum = y_low = y_high = current_y;
            lz_weight = 1;
        }
        if (flush_current) {
            new_coords.push(item);
            pushed_item = true;
        }
    });

    if (!pushed_item) { // Finish whatever we were accumulating and push it
        new_coords.push(make_point(coords[coords.length - 1], x_sum / lz_weight, y_sum / lz_weight, lz_weight));
    }
    return new_coords;
}

export { coalesce_points };
