import React, { useState, useEffect } from 'react';
import { Activity, Brain, Zap, Target, Clock, TrendingUp } from 'lucide-react';

interface BehaviorState {
  state: string;
  confidence: number;
  lastUpdate: Date;
  activity: string;
  goal: string;
}

interface BehaviorControlPanelProps {
  currentBehavior: string;
  onBehaviorChange: (behavior: string, parameters: any) => void;
}

export default function BehaviorControlPanel({ currentBehavior, onBehaviorChange }: BehaviorControlPanelProps) {
  const [behaviorState, setBehaviorState] = useState<BehaviorState>({
    state: 'idle',
    confidence: 0.8,
    lastUpdate: new Date(),
    activity: 'Standby',
    goal: 'Waiting for input'
  });

  const [isAutoMode, setIsAutoMode] = useState(false);
  const [decisionInterval] = useState(3000);

  const behaviors = [
    {
      name: 'idle',
      label: 'Idle',
      icon: <Clock size={20} />,
      color: 'text-gray-400',
      description: 'Basic standby loop',
      parameters: { idleTime: 5000, breathing: true }
    },
    {
      name: 'greeting',
      label: 'Greet',
      icon: <Target size={20} />,
      color: 'text-green-400',
      description: 'Friendly wave & smile',
      parameters: { wave: true, smile: true, duration: 3000 }
    },
    {
      name: 'listening',
      label: 'Listen',
      icon: <Brain size={20} />,
      color: 'text-blue-400',
      description: 'Active attention focus',
      parameters: { headNod: true, eyeContact: true, attention: 0.9 }
    },
    {
      name: 'thinking',
      label: 'Think',
      icon: <Activity size={20} />,
      color: 'text-yellow-400',
      description: 'Processing animation',
      parameters: { headTilt: true, pause: true, processing: true }
    },
    {
      name: 'speaking',
      label: 'Speak',
      icon: <TrendingUp size={20} />,
      color: 'text-purple-400',
      description: 'Active conversation',
      parameters: { mouthMove: true, gestures: true, emphasis: 0.8 }
    },
    {
      name: 'excited',
      label: 'Excite',
      icon: <Zap size={20} />,
      color: 'text-orange-400',
      description: 'High energy state',
      parameters: { energy: 0.9, movement: true, animation: 'bounce' }
    }
  ];

  // Auto Decision Mock
  useEffect(() => {
    if (!isAutoMode) return;
    const interval = setInterval(() => {
      makeAutoDecision();
    }, decisionInterval);
    return () => clearInterval(interval);
  }, [isAutoMode, decisionInterval]);

  const makeAutoDecision = () => {
    const now = new Date();
    let newBehavior = 'idle';
    let newParameters = {};
    let newConfidence = 0.7;

    if (Math.random() > 0.7) {
      newBehavior = 'greeting';
      newConfidence = 0.8;
    } else if (Math.random() > 0.9) {
      newBehavior = 'excited';
      newConfidence = 0.6;
    }

    const selectedBehavior = behaviors.find(b => b.name === newBehavior);
    if (selectedBehavior) newParameters = selectedBehavior.parameters;

    setBehaviorState({
      state: newBehavior,
      confidence: newConfidence,
      lastUpdate: now,
      activity: behaviors.find(b => b.name === newBehavior)?.label || 'Unknown',
      goal: `Auto-switch to ${behaviors.find(b => b.name === newBehavior)?.label}`
    });

    onBehaviorChange(newBehavior, newParameters);
  };

  const handleBehaviorClick = (behaviorName: string, parameters: any) => {
    const behavior = behaviors.find(b => b.name === behaviorName);
    if (!behavior) return;

    setBehaviorState({
      state: behaviorName,
      confidence: 0.9,
      lastUpdate: new Date(),
      activity: behavior.label,
      goal: `Manual override: ${behavior.label}`
    });

    onBehaviorChange(behaviorName, parameters);
  };

  const toggleAutoMode = () => {
    setIsAutoMode(!isAutoMode);
    setBehaviorState(prev => ({
      ...prev,
      goal: !isAutoMode ? 'Auto-Pilot Engaged' : 'Manual Control'
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <h3 className="text-lg font-medium text-white">Behavior Engine</h3>
        <div className="flex items-center space-x-2">
          <div className={`w-1.5 h-1.5 rounded-full ${isAutoMode ? 'bg-green-500 animate-pulse' : 'bg-white/20'}`}></div>
          <span className="text-xs text-white/60">{isAutoMode ? 'AUTO' : 'MANUAL'}</span>
        </div>
      </div>

      {/* State Monitor */}
      <div className="bg-black/40 rounded-xl p-4 space-y-2 border border-white/5 font-mono text-xs">
        <div className="flex justify-between">
          <span className="text-white/40">STATE</span>
          <span className="text-green-400 uppercase">{behaviorState.state}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">CONFIDENCE</span>
          <span className="text-blue-400">{Math.round(behaviorState.confidence * 100)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">GOAL</span>
          <span className="text-white/60 truncate max-w-[150px] text-right">{behaviorState.goal}</span>
        </div>
      </div>

      {/* Behavior Grid */}
      <div className="grid grid-cols-2 gap-3">
        {behaviors.map((behavior) => (
          <button
            key={behavior.name}
            onClick={() => handleBehaviorClick(behavior.name, behavior.parameters)}
            className={`flex items-center space-x-3 p-3 rounded-xl border transition-all text-left ${
              currentBehavior === behavior.name
                ? 'border-blue-500/50 bg-blue-500/10'
                : 'border-white/5 bg-white/5 hover:bg-white/10'
            }`}
          >
            <div className={`p-2 rounded-lg bg-black/20 ${behavior.color}`}>
              {behavior.icon}
            </div>
            <div>
              <div className="font-medium text-gray-200 text-sm">{behavior.label}</div>
              <div className="text-[10px] text-white/40">{behavior.description}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Auto Switch */}
      <div className="pt-4 border-t border-white/10">
         <button
            onClick={toggleAutoMode}
            className={`w-full px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
              isAutoMode
                ? 'bg-green-500/20 text-green-400 border-green-500/50'
                : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
            }`}
          >
            {isAutoMode ? 'Disengage Auto-Pilot' : 'Engage Auto-Pilot'}
          </button>
      </div>
    </div>
  );
}
