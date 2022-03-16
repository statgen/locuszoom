/**
 * @private
 */

import justclone from 'just-clone';

/**
 * The "just-clone" library only really works for objects and arrays. If given a string, it would mess things up quite a lot.
 * @param {object} data
 * @returns {*}
 */
function clone(data) {
    if (typeof data !== 'object') {
        return data;
    }
    return justclone(data);
}

export { clone };
