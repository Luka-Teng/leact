import createElement from './createElement'
import render, { rootFiber } from './fiber/render'

render(document.getElementById('root'), createElement('div', {},
  'text1',
  createElement(
    'div', 
    {
      id: 'first'
    },
    'text2'
  )
))

setTimeout(() => {
  render(document.getElementById('root'), createElement('div', {},
    'text1',
    createElement(
      'h1', 
      {
        id: 'first'
      },
      'text2'
    )
  ))
}, 5000)

window.rootFiber = rootFiber

