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

// 4. All Ads Links
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
    } catch (e) { console.log("Broadcast error skipping..."); }
}, 2 * 60 * 60 * 1000);

// 6. Admin Buttons Generator
function createPointButtons(tId) {
    return new InlineKeyboard()
        .text("+5", `pts_add_5_${tId}`).text("+10", `pts_add_10_${tId}`).text("+20", `pts_add_20_${tId}`).row()
        .text("+50", `pts_add_50_${tId}`).text("+100", `pts_add_100_${tId}`).text("+500", `pts_add_500_${tId}`).row()
        .text("+1k", `pts_add_1000_${tId}`).text("+5k", `pts_add_5000_${tId}`).text("+10k", `pts_add_10000_${tId}`).row()
        .text("+100k", `pts_add_100000_${tId}`).row()
        .text("-5", `pts_sub_5_${tId}`).text("-10", `pts_sub_10_${tId}`).text("-20", `pts_sub_20_${tId}`).row()
        .text("-50", `pts_sub_50_${tId}`).text("-100", `pts_sub_100_${tId}`).text("-500", `pts_sub_500_${tId}`).row()
        .text("-1k", `pts_sub_1000_${tId}`).text("-5k", `pts_sub_5000_${tId}`).text("-10k", `pts_sub_10000_${tId}`).row()
        .text("-100k", `pts_sub_100000_${tId}`).row()
        .text("⬅️ Back to List", "admin_top");
}

// 7. Command Suggestions Setup
async function setBotMenu() {
    await bot.api.setMyCommands([
        { command: "watch", description: "Watch ads to earn points" },
        { command: "status", description: "Check your points" },
        { command: "leaderboard", description: "Top users list" },
        { command: "help", description: "Lucky draw info" }
    ]);
    await bot.api.setMyCommands([
        { command: "admin", description: "Open Admin Panel" },
        { command: "search", description: "Top 20 / Search User" },
        { command: "setpoints", description: "Set exact points manually" },
        { command: "watch", description: "Watch ads" },
        { command: "help", description: "Reward info" }
    ], { scope: { type: "chat", chat_id: parseInt(ADMIN_ID) } });
}
setBotMenu();

// --- LOGIC & CALLBACKS ---

bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    if (ctx.from.id.toString() !== ADMIN_ID && !data.includes("verify")) return ctx.answerCallbackQuery("Unauthorized!");

    try {
        if (data === "admin_top" || data === "admin_main") {
            const top = await User.find().sort({ points: -1 }).limit(20);
            const kb = new InlineKeyboard();
            top.forEach(u => kb.text(`${u.username || u.userId} (${u.points})`, `manage_${u.userId}`).row());
            kb.text("🔍 Manual Search ID", "admin_search");
            return await ctx.editMessageText("🏆 **RMS Admin - Select User:**", { reply_markup: kb });
        }
        if (data === "admin_search") return await ctx.editMessageText("🔍 Use `/search [User_ID]` to find someone specific.");
        
        if (data.startsWith("manage_")) {
            const tId = data.split("_")[1];
            return await ctx.editMessageText(`👤 **Managing:** \`${tId}\`\nUpdate Points:`, { reply_markup: createPointButtons(tId), parse_mode: "Markdown" });
        }
        if (data.startsWith("pts_")) {
            const [, action, amount, tId] = data.split("_");
            const val = action === "add" ? parseInt(amount) : -parseInt(amount);
            const user = await User.findOneAndUpdate({ userId: tId }, { $inc: { points: val } }, { new: true });
            await ctx.answerCallbackQuery(`Updated to ${user.points} pts`);
            return await ctx.editMessageText(`👤 **User:** \`${tId}\`\n✅ **Current Points:** **${user.points}**`, { reply_markup: createPointButtons(tId), parse_mode: "Markdown" });
        }
        if (data === "verify") {
            let user = await User.findOne({ userId: ctx.from.id });
            const timePassed = (Date.now() - user.lastClick) / 1000;
            const target = user.fromGroupId || GROUP_ID;
            if (timePassed < user.requiredWait) {
                const rem = Math.ceil(user.requiredWait - timePassed);
                if (target) await bot.api.sendMessage(target, `⚠️ @${ctx.from.username} failed early verify!`);
                return ctx.answerCallbackQuery({ text: `Wait ${rem}s!`, show_alert: true });
            }
            user.points += 1; user.lastClick = 0; await user.save();
            if (target) await bot.api.sendMessage(target, `✅ @${ctx.from.username} success! +1 Point added.`);
            await ctx.answerCallbackQuery("Success!");
            return await ctx.editMessageText("Task Completed! ✅");
        }
    } catch (e) { console.log(e); }
});

// --- COMMANDS ---

bot.command("start", (ctx) => ctx.reply("RMS Bot is online! Use /help to see prizes."));

bot.command("help", (ctx) => ctx.reply("🎁 **REWARDS INFO:**\nTop users win monthly recharges for Funcam/Ashare/Forever! \n\nWe select 1 user from the Top List every month."));

bot.command("search", async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    const tId = ctx.match;
    if (!tId) {
        const top = await User.find().sort({ points: -1 }).limit(20);
        const kb = new InlineKeyboard();
        top.forEach(u => kb.text(`${u.username || u.userId} (${u.points})`, `manage_${u.userId}`).row());
        return ctx.reply("🏆 **Top 20 Users List:**", { reply_markup: kb });
    }
    let user = await User.findOne({ userId: tId }) || await User.create({ userId: tId, username: "Manual_Entry" });
    ctx.reply(`👤 **Found:** ${user.username}\n📊 **Points:** ${user.points}`, { reply_markup: createPointButtons(tId) });
});

bot.command("admin", (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    const kb = new InlineKeyboard().text("🏆 Top 20 List", "admin_top").text("🔍 Search ID", "admin_search");
    ctx.reply("🛠 **RMS ADMIN PANEL**", { reply_markup: kb });
});

bot.command("setpoints", async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    const args = ctx.match.split(" ");
    if (args.length < 2) return ctx.reply("Format: `/setpoints ID Points`", { parse_mode: "Markdown" });
    await User.findOneAndUpdate({ userId: args[0] }, { points: parseInt(args[1]) });
    ctx.reply(`✅ Updated ${args[0]} to ${args[1]} points.`);
    ctx.deleteMessage().catch(() => {});
});

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
            await bot.api.sendMessage(userId, `📺 Ad Task Started!\nDuration: ${wait}s`, { reply_markup: kb });
            await ctx.reply(`✅ @${ctx.from.username}, Ad link sent in Private DM!`);
        } catch (e) { await ctx.reply("❌ Please start the bot in private first!"); }
    } else {
        await ctx.reply(`📺 Ad Duration: ${wait}s`, { reply_markup: kb });
    }
});

bot.command("status", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (!user) return ctx.reply("No data yet.");
    ctx.reply(`👤 User: @${user.username}\n📊 Points: ${user.points}`);
});

bot.command("leaderboard", async (ctx) => {
    const top = await User.find().sort({ points: -1 }).limit(10);
    let msg = "🏆 **Leaderboard** 🏆\n\n";
    top.forEach((u, i) => msg += `${i+1}. @${u.username} — ${u.points} pts\n`);
    ctx.reply(msg);
});

bot.start();
