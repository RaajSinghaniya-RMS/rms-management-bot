const { Bot, InlineKeyboard } = require("grammy");
const mongoose = require("mongoose");
require("dotenv").config();

const bot = new Bot(process.env.BOT_TOKEN);
const ADMIN_ID = process.env.ADMIN_ID;
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

// --- COMMANDS SETUP ---
async function setupCommands() {
    await bot.api.setMyCommands([
        { command: "watch", description: "Watch ads to earn points" },
        { command: "status", description: "Check your points" },
        { command: "leaderboard", description: "Top users" },
        { command: "help", description: "Reward details" }
    ]);
    // Admin specific menu
    await bot.api.setMyCommands([
        { command: "admin", description: "Open Admin Panel" },
        { command: "search", description: "Search User by ID" },
        { command: "setpoints", description: "Set points manually" },
        { command: "watch", description: "Watch ads" },
        { command: "help", description: "Reward details" }
    ], { scope: { type: "chat", chat_id: parseInt(ADMIN_ID) } });
}
setupCommands();

const helpText = `🎁 **RMS LUCKY DRAW & REWARDS** 🎁\n\nTop users qualify for monthly lucky draws for **Funcam / Ashare / Forever** recharges! Keep watching ads to stay on top.`;

// --- ALL CALLBACK HANDLERS (ADMIN PANEL LOGIC) ---
bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    if (ctx.from.id.toString() !== ADMIN_ID) return ctx.answerCallbackQuery("Unauthorized!");

    try {
        if (data === "admin_top") {
            const topUsers = await User.find().sort({ points: -1 }).limit(10);
            const kb = new InlineKeyboard();
            topUsers.forEach(u => kb.text(`${u.username || u.userId} (${u.points})`, `manage_${u.userId}`).row());
            kb.text("⬅️ Back", "admin_main");
            return await ctx.editMessageText("🏆 **Top 10 Users:**", { reply_markup: kb });
        }

        if (data === "admin_search") {
            return await ctx.editMessageText("🔍 Use `/search [User_ID]` to find or add any user.");
        }

        if (data === "admin_main") {
            const kb = new InlineKeyboard().text("🏆 Top 10", "admin_top").text("🔍 Search ID", "admin_search");
            return await ctx.editMessageText("🛠 **RMS ADMIN PANEL**", { reply_markup: kb });
        }

        if (data.startsWith("manage_")) {
            const targetId = data.split("_")[1];
            const kb = new InlineKeyboard()
                .text("+10", `pts_add_10_${targetId}`).text("+5", `pts_add_5_${targetId}`).row()
                .text("-10", `pts_sub_10_${targetId}`).text("-5", `pts_sub_5_${targetId}`).row()
                .text("⬅️ Back", "admin_top");
            return await ctx.editMessageText(`👤 Managing ID: \`${targetId}\`\nModify points:`, { reply_markup: kb, parse_mode: "Markdown" });
        }

        if (data.startsWith("pts_")) {
            const [, action, amount, targetId] = data.split("_");
            const change = action === "add" ? parseInt(amount) : -parseInt(amount);
            const user = await User.findOneAndUpdate({ userId: targetId }, { $inc: { points: change } }, { new: true });
            
            const kb = new InlineKeyboard()
                .text("+10", `pts_add_10_${targetId}`).text("+5", `pts_add_5_${targetId}`).row()
                .text("-10", `pts_sub_10_${targetId}`).text("-5", `pts_sub_5_${targetId}`).row()
                .text("⬅️ Back", "admin_top");
            
            await ctx.answerCallbackQuery(`Updated: ${user.points} pts`);
            return await ctx.editMessageText(`👤 User: \`${targetId}\`\n✅ Points: **${user.points}**`, { reply_markup: kb, parse_mode: "Markdown" });
        }
        
        // Handle "verify" from watch command
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
            await ctx.answerCallbackQuery("Success! Points added.");
            return await ctx.editMessageText("Task Completed! ✅");
        }
    } catch (e) { console.log(e); }
});

// --- COMMANDS ---

bot.command("admin", (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    const kb = new InlineKeyboard().text("🏆 Top 10", "admin_top").text("🔍 Search ID", "admin_search");
    ctx.reply("🛠 **RMS ADMIN PANEL**", { reply_markup: kb });
});

bot.command("search", async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    const tId = ctx.match;
    if (!tId) return ctx.reply("Format: `/search 12345`", { parse_mode: "Markdown" });
    let user = await User.findOne({ userId: tId }) || await User.create({ userId: tId, username: "User_"+tId });
    const kb = new InlineKeyboard().text("+5", `pts_add_5_${tId}`).text("-5", `pts_sub_5_${tId}`);
    ctx.reply(`User: ${user.username}\nPoints: ${user.points}`, { reply_markup: kb });
});

bot.command("setpoints", async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    const args = ctx.match.split(" ");
    if (args.length < 2) return ctx.reply("Format: `/setpoints ID Points`", { parse_mode: "Markdown" });
    await User.findOneAndUpdate({ userId: args[0] }, { points: parseInt(args[1]) });
    ctx.reply(`✅ Set ${args[0]} to ${args[1]} points.`);
    ctx.deleteMessage().catch(() => {});
});

bot.command("watch", async (ctx) => {
    const isGroup = ctx.chat.type !== "private";
    const userId = ctx.from.id;
    const wait = Math.floor(Math.random() * 20) + 15;
    const link = adLinks[Math.floor(Math.random() * adLinks.length)];
    
    let user = await User.findOne({ userId }) || await User.create({ userId, username: ctx.from.username || ctx.from.first_name });
    user.fromGroupId = isGroup ? ctx.chat.id.toString() : user.fromGroupId;
    user.lastClick = Date.now(); user.requiredWait = wait; await user.save();

    const kb = new InlineKeyboard().webApp("Watch Ad 📺", link).row().text("Verify Ad ✅", "verify");
    if (isGroup) {
        try {
            await bot.api.sendMessage(userId, `📺 Ad Duration: ${wait}s`, { reply_markup: kb });
            await ctx.reply(`✅ @${ctx.from.username}, Ad link sent in DM!`);
        } catch (e) { await ctx.reply("❌ Please start the bot in private first!"); }
    } else {
        await ctx.reply(`📺 Ad Duration: ${wait}s`, { reply_markup: kb });
    }
});

bot.command("status", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (!user) return ctx.reply("No data.");
    ctx.reply(`👤 @${user.username}\n📊 Points: ${user.points}`);
});

bot.command("help", (ctx) => ctx.reply(helpText));

bot.start();
