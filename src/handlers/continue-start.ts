import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { LibraryUnavailableError, readLibrary } from "../library-data.js";
import { menuView } from "../library-ui.js";
import { registerMainMenuItem } from "../toolkit/index.js";

registerMainMenuItem({ label: "Continue", data: "continue:start", order: 50 });
const composer = new Composer<Ctx>();
composer.callbackQuery("continue:start", async (ctx) => {
  await ctx.answerCallbackQuery();
  try {
    const state = await readLibrary(ctx);
    const user = state.users[String(ctx.from?.id ?? ctx.chat?.id)];
    if (!user?.lastOpenedMenu) {
      await ctx.editMessageText("You haven't opened a section yet — start with the library.", { reply_markup: { inline_keyboard: [[{ text: "📚 Browse Library", callback_data: "browse:start" }], [{ text: "← Main menu", callback_data: "menu:main" }]] } });
      return;
    }
    const view = menuView(state, user.lastOpenedMenu, 0);
    await ctx.editMessageText(view.text, { reply_markup: view.keyboard });
  } catch (error) {
    await ctx.editMessageText(error instanceof LibraryUnavailableError ? "The library is getting ready. Please try again shortly." : "Couldn't resume that section. Open the library again.");
  }
});
export default composer;
