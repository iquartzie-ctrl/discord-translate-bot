import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { GoogleGenAI } from '@google/genai';
import http from 'http';
import 'dotenv/config';

// --- 1. RENDER WEB SERVICE HEALTH CHECK SERVER ---
const PORT = process.env.PORT || 10000;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write("Discord Bot is Live & Listening!");
  res.end();
}).listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Health check server bound to 0.0.0.0:${PORT}`);
});

// --- 2. DISCORD CLIENT CONFIGURATION ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.User],
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Flag Emoji mapping
const FLAG_LANGUAGES = {
  '🇬🇧': 'English',
  '🇺🇸': 'English',
  '🇹🇭': 'Thai',
  '🇵🇭': 'Tagalog',
};

async function translateToLanguage(text, targetLang) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: text,
      config: {
        systemInstruction: `Translate the provided text into ${targetLang}. Preserve all emojis, code blocks, and user mentions. Return ONLY the translated text without extra conversational filler.`,
        temperature: 0.2,
      },
    });

    return response.text?.trim() || null;
  } catch (error) {
    console.error('Gemini API Error:', error);
    return null;
  }
}

client.once('clientReady', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// --- 3. REACTION TRANSLATION EVENT ---
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;

  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('Error fetching reaction:', error);
      return;
    }
  }

  const targetLang = FLAG_LANGUAGES[reaction.emoji.name];
  if (!targetLang) return;

  const messageText = reaction.message.content;
  if (!messageText) return;

  const translation = await translateToLanguage(messageText, targetLang);

  if (translation) {
    try {
      await user.send(`🌐 **[${targetLang} Translation]:**\n${translation}`);
    } catch (err) {
      console.log(`Could not send DM to ${user.username}. User may have DMs closed.`);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);