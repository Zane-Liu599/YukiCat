const elements = {
  pet: document.querySelector('.pet'),
  handToolButton: document.querySelector('.hand-tool-button'),
  cat: document.querySelector('.cat'),
  catFrame: document.querySelector('.cat-frame'),
  pokeHand: document.querySelector('.poke-hand')
};

const timings = {
  longIdle: 45000,
  initialPause: 1800,
  behaviorMinPause: 3600,
  behaviorRandomPause: 3200,
  postBlinkMinPause: 2200,
  postBlinkRandomPause: 4200,
  frontPause: 1200,
  movementStep: 24,
  pokeAnimation: 180
};

const fallbackConfig = {
  defaultFrame: './assets/yuki-sit-right.png',
  sequences: {
    idle: {
      fps: 6,
      loop: true,
      frames: ['./assets/yuki-sit-right.png']
    },
    sitRight: {
      fps: 2,
      loop: false,
      frames: ['./assets/yuki-sit-right.png']
    },
    sitLeft: {
      fps: 2,
      loop: false,
      frames: ['./assets/yuki-sit-right.png']
    },
    blink: {
      fps: 14,
      loop: false,
      frames: []
    },
    turnFrontToSide: {
      fps: 12,
      loop: false,
      frames: []
    },
    turnSideToFront: {
      fps: 12,
      loop: false,
      frames: []
    },
    turnBackToSide: {
      fps: 10,
      loop: false,
      frames: []
    },
    turnSideToBack: {
      fps: 10,
      loop: false,
      frames: []
    },
    turnFrontToBack: {
      fps: 12,
      loop: false,
      frames: []
    },
    turnBackToFront: {
      fps: 12,
      loop: false,
      frames: []
    },
    sitToLie: {
      fps: 25,
      loop: false,
      frames: []
    },
    lieToSit: {
      fps: 25,
      loop: false,
      frames: []
    },
    walkRight: {
      fps: 25,
      loop: true,
      frames: []
    },
    walkLeft: {
      fps: 25,
      loop: true,
      frames: []
    },
    crawl: {
      fps: 10,
      loop: true,
      frames: []
    }
  }
};

const wait = (duration) => new Promise((resolve) => {
  window.setTimeout(resolve, duration);
});

const randomDuration = (minimum, spread) => minimum + Math.random() * spread;

function isPointInElement(clientX, clientY, element) {
  const rect = element.getBoundingClientRect();

  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

function getContainedImagePoint(clientX, clientY, imageElement) {
  const rect = imageElement.getBoundingClientRect();
  const imageAspect = imageElement.naturalWidth / imageElement.naturalHeight;
  const rectAspect = rect.width / rect.height;
  let renderedWidth = rect.width;
  let renderedHeight = rect.height;
  let offsetX = 0;
  let offsetY = 0;

  if (imageAspect > rectAspect) {
    renderedHeight = rect.width / imageAspect;
    offsetY = (rect.height - renderedHeight) / 2;
  } else {
    renderedWidth = rect.height * imageAspect;
    offsetX = (rect.width - renderedWidth) / 2;
  }

  const localX = clientX - rect.left - offsetX;
  const localY = clientY - rect.top - offsetY;

  if (localX < 0 || localY < 0 || localX > renderedWidth || localY > renderedHeight) {
    return null;
  }

  return {
    x: Math.floor((localX / renderedWidth) * imageElement.naturalWidth),
    y: Math.floor((localY / renderedHeight) * imageElement.naturalHeight)
  };
}

function isPointOnElement(clientX, clientY, element) {
  const target = document.elementFromPoint(clientX, clientY);

  return target === element || Boolean(target && element.contains(target));
}

class AnimationConfigLoader {
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

class FramePlayer {
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

class InteractionTracker {
  constructor() {
    this.lastInteractionAt = performance.now();
    this.waitingResolver = null;
  }

  record = () => {
    this.lastInteractionAt = performance.now();

    if (this.waitingResolver) {
      this.waitingResolver();
      this.waitingResolver = null;
    }
  };

  inactiveFor() {
    return performance.now() - this.lastInteractionAt;
  }

  hasInteractedSince(timestamp) {
    return this.lastInteractionAt > timestamp;
  }

  waitForInteraction() {
    return new Promise((resolve) => {
      this.waitingResolver = resolve;
    });
  }
}

class MousePassThroughController {
  constructor({ pet, handToolButton, catFrame, pokeHand, interactionTracker }) {
    this.pet = pet;
    this.handToolButton = handToolButton;
    this.catFrame = catFrame;
    this.pokeHand = pokeHand;
    this.interactionTracker = interactionTracker;
    this.alphaCanvas = document.createElement('canvas');
    this.alphaContext = this.alphaCanvas.getContext('2d', { willReadFrequently: true });
    this.enabled = true;
    this.isMouseLocked = false;
    this.isHandModeEnabled = false;
    this.isRequestingModeChange = false;
    this.lastPassThroughState = null;
  }

  bind() {
    window.addEventListener('mousemove', this.updateFromMouseEvent);
    window.addEventListener('mouseleave', this.handleMouseLeave);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('touchstart', this.interactionTracker.record);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('blur', this.handleBlur);
    this.handToolButton?.addEventListener('click', this.toggleHandMode);
    window.yukiCat.onPassThroughModeChanged(this.setEnabled);
    this.setPassThrough(true);
  }

  setEnabled = (enabled) => {
    this.enabled = enabled;
    this.pet?.classList.toggle('is-drag-mode', !enabled);

    if (this.isRequestingModeChange) {
      this.setHandMode(enabled);
      this.isRequestingModeChange = false;
    } else if (!enabled) {
      this.setHandMode(false);
      this.hidePokeHand();
    }

    this.setPassThrough(enabled);
  };

  handleMouseDown = () => {
    this.interactionTracker.record();
    this.isMouseLocked = true;
    this.setPassThrough(false);
    this.playPokeAnimation();
  };

  handleMouseUp = (event) => {
    this.isMouseLocked = false;
    this.updateFromMouseEvent(event);
  };

  handleBlur = () => {
    this.isMouseLocked = false;
    if (!this.isHandModeEnabled) {
      this.hidePokeHand();
    }
    this.setPassThrough(true);
  };

  handleMouseLeave = () => {
    if (!this.isHandModeEnabled) {
      this.hidePokeHand();
    }
    this.setPassThrough(true);
  };

  updateFromMouseEvent = (event) => {
    if (!this.enabled) {
      this.hidePokeHand();
      this.setPassThrough(false);
      return;
    }

    if (this.isMouseLocked) {
      this.setPassThrough(false);
      return;
    }

    const isOnCat = this.isPointOnVisibleCatPixel(event.clientX, event.clientY);
    const isOnHandTool = this.handToolButton && isPointOnElement(event.clientX, event.clientY, this.handToolButton);
    const shouldCaptureMouse = isOnHandTool || isOnCat;

    this.updatePokeHand(event, this.isHandModeEnabled || isOnCat);
    this.setPassThrough(!shouldCaptureMouse);
  };

  setPassThrough(shouldPassThrough) {
    const nextState = this.enabled ? shouldPassThrough : false;

    if (this.lastPassThroughState === nextState) {
      return;
    }

    this.lastPassThroughState = nextState;
    window.yukiCat.setIgnoreMouseEvents(nextState);
  }

  isPointOnVisibleCatPixel(clientX, clientY) {
    if (!this.alphaContext || !this.catFrame.complete || !this.catFrame.naturalWidth || !isPointInElement(clientX, clientY, this.catFrame)) {
      return false;
    }

    const point = getContainedImagePoint(clientX, clientY, this.catFrame);

    if (!point) {
      return false;
    }

    this.alphaCanvas.width = this.catFrame.naturalWidth;
    this.alphaCanvas.height = this.catFrame.naturalHeight;
    this.alphaContext.clearRect(0, 0, this.alphaCanvas.width, this.alphaCanvas.height);
    this.alphaContext.drawImage(this.catFrame, 0, 0);

    const [, , , alpha] = this.alphaContext.getImageData(point.x, point.y, 1, 1).data;

    return alpha > 24;
  }

  updatePokeHand(event, isOnCat) {
    if (!this.enabled || !this.pokeHand) {
      return;
    }

    this.pokeHand.style.left = `${event.clientX}px`;
    this.pokeHand.style.top = `${event.clientY}px`;
    this.pokeHand.classList.toggle('is-visible', isOnCat);
  }

  hidePokeHand() {
    this.pokeHand?.classList.remove('is-visible');
  }

  toggleHandMode = () => {
    const nextMode = !this.isHandModeEnabled;

    this.isRequestingModeChange = true;
    this.setHandMode(nextMode);
    window.yukiCat.setPassThroughMode(nextMode);
  };

  setHandMode(isEnabled) {
    this.isHandModeEnabled = isEnabled;
    this.handToolButton?.classList.toggle('is-active', isEnabled);
    this.handToolButton?.setAttribute('aria-label', isEnabled ? '隐藏手' : '显示手');
    this.handToolButton?.setAttribute('title', isEnabled ? '隐藏手' : '显示手');

    if (isEnabled) {
      this.showPokeHandAtDefaultPosition();
    } else {
      this.hidePokeHand();
    }
  }

  showPokeHandAtDefaultPosition() {
    if (!this.pokeHand) {
      return;
    }

    const rect = this.catFrame.getBoundingClientRect();
    this.pokeHand.style.left = `${Math.round(rect.left + rect.width * 0.68)}px`;
    this.pokeHand.style.top = `${Math.round(rect.top + rect.height * 0.44)}px`;
    this.pokeHand.classList.add('is-visible');
  }

  playPokeAnimation() {
    if (!this.pokeHand?.classList.contains('is-visible')) {
      return;
    }

    this.pokeHand.classList.remove('is-poking');
    void this.pokeHand.offsetWidth;
    this.pokeHand.classList.add('is-poking');
    window.setTimeout(() => {
      this.pokeHand?.classList.remove('is-poking');
    }, timings.pokeAnimation);
  }
}

class CatBehavior {
  constructor({ catElement, player, interactionTracker }) {
    this.catElement = catElement;
    this.player = player;
    this.interactionTracker = interactionTracker;
    this.currentSitDirection = 1;
  }

  async start() {
    this.setSittingPose(1);
    await wait(timings.initialPause);

    while (true) {
      if (this.shouldSleep()) {
        await this.enterLongIdleLie();
        continue;
      }

      await wait(Math.min(randomDuration(timings.behaviorMinPause, timings.behaviorRandomPause), timings.longIdle - this.interactionTracker.inactiveFor()));

      if (this.shouldSleep()) {
        continue;
      }

      await this.blink();
      await wait(randomDuration(timings.postBlinkMinPause, timings.postBlinkRandomPause));

      if (this.shouldSleep()) {
        continue;
      }

      await this.playRandomAwakeBehavior();
    }
  }

  shouldSleep() {
    return this.interactionTracker.inactiveFor() >= timings.longIdle;
  }

  setSittingPose(direction = this.currentSitDirection) {
    this.currentSitDirection = direction < 0 ? -1 : 1;
    this.catElement.classList.remove('is-crawling');
    this.catElement.classList.remove('is-facing-left');
    this.player.setFrame(this.player.getFirstFrame(this.currentSitDirection < 0 ? 'sitLeft' : 'sitRight'), 'sit');
  }

  async blink() {
    if (this.player.hasSequenceFrames('blink', 2)) {
      await this.player.playOnce('blink');
      this.setSittingPose();
    }
  }

  async turnSideToFrontAndBack() {
    if (!this.player.hasSequenceFrames('turnSideToFront', 2) || !this.player.hasSequenceFrames('turnFrontToSide', 2)) {
      this.setSittingPose();
      return;
    }

    await this.player.playOnce('turnSideToFront');
    await wait(this.poseHoldDuration());
    await this.player.playOnce('turnFrontToSide');
    this.setSittingPose();
  }

  async turnSideToBackAndReturn() {
    if (!this.player.hasSequenceFrames('turnBackToSide', 2) || !this.player.hasSequenceFrames('turnSideToBack', 2)) {
      return;
    }

    await this.player.playOnce('turnSideToBack');
    await wait(this.poseHoldDuration());
    await this.player.playOnce('turnBackToSide');
    this.setSittingPose();
  }

  async turnFrontToBackAndReturn() {
    const hasRequiredFrames = [
      'turnSideToFront',
      'turnFrontToSide',
      'turnFrontToBack',
      'turnBackToFront'
    ].every((name) => this.player.hasSequenceFrames(name, 2));

    if (!hasRequiredFrames) {
      return;
    }

    await this.player.playOnce('turnSideToFront');
    await wait(timings.frontPause);
    await this.player.playOnce('turnFrontToBack');
    await wait(this.poseHoldDuration());
    await this.player.playOnce('turnBackToFront');
    await wait(timings.frontPause);
    await this.player.playOnce('turnFrontToSide');
    this.setSittingPose();
  }

  async walkShortDistance() {
    const direction = Math.random() > 0.5 ? 1 : -1;
    const walkAnimation = direction > 0 ? 'walkRight' : 'walkLeft';
    const walkSequence = this.player.getSequence(walkAnimation);
    const hasWalkFrames = walkSequence.frames.length > 1;
    const distance = hasWalkFrames ? 120 + Math.round(Math.random() * 72) : 72 + Math.round(Math.random() * 52);
    const duration = hasWalkFrames ? Math.round((walkSequence.frames.length / walkSequence.fps) * 1000) : 1200;
    const steps = Math.round(duration / timings.movementStep);
    const stepX = (distance / steps) * direction;
    let animation = Promise.resolve();

    this.catElement.classList.toggle('is-facing-left', direction < 0 && !hasWalkFrames);
    this.catElement.classList.add('is-crawling');

    if (hasWalkFrames) {
      animation = this.player.playOnce(walkAnimation);
    } else if (this.player.hasSequenceFrames('crawl', 2)) {
      this.player.playLoop('crawl');
    }

    await Promise.all([animation, this.moveBySteps(steps, stepX)]);

    this.setSittingPose(direction);
  }

  async moveBySteps(steps, stepX) {
    for (let index = 0; index < steps; index += 1) {
      window.yukiCat.moveBy(stepX, 0);
      await wait(timings.movementStep);
    }
  }

  async enterLongIdleLie() {
    const sleepStartedAt = performance.now();

    if (this.player.hasSequenceFrames('sitToLie', 2)) {
      await this.player.playOnce('sitToLie');
    } else {
      this.player.setFrame(this.player.getLastFrame('sitToLie'), 'lie');
    }

    if (!this.interactionTracker.hasInteractedSince(sleepStartedAt)) {
      await this.interactionTracker.waitForInteraction();
      this.interactionTracker.record();
    }

    if (this.player.hasSequenceFrames('lieToSit', 2)) {
      await this.player.playOnce('lieToSit');
    }

    this.setSittingPose();
  }

  async playRandomAwakeBehavior() {
    const roll = Math.random();

    if (roll > 0.72) {
      await this.turnFrontToBackAndReturn();
    } else if (roll > 0.48) {
      await this.turnSideToFrontAndBack();
    } else if (roll > 0.24) {
      await this.turnSideToBackAndReturn();
    } else {
      await this.walkShortDistance();
    }
  }

  poseHoldDuration() {
    return 5500 + Math.random() * 3500;
  }
}

async function start() {
  const config = await AnimationConfigLoader.load();
  const interactionTracker = new InteractionTracker();
  const mousePassThrough = new MousePassThroughController({
    pet: elements.pet,
    handToolButton: elements.handToolButton,
    catFrame: elements.catFrame,
    pokeHand: elements.pokeHand,
    interactionTracker
  });
  const player = new FramePlayer({
    imageElement: elements.catFrame,
    animationElement: elements.cat,
    config
  });
  const behavior = new CatBehavior({
    catElement: elements.cat,
    player,
    interactionTracker
  });

  mousePassThrough.bind();
  behavior.start();
}

start();
