/** Dry-run by default. Network writes require both --apply and an explicit scope. */
import fs from 'node:fs';
import dotenv from 'dotenv';
import discordApplication from '../cloud-functions/discord-session-config.cjs';
import { discordCommands } from '../functions/discord/commands.js';

export function commandRegistrationPlan(args) {
  const apply = args.includes('--apply'), global = args.includes('--global');
  const guildIndex = args.indexOf('--guild'), guild = guildIndex < 0 ? null : args[guildIndex + 1];
  const backupIndex = args.indexOf('--backup'), backup = backupIndex < 0 ? null : args[backupIndex + 1];
  const recognized = new Set(['--apply', '--global', '--guild', '--backup']);
  for (let index = 0; index < args.length; index++) {
    if (!recognized.has(args[index])) throw new Error('알 수 없는 옵션입니다. --guild ID 또는 --global을 사용하세요.');
    if (args[index] === '--guild' || args[index] === '--backup') index++;
  }
  if (guildIndex >= 0 && !/^\d{1,20}$/.test(guild || '')) throw new Error('유효한 테스트 서버 ID가 필요합니다.');
  if (global && guild) throw new Error('--global과 --guild를 함께 사용할 수 없습니다.');
  if (backupIndex >= 0 && (!backup || backup.startsWith('--'))) throw new Error('--backup 뒤에 저장 경로를 지정하세요.');
  if (apply && (!guild && !global || !backup)) throw new Error('실제 교체에는 --apply와 --guild ID 또는 --global, 그리고 --backup 파일 경로가 필요합니다.');
  // Installation/interaction contexts are global-command fields, not guild fields.
  const commands = guild ? discordCommands.map(({ integration_types, contexts, ...command }) => command) : discordCommands;
  return { apply, guild, backup, scope: guild ? `guild:${guild}` : global ? 'global' : 'preview', commands };
}

export async function registerCommands(plan, { token, fetchImpl = fetch, backupImpl = (file, commands) => fs.writeFileSync(file, JSON.stringify(commands, null, 2), { flag: 'wx' }) } = {}) {
  if (!plan.apply) return { applied: false, commands: plan.commands, scope: plan.scope };
  if (!token) throw new Error('DISCORD_TOKEN이 없습니다. 명령어는 변경하지 않았습니다.');
  const endpoint = `https://discord.com/api/v10/applications/${discordApplication.applicationId}${plan.guild ? `/guilds/${plan.guild}` : ''}/commands`;
  const headers = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
  const before = await fetchImpl(endpoint, { headers, signal: AbortSignal.timeout(10000) });
  if (!before.ok) throw new Error(`기존 명령어 조회 실패 (${before.status}). 교체하지 않았습니다.`);
  const originals = await before.json();
  if (!Array.isArray(originals)) throw new Error('명령어 목록 형식이 잘못되어 중단했습니다.');
  await backupImpl(plan.backup, originals);
  const response = await fetchImpl(endpoint, { method: 'PUT', headers, body: JSON.stringify(plan.commands), signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`명령어 교체 응답 오류 (${response.status}). 재실행 전에 Discord의 현재 목록을 확인하세요.`);
  const registered = await response.json();
  if (!Array.isArray(registered) || registered.length !== plan.commands.length || plan.commands.some(command => !registered.some(item => item.name === command.name))) {
    throw new Error('교체 결과가 예상한 명령어 목록과 다릅니다. Discord에서 확인하세요.');
  }
  return { applied: true, scope: plan.scope, names: registered.map(command => command.name), backup: plan.backup };
}

export async function runDiscordRegistration() {
  try {
    const plan = commandRegistrationPlan(process.argv.slice(2));
    if (plan.apply) dotenv.config({ quiet: true });
    const result = await registerCommands(plan, { token: process.env.DISCORD_TOKEN });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
