import React from 'react';
import { Check } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

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
  const { isDark, getNoteCardColor } = useTheme();
  const normalizedCurrent = (currentColor || '#ffffff').toLowerCase();

  return (
    <div className="flex flex-row flex-nowrap items-center gap-2 px-3 py-2 bg-white dark:bg-stone-900 rounded-2xl shadow-xl border border-stone-200 dark:border-stone-700/80 z-50 overflow-x-auto whitespace-nowrap custom-scrollbar max-w-[92vw] sm:max-w-none">
      {KEEP_COLORS.map((c) => {
        const isSelected = normalizedCurrent === c.hex.toLowerCase();
        const swatchBg = getNoteCardColor(c.hex, isDark);

        return (
          <button
            key={c.hex}
            type="button"
            title={c.name}
            aria-label={c.name}
            aria-pressed={isSelected}
            onClick={(e) => {
              e.stopPropagation();
              onSelectColor(c.hex);
            }}
            className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center transition-colors ${
              isSelected
                ? 'ring-2 ring-stone-900 dark:ring-stone-100 ring-offset-2 ring-offset-white dark:ring-offset-stone-900 border border-transparent'
                : 'border border-stone-300 dark:border-stone-600 hover:border-stone-500 dark:hover:border-stone-400'
            }`}
            style={{ backgroundColor: swatchBg }}
          >
            {isSelected && (
              <Check
                className={`w-3.5 h-3.5 stroke-[2.5] ${
                  isDark ? 'text-stone-100' : 'text-stone-800'
                }`}
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
};
