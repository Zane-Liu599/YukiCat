const closeButton = document.querySelector('.close-button');
const cat = document.querySelector('.cat');
const catFrame = document.querySelector('.cat-frame');

const fallbackConfig = {
  defaultFrame: './assets/yuki-sit-right.png',
  sequences: {
    idle: {
      fps: 6,
      loop: true,
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

closeButton.addEventListener('click', () => {
  window.yukiCat.quit();
});

const wait = (duration) => new Promise((resolve) => {
  window.setTimeout(resolve, duration);
});

function poseHoldDuration() {
  return 5500 + Math.random() * 3500;
}

async function loadConfig() {
  try {
    const response = await fetch('./animations.json', { cache: 'no-store' });

    if (!response.ok) {
      return fallbackConfig;
    }

    const config = await response.json();
    return {
      ...fallbackConfig,
      ...config,
      sequences: {
        ...fallbackConfig.sequences,
        ...(config.sequences ?? {})
      }
    };
  } catch {
    return fallbackConfig;
  }
}

function preloadFrame(src) {
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

async function preloadSequences(config) {
  const entries = Object.entries(config.sequences);
  const loadedSequences = {};

  await Promise.all(entries.map(async ([name, sequence]) => {
    const frames = await Promise.all((sequence.frames ?? []).map(preloadFrame));
    loadedSequences[name] = {
      ...sequence,
      frames: frames.filter(Boolean)
    };
  }));

  const defaultFrame = await preloadFrame(config.defaultFrame);

  return {
    ...config,
    defaultFrame: defaultFrame ?? fallbackConfig.defaultFrame,
    sequences: loadedSequences
  };
}

class FramePlayer {
  constructor(imageElement, config) {
    this.imageElement = imageElement;
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

  stop() {
    this.token += 1;
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
    let index = 0;

    cat.dataset.animation = name;

    do {
      for (index = 0; index < sequence.frames.length; index += 1) {
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

async function blink(player) {
  const hasBlinkFrames = player.getSequence('blink').frames.length > 1;

  if (hasBlinkFrames) {
    cat.classList.add('hide-css-blink');
    await player.playOnce('blink');
    cat.classList.remove('hide-css-blink');
    player.playLoop('idle');
    return;
  }

  cat.classList.add('blink-now');
  await wait(240);
  cat.classList.remove('blink-now');
}

async function turnPose(player) {
  const hasForwardFrames = player.getSequence('turnFrontToSide').frames.length > 1;
  const hasBackFrames = player.getSequence('turnSideToFront').frames.length > 1;

  if (hasBackFrames) {
    await player.playOnce('turnSideToFront');
  } else {
    cat.classList.add('fallback-turn');
    await wait(900);
  }

  await wait(poseHoldDuration());

  if (hasForwardFrames) {
    await player.playOnce('turnFrontToSide');
  } else {
    cat.classList.remove('fallback-turn');
    await wait(900);
  }

  player.playLoop('idle');
}

async function turnBackPose(player) {
  const hasBackToSideFrames = player.getSequence('turnBackToSide').frames.length > 1;
  const hasSideToBackFrames = player.getSequence('turnSideToBack').frames.length > 1;

  if (!hasBackToSideFrames || !hasSideToBackFrames) {
    return;
  }

  await player.playOnce('turnSideToBack');
  await wait(poseHoldDuration());
  await player.playOnce('turnBackToSide');
  player.playLoop('idle');
}

async function turnFrontBackPose(player) {
  const hasSideToFrontFrames = player.getSequence('turnSideToFront').frames.length > 1;
  const hasFrontToSideFrames = player.getSequence('turnFrontToSide').frames.length > 1;
  const hasFrontToBackFrames = player.getSequence('turnFrontToBack').frames.length > 1;
  const hasBackToFrontFrames = player.getSequence('turnBackToFront').frames.length > 1;

  if (!hasSideToFrontFrames || !hasFrontToSideFrames || !hasFrontToBackFrames || !hasBackToFrontFrames) {
    return;
  }

  await player.playOnce('turnSideToFront');
  await wait(1200);
  await player.playOnce('turnFrontToBack');
  await wait(poseHoldDuration());
  await player.playOnce('turnBackToFront');
  await wait(1200);
  await player.playOnce('turnFrontToSide');
  player.playLoop('idle');
}

async function lieDownPose(player) {
  const hasSitToLieFrames = player.getSequence('sitToLie').frames.length > 1;
  const hasLieToSitFrames = player.getSequence('lieToSit').frames.length > 1;

  if (!hasSitToLieFrames || !hasLieToSitFrames) {
    return;
  }

  await player.playOnce('sitToLie');
  await wait(poseHoldDuration());
  await player.playOnce('lieToSit');
  player.playLoop('idle');
}

async function crawlShortDistance(player) {
  const direction = Math.random() > 0.5 ? 1 : -1;
  const walkAnimation = direction > 0 ? 'walkRight' : 'walkLeft';
  const walkSequence = player.getSequence(walkAnimation);
  const hasWalkFrames = walkSequence.frames.length > 1;
  const distance = hasWalkFrames ? 120 + Math.round(Math.random() * 72) : 72 + Math.round(Math.random() * 52);
  const duration = hasWalkFrames ? Math.round((walkSequence.frames.length / walkSequence.fps) * 1000) : 1200;
  const steps = Math.round(duration / 24);
  const stepX = (distance / steps) * direction;
  const hasCrawlFrames = player.getSequence('crawl').frames.length > 1;
  let animation = Promise.resolve();

  cat.classList.toggle('is-facing-left', direction < 0 && !hasWalkFrames);
  cat.classList.add('is-crawling');

  if (hasWalkFrames) {
    animation = player.playOnce(walkAnimation);
  } else if (hasCrawlFrames) {
    player.playLoop('crawl');
  }

  const movement = (async () => {
    for (let index = 0; index < steps; index += 1) {
      window.yukiCat.moveBy(stepX, 0);
      await wait(24);
    }
  })();

  await Promise.all([animation, movement]);

  cat.classList.remove('is-crawling');
  cat.classList.remove('is-facing-left');
  player.playLoop('idle');
}

async function behaviorLoop(player) {
  player.playLoop('idle');
  await wait(1800);

  while (true) {
    await wait(3600 + Math.random() * 3200);
    await blink(player);
    await wait(2200 + Math.random() * 4200);

    const roll = Math.random();

    if (roll > 0.82) {
      await lieDownPose(player);
    } else if (roll > 0.66) {
      await turnFrontBackPose(player);
    } else if (roll > 0.48) {
      await turnPose(player);
    } else if (roll > 0.28) {
      await turnBackPose(player);
    } else {
      await crawlShortDistance(player);
    }
  }
}

async function start() {
  const config = await preloadSequences(await loadConfig());
  const player = new FramePlayer(catFrame, config);

  if (player.getSequence('blink').frames.length > 1) {
    cat.classList.add('has-frame-blink');
  }

  behaviorLoop(player);
}

start();
