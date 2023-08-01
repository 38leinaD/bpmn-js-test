var SPACING = 10;

function quantize(value, quantum, fn) {
  if (!fn) {
    fn = 'round';
  }

  return Math[ fn ](value / quantum) * quantum;
}

export { SPACING as S, quantize as q };
