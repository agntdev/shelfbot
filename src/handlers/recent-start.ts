import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { LibraryUnavailableError, readLibrary } from "../library-data.js";
import { inlineButton, inlineKeyboard, paginate, registerMainMenuItem } from "../toolkit/index.js";

registerMainMenuItem({ label: "Recently Added", data: "recent:start", order: 40 });
const composer = new Composer<Ctx>();
async function show(ctx: Ctx, page: number): Promise<void> {
  try {
    const state = await readLibrary(ctx);
    const files = state.fileIds.map((id) => state.files[id]).filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const slice = paginate(files, { page, perPage: 6, callbackPrefix: "recent" });
    const rows = slice.pageItems.map((file) => [inlineButton(file.title, `file:details:${file.id}`)]);
    await ctx.editMessageText(files.length ? `Recently added\n\nPage ${slice.page + 1} of ${slice.totalPages}` : "No files have been added yet — check back soon.", { reply_markup: inlineKeyboard([...rows, ...slice.controls.inline_keyboard, [inlineButton("← Main menu", "menu:main")]]) });
  } catch (error) { await ctx.editMessageText(error instanceof LibraryUnavailableError ? "The library is getting ready. Please try again shortly." : "Couldn't load recent files. Please try again."); }
}
composer.callbackQuery("recent:start", async (ctx) => { await ctx.answerCallbackQuery(); await show(ctx, 0); });
composer.callbackQuery(/^recent:(prev|next):(\d+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await show(ctx, Number(ctx.match[2])); });
export default composer;
