# Zenvexa application

This project preserves ShopBeta's Firebase system with Zenvexa's visual design.
- Preserve existing Firestore paths, schemas, payment lifecycle and role permissions.
- Storefront and admin must use real ShopBeta services, never the previous demo state or passcode gate.
- Products, inventory and Firebase Auth are shared. Settings, integrations, orders and operational activity are store-scoped; see docs/STORE-SCOPING.md.
- Do not rewrite published Git history; the original Zenvexa project is connected to Lovable.
- Store-scoping rules/functions and migrations require the coordinated expand/migrate/cutover sequence in docs/STORE-SCOPING.md. Do not run seed scripts or deploy unrelated backend changes.
