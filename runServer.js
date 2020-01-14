import createElement from './createElement'
import render, { preRootInstance } from './render'

const element1 = createElement(
  'div',
  { width: '200px' },
  createElement(
    'p',
    { height: '200px' },
    'text'
  )
)

render(document.getElementById('root'), element1)
window.preRootInstance = preRootInstance
window.render = render
window.createElement = createElement