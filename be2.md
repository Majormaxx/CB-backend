### API Endpoints
- **GET** `/payouts/rounds?orgId=` → List incomplete rounds.  
- **GET** `/payouts/preview?roundId=` → Recipient list (human + base-unit), totals, preflight checks (balance, role), and chunk plan.  
- **POST** `/payouts/propose` `{ roundId, tokenType }` → Build batched calls, create Safe transaction, propose it, store proposal, return Safe link.   
- **GET** `/payouts/status?roundId=` → Poll Transaction Service for statuses; update records accordingly.  

### Chunking logic (dev one-liner)
> “Build a batched Safe MultiSend of up to N recipients, `estimateGas`; if gas or calldata exceeds cap, split and re-estimate recursively until ≤ cap; store chunks as `tx_proposals` with `partIndex/partCount`.”  
  

### Server-side Validations
- Wallet address validation and dedupe.  
- Convert amounts using real `decimals()`.  
- Balance checks for transfers; TP mint requires Safe to hold `MINTER_ROLE`.
