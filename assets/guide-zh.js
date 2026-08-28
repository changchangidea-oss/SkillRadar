'use strict';

const commands = {
  copyCodexGuide: 'codex plugin marketplace add changchangidea-oss/SkillRadar --ref v0.5.0 && codex plugin add skillradar@skillradar',
  copyAgentGuide: 'npx skills add changchangidea-oss/SkillRadar --skill skillradar',
};

async function copyGuideCommand(command) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(command);
    } else {
      const input = document.createElement('textarea');
      input.value = command;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      try {
        input.select();
        if (!document.execCommand('copy')) throw new Error('Clipboard fallback failed');
      } finally {
        input.remove();
      }
    }
    document.querySelector('#guideToast').textContent = '安装命令已复制';
  } catch {
    document.querySelector('#guideToast').textContent = '复制失败，请手动选择命令';
  }
  document.querySelector('#guideToast').classList.add('on');
  setTimeout(() => document.querySelector('#guideToast').classList.remove('on'), 1800);
}

for (const [id, command] of Object.entries(commands)) {
  document.querySelector(`#${id}`).addEventListener('click', () => copyGuideCommand(command));
}
