import createElement from './createElement'
import render, { preRootInstance } from './stack/render'
import Component from './stack/component'

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
