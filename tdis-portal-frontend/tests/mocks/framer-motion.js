import React from 'react';
import PropTypes from 'prop-types';

const Forward = (props) => React.createElement('div', props, props.children);
Forward.propTypes = { children: PropTypes.node };

const ForwardForm = (props) => React.createElement('form', props, props.children);
ForwardForm.propTypes = { children: PropTypes.node };

const ForwardAnchor = (props) => React.createElement('a', props, props.children);
ForwardAnchor.propTypes = { children: PropTypes.node };

export const motion = new Proxy(Forward, {
  get(_, prop) {
    if (prop === 'button') return Forward;
    if (prop === 'div') return Forward;
    if (prop === 'form') return ForwardForm;
    if (prop === 'a') return ForwardAnchor;
    return Forward;
  },
});

export const AnimatePresence = (props) => props.children;
AnimatePresence.propTypes = { children: PropTypes.node };
