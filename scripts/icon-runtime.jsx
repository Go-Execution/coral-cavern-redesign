import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import {
  FiArrowDown,
  FiArrowRight,
  FiArrowUpRight,
  FiCheck,
  FiHeart,
  FiMenu,
  FiMinus,
  FiPause,
  FiPlay,
  FiPlus,
  FiSearch,
  FiShield,
  FiShoppingBag,
  FiStar,
  FiX
} from 'react-icons/fi';
import { FaCircle, FaHeart } from 'react-icons/fa6';

const iconNames = new Map([
  ['arrow-down', FiArrowDown],
  ['arrow-right', FiArrowRight],
  ['arrow-up-right', FiArrowUpRight],
  ['bag', FiShoppingBag],
  ['check', FiCheck],
  ['circle-fill', FaCircle],
  ['close', FiX],
  ['heart', FiHeart],
  ['heart-fill', FaHeart],
  ['menu', FiMenu],
  ['minus', FiMinus],
  ['pause', FiPause],
  ['play', FiPlay],
  ['plus', FiPlus],
  ['search', FiSearch],
  ['shield', FiShield],
  ['star', FiStar]
]);

function iconMarkup(Icon) {
  return renderToStaticMarkup(<Icon aria-hidden="true" focusable="false" />);
}

function makeIcon(name, className = '') {
  const Icon = iconNames.get(name);
  if (!Icon) return null;
  const span = document.createElement('span');
  span.className = `react-icon ${className}`.trim();
  span.dataset.icon = name;
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = iconMarkup(Icon);
  span.dataset.iconMounted = 'true';
  return span;
}

function mountSlot(slot) {
  if (slot.dataset.iconMounted === 'true') return;
  const Icon = iconNames.get(slot.dataset.icon);
  if (!Icon) return;
  slot.classList.add('react-icon');
  slot.setAttribute('aria-hidden', 'true');
  slot.innerHTML = iconMarkup(Icon);
  slot.dataset.iconMounted = 'true';
}

function addLeadingIcon(target, name, className) {
  if (target.querySelector(`:scope > .${className}`)) return;
  const icon = makeIcon(name, className);
  if (icon) target.prepend(icon);
}

function enhanceFaq(details) {
  const summary = details.querySelector(':scope > summary');
  if (!summary || summary.dataset.reactToggle === 'true') return;
  const indicator = makeIcon(details.open ? 'minus' : 'plus', 'faq-toggle-icon');
  if (!indicator) return;
  summary.append(indicator);
  summary.dataset.reactToggle = 'true';
  details.addEventListener('toggle', () => {
    const Icon = iconNames.get(details.open ? 'minus' : 'plus');
    indicator.innerHTML = iconMarkup(Icon);
  });
}

function allWithin(root, selector) {
  return [
    ...(root.matches?.(selector) ? [root] : []),
    ...root.querySelectorAll(selector)
  ];
}

function enhance(root = document) {
  allWithin(root, '[data-icon]').forEach(mountSlot);
  allWithin(root, '.hero-proof > span,.promise-points > span').forEach(item => addLeadingIcon(item, 'check', 'leading-check-icon'));
  allWithin(root, '[data-cart]').forEach(item => addLeadingIcon(item, 'bag', 'leading-bag-icon'));
  allWithin(root, '.faq-list details').forEach(enhanceFaq);
}

document.documentElement.classList.add('react-icons-ready');
enhance();

const observer = new MutationObserver(records => {
  if (records.some(record => [...record.addedNodes].some(node => node.nodeType === Node.ELEMENT_NODE))) {
    enhance(document);
  }
});

observer.observe(document.body, { childList: true, subtree: true });
