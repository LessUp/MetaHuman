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
  const [customColor, setCustomColor] = useState('#4f46e5');

  const expressions: ExpressionControl[] = [
    { name: 'neutral', label: '中性', icon: <Meh size={20} />, color: 'bg-gray-500', intensity: 0.5 },
    { name: 'smile', label: '微笑', icon: <Smile size={20} />, color: 'bg-green-500', intensity: 0.7 },
    { name: 'laugh', label: '大笑', icon: <Laugh size={20} />, color: 'bg-yellow-500', intensity: 1.0 },
    { name: 'surprise', label: '惊讶', icon: <Smile size={20} />, color: 'bg-orange-500', intensity: 0.8 },
    { name: 'sad', label: '悲伤', icon: <Frown size={20} />, color: 'bg-blue-500', intensity: 0.6 },
    { name: 'angry', label: '愤怒', icon: <Angry size={20} />, color: 'bg-red-500', intensity: 0.9 },
    { name: 'blink', label: '眨眼', icon: <Eye size={20} />, color: 'bg-purple-500', intensity: 0.4 },
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

  const handleCustomColorChange = (color: string) => {
    setCustomColor(color);
    // 可以在这里添加颜色相关的表情变化
  };

  return (
    <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-lg p-6 space-y-6 border border-white/20">
      <div className="flex items-center justify-between border-b border-gray-200/50 pb-4">
        <h3 className="text-lg font-semibold text-gray-800">面部表情控制</h3>
        <div className="flex items-center space-x-2 px-3 py-1 bg-gray-100/50 rounded-full">
          <Palette size={16} className="text-gray-500" />
          <span className="text-xs text-gray-500 font-medium">当前: {currentExpression}</span>
        </div>
      </div>

      {/* 表情选择网格 */}
      <div className="grid grid-cols-2 gap-3">
        {expressions.map((expression) => (
          <button
            key={expression.name}
            onClick={() => handleExpressionClick(expression.name, expression.intensity)}
            className={`flex items-center space-x-3 p-3 rounded-xl border transition-all duration-200 group ${
              currentExpression === expression.name
                ? 'border-blue-500/50 bg-blue-50/80 shadow-blue-100 shadow-md'
                : 'border-gray-200/60 bg-white/50 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5'
            }`}
          >
            <div className={`p-2 rounded-full ${expression.color} text-white shadow-sm group-hover:scale-110 transition-transform`}>
              {expression.icon}
            </div>
            <div className="text-left">
              <div className="font-medium text-gray-800 text-sm">{expression.label}</div>
              <div className="text-[10px] text-gray-500">
                强度: {Math.round(expression.intensity * 100)}%
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* 强度控制 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">表情强度</label>
          <span className="text-sm text-gray-600">{Math.round(intensity * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={intensity}
          onChange={(e) => handleIntensityChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>轻微</span>
          <span>中等</span>
          <span>强烈</span>
        </div>
      </div>

      {/* 自定义颜色 */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-gray-700">自定义颜色</label>
        <div className="flex items-center space-x-3">
          <input
            type="color"
            value={customColor}
            onChange={(e) => handleCustomColorChange(e.target.value)}
            className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
          />
          <div className="flex-1">
            <input
              type="text"
              value={customColor}
              onChange={(e) => handleCustomColorChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="#4f46e5"
            />
          </div>
        </div>
      </div>

      {/* 高级控制 */}
      <div className="space-y-4">
        <h4 className="text-md font-medium text-gray-700">高级控制</h4>
        
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onExpressionChange('eyebrow_raise', intensity)}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors"
          >
            抬眉
          </button>
          <button
            onClick={() => onExpressionChange('eye_blink', intensity)}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors"
          >
            眨眼
          </button>
          <button
            onClick={() => onExpressionChange('mouth_open', intensity)}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors"
          >
            张嘴
          </button>
          <button
            onClick={() => onExpressionChange('head_nod', intensity)}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors"
          >
            点头
          </button>
        </div>
      </div>

      {/* 预设组合 */}
      <div className="space-y-3">
        <h4 className="text-md font-medium text-gray-700">预设组合</h4>
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => {
              onExpressionChange('smile', 0.8);
              setIntensity(0.8);
            }}
            className="px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm transition-colors text-left"
          >
            😊 友好微笑
          </button>
          <button
            onClick={() => {
              onExpressionChange('surprise', 0.6);
              setIntensity(0.6);
            }}
            className="px-4 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg text-sm transition-colors text-left"
          >
            😮 适度惊讶
          </button>
          <button
            onClick={() => {
              onExpressionChange('neutral', 0.5);
              setIntensity(0.5);
            }}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors text-left"
          >
            😐 专业中性
          </button>
        </div>
      </div>

      {/* 重置按钮 */}
      <div className="pt-4 border-t border-gray-200">
        <button
          onClick={() => {
            onExpressionChange('neutral', 0.5);
            setIntensity(0.5);
            setCustomColor('#4f46e5');
          }}
          className="w-full px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          重置为默认表情
        </button>
      </div>
    </div>
  );
}