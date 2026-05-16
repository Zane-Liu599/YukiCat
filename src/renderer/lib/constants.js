export const timings = {
  longIdle: 45000,
  forcedSleepIdle: 120000,
  initialPause: 1800,
  behaviorMinPause: 3600,
  behaviorRandomPause: 3200,
  postBlinkMinPause: 2200,
  postBlinkRandomPause: 4200,
  crawlRestMinPause: 4500,
  crawlRestRandomPause: 3500,
  lieDecisionMinPause: 6500,
  lieDecisionRandomPause: 8500,
  frontPause: 1200,
  movementStep: 24,
  pokeAnimation: 180
};

export const behaviorChances = {
  sleepAfterCrawlToLie: 0.42
};

export const fallbackConfig = {
  defaultFrame: './assets/frames/sit-right/sit_right_00.png',
  sequences: {
    idle: {
      fps: 6,
      loop: true,
      frames: ['./assets/frames/sit-right/sit_right_00.png']
    },
    idle1: {
      fps: 25,
      loop: false,
      frames: []
    },
    idle2: {
      fps: 25,
      loop: false,
      frames: []
    },
    idleFromWalk: {
      fps: 25,
      loop: false,
      frames: []
    },
    idleToWalkRight: {
      fps: 25,
      loop: false,
      frames: []
    },
    sitRight: {
      fps: 2,
      loop: false,
      frames: ['./assets/frames/sit-right/sit_right_00.png']
    },
    sitLeft: {
      fps: 2,
      loop: false,
      frames: ['./assets/frames/sit-left/sit_left_00.png']
    },
    sitRightToLeft: {
      fps: 25,
      loop: false,
      frames: []
    },
    sitLeftToRight: {
      fps: 25,
      loop: false,
      frames: []
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
      loop: false,
      frames: []
    },
    walkLeft: {
      fps: 25,
      loop: false,
      frames: []
    },
    crawl: {
      fps: 10,
      loop: true,
      frames: []
    },
    crawlToSit: {
      fps: 25,
      loop: false,
      frames: []
    },
    crawlToLie: {
      fps: 25,
      loop: false,
      frames: []
    },
    lieToCrawl: {
      fps: 25,
      loop: false,
      frames: []
    }
  }
};
