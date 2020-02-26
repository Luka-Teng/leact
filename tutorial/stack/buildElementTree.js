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

/* build element tree */
const buildElementTree = (element) => {
  const newElement = {
    type: element.type,
    props: {
      ...element.props
    }
  }

  /* 删除两个无关属性 */
  delete newElement.props.__source
  delete newElement.props.__self

  if (typeof element.type === 'string') {
    /* dom类型的节点直接递归子节点 */
    newElement.props.children = element.props.children.map(buildElementTree)
  } else if (element.type.prototype instanceof Component) {
    /* class Component类型的节点需要render生成子节点，在进行递归 */
    const instance = new element.type()
    instance.props = element.props
    newElement.props.children = buildElementTree(instance.render())
  } else if (element.type instanceof Function) {
    /* function Component类型的节点需要return生成子节点，在进行递归 */
    newElement.props.children = buildElementTree(element.type(element.props))
  }
  
  return newElement
}

console.log(buildElementTree(element))