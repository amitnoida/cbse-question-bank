# CBSE SEO Phase 2 — Combined Stage A + B

Generated from the user's Supabase read-only export dated 2026-10-22.

- 155 active chapter records with active MCQs.
- 2 class routes, 10 subject routes, 155 chapter routes.
- Sitemap includes homepage + 12 indexable class/subject pages.
- Chapter pages are accessible but `noindex,follow` and excluded from sitemap until editorial review; this prevents publishing 155 generic checklists as search-indexed educational content.
- No production DB reads, writes, secrets, or changes.
- Existing app, dashboard, admin, auth and verification file remain untouched.

## Install locally

Extract ZIP into the repository root (`C:\Users\HP\Desktop\cbse-question-bank`), preserving folders and replacing only `app/sitemap.ts`.

Check `git status` before proceeding; review the new files. Then run:

```powershell
npm run build
npm run dev
```

Visit `/class-9`, `/class-10`, `/class-9/science`, and a chapter linked from a subject page. Confirm `/app` still works. Verify `/sitemap.xml` lists 13 URLs.

**Do not push until local build and route checks pass and the user approves deployment.**

## Editorial follow-up

Verify chapter names against official current CBSE curriculum, author genuinely chapter-specific notes or worked examples, then remove `robots:{index:false,follow:true}` from the chapter metadata and add reviewed chapter URLs to sitemap. Avoid exposing full MCQs, answers, or paid question bank content.
