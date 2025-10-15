'use client';

interface ConfidenceBadgeProps {
  confidence: number | null;
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  if (confidence === null) {
    return null;
  }

  const confidencePercentage = (confidence * 100).toFixed(0);

  let colorClasses = '';
  if (confidence >= 0.8) {
    colorClasses = 'bg-green-100 text-green-800';
  } else if (confidence >= 0.6) {
    colorClasses = 'bg-yellow-100 text-yellow-800';
  } else {
    colorClasses = 'bg-red-100 text-red-800';
  }

  return (
    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${colorClasses}`}>
      {confidencePercentage}%
    </span>
  );
}
