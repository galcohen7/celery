// עוטף פונקציות אסינכרוניות כדי שדחיות (rejections) יגיעו ל-error handler
module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
