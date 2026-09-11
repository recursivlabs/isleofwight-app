// Wallet send — turning "we broadcast something" into something the user can
// actually check. #303.
//
// The server returns as soon as a transaction is BROADCAST: WalletService.sendEth
// returns `{ hash }` from both sendViaEoa and sendViaSmartAccount, and neither
// calls waitForTransactionReceipt. A broadcast transaction can still revert, run
// out of gas, be dropped from the mempool, or be replaced.
//
// The SDK has NO way to ask about a receipt — WalletResource exposes
// getMyWallet / getBalance / send and nothing that takes a hash — and there is
// no transaction-history endpoint either, so the activity list is a permanent
// empty state. Between those two gaps, a user who sends funds has had no
// surface anywhere in the app on which to learn whether it worked.
//
// Until the API can answer "did this settle", the honest move is to hand the
// user the one artifact we do have — the hash — and a link to a block explorer,
// which CAN answer it. That is a lookup, not a claim.

/** Base mainnet. The wallet screen states "Base" throughout — Receive, Send and the account row. */
const EXPLORER = 'https://basescan.org';

const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

/**
 * Pull the transaction hash out of an SDK send() response.
 *
 * Typed `SingleResponse<unknown>`, so the shape is not checked for us: the route
 * returns `c.json({ data: result })` and result is the `{ hash }` object above.
 * Returns null rather than a malformed string — a bad hash builds an explorer
 * link that 404s, which is worse than offering no link at all.
 */
export function extractTxHash(res: any): string | null {
  const candidate = res?.data?.hash ?? res?.hash ?? res?.data?.transaction_hash ?? res?.data?.transactionHash;
  return typeof candidate === 'string' && TX_HASH.test(candidate) ? candidate : null;
}

/** Block-explorer URL for a transaction, or null if the hash is not one. */
export function explorerTxUrl(hash: string | null | undefined): string | null {
  return typeof hash === 'string' && TX_HASH.test(hash) ? `${EXPLORER}/tx/${hash}` : null;
}

/** Middle-truncated hash for display. Full value stays available to copy. */
export function shortHash(hash: string): string {
  return hash.length <= 18 ? hash : `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}
