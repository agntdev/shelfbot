import { inlineButton, inlineKeyboard, paginate } from "./toolkit/index.js";
import type { InlineButton, InlineKeyboardMarkup } from "./toolkit/index.js";
import type { LibraryFile, LibraryState, Menu } from "./library-data.js";

export const backMenu = () => inlineKeyboard([[inlineButton("← Main menu", "menu:main")]]);

export function mergeRows(...groups: InlineButton[][]): InlineKeyboardMarkup {
  return inlineKeyboard(groups.filter((row) => row.length > 0));
}

export function fileLabel(file: LibraryFile): string { return file.pinned ? `📌 ${file.title}` : file.title; }

export function menuText(menu: Menu, entries: Array<{ kind: "menu"; item: Menu } | { kind: "file"; item: LibraryFile }>, page: number, totalPages: number): string {
  const heading = `${menu.emoji} ${menu.title}`;
  const description = menu.description ? `\n${menu.description}` : "";
  const items = entries.map((entry) => entry.kind === "menu" ? `${entry.item.emoji} ${entry.item.title} — ${entry.item.description || "Open this section."}` : `${entry.item.pinned ? "📌 " : ""}${entry.item.title} — ${entry.item.description || "File"}`);
  return `${heading}${description}\n\n${items.length ? items.join("\n") : "No files here yet — choose another section or check back soon."}${totalPages > 1 ? `\n\nPage ${page + 1} of ${totalPages}` : ""}`;
}

export function menuView(state: LibraryState, menuId: string, page: number) {
  const menu = state.menus[menuId] ?? state.menus.root;
  const children = state.menuIds.map((id) => state.menus[id]).filter((item) => item && item.parentId === menu.id && item.visible).sort((a, b) => a.order - b.order);
  const files = state.fileIds.map((id) => state.files[id]).filter((file) => file && file.attachedMenus.includes(menu.id)).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));
  const entries = [...children.map((item) => ({ kind: "menu" as const, item })), ...files.map((item) => ({ kind: "file" as const, item }))];
  const sliced = paginate(entries, { page, perPage: 6, callbackPrefix: `browse:${menu.id}` });
  const itemRows = sliced.pageItems.map((entry) => [inlineButton(entry.kind === "menu" ? `${entry.item.emoji} ${entry.item.title}` : fileLabel(entry.item), entry.kind === "menu" ? `browse:open:${entry.item.id}` : `file:details:${entry.item.id}`)]);
  const nav = sliced.controls.inline_keyboard;
  const controls: InlineButton[][] = [];
  if (menu.parentId) controls.push([inlineButton("← Back", `browse:open:${menu.parentId}`), inlineButton("Home", "browse:start")]);
  else controls.push([inlineButton("Home", "menu:main")]);
  return { text: menuText(menu, sliced.pageItems, sliced.page, sliced.totalPages), keyboard: mergeRows(...itemRows, ...nav, ...controls) };
}

export function fileDetailsText(file: LibraryFile): string {
  const parts = [file.title, file.description || "No description provided.", `Type: ${file.type}`, `Size: ${formatBytes(file.size)}`];
  if (file.duration) parts.push(`Duration: ${file.duration} seconds`);
  return parts.join("\n");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
