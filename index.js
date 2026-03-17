const { Bot, InlineKeyboard } = require("grammy");
const mongoose = require("mongoose");
require("dotenv").config();

const bot = new Bot(process.env.BOT_TOKEN);
const GROUP_ID = process.env.GROUP_ID; // Railway variables mein apna Group ID zaroor dalein

mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("DB Connected! ✅"))
  .catch(err => console.error("DB Error:", err));

const User = mongoose.model("User", {
    userId: Number,
    username: String,
    points: { type: Number, default: 0 },
    rank: { type: String, default: "User" },
    requiredWait: { type: Number, default: 0 },
    lastClick: { type: Number, default: 0 },
    fromGroupId: String // Track karne ke liye ki reporting kahan karni hai
});

const adLinks = [
    "https://www.effectivegatecpm.com/yw8cx1x13?key=db61c612d8fd01748bd4401f2323fd8f",
    "https://www.effectivegatecpm.com/kb96c0gieh?key=6b9065c47c1e21512fe3e8bced33144a",
    "https://www.effectivegatecpm.com/tiq1i1nwcs?key=9929dc9f815c415d0550bb3f64c1d854",
    "https://www.effectivegatecpm.com/pa3wchg46?key=3d881e1e67e1030ab609a17b17695d93",
    "https://www.effectivegatecpm.com/ieik85vff?key=d58462324f8afb5e36d3fade6811af49"
];

// --- 1. EVERY 2 HOURS AUTO-MESSAGE ---
setInterval(async () => {
    try {
        if (GROUP_ID) {
            await bot.api.sendMessage(GROUP_ID, "📢 **Reminder:** Watch ads now to boost your ranking and become a **PRO USER**! Type /watch to start. 🚀");
        }
    } catch (e) { console.log("Broadcast error"); }
}, 2 * 60 * 60 * 1000); 

// --- 2. WATCH LOGIC (Group to Private) ---
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
            await bot.api.sendMessage(userId, `📺 **Ad Task Started!**\nDuration: ${randomTime}s\nWait for the timer, then click Verify.`, { reply_markup: kb });
            await ctx.reply(`✅ @${ctx.from.username}, I've sent the ad to your Private DM. Check it now!`);
        } catch (e) {
            await ctx.reply(`❌ @${ctx.from.username}, please start the bot in private first!`);
        }
    } else {
        await ctx.reply(`📺 **Ad Duration:** ${randomTime}s`, { reply_markup: kb });
    }
});

// --- 3. VERIFY & PUBLIC REPORTING ---
bot.on("callback_query:data", async (ctx) => {
    if (ctx.callbackQuery.data === "verify") {
        let user = await User.findOne({ userId: ctx.from.id });
        const timePassed = (Date.now() - user.lastClick) / 1000;
        const groupTarget = user.fromGroupId || GROUP_ID;

        if (timePassed < user.requiredWait) {
            const rem = Math.ceil(user.requiredWait - timePassed);
            if (groupTarget) await bot.api.sendMessage(groupTarget, `⚠️ **FAILED:** @${ctx.from.username} tried to verify too early (${rem}s left). No points added.`);
            return ctx.answerCallbackQuery({ text: "Too early! Report sent to group.", show_alert: true });
        }

        user.points += 1;
        user.lastClick = 0;
        await user.save();
        
        if (groupTarget) await bot.api.sendMessage(groupTarget, `✅ **SUCCESS:** @${ctx.from.username} watched the full ad! +1 Point added. (Total: ${user.points})`);
        await ctx.answerCallbackQuery({ text: "Success! Check group for report.", show_alert: true });
        await ctx.editMessageText("Task Completed! ✅");
    }
});

// --- 4. ADVANCED ADMIN PANEL ---
bot.command("admin", async (ctx) => {
    if (ctx.from.id.toString() !== process.env.ADMIN_ID) return;
    const kb = new InlineKeyboard().text("🏆 Top 10", "admin_top").text("🔍 Search", "admin_search");
    await ctx.reply("🛠 **RMS ADMIN PANEL**", { reply_markup: kb });
});

bot.command("setpoints", async (ctx) => {
    if (ctx.from.id.toString() !== process.env.ADMIN_ID) return;
    const args = ctx.match.split(" ");
    if (args.length < 2) return ctx.reply("Use: /setpoints [ID] [Points]");
    await User.findOneAndUpdate({ userId: args[0] }, { points: parseInt(args[1]) });
    await ctx.deleteMessage(); // Silent
});

// Reuse management buttons from previous version (manage_, add_, sub_)
// ... (Included in the full logic below)

bot.start();
