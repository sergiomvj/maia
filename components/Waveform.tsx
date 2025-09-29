
import React from 'react';

interface WaveformProps {
  isActive: boolean;
  colorClass?: string;
}

const Waveform: React.FC<WaveformProps> = ({ isActive, colorClass = 'bg-sky-500' }) => {
  const bars = [
    { height: 'h-2/5', animation: 'animate-[scaleY_1s_ease-in-out_infinite_alternate_-0.1s]' },
    { height: 'h-4/5', animation: 'animate-[scaleY_1s_ease-in-out_infinite_alternate_-0.2s]' },
    { height: 'h-full', animation: 'animate-[scaleY_1s_ease-in-out_infinite_alternate_-0.3s]' },
    { height: 'h-3/5', animation: 'animate-[scaleY_1s_ease-in-out_infinite_alternate_-0.4s]' },
    { height: 'h-4/5', animation: 'animate-[scaleY_1s_ease-in-out_infinite_alternate_-0.5s]' },
  ];

  return (
    <div className="flex items-center justify-center space-x-1 h-8">
      {bars.map((bar, index) => (
        <span
          key={index}
          className={`w-1 rounded-full ${colorClass} ${bar.height} transform-gpu origin-bottom transition-transform duration-300 ${isActive ? bar.animation : 'scale-y-10'}`}
        />
      ))}
    </div>
  );
};

export default Waveform;
