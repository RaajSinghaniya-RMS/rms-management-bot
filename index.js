const { Bot, InlineKeyboard } = require("grammy");
const mongoose = require("mongoose");
require("dotenv").config();

const bot = new Bot(process.env.BOT_TOKEN);

mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("Database Connected Successfully! ✅"))
  .catch(err => console.error("DB Error:", err));

const User = mongoose.model("User", {
    userId: Number,
    username: String,
    points: { type: Number, default: 0 },
    rank: { type: String, default: "User" },
    requiredWait: { type: Number, default: 0 },
    lastClick: { type: Number, default: 0 }
});

const adLinks = [
    "https://www.effectivegatecpm.com/yw8cx1x13?key=db61c612d8fd01748bd4401f2323fd8f",
    "https://www.effectivegatecpm.com/kb96c0gieh?key=6b9065c47c1e21512fe3e8bced33144a",
    "https://www.effectivegatecpm.com/tiq1i1nwcs?key=9929dc9f815c415d0550bb3f64c1d854",
    "https://www.effectivegatecpm.com/pa3wchg46?key=3d881e1e67e1030ab609a17b17695d93",
    "https://www.effectivegatecpm.com/ieik85vff?key=d58462324f8afb5e36d3fade6811af49"
];

// --- GREETING & EXIT LOGIC ---

// When a user joins the group
bot.on("message:new_chat_members", async (ctx) => {
    const newUser = ctx.message.new_chat_members[0].first_name;
    await ctx.reply(`Welcome ${newUser}! 👋\n\nYou can increase your ranking in this group by watching ads. Type /watch to start!`);
});

// When a user leaves the group (Sends Private DM)
bot.on("message:left_chat_member", async (ctx) => {
    const leftUser = ctx.message.left_chat_member;
    try {
        await bot.api.sendMessage(leftUser.id, `Hey ${leftUser.first_name}, we missed you in the group! 😔\n\nYou can still watch ads here to keep your ranking high for when you return! Use /watch.`);
    } catch (e) {
        console.log("Could not send DM, user hasn't started the bot.");
    }
});

// --- CORE COMMANDS ---

bot.command("start", (ctx) => ctx.reply("RMS Management Bot is Active! 🎖️\nUse /watch to earn points."));

bot.command("watch", async (ctx) => {
    const randomTime = Math.floor(Math.random() * (45 - 15 + 1)) + 15;
    const randomAdLink = adLinks[Math.floor(Math.random() * adLinks.length)];
    const keyboard = new InlineKeyboard().webApp("Watch Full Ad 📺", randomAdLink).row().text("Verify Ad ✅", "verify");
    
    let user = await User.findOne({ userId: ctx.from.id });
    if (!user) user = await User.create({ userId: ctx.from.id, username: ctx.from.username || ctx.from.first_name });
    
    user.lastClick = Date.now();
    user.requiredWait = randomTime;
    await user.save();
    await ctx.reply(`📺 **Ad Duration:** ${randomTime}s\nWait for the timer before verifying!`, { reply_markup: keyboard });
});

bot.on("callback_query:data", async (ctx) => {
    if (ctx.callbackQuery.data === "verify") {
        let user = await User.findOne({ userId: ctx.from.id });
        const timePassed = (Date.now() - user.lastClick) / 1000;
        if (timePassed < user.requiredWait) return ctx.answerCallbackQuery({ text: `❌ Wait ${Math.ceil(user.requiredWait - timePassed)}s`, show_alert: true });
        
        user.points += 1;
        if (user.points >= 50 && user.rank !== "PRO USER") user.rank = "PRO USER";
        user.lastClick = 0;
        await user.save();
        await ctx.answerCallbackQuery({ text: `Point added! Total: ${user.points} ✅`, show_alert: true });
    }
});

// --- ADMIN & RANKING LOGIC ---

// SILENT ADMIN COMMAND (Points edit)
bot.command("setrank", async (ctx) => {
    if (ctx.from.id.toString() !== process.env.ADMIN_ID) return;
    const args = ctx.match.split(" ");
    if (args.length < 2) return;
    
    await User.findOneAndUpdate({ userId: Number(args[0]) }, { points: Number(args[1]) });
    // Silently delete the command message so no one sees it
    try { await ctx.deleteMessage(); } catch (e) {}
});

// DAILY LEADERBOARD WITH TAGGING
bot.command("leaderboard", async (ctx) => {
    const topUsers = await User.find().sort({ points: -1 }).limit(10);
    let message = "🏆 **DAILY RANKING UPDATE** 🏆\n\n";
    for (let u of topUsers) {
        message += `👤 @${u.username} — ${u.points} Points ${u.rank === "PRO USER" ? "🎖️" : ""}\n`;
    }
    await ctx.reply(message);
});

bot.start();
