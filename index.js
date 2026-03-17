const { Bot, InlineKeyboard } = require("grammy");
const mongoose = require("mongoose");
require("dotenv").config();

// 1. Bot Initialization
const bot = new Bot(process.env.BOT_TOKEN);
const ADMIN_ID = process.env.ADMIN_ID;
const GROUP_ID = process.env.GROUP_ID;

// 2. Database Connection
mongoose.connect(process.env.MONGO_URL).then(() => console.log("DB Connected! ✅"));

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

// 4. All 5 Ads Links
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
        if (GROUP_ID) {
            await bot.api.sendMessage(GROUP_ID, "📢 **Reminder:** Watch ads now to boost your ranking and win Lucky Draw rewards! Type /watch to start. 🚀");
        }
    } catch (e) { console.log("Broadcast error"); }
}, 2 * 60 * 60 * 1000);

// 6. Commands Suggestion Menu
async function setMenu() {
    await bot.api.setMyCommands([
        { command: "watch", description: "Watch ads to earn points" },
        { command: "status", description: "Check your points" },
        { command: "leaderboard", description: "Top users list" },
        { command: "help", description: "Lucky draw & Reward info" }
    ]);
    await bot.api.setMyCommands([
        { command: "admin", description: "Open Admin Panel" },
        { command: "search", description: "Find user by ID" },
        { command: "watch", description: "Watch ads" },
        { command: "help", description: "Reward info" }
    ], { scope: { type: "chat", chat_id: parseInt(ADMIN_ID) } });
}
setMenu();

// 7. Lucky Draw Help Content
const helpText = `🎁 **RMS LUCKY DRAW & REWARDS** 🎁\n\n` +
    `Increase your points to qualify for our monthly Lucky Draw!\n\n` +
    `🏆 **Prizes:**\n` +
    `Top users can win:\n` +
    `✅ **1-3 Months Recharge** (Funcam/Ashare/Forever)\n\n` +
    `Use /watch to start earning points now!`;

// --- MAIN LOGIC & CALLBACKS ---

bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const isAd = data === "verify";
    
    // ADMIN ACTIONS
    if (!isAd) {
        if (ctx.from.id.toString() !== ADMIN_ID) return ctx.answerCallbackQuery("Admin only!");
        try {
            if (data === "admin_top") {
                const top = await User.find().sort({ points: -1 }).limit(10);
                const kb = new InlineKeyboard();
                top.forEach(u => kb.text(`${u.username || u.userId} (${u.points})`, `manage_${u.userId}`).row());
                kb.text("⬅️ Back", "admin_main");
                return await ctx.editMessageText("🏆 **Top Users:**", { reply_markup: kb });
            }
            if (data === "admin_main") {
                const kb = new InlineKeyboard().text("🏆 Top 10", "admin_top").text("🔍 Search ID", "admin_search");
                return await ctx.editMessageText("🛠 **RMS ADMIN PANEL**", { reply_markup: kb });
            }
            if (data.startsWith("manage_")) {
                const tId = data.split("_")[1];
                const kb = new InlineKeyboard()
                    .text("+10", `pts_add_10_${tId}`).text("+5", `pts_add_5_${tId}`).row()
                    .text("-10", `pts_sub_10_${tId}`).text("-5", `pts_sub_5_${tId}`).row()
                    .text("⬅️ Back", "admin_top");
                return await ctx.editMessageText(`👤 User: \`${tId}\`\nUpdate Points:`, { reply_markup: kb, parse_mode: "Markdown" });
            }
            if (data.startsWith("pts_")) {
                const [, action, amount, tId] = data.split("_");
                const val = action === "add" ? parseInt(amount) : -parseInt(amount);
                const updated = await User.findOneAndUpdate({ userId: tId }, { $inc: { points: val } }, { new: true });
                await ctx.answerCallbackQuery(`Updated to ${updated.points} pts`);
                const kb = new InlineKeyboard()
                    .text("+10", `pts_add_10_${tId}`).text("+5", `pts_add_5_${tId}`).row()
                    .text("-10", `pts_sub_10_${tId}`).text("-5", `pts_sub_5_${tId}`).row()
                    .text("⬅️ Back", "admin_top");
                return await ctx.editMessageText(`👤 User: \`${tId}\`\n✅ Current Points: **${updated.points}**`, { reply_markup: kb, parse_mode: "Markdown" });
            }
        } catch (e) { console.log(e); }
    }

    // USER VERIFY ACTION
    if (isAd) {
        let user = await User.findOne({ userId: ctx.from.id });
        const timePassed = (Date.now() - user.lastClick) / 1000;
        const target = user.fromGroupId || GROUP_ID;

        if (timePassed < user.requiredWait) {
            const rem = Math.ceil(user.requiredWait - timePassed);
            if (target) await bot.api.sendMessage(target, `⚠️ @${ctx.from.username} failed! ${rem}s remaining.`);
            return ctx.answerCallbackQuery({ text: `Wait ${rem}s! Report sent.`, show_alert: true });
        }

        user.points += 1; user.lastClick = 0; await user.save();
        if (target) await bot.api.sendMessage(target, `✅ @${ctx.from.username} success! +1 Point added.`);
        await ctx.answerCallbackQuery("Success! Point added.");
        return await ctx.editMessageText("Task Completed! ✅");
    }
});

// --- COMMANDS ---

bot.command("start", (ctx) => ctx.reply("RMS Bot is online! Use /help for rewards info."));

bot.command("help", (ctx) => ctx.reply(helpText));

bot.command("watch", async (ctx) => {
    const isGroup = ctx.chat.type !== "private";
    const userId = ctx.from.id;
    const wait = Math.floor(Math.random() * 20) + 15;
    const link = adLinks[Math.floor(Math.random() * adLinks.length)];
    
    let user = await User.findOne({ userId }) || await User.create({ userId, username: ctx.from.username || ctx.from.first_name });
    user.fromGroupId = isGroup ? ctx.chat.id.toString() : user.fromGroupId;
    user.lastClick = Date.now(); user.requiredWait = wait; await user.save();

    const kb = new InlineKeyboard().webApp("Watch Ad 📺", link).row().text("Verify Ad ✅", "verify");
    if (isGroup) {
        try {
            await bot.api.sendMessage(userId, `📺 Ad Duration: ${wait}s\nWait for timer then verify.`, { reply_markup: kb });
            await ctx.reply(`✅ @${ctx.from.username}, Ad link sent in Private DM!`);
        } catch (e) { await ctx.reply("❌ Start the bot in Private first!"); }
    } else {
        await ctx.reply(`📺 Ad Duration: ${wait}s`, { reply_markup: kb });
    }
});

bot.command("admin", (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    const kb = new InlineKeyboard().text("🏆 Top 10", "admin_top").text("🔍 Search ID", "admin_search");
    ctx.reply("🛠 **RMS ADMIN PANEL**", { reply_markup: kb });
});

bot.command("status", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (!user) return ctx.reply("No data yet.");
    ctx.reply(`👤 @${user.username}\n📊 Points: ${user.points}`);
});

bot.command("leaderboard", async (ctx) => {
    const top = await User.find().sort({ points: -1 }).limit(10);
    let msg = "🏆 **Leaderboard** 🏆\n\n";
    top.forEach((u, i) => msg += `${i+1}. @${u.username} — ${u.points} pts\n`);
    ctx.reply(msg);
});

bot.start();
