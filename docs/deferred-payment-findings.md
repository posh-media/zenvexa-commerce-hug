# Deferred payment investigation findings

Recorded before adding Squad. These are deliberately outside the provider-addition
scope; they must be addressed separately without silently changing existing flows.

- Existing admin payment keys are stored in publicly readable `settings/app` and
  can enter settings audit records. Move existing secrets into private storage.
- A KoraPay test secret was previously committed in `.env.example`. The example
  value was blanked to publish the Squad change safely; rotate the previously
  committed key if valid. Rotation and history cleanup remain deferred.
- Existing Next.js webhook routes call asynchronous signature checks without
  `await`, so invalid signatures are not rejected by those checks.
- Server feature-flag fallback names (`NEXT_PUBLIC_ENABLE_*`) disagree with
  documented/client names (`NEXT_PUBLIC_*_ENABLED`).
- Several KoraPay configuration checks also omit `await`.
- Legacy callbacks try Paystack then KoraPay instead of dispatching by provider.
- Retry offers changing providers but initialization requires the original method.
- Order totals are created by the browser; server-side recomputation and order
  creation rules need review before relying on totals as authoritative.
- Payment settings are cached in the browser; the existing network-failure
  fallback does not assign the cache and can return null.
- Next.js and Firebase Functions contain separate payment implementations with
  different configuration/fallback behavior. Verify deployed settings separately.

The Squad addition uses a separate private secret document and correct awaited
checks in its own routes. It does not migrate existing providers or change their
verification, webhook, order-pricing, or Firebase Functions behavior.
