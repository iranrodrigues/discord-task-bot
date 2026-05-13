import 'dotenv/config';
import express from 'express';
import {
  Client,
  GatewayIntentBits,
  Events
} from 'discord.js';

const app = express();

app.get('/', (_, res) => {
  res.send('Discord task bot online.');
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Healthcheck HTTP ativo.');
});

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

function parseGitlabUrl(rawUrl) {
  const url = new URL(rawUrl);

  const parts = url.pathname.split('/').filter(Boolean);

  const dashIndex = parts.findIndex(p => p === '-');
  if (dashIndex === -1) {
    throw new Error('URL não parece ser de projeto GitLab com /-/ na rota.');
  }

  const resourceType = parts[dashIndex + 1]; // work_items ou issues
  const issueIid = parts[dashIndex + 2];

  if (!['work_items', 'issues'].includes(resourceType)) {
    throw new Error('URL não parece ser de issue/work_item do GitLab.');
  }

  const projectPath = parts.slice(0, dashIndex).join('/');

  return {
    host: `${url.protocol}//${url.host}`,
    projectPath,
    encodedProjectPath: encodeURIComponent(projectPath),
    issueIid,
    issueUrl: `${url.protocol}//${url.host}/${projectPath}/-/${resourceType}/${issueIid}`,
    commentUrl: rawUrl
  };
}

async function gitlabGet(path) {
  const response = await fetch(`${process.env.GITLAB_BASE_URL}/api/v4${path}`, {
    headers: {
      'PRIVATE-TOKEN': process.env.GITLAB_TOKEN
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitLab API ${response.status}: ${body}`);
  }

  return response.json();
}

async function getIssueTitle(encodedProjectPath, issueIid) {
  // Work items costumam ser compatíveis com Issues API para esse caso.
  // A API REST do GitLab usa /api/v4 e aceita o path do projeto URL-encoded.
  const issue = await gitlabGet(`/projects/${encodedProjectPath}/issues/${issueIid}`);
  return issue.title;
}

function makeMrLine(baseProjectUrl, iid, status) {
  if (!iid) return null;

  const emoji = status === 'mergeado' ? '✅' : '⏳';
  return `• ${status.label}: ${baseProjectUrl}/-/merge_requests/${iid} ${emoji}`;
}

function parseMrs(input) {
  if (!input) return [];

  return input
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
}

function buildMessage({ issueIid, title, commentUrl, beMrs, feMrs }) {
  const assignee = process.env.DEFAULT_ASSIGNEE || '@André Almeida';
  const hmgResponsible = process.env.DEFAULT_HMG_RESPONSIBLE || '@Leonardo Soares';

  const beDev = beMrs[0]
    ? `- \`dev\`: ${beMrs[0]} ✅`
    : `- \`dev\`: MR 9999 ✅`;

  const beHmg = beMrs[1]
    ? `- \`hmg\`: ${beMrs[1]} ✅`
    : `- \`hmg\`: MR 9999 ✅`;

  const beRelease = beMrs[2]
    ? `- \`release\`: ${beMrs[2]} ⏳`
    : `- \`release\`: MR 9999 ⏳`;

  const feDev = feMrs[0]
    ? `- \`dev\`: ${feMrs[0]} ✅`
    : `- \`dev\`: MR 9999 ✅`;

  const feHmg = feMrs[1]
    ? `- \`hmg\`: ${feMrs[1]} ✅`
    : `- \`hmg\`: MR 9999 ✅`;

  const feRelease = feMrs[2]
    ? `- \`release\`: ${feMrs[2]} ⏳`
    : `- \`release\`: MR 9999 ⏳`;

  return `${assignee} ${hmgResponsible}

✅ *Issue #${issueIid}* — ${title}

🧪 Testado em: \`dev-new\`
⏳ Status: aguardando testes em \`hmg-new\`

💬 *Solução*
${commentUrl}

🔧 *Back-end*
${beDev}
${beHmg}
${beRelease}

🎨 *Front-end*
${feDev}
${feHmg}
${feRelease}`;
}

client.once(Events.ClientReady, readyClient => {
  console.log(`Bot logado como ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'task') return;

  if (interaction.replied || interaction.deferred) return;

  await interaction.deferReply({ flags: 64 });

  try {
    const url = interaction.options.getString('url', true);
    const beMrs = parseMrs(interaction.options.getString('be'));
    const feMrs = parseMrs(interaction.options.getString('fe'));

    const parsed = parseGitlabUrl(url);
    const title = await getIssueTitle(parsed.encodedProjectPath, parsed.issueIid);

    const message = buildMessage({
      issueIid: parsed.issueIid,
      title,
      commentUrl: parsed.commentUrl,
      beMrs,
      feMrs
    });

    await interaction.editReply({
      content: `Copie e cole no WhatsApp:\n\n\`\`\`\n${message}\n\`\`\``
    });
  } catch (error) {
    console.error(error);

    await interaction.editReply({
      content: `Não consegui gerar a mensagem.\n\nErro: \`${error.message}\``
    });
  }
});

client.login(process.env.DISCORD_TOKEN);