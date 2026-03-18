const { Bot, InlineKeyboard } = require("grammy");
const mongoose = require("mongoose");
require("dotenv").config();

// 1. Initialization
const bot = new Bot(process.env.BOT_TOKEN);
const ADMIN_ID = process.env.ADMIN_ID;
const GROUP_ID = process.env.GROUP_ID;
const BOT_USERNAME = "@YourBotUsername"; // 👈 Yahan apna username update karein

mongoose.connect(process.env.MONGO_URL).then(() => console.log("DB Connected! ✅"));

// 2. User Schema
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

// --- 3. AUTO PROCESSES (Reminders & Leaderboard) ---

// 2-Hour Attractive Reminder
setInterval(async () => {
    try {
        if (GROUP_ID) {
            const msg = `🔥 **EARN FREE RECHARGE NOW!** 🔥\n\n` +
                `Don't let your server expire! Watch ads and collect points to win **Funcam/Forever** recharges.\n\n` +
                `💎 **Current Prize:** 1-3 Months Premium Access\n` +
                `🏆 **Criteria:** Min 200 Points for Contest Entry\n\n` +
                `👉 Type /watch to start your journey!`;
            await bot.api.sendMessage(GROUP_ID, msg, { parse_mode: "Markdown" });
        }
    } catch (e) { console.log("Broadcast error"); }
}, 2 * 60 * 60 * 1000);

// 5-Hour Auto Leaderboard
setInterval(async () => {
    try {
        if (GROUP_ID) {
            const top = await User.find().sort({ points: -1 }).limit(10);
            let msg = `📊 **TOP RANKING - LIVE UPDATE** 📊\n\n`;
            top.forEach((u, i) => msg += `${i + 1}. @${u.username || u.userId} — ${u.points} pts\n`);
            msg += `\n✨ *Join the contest now! Earn 2 points per ad and get your free recharge!*`;
            await bot.api.sendMessage(GROUP_ID, msg, { parse_mode: "Markdown" });
        }
    } catch (e) { console.log("LB error"); }
}, 5 * 60 * 60 * 1000);

// --- 4. ADMIN BUTTONS GENERATOR ---
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
        .text("⬅️ Back", "admin_top");
}

// --- 5. LOGIC & HANDLERS ---

bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    
    // User Verify
    if (data === "verify") {
        let user = await User.findOne({ userId: ctx.from.id });
        const timePassed = (Date.now() - user.lastClick) / 1000;
        const target = user.fromGroupId || GROUP_ID;

        if (timePassed < user.requiredWait) {
            const rem = Math.ceil(user.requiredWait - timePassed);
            if (target) await bot.api.sendMessage(target, `❌ **Early Verify:** @${ctx.from.username} failed to watch full ad! (Skipped ${rem}s)`);
            return ctx.answerCallbackQuery({ text: `🚨 Wait ${rem}s!`, show_alert: true });
        }
        user.points += 2; user.lastClick = 0; await user.save();
        await ctx.answerCallbackQuery("Success! +2 Points.");
        return ctx.editMessageText("✅ **Task Completed!** Points added.");
    }

    // Admin Logic
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    if (data === "admin_top") {
        const top = await User.find().sort({ points: -1 }).limit(20);
        const kb = new InlineKeyboard();
        top.forEach(u => kb.text(`${u.username || u.userId} (${u.points})`, `manage_${u.userId}`).row());
        return ctx.editMessageText("🏆 **Select User:**", { reply_markup: kb });
    }
    if (data.startsWith("manage_")) {
        const tId = data.split("_")[1];
        return ctx.editMessageText(`👤 **Target:** \`${tId}\``, { reply_markup: createPointButtons(tId) });
    }
    if (data.startsWith("pts_")) {
        const [, action, amount, tId] = data.split("_");
        const val = action === "add" ? parseInt(amount) : -parseInt(amount);
        const u = await User.findOneAndUpdate({ userId: tId }, { $inc: { points: val } }, { new: true });
        await ctx.answerCallbackQuery(`Now: ${u.points}`);
        return ctx.editMessageText(`👤 **User:** \`${tId}\`\n✅ **Points:** **${u.points}**`, { reply_markup: createPointButtons(tId) });
    }
});

bot.command("daily", async (ctx) => {
    let user = await User.findOne({ userId: ctx.from.id }) || await User.create({ userId: ctx.from.id, username: ctx.from.username });
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const diff = now - user.lastDaily;

    if (diff < oneDay) return ctx.reply(`⏳ Next claim in **${Math.ceil((oneDay - diff) / (60 * 60 * 1000))}h**.`);

    if (diff > 2 * oneDay) {
        const missed = Math.floor(diff / oneDay) - 1;
        let penalty = missed >= 10 ? 50 : missed * 5;
        user.points = Math.max(-100, user.points - penalty);
        ctx.reply(`⚠️ **Penalty:** Missed check-in! **-${penalty} Points**.`);
        user.streak = 1;
    } else { user.streak += 1; }

    user.points += 5; user.lastDaily = now; await user.save();
    ctx.reply(`🔥 **Daily Bonus!** +5 Points. Streak: **${user.streak} Days**`);
});

bot.command("watch", async (ctx) => {
    if (ctx.chat.type !== "private") {
        try {
            await bot.api.sendChatAction(ctx.from.id, "typing");
            await ctx.reply(`✅ @${ctx.from.username}, link sent in DM!`);
        } catch (e) {
            return ctx.reply(`❌ **Start the bot in Private first!**\nClick ${BOT_USERNAME} and start to earn points.`);
        }
    }
    const wait = Math.floor(Math.random() * 20) + 20;
    const link = adLinks[Math.floor(Math.random() * adLinks.length)];
    let user = await User.findOne({ userId: ctx.from.id }) || await User.create({ userId: ctx.from.id, username: ctx.from.username });
    user.fromGroupId = (ctx.chat.type !== "private") ? ctx.chat.id.toString() : user.fromGroupId;
    user.lastClick = Date.now(); user.requiredWait = wait; await user.save();
    const kb = new InlineKeyboard().webApp("Watch Ad 📺", link).row().text("Verify Points ✅", "verify");
    await bot.api.sendMessage(ctx.from.id, `📺 **Ad Task** (${wait}s)`, { reply_markup: kb });
});

bot.command("help", (ctx) => {
    const helpMsg = `📜 **CONTEST RULES**\n\n1️⃣ **Ad:** +2 Pts\n2️⃣ **Daily:** +5 Pts\n3️⃣ **Entry:** 200 Pts Min.\n\n⚠️ **PENALTIES:**\n• Miss 1 Day: -5 Pts\n• Miss 10 Days: -50 Pts\n• Skip Ad: Public Report!`;
    ctx.reply(helpMsg);
});

bot.command("admin", (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    const kb = new InlineKeyboard().text("🏆 Top 20", "admin_top");
    ctx.reply("🛠 **ADMIN PANEL**", { reply_markup: kb });
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
    ctx.reply(`👤 **Found:** ${user.username}\n📊 **Points:** ${user.points}`, { reply_markup: createPointButtons(tId) });
});

bot.command("leaderboard", async (ctx) => {
    const top = await User.find().sort({ points: -1 }).limit(10);
    let msg = `🏆 **LEADERBOARD** 🏆\n\n`;
    top.forEach((u, i) => msg += `${i+1}. @${u.username || u.userId} — ${u.points} pts\n`);
    ctx.reply(msg);
});

bot.command("status", async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    if (!u) return ctx.reply("Start with /watch!");
    ctx.reply(`👤 @${u.username}\n📊 Points: ${u.points}\n🔥 Streak: ${u.streak} Days\n\n*Min 200 pts needed.*`);
});

bot.start();
