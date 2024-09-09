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

  if(interaction.commandName === 'ping') {
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

		const relevantFilesInput = new TextInputBuilder()
			.setCustomId('relevantFilesInput')
			.setLabel("List some of the relevant file names (optional)")
			.setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Whatever guidance you can provide will be helpful")
      .setRequired(false);

    const repoNameInput = new TextInputBuilder()
			.setCustomId('repoNameInput')
			.setLabel("Repo name (optional)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("assafelovic/gpt-researcher")
      .setRequired(false)

    const branchNameInput = new TextInputBuilder()
			.setCustomId('branchNameInput')
			.setLabel("Branch name (optional)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("master")
      .setRequired(false)

		// so you need one action row per text input.
		const firstActionRow = new ActionRowBuilder().addComponents(queryInput);
		const secondActionRow = new ActionRowBuilder().addComponents(relevantFilesInput);
    const thirdActionRow = new ActionRowBuilder().addComponents(repoNameInput)
    const fourthActionRow = new ActionRowBuilder().addComponents(branchNameInput)

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
	  const relevantFiles = interaction.fields.getTextInputValue('relevantFilesInput');
		await interaction.reply({ content: `
      Your query is: ${query}
      Your relevantFiles are: ${relevantFiles}  
    ` });
	}
});

client.on("message", async msg => {
  if (msg.author.bot) return;

  msg.channel.send('Looking through the code to investigate your query... give me a minute or so');

  try {
    // Await the response from GPTR via WebSocket
    let gptrResponse = await sendWebhookMessage(msg.content);

    // Check if the response is valid
    if (gptrResponse && gptrResponse.rubber_ducker_thoughts) {
      // Combine and split the messages into chunks
      const rubberDuckerChunks = splitMessage(JSON.parse(gptrResponse.rubber_ducker_thoughts).thoughts);

      // Send each chunk of Rubber Ducker Thoughts
      for (const chunk of rubberDuckerChunks) {
        await msg.channel.send(chunk);
      }

      return true;
    } else {
      return msg.channel.send("Invalid response received from GPTR.");
    }
  } catch (error) {
    console.error("Error handling message:", error);
    return msg.channel.send("There was an error processing your request.");
  }
});

keepAlive();
client.login(process.env.DISCORD_BOT_TOKEN);