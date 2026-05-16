export const wait = (duration) => new Promise((resolve) => {
  window.setTimeout(resolve, duration);
});

export const randomDuration = (minimum, spread) => minimum + Math.random() * spread;

export function isPointInElement(clientX, clientY, element) {
  const rect = element.getBoundingClientRect();

  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

export function getContainedImagePoint(clientX, clientY, imageElement) {
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

export function isPointOnElement(clientX, clientY, element) {
  const target = document.elementFromPoint(clientX, clientY);

  return target === element || Boolean(target && element.contains(target));
}
