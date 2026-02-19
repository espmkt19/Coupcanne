import { useRef, useState, useCallback } from 'react';

const STEP_THRESHOLD = 12;
const STEP_LOCKOUT_MS = 280;
const FILTER_ALPHA = 0.72;
const AVERAGE_STEP_LENGTH = 0.76; // metros

interface StepEvent {
  timestamp: number;
  magnitude: number;
}

export function useStepCounter() {
  const [steps, setSteps] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [stepDistance, setStepDistance] = useState(0);

  const filteredAccel = useRef({ x: 0, y: 0, z: 0 });
  const stepEvents = useRef<StepEvent[]>([]);
  const stepsCount = useRef(0);
  const lastUpdateTime = useRef(Date.now());

  const reset = useCallback(() => {
    setSteps(0);
    setSpeed(0);
    setStepDistance(0);
    stepsCount.current = 0;
    stepEvents.current = [];
    filteredAccel.current = { x: 0, y: 0, z: 0 };
  }, []);

  const processMotion = useCallback((event: DeviceMotionEvent) => {
    if (!event.acceleration) return;

    const now = Date.now();
    const raw = {
      x: event.acceleration.x ?? 0,
      y: event.acceleration.y ?? 0,
      z: event.acceleration.z ?? 0,
    };

    // Low-pass filter
    filteredAccel.current = {
      x: FILTER_ALPHA * raw.x + (1 - FILTER_ALPHA) * filteredAccel.current.x,
      y: FILTER_ALPHA * raw.y + (1 - FILTER_ALPHA) * filteredAccel.current.y,
      z: FILTER_ALPHA * raw.z + (1 - FILTER_ALPHA) * filteredAccel.current.z,
    };

    const magnitude = Math.sqrt(
      filteredAccel.current.x ** 2 +
      filteredAccel.current.y ** 2 +
      filteredAccel.current.z ** 2
    );

    // Remove events older than lockout
    stepEvents.current = stepEvents.current.filter(
      e => now - e.timestamp < STEP_LOCKOUT_MS
    );

    const recentPeak = stepEvents.current.some(e => e.magnitude > STEP_THRESHOLD * 0.75);

    if (magnitude > STEP_THRESHOLD && !recentPeak) {
      stepEvents.current.push({ timestamp: now, magnitude });
      stepsCount.current += 1;

      const newDist = stepsCount.current * AVERAGE_STEP_LENGTH;

      // Compute speed from last 2 steps
      const allEvents = stepEvents.current;
      let computedSpeed = 0;
      if (allEvents.length >= 2) {
        const dt = (allEvents[allEvents.length - 1].timestamp - allEvents[allEvents.length - 2].timestamp) / 1000;
        if (dt > 0) computedSpeed = AVERAGE_STEP_LENGTH / dt;
      }

      setSteps(stepsCount.current);
      setStepDistance(newDist);
      setSpeed(computedSpeed);
    }

    lastUpdateTime.current = now;
  }, []);

  return { steps, speed, stepDistance, processMotion, reset };
}
