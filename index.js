import { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
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
    GatewayIntentBits.MessageContent,
  ],
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Dynamic translation function using Gemini 3.6 Flash
async function translateToLanguage(text, targetLang) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: text,
      config: {
        systemInstruction: `Translate the provided text into ${targetLang}. Preserve emojis, code blocks, and @mentions. Output ONLY the translated text without conversational filler.`,
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

// Event 1: Add Translation Buttons to Messages
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content) return;

  // Create Interactive Buttons
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('trans_english')
      .setLabel('English')
      .setEmoji('🇬🇧')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('trans_thai')
      .setLabel('Thai')
      .setEmoji('🇹🇭')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('trans_tagalog')
      .setLabel('Tagalog')
      .setEmoji('🇵🇭')
      .setStyle(ButtonStyle.Secondary)
  );

  // Send buttons under the user's message
  await message.reply({
    content: '🌐 *Translate this message:*',
    components: [row],
    allowedMentions: { repliedUser: false },
  });
});

// Event 2: Handle Private (Ephemeral) Button Clicks
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  // Map custom IDs to target languages
  const languageMap = {
    trans_english: 'English',
    trans_thai: 'Thai',
    trans_tagalog: 'Tagalog',
  };

  const targetLang = languageMap[interaction.customId];
  if (!targetLang) return;

  // Defer reply ephemerally so Discord knows the bot is processing
  await interaction.deferReply({ flags: 64 }); // 64 = Ephemeral (Only visible to clicker)

  // Fetch the original message text being translated
  const originalMessage = interaction.message.reference 
    ? await interaction.channel.messages.fetch(interaction.message.reference.messageId)
    : null;

  if (!originalMessage || !originalMessage.content) {
    return interaction.editReply({ content: '❌ Could not retrieve original message text.' });
  }

  const translation = await translateToLanguage(originalMessage.content, targetLang);

  if (translation) {
    await interaction.editReply({
      content: `🌐 **[${targetLang} Translation]:**\n${translation}`,
    });
  } else {
    await interaction.editReply({
      content: '❌ Translation failed. Please try again.',
    });
  }
});

client.login(process.env.DISCORD_TOKEN);


import http from 'http';

// Satisfies Render's free Web Service health check
http.createServer((req, res) => {
  res.write("Discord bot is active!");
  res.end();
}).listen(process.env.PORT || 3000);