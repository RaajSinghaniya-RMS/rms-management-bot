const { Bot, InlineKeyboard } = require("grammy");
const mongoose = require("mongoose");
require("dotenv").config();

// Bot Initialization
const bot = new Bot(process.env.BOT_TOKEN);

// Database Connection
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("Database Connected Successfully!"))
  .catch(err => console.error("Database Connection Error:", err));

// User Schema
const User = mongoose.model("User", {
    userId: Number,
    username: String,
    points: { type: Number, default: 0 },
    rank: { type: String, default: "User" },
    requiredWait: { type: Number, default: 0 },
    lastClick: { type: Number, default: 0 }
});

// 5 Adsterra Links
const adLinks = [
    "https://www.effectivegatecpm.com/yw8cx1x13?key=db61c612d8fd01748bd4401f2323fd8f",
    "https://www.effectivegatecpm.com/kb96c0gieh?key=6b9065c47c1e21512fe3e8bced33144a",
    "https://www.effectivegatecpm.com/tiq1i1nwcs?key=9929dc9f815c415d0550bb3f64c1d854",
    "https://www.effectivegatecpm.com/pa3wchg46?key=3d881e1e67e1030ab609a17b17695d93",
    "https://www.effectivegatecpm.com/ieik85vff?key=d58462324f8afb5e36d3fade6811af49"
];

// Start Command
bot.command("start", (ctx) => {
    return ctx.reply("Welcome to the RMS Management Bot! 🎖️\n\nCommands:\n/watch - Earn points via ads\n/leaderboard - See top ranked users\n/status - Check your current points");
});

// Watch Command
bot.command("watch", async (ctx) => {
    try {
        const randomTime = Math.floor(Math.random() * (45 - 15 + 1)) + 15;
        const randomAdLink = adLinks[Math.floor(Math.random() * adLinks.length)];
        
        const keyboard = new InlineKeyboard()
            .url("Watch Full Ad 📺", randomAdLink)
            .row()
            .text("Verify Ad ✅", "verify");
        
        let user = await User.findOne({ userId: ctx.from.id });
        if (!user) {
            user = await User.create({ userId: ctx.from.id, username: ctx.from.username || "Anonymous" });
        }
        
        user.lastClick = Date.now();
        user.requiredWait = randomTime;
        await user.save();

        await ctx.reply(`📺 **Ad Loaded!**\n\n⚠️ **Wait Duration:** ${randomTime} seconds.\n\nWatch the full ad and wait for the timer before clicking Verify!`, { reply_markup: keyboard });
    } catch (e) {
        console.error(e);
    }
});

// Verify Callback
bot.on("callback_query:data", async (ctx) => {
    if (ctx.callbackQuery.data === "verify") {
        try {
            let user = await User.findOne({ userId: ctx.from.id });
            if (!user || !user.lastClick) return ctx.answerCallbackQuery({ text: "Please click /watch first!", show_alert: true });

            const timePassed = (Date.now() - user.lastClick) / 1000;

            if (timePassed < user.requiredWait) {
                const remaining = Math.ceil(user.requiredWait - timePassed);
                return ctx.answerCallbackQuery({ text: `❌ Still playing! Wait ${remaining} more seconds.`, show_alert: true });
            }

            user.points += 1;
            
            if (user.points >= 50 && user.rank !== "PRO USER") {
                user.rank = "PRO USER";
                await ctx.reply(`🔥 Congratulations @${ctx.from.username}! You are now a **PRO USER**!`);
            }
            
            user.lastClick = 0; 
            await user.save();
            await ctx.answerCallbackQuery({ text: `Success! Point added. Total: ${user.points} ✅`, show_alert: true });
        } catch (e) {
            console.error(e);
        }
    }
});

// Leaderboard
bot.command("leaderboard", async (ctx) => {
    try {
        const topUsers = await User.find().sort({ points: -1 }).limit(10);
        let message = "🏆 **TOP 10 RANKING** 🏆\n\n";
        topUsers.forEach((u, index) => {
            const tag = u.rank === "PRO USER" ? "🎖️ [PRO]" : "";
            message += `${index + 1}. @${u.username || "User"} - ${u.points} pts ${tag}\n`;
        });
        await ctx.reply(message, { parse_mode: "Markdown" });
    } catch (e) {
        console.error(e);
    }
});

// Status
bot.command("status", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        if (!user) return ctx.reply("No data found. Start watching ads!");
        await ctx.reply(`👤 **User:** @${user.username}\n📊 **Points:** ${user.points}\n🎖️ **Rank:** ${user.rank}`);
    } catch (e) {
        console.error(e);
    }
});

// Admin command
bot.command("setrank", async (ctx) => {
    if (ctx.from.id.toString() !== process.env.ADMIN_ID) return;
    const args = ctx.match.split(" ");
    if (args.length < 2) return ctx.reply("Usage: /setrank [UserID] [Points]");
    await User.findOneAndUpdate({ userId: Number(args[0]) }, { points: Number(args[1]) });
    ctx.reply("Done!");
});

bot.catch((err) => console.error("Bot Error:", err));
bot.start();
