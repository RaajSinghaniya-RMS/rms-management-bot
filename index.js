const { Bot, InlineKeyboard } = require("grammy");
const mongoose = require("mongoose");
require("dotenv").config();

// 1. Initialization
const bot = new Bot(process.env.BOT_TOKEN);
const ADMIN_ID = process.env.ADMIN_ID;
const GROUP_ID = process.env.GROUP_ID;
const BOT_USERNAME = "@TgGMABot"; // 👈 Yahan apna asli username update karein

mongoose.connect(process.env.MONGO_URL).then(() => console.log("DB Connected! ✅"));

// 2. Database Schema
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

const adLinks = [
    "https://www.effectivegatecpm.com/yw8cx1x13?key=db61c612d8fd01748bd4401f2323fd8f",
    "https://www.effectivegatecpm.com/kb96c0gieh?key=6b9065c47c1e21512fe3e8bced33144a",
    "https://www.effectivegatecpm.com/tiq1i1nwcs?key=9929dc9f815c415d0550bb3f64c1d854",
    "https://www.effectivegatecpm.com/pa3wchg46?key=3d881e1e67e1030ab609a17b17695d93",
    "https://www.effectivegatecpm.com/ieik85vff?key=d58462324f8afb5e36d3fade6811af49"
];

// 3. Attractive Reward & Help Text
const rewardInfo = `💎 **Track And Play  PREMIUM REWARDS** 💎\n\n` +
    `Dear Users, watch ads daily to win FREE STB recharges! 🏆\n\n` +
    `🎁 **Prizes:**\n` +
    `✨ **1-3 Months Recharge** - (Funcam / Ashare / Forever)\n` +
    `🔥 **Daily Bonus:** Use /daily for +5 points!\n\n` +
    `📜 **Rules:**\n` +
    `• Ad view = **+2 Points**\n` +
    `• Min 200 pts for Contest Entry\n` +
    `• Missing Daily Check-in = **-5 to -50 Points Penalty**\n\n` +
    `🚀 Jitne zyada points, utne zyada chances! Use /watch now.`;

// 4. Admin Buttons Generator
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

// 5. Auto-Broadcast (Every 2 Hours)
setInterval(async () => {
    try {
        if (GROUP_ID) {
            await bot.api.sendMessage(GROUP_ID, `📣 **REMINDER:** Don't miss your chance to win a Free Recharge! 🎁\n👉 Type /watch to join the contest!`, { parse_mode: "Markdown" });
        }
    } catch (e) {}
}, 2 * 60 * 60 * 1000);

// --- 6. CALLBACK HANDLERS ---
bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    if (data === "verify") {
        let user = await User.findOne({ userId: ctx.from.id });
        const timePassed = (Date.now() - user.lastClick) / 1000;
        const target = user.fromGroupId || GROUP_ID;

        if (timePassed < user.requiredWait) {
            const rem = Math.ceil(user.requiredWait - timePassed);
            if (target) await bot.api.sendMessage(target, `❌ **Early Verify:** @${ctx.from.username} skipped ad! (${rem}s left)`);
            return ctx.answerCallbackQuery({ text: `🚨 Wait ${rem}s!`, show_alert: true });
        }
        user.points += 2; user.lastClick = 0; await user.save();
        await ctx.answerCallbackQuery("Success! +2 Points added.");
        return ctx.editMessageText("✅ **Task Completed!** Your points have been updated.");
    }

    if (ctx.from.id.toString() !== ADMIN_ID) return;
    if (data === "admin_top") {
        const top = await User.find().sort({ points: -1 }).limit(20);
        const kb = new InlineKeyboard();
        top.forEach(u => kb.text(`${u.username || u.userId} (${u.points})`, `manage_${u.userId}`).row());
        return ctx.editMessageText("🏆 **Select User:**", { reply_markup: kb });
    }
    if (data.startsWith("manage_")) {
        const tId = data.split("_")[1];
        return ctx.editMessageText(`👤 **Target ID:** \`${tId}\``, { reply_markup: createPointButtons(tId) });
    }
    if (data.startsWith("pts_")) {
        const [, action, amount, tId] = data.split("_");
        const val = action === "add" ? parseInt(amount) : -parseInt(amount);
        const u = await User.findOneAndUpdate({ userId: tId }, { $inc: { points: val } }, { new: true });
        await ctx.answerCallbackQuery(`Updated! Now: ${u.points}`);
        return ctx.editMessageText(`👤 **User:** \`${tId}\`\n✅ **Points:** **${u.points}**`, { reply_markup: createPointButtons(tId) });
    }
});

// --- 7. COMMAND HANDLERS ---

bot.command("start", (ctx) => ctx.reply(`Welcome to RMS Rewards! 🎖️\n\n${rewardInfo}`, { parse_mode: "Markdown" }));

bot.command("help", (ctx) => ctx.reply(rewardInfo, { parse_mode: "Markdown" }));

bot.command("daily", async (ctx) => {
    let user = await User.findOne({ userId: ctx.from.id }) || await User.create({ userId: ctx.from.id, username: ctx.from.username });
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const diff = now - user.lastDaily;

    if (diff < oneDay) return ctx.reply(`⏳ Next claim in **${Math.ceil((oneDay-diff)/(60*60*1000))}h**.`);

    if (diff > 2 * oneDay) {
        const missed = Math.floor(diff/oneDay) - 1;
        let penalty = missed >= 10 ? 50 : missed * 5;
        user.points = Math.max(-100, user.points - penalty);
        ctx.reply(`⚠️ **Penalty:** You missed check-in! **-${penalty} Points** deducted.`);
        user.streak = 1;
    } else { user.streak += 1; }

    user.points += 5; user.lastDaily = now; await user.save();
    ctx.reply(`🔥 **Daily Bonus!** +5 Points added. Streak: **${user.streak} Days**`);
});

bot.command("watch", async (ctx) => {
    if (ctx.chat.type !== "private") {
        try {
            await bot.api.sendChatAction(ctx.from.id, "typing");
            await ctx.reply(`✅ @${ctx.from.username}, link sent in DM!`);
        } catch (e) {
            return ctx.reply(`❌ **Start the bot first!**\nClick ${BOT_USERNAME} and press Start to earn.`);
        }
    }
    const wait = 25;
    const link = adLinks[Math.floor(Math.random() * adLinks.length)];
    let user = await User.findOne({ userId: ctx.from.id }) || await User.create({ userId: ctx.from.id, username: ctx.from.username });
    user.fromGroupId = (ctx.chat.type !== "private") ? ctx.chat.id.toString() : user.fromGroupId;
    user.lastClick = Date.now(); user.requiredWait = wait; await user.save();
    const kb = new InlineKeyboard().webApp("Watch Ad 📺", link).row().text("Verify Points ✅", "verify");
    await bot.api.sendMessage(ctx.from.id, `📺 **Ad Task Started** (25s duration)`, { reply_markup: kb });
});

bot.command("status", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (!user) return ctx.reply("Start with /watch first!");
    ctx.reply(`👤 **User:** @${user.username}\n📊 **Points:** ${user.points}\n🔥 **Streak:** ${user.streak} Days\n\n*Min 200 pts for Contest Entry.*`);
});

bot.command("leaderboard", async (ctx) => {
    const top = await User.find().sort({ points: -1 }).limit(10);
    let msg = `🏆 **GLOBAL LEADERBOARD** 🏆\n\n`;
    top.forEach((u, i) => msg += `${i+1}. @${u.username || u.userId} — ${u.points} pts\n`);
    ctx.reply(msg);
});

bot.command("setpoints", async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    const args = ctx.match.split(" ");
    if (args.length < 2) return ctx.reply("Usage: `/setpoints ID Points`.");
    await User.findOneAndUpdate({ userId: args[0] }, { points: parseInt(args[1]) });
    ctx.reply(`✅ Updated ${args[0]} to ${args[1]} points.`);
});

bot.command("admin", (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    const kb = new InlineKeyboard().text("🏆 Top 20", "admin_top");
    ctx.reply("🛠 **RMS ADMIN PANEL**", { reply_markup: kb });
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
    ctx.reply(`👤 **User:** ${user.username}\n📊 **Points:** ${user.points}`, { reply_markup: createPointButtons(tId) });
});

bot.start();
