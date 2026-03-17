const { Bot, InlineKeyboard } = require("grammy");
const mongoose = require("mongoose");
require("dotenv").config();

const bot = new Bot(process.env.BOT_TOKEN);

// Database Connection
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("Database Connected!"))
  .catch(err => console.log("DB Error:", err));

// User Schema
const User = mongoose.model("User", {
    userId: Number,
    username: String,
    points: { type: Number, default: 0 },
    rank: { type: String, default: "User" }
});

// Start Command
bot.command("start", (ctx) => ctx.reply("Welcome! Use /watch to earn points and rank up to PRO USER."));

// Watch Ad Command
bot.command("watch", async (ctx) => {
    const keyboard = new InlineKeyboard()
        .url("Watch Ad 📺", "https://your-ad-link.com") // Yahan apna ad link dalein
        .row()
        .text("Verify ✅", "verify");
    await ctx.reply("Ad dekhne ke baad Verify button dabayein!", { reply_markup: keyboard });
});

// Verify Ad & Ranking Logic
bot.callbackQuery("verify", async (ctx) => {
    let user = await User.findOne({ userId: ctx.from.id });
    if (!user) user = await User.create({ userId: ctx.from.id, username: ctx.from.username });

    user.points += 1;
    
    if (user.points >= 50 && user.rank !== "PRO USER") {
        user.rank = "PRO USER";
        await ctx.reply(`🎉 Badhai ho @${ctx.from.username}! Aap ab **PRO USER** ban gaye hain!`);
    }
    
    await user.save();
    await ctx.answerCallbackQuery(`Points Added! Total: ${user.points}`);
});

// Admin Command to Manage Rank
bot.command("setrank", async (ctx) => {
    if (ctx.from.id.toString() !== process.env.ADMIN_ID) return ctx.reply("Access Denied!");
    const args = ctx.match.split(" "); 
    const targetId = args[0];
    const newPoints = args[1];
    await User.findOneAndUpdate({ userId: Number(targetId) }, { points: Number(newPoints) });
    ctx.reply(`User ${targetId} ka rank update kar diya gaya hai.`);
});

bot.start();
