'use client';

import { useEffect, useState } from 'react';
import { useTranslationStore } from '@/stores/i18nStore';

interface RiskGaugeProps {
    score: number;
    size?: number;
    label?: string;
    showLabel?: boolean;
    animated?: boolean;
    className?: string;
}

const RISK_ZONES = [
    { min: 0, max: 49, color: '#22c55e', labelKey: 'dashboard.low', glow: 'rgba(34,197,94,0.3)' },
    { min: 50, max: 74, color: '#eab308', labelKey: 'dashboard.medium', glow: 'rgba(234,179,8,0.3)' },
    { min: 75, max: 89, color: '#f97316', labelKey: 'dashboard.high', glow: 'rgba(249,115,22,0.3)' },
    { min: 90, max: 100, color: '#ef4444', labelKey: 'dashboard.critical', glow: 'rgba(239,68,68,0.4)' },
];

function getZone(score: number) {
    return RISK_ZONES.find(z => score >= z.min && score <= z.max) || RISK_ZONES[0];
}

export default function RiskGauge({
    score,
    size = 180,
    label,
    showLabel = true,
    animated = true,
    className = '',
}: RiskGaugeProps) {
    const { t } = useTranslationStore();
    const [displayScore, setDisplayScore] = useState(animated ? 0 : score);
    const zone = getZone(score);

    // Animate score counting up
    useEffect(() => {
        if (!animated) {
            setDisplayScore(score);
            return;
        }
        let start = 0;
        const duration = 1200;
        const stepTime = 16;
        const steps = duration / stepTime;
        const increment = score / steps;
        const timer = setInterval(() => {
            start += increment;
            if (start >= score) {
                setDisplayScore(score);
                clearInterval(timer);
            } else {
                setDisplayScore(Math.round(start));
            }
        }, stepTime);
        return () => clearInterval(timer);
    }, [score, animated]);

    // SVG arc calculations
    const cx = size / 2;
    const cy = size / 2;
    const radius = (size / 2) - 16;
    const strokeWidth = 10;
    const startAngle = 135;
    const endAngle = 405;
    const totalArc = endAngle - startAngle; // 270 degrees
    const scoreAngle = startAngle + (displayScore / 100) * totalArc;

    function polarToCartesian(angle: number) {
        const rad = ((angle - 90) * Math.PI) / 180;
        return {
            x: cx + radius * Math.cos(rad),
            y: cy + radius * Math.sin(rad),
        };
    }

    function describeArc(start: number, end: number) {
        const s = polarToCartesian(start);
        const e = polarToCartesian(end);
        const largeArc = end - start > 180 ? 1 : 0;
        return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${largeArc} 1 ${e.x} ${e.y}`;
    }

    const bgArc = describeArc(startAngle, endAngle);
    const valueArc = displayScore > 0 ? describeArc(startAngle, scoreAngle) : '';

    return (
        <div className={`relative inline-flex flex-col items-center ${className}`}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {/* Glow filter */}
                <defs>
                    <filter id={`glow-${score}`} x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Background arc */}
                <path
                    d={bgArc}
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                />

                {/* Tick marks */}
                {[0, 25, 50, 75, 100].map((tick) => {
                    const angle = startAngle + (tick / 100) * totalArc;
                    const outer = polarToCartesian(angle);
                    const innerRadius = radius - 14;
                    const rad = ((angle - 90) * Math.PI) / 180;
                    const inner = {
                        x: cx + innerRadius * Math.cos(rad),
                        y: cy + innerRadius * Math.sin(rad),
                    };
                    return (
                        <g key={tick}>
                            <line
                                x1={inner.x} y1={inner.y}
                                x2={outer.x} y2={outer.y}
                                stroke="#475569"
                                strokeWidth={1.5}
                            />
                            <text
                                x={inner.x}
                                y={inner.y}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fill="#64748b"
                                fontSize={size * 0.06}
                                dy={tick === 0 ? 12 : tick === 100 ? 12 : -8}
                            >
                                {tick}
                            </text>
                        </g>
                    );
                })}

                {/* Value arc */}
                {valueArc && (
                    <path
                        d={valueArc}
                        fill="none"
                        stroke={zone.color}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        filter={`url(#glow-${score})`}
                        style={{
                            transition: animated ? 'none' : 'stroke-dashoffset 0.6s ease',
                        }}
                    />
                )}

                {/* Center score */}
                <text
                    x={cx}
                    y={cy - 6}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={zone.color}
                    fontSize={size * 0.22}
                    fontWeight="bold"
                    fontFamily="Inter, system-ui, sans-serif"
                >
                    {displayScore}
                </text>

                {/* Label under score */}
                <text
                    x={cx}
                    y={cy + size * 0.12}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="font-bold text-slate-900 dark:text-white"
                    fill="currentColor"
                    fontSize={size * 0.07}
                    fontFamily="Inter, system-ui, sans-serif"
                >
                    {t('dashboard.score') || 'RISK SCORE'}
                </text>
            </svg>

            {/* Severity label below gauge */}
            {showLabel && (
                <span
                    className="mt-1 px-3 py-1 rounded-full text-xs font-bold tracking-wider"
                    style={{
                        color: zone.color,
                        backgroundColor: zone.glow,
                        boxShadow: `0 0 12px ${zone.glow}`,
                    }}
                >
                    {label || t(zone.labelKey)}
                </span>
            )}
        </div>
    );
}

export { RiskGauge, RISK_ZONES, getZone };
