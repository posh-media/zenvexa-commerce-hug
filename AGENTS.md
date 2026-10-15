<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Application rules
- Keep Zenvexa's storefront and other views inside a shared client-state provider; phase-one checkout and merchant updates are intentionally session-only simulations.
- Keep product data, delivery options and pricing calculations in a browser-safe commerce module so all views share one source of truth and pricing rules can be unit-tested.
- Define brand styling in the global semantic token system and use shared shadcn controls for interactions to keep the storefront visually consistent.
