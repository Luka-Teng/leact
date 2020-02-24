import { reconcile } from './render'
class Component {
  constructor (props) {
    this.props = props
    this.state = {}
  }

  setState(partialState) {
    this.state = Object.assign({}, this.state, partialState)
    this.reconcileChildren()
  }

  reconcileChildren () {
    const parentDom = this.__instance.dom.parentNode
    const element = this.render()
    this.__instance.childInstance = reconcile(parentDom, this.__instance.childInstance, element)
  }
}

export default Component