import type { Context } from "grammy";
import { now } from "./library-clock.js";

export type Menu = { id: string; title: string; emoji: string; description: string; parentId?: string; order: number; visible: boolean; pinned: boolean };
export type LibraryFile = { id: string; title: string; description: string; type: string; size: number; duration?: number; pinned: boolean; telegramFileId: string; attachedMenus: string[]; createdAt: string; updatedAt: string };
export type User = { telegramId: string; favorites: string[]; purchaseHistory: string[]; lastOpenedMenu?: string; joinedAt: string };
export type Coupon = { code: string; discount: number; duration: number; usageLimit: number; usedBy: string[]; createdBy: string; createdAt: string };
export type Purchase = { id: string; user: string; startDate?: string; endDate?: string; source: "offline" | "coupon"; status: "awaiting_proof" | "paid" | "expired" | "rejected"; proofFileId?: string; proofKind?: "photo" | "document"; createdAt: string };
export type Analytics = { fileViews: number; fileDownloads: number; menuActivity: number; userActivity: number };
export type LibraryState = { revision: number; menus: Record<string, Menu>; menuIds: string[]; files: Record<string, LibraryFile>; fileIds: string[]; users: Record<string, User>; userIds: string[]; coupons: Record<string, Coupon>; couponCodes: string[]; purchases: Record<string, Purchase>; purchaseIds: string[]; analytics: Analytics };

type RuntimeEnv = { CHAT_DO?: { idFromName(name: string): unknown; get(id: unknown): { fetch(input: string, init?: { method?: string; body?: string }): Promise<Response> } } };
export type LibraryCtx = Context & { env?: RuntimeEnv };

const KEY = "library:state";
const root: Menu = { id: "root", title: "Library", emoji: "📚", description: "Browse the collection.", order: 0, visible: true, pinned: false };

function emptyState(): LibraryState {
  return { revision: 0, menus: { root }, menuIds: ["root"], files: {}, fileIds: [], users: {}, userIds: [], coupons: {}, couponCodes: [], purchases: {}, purchaseIds: [], analytics: { fileViews: 0, fileDownloads: 0, menuActivity: 0, userActivity: 0 } };
}

function store(ctx: LibraryCtx) {
  const namespace = ctx.env?.CHAT_DO;
  if (!namespace) return undefined;
  return namespace.get(namespace.idFromName("library-data"));
}

export class LibraryUnavailableError extends Error {}

export async function readLibrary(ctx: LibraryCtx): Promise<LibraryState> {
  const target = store(ctx);
  if (!target) throw new LibraryUnavailableError();
  const response = await target.fetch("https://do/library/read?key=" + encodeURIComponent(KEY));
  if (!response.ok) throw new LibraryUnavailableError();
  const value = await response.json() as LibraryState | undefined;
  return value ?? emptyState();
}

/** Retries conflicting writes; the Durable Object serializes each compare/write. */
export async function updateLibrary<T>(ctx: LibraryCtx, mutate: (state: LibraryState) => T): Promise<T> {
  const target = store(ctx);
  if (!target) throw new LibraryUnavailableError();
  for (let attempt = 0; attempt < 3; attempt++) {
    const state = await readLibrary(ctx);
    const result = mutate(state);
    const response = await target.fetch("https://do/library/write", { method: "PUT", body: JSON.stringify({ key: KEY, expectedRevision: state.revision, value: { ...state, revision: state.revision + 1 } }) });
    if (response.status === 409) continue;
    if (!response.ok) throw new LibraryUnavailableError();
    return result;
  }
  throw new Error("Library was updated by someone else. Please try again.");
}

export async function ensureUser(ctx: LibraryCtx): Promise<User> {
  const id = String(ctx.from?.id ?? ctx.chat?.id ?? "");
  if (!id) throw new LibraryUnavailableError();
  return updateLibrary(ctx, (state) => {
    let user = state.users[id];
    if (!user) {
      user = { telegramId: id, favorites: [], purchaseHistory: [], joinedAt: now().toISOString() };
      state.users[id] = user;
      state.userIds.push(id);
    }
    state.analytics.userActivity++;
    return user;
  });
}

export function userId(ctx: Context): string { return String(ctx.from?.id ?? ctx.chat?.id ?? ""); }
export function activePurchase(state: LibraryState, id: string): Purchase | undefined {
  const instant = now().getTime();
  return state.purchaseIds.map((purchaseId) => state.purchases[purchaseId]).find((purchase) => purchase?.user === id && purchase.status === "paid" && purchase.endDate !== undefined && new Date(purchase.endDate).getTime() > instant);
}
export function defaultSubscriptionDays(ctx: LibraryCtx): number | undefined {
  const value = ctx.env as Record<string, unknown> | undefined;
  const raw = value?.DEFAULT_SUBSCRIPTION_DAYS ?? (typeof process === "undefined" ? undefined : process.env.DEFAULT_SUBSCRIPTION_DAYS);
  const days = Number(raw);
  return Number.isInteger(days) && days > 0 && days <= 3650 ? days : undefined;
}
