import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { mainMenuKeyboard } from "../toolkit/index.js";
import { ensureUser } from "../library-data.js";
import { sendDetails } from "./file-details.js";

// The /start handler renders the bot's MAIN MENU — the primary way users operate
// a button-first bot. A feature adds its own button by calling
// `registerMainMenuItem(...)` in its own `src/handlers/<slug>.ts`; this handler
// renders whatever is registered (plus a Help button), so you do NOT edit this
// file to add a feature. Send ONE message — no placeholder line above the menu.
const composer = new Composer<Ctx>();

const WELCOME = "Welcome to LibraryBot. Choose how you'd like to explore the collection.";

composer.command("start", async (ctx) => {
  // Registration is best-effort while a Worker is still provisioning its store.
  try { await ensureUser(ctx); } catch { /* The menu remains useful during provisioning. */ }
  const payload = typeof ctx.match === "string" ? ctx.match : "";
  if (payload.startsWith("file_")) {
    if (await sendDetails(ctx, payload.slice(5))) return;
  }
  await ctx.reply(WELCOME, { reply_markup: mainMenuKeyboard() });
});

// "Back to menu" — re-render the main menu in place from any sub-view.
composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(WELCOME, { reply_markup: mainMenuKeyboard() });
});

export default composer;
