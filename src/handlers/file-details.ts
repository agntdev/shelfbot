import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { activePurchase, LibraryUnavailableError, readLibrary, updateLibrary, userId } from "../library-data.js";
import { fileDetailsText } from "../library-ui.js";
import { inlineButton, inlineKeyboard, isOwner } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

function keyboard(fileId: string, favorite: boolean, admin: boolean) {
  const rows = [
    [inlineButton("View", `file:view:${fileId}`), inlineButton("Download", `file:download:${fileId}`)],
    [inlineButton(favorite ? "Remove favorite" : "Add favorite", `file:fav:${fileId}`), inlineButton("Share", `file:share:${fileId}`)],
    [inlineButton("Premium access", "premium:request")],
  ];
  if (admin) rows.push([inlineButton("Edit file", `admin:fileedit:${fileId}`), inlineButton("Move file", `admin:filemove:${fileId}`), inlineButton("Delete file", `admin:filedelete:${fileId}`)]);
  rows.push([inlineButton("← Library", "browse:start")]);
  return inlineKeyboard(rows);
}

async function show(ctx: Ctx, fileId: string): Promise<void> {
  try {
    const state = await readLibrary(ctx);
    const file = state.files[fileId];
    if (!file) { await ctx.editMessageText("That file is no longer available."); return; }
    const favorite = state.users[userId(ctx)]?.favorites.includes(fileId) ?? false;
    await ctx.editMessageText(fileDetailsText(file), { reply_markup: keyboard(fileId, favorite, isOwner(ctx)) });
  } catch (error) { await ctx.editMessageText(error instanceof LibraryUnavailableError ? "The library is getting ready. Please try again shortly." : "Couldn't open that file. Please try again."); }
}

/** Used by a shared Telegram deep link, which starts a new message rather than editing one. */
export async function sendDetails(ctx: Ctx, fileId: string): Promise<boolean> {
  try {
    const state = await readLibrary(ctx);
    const file = state.files[fileId];
    if (!file) return false;
    const favorite = state.users[userId(ctx)]?.favorites.includes(fileId) ?? false;
    await ctx.reply(fileDetailsText(file), { reply_markup: keyboard(fileId, favorite, isOwner(ctx)) });
    return true;
  } catch { return false; }
}

async function sendFile(ctx: Ctx, fileId: string, action: "view" | "download"): Promise<void> {
  try {
    const state = await readLibrary(ctx);
    const file = state.files[fileId];
    if (!file) { await ctx.answerCallbackQuery({ text: "That file is no longer available.", show_alert: true }); return; }
    if (!activePurchase(state, userId(ctx))) { await ctx.answerCallbackQuery({ text: "Premium access is needed for this file.", show_alert: true }); await ctx.reply("This file needs an active subscription. Tap Premium access to request one.", { reply_markup: inlineKeyboard([[inlineButton("Premium access", "premium:request")]]) }); return; }
    await updateLibrary(ctx, (draft) => { if (action === "view") draft.analytics.fileViews++; else draft.analytics.fileDownloads++; });
    await ctx.replyWithDocument(file.telegramFileId, { caption: `${file.title}\n${action === "download" ? "Your download is ready." : "Here is your file."}` });
  } catch (error) { if (!(error instanceof LibraryUnavailableError)) await ctx.reply("Couldn't send that file. Please try again shortly."); else await ctx.reply("The library is getting ready. Please try again shortly."); }
}

composer.callbackQuery(/^file:details:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await show(ctx, String(ctx.match[1])); });
composer.callbackQuery(/^file:fav:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const id = String(ctx.match[1]);
  try { await updateLibrary(ctx, (state) => { const user = state.users[userId(ctx)]; if (!user) return; const at = user.favorites.indexOf(id); if (at >= 0) user.favorites.splice(at, 1); else if (state.files[id]) user.favorites.push(id); }); await show(ctx, id); } catch { await ctx.reply("Couldn't update your favorites. Please try again."); }
});
composer.callbackQuery(/^file:(view|download):(.+)$/, async (ctx) => { const action = ctx.match[1] as "view" | "download"; await ctx.answerCallbackQuery(); await sendFile(ctx, String(ctx.match[2]), action); });
composer.callbackQuery(/^file:share:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const username = ctx.me.username;
  if (!username) { await ctx.reply("Sharing isn't set up yet. Please try again later."); return; }
  await ctx.reply(`Share this link: https://t.me/${username}?start=file_${String(ctx.match[1])}`);
});
export default composer;
