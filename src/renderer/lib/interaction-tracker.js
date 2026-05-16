export class InteractionTracker {
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

  waitForInteractionOrTimeout(duration) {
    return new Promise((resolve) => {
      const timeoutId = window.setTimeout(() => {
        if (this.waitingResolver === onInteraction) {
          this.waitingResolver = null;
        }

        resolve(false);
      }, duration);

      const onInteraction = () => {
        window.clearTimeout(timeoutId);
        resolve(true);
      };

      this.waitingResolver = onInteraction;
    });
  }
}
