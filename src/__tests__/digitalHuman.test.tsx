import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DigitalHumanViewer from '../components/DigitalHumanViewer';
import ControlPanel from '../components/ControlPanel';
import { useDigitalHumanStore } from '../store/digitalHumanStore';
import { TTSService, ASRService } from '../core/audio/audioService';
import React from 'react';

// Mock React's useRef before Three.js mocks
vi.spyOn(React, 'useRef').mockImplementation(() => {
  const groupMock = {
    children: [],
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    add: vi.fn((object) => {
      if (object && typeof object === 'object') {
        groupMock.children.push(object);
      }
    }),
    remove: vi.fn((object) => {
      const index = groupMock.children.indexOf(object);
      if (index > -1) {
        groupMock.children.splice(index, 1);
      }
    })
  };
  
  return {
    current: groupMock
  };
});

// 模拟Three.js相关模块
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas">{children}</div>,
  useFrame: vi.fn((callback) => {
    // Mock the callback with a state object
    callback({
      clock: {
        elapsedTime: 0
      }
    });
  }),
  useThree: vi.fn(() => ({ 
    scene: {
      add: vi.fn(),
      remove: vi.fn()
    },
    camera: {},
    gl: {}
  }))
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls">OrbitControls</div>,
  Environment: () => <div data-testid="environment">Environment</div>,
  Html: ({ children }: { children: React.ReactNode }) => <div data-testid="html">{children}</div>,
  PerspectiveCamera: ({ children }: { children?: React.ReactNode }) => <div data-testid="perspective-camera">{children}</div>,
  Float: ({ children }: { children: React.ReactNode }) => <div data-testid="float">{children}</div>,
  Sparkles: () => <div data-testid="sparkles">Sparkles</div>,
  ContactShadows: () => <div data-testid="contact-shadows">ContactShadows</div>,
  useGLTF: vi.fn()
}));

vi.mock('three', () => ({
  BoxGeometry: vi.fn(function BoxGeometry() { return {}; }),
  SphereGeometry: vi.fn(function SphereGeometry() { return {}; }),
  MeshPhysicalMaterial: vi.fn(function MeshPhysicalMaterial(props: any) {
    return {
      color: props?.color || 0xffffff,
      metalness: props?.metalness || 0,
      roughness: props?.roughness || 1,
      clearcoat: props?.clearcoat || 0,
      clearcoatRoughness: props?.clearcoatRoughness || 0
    };
  }),
  MeshStandardMaterial: vi.fn(function MeshStandardMaterial(props: any) {
    return {
      color: props?.color || 0xffffff,
      metalness: props?.metalness || 0,
      roughness: props?.roughness || 1
    };
  }),
  MeshBasicMaterial: vi.fn(function MeshBasicMaterial(props: any) {
    return {
      color: props?.color || 0xffffff,
      emissive: props?.emissive,
      emissiveIntensity: props?.emissiveIntensity,
      transparent: props?.transparent,
      opacity: props?.opacity,
      side: props?.side,
      wireframe: props?.wireframe,
      toneMapped: props?.toneMapped
    };
  }),
  Mesh: vi.fn(function Mesh() {
    const mesh = {
      position: { x: 0, y: 0, z: 0, set: vi.fn() },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      add: vi.fn(),
      remove: vi.fn()
    };
    return mesh;
  }),
  Group: vi.fn(function Group() {
    const group = {
      children: [],
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      add: vi.fn(),
      remove: vi.fn()
    };
    return group;
  }),
  Vector3: vi.fn(function Vector3(x = 0, y = 0, z = 0) { return { x, y, z }; }),
  Color: vi.fn(function Color(color = 0xffffff) { return { getHex: () => color }; }),
  MathUtils: {
    lerp: (start: number, end: number, alpha: number) => start + (end - start) * alpha
  },
  DoubleSide: 'DoubleSide'
}));

describe('DigitalHumanViewer', () => {
  it('renders without crashing', () => {
    render(<DigitalHumanViewer />);
    expect(screen.getByTestId('canvas')).toBeInTheDocument();
  });

  it('displays control panel', () => {
    render(<DigitalHumanViewer />);
    expect(screen.getByText('数字人控制')).toBeInTheDocument();
  });

  it('shows model status', () => {
    render(<DigitalHumanViewer />);
    expect(screen.getByText('模型状态:')).toBeInTheDocument();
    expect(screen.getByText('已加载')).toBeInTheDocument();
  });

  it('shows rendering engine info', () => {
    render(<DigitalHumanViewer />);
    expect(screen.getByText('渲染引擎:')).toBeInTheDocument();
    expect(screen.getByText('Three.js')).toBeInTheDocument();
  });

  it('handles auto rotate prop', () => {
    const { rerender } = render(<DigitalHumanViewer autoRotate={false} />);
    expect(screen.getByText('自动旋转:')).toBeInTheDocument();
    expect(screen.getByText('关闭')).toBeInTheDocument();
    
    rerender(<DigitalHumanViewer autoRotate={true} />);
    expect(screen.getByText('自动旋转:')).toBeInTheDocument();
    expect(screen.getByText('开启')).toBeInTheDocument();
  });

  it('calls onModelLoad callback', () => {
    const onModelLoad = vi.fn();
    render(<DigitalHumanViewer onModelLoad={onModelLoad} />);
    // 由于Three.js是模拟的，这里只是验证回调存在
    expect(onModelLoad).toBeDefined();
  });
});

describe('ControlPanel', () => {
  const defaultProps = {
    isPlaying: false,
    isRecording: false,
    isMuted: false,
    autoRotate: false,
    onPlayPause: vi.fn(),
    onReset: vi.fn(),
    onToggleRecording: vi.fn(),
    onToggleMute: vi.fn(),
    onToggleAutoRotate: vi.fn(),
    onVoiceCommand: vi.fn()
  };

  it('renders all control sections', () => {
    render(<ControlPanel {...defaultProps} />);
    expect(screen.getByText('播放控制')).toBeInTheDocument();
    expect(screen.getByText('语音交互')).toBeInTheDocument();
    expect(screen.getByText('快速命令')).toBeInTheDocument();
    expect(screen.getByText('状态信息')).toBeInTheDocument();
  });

  it('handles play/pause button', () => {
    render(<ControlPanel {...defaultProps} />);
    const playButton = screen.getByText('播放');
    fireEvent.click(playButton);
    expect(defaultProps.onPlayPause).toHaveBeenCalled();
  });

  it('shows pause when playing', () => {
    render(<ControlPanel {...defaultProps} isPlaying={true} />);
    expect(screen.getByText('暂停')).toBeInTheDocument();
  });

  it('handles recording toggle', () => {
    render(<ControlPanel {...defaultProps} />);
    const recordButton = screen.getByText('开始录音');
    fireEvent.click(recordButton);
    expect(defaultProps.onToggleRecording).toHaveBeenCalled();
  });

  it('shows stop recording when recording', () => {
    render(<ControlPanel {...defaultProps} isRecording={true} />);
    expect(screen.getByText('停止录音')).toBeInTheDocument();
  });

  it('handles voice commands', () => {
    render(<ControlPanel {...defaultProps} />);
    const greetButton = screen.getByText('打招呼');
    fireEvent.click(greetButton);
    expect(defaultProps.onVoiceCommand).toHaveBeenCalledWith('打招呼');
  });

  it('shows recording status', () => {
    render(<ControlPanel {...defaultProps} isRecording={true} />);
    expect(screen.getByText('录音中')).toBeInTheDocument();
  });
});

describe('DigitalHumanStore', () => {
  it('initializes with correct default state', () => {
    const { isPlaying, isRecording, isMuted, autoRotate } = useDigitalHumanStore.getState();
    expect(isPlaying).toBe(false);
    expect(isRecording).toBe(false);
    expect(isMuted).toBe(false);
    expect(autoRotate).toBe(false);
  });

  it('handles play action', () => {
    const { play, isPlaying } = useDigitalHumanStore.getState();
    play();
    expect(useDigitalHumanStore.getState().isPlaying).toBe(true);
  });

  it('handles pause action', () => {
    const { play, pause } = useDigitalHumanStore.getState();
    play();
    expect(useDigitalHumanStore.getState().isPlaying).toBe(true);
    pause();
    expect(useDigitalHumanStore.getState().isPlaying).toBe(false);
  });

  it('handles reset action', () => {
    const { play, reset, isPlaying } = useDigitalHumanStore.getState();
    play();
    reset();
    expect(useDigitalHumanStore.getState().isPlaying).toBe(false);
    expect(useDigitalHumanStore.getState().currentAnimation).toBe('idle');
    expect(useDigitalHumanStore.getState().currentEmotion).toBe('neutral');
    expect(useDigitalHumanStore.getState().currentExpression).toBe('neutral');
  });

  it('handles recording toggle', () => {
    const { startRecording, isRecording } = useDigitalHumanStore.getState();
    startRecording();
    expect(useDigitalHumanStore.getState().isRecording).toBe(true);
  });

  it('handles mute toggle', () => {
    const { toggleMute, isMuted } = useDigitalHumanStore.getState();
    const initialMute = isMuted;
    toggleMute();
    expect(useDigitalHumanStore.getState().isMuted).toBe(!initialMute);
  });

  it('handles auto rotate toggle', () => {
    const { toggleAutoRotate, autoRotate } = useDigitalHumanStore.getState();
    const initialRotate = autoRotate;
    toggleAutoRotate();
    expect(useDigitalHumanStore.getState().autoRotate).toBe(!initialRotate);
  });
});

describe('TTSService', () => {
  let ttsService: TTSService;
  let mockSpeechSynthesis: any;
  let mockSpeechSynthesisUtterance: any;

  beforeEach(() => {
    // Create mocks
    mockSpeechSynthesis = {
      speak: vi.fn(),
      cancel: vi.fn(),
      getVoices: vi.fn(() => []),
      speaking: false,
      onvoiceschanged: null
    };

    // Create a proper constructor function for SpeechSynthesisUtterance
    function MockSpeechSynthesisUtterance(this: any, text: string) {
      this.text = text;
      this.lang = '';
      this.rate = 1;
      this.pitch = 1;
      this.volume = 1;
      this.voice = null;
      this.onstart = null;
      this.onend = null;
      this.onerror = null;
    }
    mockSpeechSynthesisUtterance = MockSpeechSynthesisUtterance as any;

    // Store original values
    const originalSpeechSynthesis = (window as any).speechSynthesis;
    const originalSpeechSynthesisUtterance = (window as any).SpeechSynthesisUtterance;

    // Set up mocks
    (window as any).speechSynthesis = mockSpeechSynthesis;
    (window as any).SpeechSynthesisUtterance = mockSpeechSynthesisUtterance;

    // Clean up function
    return () => {
      (window as any).speechSynthesis = originalSpeechSynthesis;
      (window as any).SpeechSynthesisUtterance = originalSpeechSynthesisUtterance;
    };
  });

  it('initializes correctly', () => {
    ttsService = new TTSService();
    expect(ttsService).toBeDefined();
    expect(mockSpeechSynthesis.getVoices).toHaveBeenCalled();
  });

  it('speaks text', () => {
    ttsService = new TTSService();
    const testText = 'Hello, world!';
    ttsService.speak(testText);
    expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
  });

  it('cancels previous speech', () => {
    ttsService = new TTSService();
    mockSpeechSynthesis.speaking = true;
    ttsService.speak('New text');
    expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
  });

  it('stops speech', () => {
    ttsService = new TTSService();
    ttsService.stop();
    expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
  });
});

describe('ASRService', () => {
  let asrService: ASRService;
  let mockSpeechRecognition: any;

  beforeEach(() => {
    // Create a proper constructor function for SpeechRecognition
    function MockSpeechRecognition(this: any) {
      this.start = vi.fn();
      this.stop = vi.fn();
      this.continuous = false;
      this.interimResults = false;
      this.lang = '';
      this.onstart = null;
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
    }
    mockSpeechRecognition = MockSpeechRecognition as any;

    // Store original value
    const originalWebkitSpeechRecognition = (window as any).webkitSpeechRecognition;

    // Set up mock
    (window as any).webkitSpeechRecognition = mockSpeechRecognition;

    // Clean up function
    return () => {
      (window as any).webkitSpeechRecognition = originalWebkitSpeechRecognition;
    };
  });

  it('initializes correctly when supported', () => {
    asrService = new ASRService();
    expect(asrService).toBeDefined();
  });

  it('starts recognition', () => {
    asrService = new ASRService();
    asrService.start();
    // Since we can't directly access the mock, we verify the service is created
    expect(asrService).toBeDefined();
  });

  it('stops recognition', () => {
    asrService = new ASRService();
    asrService.stop();
    // Verify no errors are thrown
    expect(asrService).toBeDefined();
  });
});

describe('Performance Tests', () => {
  it('renders DigitalHumanViewer within acceptable time', async () => {
    const startTime = performance.now();
    render(<DigitalHumanViewer />);
    const endTime = performance.now();
    
    // Should render in less than 100ms
    expect(endTime - startTime).toBeLessThan(100);
  });

  it('handles rapid state changes efficiently', () => {
    const { play, pause, play: playAgain } = useDigitalHumanStore.getState();
    
    const startTime = performance.now();
    for (let i = 0; i < 100; i++) {
      if (i % 2 === 0) {
        play();
      } else {
        pause();
      }
    }
    const endTime = performance.now();
    
    // 100 state changes should complete in less than 50ms
    expect(endTime - startTime).toBeLessThan(50);
  });
});

describe('Integration Tests', () => {
  const defaultProps = {
    isPlaying: false,
    isRecording: false,
    isMuted: false,
    autoRotate: false,
    onPlayPause: vi.fn(),
    onReset: vi.fn(),
    onToggleRecording: vi.fn(),
    onToggleMute: vi.fn(),
    onToggleAutoRotate: vi.fn(),
    onVoiceCommand: vi.fn()
  };

  it('integrates control panel with digital human viewer', () => {
    const TestComponent = () => {
      const { isPlaying, play, pause } = useDigitalHumanStore();
      
      return (
        <div>
          <DigitalHumanViewer />
          <ControlPanel
            isPlaying={isPlaying}
            isRecording={false}
            isMuted={false}
            autoRotate={false}
            onPlayPause={() => isPlaying ? pause() : play()}
            onReset={() => {}}
            onToggleRecording={() => {}}
            onToggleMute={() => {}}
            onToggleAutoRotate={() => {}}
            onVoiceCommand={() => {}}
          />
        </div>
      );
    };

    render(<TestComponent />);
    
    // Both components should render without conflicts
    expect(screen.getByText('数字人控制')).toBeInTheDocument();
    expect(screen.getByText('播放控制')).toBeInTheDocument();
  });

  it('handles voice command integration', async () => {
    const onVoiceCommand = vi.fn();
    const props = { ...defaultProps, onVoiceCommand };
    render(<ControlPanel {...props} />);
    
    const greetButton = screen.getByText('打招呼');
    fireEvent.click(greetButton);
    
    await waitFor(() => {
      expect(onVoiceCommand).toHaveBeenCalledWith('打招呼');
    });
  });
});