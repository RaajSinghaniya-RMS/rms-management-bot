const { Bot, InlineKeyboard } = require("grammy");
const mongoose = require("mongoose");
require("dotenv").config();

// 1. Bot Initialization
const bot = new Bot(process.env.BOT_TOKEN);

// 2. Database Connection
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("Database Connected Successfully! ✅"))
  .catch(err => console.error("Database Connection Error:", err));

// 3. User Schema
const User = mongoose.model("User", {
    userId: Number,
    username: String,
    points: { type: Number, default: 0 },
    rank: { type: String, default: "User" },
    requiredWait: { type: Number, default: 0 },
    lastClick: { type: Number, default: 0 }
});

// 4. Your 5 Adsterra Links
const adLinks = [
    "https://www.effectivegatecpm.com/yw8cx1x13?key=db61c612d8fd01748bd4401f2323fd8f",
    "https://www.effectivegatecpm.com/kb96c0gieh?key=6b9065c47c1e21512fe3e8bced33144a",
    "https://www.effectivegatecpm.com/tiq1i1nwcs?key=9929dc9f815c415d0550bb3f64c1d854",
    "https://www.effectivegatecpm.com/pa3wchg46?key=3d881e1e67e1030ab609a17b17695d93",
    "https://www.effectivegatecpm.com/ieik85vff?key=d58462324f8afb5e36d3fade6811af49"
];

// 5. Start Command
bot.command("start", (ctx) => {
    return ctx.reply("Welcome to the RMS Management Bot! 🎖️\n\nCommands:\n/watch - Earn points via ads\n/leaderboard - See top ranked users\n/status - Check your current points");
});

// 6. Watch Command (Using WebApp for Internal Browser)
bot.command("watch", async (ctx) => {
    try {
        const randomTime = Math.floor(Math.random() * (45 - 15 + 1)) + 15;
        const randomAdLink = adLinks[Math.floor(Math.random() * adLinks.length)];
        
        const keyboard = new InlineKeyboard()
            .webApp("Watch Full Ad 📺", randomAdLink) 
            .row()
            .text("Verify Ad ✅", "verify");
        
        let user = await User.findOne({ userId: ctx.from.id });
        if (!user) {
            user = await User.create({ userId: ctx.from.id, username: ctx.from.username || "User" });
        }
        
        user.lastClick = Date.now();
        user.requiredWait = randomTime;
        await user.save();

        await ctx.reply(`📺 **Internal Ad Player Loading...**\n\n⚠️ **Wait Duration:** ${randomTime} seconds.\n\nWatch the full ad inside Telegram and wait for the timer before clicking Verify!`, { reply_markup: keyboard });
    } catch (e) {
        console.error("Watch Error:", e);
    }
});

// 7. Verify Callback Logic
bot.on("callback_query:data", async (ctx) => {
    if (ctx.callbackQuery.data === "verify") {
        try {
            let user = await User.findOne({ userId: ctx.from.id });
            if (!user || !user.lastClick) return ctx.answerCallbackQuery({ text: "Please click 'Watch Full Ad' first!", show_alert: true });

            const timePassed = (Date.now() - user.lastClick) / 1000;

            if (timePassed < user.requiredWait) {
                const remaining = Math.ceil(user.requiredWait - timePassed);
                return ctx.answerCallbackQuery({ text: `❌ Still playing! Please wait ${remaining} more seconds.`, show_alert: true });
            }

            user.points += 1;
            
            // Check for PRO rank (at 50 points)
            if (user.points >= 50 && user.rank !== "PRO USER") {
                user.rank = "PRO USER";
                await ctx.reply(`🔥 Congratulations @${ctx.from.username}! You have reached 50 points and are now a **PRO USER**!`);
            }
            
            user.lastClick = 0; 
            await user.save();
            await ctx.answerCallbackQuery({ text: `Success! Point added. Total: ${user.points} ✅`, show_alert: true });
        } catch (e) {
            console.error("Verify Error:", e);
        }
    }
});

// 8. Leaderboard Command
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
        console.error("Leaderboard Error:", e);
    }
});

// 9. Status Command
bot.command("status", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        if (!user) return ctx.reply("No data found. Start watching ads first!");
        await ctx.reply(`👤 **User:** @${user.username}\n📊 **Points:** ${user.points}\n🎖️ **Rank:** ${user.rank}`);
    } catch (e) {
        console.error("Status Error:", e);
    }
});

// 10. Admin Command: Set Rank manually
bot.command("setrank", async (ctx) => {
    if (ctx.from.id.toString() !== process.env.ADMIN_ID) return;
    const args = ctx.match.split(" ");
    if (args.length < 2) return ctx.reply("Usage: /setrank [UserID] [Points]");
    try {
        await User.findOneAndUpdate({ userId: Number(args[0]) }, { points: Number(args[1]) });
        ctx.reply("User updated successfully! ✅");
    } catch (e) {
        ctx.reply("Error updating user.");
    }
});

bot.catch((err) => console.error("General Bot Error:", err));
bot.start();
