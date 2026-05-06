"use client";

import React, { useMemo } from "react";

export interface CastsSliderProps {
    min: number;
    max: number;
    value: number;
    onChange: (value: number) => void;
    disabled: boolean;
    themeColorBackground: string;
    label: string;
    hint?: React.ReactNode;
}

/**
 * Integer range control with the same track + invisible native range pattern as
 * {@link BetAmountInput} (bet slider).
 */
const CastsSlider: React.FC<CastsSliderProps> = ({
    min,
    max,
    value,
    onChange,
    disabled,
    themeColorBackground,
    label,
    hint,
}) => {
    const clamped = Math.min(max, Math.max(min, Math.round(Number(value)) || min));

    const getWidthPercentage = useMemo(() => {
        if (disabled || max <= min) {
            return 0;
        }
        return ((clamped - min) / (max - min)) * 100;
    }, [clamped, min, max, disabled]);

    const handleChange = (n: number) => {
        if (disabled) {
            return;
        }
        const v = Math.round(n);
        onChange(Math.min(max, Math.max(min, v)));
    };

    return (
        <div
            className="mt-5 w-full space-y-2"
            style={
                { "--theme-color": themeColorBackground } as React.CSSProperties
            }
        >
            <div className="flex items-center justify-between gap-2 text-sm font-medium text-gray-400">
                <p>{label}</p>
                <p className="font-semibold tabular-nums text-gray-300">
                    {disabled ? "—" : clamped}
                </p>
            </div>

            <div className="relative h-8 overflow-hidden rounded-[5px] border border-(--theme-color)/30 bg-gray-900/70">
                <div className="absolute inset-0 flex items-center px-2">
                    <div className="h-3 w-full rounded-[4px] bg-gray-800" />
                </div>
                <div
                    className="absolute inset-y-0 left-2 flex items-center"
                    style={{
                        width: `calc((${getWidthPercentage}/100) * (100% - 1.5rem))`,
                        transition: "width 0.2s ease-out",
                    }}
                >
                    <div className="h-3 w-full bg-(--theme-color)/70" />
                </div>
                <div
                    className="absolute bottom-0 top-0 flex items-center"
                    style={{
                        left: `calc(0.75rem + ((${getWidthPercentage}/100) * (100% - 1.5rem)) - 8px)`,
                        transition: "left 0.2s ease-out",
                    }}
                >
                    <div className="h-5 w-4 cursor-pointer rounded-[6px] border-2 border-(--theme-color) bg-white shadow-[0_0_8px_var(--theme-color)]" />
                </div>
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={1}
                    value={clamped}
                    onChange={(e) => handleChange(Number(e.target.value))}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    disabled={disabled}
                    aria-label={label}
                />
            </div>

            {hint ? (
                <div className="text-xs text-[#91989C]">{hint}</div>
            ) : null}
        </div>
    );
};

export default CastsSlider;
