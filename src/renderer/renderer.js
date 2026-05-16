import { AnimationConfigLoader } from './lib/animation-config-loader.js';
import { CatBehavior } from './lib/cat-behavior.js';
import { FramePlayer } from './lib/frame-player.js';
import { InteractionTracker } from './lib/interaction-tracker.js';
import { MousePassThroughController } from './lib/mouse-pass-through-controller.js';

const elements = {
  pet: document.querySelector('.pet'),
  handToolButton: document.querySelector('.hand-tool-button'),
  cat: document.querySelector('.cat'),
  catFrame: document.querySelector('.cat-frame'),
  pokeHand: document.querySelector('.poke-hand')
};

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
  window.yukiCat.onDebugAction((action) => {
    const result = behavior.queueDebugAction(action);
    window.yukiCat.sendDebugActionResult(result);
  });
  behavior.start();
}

start();
