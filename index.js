import { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { GoogleGenAI } from '@google/genai';
import http from 'http';
import 'dotenv/config';

// Render Health Check Server
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write("Smart Translation Bot Active!");
  res.end();
}).listen(PORT, '0.0.0.0');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Smart Translation with Context & Emoji Rules
async function translateWithContext(targetMessage, recentHistory, targetLang) {
  const systemInstruction = `
You are an expert Discord AI Translator.
Your job is to translate the target message into ${targetLang}.

RULES:
1. Preserve all custom Discord emojis (<:name:id>), standard emojis, URLs, and @mentions strictly as they are.
2. Maintain markdown formatting like bold (**), italics (*), or code blocks (\`\`\`).
3. If the user split their thoughts across multiple consecutive messages (shown in context history), combine them into one seamless, natural translation.
4. Translate gaming/internet slang naturally to equivalent natural phrasing in ${targetLang}.
5. Output ONLY the translated text without conversational filler or intros.
`;

  // Format context history for Gemini
  const prompt = `
[CHANNEL HISTORY FOR CONTEXT]:
${recentHistory}

[TARGET MESSAGE TO TRANSLATE]:
"${targetMessage}"
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
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

// Event 1: Add Translation Buttons
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

// Event 2: Handle Smart Ephemeral Translation
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const languageMap = {
    trans_english: 'English',
    trans_thai: 'Thai',
    trans_tagalog: 'Tagalog',
  };

  const targetLang = languageMap[interaction.customId];
  if (!targetLang) return;

  // Private Ephemeral Reply
  await interaction.deferReply({ flags: 64 });

  // Fetch the original message
  const targetMsg = interaction.message.reference 
    ? await interaction.channel.messages.fetch(interaction.message.reference.messageId)
    : null;

  if (!targetMsg || !targetMsg.content) {
    return interaction.editReply({ content: '❌ Could not retrieve message content.' });
  }

  // Fetch the last 5 messages in the channel to give Gemini context
  const recentMessages = await interaction.channel.messages.fetch({ limit: 5, before: targetMsg.id });
  const contextHistory = recentMessages
    .reverse()
    .map(m => `${m.author.username}: ${m.content}`)
    .join('\n');

  const translation = await translateWithContext(targetMsg.content, contextHistory, targetLang);

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