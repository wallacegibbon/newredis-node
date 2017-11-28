/**
 * Select specified fields from an object. If one field doesn't exist in obj,
 * it won't exist in the result.
 *
 * @param {Object} obj
 * @param {string[]} fields - the fields to be select.
 *
 * e.g.
 * selectFields({ a: 1, b: 2, c: 3}, [ "c", "d" ]); //=> { c: 3 }
 */
function selectFields(obj, fields) {
  const result = {};
  fields.forEach(x => obj.hasOwnProperty(x) ? result[x] = obj[x] : null);
  return result;
}


module.exports = {
  selectFields,
};
