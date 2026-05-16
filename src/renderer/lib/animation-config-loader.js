import { fallbackConfig } from './constants.js';

export class AnimationConfigLoader {
  static async load() {
    try {
      const response = await fetch('./animations.json', { cache: 'no-store' });

      if (!response.ok) {
        return AnimationConfigLoader.preload(fallbackConfig);
      }

      const config = await response.json();
      const mergedConfig = {
        ...fallbackConfig,
        ...config,
        sequences: {
          ...fallbackConfig.sequences,
          ...(config.sequences ?? {})
        }
      };

      return AnimationConfigLoader.preload(mergedConfig);
    } catch {
      return AnimationConfigLoader.preload(fallbackConfig);
    }
  }

  static async preload(config) {
    const entries = Object.entries(config.sequences);
    const loadedSequences = {};

    await Promise.all(entries.map(async ([name, sequence]) => {
      const resolvedFrames = await AnimationConfigLoader.resolveFrames(sequence);
      const frames = await Promise.all(resolvedFrames.map(AnimationConfigLoader.preloadFrame));
      loadedSequences[name] = {
        ...sequence,
        frames: frames.filter(Boolean)
      };
    }));

    const defaultFrame = await AnimationConfigLoader.preloadFrame(config.defaultFrame);

    return {
      ...config,
      defaultFrame: defaultFrame ?? fallbackConfig.defaultFrame,
      sequences: loadedSequences
    };
  }

  static async resolveFrames(sequence) {
    let frames = Array.isArray(sequence.frames) ? sequence.frames : [];
    const frameDirectory = sequence.frameDirectory ?? sequence.framesDirectory;

    if (frameDirectory && window.yukiCat?.listAnimationFrames) {
      const directoryFrames = await window.yukiCat.listAnimationFrames(frameDirectory);

      if (directoryFrames.length > 0) {
        frames = directoryFrames;
      }
    }

    return sequence.reverse ? [...frames].reverse() : frames;
  }

  static preloadFrame(src) {
    return new Promise((resolve) => {
      const image = new Image();

      image.onload = async () => {
        try {
          if (image.decode) {
            await image.decode();
          }
        } catch {
          // onload already proved the frame is usable; decode can reject for cached images.
        }

        resolve(src);
      };
      image.onerror = () => resolve(null);
      image.src = src;
    });
  }
}
