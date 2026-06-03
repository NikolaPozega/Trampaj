---
name: Admin panel design preferences + early adopter campaign
description: Owner's explicit visual preferences for admin panel redesign + first 500 users promo details
---

## Admin panel style direction
- **Futuristic / neon** — neon-glow borders on cards, tables, inputs (same aesthetic as design mockups owner previously shared)
- **Small, dense typography** — smaller font sizes, more information per screen
- **Dark theme** — already dark, lean into it harder
- **More options** — owner wants maximum functionality exposed, not simplified

## Admin panel approach
- Do NOT redesign piecemeal — wait and do the full admin panel redesign in one go
- Owner confirmed: "pričekaj sa programiranjem da sve jednom napravimo"

## Admin panel features to include (collected)
- User management: list, suspend, delete
- Listing moderation: view, remove, flag
- Flagged content / chat reports
- Platform statistics (active users, listings, trades)
- Push notification broadcast
- Promo / early adopter management (see below)
- Social media hub (see below)

## Social media hub (admin panel section)

### Purpose
Single place to review, edit, delete all AI-generated social media posts across all networks.

### What the API allows
- Facebook: view ✅, edit text ✅, delete ✅
- Instagram: view ✅, edit ❌ (Meta API limitation — cannot edit after posting), delete ✅

### UI layout
- Chronological feed of all AI posts
- Each item: thumbnail, AI-written caption, network icons (FB/IG), status badge (published/error/pending)
- Actions: Edit (FB only), Delete, Re-publish (delete + repost with corrected text)

### Approval workflow
- TBD: auto-publish immediately OR queue for owner approval first
- Owner has not decided yet — ask when implementing

### Networks
- Facebook Page (META_PAGE_ID, META_PAGE_TOKEN already in secrets)
- Instagram (META_IG_USER_ID already in secrets)
- Future: TikTok, others

---

## Early adopter campaign — first 500 users

### Rules
- Eligibility: first 500 users who register AND post at least one listing
- Benefit: ~1.5€ discount on one delivery (covered from owner's commission margin)
- One benefit per account total — usable on ANY listing, at ANY time, whenever the user chooses
- Example: user has 6 listings, can apply discount to listing #4's delivery — their choice
- Benefit persists until used (no expiry)
- Counter locks at 500 — user #501 gets nothing

### Implementation approach
- **No code entry** — fully automatic, system tracks eligibility
- When user qualifies (registers + posts first listing): push notification "Jedan si od prvih 500 — tvoja prva dostava je jeftinija!"
- At delivery checkout: discount automatically applied, no input needed
- DB fields needed: `early_adopter: boolean`, `delivery_discount_used: boolean`
- Admin panel shows: total early adopters count, how many used benefit

### Billing
- Owner handles all billing (charges users full price, pays GLS, absorbs discount from own margin)
- No Stripe coupon codes needed — purely internal tracking
