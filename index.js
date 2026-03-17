const { Bot, InlineKeyboard } = require("grammy");
const mongoose = require("mongoose");
require("dotenv").config();

const bot = new Bot(process.env.BOT_TOKEN);

mongoose.connect(process.env.MONGO_URL).then(() => console.log("DB Connected!"));

const User = mongoose.model("User", {
    userId: Number,
    username: String,
    points: { type: Number, default: 0 },
    rank: { type: String, default: "User" },
    requiredWait: Number, // Har baar naya time save hoga
    lastClick: Number
});

bot.command("start", (ctx) => ctx.reply("Welcome! Use /watch to earn points and get PRO USER tag. 🎖️"));

bot.command("watch", async (ctx) => {
    // 15 se 45 seconds ke beech random time generate karna
    const randomTime = Math.floor(Math.random() * (45 - 15 + 1)) + 15;
    
    const keyboard = new InlineKeyboard()
        .url("Watch Full Ad 📺", "https://www.effectivegatecpm.com/ieik85vff?key=d58462324f8afb5e36d3fade6811af49")
        .row()
        .text("Verify Ad ✅", "verify");
    
    let user = await User.findOne({ userId: ctx.from.id });
    if (!user) user = await User.create({ userId: ctx.from.id, username: ctx.from.username });
    
    user.lastClick = Date.now();
    user.requiredWait = randomTime; // Is baar user ko itna rukna hoga
    await user.save();

    await ctx.reply(`Ad load ho rahi hai... 📺\n\n⚠️ **Dhyan dein:** Is ad ki length **${randomTime} seconds** hai. Agar aapne isse pehle Verify dabaya toh points nahi milenge!`, { reply_markup: keyboard });
});

bot.callbackQuery("verify", async (ctx) => {
    let user = await User.findOne({ userId: ctx.from.id });
    if (!user || !user.lastClick) return ctx.answerCallbackQuery("Pehle /watch command use karein!");

    const timePassed = (Date.now() - user.lastClick) / 1000;

    if (timePassed < user.requiredWait) {
        const remaining = Math.ceil(user.requiredWait - timePassed);
        return ctx.answerCallbackQuery(`❌ Ad abhi chal rahi hai! ${remaining} seconds aur intezar karein.`, { show_alert: true });
    }

    user.points += 1;
    // Har 50 points par PRO rank
    if (user.points % 50 === 0) {
        user.rank = "PRO USER";
        await ctx.reply(`🔥 Badhai ho @${ctx.from.username}! Aapne ads complete ki hain aur aap ab **PRO USER** ban gaye hain!`);
    }
    
    user.lastClick = null; // Reset taaki user dubara bina click kiye verify na kar sake
    await user.save();
    await ctx.answerCallbackQuery(`Shabash! Points added. Total: ${user.points} ✅`, { show_alert: true });
});

bot.start();
