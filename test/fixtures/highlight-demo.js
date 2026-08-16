const ready = false;

function describe(value) {
  // Keep this fixture readable in the browser verifier.
  return `value: ${value}`;
}

export { describe, ready };
