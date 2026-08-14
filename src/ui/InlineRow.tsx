export function InlineRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-cond-regular text-[14px] text-[#454a55] uppercase flex-1">{label}</span>
      {children}
    </div>
  );
}
