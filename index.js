const { Bot, InlineKeyboard } = require("grammy");
const mongoose = require("mongoose");
require("dotenv").config();

// 1. Bot Initialization
const bot = new Bot(process.env.BOT_TOKEN);

// 2. Database Connection
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("DB Connected Successfully! ✅"))
  .catch(err => console.error("Database Connection Error:", err));

// 3. User Schema
const User = mongoose.model("User", {
    userId: Number,
    username: String,
    points: { type: Number, default: 0 },
    rank: { type: String, default: "User" },
    requiredWait: { type: Number, default: 0 },
    lastClick: { type: Number, default: 0 },
    fromGroupId: String
});

// 4. Ad Links
const adLinks = [
    "https://www.effectivegatecpm.com/yw8cx1x13?key=db61c612d8fd01748bd4401f2323fd8f",
    "https://www.effectivegatecpm.com/kb96c0gieh?key=6b9065c47c1e21512fe3e8bced33144a",
    "https://www.effectivegatecpm.com/tiq1i1nwcs?key=9929dc9f815c415d0550bb3f64c1d854",
    "https://www.effectivegatecpm.com/pa3wchg46?key=3d881e1e67e1030ab609a17b17695d93",
    "https://www.effectivegatecpm.com/ieik85vff?key=d58462324f8afb5e36d3fade6811af49"
];

// 5. Auto-Broadcast (Every 2 Hours)
setInterval(async () => {
    try {
        const groupId = process.env.GROUP_ID;
        if (groupId) {
            await bot.api.sendMessage(groupId, "📢 **Reminder:** Boost your rank by watching ads! Type /watch now in private or here. 🚀");
        }
    } catch (e) {
        console.log("Broadcast skipped: Bot not in group or ID wrong.");
    }
}, 2 * 60 * 60 * 1000);

// 6. Bot Commands
bot.command("start", (ctx) => ctx.reply("RMS Management Bot is Online! 🎖️\nUse /watch to start earning points."));

bot.command("watch", async (ctx) => {
    const isGroup = ctx.chat.type !== "private";
    const userId = ctx.from.id;
    const randomTime = Math.floor(Math.random() * 30) + 15;
    const adLink = adLinks[Math.floor(Math.random() * adLinks.length)];

    let user = await User.findOne({ userId });
    if (!user) user = await User.create({ userId, username: ctx.from.username || ctx.from.first_name });

    user.fromGroupId = isGroup ? ctx.chat.id.toString() : user.fromGroupId;
    user.lastClick = Date.now();
    user.requiredWait = randomTime;
    await user.save();

    const kb = new InlineKeyboard().webApp("Watch Ad 📺", adLink).row().text("Verify Ad ✅", "verify");

    if (isGroup) {
        try {
            await bot.api.sendMessage(userId, `📺 **Task Started!**\nDuration: ${randomTime}s\nWait for the timer, then click Verify.`, { reply_markup: kb });
            await ctx.reply(`✅ @${ctx.from.username}, I've sent the ad to your DM. Check it!`);
        } catch (e) {
            await ctx.reply(`❌ @${ctx.from.username}, please start the bot in private first!`);
        }
    } else {
        await ctx.reply(`📺 **Duration:** ${randomTime}s\nWatch the full ad then click Verify.`, { reply_markup: kb });
    }
});

// 7. Verify Logic & Public Reporting
bot.on("callback_query:data", async (ctx) => {
    if (ctx.callbackQuery.data === "verify") {
        let user = await User.findOne({ userId: ctx.from.id });
        if (!user || !user.lastClick) return ctx.answerCallbackQuery({ text: "Use /watch first!", show_alert: true });

        const timePassed = (Date.now() - user.lastClick) / 1000;
        const groupTarget = user.fromGroupId || process.env.GROUP_ID;

        if (timePassed < user.requiredWait) {
            const rem = Math.ceil(user.requiredWait - timePassed);
            if (groupTarget) await bot.api.sendMessage(groupTarget, `⚠️ **FAILED:** @${ctx.from.username} tried to verify too early (${rem}s left).`);
            return ctx.answerCallbackQuery({ text: `Wait ${rem}s!`, show_alert: true });
        }

        user.points += 1;
        if (user.points >= 50 && user.rank !== "PRO USER") user.rank = "PRO USER";
        user.lastClick = 0;
        await user.save();
        
        if (groupTarget) await bot.api.sendMessage(groupTarget, `✅ **SUCCESS:** @${ctx.from.username} completed the task! Points: ${user.points}`);
        await ctx.answerCallbackQuery({ text: "Success!", show_alert: true });
        await ctx.editMessageText("Task Completed! ✅");
    }
});

// 8. Admin Panel
bot.command("admin", async (ctx) => {
    if (ctx.from.id.toString() !== process.env.ADMIN_ID) return;
    const kb = new InlineKeyboard().text("🏆 Top 10", "admin_top").text("🔍 Search", "admin_search").row().text("❌ Close", "close");
    await ctx.reply("🛠 RMS ADMIN PANEL", { reply_markup: kb });
});

bot.on("callback_query:data", async (ctx) => {
    if (ctx.callbackQuery.data === "admin_top") {
        const top = await User.find().sort({ points: -1 }).limit(10);
        const kb = new InlineKeyboard();
        top.forEach(u => kb.text(`${u.username || u.userId} (${u.points})`, `manage_${u.userId}`).row());
        await ctx.editMessageText("Select user:", { reply_markup: kb });
    }
    // Note: Manage logic uses previous buttons code logic
});

// 9. Error Handler
bot.catch((err) => {
    console.error(`Error: ${err.message}`);
});

bot.start();
