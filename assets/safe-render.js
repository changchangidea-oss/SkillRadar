(function (global) {
  'use strict';

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function escapeAttr(value = '') {
    return escapeHtml(value);
  }

  function safeGithubUrl(value = '') {
    try {
      const url = new URL(String(value));
      if (url.protocol !== 'https:' || url.hostname !== 'github.com') return '#';
      return url.href;
    } catch {
      return '#';
    }
  }

  function repoSlug(value = '') {
    const slug = String(value).trim();
    return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(slug) ? slug : '';
  }

  function safeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  global.SkillRadarSafe = Object.freeze({
    escapeHtml,
    escapeAttr,
    safeGithubUrl,
    repoSlug,
    safeNumber,
  });
})(globalThis);
