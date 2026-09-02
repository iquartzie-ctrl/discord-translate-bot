import { Client, GatewayIntentBits } from 'discord.js';
import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `You are a translation bot for a Discord server. 
Translate the provided message into ${process.env.TARGET_LANGUAGE || 'English'}. 
Preserve all emojis, code blocks, and user mentions (@username). 
Do not include explanations or conversational filler—output ONLY the translation. 
If the text is already in ${process.env.TARGET_LANGUAGE || 'English'} or consists only of emojis/urls, return it unchanged.`;

async function translateText(text) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: text,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.2,
      },
    });

    return response.text?.trim() || null;
  } catch (error) {
    console.error('❌ Gemini API Error:', error);
    return null;
  }
}

// Fixed event name to clientReady (removes the Deprecation Warning)
client.once('clientReady', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  console.log('📡 Waiting for messages in Discord...');
});

client.on('messageCreate', async (message) => {
  // Ignore messages from bots
  if (message.author.bot) return;

  // Debug log: This WILL print in CMD if Discord sends the message to your code
  console.log(`📩 [CMD Received]: "${message.content}" from ${message.author.username}`);

  if (!message.content) {
    console.log('⚠️ Message content is EMPTY. Check Message Content Intent in Discord Developer Portal.');
    return;
  }

  const translatedText = await translateText(message.content);
  console.log(`🤖 [Gemini Result]: "${translatedText}"`);

  if (translatedText && translatedText.toLowerCase() !== message.content.toLowerCase()) {
    await message.reply({
      content: `🌐 **Translation:** ${translatedText}`,
      allowedMentions: { repliedUser: false },
    });
    console.log('✅ Reply sent to Discord!');
  }
});

client.login(process.env.DISCORD_TOKEN);