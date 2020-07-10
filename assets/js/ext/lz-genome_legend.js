/*
    Genome Legend Data Layer
    Implements a data layer that will render a genome legend
    This is not part of the core LocusZoom library, but can be included as a standalone file.

    The page must incorporate and load all libraries before this file can be used, including:
    - Vendor assets
    - LocusZoom
*/
'use strict';

// This is defined as a UMD module, to work with multiple different module systems / bundlers
// Arcane build note: everything defined here gets registered globally. This is not a "pure" module, and some build
//  systems may require being told that this file has side effects.
/* global define, module, require */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['locuszoom'], function (LocusZoom) {  // amd
            return factory(LocusZoom);
        });
    } else if (typeof module === 'object' && module.exports) {  // commonJS
        module.exports = factory(require('locuszoom'));
    } else {  // globals
        if (!root.LocusZoom.ext.DataLayers) {
            root.LocusZoom.ext.DataLayers = {};
        }
        root.LocusZoom.ext.DataLayers.GenomeLegend = factory(root.LocusZoom);
    }
}(this, function (LocusZoom) {
    // Build a custom data layer for a genome legend
    LocusZoom.DataLayers.add('genome_legend', function (layout) {
        // Define a default layout for this DataLayer type and merge it with the passed argument
        this.DefaultLayout = {
            chromosome_fill_colors: {
                light: 'rgb(155, 155, 188)',
                dark: 'rgb(95, 95, 128)'
            },
            chromosome_label_colors: {
                light: 'rgb(120, 120, 186)',
                dark: 'rgb(0, 0, 66)'
            }
        };
        layout = LocusZoom.Layouts.merge(layout, this.DefaultLayout);

        // Apply the arguments to set LocusZoom.DataLayer as the prototype
        LocusZoom.DataLayer.apply(this, arguments);

        // Implement the main render function
        this.render = function () {

            // Iterate over data to generate genome-wide start/end values for each chromosome
            var position = 0;
            this.data.forEach(function (d, i) {
                this.data[i].genome_start = position;
                this.data[i].genome_end = position + d['genome:base_pairs'];
                position += d['genome:base_pairs'];
            }.bind(this));

            var chromosomes = this.svg.group
                .selectAll('rect.lz-data_layer-genome_legend')
                .data(this.data, function (d) {
                    return d['genome:chr'];
                });

            // Create chromosome elements, apply class
            chromosomes.enter()
                .append('rect')
                .attr('class', 'lz-data_layer-genome_legend');

            // Position and fill chromosome rects
            var data_layer = this;
            var panel = this.parent;

            chromosomes
                .attr('fill', function (d) {
                    return (d['genome:chr'] % 2 ? data_layer.layout.chromosome_fill_colors.light : data_layer.layout.chromosome_fill_colors.dark);
                })
                .attr('x', function (d) {
                    return panel.x_scale(d.genome_start);
                })
                .attr('y', 0)
                .attr('width', function (d) {
                    return panel.x_scale(d['genome:base_pairs']);
                })
                .attr('height', panel.layout.cliparea.height);

            // Remove old elements as needed
            chromosomes.exit().remove();

            // Parse current state variant into a position
            // Assumes that variant string is of the format 10:123352136_C/T or 10:123352136
            var variant_parts = /([^:]+):(\d+)(?:_.*)?/.exec(this.state.variant);
            if (!variant_parts) {
                throw new Error('Genome legend cannot understand the specified variant position');
            }
            var chr = variant_parts[1];
            var offset = variant_parts[2];
            // TODO: How does this handle representation of X or Y chromosomes?
            position = +this.data[chr - 1].genome_start + +offset;

            // Render the position
            var region = this.svg.group
                .selectAll('rect.lz-data_layer-genome_legend-marker')
                .data([{ start: position, end: position + 1 }]);

            region.enter()
                .append('rect')
                .attr('class', 'lz-data_layer-genome_legend-marker');

            region
                .transition()
                .duration(500)
                .style({
                    'fill': 'rgba(255, 250, 50, 0.8)',
                    'stroke': 'rgba(255, 250, 50, 0.8)',
                    'stroke-width': '3px'
                })
                .attr('x', function (d) {
                    return panel.x_scale(d.start);
                })
                .attr('y', 0)
                .attr('width', function (d) {
                    return panel.x_scale(d.end - d.start);
                })
                .attr('height', panel.layout.cliparea.height);

            region.exit().remove();

        };

        return this;

    });

    LocusZoom.Layouts.add('data_layer', 'genome_legend', {
        namespace: { 'genome': 'genome' },
        id: 'genome_legend',
        type: 'genome_legend',
        fields: ['{{namespace[genome]}}chr', '{{namespace[genome]}}base_pairs'],
        x_axis: {
            floor: 0,
            ceiling: 2881033286
        }
    });

    LocusZoom.Layouts.add('panel', 'genome_legend', {
        id: 'genome_legend',
        width: 800,
        height: 50,
        origin: { x: 0, y: 300 },
        min_width: 800,
        min_height: 50,
        proportional_width: 1,
        margin: { top: 0, right: 50, bottom: 35, left: 50 },
        axes: {
            x: {
                label: 'Genomic Position (number denotes chromosome)',
                label_offset: 35,
                ticks: [
                    {
                        x: 124625310,
                        text: '1',
                        style: {
                            'fill': 'rgb(120, 120, 186)',
                            'text-anchor': 'center',
                            'font-size': '13px',
                            'font-weight': 'bold'
                        },
                        transform: 'translate(0, 2)'
                    },
                    {
                        x: 370850307,
                        text: '2',
                        style: {
                            'fill': 'rgb(0, 0, 66)',
                            'text-anchor': 'center',
                            'font-size': '13px',
                            'font-weight': 'bold'
                        },
                        transform: 'translate(0, 2)'
                    },
                    {
                        x: 591461209,
                        text: '3',
                        style: {
                            'fill': 'rgb(120, 120, 186)',
                            'text-anchor': 'center',
                            'font-size': '13px',
                            'font-weight': 'bold'
                        },
                        transform: 'translate(0, 2)'
                    },
                    {
                        x: 786049562,
                        text: '4',
                        style: {
                            'fill': 'rgb(0, 0, 66)',
                            'text-anchor': 'center',
                            'font-size': '13px',
                            'font-weight': 'bold'
                        },
                        transform: 'translate(0, 2)'
                    },
                    {
                        x: 972084330,
                        text: '5',
                        style: {
                            'fill': 'rgb(120, 120, 186)',
                            'text-anchor': 'center',
                            'font-size': '13px',
                            'font-weight': 'bold'
                        },
                        transform: 'translate(0, 2)'
                    },
                    {
                        x: 1148099493,
                        text: '6',
                        style: {
                            'fill': 'rgb(0, 0, 66)',
                            'text-anchor': 'center',
                            'font-size': '13px',
                            'font-weight': 'bold'
                        },
                        transform: 'translate(0, 2)'
                    },
                    {
                        x: 1313226358,
                        text: '7',
                        style: {
                            'fill': 'rgb(120, 120, 186)',
                            'text-anchor': 'center',
                            'font-size': '13px',
                            'font-weight': 'bold'
                        },
                        transform: 'translate(0, 2)'
                    },
                    {
                        x: 1465977701,
                        text: '8',
                        style: {
                            'fill': 'rgb(0, 0, 66)',
                            'text-anchor': 'center',
                            'font-size': '13px',
                            'font-weight': 'bold'
                        },
                        transform: 'translate(0, 2)'
                    },
                    {
                        x: 1609766427,
                        text: '9',
                        style: {
                            'fill': 'rgb(120, 120, 186)',
                            'text-anchor': 'center',
                            'font-size': '13px',
                            'font-weight': 'bold'
                        },
                        transform: 'translate(0, 2)'
                    },
                    {
                        x: 1748140516,
                        text: '10',
                        style: {
                            'fill': 'rgb(0, 0, 66)',
                            'text-anchor': 'center',
                            'font-size': '13px',
                            'font-weight': 'bold'
                        },
                        transform: 'translate(0, 2)'
                    },
                    {
                        x: 1883411148,
                        text: '11',
                        style: {
                            'fill': 'rgb(120, 120, 186)',
                            'text-anchor': 'center',
                            'font-size': '13px',
                            'font-weight': 'bold'
                        },
                        transform: 'translate(0, 2)'
                    },
                    {
                        x: 2017840353,
                        text: '12',
                        style: {
                            'fill': 'rgb(0, 0, 66)',
                            'text-anchor': 'center',
                            'font-size': '13px',
                            'font-weight': 'bold'
                        },
                        transform: 'translate(0, 2)'
                    },
                    {
                        x: 2142351240,
                        text: '13',
                        style: {
                            'fill': 'rgb(120, 120, 186)',
                            'text-anchor': 'center',
                            'font-size': '13px',
                            'font-weight': 'bold'
                        },
                        transform: 'translate(0, 2)'
                    },
                    {
                        x: 2253610949,
                        text: '14',
                        style: {
                            'fill': 'rgb(0, 0, 66)',
                            'text-anchor': 'center',
                            'font-size': '13px',
                            'font-weight': 'bold'
                        },
                        transform: 'translate(0, 2)'
                    },
                    {
                        x: 2358551415,
                        text: '15',
                        style: {
                            'fill': 'rgb(120, 120, 186)',
                            'text-anchor': 'center',
                            'font-size': '13px',
                            'font-weight': 'bold'
                        },
                        transform: 'translate(0, 2)'
                    },
                    {
                        x: 2454994487,
                        text: '16',
                        style: {
                            'fill': 'rgb(0, 0, 66)',
                            'text-anchor': 'center',
                            'font-size': '13px',
                            'font-weight': 'bold'
                        },
                        transform: 'translate(0, 2)'
                    },
                    {
                        x: 2540769469,
                        text: '17',
                        style: {
                            'fill': 'rgb(120, 120, 186)',
                            'text-anchor': 'center',
                            'font-size': '13px',
                            'font-weight': 'bold'
                        },
                        transform: 'translate(0, 2)'
                    },
                    {
                        x: 2620405698,
                        text: '18',
                        style: {
                            'fill': 'rgb(0, 0, 66)',
                            'text-anchor': 'center',
                            'font-size': '13px',
                            'font-weight': 'bold'
                        },
                        transform: 'translate(0, 2)'
                    },
                    {
                        x: 2689008813,
                        text: '19',
                        style: {
                            'fill': 'rgb(120, 120, 186)',
                            'text-anchor': 'center',
                            'font-size': '13px',
                            'font-weight': 'bold'
                        },
                        transform: 'translate(0, 2)'
                    },
                    {
                        x: 2750086065,
                        text: '20',
                        style: {
                            'fill': 'rgb(0, 0, 66)',
                            'text-anchor': 'center',
                            'font-size': '13px',
                            'font-weight': 'bold'
                        },
                        transform: 'translate(0, 2)'
                    },
                    {
                        x: 2805663772,
                        text: '21',
                        style: {
                            'fill': 'rgb(120, 120, 186)',
                            'text-anchor': 'center',
                            'font-size': '13px',
                            'font-weight': 'bold'
                        },
                        transform: 'translate(0, 2)'
                    },
                    {
                        x: 2855381003,
                        text: '22',
                        style: {
                            'fill': 'rgb(0, 0, 66)',
                            'text-anchor': 'center',
                            'font-size': '13px',
                            'font-weight': 'bold'
                        },
                        transform: 'translate(0, 2)'
                    }
                ]
            }
        },
        data_layers: [
            LocusZoom.Layouts.get('data_layer', 'genome_legend', { unnamespaced: true })
        ]
    });

    // Genome base pairs static data
    var genome_data = [
        { chr: 1, base_pairs: 249250621 },
        { chr: 2, base_pairs: 243199373 },
        { chr: 3, base_pairs: 198022430 },
        { chr: 4, base_pairs: 191154276 },
        { chr: 5, base_pairs: 180915260 },
        { chr: 6, base_pairs: 171115067 },
        { chr: 7, base_pairs: 159138663 },
        { chr: 8, base_pairs: 146364022 },
        { chr: 9, base_pairs: 141213431 },
        { chr: 10, base_pairs: 135534747 },
        { chr: 11, base_pairs: 135006516 },
        { chr: 12, base_pairs: 133851895 },
        { chr: 13, base_pairs: 115169878 },
        { chr: 14, base_pairs: 107349540 },
        { chr: 15, base_pairs: 102531392 },
        { chr: 16, base_pairs: 90354753 },
        { chr: 17, base_pairs: 81195210 },
        { chr: 18, base_pairs: 78077248 },
        { chr: 19, base_pairs: 59128983 },
        { chr: 20, base_pairs: 63025520 },
        { chr: 21, base_pairs: 48129895 },
        { chr: 22, base_pairs: 51304566 }
    ];

    // Public interface of the module (exported symbols)
    return { genome_data: genome_data };
}));
