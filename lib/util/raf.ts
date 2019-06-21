export default {
  next:
    typeof requestAnimationFrame === "function"
      ? requestAnimationFrame
      : (cb: FrameRequestCallback) => setTimeout(cb, 16),
  cancel:
    typeof cancelAnimationFrame === "function"
      ? cancelAnimationFrame
      : clearTimeout
};
