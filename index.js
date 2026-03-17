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

// 4. Ads Links
const adLinks = [
    "https://www.effectivegatecpm.com/yw8cx1x13?key=db61c612d8fd01748bd4401f2323fd8f",
    "https://www.effectivegatecpm.com/kb96c0gieh?key=6b9065c47c1e21512fe3e8bced33144a",
    "https://www.effectivegatecpm.com/tiq1i1nwcs?key=9929dc9f815c415d0550bb3f64c1d854",
    "https://www.effectivegatecpm.com/pa3wchg46?key=3d881e1e67e1030ab609a17b17695d93",
    "https://www.effectivegatecpm.com/ieik85vff?key=d58462324f8afb5e36d3fade6811af49"
];

// 5. Professional Help & Reward Text
const rewardInfo = `💎 **RMS PREMIUM REWARDS** 💎\n\nEarn points daily to win FREE STB recharges!\n\n🎁 **Rewards:**\n✨ 1-3 Months **Funcam / Ashare / Forever**\n\n🏆 **How to win?**\nWe pick 1 winner from the Top List every month. More points = More chances! 🚀`;

// 6. Admin Point Buttons Generator
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

// 7. Auto-Broadcast (Every 2 Hours)
setInterval(async () => {
    try {
        if (GROUP_ID) {
            await bot.api.sendMessage(GROUP_ID, `📣 **ACTIVE GIVEAWAY!**\nDon't miss your chance to win a Free Recharge! 🎁\n👉 Type /watch to start!`, { parse_mode: "Markdown" });
        }
    } catch (e) { console.log("Broadcast error"); }
}, 2 * 60 * 60 * 1000);

// --- CALLBACK LOGIC ---
bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    if (ctx.from.id.toString() !== ADMIN_ID && !data.includes("verify")) return;

    try {
        if (data === "admin_top" || data === "admin_main") {
            const top = await User.find().sort({ points: -1 }).limit(20);
            const kb = new InlineKeyboard();
            top.forEach(u => kb.text(`${u.username || u.userId} (${u.points})`, `manage_${u.userId}`).row());
            kb.text("🔍 Search by ID", "admin_search");
            return await ctx.editMessageText("🏆 **ADMIN CONTROL: Select User**", { reply_markup: kb });
        }
        if (data.startsWith("manage_")) {
            const tId = data.split("_")[1];
            return await ctx.editMessageText(`👤 **Target User:** \`${tId}\`\nUpdate Points:`, { reply_markup: createPointButtons(tId), parse_mode: "Markdown" });
        }
        if (data.startsWith("pts_")) {
            const [, action, amount, tId] = data.split("_");
            const val = action === "add" ? parseInt(amount) : -parseInt(amount);
            const user = await User.findOneAndUpdate({ userId: tId }, { $inc: { points: val } }, { new: true });
            await ctx.answerCallbackQuery(`Updated! Now: ${user.points}`);
            return await ctx.editMessageText(`👤 **User:** \`${tId}\`\n✅ **Current Points:** **${user.points}**`, { reply_markup: createPointButtons(tId), parse_mode: "Markdown" });
        }
        if (data === "verify") {
            let user = await User.findOne({ userId: ctx.from.id });
            const timePassed = (Date.now() - user.lastClick) / 1000;
            const target = user.fromGroupId || GROUP_ID;
            if (timePassed < user.requiredWait) {
                const rem = Math.ceil(user.requiredWait - timePassed);
                if (target) await bot.api.sendMessage(target, `⚠️ @${ctx.from.username} failed! ${rem}s early.`);
                return ctx.answerCallbackQuery({ text: `Wait ${rem}s!`, show_alert: true });
            }
            user.points += 1; user.lastClick = 0; await user.save();
            if (target) await bot.api.sendMessage(target, `✅ @${ctx.from.username} success! Points: ${user.points}`);
            await ctx.answerCallbackQuery("Success!");
            return await ctx.editMessageText("Task Completed! ✅");
        }
    } catch (e) { console.log(e); }
});

// --- COMMANDS ---
bot.command("start", (ctx) => ctx.reply(`Welcome! 🎖️\n\n${rewardInfo}`, { parse_mode: "Markdown" }));

bot.command("daily", async (ctx) => {
    let user = await User.findOne({ userId: ctx.from.id }) || await User.create({ userId: ctx.from.id, username: ctx.from.username });
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const diff = now - user.lastDaily;

    if (diff < oneDay) return ctx.reply(`⏳ Claim again in **${Math.ceil((oneDay-diff)/(60*60*1000))}h**.`);
    
    user.streak = (diff < 2 * oneDay) ? user.streak + 1 : 1;
    let bonus = 5;
    let msg = `🔥 **Bonus Claimed!** +5 Points. Streak: **${user.streak} Days**`;

    if (user.streak === 7) {
        bonus += 100; user.streak = 0;
        msg = `🎉 **7-DAY STREAK!** You earned **105 Points!**`;
    }
    user.points += bonus; user.lastDaily = now; await user.save();
    ctx.reply(msg);
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
            await bot.api.sendMessage(ctx.from.id, `📺 Duration: ${wait}s`, { reply_markup: kb });
            await ctx.reply(`✅ @${ctx.from.username}, link sent in DM!`);
        } catch (e) { await ctx.reply("❌ Start bot in private first!"); }
    } else {
        await ctx.reply(`📺 Duration: ${wait}s`, { reply_markup: kb });
    }
});

bot.command("search", async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    const tId = ctx.match;
    if (!tId) {
        const top = await User.find().sort({ points: -1 }).limit(20);
        const kb = new InlineKeyboard();
        top.forEach(u => kb.text(`${u.username || u.userId} (${u.points})`, `manage_${u.userId}`).row());
        return ctx.reply("🏆 **Top 20 List:**", { reply_markup: kb });
    }
    let user = await User.findOne({ userId: tId }) || await User.create({ userId: tId, username: "Manual_Entry" });
    ctx.reply(`👤 **User Found:** ${user.username}\n📊 **Points:** ${user.points}`, { reply_markup: createPointButtons(tId) });
});

bot.command("status", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (!user) return ctx.reply("No data.");
    ctx.reply(`👤 @${user.username}\n📊 Points: ${user.points}\n🔥 Streak: ${user.streak} Days`);
});

bot.command("admin", (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    const kb = new InlineKeyboard().text("🏆 Top 20", "admin_top").text("🔍 Search ID", "admin_search");
    ctx.reply("🛠 **RMS ADMIN PANEL**", { reply_markup: kb });
});

bot.start();
