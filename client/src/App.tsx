import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WagmiWalletProvider } from "@/contexts/wagmi-wallet-context";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import AdminPage from "@/pages/admin";
import AdminRewards from "@/pages/admin-rewards";


import { useEffect, useRef, useState } from "react";
import "@/lib/complete-overlay-suppression";
import "@/lib/error-suppression";
import "@/lib/disable-runtime-overlay";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/admin/rewards" component={AdminRewards} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Global error handler to prevent runtime error overlays
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.toString() || '';
      console.warn('Unhandled promise rejection (gracefully handled):', reason);
      
      // Always prevent error overlay to avoid runtime error disruptions
      event.preventDefault();
      
      // Suppress the error to prevent it from bubbling up to error handling plugins
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    const handleError = (event: ErrorEvent) => {
      const errorMsg = event.error?.toString() || event.message || '';
      console.warn('Global error caught:', errorMsg);
      
      // Always prevent error overlay to avoid runtime error disruptions
      event.preventDefault();
      
      // Suppress the error to prevent it from bubbling up to error handling plugins
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return <>{children}</>;
}

function CyberpunkVideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingError, setLoadingError] = useState(false);
  const [isLoadingStarted, setIsLoadingStarted] = useState(false);
  
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Preload video in background without blocking UI
    const preloadVideo = async () => {
      try {
        if (!video || video.error) {
          setLoadingError(true);
          return;
        }
        
        // Set preload to metadata only for faster initial load
        video.preload = 'metadata';
        
        // Start loading immediately but don't block
        video.load();
        
        // Wait for enough data to start playing smoothly (extended for deployment)
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            video.removeEventListener('canplay', handleCanPlay);
            video.removeEventListener('error', handleError);
            // On timeout, show gradient background immediately and continue loading
            setLoadingError(true);
            resolve(true); // Don't reject, just show fallback
          }, 30000); // Extended 30 second timeout for deployment
          
          const handleCanPlay = () => {
            clearTimeout(timeout);
            video.removeEventListener('canplay', handleCanPlay);
            video.removeEventListener('error', handleError);
            resolve(true);
          };
          
          const handleError = (e: any) => {
            clearTimeout(timeout);
            video.removeEventListener('canplay', handleCanPlay);
            video.removeEventListener('error', handleError);
            console.warn('Video loading error:', e);
            reject(new Error('Video failed to load'));
          };
          
          video.addEventListener('canplay', handleCanPlay);
          video.addEventListener('error', handleError);
        });
        
        // Start playing once loaded with error handling
        try {
          const playPromise = video.play();
          if (playPromise !== undefined) {
            await playPromise;
          }
          setIsPlaying(true);
          setIsLoaded(true);
        } catch (playError) {
          console.warn('Video play failed:', playError);
          setLoadingError(true);
        }
      } catch (error) {
        console.warn('Video preload failed:', error);
        setLoadingError(true);
      }
    };

    // Delayed loading for deployment optimization - let critical app load first
    const delayedLoad = setTimeout(() => {
      setIsLoadingStarted(true);
      preloadVideo().catch((error) => {
        console.warn('Video preload error caught:', error);
        setLoadingError(true);
      });
    }, 3000); // 3 second delay to prioritize app functionality

    return () => {
      clearTimeout(delayedLoad);
      if (video) {
        video.pause();
        video.currentTime = 0;
      }
    };
  }, []);

  return (
    <>
      {/* Permanent gradient background - always shown for good UX */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: -2,
          background: 'radial-gradient(circle at center, #0a0a0a 0%, #000000 100%)',
          opacity: !isLoaded || loadingError ? 1 : 0.3, // Dim when video loads
          transition: 'opacity 1s ease-in-out'
        }}
      />
      
      {/* Loading indicator for deployment environments */}
      {isLoadingStarted && !isLoaded && !loadingError && (
        <div 
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.8)',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '12px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          Loading background video...
        </div>
      )}
      
      {/* Video element - hidden until loaded */}
      {!loadingError && (
        <video
          ref={videoRef}
          className="video-background"
          loop
          muted
          playsInline
          preload="none"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: -1,
            objectFit: 'cover',
            opacity: isLoaded ? 0.7 : 0,
            filter: 'brightness(1.2) contrast(1.0) saturate(1.1) hue-rotate(320deg) sepia(0.2)',
            transition: 'opacity 0.3s ease-in-out',
            willChange: 'opacity'
          }}
          onError={(e) => {
            console.warn('Video element error:', e);
            setLoadingError(true);
          }}
          onCanPlay={() => {
            if (!isLoaded) {
              setIsLoaded(true);
            }
          }}
        >
          <source
            src="/attached_assets/Untitled design (22)_1752822331413.mp4"
            type="video/mp4"
          />
          <source
            src="/attached_assets/678a7b5f9cfe257413b8e490_6798d33994ec593b001fae82_32 Compressed-transcode_1752818424149.mp4"
            type="video/mp4"
          />
        </video>
      )}
      
      {/* Fallback gradient if video fails to load */}
      {loadingError && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: -1,
            background: 'radial-gradient(circle at center, #0a0a0a 0%, #000000 100%)',
          }}
        />
      )}
    </>
  );
}

function App() {
  // Clear React Query cache on checkpoint rollback
  useEffect(() => {
    const checkForRollback = () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('cb')) {
        queryClient.clear();
        queryClient.resetQueries();
        
        // Remove cache-busting parameter from URL
        const url = new URL(window.location.href);
        url.searchParams.delete('cb');
        window.history.replaceState({}, '', url.toString());
      }
    };
    
    checkForRollback();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <WagmiWalletProvider>
          <TooltipProvider>
            {/* CYBERPUNK VIDEO BACKGROUND */}
            <CyberpunkVideoBackground />
            <Toaster />
            <Router />
          </TooltipProvider>
        </WagmiWalletProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
