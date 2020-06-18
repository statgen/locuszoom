/**
 * Available statuses that individual elements can have. Each status is described by
 *   a verb and an adjective. Verbs are used to generate data layer
 *   methods for updating the status on one or more elements. Adjectives are used in class
 *   names and applied or removed from elements to have a visual representation of the status,
 *   as well as used as keys in the state for tracking which elements are in which status(es)
 * @static
 * @type {{verbs: String[], adjectives: String[]}}
 */
export const STATUSES = {
    verbs: ['highlight', 'select', 'fade', 'hide'],
    adjectives: ['highlighted', 'selected', 'faded', 'hidden'],
};
