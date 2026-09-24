function cleanText(value) {
  return String(value || '').trim();
}

function isValidHttpUrl(value) {
  if (!value) {
    return true;
  }

  try {
    const parsedUrl = new URL(value);
    return ['http:', 'https:'].includes(parsedUrl.protocol);
  } catch {
    return false;
  }
}

module.exports = {
  cleanText,
  isValidHttpUrl,
};