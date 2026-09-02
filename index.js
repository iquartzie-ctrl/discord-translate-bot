import { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { GoogleGenAI } from '@google/genai';
import http from 'http';
import 'dotenv/config';

// Render Port Binding
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write("Discord Bot Active!");
  res.end();
}).listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Health check server active on port ${PORT}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function translateToLanguage(text, targetLang) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: text,
      config: {
        systemInstruction: `Translate the text into ${targetLang}. Preserve all emojis, code blocks, and mentions. Return ONLY the translation.`,
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

// Event 1: Add interactive flag buttons under non-bot chat messages
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content) return;

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

  await message.reply({
    content: '🌐 *Translate:*',
    components: [row],
    allowedMentions: { repliedUser: false },
  });
});

// Event 2: Private (Ephemeral) Channel Translation on Button Click
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const languageMap = {
    trans_english: 'English',
    trans_thai: 'Thai',
    trans_tagalog: 'Tagalog',
  };

  const targetLang = languageMap[interaction.customId];
  if (!targetLang) return;

  // flags: 64 makes this message EPHEMERAL (In-channel, visible ONLY to this specific user)
  await interaction.deferReply({ flags: 64 });

  // Fetch target message text
  const originalMessage = interaction.message.reference 
    ? await interaction.channel.messages.fetch(interaction.message.reference.messageId)
    : null;

  if (!originalMessage || !originalMessage.content) {
    return interaction.editReply({ content: '❌ Could not read the target message.' });
  }

  const translation = await translateToLanguage(originalMessage.content, targetLang);

  if (translation) {
    await interaction.editReply({
      content: `🌐 **[${targetLang} Translation]:**\n${translation}`,
    });
  } else {
    await interaction.editReply({
      content: '❌ Translation failed.',
    });
  }
});

client.login(process.env.DISCORD_TOKEN);