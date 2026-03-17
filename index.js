const { Bot, InlineKeyboard } = require("grammy");
const mongoose = require("mongoose");
require("dotenv").config();

// 1. Bot Initialization
const bot = new Bot(process.env.BOT_TOKEN);
const ADMIN_ID = process.env.ADMIN_ID;
const GROUP_ID = process.env.GROUP_ID;

// 2. Database Connection
mongoose.connect(process.env.MONGO_URL).then(() => console.log("DB Connected Successfully! ✅"));

// 3. User Schema
const User = mongoose.model("User", {
    userId: Number,
    username: String,
    points: { type: Number, default: 0 },
    rank: { type: String, default: "User" },
    requiredWait: { type: Number, default: 0 },
    lastClick: { type: Number, default: 0 },
    fromGroupId: String,
    streak: { type: Number, default: 0 },
    lastDaily: { type: Number, default: 0 }
});

// 4. Professional Ads Links
const adLinks = [
    "https://www.effectivegatecpm.com/yw8cx1x13?key=db61c612d8fd01748bd4401f2323fd8f",
    "https://www.effectivegatecpm.com/kb96c0gieh?key=6b9065c47c1e21512fe3e8bced33144a",
    "https://www.effectivegatecpm.com/tiq1i1nwcs?key=9929dc9f815c415d0550bb3f64c1d854",
    "https://www.effectivegatecpm.com/pa3wchg46?key=3d881e1e67e1030ab609a17b17695d93",
    "https://www.effectivegatecpm.com/ieik85vff?key=d58462324f8afb5e36d3fade6811af49"
];

// 5. Attractive Help & Reward Text
const rewardInfo = `💎 **RMS PREMIUM REWARDS** 💎\n\n` +
    `Dear Users, hum apne active users ko har mahine servers ka gift dete hain! 🏆\n\n` +
    `🎁 **Prizes:**\n` +
    `✨ **1-3 Months Recharge** - (Funcam / Ashare / Forever)\n` +
    `🔥 **Daily Bonus:** Use /daily for extra points!\n\n` +
    `📜 **Rules:**\n` +
    `Top 20 list se har mahine **1 Lucky Winner** chuna jayega.\n` +
    `Jitne zyada points, utne zyada chances! 🚀\n\n` +
    `👉 Use /watch to start!`;

// 6. Auto-Broadcast (Every 2 Hours Reminder)
setInterval(async () => {
    try {
        if (GROUP_ID) {
            await bot.api.sendMessage(GROUP_ID, `📣 **REMINDER:** Don't miss your chance to win a Free Recharge! 🎁\nWatch ads now to stay in the Top 20.\n\n👉 Type /watch to start!`, { parse_mode: "Markdown" });
        }
    } catch (e) { console.log("Broadcast skipped..."); }
}, 2 * 60 * 60 * 1000);

// 7. Admin Buttons Generator
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

// --- CALLBACK HANDLERS ---
bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    
    if (data === "verify") {
        let user = await User.findOne({ userId: ctx.from.id });
        const timePassed = (Date.now() - user.lastClick) / 1000;
        const target = user.fromGroupId || GROUP_ID;

        if (timePassed < user.requiredWait) {
            const rem = Math.ceil(user.requiredWait - timePassed);
            await ctx.answerCallbackQuery({ text: `Patience! Wait ${rem}s more.`, show_alert: true });
            return;
        }

        user.points += 1; user.lastClick = 0; await user.save();
        await ctx.answerCallbackQuery("Points added! ✅");
        await ctx.editMessageText("✅ Task Completed! Your points have been updated.");
        if (target) {
            await bot.api.sendMessage(target, `✅ @${ctx.from.username} completed a task! Points: ${user.points}`);
        }
        return;
    }

    if (ctx.from.id.toString() !== ADMIN_ID) return;

    try {
        if (data === "admin_top") {
            const top = await User.find().sort({ points: -1 }).limit(20);
            const kb = new InlineKeyboard();
            top.forEach(u => kb.text(`${u.username || u.userId} (${u.points})`, `manage_${u.userId}`).row());
            kb.text("🔍 Search by ID", "admin_search");
            return await ctx.editMessageText("🏆 **ADMIN CONTROL: Select User**", { reply_markup: kb });
        }
        if (data === "admin_search") return await ctx.editMessageText("🔍 **ID Search:**\nType `/search [User_ID]` in chat.");
        
        if (data.startsWith("manage_")) {
            const tId = data.split("_")[1];
            return await ctx.editMessageText(`👤 **Target ID:** \`${tId}\`\nUpdate Points:`, { reply_markup: createPointButtons(tId), parse_mode: "Markdown" });
        }
        if (data.startsWith("pts_")) {
            const [, action, amount, tId] = data.split("_");
            const val = action === "add" ? parseInt(amount) : -parseInt(amount);
            const user = await User.findOneAndUpdate({ userId: tId }, { $inc: { points: val } }, { new: true });
            await ctx.answerCallbackQuery(`Now: ${user.points}`);
            return await ctx.editMessageText(`👤 **User:** \`${tId}\`\n✅ **Updated Points:** **${user.points}**`, { reply_markup: createPointButtons(tId), parse_mode: "Markdown" });
        }
    } catch (e) { console.log(e); }
});

// --- COMMANDS ---
bot.command("start", (ctx) => ctx.reply(`Welcome to RMS Rewards! 🎖️\n\n${rewardInfo}`, { parse_mode: "Markdown" }));
bot.command("help", (ctx) => ctx.reply(rewardInfo, { parse_mode: "Markdown" }));

bot.command("daily", async (ctx) => {
    let user = await User.findOne({ userId: ctx.from.id }) || await User.create({ userId: ctx.from.id, username: ctx.from.username });
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const diff = now - user.lastDaily;

    if (diff < oneDay) return ctx.reply(`⏳ Next bonus in **${Math.ceil((oneDay-diff)/(60*60*1000))}h**.`);
    
    user.streak = (diff < 2 * oneDay) ? user.streak + 1 : 1;
    let bonus = 5;
    if (user.streak === 7) { bonus += 100; user.streak = 0; }
    
    user.points += bonus; user.lastDaily = now; await user.save();
    ctx.reply(`🔥 **Daily Bonus!** +${bonus} Points. Streak: **${user.streak} Days**`);
});

bot.command("watch", async (ctx) => {
    const isGroup = ctx.chat.type !== "private";
    const wait = Math.floor(Math.random() * 20) + 15;
    const link = adLinks[Math.floor(Math.random() * adLinks.length)];
    let user = await User.findOne({ userId: ctx.from.id }) || await User.create({ userId: ctx.from.id, username: ctx.from.username });
    user.fromGroupId = isGroup ? ctx.chat.id.toString() : user.fromGroupId;
    user.lastClick = Date.now(); user.requiredWait = wait; await user.save();
    
    const kb = new InlineKeyboard().webApp("Watch Ad 📺", link).row().text("Verify Ad ✅", "verify");
    if (isGroup) {
        try {
            await bot.api.sendMessage(ctx.from.id, `📺 **Ad Task:** ${wait}s duration.`, { reply_markup: kb });
            await ctx.reply(`✅ @${ctx.from.username}, link sent in Private DM!`);
        } catch (e) { await ctx.reply("❌ Start the bot in Private first!"); }
    } else {
        await ctx.reply(`📺 **Duration:** ${wait}s`, { reply_markup: kb });
    }
});

bot.command("search", async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    const tId = ctx.match.trim();
    if (!tId) {
        const top = await User.find().sort({ points: -1 }).limit(20);
        const kb = new InlineKeyboard();
        top.forEach(u => kb.text(`${u.username || u.userId} (${u.points})`, `manage_${u.userId}`).row());
        return ctx.reply("🏆 **Top 20 List:**", { reply_markup: kb });
    }
    let user = await User.findOne({ userId: tId }) || await User.create({ userId: tId, username: "Manual_Entry" });
    ctx.reply(`👤 **User Found:** ${user.username}\n📊 **Points:** ${user.points}`, { reply_markup: createPointButtons(tId) });
});

bot.command("setpoints", async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    const args = ctx.match.split(" ");
    if (args.length < 2) return ctx.reply("Format: `/setpoints ID Points`");
    await User.findOneAndUpdate({ userId: args[0] }, { points: parseInt(args[1]) });
    ctx.reply(`✅ Updated ${args[0]} to ${args[1]} points.`);
});

bot.command("admin", (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    const kb = new InlineKeyboard().text("🏆 Top 20", "admin_top").text("🔍 Search ID", "admin_search");
    ctx.reply("🛠 **RMS ADMIN PANEL**", { reply_markup: kb });
});

bot.start();
