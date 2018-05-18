/*
    Custom code used to power credible sets demonstration example. This is not part of the core LocusZoom library,
    but can be included as a standalone file.

    The page must incorporate and load all libraries before this file can be used, including:
     - Vendor assets
     - LocusZoom
     - gwas-credible-sets (available via NPM)
 */

"use strict";

/* global gwasCredibleSets */

// Specify a custom datasource that adds a "credible sets" field to the prepared API response
LocusZoom.KnownDataSources.extend("AssociationLZ", "CredibleAssociationLZ", {
    annotateData: function (records) {
        // This is a somewhat crude method for adding fields in the front end, after the API response has been returned.
        //  In the future, features for lazy evaluation and dynamic namespacing of calculated fields may be added.

        // Calculate raw bayes factors and posterior probabilities based on information returned from the API
        var nlogpvals = records.map(function (item) {
            return item["log_pvalue"];
        });
        var scores = gwasCredibleSets.scoring.bayesFactors(nlogpvals);
        var posteriorProbabilities = gwasCredibleSets.scoring.normalizeProbabilities(scores);

        // Use scores to mark the credible set in various ways (depending on your visualization preferences,
        //    some of these may be unneeded)
        var credibleSet = gwasCredibleSets.marking.findCredibleSet(scores);
        var credSetScaled = gwasCredibleSets.marking.rescaleCredibleSet(credibleSet);
        var credSetBool = gwasCredibleSets.marking.markBoolean(credibleSet);

        // Annotate each response record based on credible set membership
        records.forEach(function (item, index) {
            item["credibleSetPosteriorProb"] = posteriorProbabilities[index];
            item["credibleSetContribution"] = credSetScaled[index]; // Visualization helper: normalized to contribution within the set
            item["isCredible"] = credSetBool[index];
        });
        return records;
    }
});


LocusZoom.Layouts.add("tooltip", "credible_set_association", function () {
    // Extend a known tooltip with an extra row of info showing posterior probabilities
    var l = LocusZoom.Layouts.get("tooltip", "standard_association", {unnamespaced: true});
    l.html += "<br>Posterior probability: <strong>{{{{namespace[assoc]}}credibleSetPosteriorProb|scinotation}}</strong>";
    return l;
}());

LocusZoom.Layouts.add("tooltip", "credible_set_annotation", {
    namespace: {"assoc": "assoc"},
    closable: true,
    show: {or: ["highlighted", "selected"]},
    hide: {and: ["unhighlighted", "unselected"]},
    html: "<strong>{{{{namespace[assoc]}}variant}}</strong><br>"
    + "P Value: <strong>{{{{namespace[assoc]}}log_pvalue|logtoscinotation}}</strong><br>" +
    "<br>Posterior probability: <strong>{{{{namespace[assoc]}}credibleSetPosteriorProb|scinotation}}</strong>"
});

// Define layouts that incorporate credible set annotations into the plot
LocusZoom.Layouts.add("data_layer", "credible_set_annotation", {
    namespace: {"assoc": "assoc"},
    id: "annotations",
    type: "annotation_track",
    id_field: "{{namespace[assoc]}}variant",
    x_axis: {
        field: "{{namespace[assoc]}}position"
    },
    color: "#00CC00",
    // Credible set markings are derived fields. Although they don't need to be specified in the fields array,
    //  we DO need to specify the fields used to do the calculation (eg pvalue)
    fields: ["{{namespace[assoc]}}variant", "{{namespace[assoc]}}position", "{{namespace[assoc]}}log_pvalue", "{{namespace[assoc]}}credibleSetPosteriorProb", "{{namespace[assoc]}}credibleSetContribution", "{{namespace[assoc]}}isCredible"],
    filters: [
        // Specify which points to show on the track. Any selection must satisfy ALL filters
        ["{{namespace[assoc]}}isCredible", true]
    ],
    behaviors: {
        onmouseover: [
            {action: "set", status: "highlighted"}
        ],
        onmouseout: [
            {action: "unset", status: "highlighted"}
        ],
        onclick: [
            {action: "toggle", status: "selected", exclusive: true}
        ],
        onshiftclick: [
            {action: "toggle", status: "selected"}
        ]
    },
    tooltip: LocusZoom.Layouts.get("tooltip", "credible_set_annotation"),
    tooltip_positioning: "vertical"
});

LocusZoom.Layouts.add("panel", "credible_set_panel", {
    id: "credible",
    width: 800,
    height: 100,
    min_height: 100,
    proportional_width: 1,
    margin: {top: 35, right: 50, bottom: 40, left: 50},
    inner_border: "rgb(210, 210, 210)",
    interaction: {
        drag_background_to_pan: true,
        scroll_to_zoom: true,
        x_linked: true
    },
    data_layers: [
        LocusZoom.Layouts.get("data_layer", "credible_set_annotation", {unnamespaced: true})
    ]
});

LocusZoom.Layouts.add("plot", "association_credible_sets", {
    state: {},
    width: 800,
    height: 450,
    responsive_resize: true,
    min_region_scale: 20000,
    max_region_scale: 1000000,
    dashboard: LocusZoom.Layouts.get("dashboard", "standard_plot", {unnamespaced: true}),
    panels: [
        function () {
            // Use a slightly modified association panel: custom tooltip
            var assoc_panel = LocusZoom.Layouts.get("panel", "association", {unnamespaced: true});

            // Add "display options" button to control how credible set coloring is overlaid on the standard association plot
            assoc_panel.dashboard.components.push(
                {
                    type: "display_options",
                    position: "right",
                    color: "blue",
                    // Below: special config specific to this widget
                    button_html: "Display options...",
                    button_title: "Control how plot items are displayed",

                    layer_name: "associationpvalues",
                    default_config_display_name: "Linkage Disequilibrium (default)", // display name for the default plot color option (allow user to revert to plot defaults)

                    options: [
                        {
                            // First dropdown menu item
                            display_name: "95% credible set (boolean)",  // Human readable representation of field name
                            display: {  // Specify layout directives that control display of the plot for this option
                                point_shape: "circle",
                                point_size: 40,
                                color: {
                                    field: "assoc:isCredible",
                                    scale_function: "if",
                                    parameters: {
                                        field_value: true,
                                        then: "#00CC00",
                                        else: "#CCCCCC"
                                    }
                                },
                                legend: [ // Tells the legend how to represent this display option
                                    {
                                        shape: "circle",
                                        color: "#00CC00",
                                        size: 40,
                                        label: "In credible set",
                                        class: "lz-data_layer-scatter"
                                    },
                                    {
                                        shape: "circle",
                                        color: "#CCCCCC",
                                        size: 40,
                                        label: "Not in credible set",
                                        class: "lz-data_layer-scatter"
                                    }
                                ]
                            }
                        },
                        {
                            // Second option. The same plot- or even the same field- can be colored in more than one way.
                            display_name: "95% credible set (gradient by contribution)",
                            display: {
                                point_shape: "circle",
                                point_size: 40,
                                color: [
                                    { // FIXME: Display options dropdown should support namespacing (namespaces have already been resolved by the time this works, so "assoc" is hardcoded)
                                        field: "assoc:credibleSetContribution",
                                        scale_function: "if",
                                        parameters: {
                                            field_value: 0,
                                            then: "#777777"
                                        }
                                    },
                                    {
                                        scale_function: "interpolate",
                                        field: "assoc:credibleSetContribution",
                                        parameters: {
                                            breaks: [0, 1],
                                            values: ["#fafe87", "#9c0000"]
                                        }
                                    }
                                ],
                                legend: [
                                    {
                                        shape: "circle",
                                        color: "#777777",
                                        size: 40,
                                        label: "No contribution",
                                        class: "lz-data_layer-scatter"
                                    },
                                    {
                                        shape: "circle",
                                        color: "#fafe87",
                                        size: 40,
                                        label: "Some contribution",
                                        class: "lz-data_layer-scatter"
                                    },
                                    {
                                        shape: "circle",
                                        color: "#9c0000",
                                        size: 40,
                                        label: "Most contribution",
                                        class: "lz-data_layer-scatter"
                                    }
                                ]
                            }
                        }
                    ]
                }
            );
            var assoc_layer = assoc_panel.data_layers[2];
            assoc_layer.tooltip = LocusZoom.Layouts.get("tooltip", "credible_set_association");

            //["{{namespace[assoc]}}variant", "{{namespace[assoc]}}position", "{{namespace[assoc]}}log_pvalue", "{{namespace[assoc]}}credibleSetPosteriorProb", "{{namespace[assoc]}}credibleSetContribution", "{{namespace[assoc]}}isCredible"]

            // assoc_layer.fields.push("{{namespace[assoc]}}credibleSetPosteriorProb", "{{namespace[assoc]}}credibleSetContribution", "{{namespace[assoc]}}isCredible");
            assoc_layer.fields = [
                "{{namespace[assoc]}}variant", "{{namespace[assoc]}}position", "{{namespace[assoc]}}log_pvalue", "{{namespace[assoc]}}log_pvalue|logtoscinotation", "{{namespace[assoc]}}ref_allele", "{{namespace[assoc]}}credibleSetPosteriorProb", "{{namespace[assoc]}}credibleSetContribution", "{{namespace[assoc]}}isCredible",
                "{{namespace[ld]}}state", "{{namespace[ld]}}isrefvar"];

            return assoc_panel;
        }(),
        LocusZoom.Layouts.get("panel", "credible_set_panel", {unnamespaced: true})
    ]
});
