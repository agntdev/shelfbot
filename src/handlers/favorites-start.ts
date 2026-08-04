import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { LibraryUnavailableError, readLibrary, userId } from "../library-data.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";

registerMainMenuItem({ label: "Favorites", data: "favorites:start", order: 30 });
const composer = new Composer<Ctx>();
composer.callbackQuery("favorites:start", async (ctx) => {
  await ctx.answerCallbackQuery();
  try {
    const state = await readLibrary(ctx);
    const files = (state.users[userId(ctx)]?.favorites ?? []).map((id) => state.files[id]).filter(Boolean);
    await ctx.editMessageText(files.length ? "Your favorites" : "No favorites yet — open a file and tap Add favorite.", { reply_markup: inlineKeyboard([...files.map((file) => [inlineButton(file.title, `file:details:${file.id}`)]), [inlineButton("← Main menu", "menu:main")]]) });
  } catch (error) { await ctx.editMessageText(error instanceof LibraryUnavailableError ? "The library is getting ready. Please try again shortly." : "Couldn't load your favorites. Please try again."); }
});
export default composer;
