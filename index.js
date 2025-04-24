import { Client, GatewayIntentBits } from "discord.js";
import cron from "node-cron";
import moment from "moment-hijri";
import Calendar from "date-bengali-revised";
import dotenv from "dotenv";

// Initialize Deno KV
const env = dotenv.config();
const TOKEN = process.env.TOKENZ;
const userSessions = new Map();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
    ],
});


const logChannelId = process.env.LOG_CHANNELZ;


cron.schedule('0 6 * * *', () => {
    const today = new Date();
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const bar = days[today.getDay()];
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
    const monthName = monthNames[today.getMonth()];
    const formattedDate = `${day}/${monthName}/${year}`;
    const gregToday = `${bar} ${formattedDate}`;

    // HIJRI date + fixed for Bangladesh, 1 day behind Saudi Arabia / Middle Eastern Countries. 
    let yesterday = new Date(today.getTime() - (1000 * 60 * 60 * 24));
    function getTodaysArabicDay() {
        const weekdays = ["الاحد", "الاثنين", "الثلاثاء", "الاربعاء", "الخميس", "الجمعة", "السبت"];
        return yesterday.getDay() === 6 ? weekdays[0] : weekdays[yesterday.getDay() + 1];
    }
    const todaysArabicDay = getTodaysArabicDay();
    // Adjusted Hijri date format with extra spaces around the month name
    const hijri = moment(yesterday).format('iD / iMMMM / iYYYY');
    const hijriToday = `${todaysArabicDay} ${hijri}`;

    // BANGLA date
    let cal = new Calendar();
    cal.fromDate(today);
    const bongabdo = cal.format('dddd D MMMM, Y');

    // Combine all dates into one message
    const message = `## ${gregToday}\n## ${bongabdo}\n## ${hijriToday}`;

    // Send the message to a specific channel
    const channel = client.channels.cache.get(logChannelId);
    if (channel) {
        channel.send(message);
    }
});




client.on("voiceStateUpdate", async (oldState, newState) => {

    const logChannel = await client.channels.fetch(logChannelId);
    if (!logChannel) return;

    const member = newState.member;
    // console.log(member.user.id);
    const displayName = member.user.displayName;

    const currentTime = new Date();
    currentTime.setHours(currentTime.getHours() + 6);

    const time = currentTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
    });

    if (!oldState.channel && newState.channel) {
        // User joined a new voice channel
        userSessions.set(displayName, { joinTime: currentTime.toISOString(), channelName: newState.channel.name });
        const joinMessage = `**${displayName}** has joined **${newState.channel.name}** at ${time}`;
        
        await logChannel.send(joinMessage);

        //   await redisClient.lPush('vswatcher', `**${displayName}** has joined **${newState.channel.name}** at ${time}`);
    } else if (oldState.channel && newState.channel && oldState.channelId !== newState.channelId) {
        // User switched channels
        const previousChannel = oldState.channel.name;
        userSessions.set(displayName, { joinTime: currentTime.toISOString(), channelName: newState.channel.name });

        const switchMessage = `**${displayName}** switched from **${previousChannel}** to **${newState.channel.name}** at ${time}`;

        await logChannel.send(switchMessage);

        // await redisClient.lPush('vswatcher', `**${displayName}** switched from **${previousChannel}** to **${newState.channel.name}** at ${time}`);
    } else if (oldState.channel && !newState.channel) {
        // User left a voice channel
        const joinData = userSessions.get(displayName);
        if (joinData) {
            const joinTime = new Date(joinData.joinTime);
            const sessionTime = new Date(currentTime.getTime() - joinTime.getTime())
                .toISOString()
                .slice(11, 11 + 8);

            const leaveMessage = `**${displayName}** has left **${joinData.channelName}** at ${time} (session time: ${sessionTime})`;

            userSessions.delete(displayName);
            await logChannel.send(leaveMessage);
        } else {
            // If no join data is found, send a generic leave message
            const leaveMessage = `**${displayName}** has left **${oldState.channel.name}** at ${time}`;
            // Log leave event with session time to Redis
            await logChannel.send(leaveMessage);

        }
    }
});



client.login(TOKEN)
