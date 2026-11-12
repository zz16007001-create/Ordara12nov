/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

/**
 * Clean and format phone number for WhatsApp
 */
export const getWhatsAppUrl = (phone?: string): string => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return '';

  // Handle Egyptian phone numbers starting with 01
  let formatted = cleaned;
  if (formatted.startsWith('01') && formatted.length === 11) {
    formatted = '2' + formatted;
  } else if (!formatted.startsWith('20') && formatted.length === 10) {
    formatted = '20' + formatted;
  }

  return `https://wa.me/${formatted}`;
};

/**
 * Handle opening WhatsApp
 */
export const openWhatsApp = (e: React.MouseEvent, phone?: string) => {
  if (!phone) return;
  const url = getWhatsAppUrl(phone);
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

/**
 * Format Messenger URL from profile/username/link
 */
export const formatMessengerUrl = (messenger?: string): string => {
  if (!messenger) return '';
  const trimmed = messenger.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // If it's a username or id
  const cleanId = trimmed.replace(/^@/, '');
  return `https://m.me/${cleanId}`;
};

/**
 * Format phone call URL
 */
export const getTelUrl = (phone?: string): string => {
  if (!phone) return '';
  const cleaned = phone.replace(/[^\d+]/g, '');
  return cleaned ? `tel:${cleaned}` : '';
};
