// DEC-060: disabled even for old arguments or configured server credentials.
// Do not instantiate database or ledger clients here.
console.error('Recovery disabled: no enforced dispatch fence. Leave the operation blocked for human investigation; see handoff/R-002.md.');
process.exitCode = 1;
