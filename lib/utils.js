/**
 * Select specified fields from an object. If one field doesn't exist in obj,
 * it won't exist in the result.
 *
 * @param {Object} obj
 * @param {string[]} fields - the fields to be select.
 */
function selectFields(obj, fields) {
  const result = {};
  for (var x of fields)
    if (obj.hasOwnProperty(x))
      result[x] = obj[x];
  return result;
}


module.exports = {
  selectFields,
};
