// DEC-060: retain this export so old callers fail closed. No credentials,
// database access, ledger access, or operator assertion can enable closure.
export async function closeInterruptedSetup() {
  throw new Error('RECOVERY_DISABLED_NO_DISPATCH_FENCE');
}
