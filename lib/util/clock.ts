const clock =
  typeof performance !== "undefined" && performance.now
    ? function() {
        return performance.now();
      }
    : function() {
        return +new Date();
      };

export default clock;
