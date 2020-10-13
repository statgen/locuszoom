/**
 Helper functions targeted at rendering operations
*/


/**
 * A very simple function aimed at scatter plots: attempts to coalesce "low-significance" SNPs that are too close to
 *  visually distinguish, thus creating a dataset with fewer points that can be rendered more quickly.
 *
 *  This depends on the strong and explicit assumption that points are ordered (typically in x position), so that
 *    nearby points can be grouped by iterating over the data in sequence.
 *
 * @param {Object[]} data Plot data, annotated with calculated `xc` and `yc` symbols for x and y coordinates (in px).
 * @param {Number} x_min The smallest x value of an "insignificant region" rectangle
 * @param {Number} x_max The largest x value of an "insignificant region" rectangle
 * @param {Number} x_gap Max px distance, in x direction, from the first point in a set, to qualify for grouping
 * @param {Number} y_min The smallest y value of an "insignificant region" rectangle
 * @param {Number} y_max The largest y value of an "insignificant region" rectangle
 * @param {Number} y_gap Max px distance, in y direction, from the first point in a set, to qualify for grouping
 * @return {Object[]} The simplified dataset with fewer points
 */
function coalesce_scatter_points (data, x_min, x_max, x_gap, y_min, y_max, y_gap) {
    let final_data = [];

    const xcs = Symbol.for('lzX');
    const ycs = Symbol.for('lzY');

    let x_start = null;
    let y_start = null;
    let current_group = [];

    function _combine () {
        if (current_group.length) {
            // If there are points near each other, return the middle item to represent the group
            // We use a real point (rather than a synthetic average point) to best handle extra fields
            const item = current_group[Math.floor((current_group.length - 1) / 2)];
            final_data.push(item);
        }
        x_start = y_start = null;
        current_group = [];
    }

    function _start_run(x, y, item) {
        x_start = x;
        y_start = y;
        current_group.push(item);
    }

    data.forEach((item) => {
        const x = item[xcs];
        const y = item[ycs];

        const in_combine_region = (x >= x_min && x <= x_max && y >= y_min && y <= y_max);
        if (item.lz_highlight_match || !in_combine_region) {
            // If an item is marked as interesting in some way, always render it explicitly
            // (and coalesce the preceding points if a run was in progress, to preserve ordering)
            _combine();
            final_data.push(item);
        } else if (x_start === null) {
            // If not tracking a group, start tracking
            _start_run(x, y, item);
        } else {
            // Otherwise, the decision to render the point depends on whether it is close to a run of other
            //  insignificant points
            const near_prior = Math.abs(x - x_start) <= x_gap && Math.abs(y - y_start) <= y_gap;

            if (near_prior) {
                current_group.push(item);
            } else {
                // "if in combine region, and not near a prior point, coalesce all prior items, then track this point
                //  as part of the next run that could be grouped"
                _combine();
                _start_run(x, y, item);
            }
        }
    });
    // At the end of the dataset, check whether any runs of adjacent points were in progress, and coalesce if so
    _combine();

    return final_data;
}

export { coalesce_scatter_points };
