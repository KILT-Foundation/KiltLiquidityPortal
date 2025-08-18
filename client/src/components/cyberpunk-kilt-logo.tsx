import React from 'react';
import kiltLogo from '@assets/KILT_400x400_transparent_1754560178965.png';

interface CyberpunkKiltLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function CyberpunkKiltLogo({ size = 'md', className = '' }: CyberpunkKiltLogoProps) {
  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8', 
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32'
  };

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      <div className="cyberpunk-logo-container relative w-full h-full">
        {/* Digital grid background - more contained */}
        <div className="absolute -inset-3 digital-grid"></div>
        
        {/* Holographic scanlines */}
        <div className="absolute -inset-2 scanlines"></div>
        
        {/* Main logo with glitch effect */}
        <div className="relative z-10 logo-wrapper">
          <img
            src={kiltLogo}
            alt="KILT"
            className="w-full h-full object-contain cyberpunk-logo-main"
          />
          {/* Glitch clone layers */}
          <img
            src={kiltLogo}
            alt=""
            className="absolute inset-0 w-full h-full object-contain cyberpunk-logo-glitch-r"
          />
          <img
            src={kiltLogo}
            alt=""
            className="absolute inset-0 w-full h-full object-contain cyberpunk-logo-glitch-g"
          />
        </div>
        
        {/* Neon glow rings - highly contained for alignment */}
        <div className="absolute -inset-1 neon-ring-1"></div>
        <div className="absolute -inset-2 neon-ring-2"></div>
        
        {/* Data stream particles - highly contained */}
        <div className="absolute -inset-2 data-streams"></div>
        
        {/* Hexagonal overlay */}
        <div className="absolute -inset-2 hex-overlay"></div>
      </div>

      <style>{`
        .cyberpunk-logo-container {
          filter: drop-shadow(0 0 15px rgba(255, 0, 102, 0.5));
          overflow: visible;
          perspective: 1000px;
        }

        .digital-grid {
          background-image: 
            linear-gradient(rgba(255, 0, 102, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 0, 102, 0.1) 1px, transparent 1px);
          background-size: 8px 8px;
          animation: grid-pulse 4s ease-in-out infinite;
          opacity: 0.4;
        }

        .scanlines {
          background: linear-gradient(
            transparent 50%,
            rgba(255, 0, 102, 0.1) 50%,
            rgba(255, 0, 102, 0.2) 51%,
            transparent 52%
          );
          background-size: 100% 4px;
          animation: scanline-move 2s linear infinite;
          opacity: 0.6;
        }

        .logo-wrapper {
          transform-style: preserve-3d;
          animation: logo-float 3s ease-in-out infinite;
        }

        .cyberpunk-logo-main {
          filter: brightness(1.1) contrast(1.2);
          transition: all 0.3s ease;
          position: relative;
          z-index: 3;
        }

        .cyberpunk-logo-glitch-r {
          filter: sepia(1) hue-rotate(320deg) saturate(2);
          animation: glitch-r 0.3s ease-in-out infinite alternate;
          mix-blend-mode: screen;
          opacity: 0;
          z-index: 1;
        }

        .cyberpunk-logo-glitch-g {
          filter: sepia(1) hue-rotate(120deg) saturate(2);
          animation: glitch-g 0.4s ease-in-out infinite alternate-reverse;
          mix-blend-mode: screen;
          opacity: 0;
          z-index: 2;
        }

        .neon-ring-1 {
          border: 2px solid rgba(255, 0, 102, 0.8);
          border-radius: 50%;
          box-shadow: 
            0 0 10px rgba(255, 0, 102, 0.5),
            inset 0 0 10px rgba(255, 0, 102, 0.3);
          animation: neon-pulse-1 2s ease-in-out infinite;
        }

        .neon-ring-2 {
          border: 1px solid rgba(255, 0, 102, 0.5);
          border-radius: 50%;
          box-shadow: 
            0 0 20px rgba(255, 0, 102, 0.3),
            inset 0 0 20px rgba(255, 0, 102, 0.2);
          animation: neon-pulse-2 3s ease-in-out infinite reverse;
        }

        .data-streams {
          background-image: 
            radial-gradient(1px 1px at 10% 20%, rgba(255, 0, 102, 0.8), transparent),
            radial-gradient(1px 1px at 80% 40%, rgba(255, 0, 102, 0.6), transparent),
            radial-gradient(1px 1px at 30% 80%, rgba(255, 0, 102, 0.7), transparent),
            radial-gradient(1px 1px at 90% 10%, rgba(255, 0, 102, 0.5), transparent);
          animation: data-flow 6s linear infinite;
          opacity: 0.7;
        }

        .hex-overlay {
          background-image: 
            conic-gradient(from 0deg at 50% 50%, 
              transparent 0deg, rgba(255, 0, 102, 0.1) 60deg, transparent 120deg,
              transparent 180deg, rgba(255, 0, 102, 0.1) 240deg, transparent 300deg);
          border-radius: 50%;
          animation: hex-rotate 8s linear infinite;
          opacity: 0.3;
        }

        @keyframes grid-pulse {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.6; }
        }

        @keyframes scanline-move {
          0% { background-position: 0 0; }
          100% { background-position: 0 20px; }
        }

        @keyframes logo-float {
          0%, 100% { 
            transform: translateY(0px) rotateX(0deg);
          }
          50% { 
            transform: translateY(-3px) rotateX(5deg);
          }
        }

        @keyframes glitch-r {
          0% { 
            transform: translate(0);
            opacity: 0;
          }
          20% { 
            transform: translate(-2px, 1px);
            opacity: 0.8;
          }
          40% { 
            transform: translate(-2px, -1px);
            opacity: 0.4;
          }
          60% { 
            transform: translate(2px, 1px);
            opacity: 0.6;
          }
          80% { 
            transform: translate(1px, -1px);
            opacity: 0.3;
          }
          100% { 
            transform: translate(0);
            opacity: 0;
          }
        }

        @keyframes glitch-g {
          0% { 
            transform: translate(0);
            opacity: 0;
          }
          25% { 
            transform: translate(1px, -1px);
            opacity: 0.6;
          }
          50% { 
            transform: translate(-1px, 1px);
            opacity: 0.8;
          }
          75% { 
            transform: translate(1px, 1px);
            opacity: 0.4;
          }
          100% { 
            transform: translate(0);
            opacity: 0;
          }
        }

        @keyframes neon-pulse-1 {
          0%, 100% { 
            box-shadow: 
              0 0 5px rgba(255, 0, 102, 0.3),
              inset 0 0 5px rgba(255, 0, 102, 0.2);
            transform: scale(1);
          }
          50% { 
            box-shadow: 
              0 0 15px rgba(255, 0, 102, 0.8),
              inset 0 0 15px rgba(255, 0, 102, 0.5);
            transform: scale(1.05);
          }
        }

        @keyframes neon-pulse-2 {
          0%, 100% { 
            box-shadow: 
              0 0 10px rgba(255, 0, 102, 0.2),
              inset 0 0 10px rgba(255, 0, 102, 0.1);
            transform: scale(1);
          }
          50% { 
            box-shadow: 
              0 0 25px rgba(255, 0, 102, 0.6),
              inset 0 0 25px rgba(255, 0, 102, 0.3);
            transform: scale(1.08);
          }
        }

        @keyframes data-flow {
          0% { 
            transform: translate(0, 0) rotate(0deg);
            opacity: 0.5;
          }
          50% { 
            transform: translate(-20px, -20px) rotate(180deg);
            opacity: 0.9;
          }
          100% { 
            transform: translate(0, 0) rotate(360deg);
            opacity: 0.5;
          }
        }

        @keyframes hex-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .cyberpunk-logo-container:hover .cyberpunk-logo-main {
          filter: brightness(1.3) contrast(1.4);
          transform: scale(1.05);
        }

        .cyberpunk-logo-container:hover .cyberpunk-logo-glitch-r {
          animation: glitch-r 0.1s ease-in-out infinite alternate;
        }

        .cyberpunk-logo-container:hover .cyberpunk-logo-glitch-g {
          animation: glitch-g 0.15s ease-in-out infinite alternate-reverse;
        }

        .cyberpunk-logo-container:hover .neon-ring-1 {
          animation: neon-pulse-1 0.8s ease-in-out infinite;
        }

        .cyberpunk-logo-container:hover .neon-ring-2 {
          animation: neon-pulse-2 1.2s ease-in-out infinite reverse;
        }

        .cyberpunk-logo-container:hover .data-streams {
          animation: data-flow 2s linear infinite;
        }

        .cyberpunk-logo-container:hover .hex-overlay {
          animation: hex-rotate 3s linear infinite;
        }
      `}</style>
    </div>
  );
}

export default CyberpunkKiltLogo;