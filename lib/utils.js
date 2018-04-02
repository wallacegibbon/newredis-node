/**
 * e.g. selectFields({ a: 1, b: 2, c: 3 }, [ "c", "d" ]) //=> { c: 3 }
 */
function selectFields(obj, fields) {
  const result = {}
  if (obj) {
    fields.forEach(x => obj.hasOwnProperty(x) ? result[x] = obj[x] : null)
  }
  return result
}


module.exports = {
  selectFields,
}
