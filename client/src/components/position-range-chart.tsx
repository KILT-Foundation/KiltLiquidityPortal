import React from 'react';

interface PositionRangeChartProps {
  tickLower: number;
  tickUpper: number;
  currentTick: number;
  height?: number;
  showLabels?: boolean;
  className?: string;
}

export const PositionRangeChart: React.FC<PositionRangeChartProps> = ({
  tickLower,
  tickUpper,
  currentTick,
  height = 64,
  showLabels = true,
  className = ''
}) => {
  // Convert ticks to prices (simplified - for display purposes)
  // In production, you'd use actual tick-to-price conversion
  const safeTickLower = tickLower || 0;
  const safeTickUpper = tickUpper || 0;
  const safeCurrentTick = currentTick || 0;
  
  // Calculate tick percentages for positioning
  const tickRange = safeTickUpper - safeTickLower;
  const currentTickPercent = tickRange > 0 
    ? Math.min(Math.max(((safeCurrentTick - safeTickLower) / tickRange) * 100, 0), 100)
    : 50; // Default to middle if no range
  
  // Determine if position is active (in range)
  const isActive = safeCurrentTick >= safeTickLower && safeCurrentTick <= safeTickUpper;
  
  // Calculate SVG positions (assuming 20px padding on each side)
  const svgWidth = 200;
  const padding = 20;
  const activeWidth = svgWidth - (padding * 2);
  const minX = padding;
  const maxX = svgWidth - padding;
  const currentX = minX + (activeWidth * currentTickPercent / 100);
  
  // Curve control points
  const midX = (minX + maxX) / 2;
  const curveHeight = height * 0.25; // 25% of height for curve peak
  const baseY = height * 0.7; // 70% down for curve base
  
  return (
    <div className={`relative bg-black/20 backdrop-blur-xl rounded-lg overflow-hidden border border-white/5 ${className}`} style={{ height }}>
      {/* Background gradient */}
      <div className="absolute inset-0 bg-black/10"></div>
      
      {/* SVG visualization */}
      <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${svgWidth} ${height}`}>
        {/* Background reference curve */}
        <path
          d={`M ${padding} ${baseY} Q ${midX} ${curveHeight} ${svgWidth - padding} ${baseY}`}
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth="1"
          fill="none"
          strokeDasharray="2,2"
        />
        
        {/* Active position curve */}
        <path
          d={`M ${minX} ${baseY} Q ${midX} ${curveHeight} ${maxX} ${baseY}`}
          stroke={isActive ? '#10b981' : '#ef4444'}
          strokeWidth="3"
          fill="none"
          className="drop-shadow-sm"
        />
        
        {/* Min price marker */}
        <circle
          cx={minX}
          cy={baseY}
          r="4"
          fill={isActive ? '#10b981' : '#ef4444'}
          className="drop-shadow-sm"
        />
        
        {/* Max price marker */}
        <circle
          cx={maxX}
          cy={baseY}
          r="4"
          fill={isActive ? '#10b981' : '#ef4444'}
          className="drop-shadow-sm"
        />
        
        {/* Current price indicator */}
        <line
          x1={currentX}
          y1={curveHeight * 0.5}
          x2={currentX}
          y2={height * 0.9}
          stroke="white"
          strokeWidth="2"
          className="drop-shadow-sm"
        />
        <circle
          cx={currentX}
          cy={curveHeight * 0.8}
          r="3"
          fill="white"
          className="drop-shadow-sm"
        />
        
        {/* Position status indicator */}
        <text
          x={midX}
          y={curveHeight * 0.6}
          textAnchor="middle"
          fill="white"
          fontSize="10"
          fontWeight="bold"
          className="drop-shadow-sm"
        >
          {isActive ? 'In Range' : 'Out of Range'}
        </text>
      </svg>
      
      {/* Tick labels */}
      {showLabels && (
        <>
          <div className="absolute bottom-1 left-2 text-xs text-white/60">
            Min: {safeTickLower}
          </div>
          <div className="absolute bottom-1 right-2 text-xs text-white/60">
            Max: {safeTickUpper}
          </div>
          <div className="absolute top-1 left-1/2 transform -translate-x-1/2 text-xs text-white/60">
            Current: {safeCurrentTick}
          </div>
        </>
      )}
    </div>
  );
};

export default PositionRangeChart;