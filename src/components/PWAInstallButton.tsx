/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Icon3D } from './icons3d/Icon3D';
import { usePWAInstall } from './usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isOnline, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);

  return (
    <div className="flex items-center gap-2">
      {/* Offline status indicator */}
      {!isOnline && (
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[11px] font-bold animate-pulse"
          title="التطبيق يعمل في وضع عدم الاتصال بالإنترنت بكامل وظائفه"
        >
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          <span>بدون إنترنت</span>
        </div>
      )}

      {/* When not installed, show install triggers */}
      {!isInstalled && (
        <>
          {isInstallable ? (
            <button
              onClick={install}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#5F2967] hover:bg-[#4A1E52] text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
              title="تثبيت التطبيق على الموبايل"
            >
              <Icon3D name="download" size={16} />
              <span>تثبيت التطبيق</span>
            </button>
          ) : isAndroid ? (
            <button
              onClick={() => setShowAndroidGuide(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#231A2C] border border-[#ECECF4] dark:border-[#32263F] text-[#2B2340] dark:text-[#F2EEF7] text-xs font-bold transition hover:bg-slate-50 dark:hover:bg-[#2d2238] cursor-pointer"
              title="طريقة تثبيت التطبيق على أندرويد"
            >
              <Icon3D name="install" size={16} />
              <span>تثبيت أندرويد</span>
            </button>
          ) : isIOS ? (
            <button
              onClick={() => setShowIOSGuide(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#231A2C] border border-[#ECECF4] dark:border-[#32263F] text-[#2B2340] dark:text-[#F2EEF7] text-xs font-bold transition hover:bg-slate-50 dark:hover:bg-[#2d2238] cursor-pointer"
              title="طريقة تثبيت التطبيق على آيفون"
            >
              <Icon3D name="install" size={16} />
              <span>تثبيت آيفون</span>
            </button>
          ) : null}
        </>
      )}

      {/* Android Chrome Fallback Modal */}
      {showAndroidGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#231A2C] p-6 shadow-2xl border border-[#ECECF4] dark:border-[#32263F] text-right">
            <div className="flex items-center justify-between pb-3 border-b border-[#ECECF4] dark:border-[#32263F]">
              <h3 className="font-extrabold text-[#2B2340] dark:text-white flex items-center gap-2">
                <Icon3D name="install" size={24} />
                تثبيت على أندرويد (Chrome)
              </h3>
              <button
                onClick={() => setShowAndroidGuide(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <Icon3D name="close" size={20} />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-[#2B2340] dark:text-[#F2EEF7] leading-relaxed">
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#5F2967]/15 text-[#5F2967] dark:text-[#9B67A4] font-black flex items-center justify-center text-xs">
                  1
                </span>
                <p>اضغط على قائمة الثلاث نقاط (⋮) في أعلى زاوية المتصفح.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#5F2967]/15 text-[#5F2967] dark:text-[#9B67A4] font-black flex items-center justify-center text-xs">
                  2
                </span>
                <p>اختر «تثبيت التطبيق» (Install app) أو «إضافة إلى الشاشة الرئيسية» (Add to Home screen).</p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#5F2967]/15 text-[#5F2967] dark:text-[#9B67A4] font-black flex items-center justify-center text-xs">
                  3
                </span>
                <p>أكد بالضغط على «تثبيت»، وسيظهر التطبيق كأيقونة مستقلة على شاشتك تعمل بالكامل بدون إنترنت!</p>
              </div>
            </div>
            <button
              onClick={() => setShowAndroidGuide(false)}
              className="mt-6 w-full py-2.5 rounded-xl bg-[#5F2967] text-white font-bold text-sm hover:bg-[#4A1E52] transition cursor-pointer"
            >
              فهمت، شكراً
            </button>
          </div>
        </div>
      )}

      {/* iOS Safari Fallback Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#231A2C] p-6 shadow-2xl border border-[#ECECF4] dark:border-[#32263F] text-right">
            <div className="flex items-center justify-between pb-3 border-b border-[#ECECF4] dark:border-[#32263F]">
              <h3 className="font-extrabold text-[#2B2340] dark:text-white flex items-center gap-2">
                <Icon3D name="install" size={24} />
                تثبيت على الآيفون (iOS)
              </h3>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <Icon3D name="close" size={20} />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-[#2B2340] dark:text-[#F2EEF7] leading-relaxed">
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#5F2967]/15 text-[#5F2967] dark:text-[#9B67A4] font-black flex items-center justify-center text-xs">
                  1
                </span>
                <p>اضغط على زر المشاركة (Share ⎘) أسفل متصفح Safari.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#5F2967]/15 text-[#5F2967] dark:text-[#9B67A4] font-black flex items-center justify-center text-xs">
                  2
                </span>
                <p>انزل للأسفل واضغط على «إضافة إلى الشاشة الرئيسية» (Add to Home Screen).</p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#5F2967]/15 text-[#5F2967] dark:text-[#9B67A4] font-black flex items-center justify-center text-xs">
                  3
                </span>
                <p>اضغط «إضافة» (Add) في الزاوية العلوية وسيفتح التطبيق بدون متصفح وبدون نت!</p>
              </div>
            </div>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-6 w-full py-2.5 rounded-xl bg-[#5F2967] text-white font-bold text-sm hover:bg-[#4A1E52] transition cursor-pointer"
            >
              فهمت، شكراً
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
