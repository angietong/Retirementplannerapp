import React, { useState } from 'react';
import { Download, Share2, PlusSquare, CheckCircle2, X, Tablet, WifiOff } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);

  // If already installed and running standalone, show subtle badge or hide
  if (isInstalled) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full border border-emerald-200">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Installed / Offline Ready
      </span>
    );
  }

  return (
    <>
      {/* Button for Chromium / Android install prompt */}
      {isInstallable ? (
        <button
          onClick={install}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
          title="Install app for offline standalone use"
        >
          <Download className="w-3.5 h-3.5" />
          Install App (Offline Ready)
        </button>
      ) : (
        /* iOS / iPadOS or generic install instructions button */
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 shadow-sm transition-colors"
          title="How to install on iPad / iPhone / Desktop for offline use"
        >
          <Tablet className="w-3.5 h-3.5 text-emerald-600" />
          Install on iPad / Offline
        </button>
      )}

      {/* Guided Modal for iPad / iPhone / Offline Setup */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 text-slate-900">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <Tablet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {isIOS ? 'Install on iPad / iPhone' : 'Install Standalone App'}
                  </h3>
                  <p className="text-xs text-slate-500">100% Offline Capable • No Internet Required</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-sm text-slate-700">
              <div className="flex items-start gap-3 p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                <WifiOff className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-900 leading-relaxed">
                  <strong>Does it work without internet? Yes!</strong> Once added to your Home Screen, all calculation logic, charts, and data persistence run entirely locally inside your iPad. You can launch and use it anytime in <em>Airplane Mode</em>.
                </p>
              </div>

              <div className="space-y-2.5 pt-1">
                <p className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  How to install on iPad (Safari):
                </p>
                <ol className="space-y-2 text-xs text-slate-600 list-decimal pl-4 leading-relaxed">
                  <li>
                    Open this app in <strong>Safari</strong> on your iPad.
                  </li>
                  <li className="flex items-center gap-1.5 flex-wrap">
                    Tap the <strong>Share</strong> button <Share2 className="w-3.5 h-3.5 text-blue-600 inline" /> in Safari's top navigation bar.
                  </li>
                  <li className="flex items-center gap-1.5 flex-wrap">
                    Scroll down and tap <strong>Add to Home Screen</strong> <PlusSquare className="w-3.5 h-3.5 text-slate-700 inline" />.
                  </li>
                  <li>
                    Tap <strong>Add</strong> in the top-right corner.
                  </li>
                </ol>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600 space-y-1">
                <p className="font-medium text-slate-800">Alternative: Completely Local / Standalone Folder</p>
                <p className="text-[11px] text-slate-500">
                  You can also download the project's <code>standalone/</code> folder or run <code>node serve.cjs</code> on your local Mac/PC or local home server, and open it on your iPad via local Wi-Fi without any external internet connection.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <button
                onClick={() => setShowModal(false)}
                className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
