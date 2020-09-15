/** @module */
import * as d3 from 'd3';

import BaseDataLayer from './base';
import {merge} from '../../helpers/layouts';

const default_layout = {
    // Optionally specify different fill and stroke properties
    stroke: 'rgb(54, 54, 150)',
    color: '#363696',
    label_font_size: 12,
    label_exon_spacing: 3,
    exon_height: 10,
    bounding_box_padding: 3,
    track_vertical_spacing: 5,
    tooltip_positioning: 'top',
};


/*********************
 * Genes Data Layer
 * Implements a data layer that will render gene tracks
*/
class Genes extends BaseDataLayer {
    constructor(layout) {
        layout = merge(layout, default_layout);
        super(...arguments);
        /**
         * A gene may have arbitrarily many transcripts, but this data layer isn't set up to render them yet.
         * Stash a transcript_idx to point to the first transcript and use that for all transcript refs.
         * @member {number}
         * @type {number}
         */
        this.transcript_idx = 0;

        /**
         * An internal counter for the number of tracks in the data layer. Used as an internal counter for looping
         *   over positions / assignments
         * @protected
         * @member {number}
         */
        this.tracks = 1;

        /**
         * Store information about genes in dataset, in a hash indexed by track number: {track_number: [gene_indices]}
         * @member {Object.<Number, Array>}
         */
        this.gene_track_index = { 1: [] };
    }

    /**
     * Generate a statusnode ID for a given element
     * @override
     * @returns {String}
     */
    getElementStatusNodeId(element) {
        return `${this.getElementId(element)}-statusnode`;
    }

    /**
     * Helper function to sum layout values to derive total height for a single gene track
     * @returns {number}
     */
    getTrackHeight() {
        return 2 * this.layout.bounding_box_padding
            + this.layout.label_font_size
            + this.layout.label_exon_spacing
            + this.layout.exon_height
            + this.layout.track_vertical_spacing;
    }

    /**
     * Ensure that genes in overlapping chromosome regions are positioned so that parts of different genes do not
     *   overlap in the view. A track is a row used to vertically separate overlapping genes.
     * @returns {Genes}
     */
    assignTracks(data) {
        /**
         * Function to get the width in pixels of a label given the text and layout attributes
         * @param {String} gene_name
         * @param {number|string} font_size
         * @returns {number}
         */
        const _getLabelWidth = (gene_name, font_size) => {
            try {
                const temp_text = this.svg.group.append('text')
                    .attr('x', 0)
                    .attr('y', 0)
                    .attr('class', 'lz-data_layer-genes lz-label')
                    .style('font-size', font_size)
                    .text(`${gene_name}→`);
                const label_width = temp_text.node().getBBox().width;
                temp_text.remove();
                return label_width;
            } catch (e) {
                return 0;
            }
        };

        // Reinitialize some metadata
        this.tracks = 1;
        this.gene_track_index = { 1: [] };

        data.map((item) => {
            // If necessary, split combined gene id / version fields into discrete fields.
            // NOTE: this may be an issue with CSG's genes data source that may eventually be solved upstream.
            if (item.gene_id && item.gene_id.indexOf('.')) {
                const split = item.gene_id.split('.');
                item.gene_id = split[0];
                item.gene_version = split[1];
            }

            // Stash the transcript ID on the parent gene
            item.transcript_id = item.transcripts[this.transcript_idx].transcript_id;

            // Determine display range start and end, based on minimum allowable gene display width, bounded by what we can see
            // (range: values in terms of pixels on the screen)
            item.display_range = {
                start: this.parent.x_scale(Math.max(item.start, this.state.start)),
                end:   this.parent.x_scale(Math.min(item.end, this.state.end)),
            };
            item.display_range.label_width = _getLabelWidth(item.gene_name, this.layout.label_font_size);
            item.display_range.width = item.display_range.end - item.display_range.start;
            // Determine label text anchor (default to middle)
            item.display_range.text_anchor = 'middle';
            if (item.display_range.width < item.display_range.label_width) {
                if (item.start < this.state.start) {
                    item.display_range.end = item.display_range.start
                        + item.display_range.label_width
                        + this.layout.label_font_size;
                    item.display_range.text_anchor = 'start';
                } else if (item.end > this.state.end) {
                    item.display_range.start = item.display_range.end
                        - item.display_range.label_width
                        - this.layout.label_font_size;
                    item.display_range.text_anchor = 'end';
                } else {
                    const centered_margin = ((item.display_range.label_width - item.display_range.width) / 2)
                        + this.layout.label_font_size;
                    if ((item.display_range.start - centered_margin) < this.parent.x_scale(this.state.start)) {
                        item.display_range.start = this.parent.x_scale(this.state.start);
                        item.display_range.end = item.display_range.start + item.display_range.label_width;
                        item.display_range.text_anchor = 'start';
                    } else if ((item.display_range.end + centered_margin) > this.parent.x_scale(this.state.end)) {
                        item.display_range.end = this.parent.x_scale(this.state.end);
                        item.display_range.start = item.display_range.end - item.display_range.label_width;
                        item.display_range.text_anchor = 'end';
                    } else {
                        item.display_range.start -= centered_margin;
                        item.display_range.end += centered_margin;
                    }
                }
                item.display_range.width = item.display_range.end - item.display_range.start;
            }
            // Add bounding box padding to the calculated display range start, end, and width
            item.display_range.start -= this.layout.bounding_box_padding;
            item.display_range.end   += this.layout.bounding_box_padding;
            item.display_range.width += 2 * this.layout.bounding_box_padding;
            // Convert and stash display range values into domain values
            // (domain: values in terms of the data set, e.g. megabases)
            item.display_domain = {
                start: this.parent.x_scale.invert(item.display_range.start),
                end:   this.parent.x_scale.invert(item.display_range.end),
            };
            item.display_domain.width = item.display_domain.end - item.display_domain.start;

            // Using display range/domain data generated above cast each gene to tracks such that none overlap
            item.track = null;
            let potential_track = 1;
            while (item.track === null) {
                let collision_on_potential_track = false;
                this.gene_track_index[potential_track].map((placed_gene) => {
                    if (!collision_on_potential_track) {
                        const min_start = Math.min(placed_gene.display_range.start, item.display_range.start);
                        const max_end = Math.max(placed_gene.display_range.end, item.display_range.end);
                        if ((max_end - min_start) < (placed_gene.display_range.width + item.display_range.width)) {
                            collision_on_potential_track = true;
                        }
                    }
                });
                if (!collision_on_potential_track) {
                    item.track = potential_track;
                    this.gene_track_index[potential_track].push(item);
                } else {
                    potential_track++;
                    if (potential_track > this.tracks) {
                        this.tracks = potential_track;
                        this.gene_track_index[potential_track] = [];
                    }
                }
            }

            // Stash parent references on all genes, transcripts, and exons
            item.parent = this;
            item.transcripts.map((d, t) => {
                item.transcripts[t].parent = item;
                item.transcripts[t].exons.map((d, e) => item.transcripts[t].exons[e].parent = item.transcripts[t]);
            });
        });
        return this;
    }

    /**
     * Main render function
     */
    render() {
        const self = this;
        // Apply filters to only render a specified set of points
        const track_data = this._applyFilters();
        this.assignTracks(track_data);
        let height;

        // Render gene groups
        const selection = this.svg.group.selectAll('g.lz-data_layer-genes')
            .data(track_data, (d) => d.gene_name);

        selection.enter()
            .append('g')
            .attr('class', 'lz-data_layer-genes')
            .merge(selection)
            .attr('id', (d) => this.getElementId(d))
            .each(function(gene) {
                const data_layer = gene.parent;

                // Render gene bounding boxes (status nodes to show selected/highlighted)
                const bboxes = d3.select(this).selectAll('rect.lz-data_layer-genes.lz-data_layer-genes-statusnode')
                    .data([gene], (d) => data_layer.getElementStatusNodeId(d));

                height = data_layer.getTrackHeight() - data_layer.layout.track_vertical_spacing;

                bboxes.enter()
                    .append('rect')
                    .attr('class', 'lz-data_layer-genes lz-data_layer-genes-statusnode')
                    .merge(bboxes)
                    .attr('id', (d) => data_layer.getElementStatusNodeId(d))
                    .attr('rx', data_layer.layout.bounding_box_padding)
                    .attr('ry', data_layer.layout.bounding_box_padding)
                    .attr('width', (d) => d.display_range.width)
                    .attr('height', height)
                    .attr('x', (d) => d.display_range.start)
                    .attr('y', (d) => ((d.track - 1) * data_layer.getTrackHeight()));

                bboxes.exit()
                    .remove();

                // Render gene boundaries
                const boundaries = d3.select(this).selectAll('rect.lz-data_layer-genes.lz-boundary')
                    .data([gene], (d) => `${d.gene_name}_boundary`);

                height = 1;
                boundaries.enter()
                    .append('rect')
                    .attr('class', 'lz-data_layer-genes lz-boundary')
                    .merge(boundaries)
                    .attr('width', (d) => data_layer.parent.x_scale(d.end) - data_layer.parent.x_scale(d.start))
                    .attr('height', height)
                    .attr('x', (d) => data_layer.parent.x_scale(d.start))
                    .attr('y', (d) => {
                        return ((d.track - 1) * data_layer.getTrackHeight())
                            + data_layer.layout.bounding_box_padding
                            + data_layer.layout.label_font_size
                            + data_layer.layout.label_exon_spacing
                            + (Math.max(data_layer.layout.exon_height, 3) / 2);
                    })
                    .style('fill', (d, i) => self.resolveScalableParameter(self.layout.color, d, i))
                    .style('stroke', (d, i) => self.resolveScalableParameter(self.layout.stroke, d, i));

                boundaries.exit()
                    .remove();

                // Render gene labels
                const labels = d3.select(this).selectAll('text.lz-data_layer-genes.lz-label')
                    .data([gene], (d) => `${d.gene_name}_label`);

                labels.enter()
                    .append('text')
                    .attr('class', 'lz-data_layer-genes lz-label')
                    .merge(labels)
                    .attr('text-anchor', (d) => d.display_range.text_anchor)
                    .text((d) => (d.strand === '+') ? `${d.gene_name}→` : `←${d.gene_name}`)
                    .style('font-size', gene.parent.layout.label_font_size)
                    .attr('x', (d) => {
                        if (d.display_range.text_anchor === 'middle') {
                            return d.display_range.start + (d.display_range.width / 2);
                        } else if (d.display_range.text_anchor === 'start') {
                            return d.display_range.start + data_layer.layout.bounding_box_padding;
                        } else if (d.display_range.text_anchor === 'end') {
                            return d.display_range.end - data_layer.layout.bounding_box_padding;
                        }
                    })
                    .attr('y', (d) => ((d.track - 1) * data_layer.getTrackHeight())
                        + data_layer.layout.bounding_box_padding
                        + data_layer.layout.label_font_size
                    );

                labels.exit()
                    .remove();

                // Render exon rects (first transcript only, for now)
                // Exons: by default color on gene properties for consistency with the gene boundary track- hence color uses d.parent.parent
                const exons = d3.select(this).selectAll('rect.lz-data_layer-genes.lz-exon')
                    .data(gene.transcripts[gene.parent.transcript_idx].exons, (d) => d.exon_id);

                height = data_layer.layout.exon_height;

                exons.enter()
                    .append('rect')
                    .attr('class', 'lz-data_layer-genes lz-exon')
                    .merge(exons)
                    .style('fill', (d, i) => self.resolveScalableParameter(self.layout.color, d.parent.parent, i))
                    .style('stroke', (d, i) => self.resolveScalableParameter(self.layout.stroke, d.parent.parent, i))
                    .attr('width', (d) => data_layer.parent.x_scale(d.end) - data_layer.parent.x_scale(d.start))
                    .attr('height', height)
                    .attr('x', (d) => data_layer.parent.x_scale(d.start))
                    .attr('y', () => {
                        return ((gene.track - 1) * data_layer.getTrackHeight())
                            + data_layer.layout.bounding_box_padding
                            + data_layer.layout.label_font_size
                            + data_layer.layout.label_exon_spacing;
                    });

                exons.exit()
                    .remove();

                // Render gene click area
                const clickareas = d3.select(this).selectAll('rect.lz-data_layer-genes.lz-clickarea')
                    .data([gene], (d) => `${d.gene_name}_clickarea`);

                height = data_layer.getTrackHeight() - data_layer.layout.track_vertical_spacing;
                clickareas.enter()
                    .append('rect')
                    .attr('class', 'lz-data_layer-genes lz-clickarea')
                    .merge(clickareas)
                    .attr('id', (d) => `${data_layer.getElementId(d)}_clickarea`)
                    .attr('rx', data_layer.layout.bounding_box_padding)
                    .attr('ry', data_layer.layout.bounding_box_padding)
                    .attr('width', (d) => d.display_range.width)
                    .attr('height', height)
                    .attr('x', (d) => d.display_range.start)
                    .attr('y', (d) => ((d.track - 1) * data_layer.getTrackHeight()));

                // Remove old clickareas as needed
                clickareas.exit()
                    .remove();
            });

        // Remove old elements as needed
        selection.exit()
            .remove();

        // Apply mouse behaviors & events to clickareas
        this.svg.group
            .on('click.event_emitter', (element) => this.parent.emit('element_clicked', element, true))
            .call(this.applyBehaviors.bind(this));
    }

    _getTooltipPosition(tooltip) {
        const gene_bbox_id = this.getElementStatusNodeId(tooltip.data);
        const gene_bbox = d3.select(`#${gene_bbox_id}`).node().getBBox();
        return {
            x_min: this.parent.x_scale(tooltip.data.start),
            x_max: this.parent.x_scale(tooltip.data.end),
            y_min: gene_bbox.y,
            y_max: gene_bbox.y + gene_bbox.height,
        };
    }
}

export {Genes as default};
