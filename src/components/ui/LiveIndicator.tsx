'use client';

interface LiveIndicatorProps {
  connected: boolean;
}

export function LiveIndicator({ connected }: LiveIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-sm text-gray-600">{connected ? 'Live' : 'Offline'}</span>
    </div>
  );
}
