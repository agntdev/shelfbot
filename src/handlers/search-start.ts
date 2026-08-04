import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { LibraryUnavailableError, readLibrary } from "../library-data.js";
import { inlineButton, inlineKeyboard, paginate, registerMainMenuItem } from "../toolkit/index.js";

type SearchSession = Ctx["session"] & { libraryStep?: string; searchQuery?: string };
registerMainMenuItem({ label: "Search Files", data: "search:start", order: 20 });
const composer = new Composer<Ctx>();

async function results(ctx: Ctx, query: string, page: number): Promise<void> {
  try {
    const state = await readLibrary(ctx);
    const needle = query.toLocaleLowerCase();
    const files = state.fileIds.map((id) => state.files[id]).filter((file) => file && `${file.title} ${file.description}`.toLocaleLowerCase().includes(needle));
    const slice = paginate(files, { page, perPage: 6, callbackPrefix: "search" });
    const rows = slice.pageItems.map((file) => [inlineButton(file.title, `file:details:${file.id}`)]);
    await ctx.editMessageText(files.length ? `Results for “${query}”\n\nPage ${slice.page + 1} of ${slice.totalPages}` : `No files match “${query}” — try a different word.`, { reply_markup: inlineKeyboard([...rows, ...slice.controls.inline_keyboard, [inlineButton("New search", "search:start"), inlineButton("← Main menu", "menu:main")]]) });
  } catch (error) { await ctx.editMessageText(error instanceof LibraryUnavailableError ? "The library is getting ready. Please try again shortly." : "Couldn't search the library. Please try again."); }
}

composer.callbackQuery("search:start", async (ctx) => { await ctx.answerCallbackQuery(); (ctx.session as SearchSession).libraryStep = "search"; await ctx.editMessageText("Send a word or phrase to search file titles and descriptions.", { reply_markup: inlineKeyboard([[inlineButton("← Main menu", "menu:main")]]) }); });
composer.callbackQuery(/^search:(prev|next):(\d+)$/, async (ctx) => { await ctx.answerCallbackQuery(); const query = (ctx.session as SearchSession).searchQuery; if (!query) { await ctx.editMessageText("Start a new search first.", { reply_markup: inlineKeyboard([[inlineButton("Search Files", "search:start")]]) }); return; } await results(ctx, query, Number(ctx.match[2])); });
composer.on("message:text", async (ctx, next) => {
  if ((ctx.session as SearchSession).libraryStep !== "search") return next();
  const query = ctx.message.text.trim();
  if (query.length < 2 || query.length > 80) { await ctx.reply("Use 2 to 80 characters so the search stays useful."); return; }
  (ctx.session as SearchSession).libraryStep = undefined;
  (ctx.session as SearchSession).searchQuery = query;
  // A typed reply has no menu message to edit, so send a result card.
  try {
    const state = await readLibrary(ctx);
    const files = state.fileIds.map((id) => state.files[id]).filter((file) => file && `${file.title} ${file.description}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
    const slice = paginate(files, { page: 0, perPage: 6, callbackPrefix: "search" });
    await ctx.reply(files.length ? `Results for “${query}”\n\nPage 1 of ${slice.totalPages}` : `No files match “${query}” — try a different word.`, { reply_markup: inlineKeyboard([...slice.pageItems.map((file) => [inlineButton(file.title, `file:details:${file.id}`)]), ...slice.controls.inline_keyboard, [inlineButton("New search", "search:start"), inlineButton("← Main menu", "menu:main")]]) });
  } catch (error) { await ctx.reply(error instanceof LibraryUnavailableError ? "The library is getting ready. Please try again shortly." : "Couldn't search the library. Please try again."); }
});
export default composer;
