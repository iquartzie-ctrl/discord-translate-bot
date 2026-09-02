import { 
  Client, 
  GatewayIntentBits, 
  SlashCommandBuilder,
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  REST, 
  Routes 
} from 'discord.js';
import { GoogleGenAI } from '@google/genai';
import http from 'http';
import 'dotenv/config';

// Health check server for Render Web Service
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write("Discord Translation Bot Active!");
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

// Set tracking users who disabled prompt buttons on their messages
const hidePromptsForUsers = new Set();

// Register Slash Command
const commands = [
  new SlashCommandBuilder()
    .setName('translator-prompts')
    .setDescription('Toggle whether translation prompt buttons appear under your messages.')
];

client.once('clientReady', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('✅ Slash command registered successfully!');
  } catch (error) {
    console.error('❌ Failed to register command:', error);
  }
});

// Change 'gemini-3.6-flash' to 'gemini-3.1-flash-lite'
async function translateToLanguage(text, targetLang) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite', // Updated model
      contents: text,
      config: {
        systemInstruction: `Translate the text into ${targetLang}. Preserve all emojis, mentions, and code blocks. Output ONLY the translated text.`,
        temperature: 0.2,
      },
    });

    return response.text?.trim() || null;
  } catch (error) {
    console.error('Gemini API Error:', error);
    return null;
  }
}

// Event 1: Chat Message Listener
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content) return;

  // If the author opted out of showing translation prompts, skip replying with buttons
  if (hidePromptsForUsers.has(message.author.id)) return;

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

// Event 2: Interaction Handler (Slash Command & Button Clicks)
client.on('interactionCreate', async (interaction) => {
  // Handle /translator-prompts command
  if (interaction.isChatInputCommand() && interaction.commandName === 'translator-prompts') {
    const userId = interaction.user.id;

    if (hidePromptsForUsers.has(userId)) {
      hidePromptsForUsers.delete(userId);
      return interaction.reply({
        content: '🔔 **Prompts Enabled:** Translation buttons will now appear under your chat messages.',
        flags: 64, // Ephemeral (visible only to this user)
      });
    } else {
      hidePromptsForUsers.add(userId);
      return interaction.reply({
        content: '🔕 **Prompts Disabled:** Translation buttons will no longer appear under your chat messages.',
        flags: 64, // Ephemeral
      });
    }
  }

  // Handle Button Clicks
  if (interaction.isButton()) {
    const languageMap = {
      trans_english: 'English',
      trans_thai: 'Thai',
      trans_tagalog: 'Tagalog',
    };

    const targetLang = languageMap[interaction.customId];
    if (!targetLang) return;

    // Ephemeral response in-channel (only clicker sees the translation)
    await interaction.deferReply({ flags: 64 });

    const originalMessage = interaction.message.reference 
      ? await interaction.channel.messages.fetch(interaction.message.reference.messageId)
      : null;

    if (!originalMessage || !originalMessage.content) {
      return interaction.editReply({ content: '❌ Could not read message text.' });
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
  }
});

client.login(process.env.DISCORD_TOKEN);