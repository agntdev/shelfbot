# LibraryBot — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A Telegram bot that creates a nested, menu-driven digital library for public users to browse, search, and access files. Admins can manage content, handle offline payments, and issue coupons for premium access. Users can favorite files, track history, and request time-limited subscriptions.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- public Telegram users
- admins managing content and sales

## Success criteria

- Admins can create and manage a nested file library
- Users can browse, search, and access files
- Offline payment requests and coupon-based subscriptions work
- Admins receive notifications for purchases and can broadcast messages

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open the main menu
- **Browse Library** (button, actor: user, callback: browse:start) — Open the main library menu
- **Search Files** (button, actor: user, callback: search:start) — Open the search interface
- **Favorites** (button, actor: user, callback: favorites:start) — View favorite files
- **Recently Added** (button, actor: user, callback: recent:start) — View recently added files
- **Continue** (button, actor: user, callback: continue:start) — Resume last opened menu
- **/admin** (command, actor: admin, command: /admin) — Open the admin panel for content and user management

## Flows

### browse_library
_Trigger:_ browse:start

1. Display main menu with Home, Back, and Next/Prev buttons
2. Show menu items with descriptions, emojis, and pinned items
3. Allow navigation to sub-menus or file details

_Data touched:_ menus, files

### search_files
_Trigger:_ search:start

1. Show search bar with substring match
2. Display paged results with file details
3. Allow file actions (view, download, favorite)

_Data touched:_ files

### file_details
_Trigger:_ file:details

1. Show file metadata (title, size, duration, description)
2. Offer inline actions: view/stream, download, favorite, share link
3. Admins see edit/replace/move/delete controls

_Data touched:_ files

### request_premium
_Trigger:_ premium:request

1. Display payment instructions
2. Collect proof of payment
3. Admin marks payment as paid to grant access

_Data touched:_ purchases, coupons

### admin_panel
_Trigger:_ /admin

1. Display admin menu with CMS controls
2. Create/rename/reorder/delete menus
3. Upload/edit/move files
4. Manage coupons and purchases
5. Broadcast messages
6. View analytics and export reports

_Data touched:_ menus, files, coupons, purchases, analytics

## Owner-supplied settings

The OWNER provides these; they are collected in chat and injected into the environment at deploy. Read each one from the environment where it is used (`ctx.env.<KEY>` / `env.<KEY>` on Cloudflare Workers; `process.env.<KEY>` only as a Node/harness fallback — never the sole read). Do NOT invent your own way of learning the value, do NOT ask for it in a bot message, and do NOT hardcode a default.

- **ADMIN_CHAT_IDS** — Telegram chat IDs where admin notifications are sent
  - this is the OWNER's own chat id; the platform already knows it. Read `ADMIN_CHAT_IDS` via `ctx.env` (prefer toolkit `adminChatId` / `requireOwner`) — never ask a user, never treat whoever writes first as the admin, never invent claim-admin or open manage for everyone.
  - may be UNSET at runtime: the bot must still start, and the feature needing ADMIN_CHAT_IDS must say so plainly instead of failing.
- **DEFAULT_SUBSCRIPTION_DAYS** — Default duration for premium subscriptions in days
  - may be UNSET at runtime: the bot must still start, and the feature needing DEFAULT_SUBSCRIPTION_DAYS must say so plainly instead of failing.

Your behavioral specs run WITHOUT these values, so no spec may depend on one.

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

An entity that merely NAMES an owner-supplied setting above (an admin chat, an API account) is not something to store or discover — read it from the environment.

- **Admins** _(retention: persistent)_ — Usernames/IDs with full CMS controls
  - fields: username, telegram_id
- **Users** _(retention: persistent)_ — User profiles with favorites and purchase history
  - fields: telegram_id, favorites, purchase_history, last_opened_menu
- **Menus** _(retention: persistent)_ — Hierarchy nodes with title, emoji, description, and visibility settings
  - fields: title, emoji, description, order, visibility
- **Files** _(retention: persistent)_ — Metadata and Telegram file_id for all library content
  - fields: title, description, type, size, duration, pinned, telegram_file_id, attached_menus
- **Coupons** _(retention: persistent)_ — Admin-created codes for discounts or access duration
  - fields: code, discount, duration, usage_limits, created_by
- **Purchases** _(retention: persistent)_ — User subscriptions and payment status
  - fields: user, start_date, end_date, source, status
- **Analytics** _(retention: persistent)_ — Usage statistics for files, menus, and users
  - fields: file_views, file_downloads, menu_activity, user_activity

## Integrations

- **Telegram** (required) — Bot API messaging
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Set default subscription duration
- Define admin usernames/IDs
- Configure admin notification chat IDs
- Manage file retention policies

## Notifications

- Admins receive notifications for new purchases and coupon claims
- Broadcast messages to all users from admin panel

## Permissions & privacy

- User data is stored securely and only accessible to admins
- File metadata is visible to all users but file access is controlled by subscription status
- Admins must be explicitly designated by the owner

## Edge cases

- Handling large file libraries with pagination
- Managing expired subscriptions and access revocation
- Handling concurrent menu edits by multiple admins

## Required tests

- Verify admin can create and manage menus and files
- Test user can browse, search, and access files
- Validate offline payment workflow from request to subscription grant
- Ensure admin notifications are delivered correctly

## Assumptions

- Admins will provide their Telegram IDs for access
- Users will follow offline payment instructions correctly
- Telegram file_ids will remain valid for all stored files
