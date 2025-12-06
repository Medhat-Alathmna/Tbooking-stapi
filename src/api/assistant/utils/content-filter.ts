/**
 * تصفية البيانات الحساسة من المحتوى
 * Content filtering to prevent leaking sensitive data
 */

const SENSITIVE_PATTERNS = {
  apiKey: /sk-[a-zA-Z0-9]{32,}/gi,
  jwtToken: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/gi,
};

/**
 * Filter sensitive data from content
 */
export function filterSensitiveData(content: string): string {
  let filtered = content;

  filtered = filtered.replace(SENSITIVE_PATTERNS.apiKey, 'sk-***REDACTED***');
  filtered = filtered.replace(SENSITIVE_PATTERNS.jwtToken, 'jwt-***REDACTED***');

  return filtered;
}

/**
 * التحقق من وجود أجزاء من system prompt
 * Check if content contains system prompt fragments
 */
export function containsSystemPromptFragments(content: string): boolean {
  const markers = [
    '# IDENTITY',
    'You are StrapiOps',
    '# AVAILABLE DATA COLLECTIONS',
    '# FILTER OPERATORS',
    'collectionFieldMeanings',
  ];

  return markers.some(marker => content.includes(marker));
}
