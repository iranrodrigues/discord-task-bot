import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const command = new SlashCommandBuilder()
  .setName('task')
  .setDescription('Gera mensagem de conclusão de task a partir da URL do comentário no GitLab')
  .addStringOption(option =>
    option
      .setName('url')
      .setDescription('URL do comentário da issue/work item no GitLab')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('be').setDescription('MRs backend: dev,hmg,release. Ex: 2218,2219,2220')
  )
  .addStringOption(option =>
    option.setName('fe').setDescription('MRs frontend: dev,hmg,release. Ex: 2043,2044,2045')
  );

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

await rest.put(
  Routes.applicationGuildCommands(
    process.env.DISCORD_CLIENT_ID,
    process.env.DISCORD_GUILD_ID
  ),
  { body: [command.toJSON()] }
);

console.log('Comando /task registrado.');