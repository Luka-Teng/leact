import createElement from './createElement'
import render, { rootFiber, useState } from './fiber/render'

const A = () => {
  const [a, setA] = useState(111)
  return createElement(
    'h1', 
    {
      id: 'first'
    },
    a,
    createElement('button', {
      onClick: () => {
        setA(222)
      }
    }, 'click')
  )
}

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
      A
    )
  ))
}, 2000)

window.rootFiber = rootFiber

