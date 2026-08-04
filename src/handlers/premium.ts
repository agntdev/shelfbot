import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { defaultSubscriptionDays, LibraryUnavailableError, readLibrary, updateLibrary, userId } from "../library-data.js";
import { now } from "../library-clock.js";
import { adminChatIds, inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";

type FlowSession = Ctx["session"] & { libraryStep?: "payment_proof" | "coupon" };
const composer = new Composer<Ctx>();

async function notifyAdmins(ctx: Ctx, text: string): Promise<void> {
  for (const chatId of adminChatIds(ctx as Ctx & { env?: Record<string, unknown> })) {
    try { await ctx.api.sendMessage(chatId, text); } catch { /* A blocked or unavailable admin must not break the request. */ }
  }
}

composer.callbackQuery("premium:request", async (ctx) => {
  await ctx.answerCallbackQuery();
  (ctx.session as FlowSession).libraryStep = "payment_proof";
  await ctx.editMessageText("Send your payment proof as a photo or file. An admin will review it before access is granted.", { reply_markup: inlineKeyboard([[inlineButton("Redeem coupon", "coupon:redeem")], [inlineButton("← Library", "browse:start")]]) });
});
composer.callbackQuery("coupon:redeem", async (ctx) => {
  await ctx.answerCallbackQuery();
  (ctx.session as FlowSession).libraryStep = "coupon";
  await ctx.editMessageText("Send your coupon code exactly as you received it.", { reply_markup: inlineKeyboard([[inlineButton("Cancel", "premium:request")]]) });
});

composer.on(["message:photo", "message:document"], async (ctx, next) => {
  if ((ctx.session as FlowSession).libraryStep !== "payment_proof") return next();
  const proofKind = ctx.message.photo ? "photo" as const : "document" as const;
  const proof = ctx.message.photo?.at(-1)?.file_id ?? ctx.message.document?.file_id;
  if (!proof) return next();
  try {
    await updateLibrary(ctx, (state) => {
      const id = `purchase_${state.purchaseIds.length + 1}_${now().getTime()}`;
      state.purchases[id] = { id, user: userId(ctx), source: "offline", status: "awaiting_proof", proofFileId: proof, proofKind, createdAt: now().toISOString() };
      state.purchaseIds.push(id);
      const user = state.users[userId(ctx)];
      if (user) user.purchaseHistory.push(id);
    });
    (ctx.session as FlowSession).libraryStep = undefined;
    await notifyAdmins(ctx, "A new payment proof is ready to review in LibraryBot.");
    await ctx.reply("Your proof is with the admin. You'll get access once payment is confirmed.");
  } catch (error) { await ctx.reply(error instanceof LibraryUnavailableError ? "The library is getting ready. Please try again shortly." : "Couldn't save your proof. Please send it again."); }
});
composer.on("message:text", async (ctx, next) => {
  if ((ctx.session as FlowSession).libraryStep !== "coupon") return next();
  const code = ctx.message.text.trim().toUpperCase();
  try {
    const result = await updateLibrary(ctx, (state) => {
      const coupon = state.coupons[code];
      if (!coupon) return "missing" as const;
      if (coupon.usedBy.includes(userId(ctx))) return "used" as const;
      if (coupon.usedBy.length >= coupon.usageLimit) return "limit" as const;
      const start = now();
      const end = new Date(start.getTime() + coupon.duration * 86_400_000);
      const id = `purchase_${state.purchaseIds.length + 1}_${start.getTime()}`;
      state.purchases[id] = { id, user: userId(ctx), startDate: start.toISOString(), endDate: end.toISOString(), source: "coupon", status: "paid", createdAt: start.toISOString() };
      state.purchaseIds.push(id);
      coupon.usedBy.push(userId(ctx));
      const user = state.users[userId(ctx)]; if (user) user.purchaseHistory.push(id);
      return "ok" as const;
    });
    if (result === "missing") await ctx.reply("That coupon wasn't found. Check the code and try again.");
    else if (result === "used") await ctx.reply("You've already used that coupon.");
    else if (result === "limit") await ctx.reply("That coupon has reached its limit.");
    else { (ctx.session as FlowSession).libraryStep = undefined; await notifyAdmins(ctx, "A coupon was claimed in LibraryBot."); await ctx.reply("Your premium access is active."); }
  } catch (error) { await ctx.reply(error instanceof LibraryUnavailableError ? "The library is getting ready. Please try again shortly." : "Couldn't redeem that coupon. Please try again."); }
});

// Registered so premium remains discoverable even from an otherwise empty library.
registerMainMenuItem({ label: "Premium access", data: "premium:request", order: 60 });
export { notifyAdmins };
export default composer;
