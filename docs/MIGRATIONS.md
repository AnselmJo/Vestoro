Migration: Seed template category taxonomy (CAT-01)

Goal

Seed a full default category taxonomy as template categories (isTemplate: true) with parent/child relations. Existing categories, rules and transactions must be preserved — no existing transaction should become uncategorized.

Plan

1. Run previewSeedCategoryTemplate() (dry-run) to see which template categories would be created and which match existing categories by name.
2. Review the diff and confirm mapping for names that differ by case/spelling.
3. Run applySeedCategoryTemplate() to create missing categories and mark matched ones as templates (isTemplate=true, active=true).

Notes

- Template categories cannot be hard-deleted; deleteCategory() will throw for isTemplate=true. Templates can be deactivated by updating active=false.
- The migration preserves existing category ids. When template and existing category share the same name (case-insensitive), the existing category is reused and marked as template.
- The migration runs inside a Dexie transaction; it is safe to run, but review the dry-run first.

How to run (manual steps)

1. In a running dev console (or via a small script), call:
   const dry = await repo.previewSeedCategoryTemplate();
   console.log(dry);
2. Inspect output: matches (existing categories with same name), toCreate (new categories to be added).
3. If acceptable, run:
   const created = await repo.applySeedCategoryTemplate();
   console.log(created);

Rollback

- applySeedCategoryTemplate creates new categories and marks existing ones as templates. To revert, delete newly created category ids (not templates that were pre-existing). Because templates are protected from deletion, manual revert requires direct DB modifications or a follow-up script provided by maintainers.
