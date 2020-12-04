import BaseDataLayer from './base';
import {merge} from '../../helpers/layouts';

const default_layout = {};

class IntervalCanvas extends BaseDataLayer {
    /*
     * @param {Object} layout
     * @param {Object|String} [layout.color]
     * @param {Object[]} layout.filters An array of filter entries specifying which points to draw annotations for.
     */
    constructor(layout) {
        merge(layout, default_layout);
        super(...arguments);
    }

    render() {
        // Add a canvas to the plot and see how it looks
        // https://bl.ocks.org/boeric/aa80b0048b7e39dd71c8fbe958d1b1d4
        var container = this.svg.group.append('foreignObject');
        container
            .attr('width', 100)
            .attr('height', 100);

        const content_body = container.append('xhtml:body')
            .style('margin', '0px')
            .style('padding', '0px')
            .style('background-color', 'none')
            .style('width', `100px`)
            .style('height', '100px')
            .style('border', '1px solid lightgray');

        // Add embedded canvas to embedded body
        const canvas = content_body.append('canvas')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', 100)
            .attr('height', 100);

        const render_context = canvas.node().getContext('2d');

        // FIXME: Saving as PNG fails because blobs taint the canvas: https://stackoverflow.com/a/50857516/1422268
        // But we probably don't want to save this way anyway because SVG also fails- the canvas rendered info isn't saved because we're just duplicating markup
        // Probably the save logic will need to replace a canvas with an "image" tag. Will <dataurl> work for a highly complex image?
        // Dataurls: last documented limit is 2MB in chrome and they recommend blobs otherwise.
        render_context.fillStyle = 'red';
        render_context.fillRect(10, 10, 25, 25);
    }
}

export {IntervalCanvas as default};


// // Get data from object
// let new_data = data.map((item) => {
//     // Find only fields not functions
//     return Object.keys(item).reduce((acc, key) => {
//         if (typeof item[key] !== 'function' && key !== 'parent') {
//             acc[key] = item[key];
//         }
//         return acc;
//     }, {});
// });
