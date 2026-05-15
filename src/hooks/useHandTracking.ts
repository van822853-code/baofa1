import { useEffect, useRef, useState } from 'react';
import { Hands, HAND_CONNECTIONS, Results } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

export function useHandTracking() {
  const [isHandOpen, setIsHandOpen] = useState(true);
  const [hasHandDetected, setHasHandDetected] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const handsRef = useRef<Hands | null>(null);
  const cameraRef = useRef<Camera | null>(null);

  const isCameraActiveRef = useRef(false);

  useEffect(() => {
    // Create hidden video element
    const video = document.createElement('video');
    // Using a tiny size and opacity instead of hiding off-screen helps some browsers keep frame updates active
    video.style.position = 'fixed';
    video.style.top = '0px';
    video.style.left = '0px';
    video.style.width = '1px';
    video.style.height = '1px';
    video.style.opacity = '0.01';
    video.style.pointerEvents = 'none';
    video.style.zIndex = '-1';
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.muted = true;
    document.body.appendChild(video);
    videoRef.current = video;

    const hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`;
      },
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    hands.onResults((results: Results) => {
      if (!handsRef.current || !isCameraActiveRef.current) return;
      
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        if (!hasHandDetected) console.log("Hand tracking active");
        setHasHandDetected(true);
        const landmarks = results.multiHandLandmarks[0];
        
        // Simpler, more reliable open/closed logic
        // If fingertip Y is lower than the second joint Y (PIP), it's considered "closed" (folded)
        // Indices: Index(8, 6), Middle(12, 10), Ring(16, 14), Pinky(20, 18)
        const fingers = [
          { tip: 8, pip: 6 },
          { tip: 12, pip: 10 },
          { tip: 16, pip: 14 },
          { tip: 20, pip: 18 }
        ];

        let openCount = 0;
        fingers.forEach(f => {
          if (landmarks[f.tip].y < landmarks[f.pip].y) {
            openCount++;
          }
        });

        setIsHandOpen(openCount >= 2);
      } else {
        setHasHandDetected(false);
        setIsHandOpen(true);
      }
    });

    handsRef.current = hands;

    return () => {
      isCameraActiveRef.current = false;
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
      if (handsRef.current) {
        handsRef.current.close();
      }
      videoRef.current?.remove();
    };
  }, []);

  const startCamera = async () => {
    if (!videoRef.current || !handsRef.current) return;

    try {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }

      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          const video = videoRef.current;
          const hands = handsRef.current;
          
          if (video && video.readyState >= 2 && hands && isCameraActiveRef.current) {
            try {
              await hands.send({ image: video });
            } catch (e) {
              // Ignore frame errors
            }
          }
        },
        width: 640,
        height: 480,
      });
      
      cameraRef.current = camera;
      await camera.start();
      isCameraActiveRef.current = true;
      setIsCameraActive(true);
    } catch (err) {
      console.error("Camera start failed:", err);
      isCameraActiveRef.current = false;
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    isCameraActiveRef.current = false;
    cameraRef.current?.stop();
    setIsCameraActive(false);
    setIsHandOpen(true);
    setHasHandDetected(false);
  };

  return { isHandOpen, hasHandDetected, isCameraActive, startCamera, stopCamera };
}
