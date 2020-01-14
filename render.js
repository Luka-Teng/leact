/**
 * 新概念instance
 * 在做reconcile的时候，我们需要存储对应element的dom元素
 * 这些dom元素在我们走更新阶段的是必须的
 * 因此只有element是不够的，我们需要instance来存储更多的可用信息
 * @prop { instance.element } 对应的element信息
 * @prop { instance.dom } 对应的dom节点
 * @prop { instance.childInstances } 对应子元素的instance
 * instantiate的过程就是将
 * element tree ---> instance tree
 * 而之所以这么做都是为我的tree提供能方便的操作能力
 */
const instantiate = (element) => {
  const { type, props: { children } } = element

  const dom = type === 'TEXT_TYPE'
    ? document.createTextNode('')
    : document.createElement(type)

  updateDomProperties(dom, element.props)

  const childInstances = children.map(instantiate)
  childInstances.forEach((childInstance) => {
    dom.append(childInstance.dom)
  })

  return {
    dom,
    element,
    childInstances
  }
}

/**
 * 更新dom元素的属性
 */
const updateDomProperties = (dom, nextProps, prevProps) => {
  const isEvent = name => name.startsWith("on")
  const isAttribute = name => !isEvent(name) && name != "children"

  /* 如果dom元素之前存在属性，则先取消之前的属性和事件绑定 */
  if (prevProps) {
    Object.keys(prevProps).forEach((key) => {
      if (isAttribute(key)) {
        dom[key] = null
      } else if (isEvent(key)) {
        const eventType = key.toLowerCase().substring(2)
        dom.removeEventListener(eventType, prevProps[key])
      }
    })
  }

  /* 绑定新的属性和事件 */
  Object.keys(nextProps).forEach((key) => {
    if (isAttribute(key)) {
      dom[key] = nextProps[key]
    } else if (isEvent(key)) {
      const eventType = key.toLowerCase().substring(2)
      dom.addEventListener(eventType, nextProps[key])
    }
  })
}

/** 
 * 将一个element tree渲染到某个dom节点
 * preRootInstance表示之前渲染过的rootInstance
 */
let preRootInstance = null
let render = (appDom, element) => {
  /* 判断是否存在已挂载节点 */
  if (preRootInstance) {
    /* 已有挂载节点，走更新流程 */
    const rootInstance = reconcile(appDom, preRootInstance, element)
    preRootInstance = rootInstance
  } else {
    /* 无挂载节点，走新增流程 */
    const rootInstance = instantiate(element)
    appDom.append(rootInstance.dom)
    preRootInstance = rootInstance
  }
}

/**
 * 将一个nodeInstance和一个element进行比较
 * 可以简单的理解成将新老两个dom-tree的同一位置的一个节点进行比较
 * 主要协助完成两件事
 * 1. 建立新的dom-tree（instance-tree形式）
 * 2. dom更新
 */
const reconcile = (parentDom, prevInstance, nextElement) => {
  if (nextElement === undefined) {
    /* 老节点不存在新节点中，走删除流程 */
    parentDom.removeChild(prevInstance.dom)
    return null
  } else if (prevInstance === undefined) {
    /* 新节点不存在老节点中，走新增流程 */
    const nextInstance = instantiate(nextElement)
    parentDom.append(nextInstance.dom)
    return nextInstance
  } else if (prevInstance.element.type === nextElement.type) {
    const { props: prevProps } = prevInstance.element
    const { props: nextProps } = nextElement
    /**
     * 新老节点类型相同，走更新流程
     * 复用旧dom元素，直接更新都没属性
     * 向下reconcile子元素
     */
    updateDomProperties(prevInstance.dom, nextProps, prevProps)

    /* childInstances需要重新reconcile */
    const childInstances = reconcileChild(prevInstance.dom, prevInstance.childInstances, nextProps.children)
    
    /* 我们直接更新/复用instance，并做返回*/
    prevInstance.childInstances = childInstances
    prevInstance.element = nextElement
    return prevInstance
  } else {
    /* 新老节点类型不同，走替换流程 */
    const nextInstance = instantiate(nextElement)
    parentDom.replace(nextInstance.dom, prevInstance.dom)
    return nextInstance
  }
}

/** 
 * reconcile子元素
 * 目前子元素的reconcile只是对位置进行一一比较
 * 必不会对key进行比较，key的功能后续添加
 */
const reconcileChild = (parentDom, prevChildInstances, nextChildElements) => {
  let maxLength = Math.max(prevChildInstances.length, nextChildElements.length)
  const nextChildInstances = []
  /* 按排列顺序 */
  for (let i = 0; i < maxLength; i++) {
    const childInstance = reconcile(parentDom, prevChildInstances[i], nextChildElements[i])
    childInstance && nextChildInstances.push(childInstance)
  }

  return nextChildInstances
}

export default render

export {
  preRootInstance
}