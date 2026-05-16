import { wait } from './utils.js';

export class FramePlayer {
  constructor({ imageElement, animationElement, config }) {
    this.imageElement = imageElement;
    this.animationElement = animationElement;
    this.config = config;
    this.token = 0;
    this.imageElement.src = config.defaultFrame;
  }

  getSequence(name) {
    const sequence = this.config.sequences[name] ?? this.config.sequences.idle;
    const frames = sequence.frames.length > 0 ? sequence.frames : [this.config.defaultFrame];

    return {
      fps: sequence.fps || 8,
      loop: Boolean(sequence.loop),
      frames
    };
  }

  hasSequenceFrames(name, minimum = 1) {
    return this.getSequence(name).frames.length >= minimum;
  }

  getFirstFrame(name) {
    return this.getSequence(name).frames[0] ?? this.config.defaultFrame;
  }

  getLastFrame(name) {
    const frames = this.getSequence(name).frames;

    return frames[frames.length - 1] ?? this.config.defaultFrame;
  }

  stop() {
    this.token += 1;
  }

  setFrame(src, animationName = 'pose') {
    this.stop();
    this.animationElement.dataset.animation = animationName;
    this.imageElement.src = src;
  }

  playLoop(name) {
    const token = this.token + 1;
    this.token = token;
    this.run(name, { token, loop: true });
  }

  async playOnce(name, options = {}) {
    const token = this.token + 1;
    this.token = token;
    await this.run(name, { ...options, token, loop: false });
  }

  async run(name, options) {
    const sequence = this.getSequence(name);
    const frameDuration = 1000 / sequence.fps;
    const shouldLoop = options.loop ?? sequence.loop;
    const startedAt = performance.now();

    this.animationElement.dataset.animation = name;

    do {
      for (let index = 0; index < sequence.frames.length; index += 1) {
        if (this.token !== options.token) {
          return;
        }

        this.imageElement.src = sequence.frames[index];
        options.onFrame?.(index, sequence.frames.length);
        await wait(frameDuration);

        if (options.duration && performance.now() - startedAt >= options.duration) {
          return;
        }
      }
    } while (shouldLoop);
  }
}
