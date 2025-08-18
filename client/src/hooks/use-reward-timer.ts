import { useState, useEffect } from 'react';

interface RewardTimerState {
  timeUntilNextReward: string;
  minutesLeft: number;
  secondsLeft: number;
  isNearNextReward: boolean;
}

export function useRewardTimer(): RewardTimerState {
  const [timeState, setTimeState] = useState<RewardTimerState>({
    timeUntilNextReward: '59:59',
    minutesLeft: 59,
    secondsLeft: 59,
    isNearNextReward: false
  });

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const currentMinute = now.getMinutes();
      const currentSecond = now.getSeconds();
      
      // Calculate time until next hour (when rewards accumulate)
      const minutesLeft = 59 - currentMinute;
      const secondsLeft = 59 - currentSecond;
      
      // Format as MM:SS
      const timeUntilNextReward = `${minutesLeft.toString().padStart(2, '0')}:${secondsLeft.toString().padStart(2, '0')}`;
      
      // Consider "near" if less than 5 minutes left
      const isNearNextReward = minutesLeft < 5;
      
      setTimeState({
        timeUntilNextReward,
        minutesLeft,
        secondsLeft,
        isNearNextReward
      });
    };

    // Update immediately
    updateTimer();
    
    // Update every second
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, []);

  return timeState;
}