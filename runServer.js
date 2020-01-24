import createElement from './createElement'
import render, { preRootInstance } from './render'
import Component from './component'

class A extends Component {
  render () {
    const { text } = this.state
    return createElement(
      'div', 
      {
        id: 'first'
      },
      text
    )
  }
}

class B extends Component {
  render () {
    return createElement(
      'div', 
      222
    )
  }
}

render(document.getElementById('root'), createElement('div', {}, 
  createElement(A),
  createElement(B)
))

window.root = preRootInstance
