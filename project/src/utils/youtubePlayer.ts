export type YouTubePlayer = { mute: () => void; playVideo: () => void; pauseVideo: () => void; destroy: () => void; getIframe: () => HTMLIFrameElement };
type PlayerEvent = { target: YouTubePlayer; data?: number };
export type YouTubeAPI = {
  Player: new (element: HTMLElement, options: {
    videoId: string; host: string; width: string; height: string; playerVars: Record<string, string | number>;
    events: { onReady: (event: PlayerEvent) => void; onStateChange?: (event: PlayerEvent) => void; onError: () => void; onAutoplayBlocked?: () => void };
  }) => YouTubePlayer;
};

declare global {
  interface Window { YT?: YouTubeAPI; onYouTubeIframeAPIReady?: () => void }
}

let apiPromise: Promise<YouTubeAPI> | null = null;

export function loadYouTubeAPI(): Promise<YouTubeAPI> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const script = document.createElement('script');
    let settled = false;
    const timeout = window.setTimeout(() => fail(), 15000);
    function finish() {
      settled = true;
      window.clearTimeout(timeout);
      window.onYouTubeIframeAPIReady = previous;
    }
    function fail() {
      if (settled) return;
      finish(); script.remove(); apiPromise = null;
      reject(new Error('Não foi possível carregar o YouTube.'));
    }
    window.onYouTubeIframeAPIReady = () => {
      if (settled) return;
      if (!window.YT?.Player) { fail(); return; }
      finish(); resolve(window.YT); previous?.();
    };
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = fail;
    document.head.append(script);
  });
  return apiPromise;
}