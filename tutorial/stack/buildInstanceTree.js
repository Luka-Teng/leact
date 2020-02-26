/** @jsx createElement */
import createElement from '../../createElement'
import Component from '../../stack/component'

/* Component A */
function A (props) {
  return <div>111</div>
}

/* Component B */
class B extends Component{
  render () {
    return <A />
  }
}

const element = <B />

const buildInstanceTree = (element) => {
  const type = element.type

  if (typeof type === 'string') {
    /* dom element */
    const dom = type === 'TEXT_TYPE'
    ? document.createTextNode('')
    : document.createElement(type)

    /* 将属性绑定到dom node上 */
    // updateDomProperties(dom, element.props)

    /**
     * dom element的特点：
     * 每个子element都是需要被渲染，所以每个都需要实例化的
     * renderedElements = children
     */
    const childInstances = element.props.children.map(buildInstanceTree)
    childInstances.forEach((childInstance) => {
      dom.append(childInstance.dom)
    })

    return {
      dom,
      element,
      childInstances
    }
  } else if (type.prototype instanceof Component) {
    /* 这边用type.prototype判断是否是继承，es6中的继承一般是将实例示例挂载被继承的Component Class的prototype上 */
    /* class Component */
    const props = element.props
    const componentInstance = new type(props)

    /* 运行willMount生命周期 */

    /**
     * Component element的特点：
     * 需要被渲染的element，是通过实例render出来的
     */
    const renderedElement = componentInstance.render()
    const childInstance = buildInstanceTree(renderedElement)
    const instance = {
      element,
      /* dom在不断递归中，指向最近的dom instance的dom属性 */
      dom: childInstance.dom,
      childInstance,
      componentInstance
    }
    componentInstance.__instance = instance

    /* 运行didMount生命周期 */

    return instance
  } else if (typeof type === 'function') {
    /* function Component */
    const props = element.props
    const renderedElement = type(props)
    const childInstance = buildInstanceTree(renderedElement)

    return {
      element,
      /* 与component element一样，dom在不断递归中，指向最近的dom instance的dom属性 */
      dom: childInstance.dom,
      childInstance
    }
  }
}

console.log(buildInstanceTree(element))