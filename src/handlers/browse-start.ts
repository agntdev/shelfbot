import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { ensureUser, LibraryUnavailableError, readLibrary, updateLibrary } from "../library-data.js";
import { menuView } from "../library-ui.js";
import { registerMainMenuItem } from "../toolkit/index.js";

registerMainMenuItem({ label: "📚 Browse Library", data: "browse:start", order: 10 });
const composer = new Composer<Ctx>();

async function show(ctx: Ctx, menuId = "root", page = 0): Promise<void> {
  try {
    await ensureUser(ctx);
    const state = await updateLibrary(ctx, (draft) => {
      const user = draft.users[String(ctx.from?.id ?? ctx.chat?.id)];
      if (user) user.lastOpenedMenu = draft.menus[menuId] ? menuId : "root";
      draft.analytics.menuActivity++;
    });
    const view = menuView(await readLibrary(ctx), menuId, page);
    await ctx.editMessageText(view.text, { reply_markup: view.keyboard });
  } catch (error) {
    await ctx.editMessageText(error instanceof LibraryUnavailableError ? "The library is getting ready. Please try again shortly." : "That section changed. Please open the library again.");
  }
}

composer.callbackQuery("browse:start", async (ctx) => { await ctx.answerCallbackQuery(); await show(ctx, "root"); });
composer.callbackQuery(/^browse:open:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await show(ctx, String(ctx.match[1])); });
composer.callbackQuery(/^browse:([^:]+):(prev|next):(\d+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await show(ctx, String(ctx.match[1]), Number(ctx.match[3])); });

export default composer;
