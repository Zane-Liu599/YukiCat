import { behaviorChances, timings } from './constants.js';
import { randomDuration, wait } from './utils.js';

export class CatBehavior {
  constructor({ catElement, player, interactionTracker }) {
    this.catElement = catElement;
    this.player = player;
    this.interactionTracker = interactionTracker;
    this.currentSitDirection = 1;
    this.nextCrawlRestAt = 0;
    this.debugActionQueue = [];
    this.debugActionResolver = null;
  }

  async start() {
    this.setSittingPose(1);
    await this.waitForDebugActionOrTimeout(timings.initialPause);

    while (true) {
      await this.runQueuedDebugActions();

      if (this.shouldEnterCrawlRest()) {
        await this.enterLongIdleCrawlRest();
        continue;
      }

      await this.waitForDebugActionOrTimeout(
        Math.min(randomDuration(timings.behaviorMinPause, timings.behaviorRandomPause), this.timeUntilCrawlRest())
      );
      await this.runQueuedDebugActions();

      if (this.shouldEnterCrawlRest()) {
        continue;
      }

      await this.blink();
      await this.waitForDebugActionOrTimeout(randomDuration(timings.postBlinkMinPause, timings.postBlinkRandomPause));
      await this.runQueuedDebugActions();

      if (this.shouldEnterCrawlRest()) {
        continue;
      }

      await this.playRandomAwakeBehavior();
    }
  }

  queueDebugAction(action) {
    const normalizedAction = CatBehavior.normalizeDebugAction(action);
    const debugAction = this.debugActionMap[normalizedAction] ? normalizedAction : this.resolveSequenceDebugAction(action);

    if (!debugAction) {
      return {
        ok: false,
        message: `unknown action "${action}". Try a behavior action or animation sequence name.`
      };
    }

    this.debugActionQueue.push(debugAction);
    this.interactionTracker.record();

    if (this.debugActionResolver) {
      this.debugActionResolver();
      this.debugActionResolver = null;
    }

    return {
      ok: true,
      message: `queued "${debugAction.replace(/^sequence:/, '')}"`
    };
  }

  async runQueuedDebugActions() {
    while (this.debugActionQueue.length > 0) {
      const action = this.debugActionQueue.shift();
      await this.runDebugAction(action);
    }
  }

  async runDebugAction(action) {
    this.player.stop();

    if (action.startsWith('sequence:')) {
      await this.playDebugSequence(action.slice('sequence:'.length));
      return;
    }

    await this.debugActionMap[action]();
  }

  async playDebugSequence(name) {
    if (!this.player.hasSequenceFrames(name, 1)) {
      return;
    }

    const sequence = this.player.getSequence(name);

    if (sequence.frames.length > 1) {
      await this.player.playOnce(name);
      this.player.setFrame(sequence.frames[sequence.frames.length - 1], name);
      return;
    }

    this.player.setFrame(sequence.frames[0], name);
  }

  resolveSequenceDebugAction(action) {
    const key = String(action ?? '').trim().toLowerCase().replace(/[-_\s]/g, '');
    const sequenceName = Object.keys(this.player.config.sequences).find((name) => name.toLowerCase() === key);

    return sequenceName ? `sequence:${sequenceName}` : null;
  }

  waitForDebugActionOrTimeout(duration) {
    if (this.debugActionQueue.length > 0) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      const timeoutId = window.setTimeout(() => {
        if (this.debugActionResolver === onDebugAction) {
          this.debugActionResolver = null;
        }

        resolve(false);
      }, duration);

      const onDebugAction = () => {
        window.clearTimeout(timeoutId);
        resolve(true);
      };

      this.debugActionResolver = onDebugAction;
    });
  }

  get debugActionMap() {
    return {
      sit: async () => this.setSittingPose(),
      'sit-left': () => this.turnToSittingDirection(-1),
      'sit-right': () => this.turnToSittingDirection(1),
      'turn-left': () => this.turnToSittingDirection(-1),
      'turn-right': () => this.turnToSittingDirection(1),
      'turn-around': () => this.turnToSittingDirection(this.currentSitDirection * -1),
      idle: () => this.playRandomRightSittingIdle({ allowTurn: true }),
      idle1: () => this.playRightSittingIdle('idle1', { allowTurn: true }),
      idle2: () => this.playRightSittingIdle('idle2', { allowTurn: true }),
      blink: () => this.blink(),
      front: () => this.turnSideToFrontAndBack(),
      back: () => this.turnSideToBackAndReturn(),
      'front-back': () => this.turnFrontToBackAndReturn(),
      walk: () => this.walkShortDistance(),
      crawl: () => this.enterCrawlPose(),
      'crawl-rest': () => this.enterLongIdleCrawlRest(),
      lie: () => this.enterLiePose(),
      'leave-crawl': () => this.leaveCrawlPose(),
      'leave-lie': () => this.leaveLiePose(),
      random: () => this.playRandomAwakeBehavior()
    };
  }

  static normalizeDebugAction(action) {
    const normalized = String(action ?? '').trim().toLowerCase().replace(/_/g, '-');
    const aliases = {
      left: 'sit-left',
      right: 'sit-right',
      turnleft: 'turn-left',
      turnright: 'turn-right',
      turnaround: 'turn-around',
      turnfront: 'front',
      turn: 'front',
      turnback: 'back',
      frontback: 'front-back',
      turnfrontback: 'front-back',
      'idle-1': 'idle1',
      'idle-2': 'idle2',
      sleep: 'lie',
      rest: 'crawl-rest',
      leave: 'leave-lie'
    };

    return aliases[normalized] ?? normalized;
  }

  shouldEnterCrawlRest() {
    return this.shouldForceSleep() || (this.interactionTracker.inactiveFor() >= timings.longIdle && performance.now() >= this.nextCrawlRestAt);
  }

  shouldForceSleep() {
    return this.interactionTracker.inactiveFor() >= timings.forcedSleepIdle;
  }

  timeUntilCrawlRest() {
    return Math.max(0, timings.longIdle - this.interactionTracker.inactiveFor(), this.nextCrawlRestAt - performance.now());
  }

  setSittingPose(direction = this.currentSitDirection) {
    this.currentSitDirection = direction < 0 ? -1 : 1;
    this.catElement.classList.remove('is-crawling');
    this.setVisualDirection(this.currentSitDirection, { mirror: false });
    this.player.setFrame(this.player.getFirstFrame(this.currentSitDirection < 0 ? 'sitLeft' : 'sitRight'), 'sit');
  }

  async turnToSittingDirection(direction) {
    const nextDirection = direction < 0 ? -1 : 1;

    if (nextDirection === this.currentSitDirection) {
      this.setSittingPose(nextDirection);
      return;
    }

    const sequenceName = nextDirection < 0 ? 'sitRightToLeft' : 'sitLeftToRight';

    this.catElement.classList.remove('is-crawling');
    this.setVisualDirection(this.currentSitDirection, { mirror: false });

    if (this.player.hasSequenceFrames(sequenceName, 2)) {
      await this.player.playOnce(sequenceName);
    }

    this.setSittingPose(nextDirection);
  }

  setVisualDirection(direction = this.currentSitDirection, { mirror = false } = {}) {
    const isFacingLeft = direction < 0;

    this.catElement.classList.toggle('is-facing-left', isFacingLeft);
    this.catElement.classList.toggle('is-mirrored', isFacingLeft && mirror);
  }

  getDirectionalSequenceName(baseName) {
    const suffix = this.currentSitDirection < 0 ? 'Left' : 'Right';
    const directionalName = `${baseName}${suffix}`;

    return this.player.hasSequenceFrames(directionalName, 2) ? directionalName : baseName;
  }

  shouldMirrorSequence(sequenceName) {
    return this.currentSitDirection < 0 && !sequenceName.endsWith('Left');
  }

  async playDirectionalSequence(baseName, { minimum = 2, holdLast = false } = {}) {
    const sequenceName = this.getDirectionalSequenceName(baseName);

    if (!this.player.hasSequenceFrames(sequenceName, minimum)) {
      return false;
    }

    this.setVisualDirection(this.currentSitDirection, { mirror: this.shouldMirrorSequence(sequenceName) });
    await this.player.playOnce(sequenceName);

    if (holdLast) {
      this.player.setFrame(this.player.getLastFrame(sequenceName), baseName);
    }

    return true;
  }

  async blink() {
    if (await this.playDirectionalSequence('blink')) {
      this.setSittingPose();
    }
  }

  getAvailableRightIdleSequences() {
    return ['idle1', 'idle2'].filter((name) => this.player.hasSequenceFrames(name, 2));
  }

  async playRandomRightSittingIdle({ allowTurn = false } = {}) {
    const sequences = this.getAvailableRightIdleSequences();

    if (sequences.length === 0) {
      return false;
    }

    const sequenceName = sequences[Math.floor(Math.random() * sequences.length)];

    return this.playRightSittingIdle(sequenceName, { allowTurn });
  }

  async playRightSittingIdle(sequenceName, { allowTurn = false } = {}) {
    if (!this.player.hasSequenceFrames(sequenceName, 2)) {
      return false;
    }

    if (this.currentSitDirection < 0) {
      if (!allowTurn) {
        return false;
      }

      await this.turnToSittingDirection(1);
    }

    this.currentSitDirection = 1;
    this.catElement.classList.remove('is-crawling');
    this.setVisualDirection(1, { mirror: false });
    await this.player.playOnce(sequenceName);
    this.setSittingPose(1);

    return true;
  }

  async turnSideToFrontAndBack() {
    if (!this.player.hasSequenceFrames('turnSideToFront', 2) || !this.player.hasSequenceFrames('turnFrontToSide', 2)) {
      this.setSittingPose();
      return;
    }

    await this.playDirectionalSequence('turnSideToFront');
    await wait(this.poseHoldDuration());
    await this.playDirectionalSequence('turnFrontToSide');
    this.setSittingPose();
  }

  async turnSideToBackAndReturn() {
    if (!this.player.hasSequenceFrames('turnBackToSide', 2) || !this.player.hasSequenceFrames('turnSideToBack', 2)) {
      return;
    }

    await this.playDirectionalSequence('turnSideToBack');
    await wait(this.poseHoldDuration());
    await this.playDirectionalSequence('turnBackToSide');
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

    await this.playDirectionalSequence('turnSideToFront');
    await wait(timings.frontPause);
    await this.playDirectionalSequence('turnFrontToBack');
    await wait(this.poseHoldDuration());
    await this.playDirectionalSequence('turnBackToFront');
    await wait(timings.frontPause);
    await this.playDirectionalSequence('turnFrontToSide');
    this.setSittingPose();
  }

  async walkShortDistance() {
    const direction = this.currentSitDirection;
    const walkAnimation = direction > 0 ? 'walkRight' : 'walkLeft';
    const walkSequence = this.player.getSequence(walkAnimation);
    const hasWalkFrames = walkSequence.frames.length > 1;

    this.currentSitDirection = direction;
    this.setVisualDirection(direction, { mirror: direction < 0 && !hasWalkFrames });
    this.catElement.classList.add('is-crawling');

    if (hasWalkFrames) {
      if (direction > 0 && this.player.hasSequenceFrames('idleToWalkRight', 2)) {
        await this.player.playOnce('idleToWalkRight');
      }
      await this.player.playOnce(walkAnimation);
      this.setSittingPose(direction);
      return;
    } else if (this.player.hasSequenceFrames('crawl', 2)) {
      this.player.playLoop('crawl');
    }

    await wait(1200);

    this.setSittingPose(direction);
  }

  async playFramesOnce(frames, fps, animationName) {
    const frameDuration = 1000 / (fps || 8);

    for (const frame of frames) {
      this.player.setFrame(frame, animationName);
      await wait(frameDuration);
    }
  }

  async enterLongIdleCrawlRest() {
    const crawlStartedAt = performance.now();

    const didEnterCrawl = await this.enterCrawlPose();

    if (!didEnterCrawl) {
      return;
    }

    if (this.interactionTracker.hasInteractedSince(crawlStartedAt)) {
      await this.leaveCrawlPose();
      return;
    }

    const interactedWhileCrawling = await this.interactionTracker.waitForInteractionOrTimeout(
      randomDuration(timings.crawlRestMinPause, timings.crawlRestRandomPause)
    );

    if (interactedWhileCrawling || this.interactionTracker.hasInteractedSince(crawlStartedAt)) {
      await this.leaveCrawlPose();
      return;
    }

    if (!this.player.hasSequenceFrames(this.getDirectionalSequenceName('crawlToLie'), 2)) {
      await this.leaveCrawlPose();
      return;
    }

    await this.playDirectionalSequence('crawlToLie', { holdLast: true });

    const interactedBeforeDecision = await this.interactionTracker.waitForInteractionOrTimeout(
      randomDuration(timings.lieDecisionMinPause, timings.lieDecisionRandomPause)
    );

    if (interactedBeforeDecision || this.interactionTracker.hasInteractedSince(crawlStartedAt)) {
      await this.leaveLiePose();
      return;
    }

    const shouldSleep = this.shouldForceSleep() || Math.random() < behaviorChances.sleepAfterCrawlToLie;

    if (!shouldSleep) {
      await this.leaveLiePose();
      this.deferNextCrawlRest();
      return;
    }

    if (!this.interactionTracker.hasInteractedSince(crawlStartedAt)) {
      await this.interactionTracker.waitForInteraction();
      this.interactionTracker.record();
    }

    await this.leaveLiePose();
  }

  deferNextCrawlRest() {
    this.nextCrawlRestAt = performance.now() + randomDuration(timings.behaviorMinPause, timings.behaviorRandomPause);
  }

  async enterCrawlPose() {
    this.catElement.classList.add('is-crawling');

    if (await this.playDirectionalSequence('crawl', { holdLast: true })) {
      return true;
    }

    this.setSittingPose();
    return false;
  }

  async enterLiePose() {
    const didEnterCrawl = await this.enterCrawlPose();

    if (!didEnterCrawl) {
      return;
    }

    await this.playDirectionalSequence('crawlToLie', { holdLast: true });
  }

  async leaveCrawlPose() {
    await this.playDirectionalSequence('crawlToSit');

    this.setSittingPose();
  }

  async leaveLiePose() {
    if (this.player.hasSequenceFrames(this.getDirectionalSequenceName('lieToCrawl'), 2)) {
      await this.playDirectionalSequence('lieToCrawl');
      await this.leaveCrawlPose();
      return;
    }

    await this.playDirectionalSequence('lieToSit');

    this.setSittingPose();
  }

  async playRandomAwakeBehavior() {
    await this.turnToSittingDirection(Math.random() > 0.5 ? 1 : -1);
    await wait(250);

    const roll = Math.random();

    if (this.currentSitDirection > 0 && roll > 0.76 && await this.playRandomRightSittingIdle()) {
      return;
    }

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
