import React, { useState } from 'react';
import { Palette, Eye, Smile, Frown, Meh, Laugh, Angry } from 'lucide-react';

interface ExpressionControl {
  name: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  intensity: number;
}

interface ExpressionControlPanelProps {
  currentExpression: string;
  onExpressionChange: (expression: string, intensity: number) => void;
}

export default function ExpressionControlPanel({ currentExpression, onExpressionChange }: ExpressionControlPanelProps) {
  const [intensity, setIntensity] = useState(0.8);

  const expressions: ExpressionControl[] = [
    { name: 'neutral', label: 'Neutral', icon: <Meh size={20} />, color: 'text-gray-400', intensity: 0.5 },
    { name: 'smile', label: 'Smile', icon: <Smile size={20} />, color: 'text-green-400', intensity: 0.7 },
    { name: 'laugh', label: 'Laugh', icon: <Laugh size={20} />, color: 'text-yellow-400', intensity: 1.0 },
    { name: 'surprise', label: 'Surprise', icon: <Smile size={20} />, color: 'text-orange-400', intensity: 0.8 },
    { name: 'sad', label: 'Sad', icon: <Frown size={20} />, color: 'text-blue-400', intensity: 0.6 },
    { name: 'angry', label: 'Angry', icon: <Angry size={20} />, color: 'text-red-400', intensity: 0.9 },
    { name: 'blink', label: 'Blink', icon: <Eye size={20} />, color: 'text-purple-400', intensity: 0.4 },
  ];

  const handleExpressionClick = (expressionName: string, defaultIntensity: number) => {
    onExpressionChange(expressionName, intensity);
  };

  const handleIntensityChange = (newIntensity: number) => {
    setIntensity(newIntensity);
    if (currentExpression) {
      onExpressionChange(currentExpression, newIntensity);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <h3 className="text-lg font-medium text-white">Face Control</h3>
        <div className="flex items-center space-x-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
          <Palette size={14} className="text-white/60" />
          <span className="text-xs text-white/80 font-mono uppercase">{currentExpression || 'Neutral'}</span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3">
        {expressions.map((expression) => (
          <button
            key={expression.name}
            onClick={() => handleExpressionClick(expression.name, expression.intensity)}
            className={`flex items-center space-x-3 p-3 rounded-xl border transition-all duration-200 group text-left ${
              currentExpression === expression.name
                ? 'border-blue-500/50 bg-blue-500/10 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                : 'border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10'
            }`}
          >
            <div className={`p-2 rounded-lg bg-black/20 ${expression.color}`}>
              {expression.icon}
            </div>
            <div>
              <div className="font-medium text-gray-200 text-sm">{expression.label}</div>
              <div className="text-[10px] text-white/40">
                Int: {Math.round(expression.intensity * 100)}%
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Intensity Slider */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">Intensity</label>
          <span className="text-xs font-mono text-blue-400">{Math.round(intensity * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={intensity}
          onChange={(e) => handleIntensityChange(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>

      {/* Advanced Triggers */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Micro-Expressions</h4>
        <div className="grid grid-cols-2 gap-2">
          {['Eyebrow Raise', 'Quick Blink', 'Mouth Open', 'Nod'].map((action, i) => {
             const keys = ['eyebrow_raise', 'eye_blink', 'mouth_open', 'head_nod'];
             return (
              <button
                key={action}
                onClick={() => onExpressionChange(keys[i], intensity)}
                className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/5 rounded-lg text-xs transition-colors"
              >
                {action}
              </button>
             )
          })}
        </div>
      </div>

      <div className="pt-4 border-t border-white/10">
        <button
          onClick={() => {
            onExpressionChange('neutral', 0.5);
            setIntensity(0.5);
          }}
          className="w-full px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-lg transition-colors text-sm"
        >
          Reset Expression
        </button>
      </div>
    </div>
  );
}
