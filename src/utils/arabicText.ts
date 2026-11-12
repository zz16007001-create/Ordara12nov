/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Normalize Arabic text for search matching:
 * - Unifies alef forms (أ, إ, آ, ٱ -> ا)
 * - Ta' marbuta (ة -> ه)
 * - Ya' / Alef maksura (ى -> ي)
 * - Removes tashkeel / diacritics
 * - Removes tatweel / kashida (ـ)
 */
export const normalizeArabic = (text: string = ''): string => {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove diacritics / tashkeel
    .replace(/\u0640/g, '') // remove tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
};

/**
 * Smart text matching for Arabic search queries:
 * returns true if all words in query match anywhere in target text.
 */
export const smartTextMatch = (text?: string, query?: string): boolean => {
  if (!query || !query.trim()) return true;
  if (!text) return false;

  const normTarget = normalizeArabic(text);
  const normQueryWords = normalizeArabic(query).split(/\s+/).filter(Boolean);

  return normQueryWords.every((word) => normTarget.includes(word));
};
