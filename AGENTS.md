# Zenvexa application

This project preserves ShopBeta's Firebase system with Zenvexa's visual design.
- Preserve existing Firestore paths, schemas, payment lifecycle and role permissions.
- Storefront and admin must use real ShopBeta services, never the previous demo state or passcode gate.
- Both sites intentionally share backend data and admin settings. Keep Zenvexa visual identity local.
- Do not rewrite published Git history; the original Zenvexa project is connected to Lovable.
- Do not deploy shared Firebase rules/functions or run seed/migration scripts as a storefront release step.
