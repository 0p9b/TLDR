# TLDR unified product merge — complete

- Mechanical import from blunt installer stack: **done**
- Rebrand gaps (tldr@tldr, opencode `tldr` paths, `tldr.skill` zip): **done**
- `commands/tldr.md` restored for doc-sync
- Verification: `python3 tests/verify_repo.py`, `bench/check-doc-sync.py`, `node --test tests/installer/*.test.mjs` — **all green**

Branch: `merge/unified-product` → merge to `main` and push `origin`.