import React, { useState } from 'react';
import { Download, Share2, PlusSquare, CheckCircle2, Tablet, WifiOff } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Modal } from './Modal';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);

  if (isInstalled) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap shrink-0">
        <CheckCircle2 className="w-4 h-4" />
        Offline Ready
      </span>
    );
  }

  return (
    <>
      {isInstallable ? (
        <button
          type="button"
          onClick={install}
          className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors whitespace-nowrap shrink-0"
          title="Install app for offline standalone use"
        >
          <Download className="w-3.5 h-3.5 text-emerald-600" />
          Install App
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors whitespace-nowrap shrink-0"
          title="How to install on iPad, iPhone, or Desktop for offline use"
        >
          <Tablet className="w-3.5 h-3.5 text-emerald-600" />
          <span className="hidden xl:inline">Offline Setup</span>
        </button>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={isIOS ? 'Install on iPad / iPhone' : 'Install Standalone App'}
        subtitle="100% offline capable · No internet required after setup"
        icon={
          <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
            <Tablet className="w-5 h-5" />
          </div>
        }
      >
        <div className="space-y-4 text-sm text-slate-700">
          <div className="flex items-start gap-3 p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
            <WifiOff className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-950 leading-relaxed">
              <strong>Works completely offline.</strong> Once added to your Home Screen, all calculations, charts, and saved plans run locally on your device—even in Airplane Mode.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-900">
              How to install on iPad or iPhone (Safari):
            </p>
            <ol className="space-y-2 text-xs text-slate-600 list-decimal pl-4 leading-relaxed">
              <li>
                Open this planner in <strong>Safari</strong>.
              </li>
              <li className="flex items-center gap-1.5 flex-wrap">
                Tap the <strong>Share</strong> icon <Share2 className="w-3.5 h-3.5 text-slate-700 inline" /> in Safari&apos;s toolbar.
              </li>
              <li className="flex items-center gap-1.5 flex-wrap">
                Choose <strong>Add to Home Screen</strong> <PlusSquare className="w-3.5 h-3.5 text-slate-700 inline" />.
              </li>
              <li>
                Tap <strong>Add</strong> in the top-right corner.
              </li>
            </ol>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800">Local Desktop / Home Network Option</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              You can also run <code className="font-mono text-slate-700">node serve.cjs</code> from the standalone folder on your Mac/PC and open it over local Wi-Fi without external internet access.
            </p>
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="w-full min-h-[42px] rounded-lg bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
