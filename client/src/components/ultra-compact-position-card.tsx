import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Plus } from 'lucide-react';

interface ExternalPosition {
  tokenId: string;
  currentValueUSD: number;
  positionStatus?: string;
}

interface UltraCompactPositionCardProps {
  position: ExternalPosition;
  isSelected: boolean;
  isRegistering: boolean;
  onToggleSelection: (tokenId: string) => void;
  onRegister: (tokenId: string) => void;
}

export function UltraCompactPositionCard({
  position,
  isSelected,
  isRegistering,
  onToggleSelection,
  onRegister
}: UltraCompactPositionCardProps) {
  // Only show in-range positions for rewards
  const isInRange = position.positionStatus === 'IN_RANGE';
  const isEligible = isInRange; // Only in-range positions are eligible
  
  return (
    <div className={`
      bg-gradient-to-r from-black/90 via-[#ff0066]/10 to-black/90 
      backdrop-blur-sm rounded border shadow-lg transition-all duration-300 
      hover:shadow-[#ff0066]/20 p-3 min-w-0
      ${isEligible 
        ? 'border-[#ff0066]/30 hover:border-[#ff0066]/50' 
        : 'border-gray-600/30 opacity-60'
      }
    `}>
      <div className="position-card-layout">
        {/* Left: NFT ID with cyberpunk styling */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelection(position.tokenId)}
            disabled={!isEligible}
            className="w-3 h-3 text-[#ff0066] bg-black border-[#ff0066] rounded focus:ring-[#ff0066] focus:ring-1 disabled:opacity-50 flex-shrink-0"
          />
          <div className="font-mono text-[#ff0066] text-sm font-bold whitespace-nowrap">
            #{position.tokenId}
          </div>
          {!isEligible && (
            <div className="text-xs text-gray-400 font-mono whitespace-nowrap">
              (OUT OF RANGE)
            </div>
          )}
        </div>
        
        {/* Center: Position Value */}
        <div className="position-value-container">
          <div className="text-white font-bold text-lg font-mono truncate-safe number-display-safe">
            ${position.currentValueUSD.toLocaleString(undefined, { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            })}
          </div>
        </div>

        {/* Right: Register Button */}
        <div className="position-actions-container">
          <Button
            onClick={() => onRegister(position.tokenId)}
            disabled={isRegistering || !isEligible}
            className={`
              transition-safe h-7 px-3 text-xs font-medium whitespace-nowrap
              ${isEligible 
                ? 'bg-gradient-to-r from-[#ff0066] to-[#ff0066] hover:from-[#ff0066] hover:to-[#ff0066] text-white border-0 shadow-lg hover:shadow-[#ff0066]/20'
                : 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            {isRegistering ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}