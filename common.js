(exports => {
  'use strict'

  exports.NUM_WEEKS = 8
  exports.NUM_DAYS = 7 * exports.NUM_WEEKS
  exports.GRACE_DAYS = 1

  exports.compareStrings = (a, b) => {
    const lowerA = a.toLowerCase(),
          lowerB = b.toLowerCase()
    if (lowerA < lowerB)
      return -1
    if (lowerA > lowerB)
      return 1
    return 0
  }

})(this.exports ? exports : this)
