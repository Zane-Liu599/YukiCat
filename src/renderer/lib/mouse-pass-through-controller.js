import { timings } from './constants.js';
import { getContainedImagePoint, isPointInElement, isPointOnElement } from './utils.js';

export class MousePassThroughController {
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
