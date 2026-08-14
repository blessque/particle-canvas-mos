export function Switcher<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  function radius(i: number) {
    const last = options.length - 1;
    if (options.length === 1) return 'rounded-[8px]';
    if (i === 0) return 'rounded-tl-[8px] rounded-bl-[8px] rounded-tr-[2px] rounded-br-[2px]';
    if (i === last) return 'rounded-tr-[8px] rounded-br-[8px] rounded-tl-[2px] rounded-bl-[2px]';
    return 'rounded-[2px]';
  }

  return (
    <div className="flex gap-[2px]">
      {options.map((opt, i) => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className={[
            'font-cond-regular text-[14px] leading-none p-[6px] flex-1 transition-colors',
            radius(i),
            value === opt.value
              ? 'bg-[#33373f] text-white'
              : 'bg-[#202226] text-[#777e8c] hover:bg-[#2a2e35] hover:text-[#9ca3b1]',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
