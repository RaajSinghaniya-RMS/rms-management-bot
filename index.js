const { Bot, InlineKeyboard } = require("grammy");
const mongoose = require("mongoose");
require("dotenv").config();

const bot = new Bot(process.env.BOT_TOKEN);
const GROUP_ID = process.env.GROUP_ID;

mongoose.connect(process.env.MONGO_URL).then(() => console.log("DB Connected! ✅"));

const User = mongoose.model("User", {
    userId: Number,
    username: String,
    points: { type: Number, default: 0 },
    rank: { type: String, default: "User" },
    requiredWait: { type: Number, default: 0 },
    lastClick: { type: Number, default: 0 },
    fromGroupId: String
});

const adLinks = [
    "https://www.effectivegatecpm.com/yw8cx1x13?key=db61c612d8fd01748bd4401f2323fd8f",
    "https://www.effectivegatecpm.com/kb96c0gieh?key=6b9065c47c1e21512fe3e8bced33144a",
    "https://www.effectivegatecpm.com/tiq1i1nwcs?key=9929dc9f815c415d0550bb3f64c1d854",
    "https://www.effectivegatecpm.com/pa3wchg46?key=3d881e1e67e1030ab609a17b17695d93",
    "https://www.effectivegatecpm.com/ieik85vff?key=d58462324f8afb5e36d3fade6811af49"
];

// --- COMMAND SUGGESTIONS LOGIC ---
// This will set different menus for Admin and Users
async function setBotCommands() {
    // Commands for everyone
    await bot.api.setMyCommands([
        { command: "watch", description: "Watch ads to earn points" },
        { command: "status", description: "Check your points & rank" },
        { command: "leaderboard", description: "Top 10 users list" },
        { command: "help", description: "Lucky draw & Reward info" }
    ]);

    // Commands only for Admin
    await bot.api.setMyCommands([
        { command: "admin", description: "Open Admin Control Panel" },
        { command: "setpoints", description: "Set custom points for a user" },
        { command: "search", description: "Search/Manage user by ID" },
        { command: "watch", description: "Watch ads" },
        { command: "help", description: "Reward info" }
    ], { scope: { type: "chat", chat_id: parseInt(process.env.ADMIN_ID) } });
}
setBotCommands();

// --- HELP MESSAGE CONTENT ---
const helpText = `🎁 **RMS LUCKY DRAW & REWARDS** 🎁\n\n` +
    `By watching ads and increasing your points, you qualify for our monthly Lucky Draw!\n\n` +
    `🏆 **Prizes:**\n` +
    `One lucky user from the Top List will be selected to win:\n` +
    `✅ **1 Month or 3 Months Recharge**\n` +
    `✅ Supported: **Funcam / Ashare / Forever**\n\n` +
    `Keep watching to stay on top! Use /watch to start.`;

bot.command("help", (ctx) => ctx.reply(helpText));

// Trigger help on Group Join
bot.on("message:new_chat_members", async (ctx) => {
    await ctx.reply(`Welcome ${ctx.message.new_chat_members[0].first_name}! 👋\n\n${helpText}`);
});

// --- CORE LOGIC (Watch, Verify, Admin) ---

bot.command("start", (ctx) => ctx.reply("RMS Bot is ready! Use /help to see rewards."));

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
            await bot.api.sendMessage(userId, `📺 **Task Started!**\nDuration: ${randomTime}s`, { reply_markup: kb });
            await ctx.reply(`✅ @${ctx.from.username}, Ad link sent to your DM!`);
        } catch (e) {
            await ctx.reply(`❌ @${ctx.from.username}, please start the bot in private first!`);
        }
    } else {
        await ctx.reply(`📺 **Duration:** ${randomTime}s`, { reply_markup: kb });
    }
});

bot.on("callback_query:data", async (ctx) => {
    if (ctx.callbackQuery.data === "verify") {
        let user = await User.findOne({ userId: ctx.from.id });
        const timePassed = (Date.now() - user.lastClick) / 1000;
        const groupTarget = user.fromGroupId || process.env.GROUP_ID;

        if (timePassed < user.requiredWait) {
            const rem = Math.ceil(user.requiredWait - timePassed);
            if (groupTarget) await bot.api.sendMessage(groupTarget, `⚠️ **FAILED:** @${ctx.from.username} early verify (${rem}s left).`);
            return ctx.answerCallbackQuery({ text: `Wait ${rem}s!`, show_alert: true });
        }

        user.points += 1;
        user.lastClick = 0;
        await user.save();
        
        if (groupTarget) await bot.api.sendMessage(groupTarget, `✅ **SUCCESS:** @${ctx.from.username} task complete! Points: ${user.points}`);
        await ctx.answerCallbackQuery({ text: "Success! Check group.", show_alert: true });
        await ctx.editMessageText("Task Completed! ✅");
    }
});

// Admin Panel Command
bot.command("admin", async (ctx) => {
    if (ctx.from.id.toString() !== process.env.ADMIN_ID) return;
    const kb = new InlineKeyboard().text("🏆 Top 10", "admin_top").text("🔍 Search ID", "admin_search");
    await ctx.reply("🛠 RMS ADMIN PANEL", { reply_markup: kb });
});

bot.command("status", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (!user) return ctx.reply("No points yet. Use /watch!");
    ctx.reply(`👤 **User:** @${user.username}\n📊 **Points:** ${user.points}\n🎖️ **Rank:** ${user.rank}`);
});

bot.catch((err) => console.error(err));
bot.start();
