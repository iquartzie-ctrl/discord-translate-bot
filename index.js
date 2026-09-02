import { 
  Client, 
  GatewayIntentBits, 
  ContextMenuCommandBuilder, 
  SlashCommandBuilder,
  ApplicationCommandType, 
  REST, 
  Routes 
} from 'discord.js';
import { GoogleGenAI } from '@google/genai';
import http from 'http';
import 'dotenv/config';

// Health Check Server for Render Free Web Service
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write("Discord AI Translator Active!");
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

// Set to track users who opted out of translation
const optedOutUsers = new Set();

// Register Commands (Slash Command + Context Menu Apps)
const commands = [
  new SlashCommandBuilder()
    .setName('translator-toggle')
    .setDescription('Opt in or opt out of having your messages translated by others.'),
  new ContextMenuCommandBuilder()
    .setName('Translate to English')
    .setType(ApplicationCommandType.Message),
  new ContextMenuCommandBuilder()
    .setName('Translate to Thai')
    .setType(ApplicationCommandType.Message),
  new ContextMenuCommandBuilder()
    .setName('Translate to Tagalog')
    .setType(ApplicationCommandType.Message),
];

client.once('clientReady', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('✅ Commands & Opt-Out slash command registered successfully!');
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
  }
});

async function translateMessage(text, targetLang) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: text,
      config: {
        systemInstruction: `Translate the text into ${targetLang}. Preserve all emojis, mentions, and code blocks. Output ONLY the translation.`,
        temperature: 0.2,
      },
    });

    return response.text?.trim() || null;
  } catch (error) {
    console.error('Gemini API Error:', error);
    return null;
  }
}

client.on('interactionCreate', async (interaction) => {
  // 1. Handle Slash Command: /translator-toggle
  if (interaction.isChatInputCommand() && interaction.commandName === 'translator-toggle') {
    const userId = interaction.user.id;

    if (optedOutUsers.has(userId)) {
      optedOutUsers.delete(userId);
      return interaction.reply({
        content: '✅ **Translation Enabled:** Other users can now translate your messages.',
        flags: 64, // Ephemeral
      });
    } else {
      optedOutUsers.add(userId);
      return interaction.reply({
        content: '🔒 **Translation Disabled:** Other users can no longer translate your messages.',
        flags: 64, // Ephemeral
      });
    }
  }

  // 2. Handle Right-Click Context Menu Translation
  if (interaction.isMessageContextMenuCommand()) {
    const commandLangMap = {
      'Translate to English': 'English',
      'Translate to Thai': 'Thai',
      'Translate to Tagalog': 'Tagalog',
    };

    const targetLang = commandLangMap[interaction.commandName];
    if (!targetLang) return;

    await interaction.deferReply({ flags: 64 });

    const targetMsg = interaction.targetMessage;
    if (!targetMsg || !targetMsg.content) {
      return interaction.editReply({ content: '❌ Unable to read message content.' });
    }

    // CHECK OPT-OUT STATUS: Verify if author opted out
    if (optedOutUsers.has(targetMsg.author.id)) {
      return interaction.editReply({
        content: `🔒 **Privacy Notice:** ${targetMsg.author.username} has opted out of message translations.`,
      });
    }

    const translation = await translateMessage(targetMsg.content, targetLang);

    if (translation) {
      await interaction.editReply({
        content: `🌐 **[${targetLang} Translation]:**\n${translation}`,
      });
    } else {
      await interaction.editReply({
        content: '❌ Translation failed. Please try again.',
      });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);