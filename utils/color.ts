function lerpColor(a, b) {
  const ar = a >> 16;
  const ag = a >> 8 & 0xff;
  const ab = a & 0xff;

  const br = b >> 16;
  const bg = b >> 8 & 0xff;
  const bb = b & 0xff;

  return (amount) => {
    const rr = ar + amount * (br - ar);
    const rg = ag + amount * (bg - ag);
    const rb = ab + amount * (bb - ab);

    return (rr << 16) + (rg << 8) + (rb | 0);
  };
}

function lerpMultipleColors(colorMap) {
  const keys = Object.keys(colorMap).map(Number).sort();
  const reverseKeys = keys.slice().reverse();
  const lerpMap = keys.reduce((acc, key, i) => {
    const next = keys[i + 1];

    if (next === undefined) {
      return acc;
    }

    acc[`${key}:${next}`] = lerpColor(colorMap[key], colorMap[next]);

    return acc;
  }, {});

  return (amount) => {
    const end = keys.find((i) => i >= amount);
    const start = reverseKeys.find((i) => i <= amount);

    if (start === end) {
      return colorMap[start];
    }

    const diff = end - start;
    const weightAmount = 1 / diff * (amount - start);

    return lerpMap[`${start}:${end}`](weightAmount);
  };
}

export function hexToColor(i) {
  const c = (i & 0x00FFFFFF)
    .toString(16)
    .toUpperCase();

  return '#' + ('00000'.substring(0, 6 - c.length)) + c;
}

export const getColor = lerpMultipleColors({
  0: 0xF25270,
  0.3: 0x51548C,
  0.6: 0x49A68B,
  1: 0xD94848,
});

export function getRandomColor() {
  return hexToColor(getColor(Math.random()));
}
