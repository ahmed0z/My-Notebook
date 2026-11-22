import React from 'react';

export const KEEP_COLORS: { name: string; hex: string }[] = [
  { name: 'Default', hex: '#ffffff' },
  { name: 'Coral', hex: '#faafa8' },
  { name: 'Peach', hex: '#f39f76' },
  { name: 'Sand', hex: '#fff8b8' },
  { name: 'Mint', hex: '#e2f6d3' },
  { name: 'Sage', hex: '#b4ddd3' },
  { name: 'Fog', hex: '#d4e4ed' },
  { name: 'Storm', hex: '#aeccdc' },
  { name: 'Dusk', hex: '#d3bfdb' },
  { name: 'Blossom', hex: '#f6e2dd' },
  { name: 'Clay', hex: '#e9e3d4' },
  { name: 'Chalk', hex: '#efeff1' },
];

interface ColorPickerProps {
  currentColor: string;
  onSelectColor: (hex: string) => void;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({ currentColor, onSelectColor }) => {
  return (
    <div className="flex flex-row flex-nowrap items-center gap-1.5 px-2.5 py-1.5 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-full shadow-xl border border-stone-200/80 dark:border-stone-800 z-50 overflow-x-auto whitespace-nowrap custom-scrollbar max-w-[92vw] sm:max-w-none">
      {KEEP_COLORS.map(c => (
        <button
          key={c.hex}
          type="button"
          title={c.name}
          aria-label={c.name}
          aria-pressed={currentColor.toLowerCase() === c.hex.toLowerCase()}
          onClick={(e) => {
            e.stopPropagation();
            onSelectColor(c.hex);
          }}
          className={`w-6 h-6 shrink-0 rounded-full border transition-transform hover:scale-115 ${
            currentColor.toLowerCase() === c.hex.toLowerCase()
              ? 'ring-2 ring-stone-900 dark:ring-stone-100 border-white dark:border-stone-900 scale-110 shadow-sm'
              : 'border-stone-300/80 dark:border-stone-700/80 hover:border-stone-500'
          }`}
          style={{ backgroundColor: c.hex }}
        />
      ))}
    </div>
  );
};
