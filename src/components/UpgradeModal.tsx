import { Crown } from "lucide-react";

/** Free-tier limit reached → modal with an Upgrade-to-Pro CTA. */
export default function UpgradeModal({ title, message, onClose }: { title: string; message: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/30" onClick={onClose}>
      <div className="w-full max-w-sm bg-white rounded-xl border-[0.5px] border-black/10 p-5 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-12 rounded-xl bg-[#D97706]/10 flex items-center justify-center mx-auto">
          <Crown size={22} className="text-[#D97706]" />
        </div>
        <h3 className="mt-3 text-[15px] font-medium text-navy">{title}</h3>
        <p className="mt-1 text-[13px] text-slate-500">{message}</p>
        <div className="mt-4 flex justify-center gap-2">
          <button onClick={onClose} className="h-9 px-3 rounded-lg border-[0.5px] border-black/15 text-[12px] text-slate-600 hover:bg-surface">Not now</button>
          <button onClick={onClose} className="h-9 px-4 rounded-lg bg-navy text-white text-[12px] font-medium hover:bg-navy/90">Upgrade to Pro</button>
        </div>
      </div>
    </div>
  );
}
