/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useId } from 'react';

export type Icon3DName =
  | 'salary'
  | 'pocket'
  | 'capital'
  | 'charity'
  | 'entry'
  | 'bag'
  | 'offices'
  | 'orders'
  | 'create_order'
  | 'sell'
  | 'advance'
  | 'reconcile'
  | 'reports'
  | 'pie'
  | 'settings'
  | 'insights'
  | 'wallet'
  | 'dollar'
  | 'money_in'
  | 'money_out'
  | 'profit'
  | 'loss'
  | 'percent'
  | 'charity_heart'
  | 'layers'
  | 'warning'
  | 'danger'
  | 'shield_alert'
  | 'shield_ok'
  | 'flame'
  | 'lightbulb'
  | 'check'
  | 'checkbox_on'
  | 'checkbox_off'
  | 'lock'
  | 'unlock'
  | 'plus'
  | 'edit'
  | 'trash'
  | 'save'
  | 'download'
  | 'upload'
  | 'excel'
  | 'install'
  | 'search'
  | 'calendar'
  | 'clock'
  | 'history'
  | 'bell'
  | 'menu'
  | 'close'
  | 'chevron_down'
  | 'chevron_up'
  | 'chevron_left'
  | 'back'
  | 'app_logo'
  | 'verified'
  | 'grid'
  | 'customers';

interface Icon3DProps {
  name: Icon3DName | string;
  size?: number;
  className?: string;
  title?: string;
}

export const Icon3D: React.FC<Icon3DProps> = ({
  name,
  size = 40,
  className = '',
  title,
}) => {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9]/g, '');

  const renderIconContent = () => {
    switch (name) {
      // 1. SALARY: Brown stitched leather wallet with golden button & green bills sticking out
      case 'salary':
        return (
          <>
            <defs>
              <linearGradient id={`${id}-w1`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8D5524" />
                <stop offset="50%" stopColor="#6C3E18" />
                <stop offset="100%" stopColor="#4A260C" />
              </linearGradient>
              <linearGradient id={`${id}-cash`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4ADE80" />
                <stop offset="100%" stopColor="#15803D" />
              </linearGradient>
              <linearGradient id={`${id}-gold`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FDE047" />
                <stop offset="100%" stopColor="#EAB308" />
              </linearGradient>
              <filter id={`${id}-sh`} x="-15%" y="-15%" width="130%" height="130%">
                <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#2B1506" floodOpacity="0.35" />
              </filter>
            </defs>
            {/* Cash bills emerging from wallet */}
            <g transform="translate(18, 14) rotate(-10)">
              <rect x="0" y="0" width="46" height="26" rx="4" fill={`url(#${id}-cash)`} filter={`url(#${id}-sh)`} />
              <circle cx="23" cy="13" r="6" fill="#86EFAC" fillOpacity="0.4" />
              <rect x="4" y="4" width="38" height="18" rx="2" fill="none" stroke="#BBF7D0" strokeWidth="1.5" strokeDasharray="3 2" />
            </g>
            <g transform="translate(32, 12) rotate(6)">
              <rect x="0" y="0" width="44" height="26" rx="4" fill="#22C55E" filter={`url(#${id}-sh)`} />
              <circle cx="22" cy="13" r="5" fill="#DCFCE7" fillOpacity="0.5" />
            </g>
            {/* Wallet body */}
            <rect x="14" y="32" width="68" height="50" rx="14" fill={`url(#${id}-w1)`} filter={`url(#${id}-sh)`} />
            {/* Top highlight */}
            <path d="M 24 35 Q 48 37 72 35" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
            {/* Stitches */}
            <rect x="18" y="36" width="60" height="42" rx="10" fill="none" stroke="#FDE68A" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.75" />
            {/* Wallet flap & clasp */}
            <path d="M 14 42 Q 48 56 82 42" fill="none" stroke="#4A260C" strokeWidth="2.5" />
            <circle cx="68" cy="54" r="8" fill={`url(#${id}-gold)`} filter={`url(#${id}-sh)`} />
            <circle cx="68" cy="54" r="3.5" fill="#78350F" />
            <circle cx="66" cy="52" r="1.5" fill="#FEF08A" />
          </>
        );

      // 2. POCKET: Steel-navy safe vault with open door, wheel lock & golden coins
      case 'pocket':
        return (
          <>
            <defs>
              <linearGradient id={`${id}-safe`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3B4863" />
                <stop offset="100%" stopColor="#1E293B" />
              </linearGradient>
              <linearGradient id={`${id}-door`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#60A5FA" />
                <stop offset="100%" stopColor="#1D4ED8" />
              </linearGradient>
              <linearGradient id={`${id}-coin`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FDE047" />
                <stop offset="100%" stopColor="#D97706" />
              </linearGradient>
            </defs>
            {/* Safe Body */}
            <rect x="12" y="16" width="72" height="66" rx="14" fill={`url(#${id}-safe)`} />
            <rect x="16" y="20" width="64" height="58" rx="10" fill="#0F172A" />
            {/* Shiny gold coins inside safe */}
            <circle cx="34" cy="58" r="8" fill={`url(#${id}-coin)`} />
            <circle cx="44" cy="62" r="7.5" fill={`url(#${id}-coin)`} />
            <circle cx="38" cy="48" r="7" fill={`url(#${id}-coin)`} />
            <text x="38" y="52" fontSize="9" fontWeight="bold" fill="#78350F" textAnchor="middle">$</text>
            {/* Safe Door (ajar / open) */}
            <path d="M 50 20 L 86 28 L 86 78 L 50 78 Z" fill={`url(#${id}-door)`} rx="4" />
            {/* Highlight on door */}
            <path d="M 54 24 L 82 31" stroke="#93C5FD" strokeWidth="2" strokeLinecap="round" />
            {/* Vault lock wheel */}
            <circle cx="68" cy="52" r="11" fill="#F8FAFC" />
            <circle cx="68" cy="52" r="7" fill="#0284C7" />
            <circle cx="68" cy="52" r="3" fill="#FDE047" />
            <line x1="68" y1="43" x2="68" y2="61" stroke="#F8FAFC" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="59" y1="52" x2="77" y2="52" stroke="#F8FAFC" strokeWidth="2.5" strokeLinecap="round" />
          </>
        );

      // 3. CAPITAL: Green money bag with $, coin stacks, orange growth arrow
      case 'capital':
        return (
          <>
            <defs>
              <linearGradient id={`${id}-bag`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#34D399" />
                <stop offset="60%" stopColor="#059669" />
                <stop offset="100%" stopColor="#064E3B" />
              </linearGradient>
              <linearGradient id={`${id}-gold`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FDE047" />
                <stop offset="100%" stopColor="#D97706" />
              </linearGradient>
              <linearGradient id={`${id}-arr`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FB923C" />
                <stop offset="100%" stopColor="#EA580C" />
              </linearGradient>
            </defs>
            {/* Coin stacks on left */}
            <ellipse cx="24" cy="74" rx="10" ry="4" fill="#B45309" />
            <ellipse cx="24" cy="70" rx="10" ry="4" fill={`url(#${id}-gold)`} />
            <ellipse cx="24" cy="65" rx="10" ry="4" fill={`url(#${id}-gold)`} />
            <ellipse cx="24" cy="60" rx="10" ry="4" fill={`url(#${id}-gold)`} />
            {/* Money bag */}
            <path
              d="M 40 28 C 40 22 48 16 54 16 C 60 16 68 22 68 28 C 65 30 63 32 63 34 C 74 38 84 50 82 66 C 80 78 70 84 54 84 C 38 84 28 78 26 66 C 24 50 34 38 45 34 C 45 32 43 30 40 28 Z"
              fill={`url(#${id}-bag)`}
            />
            {/* Golden tie string */}
            <path d="M 44 34 Q 54 37 64 34" stroke="#FDE047" strokeWidth="3" strokeLinecap="round" />
            {/* Specular highlight */}
            <path d="M 36 50 Q 42 42 56 42" stroke="#A7F3D0" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
            {/* $ badge */}
            <circle cx="54" cy="60" r="10" fill="#FEF3C7" />
            <text x="54" y="66" fontSize="15" fontWeight="900" fill="#047857" textAnchor="middle">$</text>
            {/* Orange upward growth arrow */}
            <g transform="translate(62, 16) scale(0.85)">
              <circle cx="16" cy="16" r="16" fill={`url(#${id}-arr)`} />
              <path d="M 16 8 L 24 16 L 19 16 L 19 24 L 13 24 L 13 16 L 8 16 Z" fill="#FFFFFF" />
            </g>
          </>
        );

      // 4. CHARITY: 3 golden coins stacked with green plant sprouting leaves
      case 'charity':
        return (
          <>
            <defs>
              <linearGradient id={`${id}-gold`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FDE047" />
                <stop offset="60%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#B45309" />
              </linearGradient>
              <linearGradient id={`${id}-leaf`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#86EFAC" />
                <stop offset="70%" stopColor="#22C55E" />
                <stop offset="100%" stopColor="#15803D" />
              </linearGradient>
            </defs>
            {/* Coin 1 (Bottom) */}
            <ellipse cx="48" cy="78" rx="28" ry="9" fill="#92400E" />
            <ellipse cx="48" cy="75" rx="28" ry="8.5" fill={`url(#${id}-gold)`} />
            {/* Coin 2 (Middle) */}
            <ellipse cx="48" cy="66" rx="25" ry="8" fill="#92400E" />
            <ellipse cx="48" cy="63" rx="25" ry="7.5" fill={`url(#${id}-gold)`} />
            {/* Coin 3 (Top) */}
            <ellipse cx="48" cy="54" rx="22" ry="7" fill="#92400E" />
            <ellipse cx="48" cy="51" rx="22" ry="6.5" fill={`url(#${id}-gold)`} />
            {/* Sprouting plant stem */}
            <path d="M 48 51 Q 48 34 46 22" stroke="#16A34A" strokeWidth="4.5" strokeLinecap="round" fill="none" />
            {/* Left Leaf */}
            <path
              d="M 46 36 C 30 36 24 24 26 18 C 36 18 44 26 46 36 Z"
              fill={`url(#${id}-leaf)`}
            />
            {/* Right Leaf */}
            <path
              d="M 47 26 C 64 26 70 14 68 8 C 58 8 50 16 47 26 Z"
              fill={`url(#${id}-leaf)`}
            />
            {/* Little water droplets/sparkles */}
            <circle cx="28" cy="14" r="2.5" fill="#38BDF8" />
            <circle cx="68" cy="28" r="2" fill="#38BDF8" />
          </>
        );

      // 5. ENTRY / PLUS_CIRCLE: Open journal notebook with pen, coin, green + badge
      case 'entry':
        return (
          <>
            <defs>
              <linearGradient id={`${id}-book`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#818CF8" />
                <stop offset="100%" stopColor="#4338CA" />
              </linearGradient>
              <linearGradient id={`${id}-page`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="100%" stopColor="#F1F5F9" />
              </linearGradient>
            </defs>
            {/* Book cover */}
            <rect x="14" y="20" width="68" height="58" rx="8" fill={`url(#${id}-book)`} />
            {/* Pages */}
            <path d="M 18 24 L 46 24 L 46 72 L 18 72 Z" fill={`url(#${id}-page)`} rx="3" />
            <path d="M 50 24 L 78 24 L 78 72 L 50 72 Z" fill={`url(#${id}-page)`} rx="3" />
            {/* Ruled lines */}
            <line x1="22" y1="32" x2="42" y2="32" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
            <line x1="22" y1="42" x2="42" y2="42" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
            <line x1="22" y1="52" x2="38" y2="52" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
            <line x1="54" y1="32" x2="74" y2="32" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
            <line x1="54" y1="42" x2="74" y2="42" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
            {/* Pen */}
            <g transform="translate(60, 10) rotate(42)">
              <rect x="0" y="0" width="8" height="34" rx="3" fill="#F59E0B" />
              <polygon points="0,34 8,34 4,42" fill="#1E293B" />
              <rect x="0" y="4" width="8" height="4" fill="#E2E8F0" />
            </g>
            {/* Big Green + badge in bottom corner */}
            <circle cx="72" cy="72" r="14" fill="#22C55E" />
            <line x1="72" y1="64" x2="72" y2="80" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="64" y1="72" x2="80" y2="72" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
          </>
        );

      // 6. BAG / BRIEFCASE: Orange leather satchel with cash & receipt sticking out
      case 'bag':
        return (
          <>
            <defs>
              <linearGradient id={`${id}-leather`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FB923C" />
                <stop offset="50%" stopColor="#EA580C" />
                <stop offset="100%" stopColor="#9A3412" />
              </linearGradient>
            </defs>
            {/* Handle */}
            <path d="M 34 26 C 34 16 62 16 62 26" stroke="#7C2D12" strokeWidth="5" strokeLinecap="round" fill="none" />
            <path d="M 36 26 C 36 18 60 18 60 26" stroke="#FB923C" strokeWidth="2" strokeLinecap="round" fill="none" />
            {/* Emerging receipt & money */}
            <rect x="28" y="18" width="18" height="24" rx="2" fill="#FFFFFF" transform="rotate(-8 28 18)" />
            <rect x="46" y="16" width="22" height="18" rx="3" fill="#4ADE80" transform="rotate(8 46 16)" />
            {/* Satchel Body */}
            <rect x="14" y="28" width="68" height="52" rx="14" fill={`url(#${id}-leather)`} />
            {/* Flap */}
            <path d="M 14 36 Q 48 56 82 36 L 82 28 L 14 28 Z" fill="#C2410C" />
            <path d="M 16 30 L 80 30" stroke="#FDBA74" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
            {/* Twin golden straps */}
            <rect x="28" y="32" width="6" height="30" rx="3" fill="#FDE047" />
            <rect x="62" y="32" width="6" height="30" rx="3" fill="#FDE047" />
            <circle cx="31" cy="48" r="2" fill="#78350F" />
            <circle cx="65" cy="48" r="2" fill="#78350F" />
          </>
        );

      // 7. OFFICES: Storefront building with awning, sign & delivery box
      case 'offices':
        return (
          <>
            <defs>
              <linearGradient id={`${id}-bld`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#67E8F9" />
                <stop offset="100%" stopColor="#0891B2" />
              </linearGradient>
            </defs>
            {/* Main building */}
            <rect x="18" y="24" width="60" height="58" rx="8" fill={`url(#${id}-bld)`} />
            {/* Storefront striped awning */}
            <path d="M 14 26 L 82 26 L 76 40 L 20 40 Z" fill="#EF4444" />
            <path d="M 24 26 L 34 26 L 31 40 L 21 40 Z" fill="#FFFFFF" />
            <path d="M 44 26 L 54 26 L 51 40 L 41 40 Z" fill="#FFFFFF" />
            <path d="M 64 26 L 74 26 L 71 40 L 61 40 Z" fill="#FFFFFF" />
            {/* Store door */}
            <rect x="36" y="52" width="24" height="30" rx="4" fill="#0E7490" />
            <rect x="40" y="56" width="16" height="14" rx="2" fill="#CFFAFE" />
            {/* Windows */}
            <rect x="22" y="48" width="10" height="12" rx="2" fill="#E0F2FE" />
            <rect x="64" y="48" width="10" height="12" rx="2" fill="#E0F2FE" />
            {/* Cardboard box at doorstep */}
            <rect x="62" y="66" width="18" height="16" rx="3" fill="#D97706" />
            <line x1="62" y1="72" x2="80" y2="72" stroke="#78350F" strokeWidth="1.5" />
          </>
        );

      // 8. ORDERS: Shopping cart loaded with colorful boxes & bags
      case 'orders':
        return (
          <>
            <defs>
              <linearGradient id={`${id}-cart`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#93C5FD" />
                <stop offset="100%" stopColor="#2563EB" />
              </linearGradient>
            </defs>
            {/* Cargo: boxes & bags */}
            <rect x="24" y="22" width="20" height="22" rx="4" fill="#F59E0B" />
            <rect x="40" y="16" width="22" height="24" rx="4" fill="#EC4899" />
            <rect x="30" y="28" width="26" height="18" rx="4" fill="#10B981" />
            {/* Cart basket */}
            <path
              d="M 14 36 L 24 36 L 36 64 L 72 64 L 80 40 L 26 40"
              stroke={`url(#${id}-cart)`}
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            {/* Inner basket grid */}
            <line x1="38" y1="42" x2="44" y2="60" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" />
            <line x1="52" y1="42" x2="56" y2="60" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" />
            <line x1="66" y1="42" x2="68" y2="60" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" />
            {/* Wheels */}
            <circle cx="38" cy="76" r="6" fill="#1E293B" />
            <circle cx="38" cy="76" r="2.5" fill="#94A3B8" />
            <circle cx="68" cy="76" r="6" fill="#1E293B" />
            <circle cx="68" cy="76" r="2.5" fill="#94A3B8" />
          </>
        );

      // 9. CREATE_ORDER: Shopping cart with green plus badge
      case 'create_order':
        return (
          <>
            <defs>
              <linearGradient id={`${id}-cart`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#A78BFA" />
                <stop offset="100%" stopColor="#6D28D9" />
              </linearGradient>
            </defs>
            {/* Boxes */}
            <rect x="26" y="20" width="18" height="20" rx="3" fill="#F59E0B" />
            <rect x="40" y="24" width="20" height="18" rx="3" fill="#3B82F6" />
            {/* Cart */}
            <path
              d="M 14 34 L 22 34 L 32 60 L 68 60 L 74 38 L 24 38"
              stroke={`url(#${id}-cart)`}
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <circle cx="36" cy="72" r="5.5" fill="#1E293B" />
            <circle cx="64" cy="72" r="5.5" fill="#1E293B" />
            {/* Green plus badge */}
            <circle cx="72" cy="22" r="14" fill="#22C55E" />
            <line x1="72" y1="14" x2="72" y2="30" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="64" y1="22" x2="80" y2="22" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
          </>
        );

      // 10. SELL: Green price tag with $, cash & coin
      case 'sell':
        return (
          <>
            <defs>
              <linearGradient id={`${id}-tag`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4ADE80" />
                <stop offset="100%" stopColor="#15803D" />
              </linearGradient>
            </defs>
            {/* Cash bill behind */}
            <rect x="18" y="18" width="46" height="30" rx="4" fill="#86EFAC" transform="rotate(-15 18 18)" />
            {/* Big price tag */}
            <g transform="translate(24, 20) rotate(15)">
              <path
                d="M 10 0 L 44 0 C 48 0 52 4 52 8 L 52 42 C 52 46 48 50 44 50 L 10 50 C 6 50 0 44 0 38 L 0 12 Z"
                fill={`url(#${id}-tag)`}
              />
              <circle cx="8" cy="25" r="4" fill="#FFFFFF" />
              <text x="32" y="34" fontSize="22" fontWeight="900" fill="#FFFFFF" textAnchor="middle">$</text>
            </g>
            {/* Golden coin in front */}
            <circle cx="68" cy="68" r="14" fill="#F59E0B" />
            <circle cx="68" cy="68" r="10" fill="#FDE047" />
            <text x="68" y="73" fontSize="13" fontWeight="900" fill="#B45309" textAnchor="middle">★</text>
          </>
        );

      // 11. ADVANCE: Two golden coins with two circular exchange arrows
      case 'advance':
        return (
          <>
            <defs>
              <linearGradient id={`${id}-gold`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FDE047" />
                <stop offset="100%" stopColor="#D97706" />
              </linearGradient>
            </defs>
            {/* Left coin */}
            <circle cx="28" cy="48" r="18" fill={`url(#${id}-gold)`} />
            <circle cx="28" cy="48" r="13" fill="#FEF08A" />
            <text x="28" y="54" fontSize="14" fontWeight="bold" fill="#B45309" textAnchor="middle">1</text>
            {/* Right coin */}
            <circle cx="68" cy="48" r="18" fill={`url(#${id}-gold)`} />
            <circle cx="68" cy="48" r="13" fill="#FEF08A" />
            <text x="68" y="54" fontSize="14" fontWeight="bold" fill="#B45309" textAnchor="middle">2</text>
            {/* Top arrow right */}
            <path d="M 32 26 Q 48 18 64 26" fill="none" stroke="#8D55A2" strokeWidth="4" strokeLinecap="round" />
            <polygon points="66,22 68,30 60,28" fill="#8D55A2" />
            {/* Bottom arrow left */}
            <path d="M 64 70 Q 48 78 32 70" fill="none" stroke="#22C55E" strokeWidth="4" strokeLinecap="round" />
            <polygon points="30,74 28,66 36,68" fill="#22C55E" />
          </>
        );

      // 12. RECONCILE: Small bag, balance scale & green checkmark
      case 'reconcile':
        return (
          <>
            <defs>
              <linearGradient id={`${id}-scale`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#B45309" />
              </linearGradient>
            </defs>
            {/* Scale Pillar */}
            <rect x="45" y="24" width="6" height="52" rx="3" fill={`url(#${id}-scale)`} />
            <rect x="32" y="72" width="32" height="8" rx="4" fill="#92400E" />
            {/* Top Beam */}
            <line x1="18" y1="30" x2="78" y2="30" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
            <circle cx="48" cy="30" r="5" fill="#FDE047" />
            {/* Left Pan */}
            <line x1="22" y1="32" x2="16" y2="52" stroke="#D97706" strokeWidth="1.5" />
            <line x1="22" y1="32" x2="28" y2="52" stroke="#D97706" strokeWidth="1.5" />
            <path d="M 12 52 Q 22 60 32 52 Z" fill="#FDE047" />
            {/* Right Pan */}
            <line x1="74" y1="32" x2="68" y2="52" stroke="#D97706" strokeWidth="1.5" />
            <line x1="74" y1="32" x2="80" y2="52" stroke="#D97706" strokeWidth="1.5" />
            <path d="M 64 52 Q 74 60 84 52 Z" fill="#FDE047" />
            {/* Big Green Verified Check */}
            <circle cx="48" cy="50" r="14" fill="#22C55E" />
            <path d="M 42 50 L 46 54 L 54 44" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </>
        );

      // 13. REPORTS: Colorful 3D bar charts with magnifying glass
      case 'reports':
        return (
          <>
            <defs>
              <linearGradient id={`${id}-b1`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#0284C7" />
              </linearGradient>
              <linearGradient id={`${id}-b2`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#F472B6" />
                <stop offset="100%" stopColor="#DB2777" />
              </linearGradient>
              <linearGradient id={`${id}-b3`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#A78BFA" />
                <stop offset="100%" stopColor="#7C3AED" />
              </linearGradient>
            </defs>
            {/* Bar 1 */}
            <rect x="18" y="46" width="16" height="34" rx="5" fill={`url(#${id}-b1)`} />
            <ellipse cx="26" cy="46" rx="8" ry="3" fill="#BAE6FD" />
            {/* Bar 2 */}
            <rect x="40" y="24" width="16" height="56" rx="5" fill={`url(#${id}-b2)`} />
            <ellipse cx="48" cy="24" rx="8" ry="3" fill="#FBCFE8" />
            {/* Bar 3 */}
            <rect x="62" y="34" width="16" height="46" rx="5" fill={`url(#${id}-b3)`} />
            <ellipse cx="70" cy="34" rx="8" ry="3" fill="#DDD6FE" />
            {/* Baseline */}
            <rect x="12" y="78" width="72" height="5" rx="2.5" fill="#CBD5E1" />
            {/* Magnifying glass */}
            <g transform="translate(42, 10) rotate(-15)">
              <circle cx="20" cy="20" r="14" fill="#38BDF8" fillOpacity="0.4" stroke="#F59E0B" strokeWidth="4" />
              <line x1="30" y1="30" x2="42" y2="42" stroke="#D97706" strokeWidth="5" strokeLinecap="round" />
            </g>
          </>
        );

      // 14. PIE: 3D multi-color pie chart with popped out slice
      case 'pie':
        return (
          <>
            <defs>
              <linearGradient id={`${id}-p1`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#0284C7" />
              </linearGradient>
              <linearGradient id={`${id}-p2`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4ADE80" />
                <stop offset="100%" stopColor="#16A34A" />
              </linearGradient>
              <linearGradient id={`${id}-p3`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FB7185" />
                <stop offset="100%" stopColor="#E11D48" />
              </linearGradient>
            </defs>
            {/* Base circle sectors */}
            <circle cx="46" cy="52" r="32" fill={`url(#${id}-p1)`} />
            {/* Top slice (green) */}
            <path d="M 46 52 L 46 20 A 32 32 0 0 1 78 52 Z" fill={`url(#${id}-p2)`} />
            {/* Popped out slice (red-orange) */}
            <g transform="translate(8, -8)">
              <path d="M 46 52 L 14 52 A 32 32 0 0 1 46 20 Z" fill={`url(#${id}-p3)`} />
              <path d="M 46 52 L 14 52" stroke="#FFF" strokeWidth="1.5" opacity="0.6" />
            </g>
          </>
        );

      // 15. SETTINGS: Golden 3D gear with shiny wrench
      case 'settings':
        return (
          <>
            <defs>
              <linearGradient id={`${id}-gear`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FDE047" />
                <stop offset="50%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#B45309" />
              </linearGradient>
              <linearGradient id={`${id}-metal`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#E2E8F0" />
                <stop offset="100%" stopColor="#64748B" />
              </linearGradient>
            </defs>
            {/* 3D Gear */}
            <g transform="translate(42, 42)">
              <circle cx="0" cy="0" r="28" fill={`url(#${id}-gear)`} />
              {/* Teeth */}
              {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
                <rect
                  key={angle}
                  x="-6"
                  y="-34"
                  width="12"
                  height="12"
                  rx="3"
                  fill="#D97706"
                  transform={`rotate(${angle})`}
                />
              ))}
              <circle cx="0" cy="0" r="12" fill="#78350F" />
              <circle cx="0" cy="0" r="8" fill="#F1F1FA" />
            </g>
            {/* Shiny steel wrench angled across */}
            <g transform="translate(20, 26) rotate(-35)">
              <rect x="0" y="8" width="10" height="42" rx="4" fill={`url(#${id}-metal)`} />
              <circle cx="5" cy="8" r="10" fill={`url(#${id}-metal)`} />
              <rect x="1" y="0" width="8" height="10" fill="#78350F" />
            </g>
          </>
        );

      // 16. INSIGHTS / SPARKLES: Bright golden bulb with rays & twinkles
      case 'insights':
      case 'lightbulb':
        return (
          <>
            <defs>
              <linearGradient id={`${id}-bulb`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FEF08A" />
                <stop offset="50%" stopColor="#FACC15" />
                <stop offset="100%" stopColor="#EAB308" />
              </linearGradient>
            </defs>
            {/* Glowing rays */}
            <line x1="48" y1="8" x2="48" y2="16" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
            <line x1="22" y1="20" x2="28" y2="26" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
            <line x1="74" y1="20" x2="68" y2="26" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
            <line x1="12" y1="46" x2="20" y2="46" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
            <line x1="84" y1="46" x2="76" y2="46" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
            {/* Bulb Dome */}
            <path
              d="M 28 42 C 28 30 37 20 48 20 C 59 20 68 30 68 42 C 68 50 62 56 60 62 L 36 62 C 34 56 28 50 28 42 Z"
              fill={`url(#${id}-bulb)`}
            />
            {/* Specular highlight */}
            <ellipse cx="40" cy="32" rx="6" ry="10" fill="#FFFFFF" opacity="0.6" transform="rotate(-30 40 32)" />
            {/* Screw base */}
            <rect x="38" y="64" width="20" height="5" rx="2" fill="#94A3B8" />
            <rect x="40" y="70" width="16" height="5" rx="2" fill="#64748B" />
            <circle cx="48" cy="76" r="3" fill="#334155" />
          </>
        );

      // 17. WALLET: Puffy brown coin wallet
      case 'wallet':
        return (
          <>
            <defs>
              <linearGradient id={`${id}-w`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#A16207" />
                <stop offset="100%" stopColor="#713F12" />
              </linearGradient>
            </defs>
            <rect x="14" y="24" width="68" height="50" rx="14" fill={`url(#${id}-w)`} />
            <path d="M 14 36 Q 48 48 82 36" stroke="#EAB308" strokeWidth="2.5" fill="none" />
            <circle cx="68" cy="49" r="8" fill="#FDE047" />
            <circle cx="68" cy="49" r="3" fill="#713F12" />
          </>
        );

      // 18. DOLLAR: Big golden 3D coin with $
      case 'dollar':
        return (
          <>
            <defs>
              <linearGradient id={`${id}-c`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FEF08A" />
                <stop offset="50%" stopColor="#FACC15" />
                <stop offset="100%" stopColor="#CA8A04" />
              </linearGradient>
            </defs>
            <circle cx="48" cy="50" r="34" fill="#A16207" />
            <circle cx="48" cy="46" r="34" fill={`url(#${id}-c)`} />
            <circle cx="48" cy="46" r="26" fill="none" stroke="#FEF08A" strokeWidth="3" />
            <text x="48" y="56" fontSize="30" fontWeight="900" fill="#854D0E" textAnchor="middle">$</text>
          </>
        );

      // 19. MONEY_IN: Green arrow pointing into a treasure chest
      case 'money_in':
        return (
          <>
            <defs>
              <linearGradient id={`${id}-box`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#60A5FA" />
                <stop offset="100%" stopColor="#1E40AF" />
              </linearGradient>
            </defs>
            <rect x="18" y="44" width="60" height="36" rx="8" fill={`url(#${id}-box)`} />
            <rect x="14" y="40" width="68" height="10" rx="4" fill="#3B82F6" />
            {/* Arrow going in */}
            <path d="M 48 12 L 48 40" stroke="#22C55E" strokeWidth="8" strokeLinecap="round" />
            <polygon points="34,36 62,36 48,52" fill="#22C55E" />
          </>
        );

      // 20. MONEY_OUT: Red arrow emerging from a wallet
      case 'money_out':
        return (
          <>
            <defs>
              <linearGradient id={`${id}-w`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#94A3B8" />
                <stop offset="100%" stopColor="#475569" />
              </linearGradient>
            </defs>
            <rect x="16" y="46" width="64" height="34" rx="8" fill={`url(#${id}-w)`} />
            {/* Red arrow shooting up */}
            <path d="M 48 48 L 48 20" stroke="#EF4444" strokeWidth="8" strokeLinecap="round" />
            <polygon points="34,24 62,24 48,8" fill="#EF4444" />
          </>
        );

      // 21. PROFIT / TRENDING_UP: Green arrow soaring over bars and coin
      case 'profit':
        return (
          <>
            <defs>
              <linearGradient id={`${id}-arr`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4ADE80" />
                <stop offset="100%" stopColor="#15803D" />
              </linearGradient>
            </defs>
            {/* Bars */}
            <rect x="16" y="58" width="14" height="24" rx="4" fill="#BBF7D0" />
            <rect x="36" y="42" width="14" height="40" rx="4" fill="#86EFAC" />
            <rect x="56" y="28" width="14" height="54" rx="4" fill="#4ADE80" />
            {/* Bold soaring arrow */}
            <path
              d="M 18 50 Q 42 34 76 18"
              stroke={`url(#${id}-arr)`}
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
            />
            <polygon points="66,14 80,16 74,30" fill="#15803D" />
          </>
        );

      // 22. LOSS / TRENDING_DOWN: Red arrow declining over descending bars
      case 'loss':
        return (
          <>
            <defs>
              <linearGradient id={`${id}-arr`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F87171" />
                <stop offset="100%" stopColor="#B91C1C" />
              </linearGradient>
            </defs>
            <rect x="16" y="28" width="14" height="54" rx="4" fill="#FCA5A5" />
            <rect x="36" y="44" width="14" height="38" rx="4" fill="#F87171" />
            <rect x="56" y="60" width="14" height="22" rx="4" fill="#EF4444" />
            <path
              d="M 18 20 Q 44 38 76 68"
              stroke={`url(#${id}-arr)`}
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
            />
            <polygon points="76,54 78,72 62,70" fill="#B91C1C" />
          </>
        );

      // 23. PERCENT: Green circle with 3D % badge
      case 'percent':
        return (
          <>
            <circle cx="48" cy="48" r="34" fill="#16A34A" />
            <circle cx="48" cy="46" r="32" fill="#22C55E" />
            <circle cx="36" cy="36" r="7" fill="#FFFFFF" />
            <circle cx="60" cy="56" r="7" fill="#FFFFFF" />
            <line x1="62" y1="32" x2="34" y2="60" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
          </>
        );

      // 24. CHARITY_HEART: Hands holding a glowing 3D red heart
      case 'charity_heart':
        return (
          <>
            <defs>
              <linearGradient id={`${id}-hrt`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FB7185" />
                <stop offset="50%" stopColor="#F43F5E" />
                <stop offset="100%" stopColor="#BE123C" />
              </linearGradient>
            </defs>
            {/* Hands cradle */}
            <path d="M 18 64 C 26 56 36 68 48 78 C 60 68 70 56 78 64 C 74 76 56 86 48 86 C 40 86 22 76 18 64 Z" fill="#F59E0B" />
            {/* Big Heart */}
            <path
              d="M 48 28 C 42 16 24 16 20 32 C 16 48 38 60 48 68 C 58 60 80 48 76 32 C 72 16 54 16 48 28 Z"
              fill={`url(#${id}-hrt)`}
            />
            <circle cx="34" cy="28" r="4" fill="#FECDD3" opacity="0.6" />
          </>
        );

      // 25. LAYERS: 3 colorful stacked sheets
      case 'layers':
        return (
          <>
            <polygon points="48,16 80,30 48,44 16,30" fill="#3B82F6" />
            <polygon points="48,34 80,48 48,62 16,48" fill="#EC4899" />
            <polygon points="48,52 80,66 48,80 16,66" fill="#F59E0B" />
          </>
        );

      // 26. WARNING: Orange puffy triangle with exclamation mark
      case 'warning':
        return (
          <>
            <defs>
              <linearGradient id={`${id}-w`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FDE047" />
                <stop offset="100%" stopColor="#F97316" />
              </linearGradient>
            </defs>
            <path
              d="M 48 14 L 84 74 C 86 78 82 82 78 82 L 18 82 C 14 82 10 78 12 74 Z"
              fill={`url(#${id}-w)`}
            />
            <line x1="48" y1="36" x2="48" y2="56" stroke="#431407" strokeWidth="6" strokeLinecap="round" />
            <circle cx="48" cy="68" r="4.5" fill="#431407" />
          </>
        );

      // 27. DANGER: Red octagon with stop symbol
      case 'danger':
        return (
          <>
            <polygon points="30,14 66,14 84,32 84,68 66,86 30,86 12,68 12,32" fill="#EF4444" />
            <polygon points="32,18 64,18 80,34 80,66 64,82 32,82 16,66 16,34" fill="#DC2626" />
            <rect x="28" y="44" width="40" height="10" rx="5" fill="#FFFFFF" />
          </>
        );

      // 28. SHIELD_ALERT: Orange shield with exclamation mark
      case 'shield_alert':
        return (
          <>
            <path
              d="M 48 12 L 80 24 C 80 56 64 74 48 84 C 32 74 16 56 16 24 Z"
              fill="#F97316"
            />
            <line x1="48" y1="32" x2="48" y2="52" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
            <circle cx="48" cy="64" r="4" fill="#FFFFFF" />
          </>
        );

      // 29. SHIELD_OK: Purple shield with green check
      case 'shield_ok':
        return (
          <>
            <path
              d="M 48 12 L 80 24 C 80 56 64 74 48 84 C 32 74 16 56 16 24 Z"
              fill="#5F2967"
            />
            <circle cx="48" cy="48" r="18" fill="#22C55E" />
            <path d="M 40 48 L 46 54 L 56 42" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </>
        );

      // 30. FLAME: 3D orange and yellow flame (high spend / burn rate)
      case 'flame':
        return (
          <>
            <defs>
              <linearGradient id={`${id}-fl`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F97316" />
                <stop offset="100%" stopColor="#DC2626" />
              </linearGradient>
            </defs>
            <path
              d="M 48 12 C 48 12 66 32 66 52 C 66 68 56 82 48 82 C 40 82 30 68 30 52 C 30 38 42 26 48 12 Z"
              fill={`url(#${id}-fl)`}
            />
            <path
              d="M 48 38 C 48 38 56 48 56 60 C 56 70 52 76 48 76 C 44 76 40 70 40 60 C 40 50 46 44 48 38 Z"
              fill="#FDE047"
            />
          </>
        );

      // 32. CHECK: Green circular button with white check
      case 'check':
        return (
          <>
            <circle cx="48" cy="50" r="32" fill="#15803D" />
            <circle cx="48" cy="46" r="32" fill="#22C55E" />
            <path d="M 34 46 L 44 56 L 64 36" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </>
        );

      // 33. CHECKBOX_ON: 3D rounded green square with check
      case 'checkbox_on':
        return (
          <>
            <rect x="16" y="20" width="64" height="60" rx="14" fill="#15803D" />
            <rect x="16" y="16" width="64" height="60" rx="14" fill="#22C55E" />
            <path d="M 32 46 L 44 58 L 66 34" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </>
        );

      // 34. CHECKBOX_OFF: 3D rounded cream/slate empty square
      case 'checkbox_off':
        return (
          <>
            <rect x="16" y="20" width="64" height="60" rx="14" fill="#CBD5E1" />
            <rect x="16" y="16" width="64" height="60" rx="14" fill="#F8FAFC" />
            <rect x="22" y="22" width="52" height="48" rx="10" fill="#E2E8F0" />
          </>
        );

      // 35. LOCK: Golden closed padlock
      case 'lock':
        return (
          <>
            <path d="M 32 44 L 32 28 C 32 18 64 18 64 28 L 64 44" stroke="#94A3B8" strokeWidth="8" strokeLinecap="round" fill="none" />
            <rect x="20" y="42" width="56" height="42" rx="12" fill="#F59E0B" />
            <circle cx="48" cy="60" r="6" fill="#78350F" />
            <rect x="46" y="62" width="4" height="10" rx="2" fill="#78350F" />
          </>
        );

      // 36. UNLOCK: Golden open padlock
      case 'unlock':
        return (
          <>
            <path d="M 32 38 L 32 24 C 32 14 64 14 64 24" stroke="#94A3B8" strokeWidth="8" strokeLinecap="round" fill="none" />
            <rect x="20" y="42" width="56" height="42" rx="12" fill="#10B981" />
            <circle cx="48" cy="60" r="6" fill="#064E3B" />
            <rect x="46" y="62" width="4" height="10" rx="2" fill="#064E3B" />
          </>
        );

      // 37. PLUS: Circular 3D green button with white plus
      case 'plus':
        return (
          <>
            <circle cx="48" cy="50" r="32" fill="#15803D" />
            <circle cx="48" cy="46" r="32" fill="#22C55E" />
            <line x1="48" y1="30" x2="48" y2="62" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" />
            <line x1="32" y1="46" x2="64" y2="46" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" />
          </>
        );

      // 38. EDIT: Yellow pencil with orange tip and pink eraser
      case 'edit':
        return (
          <>
            <g transform="translate(14, 14) rotate(45 34 34)">
              <rect x="28" y="10" width="16" height="10" rx="3" fill="#F472B6" />
              <rect x="28" y="20" width="16" height="6" fill="#E2E8F0" />
              <rect x="28" y="26" width="16" height="36" fill="#FBBF24" />
              <polygon points="28,62 44,62 36,76" fill="#D97706" />
              <polygon points="33,70 39,70 36,76" fill="#1E293B" />
            </g>
          </>
        );

      // 39. TRASH: Grey-blue can with red lid
      case 'trash':
        return (
          <>
            <rect x="24" y="32" width="48" height="50" rx="8" fill="#64748B" />
            <line x1="36" y1="42" x2="36" y2="72" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
            <line x1="48" y1="42" x2="48" y2="72" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
            <line x1="60" y1="42" x2="60" y2="72" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
            {/* Red lid */}
            <rect x="18" y="24" width="60" height="10" rx="5" fill="#EF4444" />
            <rect x="38" y="18" width="20" height="8" rx="4" fill="#DC2626" />
          </>
        );

      // 40. SAVE: Plum floppy disk with white label
      case 'save':
        return (
          <>
            <rect x="18" y="16" width="60" height="64" rx="8" fill="#5F2967" />
            <rect x="28" y="18" width="40" height="26" rx="4" fill="#E2E8F0" />
            <rect x="34" y="22" width="12" height="18" rx="2" fill="#475569" />
            <rect x="24" y="52" width="48" height="24" rx="4" fill="#FFFFFF" />
            <line x1="30" y1="60" x2="64" y2="60" stroke="#CBD5E1" strokeWidth="2.5" />
            <line x1="30" y1="68" x2="56" y2="68" stroke="#CBD5E1" strokeWidth="2.5" />
          </>
        );

      // 41. DOWNLOAD: Cloud with green arrow down
      case 'download':
        return (
          <>
            <path
              d="M 28 58 C 18 58 12 50 14 40 C 16 30 26 26 32 28 C 36 18 52 14 62 22 C 72 18 84 28 82 40 C 88 46 86 58 74 58 Z"
              fill="#E0F2FE"
            />
            <path d="M 48 38 L 48 70" stroke="#22C55E" strokeWidth="8" strokeLinecap="round" />
            <polygon points="34,64 62,64 48,80" fill="#22C55E" />
          </>
        );

      // 42. UPLOAD: Cloud with plum arrow up
      case 'upload':
        return (
          <>
            <path
              d="M 28 58 C 18 58 12 50 14 40 C 16 30 26 26 32 28 C 36 18 52 14 62 22 C 72 18 84 28 82 40 C 88 46 86 58 74 58 Z"
              fill="#F3E8FF"
            />
            <path d="M 48 72 L 48 42" stroke="#5F2967" strokeWidth="8" strokeLinecap="round" />
            <polygon points="34,46 62,46 48,30" fill="#5F2967" />
          </>
        );

      // 43. EXCEL: Green spreadsheet with grid & white X
      case 'excel':
        return (
          <>
            <rect x="18" y="16" width="60" height="64" rx="8" fill="#15803D" />
            <rect x="24" y="24" width="48" height="48" rx="4" fill="#FFFFFF" />
            <line x1="24" y1="40" x2="72" y2="40" stroke="#86EFAC" strokeWidth="2" />
            <line x1="24" y1="56" x2="72" y2="56" stroke="#86EFAC" strokeWidth="2" />
            <line x1="48" y1="24" x2="48" y2="72" stroke="#86EFAC" strokeWidth="2" />
            {/* 3D Green Badge with X */}
            <circle cx="34" cy="48" r="14" fill="#16A34A" />
            <text x="34" y="55" fontSize="18" fontWeight="bold" fill="#FFFFFF" textAnchor="middle">X</text>
          </>
        );

      // 44. INSTALL / SMARTPHONE: Purple phone with green download arrow
      case 'install':
        return (
          <>
            <rect x="24" y="14" width="48" height="68" rx="10" fill="#5F2967" />
            <rect x="28" y="22" width="40" height="50" rx="4" fill="#F1F1FA" />
            <circle cx="48" cy="76" r="3" fill="#FFFFFF" />
            <path d="M 48 34 L 48 54" stroke="#22C55E" strokeWidth="5" strokeLinecap="round" />
            <polygon points="40,50 56,50 48,60" fill="#22C55E" />
          </>
        );

      // 45. SEARCH: Magnifying glass with golden rim & shiny lens
      case 'search':
        return (
          <>
            <circle cx="40" cy="40" r="22" fill="#E0F2FE" fillOpacity="0.4" stroke="#F5A623" strokeWidth="6" />
            <ellipse cx="34" cy="34" rx="6" ry="10" fill="#FFFFFF" opacity="0.6" transform="rotate(-30 34 34)" />
            <line x1="56" y1="56" x2="78" y2="78" stroke="#8A5C93" strokeWidth="9" strokeLinecap="round" />
          </>
        );

      // 46. CALENDAR: Red/plum top header, binder rings, today's date
      case 'calendar':
        return (
          <>
            <rect x="16" y="20" width="64" height="60" rx="10" fill="#FFFFFF" stroke="#ECECF4" strokeWidth="2" />
            <path d="M 16 26 C 16 22 20 20 26 20 L 70 20 C 76 20 80 22 80 26 L 80 38 L 16 38 Z" fill="#EF4444" />
            {/* Binder rings */}
            <rect x="28" y="12" width="6" height="14" rx="3" fill="#334155" />
            <rect x="62" y="12" width="6" height="14" rx="3" fill="#334155" />
            {/* Calendar number */}
            <text x="48" y="66" fontSize="26" fontWeight="900" fill="#2B2340" textAnchor="middle">24</text>
          </>
        );

      // 47. CLOCK: Colorful alarm clock
      case 'clock':
        return (
          <>
            <circle cx="48" cy="50" r="30" fill="#F1F5F9" stroke="#5F2967" strokeWidth="6" />
            {/* Alarm bells on top */}
            <circle cx="28" cy="22" r="8" fill="#F5A623" />
            <circle cx="68" cy="22" r="8" fill="#F5A623" />
            {/* Clock hands */}
            <circle cx="48" cy="50" r="4" fill="#2B2340" />
            <line x1="48" y1="50" x2="48" y2="34" stroke="#2B2340" strokeWidth="4" strokeLinecap="round" />
            <line x1="48" y1="50" x2="62" y2="50" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" />
          </>
        );

      // 48. HISTORY: Clock with counter-clockwise arrow
      case 'history':
        return (
          <>
            <circle cx="48" cy="50" r="28" fill="#EDE9FE" />
            <path
              d="M 48 22 A 28 28 0 1 1 24 38"
              fill="none"
              stroke="#5F2967"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <polygon points="16,30 26,42 32,28" fill="#5F2967" />
            <line x1="48" y1="50" x2="48" y2="36" stroke="#2B2340" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="48" y1="50" x2="60" y2="50" stroke="#2B2340" strokeWidth="3.5" strokeLinecap="round" />
          </>
        );

      // 49. BELL: Golden bell with red alert dot
      case 'bell':
        return (
          <>
            <defs>
              <linearGradient id={`${id}-bell`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FEF08A" />
                <stop offset="50%" stopColor="#FACC15" />
                <stop offset="100%" stopColor="#CA8A04" />
              </linearGradient>
            </defs>
            <path
              d="M 48 18 C 42 18 34 26 34 40 C 34 52 26 58 24 64 L 72 64 C 70 58 62 52 62 40 C 62 26 54 18 48 18 Z"
              fill={`url(#${id}-bell)`}
            />
            <circle cx="48" cy="72" r="7" fill="#CA8A04" />
            {/* Red alert dot */}
            <circle cx="68" cy="22" r="7" fill="#EF4444" stroke="#FFFFFF" strokeWidth="2" />
          </>
        );

      // 50. MENU: 3 puffy colorful pills
      case 'menu':
        return (
          <>
            <rect x="20" y="24" width="56" height="10" rx="5" fill="#FFFFFF" />
            <rect x="20" y="43" width="56" height="10" rx="5" fill="#FDE047" />
            <rect x="20" y="62" width="56" height="10" rx="5" fill="#FFFFFF" />
          </>
        );

      // 51. CLOSE / X: Puffy red circular cross
      case 'close':
        return (
          <>
            <circle cx="48" cy="48" r="32" fill="#EF4444" />
            <circle cx="48" cy="44" r="32" fill="#F87171" />
            <line x1="34" y1="30" x2="62" y2="58" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" />
            <line x1="62" y1="30" x2="34" y2="58" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" />
          </>
        );

      // 52. CHEVRON_DOWN
      case 'chevron_down':
        return (
          <>
            <circle cx="48" cy="48" r="30" fill="#F1F1FA" />
            <path d="M 32 40 L 48 56 L 64 40" stroke="#5F2967" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </>
        );

      // 53. CHEVRON_UP
      case 'chevron_up':
        return (
          <>
            <circle cx="48" cy="48" r="30" fill="#F1F1FA" />
            <path d="M 32 56 L 48 40 L 64 56" stroke="#5F2967" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </>
        );

      // 54. CHEVRON_LEFT
      case 'chevron_left':
        return (
          <>
            <circle cx="48" cy="48" r="28" fill="#F1F1FA" />
            <path d="M 54 32 L 38 48 L 54 64" stroke="#5F2967" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </>
        );

      // 55. BACK (Right arrow for RTL back)
      case 'back':
        return (
          <>
            <circle cx="48" cy="48" r="30" fill="#FFFFFF" stroke="#ECECF4" strokeWidth="2" />
            <path d="M 40 32 L 56 48 L 40 64" stroke="#5F2967" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <line x1="56" y1="48" x2="28" y2="48" stroke="#5F2967" strokeWidth="6" strokeLinecap="round" />
          </>
        );

      // 56. APP_LOGO: 3D Bag & Sneaker Shoe Emblem
      case 'app_logo':
        return (
          <>
            <defs>
              <linearGradient id={`${id}-bg-bag`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFC857" />
                <stop offset="50%" stopColor="#F5A623" />
                <stop offset="100%" stopColor="#E8891A" />
              </linearGradient>
              <linearGradient id={`${id}-bg-shoe`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="60%" stopColor="#F8FAFC" />
                <stop offset="100%" stopColor="#E9E3F1" />
              </linearGradient>
              <linearGradient id={`${id}-bg-sole`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="60%" stopColor="#F5A623" />
                <stop offset="100%" stopColor="#D97706" />
              </linearGradient>
            </defs>
            {/* Ground shadow */}
            <ellipse cx="50" cy="78" rx="34" ry="6" fill="#1A0720" opacity="0.35" />
            {/* 3D Bag (Back-right) */}
            <g transform="translate(38, 22) scale(0.6)">
              <path d="M 28 20 C 28 0 54 0 54 20" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" fill="none" />
              <circle cx="28" cy="20" r="3.5" fill="#FDE047" />
              <circle cx="54" cy="20" r="3.5" fill="#FDE047" />
              <rect x="16" y="20" width="50" height="52" rx="12" fill={`url(#${id}-bg-bag)`} />
              <path d="M 20 22 C 26 20 54 20 62 22" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
              <rect x="25" y="38" width="32" height="24" rx="5" fill="#E8891A" opacity="0.4" />
            </g>
            {/* 3D Sneaker Shoe (Front-left, overlapping) */}
            <g transform="translate(14, 40) scale(0.68)">
              <ellipse cx="36" cy="46" rx="28" ry="4" fill="#1A0720" opacity="0.25" />
              {/* Upper */}
              <path
                d="M 6 30 C 4 20 8 10 16 8 C 22 6 28 12 34 16 L 46 14 C 50 12 56 16 58 22 L 64 30 C 70 32 78 36 82 40 C 84 44 82 48 76 49 L 10 49 C 6 49 5 38 6 30 Z"
                fill={`url(#${id}-bg-shoe)`}
              />
              {/* Emerald Heel Accent */}
              <path d="M 6 30 C 5 22 8 14 16 9 C 18 16 20 32 18 45 L 8 45 C 6 40 6 34 6 30 Z" fill="#2FA36B" />
              {/* Emerald Swoosh */}
              <path d="M 24 30 C 35 24 48 26 60 35 C 50 36 36 34 24 30 Z" fill="#2FA36B" />
              {/* Laces */}
              <rect x="36" y="18" width="10" height="2.5" rx="1.2" fill="#FFFFFF" transform="rotate(-15 36 18)" />
              <rect x="42" y="24" width="11" height="2.5" rx="1.2" fill="#FFFFFF" transform="rotate(-10 42 24)" />
              {/* Toe highlight */}
              <ellipse cx="74" cy="40" rx="6" ry="2.5" fill="#FFFFFF" opacity="0.8" />
              {/* Platform Sole */}
              <rect x="4" y="48" width="80" height="9" rx="4.5" fill={`url(#${id}-bg-sole)`} />
              <rect x="6" y="51" width="76" height="1.5" fill="#4A1E52" opacity="0.7" />
            </g>
          </>
        );

      // 57. VERIFIED: Orange circular verified checkmark badge matching reference
      case 'verified':
        return (
          <>
            <circle cx="48" cy="48" r="36" fill="#F5A623" />
            <circle cx="48" cy="45" r="32" fill="#FBBF24" />
            <path d="M 34 46 L 44 56 L 62 36" stroke="#FFFFFF" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </>
        );

      // 58. GRID: 3D 4-tile grid button
      case 'grid':
        return (
          <>
            <rect x="18" y="22" width="26" height="24" rx="8" fill="#5F2967" />
            <rect x="18" y="18" width="26" height="24" rx="8" fill="#8A5C93" />
            <rect x="52" y="22" width="26" height="24" rx="8" fill="#5F2967" />
            <rect x="52" y="18" width="26" height="24" rx="8" fill="#8A5C93" />
            <rect x="18" y="56" width="26" height="24" rx="8" fill="#5F2967" />
            <rect x="18" y="52" width="26" height="24" rx="8" fill="#8A5C93" />
            <rect x="52" y="56" width="26" height="24" rx="8" fill="#5F2967" />
            <rect x="52" y="52" width="26" height="24" rx="8" fill="#8A5C93" />
          </>
        );

      // 59. CUSTOMERS: 3D friendly avatar with badge
      case 'customers':
        return (
          <>
            <circle cx="48" cy="34" r="18" fill="#5F2967" />
            <circle cx="48" cy="32" r="16" fill="#8A5C93" />
            <ellipse cx="48" cy="74" rx="28" ry="16" fill="#5F2967" />
            <ellipse cx="48" cy="71" rx="28" ry="14" fill="#8A5C93" />
            <circle cx="68" cy="68" r="10" fill="#2FA36B" />
            <path d="M 64 68 L 67 71 L 72 65" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </>
        );

      default:
        // Generic fallback 3D sphere
        return (
          <>
            <circle cx="48" cy="48" r="34" fill="#5F2967" />
            <circle cx="40" cy="40" r="10" fill="#FFFFFF" opacity="0.4" />
          </>
        );
    }
  };

  return (
    <svg
      viewBox="0 0 96 96"
      width={size}
      height={size}
      className={`inline-block shrink-0 select-none ${className}`}
      aria-hidden={!title}
      role={title ? 'img' : 'presentation'}
    >
      {title && <title>{title}</title>}
      {renderIconContent()}
    </svg>
  );
};
