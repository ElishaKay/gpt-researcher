require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, Events, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const keepAlive = require("./server");
const { sendWebhookMessage } = require('./gptr-webhook');

// Define the intents your bot needs
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
});

function splitMessage(message, chunkSize = 1500) {
  const chunks = [];
  for (let i = 0; i < message.length; i += chunkSize) {
    chunks.push(message.slice(i, i + chunkSize));
  }
  return chunks;
}

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    await interaction.reply('Pong!');
  }

  if (interaction.commandName === 'ask') {
    // Create the modal
    const modal = new ModalBuilder()
      .setCustomId('myModal')
      .setTitle('Ask the AI Dev Team');

    // Add components to modal
    const queryInput = new TextInputBuilder()
      .setCustomId('queryInput')
      .setLabel("Your question")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("What are you exploring / trying to code today?");

    const relevantFileNamesInput = new TextInputBuilder()
      .setCustomId('relevantFileNamesInput')
      .setLabel("Relevant file names (optional)")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Whatever guidance you can provide will be helpful")
      .setRequired(false);

    const repoNameInput = new TextInputBuilder()
      .setCustomId('repoNameInput')
      .setLabel("Repo name (optional)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("assafelovic/gpt-researcher")
      .setRequired(false);

    const branchNameInput = new TextInputBuilder()
      .setCustomId('branchNameInput')
      .setLabel("Branch name (optional)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("master")
      .setRequired(false);

    // so you need one action row per text input.
    const firstActionRow = new ActionRowBuilder().addComponents(queryInput);
    const secondActionRow = new ActionRowBuilder().addComponents(relevantFileNamesInput);
    const thirdActionRow = new ActionRowBuilder().addComponents(repoNameInput);
    const fourthActionRow = new ActionRowBuilder().addComponents(branchNameInput);

    // Add inputs to the modal
    modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow);

    // Show the modal to the user
    await interaction.showModal(modal);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isModalSubmit()) return;
  if (interaction.customId === 'myModal') {
    const query = interaction.fields.getTextInputValue('queryInput');
    const relevantFileNames = interaction.fields.getTextInputValue('relevantFileNamesInput');
    const repoName = interaction.fields.getTextInputValue('repoNameInput');
    const branchName = interaction.fields.getTextInputValue('branchNameInput');

    // Determine if the interaction is in a public channel
    const isPublicChannel = interaction.channel.type === 'GUILD_TEXT';

    await runDevTeam({interaction, query, relevantFileNames, repoName, branchName, isPublicChannel});
  }
});

async function runDevTeam({ interaction, query, relevantFileNames, repoName, branchName, thread }) {
  await interaction.reply({ content: "Looking through the code to investigate your query... give me a minute or so" });

  try {
    // Await the response from GPTR via WebSocket
    let gptrResponse = await sendWebhookMessage(query);

    // Check if the response is valid
    if (gptrResponse && gptrResponse.rubber_ducker_thoughts) {
      // Combine and split the messages into chunks
      const rubberDuckerChunks = splitMessage(JSON.parse(gptrResponse.rubber_ducker_thoughts).thoughts);

      // Send each chunk of Rubber Ducker Thoughts to the thread
      if (thread) {
        for (const chunk of rubberDuckerChunks) {
          await thread.send(chunk);
        }
      } else {
        // Fallback to the channel if no thread
        for (const chunk of rubberDuckerChunks) {
          await interaction.followUp({ content: chunk });
        }
      }

      return true;
    } else {
      return interaction.followUp({ content: "Invalid response received from GPTR." });
    }
  } catch (error) {
    console.error("Error handling message:", error);
    return interaction.followUp({ content: "There was an error processing your request." });
  }
}


let activeThreads = new Map();

client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;
  
  // Check if a thread has already been created for this user/message
  if (!activeThreads.has(message.author.id)) {
    try {
      // Create a thread for the message
      const thread = await message.startThread({
        name: `Discussion on: ${message.content.slice(0, 50)}`, // Limit thread name length
        autoArchiveDuration: 60, // Thread will auto-archive after 60 minutes of inactivity
      });

      // Send an initial message to the thread
      await thread.send("This thread has been created for your question.");

      // Store the thread in the activeThreads map
      activeThreads.set(message.author.id, thread);

      // Retrieve and handle the query (mocked here; you should handle this logic as needed)
      const query = message.content; // This is an example; adapt to your needs

      // Call runDevTeam with the thread
      await runDevTeam({ interaction: message, query, relevantFileNames: '', repoName: '', branchName: '', thread });
    } catch (error) {
      console.error("Error creating thread:", error);
    }
  } else {
    // Thread already exists; send follow-up messages to the existing thread
    const thread = activeThreads.get(message.author.id);
    if (thread) {
      try {
        let gptrResponse = await sendWebhookMessage(message.content);

        if (gptrResponse && gptrResponse.rubber_ducker_thoughts) {
          const rubberDuckerChunks = splitMessage(JSON.parse(gptrResponse.rubber_ducker_thoughts).thoughts);
          for (const chunk of rubberDuckerChunks) {
            await thread.send(chunk);
          }
        }
      } catch (error) {
        console.error("Error handling follow-up message:", error);
      }
    }
  }
});

keepAlive();
client.login(process.env.DISCORD_BOT_TOKEN);
