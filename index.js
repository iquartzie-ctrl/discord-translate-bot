import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { GoogleGenAI } from '@google/genai';
import http from 'http';
import 'dotenv/config';

// Health check for Render Free Web Service
http.createServer((req, res) => {
  res.write("Discord bot active!");
  res.end();
}).listen(process.env.PORT || 3000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.User], // Required to read reactions on older messages
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
        systemInstruction: `Translate the text into ${targetLang}. Preserve emojis, code blocks, and mentions. Output ONLY the translation without extra text.`,
        temperature: 0.2,
      },
    });
    return response.text?.trim() || null;
  } catch (error) {
    console.error('Gemini Error:', error);
    return null;
  }
}

client.once('clientReady', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// Event: Triggers when someone reacts to a message with an emoji
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;

  // Fetch partials if the message or reaction is cached/uncached
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('Error fetching reaction:', error);
      return;
    }
  }

  const targetLang = FLAG_LANGUAGES[reaction.emoji.name];
  if (!targetLang) return; // Ignore irrelevant emoji reactions

  const messageText = reaction.message.content;
  if (!messageText) return;

  const translation = await translateToLanguage(messageText, targetLang);

  if (translation) {
    // Direct Message (DM) the user privately with their requested translation
    try {
      await user.send(`🌐 **[${targetLang} Translation]:**\n${translation}`);
    } catch (err) {
      console.log(`Could not send DM to ${user.username}. They might have DMs disabled.`);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

// Satisfies Render's free Web Service health check
http.createServer((req, res) => {
  res.write("Discord bot is active!");
  res.end();
}).listen(process.env.PORT || 3000);